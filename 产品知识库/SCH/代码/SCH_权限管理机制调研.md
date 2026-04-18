# SCH 权限管理机制调研

**更新时间**：2026-04-01
**调研范围**：IPS 服务（scp-ips-sdk）后端代码 + scp_ips 数据库（dev 环境）+ SCH 截图中的权限管理页面 4 个 TAB
**代码来源**：`scp-foundation/scp-ips-sdk`（默认分支）
**前端代码**：若独立前端工程不在当前工作区，未纳入本次调研范围

---

## 1. 现状概述

SCP Foundation 的权限管理统一由 **IPS 服务**（`scp-ips-service`，端口 8761）承载，数据存储于 `scp_ips` 数据库。采用 **RBAC（基于角色的访问控制）模型**，并在此基础上叠加「模块菜单过滤」、「数据行级权限」、「场景隔离」三层机制，共同构成用户最终的权限边界。

权限管理页面有 4 个 TAB，分别对应 4 种权限维度：

| TAB | 名称 | 权限粒度 | 管理对象 |
|-----|------|----------|----------|
| TAB1 | 角色菜单权限 | 菜单/控件（MENU/WIDGET）级别 | 角色 → 资源（菜单树） |
| TAB2 | 模块菜单权限 | 模块级别的菜单可见范围 | 模块代码 → 资源（菜单子集） |
| TAB3 | 规则权限 | 数据行级过滤（数据权限） | 规则/配置/映射 → 角色/用户 |
| TAB4 | 场景权限 | 排程场景数据库隔离 | 用户 → 场景 |

---

## 2. TAB1：角色菜单权限

### 2.1 业务含义

控制「某个角色」能看到哪些菜单和控件（按钮）。是最核心的权限 TAB，决定用户登录后的菜单可见性和功能按钮的启用/禁用。

### 2.2 实现机制

**核心流程**：
1. 系统管理员（SYSTEM_ADMIN）或租户管理员在此 TAB 左侧选择某个角色；
2. 右侧展示全量菜单树（`auth_rbac_resource` 中的 `resource_type=MENU` 和 `resource_type=WIDGET` 条目），勾选后写入 `auth_rbac_role_resource`；
3. 用户登录后，通过 `user → role → role_resource → resource` 链路取得该用户有权访问的菜单列表。

**关键接口**：
- `POST /role/role/resources`：为角色分配菜单资源（`roleId` + `resourceIds`，逗号分隔）
- `GET /user/resources`：取当前用户的菜单树（登录后前端调用）
- `POST /role/copyResources`：复制角色权限（将 fromRoleId 的菜单权限复制到 toRoleId）

**关键代码路径**：
- Controller：`com.yhl.scp.ips.rbac.controller.RoleController#createRoleResources`
- Service：`com.yhl.scp.ips.rbac.service.impl.RoleServiceImpl#doCreateRoleResources`
- 写入逻辑：先清除该角色原有资源绑定（`deleteByRoleId`），再批量插入新的资源绑定

**WIDGET（控件/按钮）权限细节**：
`ResourceServiceImpl#selectByUserId` 中有特殊处理：
- 先按角色取出该用户有权访问的菜单列表（`resourceDao.selectByParams`）
- 再取出这些菜单下的所有控件（`WIDGET` 类型资源）
- 对每个控件，检查其是否在角色绑定的控件列表中，若在则 `widgetAuthority=YES`，否则为 `NO`
- 前端据此控制按钮的可见/禁用状态

### 2.3 数据表

**`auth_rbac_role`**（角色表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 角色ID |
| role_name | varchar(50) | 角色名称 |
| tenant_id | varchar(500) | 所属租户ID（可逗号分隔，支持多租户） |
| valid | varchar(10) | 是否有效 |
| creator/create_time/modifier/modify_time | — | 审计字段 |

