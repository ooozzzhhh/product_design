> **文档说明**：本 PRD 面向研发和测试团队，基于问题分析报告 `SDS_BUG_2026-03-06_01` 发起，属代码优化类增量需求。经用户明确授权，文档中使用技术词汇、类名、SQL、接口字段等技术细节，技术可读性优先。
>
> - **问题分析报告**：`产品设计/产品问题分析/SDS/SDS_BUG_2026-03-06_01/问题分析报告.md`
> - **知识库来源**：`产品设计/产品知识库/SDS/代码/SDS_supplySummary_代码实现.md`
> - **创建时间**：2026-03-06（时间戳 20260306152225）

---

# 1. **需求概述**

## 1.1 需求涉及的模块

SDS（供需管理）—— 供应管理 > 物料供应能力汇总表（supplySummary）

## 1.2 需求名称

SDS 物料供应能力汇总表功能优化

## 1.3 需求简述

**现状**：物料供应能力汇总表将来自 5 类供应来源（采购订单、调拨订单、生产订单、期初库存、采购预测库存）的数据聚合展示为「维度×时段」矩阵表格，支持按供应分类筛选与多维度分组。当前实现中，新增供应来源需同时改动 ServiceImpl、6 条 DAO SQL 和枚举三处；响应体不含列元数据导致维度列无法正确排序；输入参数未做白名单校验，异常处理三处违规且存在 SQL 内容外泄安全问题；另有两个附带 Bug（orderFlag 重复维度、translate() 越界崩溃）。

**问题**：
- 可扩展性差，每增加供应来源需改 3 处代码，遗漏任何一处将导致数据静默缺失
- 维度列与时间列混排，用户无法得到预期的「维度列在左、时间列在右」视图
- 前端直接暴露 SQL 原文与 Java 异常堆栈，存在安全隐患，用户体验差

**需求价值**：
- 通过通用大表方案降低供应来源扩展成本，未来新增供应类型只写数据、不改代码
- 增加列元数据接口，彻底解决列顺序混乱问题，提升表格可读性
- 规范异常处理、增加输入白名单校验，消除 SQL 信息外泄安全风险，对齐项目异常处理规范

---

# 2. **需求范围和流程概览**

## 2.1 基本概念说明

**一级模块**：SDS（供需管理）
**二级模块**：供应管理 > 物料供应能力汇总表（supplySummary）

本次需求涉及对**已有**二级模块「物料供应能力汇总表」进行改造，不新增模块。按三个子优化方向拆为三级模块：

| 三级模块 | 对应问题 | 改造类型 |
|----------|----------|----------|
| 4.1 供应来源可扩展机制 | 问题1：可扩展性差 | 架构改造 + 新建数据库表 |
| 4.2 表格列元数据接口 | 问题2：维度列顺序错乱 | 接口协议改造 |
| 4.3 输入校验与异常处理规范化 | 问题3：SQL 外泄 + 三处违规 + 两个 Bug | 安全加固 + 规范整改 |

## 2.2 业务流程概览

当前主流程（改造前）：

```
前端请求（supplyCategory、groupByParam、supplyVersionId）
  → Controller.page()
  → ServiceImpl.page()
    → 取时段列表（MDS feign）
    → DAO 汇总查询（UNION ALL 6条SQL）
    → DAO 明细查询（UNION ALL 6条SQL）
    → 时段归档 → translate() → 返回 PageInfo<SupplySummaryVO>
```

改造后主流程调整点：
- **4.1**：在 6 条 SQL 中各追加一段固定的 `sds_supply_universal` UNION ALL 分支（一次性改造）；`getTableNames()` 和 `SupplyTypeEnum` 同步更新
- **4.2**：`page()` 返回时，额外组装 `columns` 列定义列表，响应结构由 `{list, total}` 变为 `{columns, list, total}`
- **4.3**：在进入 DAO 前，增加 `groupByParam` 白名单校验；将三处违规异常替换为 BusinessErrorEnum；修复两个附带 Bug；Service 层捕获 DB 异常防止 SQL 外泄

## 2.3 数据流程概览

**输入**：
- 前端请求参数：`supplyVersionId`、`supplyCategory`（SupplyCategoryEnum）、`groupByParam`（逗号分隔字段名）、`sortParam`、`queryCriteriaParam`、分页参数
- MDS feign 接口：获取时段列表（LIMITED_CAPACITY_COMPUTING 类型的默认时段）
- 数据库（scp-sds 库）：5 张现有供应表 + 新增 `sds_supply_universal` 通用大表
- MDS 主数据表：`mds_pro_product_base`、`mds_pro_stock_point`、`mds_pro_product_series`

**输出**：
- `/supplySummary/page` 响应新增 `columns` 字段（列定义列表，与 `list`、`total` 并列）
- `/supplySummary/dimensionDropdown` 响应行为修正（`orderFlag` 不再重复出现）
- 异常响应：由 SQL 堆栈信息变为规范业务提示文案

---

# 3. 对标分析

## 3.1 SAP IBP（Integrated Business Planning）

SAP IBP 的供应视图（Supply View）在列元数据与扩展性方面的设计理念：

**列元数据与布局控制**：IBP 采用「Key Figure」（关键指标）+ 「Planning Level」（计划层级）的二维结构，列定义完全由服务端下发，前端表格完全依赖服务端元数据驱动渲染。用户选择聚合层级后，服务端明确返回「哪些维度按什么顺序在左侧固定列、哪些时间桶在右侧滚动列」，前端不做任何顺序决策。这与本次 4.2 方案「服务端下发 `columns` 列定义、前端按 order 渲染」的设计方向高度一致。

**供应来源可扩展性**：IBP 通过「Supply Source Category」配置化机制来管理供应来源，新增供应来源通过配置而非代码变更来接入聚合查询，最终体现在 HANA 视图层做 UNION 合并，应用层无感知。这与本次 4.1 方案「新建通用大表、未来新供应只写数据不改代码」的思路相同，只是 IBP 采用数据库视图层合并，本次方案采用固定 UNION ALL 分支接入。

**错误提示**：IBP 对参数错误的提示明确区分「数据问题」和「配置问题」，提示语言始终面向业务用户（如「所选计划期间尚未配置，请联系管理员」），不暴露任何技术实现细节。这与本次 4.3 方案新增 SDS 错误码并规范文案的方向一致。

## 3.2 Blue Yonder（原 JDA）供应计划模块

Blue Yonder 的 Luminate Planning 在供应汇总视图的设计：

**列配置**：列定义由服务端「View Definition」接口统一下发，包含每列的显示名称、数据类型（维度/指标/时间）、排列顺序，前端完全依赖服务端定义渲染，不维护任何硬编码列顺序。维度列始终在指标/时间列之前，顺序由用户最近一次的「Group By」选择决定，服务端负责记忆并在响应中回传。

