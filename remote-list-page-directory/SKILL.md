---
name: remote-list-page-directory
description: Use when 在 src/pages/ 下新建或改造页面/业务模块目录、组织新增/修改/详情表单页、确定 apis/components/config/enum/utils 的归属、判定共用放外层与独立放当前，确保所有页面目录结构一致。
---

# Cashier List Page Directory

Read references/directory-structure.md first.

## Workflow

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

## Response Shape

- 列出新建/改动的目录树。
- 标注每个 `apis` / `components` / `config` / `enum` / `utils` 是**共用外层**还是**独立内层**。
- 说明 addOrEdit 采用哪种文件形态（在一起 / 独立 / 某两在一起）。
- 若涉及递归嵌套，画出嵌套层级。
