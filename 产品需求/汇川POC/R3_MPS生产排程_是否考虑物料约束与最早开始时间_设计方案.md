# 汇川 POC — R3_MPS 生产排程「是否考虑物料约束」与最早开始时间下发算法 — 设计方案

> 文档状态：待评审  
> 针对需求：汇川 POC — 生产排程参数增加「是否考虑物料约束」；控制制造订单/工序的最早开始时间是否传入 APS 算法输入。  
> 适用模块：MDS（生产排程参数配置与落库）、MPS（自动排程 `executeSchedule`、数据组装与 APS 输入）

---

## 1. 需求回顾与目标

### 1.1 背景

当前 MPS 自动排程（如 `/api/mps/schedule/executeSchedule/{planGroupCode}` 触发生产排程模块）在组装算法输入时，会将制造订单的最早开始时间、经 SDS 静态计算后的工序最早开始时间，写入中间结构并进一步映射为 APS `WorkOrder.earliestBeginTime`、`Operation.earliestStart` 等（有值则写入）。

汇川 POC 希望在**生产排程参数**界面增加开关，由计划员显式控制：**是否把「最早开始时间」相关字段传给算法**。

### 1.2 目标行为（验收口径）

| 配置项 | 行为 |
|--------|------|
| **勾选**「是否考虑物料约束」 | 保持与现有组装逻辑一致：在算法输入 JSON（及 APS 内存对象）中，**照常下发**制造订单的最早开始时间、工序的最早开始时间（字段名以 APS 序列化结果为准，如 `earliestBeginTime`、`earliestStart` 等）。 |
| **不勾选** | 组装 APS 输入时，对上述「最早开始时间」类字段**视为未设置**：不向算法传递有效最早开始约束（等价于不传；若序列化库对 null 省略字段，则 JSON 中不出现对应键）。 |

### 1.3 命名说明（产品文案 vs 技术含义）

- 界面文案：**「是否考虑物料约束」**（与原型一致，位于「预齐套工序在计划开始时刻的…分钟后才可开工」同一行右侧）。  
- 技术实现上，该开关控制的是**算法输入侧是否携带「最早开始时间」约束**；与「物料齐套/供应」等业务概念在数据链上的耦合，以当前 MPS 组装代码中**实际参与赋值的字段**为准（见第 5 节），避免与 MDS 中已有「是否排未齐套工序」等字段语义混淆。若后续需与真实物料约束引擎联动，可在独立需求中扩展，本 POC 以「最早开始时间是否下发算法」为闭环范围。

### 1.4 与页面「工序筛选」的关系：生效范围是谁？

同一弹窗里，**筛选项**与 **「是否考虑物料约束」** 在技术上的作用域**不一致**，需产品明确采纳哪一种口径。

| 概念 | 在现有 MPS 组装里的含义 |
|------|-------------------------|
| **筛选项** | 只决定 **`operationsNeedSchedule`（待排工序 ID 列表）**：算法重点重排/新排哪些工序。由 `getNeedOperations(filterCondition)` 得到，写入 `conf` 的 `runTimeParameter.operationsNeedSchedule`。 |
| **算法输入里的工序集合** | 除待排工序外，还会并入**计划期间内已上资源的工序**、**齐套/供需关联带出的工序**等，统一进入 `BaseAlgorithmData.operations`；制造订单列表来自**本包内所有工序**关联的订单，而非仅筛选项命中的订单。 |

因此：

- **若按前文第 5.2 节「整包清空」实现（推荐默认、实现简单）**  
  - **不勾选**时：对**本次调用传入 APS 的整包**里的制造订单与工序，**一律**不再带最早开始时间。  
  - 生效对象 **不是**「仅筛选项命中的工序」，而是「**本趟排程任务组装的全部算法输入**」（含已排占位、关联工序等）。  
  - 与筛选项的关系：**筛选项仍只约束谁待排；本开关约束整包是否带最早开始。**

