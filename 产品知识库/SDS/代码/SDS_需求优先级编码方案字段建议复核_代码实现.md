# SDS_需求优先级编码方案字段建议复核_代码实现.md

- **更新时间**：2026-03-24
- **本次调研范围**：SDS 需求优先级编码方案（加权求和）评分组弹窗；重点覆盖 `PriorityFactorConfigServiceImpl`、`FactorSourceTableEnum`、`FactorSourceTableProvider` 及其实现类、`PriorityCalculatorAssembledDomainServiceImpl`、前端 `priorityScoringRuleConfigurationDialog.vue`，并结合测试库 `scp_mps` / `scp_mds` 的相关表与视图复核。**产品已拍板的参与计算因子白名单见本文 §5（执行以 §5 为准）。**
- **代码来源**：`C:\Users\OZH\Desktop\UHA\scp-foundation`

---

## 4.1 现状概述

当前「优先级评分规则配置」弹窗的真实能力边界由后端下拉接口决定，而不是前端静态控制：

- **来源表下拉** 仅来自 `FactorSourceTableEnum`，当前只有 `PRODUCT_STOCK_POINT`、`DEMAND_SUMMARY`、`CUSTOMER` 三类。
- **关联字段下拉** 由需求 VO 的 `*Id` 字段与来源 VO 允许关联字段求交后得到，本质上仍是 **ID 关联模型**。
- **参与计算因子下拉** 在 `PriorityFactorConfigServiceImpl.getSourceTableFieldsDropdown()` 中被硬编码限制为 `id` 和所有 `*Id` 字段；`DEMAND_SUMMARY` 额外被特判为只返回 `demandType`。
- 运行时评分组计算器 `PriorityCalculatorAssembledDomainServiceImpl` 会把来源表记录预加载为 `Map<String,Object>`，但当前预加载逻辑只依赖 **第一个关联字段**，且 `PRODUCT_STOCK_POINT` Provider 的 key 设计与组装逻辑存在不一致。
- 测试库证据显示：很多业务可读字段确实已存在于 **MDS 视图层 / 需求视图层**，但并不等于当前 SDS 评分组链路已经可直接暴露或可安全计算。

结论：原问题分析报告 §3.3 的总体方向是对的，但对「字段是否真实可取到」与「只是数据库上存在」区分不够清楚，尤其是 `PRODUCT_STOCK_POINT` 与 `DEMAND_SUMMARY` 两部分需要收紧表述。

---

## 4.2 代码实现复核

### 4.2.1 关键入口与职责

| 位置 | 作用 | 关键结论 |
|------|------|----------|
| `scp-sds-sdk/src/main/java/com/yhl/scp/dps/priority/controller/PriorityFactorConfigController.java` | 暴露 `sourceTableEnumDropdown`、`relatedFieldsDropdown`、`sourceTableFieldsDropdown` | 前端弹窗完全依赖这 3 个接口 |
| `scp-sds-sdk/src/main/java/com/yhl/scp/dps/priority/service/impl/PriorityFactorConfigServiceImpl.java` | 下拉生成、评分组创建/回显 | `sourceTableFieldsDropdown` 只放开 `id`/`*Id`；`DEMAND_SUMMARY` 固定仅 `demandType` |
| `scp-sds-sdk/src/main/java/com/yhl/scp/dps/basic/priority/enums/FactorSourceTableEnum.java` | 来源枚举 | 当前仅 3 个来源，销售部门尚未接入 |
| `scp-sds-sdk/src/main/java/com/yhl/scp/dps/priority/strategy/FactorSourceTableProvider.java` | 来源扩展接口 | 具备新增来源的扩展点，但未定义字段白名单能力 |
| `scp-sds-sdk/src/main/java/com/yhl/scp/dps/priority/strategy/impl/*.java` | 各来源 Provider | CUSTOMER/PSP/DEMAND_SUMMARY 三个实现已存在 |
| `scp-sds-sdk/src/main/java/com/yhl/scp/dps/priority/domain/service/impl/PriorityCalculatorAssembledDomainServiceImpl.java` | 评分组计算器组装与来源数据预加载 | 只读取第一个关联字段；对多键和 PSP 复合键支持不完整 |
| `scp-front/scp-sds-front/src/views/demandPriorityCodingScheme/priorityFactorConfiguration/priorityScoringRuleConfigurationDialog.vue` | 前端弹窗 | 前端只是展示接口结果，不会额外放开业务字段 |