**扩展性**：新增供应类型通过配置「Supply Type」元数据完成，底层通过统一的 Supply Fact 表（与本次 `sds_supply_universal` 设计类似）存储，不同供应类型通过 `supply_type` 字段区分，查询层无需感知具体供应来源表。

**错误处理**：所有错误响应均通过统一的 Error Code + 国际化文案机制下发，Error Code 与具体 HTTP 状态码解耦，客户端通过 Error Code 决定是否重试、是否跳转配置页，完全不暴露后端技术细节。

**对本需求的参考价值**：两款产品均验证了「服务端元数据驱动列渲染」「统一供应大表」「规范错误码」三条设计路径的可行性，本次方案在这三个方向上均与行业主流做法对齐。

---

# 4. **详细解决方案**

## 4.1 **供应来源可扩展机制**

### 4.1.1 模块描述

本模块对「供应来源 → 数据库表」的扩展机制进行一次性架构改造。当前新增供应来源需同时修改 `getTableNames()`、6 条 DAO SQL 和 `SupplyTypeEnum` 三处，改造后新增供应类型只需向通用大表 `sds_supply_universal` 写入数据，无需修改任何代码。

本次改造是一次性侵入式改造（修改 6 条 SQL、`getTableNames()`、`SupplyTypeEnum`），完成后未来扩展不再需要改动这些位置。

### 4.1.2 输入

**新增数据库表**：`sds_supply_universal`（通用供应大表，scp-sds 库）

建表 DDL：

