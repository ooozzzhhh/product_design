# MPS 分工厂与分BOM功能调研

> 调研日期：2026-04-05  
> 代码来源：`UHA/scp-foundation`（只读梳理，未改代码）  
> 关联表设计：见 `产品设计/产品知识库/MPS/表设计/01_表与视图清单.md`（`sds_dem_factory_bom_result`、`mps_fac_*` 等）

---

## 1. 业务概念

| 概念 | 含义（结合界面与实现） |
|------|------------------------|
| **分工厂** | 将一条需求汇总（需求订单维度）按数量拆到不同**生产组织（工厂）+ 标准资源（产线）**，结果落在 **分工厂分BOM结果表**（`sds_dem_factory_bom_result`）。工作台侧重「工厂/产线」与数量分配。 |
| **分BOM** | 在已有分工厂结果行上，为各工厂分配 **BOM 版本**（依赖 MDS 中按库存点+物品的 BOM 版本及优先级）。工作台侧重「BOM 版本」与继承标记。 |
| **合并能力** | 同一张结果表同时承载分工厂与分BOM字段；**分工厂分 BOM 工作台**（`subBomWorkbench`）将「需求汇总(BOM视图)」与「分BOM结果列表」放在同一页，便于连续操作。 |

**自动策略开关**：MDS 全局参数 `factory_allocation_algorithm` 决定自动分工厂走「规则算法」还是「优化算法」。当前代码中 `autoAllocateByOptimization()` 仅校验存在启用的优化规则，**未实现具体优化分配逻辑**（与规则路径分离）。

---

## 2. 用户侧：需维护的数据与典型操作顺序

### 2.1 建议维护顺序（配置 → 工作台 → 下游）

1. **主数据（MDS，被规则间接使用）**  
   - 物品、物品系列、客户。  
   - **物品候选资源**（`ProductCandidateResource`）：用于生成「物品候选资源」类分工厂规则明细（物品可产产线 + 推导生产组织）。  
   - **产品 BOM 版本**（含库存点、物品、优先级）：自动分BOM 时按「库存点 ID + 物品 ID」取**优先级最高（数值最小，null 最低）**的一条 BOM 版本。

2. **MPS 分工厂相关主数据/配置（前端路由多在 `粗产能规划` 父级下，门户菜单名称可能与 meta.title 不一致）**  
   - **规则算法分工厂规则**（`/factoryAllocationRuleAlgorithm/page`）：配置启用、优先级、`generateDetail` 是否生成明细、规则类型（见下节枚举）。  
   - **客户指定产线**（`/customerAppointLine/page`）：客户 + 物品/系列（含通配 `*`）+ 组织 + 标准资源 + 生效/失效时间 + 优先级。  
   - **分工厂规则明细**（`/detailsBranchFactoryRules/page`）：展示/维护展开后的明细；也可通过「规则算法」触发的 **更新规则明细** 从客户指定产线、物品候选资源**批量生成**写入 `mps_fac_factory_allocation_rule_detail`。  
   - **收货地**、**收货地可用工厂**：表与页面存在（`mps_fac_receiving_location`、`mps_fac_receiving_location_available_factory`）。**当前自动分工厂规则引擎（`AbstractAllocationRule` 及已注册规则实现）未引用收货地数据**；是否用于优化算法或其它模块需结合运行环境进一步确认。  
   - **优化算法分工厂规则**（`/factoryAllocationOptimizationAlgorithm/page`）：与全局参数「优化算法」分支相关；实现待完善。  
   - **预警管理配置**（`/warningManagementConfiguration/page`）：控制「自动分工厂/自动分BOM」前是否弹出预警、是否勾选「下次不再提醒」等（见前端 `assignedDialog`）。

3. **工作台操作（分工厂 / 分BOM / 二合一）**  
   - **分工厂工作台**（`/branchPlant`）：上表需求汇总，下表分工厂结果；按钮侧重「自动分工厂」「批量分工厂」「手工分工厂」、继承开关等。  
   - **分BOM工作台**（`/branchBom`）：上表「需求汇总(BOM视图)」，下表「分BOM结果列表」；按钮侧重「自动分BOM」「批量分BOM」「手工分BOM」等。  
   - **分工厂分 BOM 工作台**（`/subBomWorkbench/page`）：与分BOM工作台类似的上下布局，API 上同时覆盖分工厂与分BOM场景（如需求分页均走 SDS `pageFactoryAllocationWorkBench`）。

**典型点击顺序（自动路径）**  