### 4.2.2 下拉能力的真实限制

#### A. 来源表下拉

`getSourceTableEnumDropdown()` 直接遍历 `FactorSourceTableEnum.values()`，因此：

- 不在枚举里的来源，前端不可能出现。
- 目前**没有销售部门 / 销售片区 / 销售组织**来源。
- 新增来源至少要补：枚举 + Provider + 运行时预加载兼容性验证。

#### B. 关联字段下拉

`getRelatedFieldsDropdown()` 的规则是：

- 只看需求 VO 中 **以 `Id` 结尾** 的字段；
- 若 Provider 显式声明 `getDemandRelatedFieldNames()`，则直接使用；
- 否则按来源 VO 的 `*Id` 字段与需求 VO 的 `*Id` 字段交集来算；
- 多需求类型时先求需求类型之间公共 `*Id` 字段，再与来源允许字段求交。

这意味着产品建议里必须区分：

1. **可作为展示因子字段**；
2. **可作为关联字段的 ID 字段**。

两者不是一回事。

#### C. 参与计算因子下拉

`getSourceTableFieldsDropdown()` 当前规则：

- `DEMAND_SUMMARY`：固定返回 `demandType`；
- 其余来源：仅返回 `id` 或 `*Id` 字段；
- 没有 `@FieldInterpretation` 中文注解的 `*Id` 字段会被过滤掉；
- 非 `id`/`*Id` 的业务字段，即使 VO 或视图中存在，也不会进入当前下拉。

因此，§3.3 若要给开发「可直接照着改」的建议，必须分清：

- **当前真实可下拉字段**
- **代码改造后优先开放字段**
- **数据库有但当前链路拿不到或拿到了也不应优先开放的字段**

### 4.2.3 运行时计算约束

`PriorityCalculatorAssembledDomainServiceImpl.loadSourceRecords()` 的关键限制：

- 非 `DEMAND_SUMMARY` 来源才会做来源表预加载；
- `relatedFields` 即使前端可多选，运行时也只取 **第一个关联字段**；
- `ProductStockBaseTableProvider.loadSourceRecords()` 用 `productIds` 调 MDS，但返回 `Map` 的 key 是 `productId_stockPointId`；
- 该 Provider 同时又声明 `getSourceTableKeyField()` 返回 `productId`，注释和实现不一致；
- 这说明 `PRODUCT_STOCK_POINT` 当前不仅字段下拉有限，**连按多维关联精确匹配的运行时语义也未完全收敛**。

结论：`PRODUCT_STOCK_POINT` 比 `CUSTOMER` 更不适合直接扩开放大范围业务字段；应先修正 Provider key 语义与匹配模型，再谈更多字段暴露。

---

## 4.3 数据库与视图证据

### 4.3.1 CUSTOMER 对应证据

- 表：`scp_mps.dps_ord_customer`
- 视图：`scp_mps.v_dps_ord_customer`

真实列包含：

- 主键 / 关联：`id`、`currency_unit_id`
- 业务可读：`customer_code`、`customer_name`
- 数值类：`priority`、`service_level`、`proportional_penalty`、`fixed_penalty`
- 联系类：`contact`、`telephone`
- 生命周期类：`effective_time`、`expiry_time`
- 视图补充：`currency_unit_code`、`currency_unit_desc`

### 4.3.2 PRODUCT_STOCK_POINT 对应证据

- 基础表：`scp_mps.mds_pro_product_stock_point_base`
- 聚合视图：`scp_mps.v_mds_pro_product_stock_point`
- MDS 服务查询入口：`MdsFeignController.getProductStockPointByParams()` → `productStockPointService.selectByParams(params)`

真实情况分三层：

