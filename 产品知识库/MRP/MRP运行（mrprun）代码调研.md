# MRP 运行（mrprun）代码调研

> 更新时间：2026-04-01
> 调研范围：`scp-mrp-sdk` / `scp-mrp-api` 中与 MRP 运行相关的全部核心类

---

## 一、整体架构

```
Controller（触发入口）
  └─ MrpRunServiceImpl（应用层，scp-mrp-sdk）
       └─ InterfaceInstanceService（策略选择）
            ├─ FullMrpRunDomainServiceImpl          ← MRP 模块专用（全量）
            ├─ FullMrpRunDomainServiceMpsSchImpl     ← MPS / SCH / AMS 模块专用
            ├─ IncrementalMrpRunDomainServiceImpl    ← 增量 MRP（继承全量）
            └─ MaterialAllocateDomainServiceImpl     ← 物料分配专用
```

核心抽象类 `AbstractMrpRunDomainService` 定义了 MRP 运行的骨架（模板方法），各子类实现差异化细节。

---

## 二、关键类与文件路径

| 类 | 路径 | 说明 |
|----|------|------|
| `MrpRunService` | `scp-mrp-api/.../service/MrpRunService.java` | 接口定义 |
| `MrpRunServiceImpl` | `scp-mrp-sdk/.../impl/MrpRunServiceImpl.java` | 应用层实现，对外入口 |
| `AbstractMrpRunDomainService` | `scp-mrp-sdk/.../domain/service/AbstractMrpRunDomainService.java` | 模板方法骨架 |
| `FullMrpRunDomainServiceImpl` | `scp-mrp-sdk/.../domain/service/FullMrpRunDomainServiceImpl.java` | 全量 MRP（MRP 模块） |
| `FullMrpRunDomainServiceMpsSchImpl` | `scp-mrp-sdk/.../domain/service/FullMrpRunDomainServiceMpsSchImpl.java` | MPS/SCH/AMS 变体 |
| `IncrementalMrpRunDomainServiceImpl` | `scp-mrp-sdk/.../domain/service/IncrementalMrpRunDomainServiceImpl.java` | 增量 MRP |
| `InterfaceInstanceService` | `scp-mrp-sdk/.../strategy/InterfaceInstanceService.java` | 实例选择策略接口 |

---

## 三、`MrpRunService` 接口方法

| 方法 | 说明 | 使用场景 |
|------|------|----------|
| `runByStrategyId(taskId, strategyId, orderIds)` | 按策略 ID 运行 MRP | 纯 MRP 模块触发 |
| `runWithStrategyNew(taskId, orderType, orderIds)` | 按默认策略运行 | MPS、SCH 供需匹配触发 |
| `run(taskId, strategyId, orderIds, orderType)` | 通用核心方法，上面两个均调用此方法 | — |
| `stockAllocate(orderIdWithDemandTypeList, ifMainFulfillment)` | 库存分配 | — |
| `materialAllocate(dto)` | 物料分配计划页面自动分配按钮 | — |
| `runByCustomizedProcess(dto)` | 自定义流程运行（**已废弃**） | 遗留，勿新用 |
| `runWithStrategy(orderType, orderIds)` | 旧版触发（**已废弃**） | 遗留，勿新用 |

---

## 四、`MrpRunServiceImpl.run()` 执行流程

```
1. 获取 MRP 策略（按 strategyId 或取默认策略）
2. 写进度备注（taskId + 策略编码 + calculationMode 到进度管理器）
3. 校验低阶码计算状态（Redis key: {scenario}_LOW_CODE_CALC）
   - 不存在 → 抛出"系统未进行低阶码计算"
   - START  → 抛出"低阶码计算未完成"
4. 获取计划周期（historyRetrospectStartTime ~ planEndTime）
5. 组装 MrpContextDO（调用 MrpStrategyDataDomainServiceImpl.getNewMrpContextData）
6. 选择 Domain Service 实例：
   - MRP 模块 → FullMrpRunDomainServiceImpl
   - 其他模块 → FullMrpRunDomainServiceMpsSchImpl
7. 调用 mrpRunService.run(mrpContextDO) 执行运算
8. 返回 MrpRunResultDO
```

---

## 五、`AbstractMrpRunDomainService.run()` 执行步骤（核心骨架）

```
前置校验
  ├─ 若勾选制造订单，但策略未包含 WORK_ORDER_DEMAND → 直接返回空结果
  └─ 若勾选客户订单，但策略未包含 CUSTOMER_ORDER_DEMAND → 直接返回空结果

clearOldFulfillment()     // 清除上次 MRP 产生的分配关系

按低阶码分层遍历（低阶码越小 = 越顶层，优先处理）：
  对同层每个 ProductStockPointDO（策略物料范围内）：
    ① handleRedundantDependentDemand()  // 清除工艺变更后不再需要的非独立需求
    ② getDemandListForCalNetDemand()    // 汇总独立 + 非独立需求列表
    ③ getSupplyListForCalNetDemand()    // 获取参与净需求计算的供应
    ④ calNetDemand()                    // 计算净需求（供需平衡表填充）
    ⑤ newSupplyMatch()                  // 生成/调整计划供应 + 供需匹配

  每层结束：
    calNextLevelDemand()     // BOM 展开，生成下层物料需求
    handleRedundantSupply()  // 删除不再需要的计划供应

postProcessing()             // 后置处理（补全 updateSupply/updateDemand 列表，清除旧净需求）
```