**`auth_rbac_resource`**（菜单资源表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 资源ID |
| resource_code | varchar(50) | 资源编码（唯一） |
| resource_name | varchar(50) | 资源名称（显示名） |
| url | varchar(200) | 路由地址 |
| parent_id | varchar(64) | 父级资源ID（构成树结构） |
| sort | int | 排序值 |
| icon | varchar(100) | 图标 |
| resource_type | varchar(20) | 资源类型：MENU（菜单）/ WIDGET（控件/按钮）/ BUTTON |
| module_code | varchar(20) | 所属模块代码（SCH/MPS/SOP等） |
| tenant_id | varchar(64) | 租户私有菜单时有值，系统菜单为空 |
| enabled | varchar(10) | 是否启用 |
| component_path | varchar(255) | 前端组件路径 |
| widget_type | varchar(20) | 控件类型 |

当前数据：MENU 类型 718 条，WIDGET 类型 970 条，BUTTON 类型 1 条。

**`auth_rbac_role_resource`**（角色-资源关联表）

| 字段 | 类型 | 说明 |
|------|------|------|
| role_id | varchar(64) | 角色ID |
| resource_id | varchar(64) | 资源ID |

**`auth_rbac_user_role`**（用户-角色关联表）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | varchar(64) PK | 用户ID |
| role_id | varchar(64) PK | 角色ID |

---

## 3. TAB2：模块菜单权限

### 3.1 业务含义

控制「某个模块（如 SCH）」对外暴露哪些菜单项。这是在 TAB1（角色菜单权限）之上叠加的**二次过滤**：用户必须先通过角色菜单权限拿到一批菜单，再与模块菜单权限取交集，才能看到最终的菜单。

主要用于：不同客户（租户）购买了不同模块，同一模块内也可以按模块版本/配置差异屏蔽部分功能菜单。

### 3.2 实现机制

**核心流程**：
1. 管理员选择某个 `moduleCode`（如 SCH），勾选该模块应包含的菜单；
2. 写入 `auth_rbac_module_resource`；
3. 用户调用 `GET /user/resources` 时，若非系统管理员，系统先获取当前 `moduleCode` 对应的 `moduleResourceIds`，再将角色菜单权限结果做过滤：`resources.filter(item -> moduleResouceIds.contains(item.getId()))`。

**关键接口**：
- `POST /moudle/save`：保存模块与资源的关联（`moduleCode` + `resourceIds`）
- `GET /moudle/{moduleCode}`：查询某模块包含的资源列表

**关键代码路径**：
- Controller：`com.yhl.scp.ips.rbac.controller.ModuleController`（注意路径拼写为 `moudle`，疑似笔误）
- Service：`com.yhl.scp.ips.rbac.service.impl.ModuleServiceImpl#doSave`
- 写入逻辑：先清除该模块原有资源绑定（`deleteByModuleCode`），再批量写入

**与 TAB1 的关系（AND 逻辑）**：
```
用户最终可见菜单 = 角色菜单权限结果 ∩ 模块菜单权限结果
```
系统管理员（SYSTEM_ADMIN）跳过模块菜单过滤，直接返回全量菜单。

### 3.3 数据表

**`auth_rbac_module_resource`**（模块-资源关联表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 记录ID |
| module_code | varchar(50) | 模块代码（SCH/MPS/SOP等） |
| resource_id | varchar(64) | 资源ID，关联 auth_rbac_resource.id |

---

## 4. TAB3：规则权限（数据行级权限）

### 4.1 业务含义

控制用户在某个菜单/对象下能看到哪些**数据行**。例如：某用户只能看到自己创建的工单，或只能看到本部门的数据。是数据粒度的权限控制，与 TAB1 的菜单粒度互补。

### 4.2 实现机制

**整体架构（4 层）**：

```
规则（auth_rbac_data_permission_rule）
  ↓ 规则定义 SQL 条件模板
配置（auth_rbac_data_permission_config）
  ↓ 配置：哪个模块/对象类型/权限类型 + SQL/JSON条件模板
关联（auth_rbac_data_permission_relation）
  ↓ 关联：某配置授权给哪些用户/角色（granularity_type = USER/ROLE）
明细（auth_rbac_data_permission_detail）
  ↓ 明细：配置中的动态参数值（position_index + data_type + data_range）
```

**规则层（`auth_rbac_data_permission_rule`）**：
内置 4 条基础规则（dev 环境实际数据）：

