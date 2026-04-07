# 汇川 POC — R1_MPS 按比例分工厂设计方案

## 1. 需求回顾与目标

汇川 POC 核心诉求之一是实现**产品按预设比例分配给多工厂生产**。当前 MPS 分工厂模块已实现基于「规则引擎」的需求分配，以及工作台的工厂/产线落地。本方案旨在现有规则算法引擎上扩展「比例分配」能力，做到输入配置后，自动计算出各笔需求单的归属，使得多笔需求**整单**分配至多工厂后，各工厂累计获得的总数量尽可能趋近于配置的比例。

> **背景约定**：POC 场景下，物料—工厂—产线为 1:1:1 关系；本方案重点解决**多笔整单分配趋近于预设比例**的核心流程（**禁止拆分单笔需求行**）。

---

## 2. 表与数据模型设计

为了实现工厂与产线维度的比例分配配置，且不污染现有的（以优先级单行匹配为主的）客户指定产线等规则体系，设计新增独立的配置表：

### 2.1 新增表 `mps_fac_factory_proportion_config` (工厂比例分配配置表)

| 字段名 | 数据类型 | 约束/主键 | 说明 |
|--------|----------|-----------|------|
| `id` | BIGINT | PK | 主键 |
| `product_code` | VARCHAR(64) | 索引 | 物品编码（支持未来扩展产品系列等维度的比例） |
| `organization_id` | BIGINT | - | 生产组织ID（工厂） |
| `resource_id` | BIGINT | - | 标准资源ID（产线） |
| `proportion` | DECIMAL(5,4) | NOT NULL | 分配比例（如 0.6000 代表 60%） |
| `tenant_id` | BIGINT | - | 租户隔离 |
| `created_by` / `created_time` / `updated_by` / `updated_time` | - | - | 标准审计字段 |

### 2.2 数据关联逻辑
- 与现有的分工厂结果表 `sds_dem_factory_bom_result` 逻辑对齐：配置表的 `organization_id` 和 `resource_id` 会作为拆分结果字段直接输出并最终落库至 SDS。

---

## 3. 前端页面交互变更

新增配置页面并在分工厂工作台中展示拆分结果。

### 3.1 新增页面：工厂比例分配配置 (`/factoryProportionConfig/page`)
- **入口**：挂载于「主生产计划 > 粗产能规划」或单独作为 POC 配置入口。
- **列表视图**：支持按物品编码检索，列表展示「产品、工厂、产线、分配比例(%)」。
- **编辑/新增交互**：
  - 用户选定一个产品后，可通过表格明细行同时添加多组「工厂+产线+比例」。
  - **前置校验**：保存时前端必须校验同一物料的比例总和为 `100%`。
- **后端校验与异常规范**：
  - 后端在 Controller/Service 层进行比例和防并发校验，若某物料所配比例总和不为 1（100%），根据《Java 异常处理与报错规范》，需抛出业务异常。
  - **报错定义示例**：
    - 错误码：`MPS051`
    - 中文文案：`[MPS051] 物料「{0}」的分配比例之和必须为 100%，请检查配置后重试。`
    - 抛出：`throw new BusinessException(BusinessErrorEnum.MPS_PROPORTION_SUM_ERROR.getI18nErrordesc(productCode));`

### 3.2 工作台展示
- 无需修改工作台前端代码逻辑。基于后端分发逻辑，原有的分工厂工作台下表「分工厂结果列表」会自动接收后端返回的分配后记录（每条需求单被完整分配到唯一的工厂/产线，数量保持不变）。

---

## 4. 核心代码逻辑变更

本方案无缝接入 MPS 的 `IAllocationRule` 规则匹配管道，复用原有的 `FactoryAllocationWorkBenchServiceImpl.autoAllocateByRule()` 架构。

### 4.1 新增分工厂规则实现 `FactoryProportionRule`
- 继承 `AbstractAllocationRule` 或实现 `IAllocationRule`，并将其注册到 `AllocationRuleRegistry`。
- **规则优先级**：为了保证 POC 场景下比例分配优先命中，可将其配置为高优先级（在配置中心或库表 `mps_fac_factory_allocation_rule_algorithm` 初始化一条 `FACTORY_PROPORTION` 类型的规则并置顶）。