```sql
CREATE TABLE `sds_supply_universal` (
  `id`                BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `supply_version_id` BIGINT        NOT NULL                COMMENT '供应版本ID，与现有供应表保持一致',
  `supply_type`       VARCHAR(64)   NOT NULL                COMMENT '供应子类型标识，对应 SupplyTypeEnum code（如 UNIVERSAL_SOURCE_01）',
  `item_code`         VARCHAR(64)   NOT NULL                COMMENT '物品代码，关联 mds_pro_product_base.item_code',
  `stock_point_code`  VARCHAR(64)   NOT NULL                COMMENT '库存点代码，关联 mds_pro_stock_point.stock_point_code',
  `supply_date`       DATE          NOT NULL                COMMENT '供应日期，用于时段归档',
  `quantity`          DECIMAL(20,6) NOT NULL DEFAULT 0      COMMENT '供应数量',
  `order_flag`        VARCHAR(8)    NOT NULL                COMMENT '计划/非计划标识：NO=计划供应，YES=非计划供应',
  `remark`            VARCHAR(256)  DEFAULT NULL            COMMENT '备注，供业务侧标注来源或场景说明',
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_supply_version_id` (`supply_version_id`),
  KEY `idx_item_stock_date`   (`item_code`, `stock_point_code`, `supply_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通用供应大表，未来新增供应类型统一写入此表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `supply_version_id` | BIGINT | 是 | 关联供应版本，与 `sds_ord_purchase_order` 等现有表保持一致 |
| `supply_type` | VARCHAR(64) | 是 | 供应子类型，值须存在于 `SupplyTypeEnum`；未来配置化扩展时可扩展为外键 |
| `item_code` | VARCHAR(64) | 是 | 与 `mds_pro_product_base` 做 JOIN 的关联键 |
| `stock_point_code` | VARCHAR(64) | 是 | 与 `mds_pro_stock_point` 做 JOIN 的关联键 |
| `supply_date` | DATE | 是 | 时段归档依据，语义与现有供应表 `supply_date` 一致 |
| `quantity` | DECIMAL(20,6) | 是 | 供应数量，精度与现有表对齐 |
| `order_flag` | VARCHAR(8) | 是 | `NO`=计划供应，`YES`=非计划供应；语义与现有供应表 `order_flag` 完全一致 |
| `remark` | VARCHAR(256) | 否 | 备注，供实施/业务标注数据来源 |

**修改已有代码**：

- `SupplyTypeEnum`：新增枚举值 `UNIVERSAL`（通配枚举，表示 `sds_supply_universal` 中的记录；具体子类型由 `supply_type` 字段区分）。枚举 code 建议为 `UNIVERSAL`，中文 label 为「通用供应」。
- `SupplySummaryServiceImpl.getTableNames()`：将 `sds_supply_universal` 加入三个供应分类（PLAN_SUPPLY、NON_PLAN_SUPPLY、ALL）的表名列表；计划/非计划过滤仍依赖 `order_flag` 字段，无需在 `getTableNames()` 层面区分。
- `SupplySummaryBasicDao.xml`：6 条 SQL 各追加一段 `sds_supply_universal` 的 UNION ALL 分支（详见 4.1.5 业务规则）。

### 4.1.3 输出

- 新建 `sds_supply_universal` 表（DDL 见 4.1.2）
- `SupplyTypeEnum` 新增 `UNIVERSAL` 枚举值
- `getTableNames()` 返回的表名列表中，三个分类均包含 `sds_supply_universal`
- `SupplySummaryBasicDao.xml` 6 条 SQL 各追加 `sds_supply_universal` UNION ALL 分支后，改造完成；后续新增供应类型**只向通用表写数据，不再需要改 SQL 或枚举**

### 4.1.4 业务流程

改造后，新增供应来源的流程由「修改代码 + 部署」变为「写入数据」：

```
【改造前】新增供应类型
  → 修改 getTableNames()（3处分支）
  → 修改 DAO XML（6条SQL各追加UNION ALL）
  → 修改 SupplyTypeEnum（新增枚举值）
  → 回归测试 → 部署

【改造后】新增供应类型
  → 向 sds_supply_universal 写入数据（supply_type 填新类型标识）
  → 若新类型需出现在前端下拉，则在 SupplyTypeEnum 新增对应枚举值（可选）
  → 完成，无需改 SQL，无需改 Service
```

现有供应数据查询流程不变，`sds_supply_universal` 以固定第 6 条 UNION ALL 分支参与所有 6 条 SQL 查询。

### 4.1.5 业务规则

**规则 4.1.5.1 — `sds_supply_universal` 接入 SQL 的方式**

在 `SupplySummaryBasicDao.xml` 的 6 条 SQL 中，各在现有 UNION ALL 之后追加以下格式的分支（以计划供应汇总查询为例）：

```sql
UNION ALL
SELECT
    u.item_code,
    p.item_name,
    p.item_type,
    u.stock_point_code,
    sp.stock_point_name,
    ps.product_series_code,
    ps.product_series_name,
    u.supply_type       AS supply_type,
    u.supply_date,
    u.quantity,
    u.order_flag
FROM sds_supply_universal u
LEFT JOIN mds_pro_product_base  p  ON u.item_code       = p.item_code
LEFT JOIN mds_pro_stock_point   sp ON u.stock_point_code = sp.stock_point_code
LEFT JOIN mds_pro_product_series ps ON p.product_series_code = ps.product_series_code
WHERE u.supply_version_id = #{supplyVersionId}
  AND u.order_flag = 'NO'   -- 计划供应查询时；非计划供应查询时改为 'YES'；全部查询时不加此条件
```

6 条 SQL 与 `order_flag` 条件对应关系：

| SQL ID | 供应分类 | `order_flag` 条件 |
|--------|----------|-------------------|
| `selectPlanSupplyByCondition` | 计划供应汇总 | `order_flag = 'NO'` |
| `selectPlanSupplyDetailsByCondition` | 计划供应明细 | `order_flag = 'NO'` |
| `selectNonPlanSupplyByCondition` | 非计划供应汇总 | `order_flag = 'YES'` |
| `selectNonPlanSupplyDetailsByCondition` | 非计划供应明细 | `order_flag = 'YES'` |
| `selectSupplyByCondition` | 全部汇总 | 不加 `order_flag` 条件 |
| `selectSupplyDetailsByCondition` | 全部明细 | 不加 `order_flag` 条件 |

**规则 4.1.5.2 — 兼容性约束**

- 现有 5 张供应表（`sds_ord_purchase_order`、`sds_ord_transport_order`、`sds_ord_work_order`、`sds_sup_boh_stock`、`sds_sup_purchase_forecast_stock`）的 UNION ALL 分支**保持不变**，不做合并或迁移。
- `sds_supply_universal` 以**追加**形式并入，现有历史数据不从原表迁移。
- 若 `sds_supply_universal` 表中无数据，追加的 UNION ALL 分支返回空集，对查询结果无影响（回归安全）。

**规则 4.1.5.3 — SupplyTypeEnum 更新**

新增枚举值 `UNIVERSAL`，code=`UNIVERSAL`，中文 label=「通用供应」，英文 label=「Universal Supply」。`translate()` 方法的 ImmutableMap 中同步追加 `UNIVERSAL` → 对应枚举列表的映射。

**规则 4.1.5.4 — 通用大表归属分类判断**

`sds_supply_universal` 数据在计划/非计划/全部三个分类下的归属，完全由该行记录的 `order_flag` 字段决定（`NO`=计划，`YES`=非计划），与现有供应表的逻辑一致，无需额外配置。

**规则 4.1.5.5 — 前端供应类型下拉适配**

若 `sds_supply_universal` 中存在多种 `supply_type` 值（即多个新供应来源均写入通用表），当前前端供应类型下拉无需立即变动（下拉显示的是 `SupplyCategoryEnum`：计划供应/非计划供应/全部，不展示具体供应子类型）。若未来需要在下拉中区分通用表内的子类型，属后续扩展需求（见第 5 章）。

### 4.1.6 原型图

本子模块为纯后端架构改造，不涉及前端页面变更，无需原型图。

### 4.1.7 用例

#### 正向用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U41-01 | 计划供应分类查询包含通用表数据 | `sds_supply_universal` 中存在 `supply_version_id=V1`、`order_flag='NO'`、`item_code='A001'`、`stock_point_code='WH01'`、`supply_date='2026-04-01'`、`quantity=100` 的记录 | 以供应版本 V1、分类「计划供应」调用 `/supplySummary/page` | 响应 `list` 中包含 `itemCode='A001'`、`stockPointCode='WH01'` 的行，且 `supplyQuantityMap` 中 `2026-04-01` 的值包含 100（汇总后可与其他来源叠加）；不出现接口错误 |
| SDS-U41-02 | 非计划供应分类查询包含通用表数据 | `sds_supply_universal` 中存在 `order_flag='YES'`、`item_code='B001'`、`supply_date='2026-04-01'`、`quantity=50` 的记录 | 以「非计划供应」分类调用 `/supplySummary/page` | 响应 `list` 中包含 `itemCode='B001'` 的行，`supplyQuantityMap` 中 `2026-04-01` 的值包含 50 |
| SDS-U41-03 | 全部分类查询同时包含通用表与原有 5 类来源数据 | `sds_supply_universal` 中存在 `order_flag='NO'` 与 `order_flag='YES'` 的数据；原有 5 张供应表中存在同供应版本的数据 | 以「全部」分类调用 `/supplySummary/page` | 响应 `list` 中同时出现通用表数据行与来自原有 5 张供应表的数据行，数据不丢失、不重复 |
| SDS-U41-04 | SupplyTypeEnum 新增 UNIVERSAL 枚举后正常加载 | 代码已完成改造，UNIVERSAL 枚举值已定义 | 启动服务，调用 `/supplySummary/page` 接口 | 服务正常启动，接口正常返回，枚举加载无报错 |

#### 逆向 / 异常用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U41-05 | 通用表为空时查询不影响结果 | `sds_supply_universal` 为空表（无任何记录）；原有 5 张供应表存在数据 | 以任意分类调用 `/supplySummary/page` | 响应结果与通用表改造前完全一致，不多不少，接口无报错 |
| SDS-U41-06 | 通用表中 supply_type 不在 SupplyTypeEnum 中的数据不导致崩溃 | `sds_supply_universal` 存在 `supply_type='UNKNOWN_TYPE'` 的记录 | 调用 `/supplySummary/page` | 该记录正常参与 UNION ALL 查询并出现在结果中（supply_type 字段随数据返回），服务不崩溃 |

#### 回归用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U41-07 | 原有采购订单数据查询结果不变（回归） | 改造前已记录采购订单来源的查询快照（list 条目数、各物料汇总数量）；`sds_supply_universal` 为空 | 以相同供应版本、「计划供应」分类查询，对比改造前快照 | list 条目数与各物料汇总数量与改造前快照完全一致 |
| SDS-U41-08 | 原有生产订单、调拨订单、期初库存、预测库存数据回归 | 同 SDS-U41-07，覆盖另外 4 张来源表 | 以相同供应版本分别以「计划供应」「非计划供应」「全部」分类查询，对比改造前快照 | 所有分类下，来自原有 4 张供应表的数据与改造前快照一致，无静默丢失 |
| SDS-U41-09 | getTableNames() 三个分类均包含通用表（单元级验证） | 代码改造完成 | 通过单元测试或断点验证，调用 `getTableNames(SupplyCategoryEnum.PLAN_SUPPLY)`、`getTableNames(SupplyCategoryEnum.NON_PLAN_SUPPLY)`、`getTableNames(SupplyCategoryEnum.ALL)` | 三个方法返回的表名列表中均包含 `sds_supply_universal` |

关键验证场景提示（供测试经理参考）：
- 在 `sds_supply_universal` 插入 `order_flag='NO'` 数据，以「计划供应」分类查询，验证通用表数据正确出现
- 在 `sds_supply_universal` 插入 `order_flag='YES'` 数据，以「非计划供应」分类查询，验证通用表数据正确出现
- 以「全部」分类查询，验证通用表数据与现有 5 类供应数据均正确出现
- 验证改造后现有 5 类供应数据的查询结果与改造前完全一致（回归）
- `sds_supply_universal` 为空表时，三种分类查询结果与改造前一致（回归）

---

## 4.2 **表格列元数据接口**

### 4.2.1 模块描述

本模块对 `/supplySummary/page` 接口的响应结构进行改造，在响应中增加 `columns` 字段（列定义列表），使前端能够根据服务端下发的列元数据正确渲染表格：维度列按用户选择顺序排列在左侧，时间列紧随其后。

当前问题根因是接口协议设计缺陷（未包含列元数据），本模块从接口层解决，不修改 DAO 查询逻辑。

### 4.2.2 输入

以下输入来自现有 `page()` 方法，本次新增对其的利用：

| 输入 | 来源 | 本次变化 |
|------|------|----------|
| `groupByParam` | 前端请求参数，逗号分隔的维度字段名（下划线格式，如 `item_code,stock_point_code`） | 原仅用于 GROUP BY；本次额外用于生成 `columns` 中的维度列定义 |
| 时段列表 | MDS feign 接口返回（`periodStart`、`periodEnd` 等字段） | 原仅用于时段归档；本次额外用于生成 `columns` 中的时间列定义 |
| 字段名→中文名映射 | `initDimensionList()` 中已有的硬编码映射（如 `item_code` → `物品代码`） | 本次复用，用于填充维度列的 `label` |

**新增 VO 类**：

```java
// 新建 ColumnDefinition.java（建议放在 scp-sds-api 的 supplySummary VO 包下）
public class ColumnDefinition {
    private String key;    // 对应 VO 字段名（维度列）或 supplyQuantityMap 的 key（时间列）
    private String label;  // 前端表头展示文案
    private String type;   // 列类型：DIMENSION（维度列）或 TIME（时间列）
    private Integer order; // 渲染顺序，前端按此字段升序排列
}
```

**新增响应包装类调整**：

在 Controller 响应的 `data` 对象中，新增 `columns` 字段（`List<ColumnDefinition>`），与 `list`、`total` 并列。建议新增一个 `SupplySummaryPageResult` 包装类（若现有包装类不便扩展），包含 `columns`、`list`、`total` 三个字段。

### 4.2.3 输出

`/supplySummary/page` 接口响应结构变更：

**改造前**：
```json
{
  "code": "SUCCESS",
  "data": {
    "list": [ { "itemCode": "A001", "stockPointCode": "WH01", "supplyQuantityMap": {"2026-01-01": 100, "2026-02-01": 200} } ],
    "total": 1
  }
}
```

**改造后**：
```json
{
  "code": "SUCCESS",
  "data": {
    "columns": [
      { "key": "itemCode",       "label": "物品代码",   "type": "DIMENSION", "order": 0 },
      { "key": "stockPointCode", "label": "库存点代码", "type": "DIMENSION", "order": 1 },
      { "key": "2026-01-01",    "label": "2026-01-01", "type": "TIME",      "order": 2 },
      { "key": "2026-02-01",    "label": "2026-02-01", "type": "TIME",      "order": 3 }
    ],
    "list": [ { "itemCode": "A001", "stockPointCode": "WH01", "supplyQuantityMap": {"2026-01-01": 100, "2026-02-01": 200} } ],
    "total": 1
  }
}
```

`columns` 字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | String | 维度列时：VO 字段名（camelCase，如 `itemCode`）；时间列时：`supplyQuantityMap` 中的 key（`periodStart` 字符串，如 `2026-01-01`） |
| `label` | String | 维度列时：中文列头（如「物品代码」）；时间列时：同 key（`periodStart` 字符串） |
| `type` | String | `DIMENSION` 或 `TIME` |
| `order` | Integer | 渲染顺序，从 0 开始，维度列在前，时间列在后，前端按升序渲染 |

### 4.2.4 业务流程

在 `SupplySummaryServiceImpl.page()` 现有流程末尾，返回数据前增加以下步骤：

```
【新增步骤 ⑧ — 组装 columns】
  ①~⑦（原有逻辑，不变）
  ↓
  ⑧ 组装 columns 列表：
     a) 解析 groupByParam → 按逗号拆分 → 逐字段查 initDimensionList() 映射表 → 生成维度列 ColumnDefinition（type=DIMENSION，order 从 0 递增）
     b) 遍历 MDS feign 返回的时段列表 → 按时段顺序生成时间列 ColumnDefinition（type=TIME，key=label=periodStart，order 紧接维度列序号继续递增）
  ↓
  ⑨ 将 columns 与 list、total 封装为 SupplySummaryPageResult 返回
