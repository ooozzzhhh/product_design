> **文档说明**：本文件汇总 SDS 供应汇总功能优化需求（时间戳 20260306152225）的全部测试用例，来源为 PRD 第 4.1.7、4.2.7、4.3.7 节。
>
> - **PRD 文档**：`产品设计/产品PRD/SDS/SDS_供应汇总功能优化/20260306152225/PRD.md`
> - **问题分析报告**：`产品设计/产品问题分析/SDS/SDS_BUG_2026-03-06_01/问题分析报告.md`
> - **创建时间**：2026-03-06（时间戳 20260306152225）

---

# SDS 供应汇总功能优化 — 测试用例汇总

## 用例编号规则

`SDS-U[子模块号]-[序号]`

| 子模块 | 编号前缀 | 对应 PRD 节 |
|--------|----------|-------------|
| 4.1 供应来源可扩展机制 | SDS-U41-xx | 4.1.7 |
| 4.2 表格列元数据接口 | SDS-U42-xx | 4.2.7 |
| 4.3 输入校验与异常处理规范化 | SDS-U43-xx | 4.3.7 |

---

## 一、4.1 供应来源可扩展机制

### 1.1 正向用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U41-01 | 计划供应分类查询包含通用表数据 | `sds_supply_universal` 中存在 `supply_version_id=V1`、`order_flag='NO'`、`item_code='A001'`、`stock_point_code='WH01'`、`supply_date='2026-04-01'`、`quantity=100` 的记录 | 以供应版本 V1、分类「计划供应」调用 `/supplySummary/page` | 响应 `list` 中包含 `itemCode='A001'`、`stockPointCode='WH01'` 的行，且 `supplyQuantityMap` 中 `2026-04-01` 的值包含 100（汇总后可与其他来源叠加）；不出现接口错误 |
| SDS-U41-02 | 非计划供应分类查询包含通用表数据 | `sds_supply_universal` 中存在 `order_flag='YES'`、`item_code='B001'`、`supply_date='2026-04-01'`、`quantity=50` 的记录 | 以「非计划供应」分类调用 `/supplySummary/page` | 响应 `list` 中包含 `itemCode='B001'` 的行，`supplyQuantityMap` 中 `2026-04-01` 的值包含 50 |
| SDS-U41-03 | 全部分类查询同时包含通用表与原有 5 类来源数据 | `sds_supply_universal` 中存在 `order_flag='NO'` 与 `order_flag='YES'` 的数据；原有 5 张供应表中存在同供应版本的数据 | 以「全部」分类调用 `/supplySummary/page` | 响应 `list` 中同时出现通用表数据行与来自原有 5 张供应表的数据行，数据不丢失、不重复 |
| SDS-U41-04 | SupplyTypeEnum 新增 UNIVERSAL 枚举后正常加载 | 代码已完成改造，UNIVERSAL 枚举值已定义 | 启动服务，调用 `/supplySummary/page` 接口 | 服务正常启动，接口正常返回，枚举加载无报错 |

### 1.2 逆向 / 异常用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U41-05 | 通用表为空时查询不影响结果 | `sds_supply_universal` 为空表（无任何记录）；原有 5 张供应表存在数据 | 以任意分类调用 `/supplySummary/page` | 响应结果与通用表改造前完全一致，不多不少，接口无报错 |
| SDS-U41-06 | 通用表中 supply_type 不在 SupplyTypeEnum 中的数据不导致崩溃 | `sds_supply_universal` 存在 `supply_type='UNKNOWN_TYPE'` 的记录 | 调用 `/supplySummary/page` | 该记录正常参与 UNION ALL 查询并出现在结果中（supply_type 字段随数据返回），服务不崩溃 |