1. **基础表真实存在**：`product_id`、`stock_point_id`、`participation_calculated`、`key_material`、`long_cycle_material`、`priority`、`low_level_code`、`product_series_id`、`product_type`、`allocation_type`、`replenishment_type`、`calculation_category`、`expand_ratio`、`expand_level` 等。
2. **视图真实存在**：额外带出 `product_code`、`product_name`、`stock_point_code`、`stock_point_name`、`product_series_code`、`product_series_desc`、以及大量 inventory/production/purchase/sales 侧字段。
3. **服务返回 VO 真实可取到**：`ProductStockPointServiceImpl.selectByParams()` 明确会回填 `productCode`、`productName`、`stockPointCode`、`stockPointName`，所以这几个字段不是“纯数据库猜测”，而是 **MDS 查询链路可实际返回**。

但 SDS 当前评分组下拉仍然取不到这些字段，原因是 `getSourceTableFieldsDropdown()` 只放 `id`/`*Id`。

### 4.3.3 销售部门来源证据

- 表：`scp_mps.mds_sal_sales_segment`
- 视图：`scp_mps.v_mds_sal_sales_segment`
- MDS Feign：`getSalesSegmentByParams()`、`getSalesSegmentsByIds()`
- 多处业务代码已有 `salesSegmentId` 使用证据，需求侧确实已有该维度。

真实字段：

- 主键 / 关联：`id`、`parent_id`、`sales_level_id`
- 业务可读：`sales_segment_code`、`sales_segment_name`、`short_name`
- 数值类：`allocation_ratio`
- 视图补充：`parent_sales_segment_code`、`parent_sales_segment_name`、`parent_short_name`、`sales_level_name`

### 4.3.4 DEMAND_SUMMARY 对应证据

- 基础表：`scp_mps.dps_for_demand_forecast`、`scp_mps.dps_ord_customer_order`
- 聚合视图：`scp_mps.v_dps_for_demand_forecast`、`scp_mps.v_dps_ord_customer_order`
- Provider VO：`DemandSummaryVO`（代码引用存在，但本仓库未找到源码文件）

数据库侧可看到很多业务字段：

- forecast 视图已含：`customerCode`、`customerName`、`productCode`、`productName`、`stockPointCode`、`stockPointName`、`salesSegmentCode`、`salesSegmentName`、`periodName`、`timePeriodGroup`、`productType`、`seriesCode`、`seriesName` 等对应 snake_case 列。
- customer order 视图也含：`customerCode`、`customerName`、`customerPriority`、`salesSegmentCode`、`salesSegmentName`、`productCode`、`productName`、`stockPointCode`、`stockPointName`、`productType`、`seriesCode`、`seriesName` 等。

但当前 SDS 评分组链路有两个关键缺口：

1. `PriorityFactorConfigServiceImpl` 对 `DEMAND_SUMMARY` **硬编码只返回 `demandType`**；
2. 本仓库中未找到 `DemandSummaryVO` 源码，无法直接核实 VO 字段与 getter 是否完整、命名是否与视图一致。

因此，这部分不能写成“已有完整字段建议”，最多只能写成“数据库/视图层存在若干潜在业务字段，但当前实现未开放，且 VO 定义待实代码确认”。

---

## 4.4 按来源复核 §3.3 字段建议

## 4.4.1 CUSTOMER

### 当前真实可用字段范围

- **当前下拉真实可见**：`id`（以及若 VO 上存在且带中文注解的 `*Id` 字段，但从表结构看核心业务字段并不以 `Id` 命名）。
- **代码/数据库已确认存在、但当前下拉拿不到**：
  - `customerCode`
  - `customerName`
  - `priority`
  - `serviceLevel`
  - `contact`
  - `telephone`
  - `proportionalPenalty`
  - `fixedPenalty`
  - `currencyUnitCode`
  - `currencyUnitDesc`

### 建议开放字段

- **P0**：`customerCode`、`customerName`
- **P1**：`priority`
- **P1（谨慎）**：`serviceLevel`

### 不建议开放或需谨慎开放

- `contact`、`telephone`：业务可读但与优先级判断弱相关，更像联系信息，不建议默认进入 P0。
- `proportionalPenalty`、`fixedPenalty`：虽有业务含义，但属于 **数值字段**，若开放必须先明确：
  - 是按精确值匹配，还是区间匹配；
  - 前端规则行输入框是否仍为纯文本；
  - `matchMode` 是否允许数值比较，而不只是字符串匹配。
- `effectiveTime`、`expiryTime`：时间字段，不适合当前纯文本规则行。
- `currencyUnitCode`、`currencyUnitDesc`：存在于视图，不是客户优先级主判断因子。

