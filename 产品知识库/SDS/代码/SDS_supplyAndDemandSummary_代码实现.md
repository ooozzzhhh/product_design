# SDS_supplyAndDemandSummary 代码实现

- **更新时间**：2026-04-02（基于 `scp-foundation` 源码复核）
- **本次调研范围**：`/api/sds/supplyAndDemandSummary/*`（供需明细汇总：Controller、Service、数据流、与前端对接）
- **代码来源**：scp-foundation 本地仓库；VO 类位于 `com.yhl.scp.sds.extension.plan.vo`（扩展包，工作区若以 jar 引入则源码可能不在仓库内）

---

## 4.1 与 supplySummary 的区分

| 能力 | 路径前缀 | 说明 |
|------|-----------|------|
| **供应汇总** supplySummary | `/api/sds/supplySummary/` | 按供应分类与动态维度聚合多表供应数据，见 [[SDS_supplySummary_代码实现]] |
| **供需明细汇总** supplyAndDemandSummary | `/api/sds/supplyAndDemandSummary/` | 按 pegging 需求/供应与时段，展示期初、毛需求、计划/非计划供应、净需求、期末、缺料等 |

二者勿混用。

---

## 4.2 现状概述

supplyAndDemandSummary（供应和需求明细）面向 **物品+库存点** 分页，按 **场景关联的时段组**（非 AMS）或 **计划期间按天**（AMS）生成列头，将 SDS 需求与供应数据落入各时段后，组装成树形行结构（父行 + 子行）及每列数量。

主要能力：

- 支持按 `productId`、`stockPointId` 过滤 MDS 物品库存点分页列表；未传则按分页拉取符合条件的库存点
- 必填查询起始日 `startDate`，可选 `endDate`（默认取 MDS 计划展望结束）
- 并行查询需求（`DemandService`）与供应（`SupplyService`），时间范围从「最早可用日期」到查询结束日
- 通过 `SupplyService.getFix` 将供应 ID 区分为计划 / 非计划，用于「计划供应」「非计划供应」汇总
- 返回 `PageInfo<SupplyAndDemandSummaryVO>`，内含 `timeHead`（列头）与 `dataList`（多行指标及 `quantityMap`）

---

## 4.3 代码实现

### 4.3.1 文件位置

| 文件 | 路径 |
|------|------|
| Controller | `scp-sds-sdk/src/main/java/com/yhl/scp/sds/plan/controller/SupplyAndDemandDetailController.java` |
| Service 接口 | `scp-sds-api/src/main/java/com/yhl/scp/sds/plan/service/SupplyAndDemandDetailService.java` |
| Service 实现 | `scp-sds-sdk/src/main/java/com/yhl/scp/sds/plan/service/impl/SupplyAndDemandDetailServiceImpl.java` |
| VO | `SupplyAndDemandSummaryVO`、`SupplyAndDemandDetailVO`、`SupplyAndDemandStatisticsVO`（`com.yhl.scp.sds.extension.plan.vo`） |
| 依赖服务 | `DemandService`、`SupplyService`、`BohStockVersionService`；Feign：`IpsFeign`、`MdsFeign` |

### 4.3.2 API 接口（网关前缀）

前端 `baseUrl.sds` 为 `/api/sds`，完整路径示例：

| HTTP 方法 | 路径 | 说明 |
|-----------|------|------|
| GET | `/api/sds/supplyAndDemandSummary/getSummary` | 供需汇总分页数据 |
| GET | `/api/sds/supplyAndDemandSummary/getEarliestAvailableDate` | 最早可查询日期 |

**getSummary 请求参数**

| 参数 | 必填 | 说明 |
|------|------|------|
| startDate | 是 | `yyyy-MM-dd` |
| endDate | 否 | 默认计划展望结束；日内结束时刻会规范为当天 23:59:59 |
| productId | 否 | 拼入 MDS 物品库存点查询条件 |
| stockPointId | 否 | 同上 |
| 分页参数 | 依 BaseController | 与平台分页约定一致（如 pageNum、pageSize） |

**说明**：仅访问目录根 `/api/sds/supplyAndDemandSummary/` 一般不对应具体业务方法，须带 `getSummary` 或 `getEarliestAvailableDate`。

### 4.3.3 数据流（概要）

```
getSummary
  → 解析场景时段组（IPS Scenario.timePeriodGroupId；若无则按模块取 MDS 默认时段组）
  → MdsFeign 取时段列表；或与 AMS 一样按 PlanningHorizon 拆天
  → 用 startDate/endDate 过滤并截断首尾时段边界
  → MdsFeign.getProductStockPointByPage 分页物品库存点
  → 异步并行：DemandService.selectByParamsAndDateRange、SupplyService.selectByParamsAndDateRange
       （起始日为 getEarliestAvailableDate，结束日为查询 endDate）
  → 按 productStockPointId 分组需求/供应
  → 对每个库存点：用「筛选起始日前一日」相对最早日期的区间先跑一轮统计，得到进入首列的「期初」滚动值 endingStock
  → 对筛选后时段循环：calSupplyAndDemand → convertDataStruct 生成 SupplyAndDemandSummaryVO
  → 分页元数据来自 MDS 物品库存点查询的 PageInfo.total
```