1. 维护规则算法 + 客户指定产线（及/或 MDS 物品候选资源）→ 必要时执行「更新规则明细」或确认明细页数据。  
2. 打开对应工作台 → 查询需求汇总 →（按需）勾选行 → **自动分工厂** 或 **自动分BOM**。  
3. 若启用预警：在弹窗中确认或跳转「预测冲减」等 → 确认后调用 MPS `POST .../factoryAllocationWorkBench/autoAllocate` 或 `autoAllocateBom`。  
4. 在下表查看结果，必要时 **手工** 调整、**批量** 调整、**批量/取消继承**（工厂继承、BOM 继承分属不同接口）。  
5. 下游 **MRP 运行** 时读取 SDS 中分工厂分BOM结果，按工厂拆分需求并计算净需求（见第 5 节）。

**说明**：截图中的「预测筛选分工厂」等菜单文案在**当前仓库静态路由/源码中未检索到字面匹配**，可能来自门户菜单聚合或环境定制；以实际部署菜单为准，功能上以 `scp-mps-front` 中 `router/index.js` 注册页面为准。

---

## 3. 代码架构与接口

### 3.1 前端（`scp-front/scp-mps-front`）

- **路由**：`src/router/index.js` — `branchPlant`、`branchBom`、`subBomWorkbench` 及各类 `factoryAllocation*`、`customerAppointLine`、`receivingLocation*`、`warningManagementConfiguration`。  
- **需求汇总分页**：`GET /api/sds/demandSummary/pageFactoryAllocationWorkBench`（`fetchListPrefix("sds", ...)`）。  
- **自动分工厂**：`POST /api/mps/factoryAllocationWorkBench/autoAllocate`（`branchPlant`、`subBomWorkbench` 等）。  
- **自动分BOM**：`POST /api/mps/factoryAllocationWorkBench/autoAllocateBom`（`branchBom`）。  
- **结果持久化**：`factoryBomResult/*`（SDS），如 `createOrUpdate`、`clearAndOverride`、继承批量更新、按订单批量改组织/BOM 等（见 `FactoryBomResultController`）。

### 3.2 MPS 服务

- **`FactoryAllocationWorkBenchController`**：`autoAllocate`、`autoAllocateBom`。  
- **`FactoryAllocationWorkBenchServiceImpl`**：  
  - `autoAllocate()`：读全局参数 → `autoAllocateByRule()` 或 `autoAllocateByOptimization()`。  
  - `autoAllocateByRule()`：拉取「待分工厂」需求 → 按规则算法表优先级依次执行已注册的 `IAllocationRule` → 汇总 INSERT/UPDATE/DELETE → 通过 **SdsFeign** 批量写 `FactoryBomResultDTO`；写前按生产组织补 **库存点**（`mdsFeign.getByParams(StockPointVO)`），缺库存点则标记异常原因「生产组织无库存点」。  
  - `autoAllocateBom()`：对「待分BOM」需求，按行更新 BOM 版本或异常原因（「物品BOM未维护」「需求数量未全部分配」等）。

### 3.3 SDS 服务

- **`DemandSummaryController.pageFactoryAllocationWorkBench`**：工作台需求分页（底层 `DemandSummaryDao.selectFactoryAllocationDemandByCondition`，具体 SQL 条件在 DAO/映射层，本仓库路径未展开 XML 时可从运行库继续核对）。  
- **`DemandSummaryServiceImpl.selectNeedAllocationDemandSummary` / `selectNeedAllocationBomDemandSummary`**：供 MPS Feign 拉取「仍待处理」的需求：挂载已有 `factoryBomResultList`，若**已全部继承且数量凑满需求**则跳过；并 **过滤存在已锁定分配计划（fulfillment.fixed=YES）的需求**。  
- **`FactoryBomResultController` / `FactoryBomResultServiceImpl`**：结果的增删改、数量校验（分工厂/分BOM 模式差异）、库存点与 BOM 异常原因刷新、与锁定分配校验等。

### 3.4 规则扩展点

- **`AllocationRuleConfig`**：`ApplicationRunner` 将所有 `IAllocationRule` 实现注册到 `AllocationRuleRegistry`。  
- **已实现规则类**（均继承 `AbstractAllocationRule`）：  
  - `CustomerAppointLineRule` — 对应枚举 `CUSTOMER_APPOINT_LINE`（客户指定产线明细）。  
  - `ProductCandidateResourceRule` — 对应枚举 `PRODUCT_CANDIDATE_RESOURCE`（物品候选资源展开明细）。  
- **匹配逻辑**（`AbstractAllocationRule`）：按需求的 `customerCode`、`seriesCode`、`productCode` 组合建索引；支持规则侧客户/系列 `*` 通配；**同一候选集内**按 `priority` 字符串比较（支持 `规则优先级-明细优先级` 数值段比较）。已匹配需求打 `matchedRule=YES`，后续规则跳过。

### 3.5 规则明细生成（与页面「客户指定产线」等的关系）