### 1.3 回归用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U41-07 | 原有采购订单数据查询结果不变（回归） | 改造前已记录采购订单来源的查询快照（list 条目数、各物料汇总数量）；`sds_supply_universal` 为空 | 以相同供应版本、「计划供应」分类查询，对比改造前快照 | list 条目数与各物料汇总数量与改造前快照完全一致 |
| SDS-U41-08 | 原有生产订单、调拨订单、期初库存、预测库存数据回归 | 同 SDS-U41-07，覆盖另外 4 张来源表 | 以相同供应版本分别以「计划供应」「非计划供应」「全部」分类查询，对比改造前快照 | 所有分类下，来自原有 4 张供应表的数据与改造前快照一致，无静默丢失 |
| SDS-U41-09 | getTableNames() 三个分类均包含通用表（单元级验证） | 代码改造完成 | 通过单元测试或断点验证，调用 `getTableNames(SupplyCategoryEnum.PLAN_SUPPLY)`、`getTableNames(SupplyCategoryEnum.NON_PLAN_SUPPLY)`、`getTableNames(SupplyCategoryEnum.ALL)` | 三个方法返回的表名列表中均包含 `sds_supply_universal` |

---

## 二、4.2 表格列元数据接口

### 2.1 正向用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U42-01 | 选择 2 个维度时 columns 顺序与选择顺序一致 | MDS 时段已配置，存在有效供应数据 | 以 `groupByParam=item_code,stock_point_code` 调用 `/supplySummary/page` | 响应 `columns[0]` 为 `{key:"itemCode", label:"物品代码", type:"DIMENSION", order:0}`，`columns[1]` 为 `{key:"stockPointCode", label:"库存点代码", type:"DIMENSION", order:1}` |
| SDS-U42-02 | 维度列排在时间列之前 | 同 SDS-U42-01，MDS 返回 3 个时段（2026-04-01、2026-05-01、2026-06-01） | 以 `groupByParam=item_code,stock_point_code` 调用 `/supplySummary/page` | `columns` 中前 2 项 `type=DIMENSION`，后 3 项 `type=TIME`；`order` 值为 0、1、2、3、4，连续递增无跳号 |
| SDS-U42-03 | 时间列 key 与 label 均等于 periodStart 字符串 | MDS 返回时段 `periodStart='2026-04-01'` | 调用 `/supplySummary/page` | `columns` 中时间列 `key='2026-04-01'`、`label='2026-04-01'`、`type='TIME'` |
| SDS-U42-04 | 切换维度组合后 columns 随之变化 | 存在有效数据 | 先以 `groupByParam=item_code` 查询，再以 `groupByParam=item_code,product_series_code` 查询 | 第一次返回 1 个维度列；第二次返回 2 个维度列，新增 `{key:"productSeriesCode", label:"产品系列代码", type:"DIMENSION", order:1}`；时间列 `order` 随维度列数量顺延 |
| SDS-U42-05 | groupByParam 为空时 columns 包含全部维度列 | `dimensionDropdown()` 返回 8 个维度字段；MDS 时段正常 | 以 `groupByParam=''`（或不传）调用 `/supplySummary/page` | `columns` 中 `DIMENSION` 类型列数量 = `dimensionDropdown()` 返回的维度数量，顺序与 `initDimensionList()` 中的顺序一致 |
| SDS-U42-06 | columns 中维度列 key 为 camelCase 格式 | 存在有效数据 | 以 `groupByParam=item_code,stock_point_code,product_series_code` 调用 `/supplySummary/page` | `columns` 中 3 个维度列的 `key` 分别为 `itemCode`、`stockPointCode`、`productSeriesCode`（无下划线） |
| SDS-U42-07 | columns 中 DIMENSION 的 key 与 list 中 VO 字段名对应 | 存在有效数据 | 调用 `/supplySummary/page`，取响应中 `columns` 的 `key` 字段 | 对于每个 `type=DIMENSION` 的列，`list[0]` 中存在与 `key` 同名的字段，且字段有值 |

### 2.2 逆向 / 异常用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U42-08 | MDS 时段列表为空时 columns 只含维度列 | MDS feign 接口返回空时段列表 | 调用 `/supplySummary/page` | 响应 `columns` 中只含 `DIMENSION` 类型列，无 `TIME` 类型列；`list` 正常返回（可为空）；接口不报错 |
| SDS-U42-09 | groupByParam 含非映射表字段时 columns 中该列 label 降级为原始字段名并记录 warn 日志 | 白名单校验已通过（仅此用例场景，实际生产中此分支不应出现；用于验证 4.2.5.1 降级逻辑） | 手动绕过白名单，传入 `groupByParam=unknown_field` | `columns` 中出现 `{key:"unknownField", label:"unknown_field", type:"DIMENSION"}`；服务不崩溃；warn 日志中有 `未找到字段映射` 相关记录 |

