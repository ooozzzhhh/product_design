# R2 MRP 库存冲减与产业目录比例供给（POC）底层系统设计方案

> 文档状态：设计定稿
> 针对需求：汇川POC R2（库存冲减配置与产业目录比例供给）
> 适用模块：MRP

## 1. 总体设计思路

本需求包含两个核心改造点，均作用于 MRP 的**净需求计算与供需匹配（`calNetDemand`）**环节。为满足 POC 快速闭环且不破坏现有核心逻辑的诉求，采用**数据预处理与虚拟子池匹配**的策略：

1. **库存冲减开关配置**：建立配置表控制「顶层产品/系列 -> 展开底层原材料」是否参与库存冲减。在匹配前，对不参与冲减的需求行，**隐蔽/剔除**非计划供应（如库存），使其直接生成等量的计划供应（净需求）。
2. **产业目录比例供给**：在匹配前，基于配置的比例，将总可用库存**划分为多个虚拟子池（Virtual Supply Pool）**。按产业目录对需求行分组，每组需求仅能消耗其对应子池中的库存额度，消耗完毕后即产生净需求。

## 2. 数据模型变更

为支持配置与 POC 演示，需新增以下两张配置表。

### 2.1 表 1：库存冲减规则配置表 `mrp_poc_deduct_config`
用于配置特定的「原材料」对特定「上层产品或产业目录」是否进行库存冲减。
| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | BIGINT | 是 | 主键 |
| `raw_material_id` | BIGINT | 是 | 原材料ID（如 Y00015） |
| `top_product_id` | BIGINT | 否 | 顶层产品ID（如 A1）。若为空则代表通配。 |
| `industry_catalog_code` | VARCHAR | 否 | 产业目录编码（物品系列）。与 `top_product_id` 二选一或组合使用。 |
| `is_deduct_inventory` | TINYINT | 是 | 是否冲减库存（1-是，0-否） |

### 2.2 表 2：产业目录供给比例配置表 `mrp_poc_supply_ratio_config`
用于配置「原材料」供给给各个「产业目录」的库存分配比例。
| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | BIGINT | 是 | 主键 |
| `raw_material_id` | BIGINT | 是 | 原材料ID（如 Y00015） |
| `industry_catalog_code` | VARCHAR | 是 | 产业目录编码（POC 中的物品系列，如 A / B） |
| `supply_ratio` | DECIMAL(5,4) | 是 | 供给比例（如 0.7000 代表 70%）。同一原材料的比例和理论上应为 1 或不超过 1。 |

## 3. 页面与前端交互变更

### 3.1 基础配置页面
- **新增菜单**：`计划基础设置 > 库存冲减与比例配置（POC）`。
- **页面功能**：
  - 提供 `mrp_poc_deduct_config` 表的增删改查：选择原材料、选择不冲减的顶层产品。
  - 提供 `mrp_poc_supply_ratio_config` 表的增删改查：选择原材料、配置各产业目录的供给百分比，保存时校验前端同物料比例和不超过 100%。

### 3.2 运行及结果展现（复用现有，微调字段映射）
- **触发与运行**：复用现有的 `/mrp/mrpRun` 及相关工作台。无需修改入参，直接读取配置即可生效。
- **结果查看**：在「MRP 供需明细/净需求」报表中，用户可看到：
  - 配置为「不冲减」的物料：生成了与毛需求相等的计划订单/净需求，尽管有可用库存，但未被消耗。
  - 配置为「比例冲减」的物料：净需求及 pegging 关系中，其消耗的库存量严格遵守配置池的上限。

## 4. 核心代码逻辑变更

改造集中在 `scp-mrp-sdk` 的 `FullMrpRunDomainServiceImpl.calNetDemand` 及相关上下文准备方法中。