- **若产品坚持「仅对筛选项命中的待排工序不传最早开始，其余工序（如已排上下文）仍传」**  
  - 需在实现上改为**按 `needScheduleOperationIds`（及待排父下的子工序）**选择性清空 `OperationData.earliestBeginTime`，并对制造订单做**拆单级**或**仅当该单仅含待排工序时**才清空 `WorkOrderData.earliestBeginTime` 等规则，**复杂度高**，且与算法对混合约束的行为需联调验证。  
  - **须在评审中单独立项**，本文档 **5.2 默认采用「整包」口径**。

**结论（直接回答「只对筛选后的还是全部」）**：按本方案 **5.2 默认写法**，是 **对「本趟算法输入里的全部工序/相关制造订单」生效**，**不是**仅对筛选项筛出的那一部分；筛选项只圈「谁要重排」，不圈「谁进输入包」。

---

## 2. 数据与存储：复用现有 `remark`（不新增列）

生产排程参数表 **`mds_par_production_scheduling_param`** 已存在 **`remark`** 列，且在 `scp-extension/scp-mds-infra-base/.../ProductionSchedulingParamBasicDao.xml` 的 `BaseResultMap` / `Base_Column_List` 中已映射；`ProductionSchedulingParamBasicDTO` 已声明 `remark` 字段。`ProductionSchedulingParamVO` 一般通过平台 **`BaseVO`** 父类携带 `remark`（与 `enabled`、`creator` 等审计字段同批持久化）。

**本需求不新增数据库字段、不提供 `ALTER TABLE`。**

### 2.1 `remark` 取值约定（实现与前后端契约）

| `remark` 值（trim 后） | 含义 |
|------------------------|------|
| **`Y`** | 勾选「是否考虑物料约束」：最早开始时间**照常**传给算法。 |
| **`N`** | 不勾选：**不传**最早开始时间（见第 5.2 节清空逻辑）。 |
| **空、`NULL`、或其它非 `Y`/`N` 的字符串** | 语义由 **5.4 节** 锁定（建议兼容存量时视为 `Y`）。 |

保存时：前端勾选态与 `remark` **写回一致**（仅写 `Y` 或 `N`），避免在同列混写自由备注与本开关（见 2.2）。

### 2.2 与「备注」语义的冲突说明

`remark` 在产品上常表示「备注」。若当前或历史环境中 **`remark` 已被用于人工备注长文本**，则：

- 要么：**本 POC 不再使用 `remark`**，改选其它未占用列（需再查表结构）；  
- 要么：**上线前清理 / 迁移** 历史 `remark`，并取消或隐藏「自由备注」录入，使该列专用于本开关；  
- 若必须「开关 + 自由备注」并存，则**不宜**仅用裸 `remark` 存 `Y`/`N`，需另定协议（如 JSON 子段）——**超出「利用空余字段」的简化范围**，评审时取舍。

### 2.3 代码改动范围（相对「新增列」方案）

- **无需**修改表结构、**无需**扩展 `ProductionSchedulingParamBasicPO` 等新增属性（`remark` 已在映射链上）。  
- 需在 **MPS**：`ScheduleCommonService.getScheduleParamDetail`（或调用方）中 **`paramScheduling.getRemark()`** 解析为 `ScheduleParamDetail` 上的布尔/枚举；在 **MDS 前端**：生产排程弹窗将复选框与 **`remark` 的 `Y`/`N`** 绑定保存与回显。

---

## 3. 前端页面与交互变更

### 3.1 入口与页面

- **入口**：现有「生产排程」参数配置弹窗 / 页面（原型标题为「生产排程」）。  
- **布局**：在第二行，**「预齐套工序在计划开始时刻的…分钟后才可开工」** 数字输入框的**右侧**，增加复选框 **「是否考虑物料约束」**（与用户提供线框图一致）。

### 3.2 交互规则

- 勾选 / 不勾选即时参与表单；点击「确定」后与现有排程参数一并提交保存。  
- 保存成功后，下次打开「自动排程」或 `executeSchedule` 拉取的本模块参数应能回显该勾选状态。  
- **与「未齐套工序延时开工分钟数」关系**：二者同排展示，无互斥；业务上可同时配置「延时分钟数」与「是否下发最早开始时间」，具体组合含义以第 5 节实现为准（若产品希望互斥或联动，需在评审中单列规则）。