### 对原报告 §3.3 的修订建议

- `customerCode`、`customerName`、`priority` 可以保留。
- `contact`、`telephone` 不建议再列为常规 P1，最多可放“可选但默认不开放”。
- 应补充 `serviceLevel` 属于 **数值型业务字段**，不是简单字符串白名单问题。
- 应明确区分“字段存在”与“当前下拉可见”两层语义。

---

## 4.4.2 PRODUCT_STOCK_POINT

### 当前真实可用字段范围

#### A. 当前下拉真实可见（无需改代码即可看到）

- `id`
- `productId`
- `stockPointId`
- `productSeriesId`
- `countingUnitId`
- `currencyUnitId`
- `unitGroupId`
- 以及视图层带出的若干 `*Id` 字段：如 `inventoryId`、`otherId`、`productionId`、`purchaseId`、`salesId`

#### B. 代码和服务链路已证实能返回，但当前下拉拿不到

- `productCode`
- `productName`
- `stockPointCode`
- `stockPointName`
- `productType`
- `priority`
- `lowLevelCode`
- `expandRatio`
- `expandLevel`
- `productSeriesCode`
- `productSeriesDesc`
- `participationCalculated`
- `keyMaterial`
- `kitComputation`
- `replenishmentType`
- 以及大量库存/生产/采购/销售侧字段

#### C. 只是基础表可见，是否在当前 VO 上稳定暴露需谨慎的字段

- 基础表中的 `allocationType` / `calculationCategory` / `longCycleMaterial`
- 视图中的一些字段在命名上与基础表/DTO 存在差异：
  - `long_cycle_material` 在视图里表现为 `long_period_material`
  - `allocation_type` 在视图里表现为 `reservation_type`
  - `calculation_category` 在视图里表现为 `computation_class`

这说明原报告里直接按基础表 camelCase 给建议，容易让开发误以为 VO 字段名与表字段名一一对应，实际并不完全如此。

### 建议开放字段

- **P0**：`productCode`、`productName`、`stockPointCode`、`stockPointName`
- **P1**：`productType`、`productSeriesCode`、`productSeriesDesc`
- **P1（有条件）**：`priority`、`expandLevel`、`participationCalculated`、`keyMaterial`、`kitComputation`

### 不建议开放或需谨慎开放

- `id`、`inventoryId`、`otherId`、`productionId`、`purchaseId`、`salesId`：技术主键，业务不可读。
- `allocationType` / `replenishmentType` / `calculationCategory`：枚举型字段，开放前需要同步提供 **枚举值语义**，否则用户只能配 code。
- `expandRatio`：字符串/比例类字段，若仍按文本输入可用，但需确认是否允许模糊匹配。
- 大量库存/采购/生产参数，如批量、提前期、库存上下限、成本类字段：多为数值字段，不适合直接套现有规则输入模式。

### 对原报告 §3.3 的修订建议

- `productCode`、`productName`、`stockPointCode`、`stockPointName` 不应再写成“跨表推测”；应改成：
  - **基础表没有，但 MDS 聚合视图与 `selectByParams()` 返回 VO 已可取到**。
- `productType`、`priority`、`lowLevelCode`、`expandRatio`、`expandLevel` 可保留，但应注明：
  - 当前评分组下拉拿不到；
  - 部分字段在视图/VO 命名与基础表不同；
  - 运行时 Provider key 逻辑需先修正。
- 原报告缺少一层说明：`PRODUCT_STOCK_POINT` 当前 Provider 查询只传 `productIds`，而返回 key 却是 `productId_stockPointId`，运行时多键语义并未收敛，这会直接影响是否适合开放更多字段。

---

## 4.4.3 销售部门来源（建议新增）

### 当前真实可用字段范围

当前 SDS 评分组 **尚无此来源**；但 MDS 表、视图、Feign、业务侧 `salesSegmentId` 使用都已存在，具备接入基础。

### 建议开放字段

- **P0**：`salesSegmentCode`、`salesSegmentName`
- **P1**：`shortName`
- **P1（层级展示价值高于 allocationRatio）**：
  - `parentSalesSegmentCode`
  - `parentSalesSegmentName`
  - `salesLevelName`