### 2.3 回归用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U42-10 | list 与 total 字段与改造前完全一致（回归） | 改造前已记录同参数下的 list 快照与 total 值 | 以相同参数调用改造后接口 | 响应中 `list` 内容、`total` 值与改造前快照完全一致；`columns` 为新增字段，不影响原有字段 |
| SDS-U42-11 | 前端不感知 columns 字段时不报错（向后兼容） | 存在未升级的前端调用方（只解析 list/total） | 前端以旧版方式解析响应（忽略 columns） | 前端正常渲染数据，不出现 JSON 解析报错；接口不返回 4xx/5xx |

---

## 三、4.3 输入校验与异常处理规范化

### 3.1 正向用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-01 | 合法 groupByParam 正常查询不被白名单拦截 | `groupByParam` 中所有字段均在 `dimensionDropdown()` 合法字段集内 | 以 `groupByParam=item_code,stock_point_code` 调用 `/supplySummary/page` | 查询正常执行，返回有效数据，无 SDS003 错误 |
| SDS-U43-02 | 维度下拉列表「订单标识」仅出现一次（Bug A 修复） | `information_schema` 查询结果中 `order_flag` 字段已存在于供应表字段集 | 调用 `/supplySummary/dimensionDropdown` | 响应列表中「订单标识」（对应字段 `order_flag`）只出现 1 次，不重复 |
| SDS-U43-03 | 有效枚举 code 的 translate() 正常返回 label（Bug B 正向） | 数据库中存在枚举 code 在 `SupplyTypeEnum` 中有对应值的记录 | 调用 `/supplySummary/page`，列表中存在枚举类型字段 | 枚举字段显示对应中文 label（如「采购订单」），不显示 code，服务不崩溃 |
| SDS-U43-04 | SDS001 文案符合规范（时段缺失场景） | 时段配置缺失 | 触发时段配置缺失场景（如清空 MDS 时段配置），调用 `/supplySummary/page` | 前端弹窗显示「尚未配置『时段』，请前往『时段设置』完成配置后重试。」；无任何技术堆栈信息；HTTP 状态码 200，业务 code 为错误码 |
| SDS-U43-05 | SDS002 文案符合规范（非法供应类型） | 接口层可手动传参 | 通过 Postman 传入 `supplyCategory=INVALID_TYPE` 调用 `/supplySummary/page` | 前端收到「『供应类型』参数不合法，请刷新页面后重新选择。」；无技术堆栈 |
| SDS-U43-06 | SDS003 文案符合规范（groupByParam 含非法字段） | 接口层可手动传参 | 通过 Postman 传入 `groupByParam=item_code,1_illegal_field` 调用 `/supplySummary/page` | 前端收到「『聚合维度』包含不合法字段，请重新选择聚合维度后查询。」；无 SQL 片段、无 `BadSqlGrammarException` 信息 |

