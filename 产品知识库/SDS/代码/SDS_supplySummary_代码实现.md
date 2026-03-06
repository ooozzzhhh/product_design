# SDS_supplySummary 代码实现

- **更新时间**：2026-03-06
- **本次调研范围**：sds/supplySummary/ 功能全链路（Controller、Service、DAO、枚举、数据流、SQL 实现）
- **代码来源**：scp-foundation 本地仓库 + scp-sds-infra-base jar（编译包）

---

## 4.1 现状概述

supplySummary（供应汇总）是 SDS 模块下的供应数据聚合查询功能，主要具备以下能力：

- 支持按供应分类（计划供应 / 非计划供应 / 全部）展示供应汇总数据
- 支持多维度动态分组聚合（groupByParam），聚合维度可由用户从下拉列表中选择
- 将供应明细数据按时段（period）归档，以时段为列展示各维度下的供应数量
- 分页返回汇总结果，支持排序与筛选
- 动态时段序列通过 MDS feign 接口获取

当前实现覆盖 5 类供应数据来源：采购订单（purchase_order）、调拨订单（transport_order）、生产订单（work_order）、期初库存（boh_stock）、采购预测库存（purchase_forecast_stock）。

---

## 4.2 代码实现

### 4.2.1 文件位置

| 文件 | 路径 |
|------|------|
| Controller | `scp-sds-sdk/src/main/java/com/yhl/scp/sds/supplySummary/controller/SupplySummaryController.java` |
| Service 接口 | `scp-sds-api/src/main/java/com/yhl/scp/sds/supplySummary/service/SupplySummaryService.java` |
| Service 实现 | `scp-sds-sdk/src/main/java/com/yhl/scp/sds/supplySummary/service/impl/SupplySummaryServiceImpl.java` |
| DAO（基础，编译包） | `~/.m2/.../scp-sds-infra-base-4.0.0-SNAPSHOT.jar!/com/yhl/scp/sds/supplySummary/dao/SupplySummaryBasicDao.xml` |
| DAO（扩展，编译包） | `~/.m2/.../scp-sds-infra-4.0.0-SNAPSHOT.jar!/com/yhl/scp/sds/supplySummary/dao/SupplySummaryDao.xml`（仅 extends BasicDao，无额外 SQL） |
| 枚举 | `scp-sds-api/.../enums/SupplyCategoryEnum.java`、`SupplyTypeEnum.java` |

### 4.2.2 API 接口

| HTTP 方法 | 路径 | 说明 |
|-----------|------|------|
| GET | `/supplySummary/dimensionDropdown?supplyCategory=` | 聚合维度下拉选项 |
| GET | `/supplySummary/page?supplyVersionId=&supplyCategory=` | 分页查询（支持 sortParam、queryCriteriaParam、groupByParam） |
| GET | `/supplySummary/dynamicTimeSeries` | 动态时段序列（从 MDS feign 获取） |

### 4.2.3 枚举定义

**供应分类枚举（SupplyCategoryEnum）**

| Code | 含义 |
|------|------|
| PLAN_SUPPLY | 计划供应 |
| NON_PLAN_SUPPLY | 非计划供应 |
| （空值/ALL） | 全部供应 |

**供应子类型枚举（SupplyTypeEnum）**

| Code | 含义 |
|------|------|
| PURCHASE_ORDER | 采购订单 |
| TRANSPORT_ORDER | 调拨订单 |
| WORK_ORDER | 生产订单 |
| BOH_STOCK | 期初库存 |
| PURCHASE_FORECAST_STOCK | 采购预测库存 |

### 4.2.4 数据流

```
前端请求（supplyCategory、groupByParam、supplyVersionId、sortParam、queryCriteriaParam）
    │
    ▼
SupplySummaryController.page()
    │
    ▼
SupplySummaryServiceImpl.page()
    │
    ├─① groupByParam 为空？→ 调用 dimensionDropdown 取全部维度作为默认值
    │
    ├─② MDS feign 获取时段列表（LIMITED_CAPACITY_COMPUTING 类型默认时段）
    │
    ├─③ DAO 执行汇总查询（UNION ALL + GROUP BY groupByParam）→ 返回聚合行列表
    │
    ├─④ DAO 执行明细查询（UNION ALL，含 supply_date 和 quantity）→ 返回所有供应明细记录
    │
    ├─⑤ 将明细按时段归档（periodStart 匹配），聚合到对应汇总行的 supplyQuantityMap
    │    （key = periodStart 字符串，value = 该时段数量合计）
    │
    ├─⑥ translate() 将枚举 code 翻译为 label（ImmutableMap 硬编码 8 个枚举字段映射）
    │
    └─⑦ 返回 PageInfo<SupplySummaryVO>
```

### 4.2.5 dimensionDropdown 逻辑