---

## 六、全量 vs 增量 vs MPS/SCH 的关键差异

### 全量（`FullMrpRunDomainServiceImpl`，MRP 模块）
- **净需求供应来源**：只用 `nonPlannedSupplyDOMap`（非计划供应，即在手库存、确认订单等），不考虑已有计划供应
- **clearOldFulfillment**：清除策略范围内所有需求的历史分配关系；若勾选了特定订单，只清除与这些订单相关的分配
- **冗余供应处理**：会删除不再被需求覆盖的计划供应

### 增量（`IncrementalMrpRunDomainServiceImpl`）
- 继承全量，重写以下 3 个方法：
  - `getSupplyListForCalNetDemand`：非计划供应 + 计划供应都参与净需求计算（不删旧计划）
  - `getAllSupplyListForCalNetDemand`：返回全部供应（包含计划）
  - `handleRedundantSupply`：**空实现**，不删除任何冗余供应
  - `clearOldFulfillment`：只清除与 `orderIds` 关联的分配（按制造订单 ID 精准清除）

### MPS/SCH/AMS（`FullMrpRunDomainServiceMpsSchImpl`）
- 继承全量，差异：
  - 供需匹配服务换为 `SingleProductDemandSupplyMatchServiceMpsSchImpl`（SCH 特有匹配规则）
  - `clearOldFulfillment`：在全量清除基础上，额外把工单子供应的分配追溯至父供应并统一处理

---

## 七、分工厂分BOM改造（较新功能）

> 涉及 `FullMrpRunDomainServiceImpl.calNetDemand()` 及 `FactoryBomNetDemandService`

**触发条件**：需求 `MrpDemandDO` 携带分工厂分BOM结果（`factoryBomNetDemandService.hasFactoryBomResult()`）

**核心逻辑**：
1. 将需求分为「有分工厂分BOM结果」和「普通」两组
2. 有分BOM结果的需求：按工厂独立管理可用供应，按需求时间顺序依次扣减（`calculateNetDemandByFactory`）
3. 普通需求：走原有 `singleProductDemandSupplyMatchService.match()` 逻辑
4. 分配关系写回时：`fulfillment.demandId` 指向**原始需求 ID**（非拆分需求的新 UUID）

**工艺路径选择**（`filterRoutingByBomVersion`）：
- 若制造订单携带 `bomVersionId`，则按 `RoutingDO.sourceBomMainKey == bomVersionId` 筛选路径
- 筛选有效路径后，取优先级数值最小的（优先级最高）
- 若路径中 step input 的 `stockPointId` 不正确，通过 `refetchFullRouting` 重新 match 获取完整路径

---

## 八、进度埋点节点

通过 `ProcessProgressManager.updateNodeProgress(taskId, node, status, ...)` 更新，节点顺序：

| 节点枚举 | 说明 |
|----------|------|
| `MATERIAL_SORTING` | 低阶码计算完成校验 |
| `DATA_PREPARATION` | 数据准备（组装 MrpContextDO） |
| `DEMAND_SUPPLY_CALCULATION` | 供需计算（AbstractMrpRunDomainService.run） |
| `PLAN_GENERATION` | 结果持久化（handleResult） |

---

## 九、结果处理 `handleResult()`

入参 `MrpRunResultDO` → 输出 `MrpResultDTO`，处理内容：

| 数据类型 | 操作 |
|----------|------|
| 需求（Demand） | INSERT / UPDATE / DELETE，跳过拆分需求（originalDemandId 非空） |
| 供应（Supply） | INSERT / UPDATE / DELETE |
| 分配关系（Fulfillment） | 全量重建；拆分需求的 fulfillment.demandId 指向原始需求 |
| 制造订单（WorkOrder） | INSERT / UPDATE，设置 planStatus=UNPLAN |
| 采购订单（PurchaseOrder） | INSERT / UPDATE |
| 运输订单（TransportOrder） | INSERT / UPDATE |
| 净需求（NetDemand） | 受 `mrp.persist.netdemand` 配置控制是否持久化 |
| 客户订单状态 | 根据 fulfillment 状态更新 planStatus / fulfillmentStatus / plannedCompletionDate |
| 需求预测状态 | 同上 |

最终调用 `mrpRunResultHandlerService.handleMrpResult(mrpResultDTO)` 完成持久化。

---

## 十、常见注意点

1. **低阶码必须预先计算完毕**：MRP 运行前必须确认 Redis 中 `{scenario}_LOW_CODE_CALC = END`，否则直接报错。
2. **策略物料范围为空会报错**：`MrpChoosedProductStockPointDOList` 为空时抛出业务异常，需检查 MRP 策略配置。
3. **数量超限校验**：生成的制造/采购订单数量不能超过 `9999999999.9999`，超出会抛出 BusinessException。
4. **拆分需求不持久化**：`originalDemandId` 非空的需求是分工厂拆分的虚拟需求，结果处理时跳过，不写入需求表。
5. **勾选特定订单 vs 全量运行**：勾选订单时只清除与这些订单关联的分配，其他供应变为非计划供应（只读），不会被 MRP 修改。
