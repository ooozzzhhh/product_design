# MRP：汇川 POC R2（库存冲减 + 产业目录比例供给）现状与改造点调研

> 更新时间：2026-04-05  
> 代码来源：`UHA/scp-foundation`（只读梳理，未改代码）  
> 需求对照：`产品设计/产品需求/汇川POC/汇川POC_需开发范围/需求.md` §4 R2  
> 关联：`MRP运行（mrprun）代码调研.md`、`MPS/代码/MPS_分工厂与分BOM功能调研.md`（分工厂进 MRP 后的净需求分支）

---

## 1. R2 需求摘要（待改造能力）

| 能力 | 业务描述 |
|------|----------|
| **物料级是否冲减库存** | 按**原材料（物料编码）**配置：由 BOM 展开产生的对该料的需求，是否在 MRP 中用**在手库存等非计划供应**扣减净需求。不冲减时：仍可按 BOM 产生毛需求/展示，但**不按库存抵扣**。 |
| **产业目录比例供给** | 对**冲减**类原材料，当多个**产业目录**（POC 等同**物品系列**）下的产品需求同时消耗同一料时，将可用库存按**人工比例**在目录间分配后再参与匹配（或等价效果）。 |

---

## 2. 与 `mrpRun` 接口的关系

### 2.1 升级环境 URL

业务侧提供的运行入口示例：

`http://scp-upgrade.uhalean.com/api/mrp/mrp/mrpRun`

（具体前缀以网关与服务注册为准；代码侧控制器映射见下。）

### 2.2 代码入口

| 项 | 说明 |
|----|------|
| 类 | `com.yhl.scp.mrp.mrp.controller.MrpController` |
| 映射 | 类上 `@RequestMapping("mrp")`，方法上 `@PostMapping("mrpRun")` → 相对应用上下文路径为 **`/mrp/mrpRun`** |
| 请求体 | `MrpRunDTO`（`scp-mrp` 扩展包，本仓库未检出源码）：控制器中使用 `mrpStrategyId`、`scenario`、`customerOrderIds` 等 |
| 异步与锁 | 按 `scenario` 写 Redis 锁（`{scenario}_mrpRun`）；初始化进度任务后异步执行 `mrpRunService.runByStrategyId(taskId, mrpStrategyId, customerOrderIds)` |
| 核心运算 | `MrpRunServiceImpl.run` → `MrpStrategyDataDomainServiceImpl.getNewMrpContextData` 组装 `MrpContextDO` → `FullMrpRunDomainServiceImpl.run`（模块为 MRP 时） |

**数据流（文字）**：前端/集成方 `POST mrpRun` → 应用层取 **MRP 策略**与**计划周期** → 拉取需求、供应（含非计划供应）、BOM/工艺等进入 `MrpContextDO` → 按低阶码循环：**清旧分配 → 汇总需求 → 取参与净需求计算的供应列表 → `calNetDemand` 供需匹配 → 生成计划供应与 pegging** → 结果持久化（净需求、分配关系、计划订单等，受策略与配置影响）。

---

## 3. 现状：库存如何进入「净需求计算」

### 3.1 非计划供应类型（策略级）

- `MrpStrategyDataDomainServiceImpl.getNonPlannedSupplyList` 使用策略上的 **`nonPlannedSupplyTypes`**，调用 `supplyClient.getSupply(...)` 拉取供应列表，再按 `productId` 分组写入 `SdsDataDO.nonPlannedSupplyDOMap`。  
- **是否包含库存类供应**取决于策略配置中是否包含对应 `SupplyType`（如库存供应类型，常见为 `STOCK_SUPPLY`，具体以枚举与配置为准）。  
- **全量 MRP**（`FullMrpRunDomainServiceImpl.getSupplyListForCalNetDemand`）净需求计算时，对每个策略范围内的 `ProductStockPointDO`，从 **`nonPlannedSupplyDOMap` 按 `productId` 取列表**（可选合并替代料库存），**不合并计划供应**（与增量模式不同）。

### 3.2 净需求计算主路径

- `AbstractMrpRunDomainService.run` 每层物料：`getDemandListForCalNetDemand` → `getSupplyListForCalNetDemand` → **`calNetDemand`**。  
- **无分工厂分BOM结果**时：`FullMrpRunDomainServiceImpl.calNetDemand` 调用 **`singleProductDemandSupplyMatchService.match`**，在 `ProductStockPointDO` 维度上对「该料号在该库存点下的需求列表」与「供应列表」做匹配，结果写入 `ProductDemandSupplyBalanceDO.itemList`。  
- **有分工厂分BOM结果**时：先走 **`FactoryBomNetDemandService.calculateNetDemandByFactory`**（按工厂拆分扣减），其余仍可能走 `match`（见 `FullMrpRunDomainServiceImpl` 中合并 `itemList` 的逻辑）。

### 3.3 与「少冲减库存」相关的现有机制（不等于 R2）