```

### 4.2.5 业务规则

**规则 4.2.5.1 — 维度列生成规则**

- `groupByParam` 按英文逗号（`,`）拆分，得到有序字段名列表（下划线格式，如 `["item_code", "stock_point_code"]`）
- 逐字段在 `initDimensionList()` 的字段名→中文名映射表中查找对应 `label`：
  - 若找到：`key` = camelCase 字段名（如 `itemCode`），`label` = 中文名（如「物品代码」），`type` = `DIMENSION`，`order` = 当前序号（从 0 开始）
  - 若未找到（字段名不在映射表中）：视为白名单校验未拦截的漏网字段，`label` = 原始字段名，`type` = `DIMENSION`，`order` = 当前序号；同时记录 warn 日志
- 字段名下划线→camelCase 转换规则：`item_code` → `itemCode`（标准 Java camelCase 规则）

**规则 4.2.5.2 — 时间列生成规则**

- 时段列表来源：`page()` 方法中已通过 MDS feign 获取的时段列表，字段使用 `periodStart`（字符串格式，如 `2026-01-01`）
- 按时段列表顺序（MDS 返回的自然顺序）生成时间列：`key` = `label` = `periodStart` 字符串，`type` = `TIME`，`order` = 维度列数量 + 当前时段索引（从 0 开始）
- 若时段列表为空（MDS 返回空），则 `columns` 中不包含 `TIME` 类型列（仅含维度列）

**规则 4.2.5.3 — groupByParam 为空时的处理**

- 当 `groupByParam` 为空时，`page()` 现有逻辑已将其替换为 `dimensionDropdown()` 返回的全部维度（现有逻辑，不变）
- `columns` 中的维度列生成，使用替换后的完整维度列表，而非原始空字符串

**规则 4.2.5.4 — 接口向后兼容**

- `list` 和 `total` 字段保持不变，现有前端调用方不受影响
- `columns` 为新增字段，若前端未升级感知此字段，忽略即可（响应结构兼容）
- 前端升级后：按 `columns` 中的 `order` 字段升序渲染表格列；`type=DIMENSION` 的列渲染为普通文本列；`type=TIME` 的列使用 `supplyQuantityMap[key]` 取值

**规则 4.2.5.5 — columns 与 list 数据对应关系**

- `columns` 中每个 `DIMENSION` 类型列的 `key` 值（camelCase），对应 `list` 中每条 `SupplySummaryVO` 的同名字段
- `columns` 中每个 `TIME` 类型列的 `key` 值（`periodStart` 字符串），对应 `SupplySummaryVO.supplyQuantityMap` 中的同名 key

### 4.2.6 原型图

本子模块为后端接口改造，前端渲染逻辑调整属配合修改，无需新增产品原型图。前端改动说明：

- 表格渲染时，先请求 `/supplySummary/page`，从响应的 `columns` 字段获取列定义列表
- 按 `order` 字段升序排列后，依次渲染列头：`DIMENSION` 类型列在前（文本列），`TIME` 类型列在后（数值列，从 `supplyQuantityMap[key]` 取值）
- 切换聚合维度重新查询时，`columns` 随响应动态更新，前端需重新渲染列头（不缓存旧列定义）

### 4.2.7 用例

#### 正向用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U42-01 | 选择 2 个维度时 columns 顺序与选择顺序一致 | MDS 时段已配置，存在有效供应数据 | 以 `groupByParam=item_code,stock_point_code` 调用 `/supplySummary/page` | 响应 `columns[0]` 为 `{key:"itemCode", label:"物品代码", type:"DIMENSION", order:0}`，`columns[1]` 为 `{key:"stockPointCode", label:"库存点代码", type:"DIMENSION", order:1}` |
| SDS-U42-02 | 维度列排在时间列之前 | 同 SDS-U42-01，MDS 返回 3 个时段（2026-04-01、2026-05-01、2026-06-01） | 以 `groupByParam=item_code,stock_point_code` 调用 `/supplySummary/page` | `columns` 中前 2 项 `type=DIMENSION`，后 3 项 `type=TIME`；`order` 值为 0、1、2、3、4，连续递增无跳号 |
| SDS-U42-03 | 时间列 key 与 label 均等于 periodStart 字符串 | MDS 返回时段 `periodStart='2026-04-01'` | 调用 `/supplySummary/page` | `columns` 中时间列 `key='2026-04-01'`、`label='2026-04-01'`、`type='TIME'` |
| SDS-U42-04 | 切换维度组合后 columns 随之变化 | 存在有效数据 | 先以 `groupByParam=item_code` 查询，再以 `groupByParam=item_code,product_series_code` 查询 | 第一次返回 1 个维度列；第二次返回 2 个维度列，新增 `{key:"productSeriesCode", label:"产品系列代码", type:"DIMENSION", order:1}`；时间列 `order` 随维度列数量顺延 |
| SDS-U42-05 | groupByParam 为空时 columns 包含全部维度列 | `dimensionDropdown()` 返回 8 个维度字段；MDS 时段正常 | 以 `groupByParam=''`（或不传）调用 `/supplySummary/page` | `columns` 中 `DIMENSION` 类型列数量 = `dimensionDropdown()` 返回的维度数量，顺序与 `initDimensionList()` 中的顺序一致 |
| SDS-U42-06 | columns 中维度列 key 为 camelCase 格式 | 存在有效数据 | 以 `groupByParam=item_code,stock_point_code,product_series_code` 调用 `/supplySummary/page` | `columns` 中 3 个维度列的 `key` 分别为 `itemCode`、`stockPointCode`、`productSeriesCode`（无下划线） |
| SDS-U42-07 | columns 中 DIMENSION 的 key 与 list 中 VO 字段名对应 | 存在有效数据 | 调用 `/supplySummary/page`，取响应中 `columns` 的 `key` 字段 | 对于每个 `type=DIMENSION` 的列，`list[0]` 中存在与 `key` 同名的字段，且字段有值 |

#### 逆向 / 异常用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U42-08 | MDS 时段列表为空时 columns 只含维度列 | MDS feign 接口返回空时段列表 | 调用 `/supplySummary/page` | 响应 `columns` 中只含 `DIMENSION` 类型列，无 `TIME` 类型列；`list` 正常返回（可为空）；接口不报错 |
| SDS-U42-09 | groupByParam 含非映射表字段时 columns 中该列 label 降级为原始字段名并记录 warn 日志 | 白名单校验已通过（仅此用例场景，实际生产中此分支不应出现；用于验证 4.2.5.1 降级逻辑） | 手动绕过白名单，传入 `groupByParam=unknown_field` | `columns` 中出现 `{key:"unknownField", label:"unknown_field", type:"DIMENSION"}`；服务不崩溃；warn 日志中有 `未找到字段映射` 相关记录 |

#### 回归用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U42-10 | list 与 total 字段与改造前完全一致（回归） | 改造前已记录同参数下的 list 快照与 total 值 | 以相同参数调用改造后接口 | 响应中 `list` 内容、`total` 值与改造前快照完全一致；`columns` 为新增字段，不影响原有字段 |
| SDS-U42-11 | 前端不感知 columns 字段时不报错（向后兼容） | 存在未升级的前端调用方（只解析 list/total） | 前端以旧版方式解析响应（忽略 columns） | 前端正常渲染数据，不出现 JSON 解析报错；接口不返回 4xx/5xx |

关键验证场景提示（供测试经理参考）：
- 选择 2 个聚合维度（如「物品代码」+「库存点代码」），验证响应 `columns` 前两项为对应维度列、顺序与用户选择顺序一致
- 验证维度列在表格中排在所有时间列之前
- 切换不同维度组合，验证 `columns` 随之动态变化
- groupByParam 为空时（默认取全部维度），验证 `columns` 正确反映全部维度列
- 验证 `list` 数据与改造前完全一致（回归）

---

## 4.3 **输入校验与异常处理规范化**

### 4.3.1 模块描述

本模块对 `SupplySummaryServiceImpl` 进行安全加固与规范整改，解决以下问题：
1. `groupByParam` 直接字符串插值进 SQL 的 GROUP BY 子句，无白名单校验，导致 `BadSqlGrammarException` 携带 SQL 内容透传前端
2. 三处 `BusinessException` 违规（使用硬编码字符串文案，未走 `BusinessErrorEnum`）
3. 附带 Bug A：`dimensionDropdown()` 中 `orderFlag` 重复维度（`existFields.contains` camelCase vs 下划线格式不一致）
4. 附带 Bug B：`translate()` 中 `get(0)` 在空列表时越界崩溃

### 4.3.2 输入

**修改 BusinessErrorEnum**：新增 SDS 模块错误码 SDS001～SDS003（详见 4.3.5 业务规则）

**修改 i18n properties 文件**：
- `messages_zh_CN.properties`：新增 SDS001～SDS003 的中文文案
- `messages_en_US.properties`：新增 SDS001～SDS003 的英文文案

**修改 `SupplySummaryServiceImpl`**：涉及 `page()`、`dimensionDropdown()`、`translate()` 三个方法

**白名单来源**：`dimensionDropdown()` 返回的合法维度字段名列表（已有方法，本次新增白名单校验时复用其结果）

### 4.3.3 输出

- 当 `groupByParam` 包含非白名单字段时，前端收到清晰业务错误提示（SDS003），不再出现 `BadSqlGrammarException` 或 SQL 内容
- 当时段未配置时，前端收到 SDS001 业务提示（替换原有硬编码文案）
- 当供应类型参数非法时，前端收到 SDS002 业务提示（替换原有两处硬编码文案）
- `dimensionDropdown()` 接口不再出现重复的「订单标识」维度
- 当枚举 code 无匹配时，`translate()` 不再崩溃，降级返回原始 code 值，记录 warn 日志

### 4.3.4 业务流程

**groupByParam 白名单校验（新增，在进入 DAO 前执行）**：

```
page() 接收请求
  → groupByParam 非空时：按逗号拆分 → 取 dimensionDropdown() 合法字段集
  → 逐一校验每个字段名是否在合法集合中
  → 若存在不合法字段 → 抛出 BusinessException(SDS003) → 不进入 DAO
  → 全部合法 → 进入原有查询流程