### 不建议开放或需谨慎开放

- `allocationRatio`：原报告已提到，但它是 **decimal 数值字段**，优先级不应高于层级识别字段。
- `parentId`、`salesLevelId`：技术关联字段，不适合给业务直接配规则。
- `effectiveTime`、`expiryTime`：时间型字段，不适合当前规则模型。

### 对原报告 §3.3 的修订建议

- `salesSegmentCode`、`salesSegmentName`、`shortName` 可以保留。
- `allocationRatio` 不应作为最优先补充字段，应降级到“可选且需数值匹配能力”的后备项。
- 应新增强调：若面向业务可读性，`parentSalesSegmentName` / `salesLevelName` 比 `allocationRatio` 更适合作为后续扩展候选。

---

## 4.4.4 DEMAND_SUMMARY

### 当前真实可用字段范围

#### A. 当前下拉真实可见

- 仅 `demandType`

#### B. 数据库/视图层已存在、但当前实现不能直接据此下结论为“可开放”的字段

预测需求视图与客户订单视图中都能看到：

- `customerCode`、`customerName`
- `salesSegmentCode`、`salesSegmentName`
- `productCode`、`productName`
- `stockPointCode`、`stockPointName`
- `productType`
- `seriesCode`、`seriesName`
- 以及状态、时间、金额、数量类字段

但由于本仓库缺少 `DemandSummaryVO` 源码，且服务层被硬编码只返回 `demandType`，当前**不能**把这些字段直接写成“已可安全开放清单”。

### 建议开放字段

- **P0（当前唯一可直接确认）**：`demandType`
- **P1（待 VO 与运行时核对后再定）**：`customerCode`、`customerName`、`salesSegmentCode`、`salesSegmentName`、`productCode`、`productName`、`stockPointCode`、`stockPointName`

### 不建议当前报告直接定版开放

- 所有除 `demandType` 外的字段都应暂列为“候选字段，待 `DemandSummaryVO` 与 Union 结果一致性确认”。
- 数量、金额、成本、状态链等字段不适合直接进入当前文本匹配规则。

### 对原报告 §3.3 的修订建议

- 不能只写“若需要可另开清单”，这对开发不够明确。
- 更准确的写法应是：
  - **当前实现只支持 `demandType`；**
  - **数据库/视图层存在更多业务字段候选，但由于 `DemandSummaryVO` 定义未在当前仓库可见，且接口硬编码未开放，当前不支持给出完整、可直接开发落地的字段白名单。**

---

## 4.5 字段类型与匹配方式约束

原报告 §3.3 最大缺口之一，是没有把“字段类型 / 匹配方式”作为产品建议前置条件写清楚。

### 4.5.1 当前规则模型的真实约束

前端规则行：

- 因子值输入框是普通文本框；
- 每条规则只选一个 `matchMode`；
- 分数是数值；
- 后端保存时把多个因子值拼接成逗号字符串存表。

这意味着当前模型天然更适合：

- **字符串类字段**：代码、名称、枚举 code；
- 不适合直接处理：
  - 数值比较（大于、小于、区间）
  - 日期区间
  - 布尔/枚举值的人类可读翻译不一致场景

### 4.5.2 对产品建议有影响的字段分类

| 字段类型 | 典型字段 | 当前建议 |
|----------|----------|----------|
| 字符串业务键 | `customerCode`、`productCode`、`salesSegmentCode` | 最适合优先开放 |
| 字符串名称 | `customerName`、`productName`、`salesSegmentName` | 可开放，但需明确精确/模糊匹配语义 |
| 枚举码字段 | `productType`、`replenishmentType`、`demandType` | 可开放，但必须补充枚举值说明或前端翻译 |
| 数值字段 | `priority`、`serviceLevel`、`allocationRatio`、罚金/成本字段 | 需新增数值匹配能力后再扩大开放 |
| 布尔标志字段 | `participationCalculated`、`keyMaterial`、`kitComputation` | 可作为 P1，但应先定义取值集合（如 YES/NO）与展示文案 |
| 时间字段 | `effectiveTime`、`expiryTime` | 当前不建议开放 |
| 技术 ID 字段 | `id`、`*Id` | 仅保留给兼容场景，不是业务可读字段 |

### 4.5.3 必须补充到问题分析报告的约束说明