1. `initDimensionList()` 始终返回 8 个**硬编码固定维度**：物品代码、物品名称、物品类型、库存点代码、库存点名称、物品系列代码、物品系列名称、供应子类型
2. 查询 `information_schema.COLUMNS`，找出在**所有涉及表中均存在**的 varchar 字段（HAVING count = tableCount），追加为额外公共维度
3. 若 `order_flag` 字段不在公共字段中，则追加「订单标识」维度

### 4.2.6 SQL 实现结构

DAO XML（SupplySummaryBasicDao.xml）中共有 **6 条查询**，按供应分类分组：

| SQL ID | 用途 |
|--------|------|
| selectPlanSupplyByCondition | 计划供应汇总查询 |
| selectPlanSupplyDetailsByCondition | 计划供应明细查询 |
| selectNonPlanSupplyByCondition | 非计划供应汇总查询 |
| selectNonPlanSupplyDetailsByCondition | 非计划供应明细查询 |
| selectSupplyByCondition | 全部供应汇总查询 |
| selectSupplyDetailsByCondition | 全部供应明细查询 |

每条 SQL 均为 **3～5 段 UNION ALL 硬编码**，每段对应一张固定供应表，并 JOIN MDS 的以下主数据表：
- `mds_pro_product_base`（物品基础信息）
- `mds_pro_stock_point`（库存点信息）
- `mds_pro_product_series`（物品系列信息）

动态参数注入方式：
- `${groupByParam}`：GROUP BY 子句，**直接字符串插值**（非参数化）
- `${queryCriteriaParam}`：WHERE 条件，**直接字符串插值**（非参数化）

---

## 4.3 数据库表结构

> 以下表结构基于代码推断，待实库确认（scp-sds 库）。

### 核心供应数据表

| 表名 | 用途 | 关键字段 | 备注 |
|------|------|----------|------|
| `sds_ord_purchase_order` | 采购订单 | supply_date, quantity, order_flag | order_flag='NO' → 计划供应 |
| `sds_ord_work_order` | 生产订单 | supply_date, quantity, order_flag | order_flag='NO' → 计划供应；order_flag='YES' → 非计划供应 |
| `sds_ord_transport_order` | 调拨订单 | supply_date, quantity, order_flag | order_flag='NO' → 计划供应；order_flag='YES' → 非计划供应 |
| `sds_sup_boh_stock` | 期初库存 | quantity | 仅属于非计划供应，无 order_flag 过滤 |
| `sds_sup_purchase_forecast_stock` | 采购预测库存 | supply_date, quantity | 仅属于非计划供应 |

### 供应分类与表的映射关系

| supplyCategory | 涉及表 | order_flag 过滤条件 |
|----------------|--------|---------------------|
| PLAN_SUPPLY | sds_ord_purchase_order、sds_ord_work_order、sds_ord_transport_order | order_flag='NO' |
| NON_PLAN_SUPPLY | sds_ord_transport_order、sds_ord_work_order、sds_sup_boh_stock、sds_sup_purchase_forecast_stock | transport/work_order：order_flag='YES'；boh_stock：无条件 |
| ALL（空） | 上述全部 5 张表 | transport/work_order：不过滤 order_flag |

### 关联主数据表（MDS 模块）

| 表名 | 用途 | JOIN 关系 |
|------|------|-----------|
| `mds_pro_product_base` | 物品基础信息（物品代码、名称、类型） | 供应表 JOIN 物品表 |
| `mds_pro_stock_point` | 库存点信息（库存点代码、名称） | 供应表 JOIN 库存点表 |
| `mds_pro_product_series` | 物品系列信息（系列代码、名称） | 物品表 JOIN 系列表 |

---

## 4.4 业务规则与约束

### 供应分类规则

- `order_flag` 字段是区分计划供应与非计划供应的核心标识
- `order_flag='NO'`：计划供应（基于计划生成的订单）
- `order_flag='YES'`：非计划供应（基于实际订单）
- 期初库存（boh_stock）始终归属非计划供应，不依赖 order_flag

### 聚合维度规则

- 默认维度列表（8 个）硬编码，始终包含在可选维度中
- 额外维度来源于 `information_schema.COLUMNS` 动态查询：只有在**所有涉及表中均存在**的 varchar 字段才会被追加
- groupByParam 格式：逗号分隔的下划线格式字段名（如 `item_code,stock_point_code`）

### 时段匹配规则

- 时段由 MDS feign 接口获取（LIMITED_CAPACITY_COMPUTING 类型的默认时段）
- 明细数据中的 `supply_date` 按 `periodStart` 归档：supply_date 落在 [periodStart, periodEnd) 区间则归入该时段
- 归档后汇总到 `supplyQuantityMap`（key=periodStart 字符串，value=数量合计）

### 翻译规则

- `translate()` 使用 ImmutableMap 硬编码 8 个枚举字段名到枚举列表的映射
- 遍历 VO 所有字段，将枚举 code 翻译为对应 label

---

## 4.5 与需求相关的要点

### 当前实现有助于需求实现的点