```

**DB 异常捕获（新增，包裹 DAO 调用）**：

```
DAO 查询（汇总查询 + 明细查询）
  → 若抛出 BadSqlGrammarException 或其他 DataAccessException
  → catch → log.error（记录 SQL 异常完整堆栈，不透传）
  → 抛出 BusinessException(SDS003 或 SYS_UNKNOWN，视具体异常类型决定）
```

### 4.3.5 业务规则

**规则 4.3.5.1 — 新增 SDS 错误码**

在 `BusinessErrorEnum` 中新增以下枚举值（编码在现有 SDS 错误码基础上顺延，若 SDS 系列尚无已用编码则从 SDS001 开始；研发需确认当前最大已用编码后对齐）：

| 枚举名 | 建议 code | 中文文案（messages_zh_CN.properties） | 英文文案（messages_en_US.properties） |
|--------|-----------|--------------------------------------|--------------------------------------|
| `SDS_PERIOD_NOT_CONFIGURED` | `SDS001` | 尚未配置「时段」，请前往「时段设置」完成配置后重试。 | No period has been configured. Please go to "Period Settings" to complete the configuration and try again. |
| `SDS_SUPPLY_CATEGORY_INVALID` | `SDS002` | 「供应类型」参数不合法，请刷新页面后重新选择。 | The "Supply Category" parameter is invalid. Please refresh the page and reselect. |
| `SDS_GROUP_BY_PARAM_INVALID` | `SDS003` | 「聚合维度」包含不合法字段，请重新选择聚合维度后查询。 | The "Grouping Dimension" contains an invalid field. Please reselect the dimension and try again. |

`messages_zh_CN.properties` 新增 key-value：
```properties
SDS001=尚未配置「时段」，请前往「时段设置」完成配置后重试。
SDS002=「供应类型」参数不合法，请刷新页面后重新选择。
SDS003=「聚合维度」包含不合法字段，请重新选择聚合维度后查询。
```

`messages_en_US.properties` 新增 key-value：
```properties
SDS001=No period has been configured. Please go to "Period Settings" to complete the configuration and try again.
SDS002=The "Supply Category" parameter is invalid. Please refresh the page and reselect.
SDS003=The "Grouping Dimension" contains an invalid field. Please reselect the dimension and try again.
```

**规则 4.3.5.2 — 三处违规异常替换**

| 位置 | 原违规代码 | 修改为 |
|------|------------|--------|
| `page()` — 时段获取分支 | `throw new BusinessException("请先在时段设置维护时段")` | `throw new BusinessException(BusinessErrorEnum.SDS_PERIOD_NOT_CONFIGURED.getI18nErrordesc())` |
| `page()` — 供应类型校验（第1处） | `throw new BusinessException("供应类型错误")` | `throw new BusinessException(BusinessErrorEnum.SDS_SUPPLY_CATEGORY_INVALID.getI18nErrordesc())` |
| `page()` — 供应类型校验（第2处） | `throw new BusinessException("供应类型错误")` | `throw new BusinessException(BusinessErrorEnum.SDS_SUPPLY_CATEGORY_INVALID.getI18nErrordesc())` |

**规则 4.3.5.3 — groupByParam 白名单校验实现要点**

```java
// 伪代码（研发可据此实现）
List<String> allowedFields = getAllowedFieldNames(); // 返回 dimensionDropdown() 中合法字段的下划线格式名称集合
if (StringUtils.isNotBlank(groupByParam)) {
    List<String> requestedFields = Arrays.asList(groupByParam.split(","));
    if (!new HashSet<>(allowedFields).containsAll(requestedFields)) {
        throw new BusinessException(BusinessErrorEnum.SDS_GROUP_BY_PARAM_INVALID.getI18nErrordesc());
    }
}
```

- `getAllowedFieldNames()` 应返回 `initDimensionList()` 中 8 个固定维度的字段名（下划线格式）+ `information_schema` 动态查询出的公共字段名，与 `dimensionDropdown()` 的来源一致
- 校验逻辑在 DAO 查询之前执行，校验不通过则直接抛出业务异常，不进入 DAO 层

**规则 4.3.5.4 — DB 异常捕获防止 SQL 外泄**

在 `page()` 中，对 DAO 汇总查询和明细查询的调用处，使用 try-catch 捕获 `BadSqlGrammarException`（及其父类 `DataAccessException`）：

```java
// 伪代码
try {
    List<SupplySummaryVO> summaryList = dao.selectXxx(...);
    List<SupplySummaryVO> detailList  = dao.selectXxxDetails(...);
} catch (BadSqlGrammarException e) {
    log.error("供应汇总查询 SQL 异常，supplyVersionId={}, groupByParam={}", supplyVersionId, groupByParam, e);
    throw new BusinessException(BusinessErrorEnum.SDS_GROUP_BY_PARAM_INVALID.getI18nErrordesc());
} catch (DataAccessException e) {
    log.error("供应汇总查询数据库异常，supplyVersionId={}", supplyVersionId, e);
    throw new BusinessException(BusinessErrorEnum.SYS_UNKNOWN.getI18nErrordesc());
}
```

- 白名单校验（4.3.5.3）是主防线，DB 异常捕获是深度防御
- `log.error` 中记录完整异常堆栈，不向上冒泡，不透传给前端
- `e.getMessage()` 等技术信息仅写日志，禁止出现在 `BusinessException` 的构造参数中

**规则 4.3.5.5 — Bug A 修复：dimensionDropdown 中 orderFlag 重复维度**

修改 `dimensionDropdown()` 中的判断条件：

```java
// 修复前（永远为 false，导致 orderFlag 始终追加）
if (existFields.contains("orderFlag")) { ... }

// 修复后（与 existFields 实际存储格式一致）
if (existFields.contains("order_flag")) { ... }
```

修复效果：当 `information_schema` 查询结果中已包含 `order_flag` 字段（即所有供应表均含此字段时），「订单标识」维度不再重复追加；若不包含，则正常追加一次。

**规则 4.3.5.6 — Bug B 修复：translate() 中 IndexOutOfBoundsException**

在 `translate()` 中，调用 `get(0)` 前增加空列表判断：

```java
// 修复前
return targetCommonEnums.get(0).getLabel();

// 修复后
if (targetCommonEnums.isEmpty()) {
    log.warn("translate() 未找到匹配的枚举值，fieldName={}, code={}", fieldName, fieldValue);
    return fieldValue; // fallback：直接返回原始 code，不崩溃
}
return targetCommonEnums.get(0).getLabel();
```

降级策略：当枚举 code 无匹配项时，`translate()` 返回原始 code 值（而非崩溃），记录 warn 日志便于排查。此降级行为对正常数据无影响（正常数据的枚举 code 均有匹配项）。

**规则 4.3.5.7 — 改动文件清单**

| 文件/类 | 改动内容 |
|---------|----------|
| `BusinessErrorEnum` | 新增 `SDS_PERIOD_NOT_CONFIGURED`、`SDS_SUPPLY_CATEGORY_INVALID`、`SDS_GROUP_BY_PARAM_INVALID` 三个枚举值 |
| `messages_zh_CN.properties` | 新增 SDS001～SDS003 中文文案 |
| `messages_en_US.properties` | 新增 SDS001～SDS003 英文文案 |
| `SupplySummaryServiceImpl.page()` | ① 增加 groupByParam 白名单校验（抛 SDS_GROUP_BY_PARAM_INVALID）；② DAO 调用处增加 try-catch 防 SQL 外泄；③ 3 处违规 throw 替换为 BusinessErrorEnum |
| `SupplySummaryServiceImpl.dimensionDropdown()` | `existFields.contains("orderFlag")` → `existFields.contains("order_flag")` |
| `SupplySummaryServiceImpl.translate()` | `get(0)` 前增加 `isEmpty()` 判断，加 `log.warn`，fallback 返回原始 code |

### 4.3.6 原型图

本子模块为纯后端改造（安全加固 + 规范整改），不涉及前端页面新增或变更。

前端感知到的变化：
- 原来在「聚合维度为空」时弹出的包含 SQL 堆栈的错误弹窗，改为弹出清晰业务提示「『聚合维度』包含不合法字段，请重新选择聚合维度后查询」
- 原来「时段未配置」的错误提示文案升级（无界面结构变化）
- 维度下拉列表中「订单标识」不再重复出现

### 4.3.7 用例

#### 正向用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-01 | 合法 groupByParam 正常查询不被白名单拦截 | `groupByParam` 中所有字段均在 `dimensionDropdown()` 合法字段集内 | 以 `groupByParam=item_code,stock_point_code` 调用 `/supplySummary/page` | 查询正常执行，返回有效数据，无 SDS003 错误 |
| SDS-U43-02 | 维度下拉列表「订单标识」仅出现一次（Bug A 修复） | `information_schema` 查询结果中 `order_flag` 字段已存在于供应表字段集 | 调用 `/supplySummary/dimensionDropdown` | 响应列表中「订单标识」（对应字段 `order_flag`）只出现 1 次，不重复 |
| SDS-U43-03 | 有效枚举 code 的 translate() 正常返回 label（Bug B 正向） | 数据库中存在枚举 code 在 `SupplyTypeEnum` 中有对应值的记录 | 调用 `/supplySummary/page`，列表中存在枚举类型字段 | 枚举字段显示对应中文 label（如「采购订单」），不显示 code，服务不崩溃 |
| SDS-U43-04 | SDS001 文案符合规范（时段缺失场景） | 时段配置缺失 | 触发时段配置缺失场景（如清空 MDS 时段配置），调用 `/supplySummary/page` | 前端弹窗显示「尚未配置『时段』，请前往『时段设置』完成配置后重试。」；无任何技术堆栈信息；HTTP 状态码 200，业务 code 为错误码 |
| SDS-U43-05 | SDS002 文案符合规范（非法供应类型） | 接口层可手动传参 | 通过 Postman 传入 `supplyCategory=INVALID_TYPE` 调用 `/supplySummary/page` | 前端收到「『供应类型』参数不合法，请刷新页面后重新选择。」；无技术堆栈 |
| SDS-U43-06 | SDS003 文案符合规范（groupByParam 含非法字段） | 接口层可手动传参 | 通过 Postman 传入 `groupByParam=item_code,1_illegal_field` 调用 `/supplySummary/page` | 前端收到「『聚合维度』包含不合法字段，请重新选择聚合维度后查询。」；无 SQL 片段、无 `BadSqlGrammarException` 信息 |

#### 逆向 / 异常用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-07 | groupByParam 包含 SQL 注入字符串时被白名单拦截 | 服务正常运行 | 通过 Postman 传入 `groupByParam=1;DROP TABLE sds_supply_universal` 调用 `/supplySummary/page` | 返回 SDS003 业务提示；SQL 未执行；服务日志有白名单拦截记录；响应体中不包含任何 SQL 内容 |
| SDS-U43-08 | groupByParam 包含空格注入时被白名单拦截 | 服务正常运行 | 通过 Postman 传入 `groupByParam=item_code, admin--` 调用 `/supplySummary/page` | 返回 SDS003 业务提示；日志中记录拦截，但无 SQL 内容泄露 |
| SDS-U43-09 | DB 异常（非白名单漏网）被捕获后不透传 SQL 信息 | 白名单已绕过（模拟极端场景），DAO 层产生 DataAccessException | Mock DAO 抛出 DataAccessException | 前端返回业务友好提示（SDS003 或 SYS_UNKNOWN）；`log.error` 中有完整堆栈；响应体无任何 SQL 内容 |
| SDS-U43-10 | translate() 枚举 code 无匹配时不崩溃（Bug B 边界修复） | 数据库中存在 `supply_type='UNKNOWN_ENUM_CODE'`、且该值不在 `SupplyTypeEnum` 中的记录 | 调用 `/supplySummary/page`，列表中包含上述记录 | 该行数据正常返回，枚举字段显示原始 code 值 `UNKNOWN_ENUM_CODE`（降级）；服务不抛出 `IndexOutOfBoundsException`；`warn` 日志中有 `translate() 未找到匹配的枚举值` 相关记录 |
| SDS-U43-11 | groupByParam 为空字符串（`""`）不触发 SDS003 | `page()` 中空字符串走「取全部维度」分支，不走白名单校验 | 以 `groupByParam=''` 调用 `/supplySummary/page` | 不返回 SDS003 错误；查询正常执行，使用全量维度分组 |
| SDS-U43-12 | 同时传入非法 supplyCategory 和合法 groupByParam，优先返回 SDS002 | 服务正常运行 | `supplyCategory=BAD`、`groupByParam=item_code` | 返回 SDS002（供应类型校验在前），不返回 SDS003 |

#### 安全与非功能用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-13 | 安全验证：响应体中不含任何 SQL 内容 | 服务正常运行 | 通过 Postman 发送任意非法 groupByParam（包括 SQL 注入字符串、特殊符号等），调用 `/supplySummary/page` | 响应 body 中任何字段均不包含 SQL 关键词（SELECT、WHERE、FROM、DROP、TABLE 等） |
| SDS-U43-14 | 安全验证：日志中有完整 SQL 异常堆栈（用于排查） | 已配置日志级别 ERROR 输出 | 触发 DB 异常捕获分支 | 日志文件中有包含完整堆栈的 `log.error` 记录，可追溯根因 |
| SDS-U43-15 | i18n 英文环境下 SDS001～SDS003 返回英文文案 | 请求 header 中 `Accept-Language: en-US` | 分别触发 SDS001、SDS002、SDS003 三个错误 | 返回对应英文文案（见 4.3.5.1 规则），无中文混杂 |

#### 回归用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-16 | 正常查询（合法参数）功能不受白名单改动影响（回归） | 存在有效供应数据；时段已配置 | 以常规合法参数（`supplyCategory=PLAN`、合法 `groupByParam`）调用 `/supplySummary/page` | 查询结果与改造前一致；响应时间无明显劣化（白名单校验新增耗时 < 10ms） |
| SDS-U43-17 | 维度下拉接口整体功能不受 Bug A 修复影响（回归） | 存在有效维度配置 | 调用 `/supplySummary/dimensionDropdown` | 返回的维度列表包含全部合法维度字段，无字段缺失，「订单标识」不重复 |
| SDS-U43-18 | 原有 BusinessException 触发路径（时段缺失、供应类型错误）正常触发（回归） | 分别制造「时段缺失」和「非法供应类型」场景 | 分别触发两个场景 | 均正常抛出对应 BusinessException，返回 SDS001/SDS002，无功能回退 |

关键验证场景提示（供测试经理参考）：
- **SDS001 触发**：人工制造时段配置缺失场景，查询汇总表，验证前端弹窗显示「尚未配置『时段』……」，无任何技术堆栈信息
- **SDS002 触发**：通过接口层传入非法 `supplyCategory` 值（如 `INVALID_TYPE`），验证返回清晰业务提示
- **SDS003 触发（空维度）**：`groupByParam` 为空字符串时提交查询，验证前端显示 SDS003 提示（不出现 `BadSqlGrammarException` 或 SQL 片段）
- **SDS003 触发（非法字段）**：`groupByParam` 包含白名单外的字段（如 `1;DROP TABLE xxx`）时提交查询，验证接口返回 SDS003 提示，SQL 未执行
- **Bug A 验证**：打开聚合维度下拉列表，确认「订单标识」只出现一次（不重复）
- **Bug B 验证**：构造一条枚举 code 不存在于枚举列表中的测试数据，发起查询，确认该行数据正常返回（不崩溃），枚举字段显示原始 code 值
- **安全验证**：Postman 发送注入字符串，验证接口返回 SDS003，日志中有完整堆栈但响应体中无任何 SQL 内容

---

# 5. **未来扩展说明**

## 5.1 通用大表方案的进一步演化

本次改造将 `sds_supply_universal` 以固定 UNION ALL 分支接入查询，是一次性改造的最小可行方案。未来可在以下方向进一步演化：

**供应类型配置化**：当 `sds_supply_universal` 中积累了多种 `supply_type` 后，可将 `SupplyTypeEnum` 从硬编码枚举升级为可配置的供应类型元数据表（`sds_supply_type_config`），新增供应类型时通过配置页维护，无需发版。

**前端供应子类型下拉适配**：目前前端供应分类下拉仅支持「计划供应/非计划供应/全部」三个选项（`SupplyCategoryEnum`），不区分通用表内的子类型。若业务上需要对通用表内的具体供应子类型（如特定项目的定制供应）进行单独筛选，可在前端供应类型下拉中动态加载 `sds_supply_universal` 中出现的 `supply_type` 值，作为可选筛选项。

**DAO SQL 视图化**：长期来看，多段 UNION ALL SQL 仍有维护复杂度。可考虑将 `sds_supply_universal` 整合为数据库视图（`v_supply_all`），所有供应来源均通过视图统一查询，DAO XML 中的 UNION ALL 逻辑由视图承接，应用层 SQL 大幅简化。

## 5.2 列元数据接口的扩展方向

本次 `columns` 只包含 `key`、`label`、`type`、`order` 四个字段，满足基础渲染需求。未来可扩展：

- **`width`**：列宽建议值，由服务端下发，前端作为初始渲染宽度（用户可手动调整）
- **`sortable`**：是否支持点击列头排序（维度列通常可排序，时间列通常不排序）
- **`frozen`**：是否固定列（前几列维度列通常需要固定，时段列横向滚动）

## 5.3 输入校验的后续加固

本次对 `groupByParam` 做了白名单校验，对 `queryCriteriaParam` 仅在文档中提及建议校验，未在本期实现。后续可对 `queryCriteriaParam` 的 WHERE 条件参数同样引入白名单或格式校验，进一步降低 SQL 注入风险，作为安全加固的后续迭代。