| ID | 规则名称 | auth_sql |
|----|---------|----------|
| 1 | 所有数据 | null（不加任何过滤） |
| 2 | 仅本人创建的数据 | `creator = ${userId}` |
| 3 | 仅本部门创建的数据 | 子查询过滤同部门用户创建的记录 |
| 4 | 仅本角色创建的数据 | 子查询过滤同角色用户创建的记录 |

**配置层（`auth_rbac_data_permission_config`）**：

| 字段 | 说明 |
|------|------|
| module_code | 所属模块 |
| object_category | 对象分类（如 DPS） |
| object_type | 具体对象/视图名（如 `v_dps_ord_customer_order`） |
| permission_type | 权限类型（READ/WRITE 等） |
| sql_criteria_pattern | SQL 过滤条件模板 |
| json_criteria_pattern | JSON 格式条件模板 |

**关联层（`auth_rbac_data_permission_relation`）**：
- `granularity_type`：授权粒度，当前实际数据中出现了 `USER` 和 `ROLE` 两种
- `granularity_value`：对应用户ID 或 角色ID

**映射层（`auth_rbac_data_permission_mapper`）**：
将数据权限规则（`data_permission_rule_id`）与某个具名映射（`mapper_code`）关联，供代码中按 mapperCode 查找规则。

**刷新机制**：
每次新增/修改/删除数据权限规则时，Controller 会调用 `notificationService.dataPermissionRefresh()` 通知各服务刷新数据权限缓存。

**关键接口**：
- `GET /dataPermissionRule/page`：分页查询规则
- `POST /dataPermissionRule/create`：新增规则（保存后触发 refresh）
- `POST /dataPermissionConfig/create`：新增配置（含 SQL 注入校验）
- `GET /dataPermissionConfig/detail/{id}`：查询配置详情

### 4.3 数据表汇总

**`auth_rbac_data_permission_rule`**（规则表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 规则ID |
| rule_name | varchar(100) | 规则名称 |
| auth_sql | varchar(1000) | SQL 条件模板（含 ${userId} 等占位符） |
| remark | varchar(255) | 备注 |
| enabled | varchar(10) | 是否启用 |

**`auth_rbac_data_permission_config`**（配置表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 配置ID |
| name | varchar(50) | 配置名称 |
| module_code | varchar(50) | 模块代码 |
| object_category | varchar(50) | 对象分类 |
| object_type | varchar(50) | 对象类型/表名 |
| permission_type | varchar(50) | 权限类型（READ/WRITE等） |
| sql_criteria_pattern | varchar(500) | SQL 条件模板 |
| json_criteria_pattern | varchar(500) | JSON 条件模板 |

**`auth_rbac_data_permission_relation`**（授权关联表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 关联ID |
| config_id | varchar(64) | 关联 config 表 |
| granularity_type | varchar(30) | 授权粒度：USER / ROLE |
| granularity_value | varchar(64) | 用户ID 或 角色ID |

**`auth_rbac_data_permission_detail`**（条件明细表）

| 字段 | 类型 | 说明 |
|------|------|------|
| config_id | varchar(64) | 关联 config 表 |
| position_index | int | 占位符位置索引 |
| data_type | varchar(30) | 数据类型 |
| data_range | varchar(1000) | 可选值范围（JSON） |

**`auth_rbac_data_permission_mapper`**（映射表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 映射ID |
| mapper_code | varchar(50) | 映射编码（代码中按此查找规则） |
| mapper_name | varchar(100) | 映射名称 |
| data_permission_rule_id | varchar(64) | 关联规则表 |

**`auth_rbac_data_row_permission`**（行级权限表，较新）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 权限ID |
| permission_type | varchar(32) | 权限类型 |
| permission_module_code | varchar(64) | 模块代码（有索引） |
| permission_resource_id | varchar(64) | 关联资源ID |
| permission_role_json | varchar(1024) | 角色JSON（按角色存储权限信息） |

---

## 5. TAB4：场景权限

### 5.1 业务含义

SCH 等模块采用「场景（Scenario）」机制隔离不同的计划数据库，每个场景对应一个独立的数据库实例（`data_base_name` 字段）。场景权限控制「某用户能访问哪些场景」，即控制用户在模块内的**数据范围**（而非功能范围）。