建议在修订 §3.3 时显式加入以下说明：

1. **字段白名单不能只看是否在表里存在，还要看字段类型是否适配当前规则模型。**
2. **枚举型字段开放前，要同步提供枚举值翻译。**
3. **数值型字段开放前，要先确定是否支持区间比较/大小比较，否则仅精确字符串匹配价值有限。**
4. **布尔标志字段开放前，要统一 YES/NO 等存储值与前端展示值。**
5. **多关联字段虽然前端支持多选，但运行时目前只取第一个关联字段，因此多键来源建议需谨慎。**

---

## 4.6 对原问题分析报告 §3.3 的结论摘要

> **与 §5 的关系**：自 2026-03-24 起，**参与计算因子以 §5 产品白名单为最终依据**；本节保留的历史复核结论若与 §5 冲突，以 §5 为准。

### 可以保留的点

- CUSTOMER 应优先补业务可读字段，而不是继续只给 ID。
- 需要新增销售部门来源这一方向成立。
- `DEMAND_SUMMARY` 当前只有 `demandType` 被正式开放，这个判断成立。
- `PRODUCT_STOCK_POINT` 需要优先补物品/库存点代码名称类字段，这个方向成立。

### 需要修改的点

1. **CUSTOMER**
   - `contact`、`telephone` 不宜继续作为常规 P1 推荐。
   - 应补充 `serviceLevel` 属于数值型字段，需要匹配规则说明。

2. **PRODUCT_STOCK_POINT**
   - `productCode` / `productName` / `stockPointCode` / `stockPointName` 不能再写成“纯跨表推测”，应改成“基础表无，但 MDS 视图与 `selectByParams()` 返回 VO 已能取到”。
   - 需补充 Provider key 与运行时匹配存在不一致，开放更多字段前应先校正。
   - 需提示部分字段命名在基础表、视图、DTO/VO 之间不完全一致。

3. **销售部门来源**
   - `allocationRatio` 不应排在 `parentSalesSegmentName`、`salesLevelName` 之前。
   - 应突出层级识别字段对业务更有价值。

4. **DEMAND_SUMMARY**
   - 不能模糊写“另开清单”；应明确写成：
     - 当前实现仅支持 `demandType`；
     - 其它候选字段虽然在视图层存在，但当前仓库下无法完成 VO 级别实锤，不足以形成完整开发白名单。

5. **整体方法论**
   - 必须新增“字段类型 / 匹配方式 / 枚举字段 / 数值字段 / 布尔标志字段”的约束说明，否则开发收到报告后仍容易误以为“字段存在即可放开”。

---

## 4.7 潜在改动影响

| 改动方向 | 影响点 | 说明 |
|----------|--------|------|
| 放开 CUSTOMER / PRODUCT_STOCK_POINT / 销售部门业务字段 | `PriorityFactorConfigServiceImpl.getSourceTableFieldsDropdown()` | 需要从仅 `id/*Id` 改成白名单 + 类型策略 |
| 新增销售部门来源 | `FactorSourceTableEnum`、新增 `FactorSourceTableProvider`、Spring 装配 | 需补齐来源下拉、关联字段、预加载逻辑 |
| 修正 PSP 运行时语义 | `ProductStockBaseTableProvider`、`PriorityCalculatorAssembledDomainServiceImpl.loadSourceRecords()` | 需明确 key 是 `productId` 还是 `productId_stockPointId`，以及 relatedFields 是否支持双键 |
| 放开枚举/布尔/数值字段 | 前端弹窗、规则保存格式、运行时匹配器 | 可能不只是下拉改造，还会涉及匹配模式扩展 |
| 放开 DEMAND_SUMMARY 更多字段 | `DemandSummaryVO`、`DemandSummaryTableProvider`、`getSourceTableFieldsDropdown()` | 需先补齐 VO 可见性与字段一致性确认 |

---

## 5. 产品决策：加权求和「参与计算因子」白名单（已拍板）

**状态**：产品已确认（2026-03-24），作为开发实现与测试验收依据。  
**命名**：下表 **VO 字段** 为惯用 **Java camelCase**；括号内为库表/视图 **snake_case**。若 VO 实际命名与下表不一致，**以对应 `*VO` 源码为准**并回写本文。