- **`FactoryAllocationRuleDetailServiceImpl.updateRuleDetail()`**：按每条「规则算法」配置，删除旧明细后重建：  
  - **客户指定产线**：从 `CustomerAppointLine` 读启用数据；若物品为 `*`，按物品系列展开 MDS 物品生成多行明细。  
  - **物品候选资源**：从 MDS 拉 `ProductCandidateResource`，按「物品+标准资源」去重，用标准资源反查 **organizationId**，客户侧写 `*`，优先级来自候选资源。

---

## 4. MRP 侧消费逻辑（衔接）

- **`MrpStrategyDataDomainServiceImpl`**：在构建 MRP 上下文前，对独立需求调用 `splitDemandByFactoryBomResult`：通过 **SdsFeign** 按 `orderIds` 查询 `FactoryBomResultVO`，交给 **`FactoryBomSplitService`**。  
- **`FactoryBomSplitService`**：  
  - 无结果 → 原需求不变。  
  - 有结果 → **每条结果生成新 `MrpDemandDO`（新 ID）**，数量取分工厂数量，`originalDemandId` 指向原需求；写 `organizationId`、`bomVersion`、`factoryBomResultId`；原需求数量不改。  
- **`FullMrpRunDomainServiceImpl`**：存在分工厂结果时走 **`FactoryBomNetDemandService`**，按工厂独立扣减供应，分配关系仍关联**原始需求**。  
- **`MrpRunServiceImpl`**：持久化时跳过拆分虚拟需求行、分配关系 demandId 指向原始需求等（注释标明「分工厂分BOM修复」）。

---

## 5. 关键数据表（与知识库一致）

| 表名 | 用途摘要 |
|------|----------|
| `sds_dem_factory_bom_result` | 分工厂分BOM结果（订单、数量、工厂、产线、库存点、BOM版本、继承标记、异常原因等） |
| `mps_fac_factory_allocation_rule_algorithm` | 规则算法主表（启用、优先级、是否生成明细、规则类型） |
| `mps_fac_factory_allocation_rule_detail` | 规则匹配用明细（客户/系列/物品维度 + 组织 + 标准资源 + 优先级 + 生效时间） |
| `mps_fac_customer_appoint_line` | 客户指定产线源数据 |
| `mps_fac_factory_allocation_optimization_algorithm` | 优化算法配置 |
| `mps_fac_receiving_location` / `mps_fac_receiving_location_available_factory` | 收货地及可用工厂 |
| `mps_fac_warning_config` | 预警管理配置 |

---

## 6. 边界与实现缺口（便于排障）

- **优化算法**：`autoAllocateByOptimization()` 未包含与规则路径等价的分配实现；若全局参数切到优化算法，行为与预期需与研发确认。  
- **收货地**：表与 CRUD 完整，但**未接入当前两条 `IAllocationRule` 的匹配链**。  
- **待分工厂/待分BOM集合**：依赖「需求汇总是否进入分工厂工作台数据集」+ 继承与数量是否已满 + 是否被 fulfillment 锁定；异常行（无工厂、无库存点、无 BOM）仍会进入处理或带异常原因。  
- **Feign 批量写 SDS**：`BulkOperationUtils` + `SdsFeign.doCreateBatchWithPrimaryKey` / `doUpdateBatch` / `doDeleteByIds`，与前端单笔 `factoryBomResult` 接口并存。

---

## 7. 主要代码索引（便于跳转）

| 层级 | 路径 |
|------|------|
| MPS 工作台服务 | `scp-mps-sdk/.../factory/service/impl/FactoryAllocationWorkBenchServiceImpl.java` |
| MPS 规则抽象与实现 | `scp-mps-sdk/.../factory/allocationrule/core/AbstractAllocationRule.java`、`CustomerAppointLineRule.java`、`ProductCandidateResourceRule.java` |
| MPS 规则明细生成 | `scp-mps-sdk/.../factory/service/impl/FactoryAllocationRuleDetailServiceImpl.java` |
| MPS API | `scp-mps-sdk/.../factory/controller/FactoryAllocationWorkBenchController.java` |
| SDS 需求汇总 | `scp-sds-sdk/.../demandSummary/controller/DemandSummaryController.java`、`.../service/impl/DemandSummaryServiceImpl.java` |
| SDS 结果表 | `scp-sds-sdk/.../demandSummary/controller/FactoryBomResultController.java`、`.../service/impl/FactoryBomResultServiceImpl.java` |
| MRP 拆分 | `scp-mrp-sdk/.../domain/service/MrpStrategyDataDomainServiceImpl.java`、`FactoryBomSplitService.java`、`FactoryBomNetDemandService.java`、`MrpRunServiceImpl.java` |
| 前端工作台 | `scp-mps-front/src/views/branchPlant/**`、`branchBom/**`、`subBomWorkbench/**` |
| 前端 API | `scp-mps-front/src/api/branchPlant/index.js`、`branchBom/index.js`、`subBomWorkbench/index.js` |

---

返回 [[../_MPS概览]] · [[../../_索引]]