### 3.2 逆向 / 异常用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-07 | groupByParam 包含 SQL 注入字符串时被白名单拦截 | 服务正常运行 | 通过 Postman 传入 `groupByParam=1;DROP TABLE sds_supply_universal` 调用 `/supplySummary/page` | 返回 SDS003 业务提示；SQL 未执行；服务日志有白名单拦截记录；响应体中不包含任何 SQL 内容 |
| SDS-U43-08 | groupByParam 包含空格注入时被白名单拦截 | 服务正常运行 | 通过 Postman 传入 `groupByParam=item_code, admin--` 调用 `/supplySummary/page` | 返回 SDS003 业务提示；日志中记录拦截，但无 SQL 内容泄露 |
| SDS-U43-09 | DB 异常（非白名单漏网）被捕获后不透传 SQL 信息 | 白名单已绕过（模拟极端场景），DAO 层产生 DataAccessException | Mock DAO 抛出 DataAccessException | 前端返回业务友好提示（SDS003 或 SYS_UNKNOWN）；`log.error` 中有完整堆栈；响应体无任何 SQL 内容 |
| SDS-U43-10 | translate() 枚举 code 无匹配时不崩溃（Bug B 边界修复） | 数据库中存在 `supply_type='UNKNOWN_ENUM_CODE'`、且该值不在 `SupplyTypeEnum` 中的记录 | 调用 `/supplySummary/page`，列表中包含上述记录 | 该行数据正常返回，枚举字段显示原始 code 值 `UNKNOWN_ENUM_CODE`（降级）；服务不抛出 `IndexOutOfBoundsException`；`warn` 日志中有 `translate() 未找到匹配的枚举值` 相关记录 |
| SDS-U43-11 | groupByParam 为空字符串（`""`）不触发 SDS003 | `page()` 中空字符串走「取全部维度」分支，不走白名单校验 | 以 `groupByParam=''` 调用 `/supplySummary/page` | 不返回 SDS003 错误；查询正常执行，使用全量维度分组 |
| SDS-U43-12 | 同时传入非法 supplyCategory 和合法 groupByParam，优先返回 SDS002 | 服务正常运行 | `supplyCategory=BAD`、`groupByParam=item_code` | 返回 SDS002（供应类型校验在前），不返回 SDS003 |

### 3.3 安全与非功能用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-13 | 安全验证：响应体中不含任何 SQL 内容 | 服务正常运行 | 通过 Postman 发送任意非法 groupByParam（包括 SQL 注入字符串、特殊符号等），调用 `/supplySummary/page` | 响应 body 中任何字段均不包含 SQL 关键词（SELECT、WHERE、FROM、DROP、TABLE 等） |
| SDS-U43-14 | 安全验证：日志中有完整 SQL 异常堆栈（用于排查） | 已配置日志级别 ERROR 输出 | 触发 DB 异常捕获分支 | 日志文件中有包含完整堆栈的 `log.error` 记录，可追溯根因 |
| SDS-U43-15 | i18n 英文环境下 SDS001～SDS003 返回英文文案 | 请求 header 中 `Accept-Language: en-US` | 分别触发 SDS001、SDS002、SDS003 三个错误 | 返回对应英文文案（见 PRD 4.3.5.1），无中文混杂 |

### 3.4 回归用例

| 编号 | 名称 | 前置条件 | 触发步骤 | 预期结果 |
|------|------|----------|----------|----------|
| SDS-U43-16 | 正常查询（合法参数）功能不受白名单改动影响（回归） | 存在有效供应数据；时段已配置 | 以常规合法参数（`supplyCategory=PLAN`、合法 `groupByParam`）调用 `/supplySummary/page` | 查询结果与改造前一致；响应时间无明显劣化（白名单校验新增耗时 < 10ms） |
| SDS-U43-17 | 维度下拉接口整体功能不受 Bug A 修复影响（回归） | 存在有效维度配置 | 调用 `/supplySummary/dimensionDropdown` | 返回的维度列表包含全部合法维度字段，无字段缺失，「订单标识」不重复 |
| SDS-U43-18 | 原有 BusinessException 触发路径（时段缺失、供应类型错误）正常触发（回归） | 分别制造「时段缺失」和「非法供应类型」场景 | 分别触发两个场景 | 均正常抛出对应 BusinessException，返回 SDS001/SDS002，无功能回退 |

---

## 四、用例统计

| 子模块 | 正向 | 逆向/异常 | 安全与非功能 | 回归 | 合计 |
|--------|------|-----------|--------------|------|------|
| 4.1 供应来源可扩展机制 | 4 | 2 | — | 3 | 9 |
| 4.2 表格列元数据接口 | 7 | 2 | — | 2 | 11 |
| 4.3 输入校验与异常处理规范化 | 6 | 6 | 3 | 3 | 18 |
| **合计** | **17** | **10** | **3** | **8** | **38** |