- 已具备完整的供应汇总查询链路，覆盖 5 类供应数据源
- 动态聚合维度机制（groupByParam + dimensionDropdown）提供了一定的灵活性
- 分页、排序、筛选参数已支持

### 当前实现构成限制或需改造的点

- 扩展新供应表类型需修改多处（高耦合，详见 4.6）
- 响应结构缺少列元数据，前端无法动态感知维度列与时间列的顺序
- 存在 SQL 注入风险，groupByParam 和 queryCriteriaParam 未做参数化处理
- 异常处理不符合项目规范，存在直接抛出字符串文案的情况

---

## 4.6 当前实现的缺点与问题

### 问题一：可扩展性差（高耦合硬编码）

新增一类供应表需同时修改以下 3 处，且每处改动均为侵入式：

1. **ServiceImpl**：`getTableNames()` 中追加硬编码表名；`translate()` 的 ImmutableMap 中追加枚举映射
2. **DAO XML（6 条 SQL）**：每条 UNION ALL 分支均需添加新表的查询段（6 × 1 = 6 处修改）
3. **SupplyTypeEnum**：新增枚举值

**影响**：可维护性低，新增供应类型时极易遗漏某条 SQL 的 UNION ALL 分支，导致数据不一致。

### 问题二：聚合维度列顺序问题（前端无法感知列结构）

- 响应结构为 `PageInfo<SupplySummaryVO>`，无列元数据
- 前端无法从响应中获知「哪些字段是维度列」「哪些字段是时间列」「维度列的用户指定顺序是什么」
- 前端只能按 VO 的固定字段顺序渲染，无法保证维度列在时间列之前

**影响**：表格列顺序混乱，影响用户体验。

### 问题三：dimensionDropdown 的 orderFlag Bug

- 步骤3的判断逻辑：`existFields.contains("orderFlag")`（camelCase）
- 但 `existFields` 实际存储的是 `order_flag`（underscore 格式）
- 两者永远不匹配 → `orderFlag` 始终被追加到维度列表
- 若公共字段中已包含 `order_flag`，则产生**重复维度**

**影响**：「订单标识」维度始终出现在下拉列表中，且可能重复。

### 问题四：SQL 注入风险

- `${groupByParam}` 和 `${queryCriteriaParam}` 使用 MyBatis 的 `${}` 字符串插值而非 `#{}`（参数化占位符）
- 前端传入非法值时，直接拼入 SQL，导致 `BadSqlGrammarException`
- 该异常携带完整 SQL 语句透传到前端，暴露内部表结构与实现细节

**影响**：存在 SQL 注入安全风险；错误信息暴露内部信息，违反项目信息透传规范。

### 问题五：translate() 空列表 IndexOutOfBoundsException

- `translate()` 中调用 `targetCommonEnums.get(0)` 获取匹配枚举
- 当枚举 code 无法在列表中找到匹配项时，`targetCommonEnums` 为空列表，`get(0)` 抛出 `IndexOutOfBoundsException`
- 该异常未被 Service 层捕获处理

**影响**：翻译逻辑存在运行时崩溃风险，特别是在枚举值扩展后旧数据存在不兼容 code 的场景。

### 问题六：异常处理不符合项目规范（三处违规）

Service 实现中存在以下违规抛出（违反 BusinessErrorEnum + getI18nErrordesc() 规范）：

| 位置 | 违规代码 | 问题说明 |
|------|----------|----------|
| 时段获取失败 | `throw new BusinessException("请先在时段设置维护时段")` | 未使用 BusinessErrorEnum，文案直接硬编码 |
| 供应类型校验（两处） | `throw new BusinessException("供应类型错误")` | 未使用 BusinessErrorEnum，文案过于简单，不符合「对象/参数 + 问题 + 下一步指引」规范 |

---

## 4.7 潜在改动影响

| 改动方向 | 影响范围 | 风险点 |
|----------|----------|--------|
| 新增供应类型 | ServiceImpl（2 处）、DAO XML（6 条 SQL）、SupplyTypeEnum | 遗漏某条 SQL 分支将导致数据不一致，且无单测覆盖难以感知 |
| 改造列元数据响应 | Controller/VO、前端渲染逻辑 | 需同步修改前端，接口协议变更需评估兼容性 |
| 修复 SQL 注入（改为参数化） | DAO XML（6 条 SQL）、groupByParam/queryCriteriaParam 的生成逻辑 | GROUP BY 子句难以完全参数化，需引入白名单校验机制 |
| 统一异常处理 | ServiceImpl（3 处违规）、BusinessErrorEnum（新增错误码）、i18n properties 文件 | 需新增 SDS 相关错误码，并同步更新中英文 properties |
| 修复 orderFlag 重复维度 Bug | ServiceImpl.dimensionDropdown | 影响下拉维度列表展示，修复后「订单标识」维度仅在公共字段中不含 order_flag 时出现 |
| 修复 translate() 崩溃 Bug | ServiceImpl.translate | 修复后对已有翻译逻辑无破坏性，属低风险改动 |