### 5.1 客户（来源：`CUSTOMER` / `dps_ord_customer`）

| VO 字段 | 库列（snake_case） |
|---------|-------------------|
| `customerCode` | `customer_code` |
| `customerName` | `customer_name` |

### 5.2 客户订单（需求类型：客户订单需求；典型 VO：`CustomerOrderVO`）

| VO 字段 | 库列（snake_case） |
|---------|-------------------|
| `orderNo` | `order_no` |
| `subOrderNo` | `sub_order_no` |
| `region` | `region` |
| `orderType` | `order_type` |
| `salesType` | `sales_type` |
| `demandStatus` | `demand_status` |
| `delayStatus` | `delay_status` |
| `planStatus` | `plan_status` |
| `fulfillmentStatus` | `fulfillment_status` |
| `creator` | `creator` |
| `modifier` | `modifier` |

### 5.3 预测订单（需求类型：预测需求；典型 VO：`DemandForecastVO`）

| VO 字段 | 库列（snake_case） |
|---------|-------------------|
| `salesType` | `sales_type` |
| `region` | `region` |
| `demandStatus` | `demand_status` |
| `delayStatus` | `delay_status` |
| `planStatus` | `plan_status` |
| `demandType` | `demand_type` |
| `fulfillmentStatus` | `fulfillment_status` |
| `creator` | `creator` |
| `modifier` | `modifier` |

### 5.4 库存点物品（来源：`PRODUCT_STOCK_POINT`；基础表 `mds_pro_product_stock_point_base`，常以视图 `v_mds_pro_product_stock_point` 取数）

| VO 字段（建议） | 基础表列 | 视图列别名（若与基础表不一致） |
|-----------------|----------|-------------------------------|
| `keyMaterial` | `key_material` | 同左 |
| `longCycleMaterial` 或 `longPeriodMaterial` | `long_cycle_material` | 视图中多为 **`long_period_material`**（与基础表命名不一致时以实现/VO 为准） |
| `productType` | `product_type` | 同左 |
| `allocationType` 或 `reservationType` | `allocation_type` | 视图中可能为 **`reservation_type`**（以实现/VO 为准） |
| `replenishmentType` | `replenishment_type` | 同左 |
| `calculationCategory` 或 `computationClass` | `calculation_category` | 视图中可能为 **`computation_class`**（以实现/VO 为准） |

### 5.5 物品（主数据：物品档案；典型表 `mds_pro_product_base` / 对应 VO）

| VO 字段 | 库列（snake_case） |
|---------|-------------------|
| `productCode` | `product_code` |
| `productName` | `product_name` |
| `productType` | `product_type` |
| `marketingModel` | `marketing_model` |
| `allocationType` | `allocation_type` |
| `keyMaterial` | `key_material` |
| `longPeriodMaterial` | `long_period_material` |

### 5.6 物品系列（主数据：物品系列；表/VO 以项目定义为准，常见 `series_*` 列）

| VO 字段（建议） | 库列（snake_case） |
|-----------------|-------------------|
| `seriesCode` | `series_code` |
| `seriesName` | `series_name` |
| `seriesLevelCode` | `series_level_code` |
| `parentSeriesCode` | `parent_series_code` |
| `parentSeriesName` | `parent_series_name` |

### 5.7 实现范围提示（非否定白名单，仅供排期）

1. **客户订单 / 预测订单** 字段挂在 **`DEMAND_SUMMARY`** 或分需求类型 VO 上时，需在 `getSourceTableFieldsDropdown`、运行时取值与 Union 字段一致性上 **按需求类型分支或合并展示**，并与 §4.2、§4.3 运行时约束一起设计。  
2. **物品、物品系列** 当前 **不在** `FactorSourceTableEnum` 三类来源内；若作为独立因子来源或作为 PSP/客户联表带出，需 **新增/扩展 Provider 与枚举**，并保证 `loadSourceRecords` 能取全白名单字段。  
3. **客户** 白名单已与 §4.3.1 收敛为仅编码、名称；其它客户列不再作为参与计算因子要求。  
4. **`creator` / `modifier`** 已纳入产品白名单；实现时按用户 ID 或展示名匹配规则需与产品再确认（与纯业务枚举字段的匹配语义可能不同）。
