---
name: remote-list-page-directory
description: Use when 在 src/pages/ 下新建或改造页面/业务模块目录、组织新增/修改/详情表单页、确定 apis/components/config/enum/utils 的归属、判定共用放外层与独立放当前，确保所有页面目录结构一致。
---

# Cashier List Page Directory

Read references/directory-structure.md first.

## Workflow

> 历史版本对照见 `docs/beforeSkills/cashier-list-page-directory-skill.md`。

1. **建 7 项固定目录**：新建页面时先建 `index.vue`、`addOrEdit`、`apis`、`components`、`config`、`enum`、`utils`，结构一致。
2. **新增 / 修改 / 详情都放 `addOrEdit`**：列表页只保留 `index.vue`。
3. **决定 addOrEdit 内文件形态**：一个文件承载三模式（按 `mode` 区分）/ 三个独立（`add.vue` / `edit.vue` / `detail.vue`）/ 某两在一起（任意组合）。
4. **判断 apis/components/config/enum/utils 归属**：业务块共用 → 外层；仅当前页用 → addOrEdit 内层。
5. **递归**：若表单页内还有嵌套表单页，继续往里穿插 `addOrEdit`，逐层结构一致。

## Required Constraints

- **7 项目录名固定**，不另起名；不要把一个页面独立用的组件/工具放外层污染业务块。
- 列表页只保留 `index.vue`，新增/修改/详情不放外层。
- `addOrEdit` **目录名固定**，但内部文件名不固定（可拆可合）。
- **共用放外层，独立放当前**。
- 递归嵌套 `addOrEdit` 时每层结构一致（7 项可重复）。

## 规范结论与产品需求边界

- 必须区分“规范要求”“代码事实”和“产品建议”，不得把个人猜想写成规范结论。
- 只有当本 skill、项目规范、现有接口契约或明确用户需求能够证明缺失时，才能判定为“必须修改”。
- `Tab`、状态分类、筛选入口、交互改版等属于产品/UI 方案，不是列表目录规范的默认要求。未提供具体业务分类、状态映射、交互稿或用户指令时，不得臆测新增 Tab，也不得把“补充列表 Tab UI”列为规范违规或必改项。
- 对无法由规范或代码证据确认的内容，统一标为“可选建议 / 需需求确认”，并说明缺少的依据；不得直接下发实施。
- 结论必须分为三类：`必须整改（规范违规）`、`建议优化（不影响现有流程，需需求确认）`、`无需修改（已符合规范）`。只有第一类可以作为规范整改直接下发。
- 任何可能改变业务状态、查询条件、默认值、接口参数、权限、审批/删除流程或页面信息架构的建议，必须单独标注潜在影响；在用户确认前不得实施。

## Response Shape

- 列出新建/改动的目录树。
- 标注每个 `apis` / `components` / `config` / `enum` / `utils` 是**共用外层**还是**独立内层**。
- 说明 addOrEdit 采用哪种文件形态（在一起 / 独立 / 某两在一起）。
- 若涉及递归嵌套，画出嵌套层级。