典型用例：同一租户下有「主场景（master=YES）」和多个「子场景（master=NO）」，不同用户被授权访问不同场景，彼此数据互不干扰。

### 5.2 实现机制

**核心流程**：
1. 在 TAB4 中，管理员选择某用户，再勾选该用户可访问的场景列表；
2. 写入 `auth_rbac_user_scenario`（user_id + scenario_id）；
3. 用户登录后访问模块时，`ScenarioController#scenarios` 接口通过 `scenarioService.selectByTenantIdAndUserId` 返回该用户有权访问的场景列表；
4. 用户选择某个场景后，请求头中会携带 `scenario` 标识，后端据此动态切换数据源（指向对应场景的数据库）。

**`UserController#tenantModules` 中的重要逻辑**：
```
// 返回有场景权限的模块（用户只能看到自己有场景权限的模块）
Set<String> userModules = userService.selectScenarioByUser(userId)
    .stream().map(item -> item.getModuleCode()).distinct().collect(Collectors.toSet());
```
即：若用户没有被分配任何 SCH 场景，则用户看不到 SCH 模块入口。

**关键接口**：
- `GET /user/pageUserScenario`：分页查询各用户的场景权限分配情况
- `POST /user/updateUserScenario`：更新用户场景权限（user.scenarioIds + moduleCode）
- `POST /scenario/scenarios`：获取当前用户有权访问的场景下拉列表
- `POST /scenario/scenarioSelect`：选中某场景（返回 response header 中的 scenario 标识）

**关键代码路径**：
- `com.yhl.scp.ips.rbac.service.impl.UserServiceImpl#doUpdateUserScenario`：先清空该用户在该 moduleCode 下的场景绑定，再批量插入新的绑定（支持去重）
- `com.yhl.scp.ips.rbac.dao.UserScenarioDao`：`deleteByUserIdAndModuleCode` + `insertBatch`

### 5.3 数据表

**`auth_scenario`**（场景表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) PK | 场景ID |
| module_code | varchar(50) | 所属模块代码（SCH/MPS等） |
| scenario_name | varchar(100) | 场景名称 |
| data_base_name | varchar(100) | 对应的业务数据库名 |
| data_base_name_doris | varchar(100) | 对应的 Doris 数据库名 |
| master | varchar(10) | 是否主场景（YES/NO） |
| tenant_id | varchar(64) | 所属租户ID |
| url / url_doris | varchar | 数据库连接地址 |
| user_name / password | varchar | 数据库连接凭证 |
| source_scenario_id | varchar(64) | 来源场景ID（克隆自哪个场景） |
| enabled | varchar(10) | 是否启用 |

当前 SCH 模块在 dev 环境有 9 个场景（1 个主场景 + 8 个子场景），均属于租户 `yhl`。

租户隔离实现：每个场景对应 `scp_sys_ams_XXXX` 格式的独立数据库（数据库名存在 `data_base_name` 字段）。

**`auth_rbac_user_scenario`**（用户-场景关联表）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | varchar(64) | 用户ID |
| scenario_id | varchar(64) | 场景ID |

---

## 6. 4 个 TAB 的组合效果分析

### 6.1 用户最终权限边界的形成

用户登录后的完整权限由 4 层叠加决定：

```
第一层：角色菜单权限（TAB1）
  → 决定用户「能看到哪些菜单/按钮」

第二层：模块菜单权限（TAB2）
  → 在第一层基础上二次过滤，决定「当前模块下的菜单可见范围」
  → 最终菜单 = TAB1结果 ∩ TAB2结果

第三层：规则权限（TAB3）
  → 在可见菜单/对象内，决定「能看到哪些数据行」
  → 通过 SQL 条件动态过滤数据查询结果

第四层：场景权限（TAB4）
  → 决定「能访问哪些数据库场景（数据集合）」
  → 若无场景权限，该模块入口对该用户不可见
```

### 6.2 优先级与继承关系

| 维度 | 规则 |
|------|------|
| TAB1 与 TAB2 的关系 | AND 逻辑（取交集），都不满足则菜单不可见 |
| TAB3 与 TAB1/TAB2 的关系 | 独立叠加，前两者控制可见性，TAB3 控制数据范围 |
| TAB4 与其他 TAB 的关系 | 前置条件，无场景则模块不可进入，其他权限无意义 |
| 系统管理员（SYSTEM_ADMIN） | 跳过 TAB2 过滤，且直接返回全量菜单（selectForSystemAdmin） |
| 租户管理员（TENANT_ADMIN） | 受 TAB1+TAB2+TAB3+TAB4 全部约束 |