### 4.2 核心分配算法：多笔需求整单趋近分配
在 `matchAndAllocate` 方法中实现整单分发逻辑。基本思想：预先计算该物料总需求量下各工厂的「目标应分数量」，然后遍历单笔需求行，每次将整笔需求分配给「当前累计分得量」距离「目标应分数量」缺口（差值）最大的工厂，直到分配完毕。

```java
// 伪代码示例：按比例整单分配需求
// 1. 按物料分组聚合所有未分配的需求
Map<String, List<DemandSummaryDTO>> demandsByProduct = unallocatedDemands.stream()
    .collect(Collectors.groupingBy(DemandSummaryDTO::getProductCode));

for (Map.Entry<String, List<DemandSummaryDTO>> entry : demandsByProduct.entrySet()) {
    String productCode = entry.getKey();
    List<DemandSummaryDTO> productDemands = entry.getValue();
    
    // 2. 获取该物料的比例配置列表
    List<FactoryProportionConfig> configs = configService.findByProduct(productCode);
    if (CollectionUtils.isEmpty(configs)) {
        continue; // 没有配置则跳过，交由后续规则处理
    }
    
    // 3. 计算总需求量和各工厂的"目标分配量"
    BigDecimal totalQty = productDemands.stream()
        .map(DemandSummaryDTO::getDemandQty)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
        
    Map<Long, BigDecimal> targetQtyMap = new HashMap<>(); // 工厂ID -> 目标应得数量
    Map<Long, BigDecimal> currentQtyMap = new HashMap<>(); // 工厂ID -> 当前已得数量
    for (FactoryProportionConfig config : configs) {
        BigDecimal target = totalQty.multiply(config.getProportion());
        targetQtyMap.put(config.getOrganizationId(), target);
        currentQtyMap.put(config.getOrganizationId(), BigDecimal.ZERO);
    }
    
    // 4. 将需求单按数量从大到小排序（贪心策略，优先分配大单更容易趋近比例）
    productDemands.sort((d1, d2) -> d2.getDemandQty().compareTo(d1.getDemandQty()));
    
    List<FactoryBomResultDTO> resultsForDemand = new ArrayList<>();
    
    // 5. 遍历每一笔需求，整单分配给"缺口最大的工厂"
    for (DemandSummaryDTO demand : productDemands) {
        Long bestFactoryId = null;
        BigDecimal maxGap = BigDecimal.valueOf(-Double.MAX_VALUE); // 最大缺口
        FactoryProportionConfig bestConfig = null;
        
        for (FactoryProportionConfig config : configs) {
            Long orgId = config.getOrganizationId();
            BigDecimal gap = targetQtyMap.get(orgId).subtract(currentQtyMap.get(orgId));
            if (gap.compareTo(maxGap) > 0) {
                maxGap = gap;
                bestFactoryId = orgId;
                bestConfig = config;
            }
        }
        
        // 执行整单分配
        BigDecimal currentQty = demand.getDemandQty();
        FactoryBomResultDTO resultDTO = buildResultDto(demand, bestConfig.getOrganizationId(), bestConfig.getResourceId(), currentQty);
        resultsForDemand.add(resultDTO);
        
        // 更新当前已得数量
        currentQtyMap.put(bestFactoryId, currentQtyMap.get(bestFactoryId).add(currentQty));
        demand.setMatchedRule("YES");
    }
    
    context.addAllocatedResults(resultsForDemand);
}
```

### 4.3 库存点填充与保存
在生成 `FactoryBomResultDTO` 后，`autoAllocateByRule` 的外层逻辑会自动按生产组织反查补充库存点（`mdsFeign.getByParams(StockPointVO)`），并通过 `SdsFeign` 批量保存到 `sds_dem_factory_bom_result`，该流程**完全复用，无需修改**。

---

## 5. 对下游 MRP 的兼容性评估

在现有系统中：
- MPS 分工厂原本就是生成一条绑定了工厂和产线的分配记录。
- **结论**：本方案由原先设想的“拆单”改为**“整单分配”**，MPS 产生的分配结果仍然是每笔原始需求产生 1 条分发记录。这一结果能被下游 MRP 天然识别并消费（在对应工厂下参与供需平衡及 R2 的库存冲减环节）。由于不涉及需求拆分（`1 -> 1` 而非 `1 -> N`），完全不影响原系统的追溯链路，MRP 层无需做任何改动。