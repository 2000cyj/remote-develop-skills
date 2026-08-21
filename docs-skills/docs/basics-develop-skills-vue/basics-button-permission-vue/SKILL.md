---
name: basics-button-permission-vue
description: 在 cashier 微应用中应用按钮操作权限的统一规范。适用于需要确认按钮权限码命名（Insert/Check/Change/Delete）、给新增/查看/编辑/删除等按钮添加操作权限控制、改造现有按钮权限的写法与兜底逻辑、处理下拉菜单空菜单兜底、列表页操作列按权限隐藏、或按板块分级控制查看权限，确保全模块权限写法一致。
---

# Cashier Button Permission

Read references/permission-mechanism.md first.

## Workflow

1. **确认模块前缀**：优先用路由 path 对应的前缀（查 references/permission-mechanism.md 的映射表）；无路由的新页面先向后端确认菜单码，不要自己猜。
2. **盘点按钮**：把页面所有业务按钮映射到 `Insert / Check / Change / Delete` 四种操作后缀；同一操作多个入口共用一个码。
3. **引入 checkPermission 加 v-if**：业务按钮逐个加 `v-if="checkPermission('码')"`（见 references/code-patterns.md）。
4. **下拉菜单空菜单兜底**：`el-dropdown-item` 各自 `v-if` 后，若全部无权限必须隐藏触发器（计算属性聚合）。
5. **列表页操作列按权限隐藏**：config `getTableColumns({ showAction })` 条件 push 操作列 + index.vue `hasRowAction` 聚合，避免空操作栏。
6. **自检**：逐项核对 references/code-patterns.md 末尾的自检清单。

## Required Constraints

- 权限码必须与后端菜单配置**逐字一致**；前端只匹配、不生成。拿不准停下来问后端，不要猜。
- 同一操作的多个入口**共用一个码**，不要给「新增根」「新增子节点」分别造码。
- 弹窗 footer 按钮**不重复鉴权**（能打开弹窗说明已通过入口权限检查）。
- **不鉴权非业务操作**：搜索、重置、取消、关闭、分页、刷新。
- 本 skill 只负责按钮显隐，不涉及数据权限。
- 多板块分级查看权限命名 `{前缀}Check{板块}`；板块映射集中到共享文件（如 `utils/companyEventBus.ts`），避免两处漂移。
- 无 Change 权限时隐藏「保存」后表单仍可编辑属正常（能改不能存）；要求只读属表单级控制，超范围需单独提。

## Response Shape

- 列出新增/改动的权限码（模块前缀 + 操作后缀）。
- 标注需后端核对的 prefix / 模块名（"需后端核对"）。
- 说明哪些按钮做了 dropdown 兜底、操作列是否随权限隐藏。
- 给出改动文件列表与对应的权限码。
