# 目录结构与放置规则

本文件是 `remote-list-page-directory` 的目录结构与放置规则。先读它，再执行 SKILL.md 的 Workflow。

## 固定目录项

每个页面（业务模块）固定包含 7 项，结构一致：

```
index.vue、addOrEdit、apis、components、config、enum、utils
```

> `addOrEdit` 是表单页目录，**目录名固定**，但**内部文件名不固定**——新增/修改/详情可拆可合；且可在基础结构上**递归嵌套 `addOrEdit`**。

## 目录结构

```
src/pages/<业务模块>/
├── index.vue                     # 列表页
├── addOrEdit/                    # 新增 / 修改 / 详情 表单页目录（目录名固定）
│   ├── <新增/修改/详情>.vue       # 内部文件可拆可合（见放置规则）
│   ├── addOrEdit/                # 递归嵌套：表单页里还有表单页（可选）
│   │   ├── <新增/修改/详情>.vue
│   │   ├── apis/
│   │   ├── components/
│   │   ├── config/
│   │   ├── enum/
│   │   └── utils/
│   ├── apis/                     # 仅本页独立使用
│   ├── components/               # 仅本页独立使用
│   ├── config/                   # 仅本页独立使用
│   ├── enum/                     # 仅本页独立使用
│   └── utils/                    # 仅本页独立使用
├── apis/                         # 业务块共用
├── components/                   # 业务块共用
├── config/                       # 业务块共用
├── enum/                         # 业务块共用
└── utils/                        # 业务块共用
```

## 结论判定边界

本目录规范只约束页面目录组织与文件归属，不规定产品信息架构或必须存在的 UI 控件。特别是：

- 页面是否需要 Tab、Tab 的数量、名称及状态分类，必须有明确产品需求、交互稿或现有契约依据。
- 不能因为页面是“列表页”就推断必须增加 Tab；没有证据时应判定为“无需修改”，最多记录为“待需求确认的可选建议”。
- 新增 Tab 可能改变默认查询、状态筛选和用户操作路径，不能作为纯目录规范整改直接实施。

## 放置规则

1. **新增 / 修改 / 详情都在 `addOrEdit` 表单页目录里**，列表页只保留 `index.vue`。
2. **表单页目录内文件可拆可合**，不一定叫 `addOrEdit.vue`：
   - **在一起**：一个文件承载三个模式（如 `addOrEdit.vue`，靠 `mode` 区分）
   - **三个独立**：`add.vue` / `edit.vue` / `detail.vue` 各一个文件
   - **某两在一起**：任意组合，如 `addOrEdit.vue`（新增+修改）+ `detail.vue`、`add.vue` + `editOrDetail.vue`
3. **`addOrEdit` 内部同样可以堆 `apis` / `components` / `config` / `enum` / `utils`**，放的是仅本页独立使用的内容。
4. **递归**：如果新增/修改/详情页内还有嵌套的新增/修改/详情，就继续往下一层加同样的结构——在基础结构（`apis` / `components` / `config` / `enum` / `utils`）上，**还可能再穿插一层 `addOrEdit`**（内层同样可再套，逐层递归）。
5. **共用放外层，独立放当前**：
   - 当前业务块（列表页 + 表单页）共用的 `components` / `config` / `enum` / `utils` → 放到上级**外层**目录
   - 只被当前页面（如 `addOrEdit`）独立使用的 → 放到**当前**目录里面