### 3.3 默认值（需产品确认）

| 方案 | 说明 |
|------|------|
| **A：默认不勾选** | 新租户/新模块参数保存时默认写入 `remark = N`；算法侧默认不传最早开始。 |
| **B：默认勾选（兼容存量）** | `remark` 为空或 `NULL` 时**视为 `Y`**（与当前「有值即传」行为对齐）；新配置可显式写 `Y`。 |

**建议在评审纪要中锁定 A 或 B**，并在接口契约中写明 **`remark` 空/`NULL`/非法值** 的语义。

---

## 4. 后端配置贯通（MDS → MPS）

### 4.1 读取路径

- `ProductionSchedulingCommand` 已通过 `mdsFeign.getByParams(ProductionSchedulingParamVO.class.getName(), { calculateModuleId })` 取得当前模块的 `ProductionSchedulingParamVO`。  
- 在 `ScheduleCommonService.getScheduleParamDetail(...)` 中，根据 **`paramScheduling.getRemark()`**（`Y`/`N` 及 5.4 默认规则）映射到 **`ScheduleParamDetail`** 上的布尔属性（建议名：`considerMaterialConstraint` 或 `passEarliestStartToAlgorithm`），供后续清空最早开始逻辑使用。

### 4.2 运行时携带

- `ProductionSchedulingCommand` 在 `baseAlgorithmData.setScheduleParamDetail(scheduleParamDetail)` 之后，`apsInputService.getApsInput(...)` 之前或之内，必须能读取到该标志。  
- **不推荐**仅依赖 DB 再次查询；以 `ScheduleParamDetail` 为单次排程运行的权威来源即可。

---

## 5. 核心逻辑：何时「传 / 不传」最早开始时间

### 5.1 当前代码中「最早开始」主要落点（实现时必须对照）

以下类名、方法名为便于开发对照的**现有实现位置**（以 `scp-foundation/scp-mps-sdk` 为主），实施时以当时代码为准：

1. **制造订单层**  
   - `BaseAlgorithmDataService#getWorkOrders`：`WorkOrderData.setEarliestBeginTime(workOrder.getEarliestStartTime())`。  
2. **工序层**  
   - `BaseAlgorithmDataService#getOperations`：先 `sdsFeign.calculateStaticEarliestStartTime(allOperations)`，再在 `getOperationData` 中 `operationData.setEarliestBeginTime(operation.getEarliestStartTime())`（非空时）。  
3. **转为 APS 对象**  
   - `ApsInputService#getWorkOrderVec`：`WorkOrder.setEarliestBeginTime(...)`（非空时）。  
   - `ApsInputService#getOperation`：`Operation.setEarliestStart(...)`（`operationData.getEarliestBeginTime()` 非空时）。  
   - `ApsInputService#getOperationVec`：对每单**第一道父工序**会用制造订单的 `earliestBeginTime` 覆盖该工序的 `operationData.setEarliestBeginTime(...)`。

### 5.2 推荐实现策略（满足「不传」语义）

在**已进入 `BaseAlgorithmData` 之后、调用 `ApsInputService.getApsInput` 之前**，根据 `ScheduleParamDetail` 中的开关执行一次**规范化**（单独私有方法，便于单测）。

**默认口径（与第 1.4 节一致）：整包清空**

- **当开关为「不勾选 / 不传」**：  
  - 遍历 `baseAlgorithmData.getWorkOrders()`，将 `earliestBeginTime` 置为 `null`；同步处理 `topWorkOrderList` 内子项的 `earliestBeginTime`（若存在）。  
  - 遍历 `baseAlgorithmData.getOperations()`，将每条 `OperationData` 的 `earliestBeginTime` 置为 `null`（`latestEndTime` 等不在本需求范围内，**勿动**）。  
  - 上述集合即**本趟算法输入中的全部**订单与工序（含非筛选项命中的上下文工序），**不是**仅 `needScheduleOperationIds`。  