### 4.1 数据上下文加载 (`MrpStrategyDataDomainServiceImpl`)
在 `getNewMrpContextData` 组装 `MrpContextDO` 阶段：
1. 一次性查出 `mrp_poc_deduct_config` 和 `mrp_poc_supply_ratio_config` 中的全量（或当前范围）配置，放入 `MrpContextDO` 缓存，避免在层级遍历时频繁查库。
2. BOM 展开逻辑（`calNextLevelDemand`）需确保下层 `MrpDemandDO` 能正确追溯/携带 **顶层产品的 ID** 及 **产业目录编码**（作为 Demand 的扩展属性透传）。

### 4.2 净需求与供需匹配改造 (`FullMrpRunDomainServiceImpl.calNetDemand`)

当处理至某一 `ProductStockPointDO`（如原材料 Y00015）时，原逻辑是直接将所有需求和所有供应扔给 `singleProductDemandSupplyMatchService.match`。改造后逻辑如下：

**步骤一：需求分组与属性判定**
将当前处理的 `MrpDemandDO` 列表，结合 `MrpContextDO` 中的配置，分为三组：
- **Group 1: 不冲减组**（匹配 `is_deduct_inventory = 0` 的需求，例如 A1 的需求）。
- **Group 2: 冲减且有比例配置的目录组**（按照产业目录分类，如 E9 归属目录 A，E10 归属目录 B）。
- **Group 3: 冲减但无比例配置的常规组**（其他常规需求）。

**步骤二：虚拟库存池切分**
针对 Group 2 的需求，对可用的 `STOCK_SUPPLY`（库存类供应）进行切分：
- 获取当前可用的库存总数 `total_stock`。
- 根据 `mrp_poc_supply_ratio_config` 中的比例，计算出目录 A 的虚拟库存上限 `limit_A = total_stock * 70%`，目录 B 的上限 `limit_B = total_stock * 30%`。
- 构造**虚拟供应列表**（Virtual Supply List），深度克隆真实的库存供应对象，并将其可用数量修改为对应的上限 `limit_X`。
- *舍入规则*：计算产生的尾差数量（末行吸收），归集到比例最大的目录或最后一个目录池中。

**步骤三：分批匹配 (Match by Groups)**
代替原先的一次性 `match`，分批调用 `singleProductDemandSupplyMatchService.match`：
1. **执行 Group 1 (不冲减组)**：
   - 传入的供应列表**剔除所有 `STOCK_SUPPLY`**（或直接传入空库存列表）。
   - 结果：全部毛需求转化为净需求，生成对应的计划供应。
2. **执行 Group 2 (按比例池冲减组)**：
   - 遍历各产业目录的子需求列表，分别传入其对应的**虚拟供应列表**。
   - 结果：每个目录最多消耗自己额度内的库存，超出部分产生净需求。
   - *库存扣减反写*：匹配完成后，根据子池的实际消耗量，同步扣减**真实库存供应**对象中的可用数量。
3. **执行 Group 3 (常规冲减组)**：
   - 传入扣除上述步骤消耗后，**剩余的真实库存供应列表**及其他非计划供应。
   - 结果：执行常规供需平衡匹配。

**步骤四：结果合并**
将上述所有分批 `match` 产生的分配关系（Fulfillment）及净需求（NetDemand / Planned Supply）列表合并，覆盖原逻辑中的单次匹配结果，继续向下执行 `newSupplyMatch` 和 `calNextLevelDemand`。

## 5. 边界与风险说明
1. **虚拟池与真实 Pegging 的一致性**：由于库存被拆分为虚拟对象进行匹配，最终落库时需确保 `Fulfillment` 表中的 `supplyId` 仍然指向原始唯一的库存记录 ID。
2. **多层共用时的比例传递**：本设计基于 POC 假设「产品与系列 1:1，上层清晰」。若中间出现多层半成品共用，BOM 展开时（`calNextLevelDemand`）必须实现对**顶层需求来源产业目录的精确透传与数量按比例分解**，否则在底层原材料处无法准确判断归属哪个产业目录。
3. **与分工厂（R1）的优先级**：若同一原材料同时涉及分工厂和产业目录比例分配，默认**先执行分工厂的供应隔离，再在各个工厂的局部库存池内执行产业目录切分**。