**最早可用日期**（`getEarliestAvailableDate`）：优先取「默认且启用」的期初库存版本（`BohStockVersionService`）的 `availableTime` 所在日；否则取 MDS `PlanningHorizon` 的 `planStartTime`。

### 4.3.4 时段与边界处理要点

- 非 AMS：时段 `periodEnd` 在循环前会被调整为当天 **23:59:59**，便于与 supply/demand 时间比较。
- AMS：不按时段组拉 MDS 时段，而按 `planStartTime`～`planEndTime` 生成按天 `TimePeriodVO`。
- 需求/供应是否落入某时段：`periodStart <= 业务时间 <= periodEnd`（与代码中 compareTo 一致）。

### 4.3.5 指标与计算（单时段、calSupplyAndDemand）

记：期初 `beginningStock`（由上一时段期末滚动而来，且本时段会加上本时段内 **库存类供应** STOCK_SUPPLY）、毛需求 `grossDemands`（本时段各需求类型数量之和）、非计划供应合计 `totalNonPlannedSupplies`、计划供应合计 `totalPlannedSupplies`。

- **净需求**：`max(0, grossDemands - (beginningStock + totalNonPlannedSupplies))`
- **期末库存**：`max(0, beginningStock + totalNonPlannedSupplies + totalPlannedSupplies - grossDemands)`
- **缺料量**：`max(0, grossDemands - beginningStock - totalNonPlannedSupplies - totalPlannedSupplies)`

非计划/计划供应子类型过滤：在时段内且 `supplyType` 属于采购/运输/制造/采购在途（仓储）等，且供应 ID 在 `getFix` 返回的 YES（非计划）或 NO（计划）集合中。

### 4.3.6 返回结构（前端树表）

`convertDataStruct` 组装行（`SupplyAndDemandDetailVO`），含 `typeCode`、`typeName`、`id`（如 `outsideId-序号`）、`quantityMap`（key 为 `TimePeriodVO.joinStartAndEndWithoutYear()`，value 为数量）。

行分组大致为：**期初库存** → **毛需求**（含客户订单、预测、制造订单需求、运输订单需求；主生产计划需求单独一行）→ **非计划供应**（含子类型）→ **净需求** → **计划供应**（含子类型）→ **期末库存** → **缺料量**。

`SupplyAndDemandSummaryVO` 还包含：`productId`、`productCode`、`productName`、`stockPointId`、`stockPointCode`、`stockPointName`、`productStockPointId`、`timeHead`、`dataList`。

---

## 4.4 前端对接

| 文件 | 说明 |
|------|------|
| `scp-sds-front/src/api/demandAndSupplyDetails/index.js` | `getSummaryData` → `getSummary`；`getEarliestAvailableDate` |
| `scp-sds-front/src/views/supplyPlan/demandAndSupplyDetails/table.vue` | 供需明细表 |
| `scp-sds-front/src/views/supplyPlan/BOMlook/...` | BOM 相关供需 |
| `scp-sds-front/src/views/inventoryPlan/supplyBalance/...` | 物料供需平衡等（部分文件引用） |

---

## 4.5 环境与鉴权

- 联调测试环境示例：`https://scp-test.uhalean.com/api/sds/supplyAndDemandSummary/getSummary?startDate=yyyy-MM-dd`（需登录态及租户/场景等与线上一致的头或 Cookie）。
- 无鉴权或网关不可用时可能返回 **401/503** 等，需结合网关与 SDS 服务状态排查。

---

## 4.6 已知实现注意点

- **异常文案**：`SupplyAndDemandDetailServiceImpl` 中多处 `throw new BusinessException("...")` 为硬编码字符串，与项目规范（`BusinessErrorEnum` + `getI18nErrordesc()`）不一致；若统一治理需补枚举与中英文 properties。
- **MasterProduction 与毛需求子节点**：`masterProductionDemands` 在 `convertDataStruct` 中未加入 `grossDemands.setChildrenData(demands)` 的子列表，界面展示是否与产品预期一致需产品侧核对。

---

## 4.7 潜在改动影响

| 改动方向 | 影响范围 |
|----------|-----------|
| 时段/计划展望规则 | MDS feign、AMS 分支、列头与数量对齐 |
| pegging 需求供应查询 | `DemandService`/`SupplyService` 及底层表 |
| 计划/非计划判定 | `SupplyService.getFix` 与订单标识逻辑 |
| 分页条件 | MDS `getProductStockPointByPage` 与 queryCriteriaParam 拼接 |