- **当开关为「勾选 / 传」**：  
  - 不做上述清空，保持现有组装结果。

这样 `ApsInputService` 内原有「非 null 才 set」逻辑自然生效，**无需**在 APS 层大量分支，且与「落盘 operation.json」等调试文件行为一致（不勾选时 JSON 中最早开始相关字段应为空或省略）。

**可选口径**：仅对 `baseAlgorithmData.getNeedScheduleOperationIds()` 及其子工序清空最早开始，其余工序保留——见 **1.4**，需产品确认后再改 5.2 实现描述。

### 5.3 其它排程入口

| 入口 | 建议 |
|------|------|
| **自动排程** `ProductionSchedulingCommand` | 必须接入本开关（本需求主路径）。 |
| **手工排程** `HandworkScheduleServiceImpl` | `getScheduleParamDetail(..., null, ...)` 时 `ProductionSchedulingParamVO` 可能为 null。建议：**手工排程默认「传」**（与历史行为一致），或在手工参数中另配开关；至少在本文档中写明一致策略并在评审确认。 |

### 5.4 `remark` 空值、非法值与默认值

- **`remark` 为 `NULL`、空串、或经 trim 后非 `Y` 且非 `N`**（含历史长文本备注）：建议 **一律视为「勾选 / 传」**（等价 `Y`），与升级前行为一致，降低回归风险。  
- 若产品坚持 POC 默认「不传」，则改为 **空/`NULL` 视为 `N`**，并需 **批量 UPDATE** 将存量行刷为 `Y` 以免误伤，且前端新建默认写入 `Y` 直至用户改为不勾选。  
- **非法值**（如误写 `YES`）：建议在实现中记 WARN 日志后按上条「默认视为 `Y`」处理，除非产品要求严格失败提示。

---

## 6. 与算法包 / conf 的关系

- 本需求**不修改** APS `conf.json` 模块结构；仅改变 **input 侧** `WorkOrder` / `Operation` 上时间字段是否赋值。  
- 若算法包内部对「缺失 earliest」与「存在 earliest」分支有独立逻辑，需在联调阶段用同一套数据分别跑勾选/不勾选两次，对比排程结果差异是否符合预期。

---

## 7. 测试要点（验收清单）

1. **MDS 保存**：勾选/不勾选保存后，**`mds_par_production_scheduling_param.remark`** 为 `Y` 或 `N`；重新打开页面回显正确。  
2. **自动排程**：同一数据下，勾选时算法输入（或 `input/operation.json`、序列化后的 workOrders）含最早开始相关字段；不勾选时不含或均为 null。  
3. **回归**：不勾选时排程可正常跑完；勾选时与改造前（默认传）结果可对比（允许因数据或随机性略有差异，但不应抛 NPE）。  
4. **兼容性**：历史数据 `remark` 为 `NULL`、空或非 `Y`/`N` 时行为符合 5.4 约定。

---

## 8. 风险与待决

| 项 | 说明 |
|----|------|
| 文案与真实业务含义 | 「物料约束」与实现「最早开始不下发」需在对外说明或帮助文案中写清，避免用户误解为关闭 MRP/齐套计算。 |
| 手工排程 | 见 5.3，需产品定默认策略。 |
| 默认值 A/B | 见 3.3、5.4，影响存量 `remark` 与非法值语义。 |
| **`remark` 复用** | 与「自由备注」互斥风险见 **2.2**；实施前建议抽样库内 `remark` 现网取值。 |

---

## 9. 文档与后续流转

- 评审通过后，可由本方案衍生 PRD 条目（若走产品流程）或直接拆开发任务：MDS 前端弹窗（`remark`=`Y`/`N`）→ `ScheduleCommonService` 解析 `remark` → `ScheduleParamDetail` → `ProductionSchedulingCommand` 清空逻辑 → 联调（**无 DB 加列**）。  
- 本文件路径：`产品设计/产品需求/汇川POC/R3_MPS生产排程_是否考虑物料约束与最早开始时间_设计方案.md`。