### 6.3 典型权限配置场景

**场景 A：给 SCH 操作员只看「高级生产排程」模块菜单**
- TAB1：给该角色勾选「高级生产排程」相关菜单项
- TAB2：在 SCH 模块权限中配置「高级生产排程」相关菜单项为可见

**场景 B：限制某用户只看自己创建的工单数据**
- TAB3：为该用户/角色创建数据权限配置，选择「仅本人创建的数据」规则

**场景 C：让某用户只能访问测试场景，不能访问主场景**
- TAB4：给该用户只分配测试场景，不分配主场景

---

## 7. 当前实现的缺点与待补充点

### 7.1 已确认缺点

| 缺点 | 说明 |
|------|------|
| ModuleController 路径拼写错误 | 接口路径为 `/moudle`（应为 `/module`），存在拼写笔误 |
| role.tenant_id 多租户存储方式特殊 | tenant_id 字段类型 varchar(500)，以逗号分隔多个租户ID，非标准外键，查询时需特殊处理 |
| 数据权限规则当前使用率低 | dev 环境 `auth_rbac_data_permission_config` 仅有 1 条记录，TAB3 功能实际使用较少 |
| 无权限继承机制 | 角色与角色之间无父子/继承关系，只能通过「复制角色权限」实现复用 |

### 7.2 待补充（前端代码未纳入本次调研）

- 前端权限管理页面的 4 个 TAB 具体 Vue 组件路径及交互逻辑
- TAB3 在前端如何展示规则配置的交互设计
- TAB4 场景选择后前端如何传递 scenario header 的完整流程

---

## 8. 核心表关系图（文字版）

```
auth_rbac_user
  ↓ (auth_rbac_user_role)
auth_rbac_role
  ↓ (auth_rbac_role_resource)
auth_rbac_resource              ← (auth_rbac_module_resource) ← module_code
  [TAB1 菜单权限]                   [TAB2 模块菜单权限]

auth_rbac_user
  ↓ (auth_rbac_user_scenario)
auth_scenario                   → data_base_name → scp_sys_ams_XXXX 数据库
  [TAB4 场景权限]

auth_rbac_data_permission_rule
  ↓ (auth_rbac_data_permission_mapper)
auth_rbac_data_permission_config
  ↓ (auth_rbac_data_permission_relation: granularity_type=USER/ROLE)
  ↓ (auth_rbac_data_permission_detail)
  [TAB3 规则权限]
```

---

## 9. 相关服务与代码路径速查

| 内容 | 路径 |
|------|------|
| 权限管理所在服务 | `scp-ips-sdk`（IPS 服务，端口 8761） |
| 角色管理 Controller | `com.yhl.scp.ips.rbac.controller.RoleController` |
| 菜单资源 Controller | `com.yhl.scp.ips.rbac.controller.ResourceController` |
| 模块菜单权限 Controller | `com.yhl.scp.ips.rbac.controller.ModuleController` |
| 用户管理 Controller | `com.yhl.scp.ips.rbac.controller.UserController` |
| 场景管理 Controller | `com.yhl.scp.ips.rbac.controller.ScenarioController` |
| 数据权限规则 Controller | `com.yhl.scp.ips.rbac.controller.DataPermissionRuleController` |
| 数据权限配置 Controller | `com.yhl.scp.ips.rbac.controller.DataPermissionConfigController` |
| 角色Service实现 | `com.yhl.scp.ips.rbac.service.impl.RoleServiceImpl` |
| 菜单Resource Service实现 | `com.yhl.scp.ips.rbac.service.impl.ResourceServiceImpl` |
| 用户Service实现 | `com.yhl.scp.ips.rbac.service.impl.UserServiceImpl` |
| 权限数据库 | `scp_ips`（dev 环境） |
| SCH 租户数据库命名规律 | `scp_sys_ams_XXXX`（每个场景对应一个） |