| 机制 | 作用 | 与 R2 差异 |
|------|------|------------|
| **MRP 策略 `nonPlannedSupplyTypes`** | 全局控制本次运行是否把某类非计划供应（含库存）纳入供应池 | **非**按「原材料编码」、**非**按「上层产品/产业目录」细粒度开关。 |
| **库存点物品 `reservationType`（如 `NOT_ALLOCATE`）** | `FullMrpRunDomainServiceImpl.calNetDemand` 开头：若为该类型则 **直接 return，不对该库存点物品做净需求匹配** | 粒度是**库存点+物料**，不是「某原材料对所有下游展开需求是否冲减」；也不会实现「同一料对部分上层冲减、对部分不冲减」。 |
| **增量 MRP / 物料分配** | `IncrementalMrpRunDomainServiceImpl` 等路径下计划供应也可参与净需求；`stockAllocate` 走 `MaterialAllocateDomainServiceImpl` | 仍为策略与既有匹配逻辑，**无**产业目录比例配置。 |

结论：**当前代码没有「按原材料编码配置是否冲减」也没有「按产业目录（物品系列）对共用料库存做比例分配」的专门数据结构与算法。**

---

## 4. R2 改造点梳理（实现向）

### 4.1 物料级是否冲减

**目标**：例如 A1 展开到 Y00015 不冲减，E9/E10 展开到 Y00015 冲减。

**难点**：净需求与供应匹配在 **`ProductStockPointDO`（物料+库存点）维度**聚合了多条 `MrpDemandDO`，需求行携带上层订单/产品信息，需在 **`match` 之前或之中**区分：哪些需求行允许使用 `STOCK_SUPPLY`（或全部非计划供应）扣减。

**可选切入点（供设计选型）**：

1. **配置表**：原材料 × 可选维度（组织/库存点/场景）× 「是否冲减」；运行期读入 `MrpContextDO`。  
2. **过滤供应副本**：在 `getSupplyListForCalNetDemand` 或 `calNetDemand` 调用 `match` 前，对「不冲减」需求行使用**剔除库存供应后的供应列表**（或拆成两次 match 再合并，需注意 pegging 与净需求行一致性）。  
3. **需求行标记**：在 BOM 展开生成下层 `MrpDemandDO` 时写入「继承上层冲减策略」的标记，匹配器按行过滤可用供应类型。

### 4.2 产业目录（物品系列）比例供给

**目标**：同一 `Y00015` 库存被 E9（系列 A）、E10（系列 B）共用，冲减时按配置如 **70:30** 分配可参与匹配的库存量。

**现状**：供应按 **物料维度**分组，匹配顺序由 `singleProductDemandSupplyMatchService` 与需求时间等规则决定，**没有「按系列先切分库存池」**的步骤。

**可选切入点（供设计选型）**：

1. **配置表**：原材料 × 产业目录（系列）× 比例；运行前校验归一化。  
2. **预处理**：在 `calNetDemand` 对共用料，按系列将需求分组，将**总可用库存**按比例拆成**虚拟子池**或**带配额上限的供应对象**，再调用现有匹配逻辑。  
3. **后处理**：全量匹配后按系列校正分配量（复杂度高，易与 pegging 不一致，一般不如预处理清晰）。

### 4.3 数据落库与接口

- 净需求、分配关系常见表：`sds_peg_net_demand`、`sds_peg_fulfillment`（见 SDS 表设计清单）。  
- 改造后需保证：**同一 `mrpRun` 任务内** pegging 与净需求数量闭合、与「不冲减」需求展示一致。  
- **`mrpRun` 请求体无需必然变更**也可先实现（纯后端读配置）；若需按单跑部分订单，继续沿用 `customerOrderIds` 等现有字段即可。

---

## 5. 与 R1（分工厂）的衔接说明

- 若上层需求已按分工厂拆分，`calNetDemand` 会走 **分工厂净需求**分支，但仍是 **按工厂扣减供应**，与 R2「按原材料 + 产业目录比例」是正交能力；同时启用时需在设计上约定**先后顺序**（例如先分工厂再下层共用料比例冲减，避免双重扣减）。

---

## 6. 主要代码索引

| 主题 | 路径 |
|------|------|
| HTTP 入口 | `scp-mrp-sdk/.../mrp/controller/MrpController.java`（`mrpRun`） |
| 应用层运行 | `scp-mrp-sdk/.../impl/MrpRunServiceImpl.java` |
| 上下文与供应加载 | `scp-mrp-sdk/.../MrpStrategyDataDomainServiceImpl.java`（`getNonPlannedSupplyList` 等） |
| 全量净需求与供应列表 | `scp-mrp-sdk/.../FullMrpRunDomainServiceImpl.java`（`calNetDemand`、`getSupplyListForCalNetDemand`） |
| 模板骨架 | `scp-mrp-sdk/.../AbstractMrpRunDomainService.java` |
| 分工厂净需求 | `scp-mrp-sdk/.../FactoryBomNetDemandService.java` |
| 既有文档 | `产品设计/产品知识库/MRP/MRP运行（mrprun）代码调研.md` |

---

返回 [[../../_索引]] · 参见 [[../MRP运行（mrprun）代码调研]]
