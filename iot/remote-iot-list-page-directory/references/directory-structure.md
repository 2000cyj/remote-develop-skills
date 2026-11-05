# 目录结构与放置规则

本文件是 `remote-iot-list-page-directory` 的底层参考——**目录树本身**。具体执行步骤见 SKILL.md 主入口的目标速查表：
- 建新页面 → `references/01-create-new-page.md`
- 审查合规 → `references/02-audit-page-compliance.md`
- 重构 → `references/03-refactor-page.md`
- 共用 vs 独立归属判断 → `references/04-shared-vs-private.md`

## 固定目录项

每个页面（业务模块）固定包含 8 项（`index.vue` + 7 个子目录），结构一致：

```
index.vue、addOrEdit、apis、components、config、enum、utils、types
```

> `addOrEdit` 是表单页目录，**目录名固定**，但**内部文件名不固定**——新增/修改/详情可拆可合；且可在基础结构上**递归嵌套 `addOrEdit`**。

## 目录结构

```
src/views/<业务模块>/
├── index.vue                     # 列表页
├── addOrEdit/                    # 新增 / 修改 / 详情 表单页目录（目录名固定）
│   ├── <新增/修改/详情>.vue       # 内部文件可拆可合（见放置规则）
│   ├── addOrEdit/                # 递归嵌套：表单页里还有表单页（可选）
│   │   ├── <新增/修改/详情>.vue
│   │   ├── apis/
│   │   ├── components/
│   │   ├── config/
│   │   ├── enum/
│   │   ├── utils/
│   │   └── types/
│   ├── apis/                     # 仅本页独立使用
│   ├── components/               # 仅本页独立使用
│   ├── config/                   # 仅本页独立使用
│   ├── enum/                     # 仅本页独立使用
│   ├── utils/                    # 仅本页独立使用
│   └── types/                    # 仅本页独立使用
├── apis/                         # 业务块共用
├── components/                   # 业务块共用
├── config/                       # 业务块共用
├── enum/                         # 业务块共用
├── utils/                        # 业务块共用
└── types/                        # 业务块共用（type / interface 集中出口）
```

## iot-web 现状对照（迁移时看这张表）

| 本 skill 约定 | iot-web 现状 | 说明 |
|---|---|---|
| `src/views/<业务模块>/index.vue` | `src/views/device/index.vue` 等 | 一致 |
| `addOrEdit/`（新增/修改/详情） | `src/views/<模块>/widget/*.vue` | 现状叫 `widget/`，目标结构叫 `addOrEdit/`，按需迁移 |
| `apis/`（接口） | `src/api/<模块>.js`（全项目集中） | 接口集中式与就近式二选一，**同一模块内保持一致** |
| `components/`（本块私有组件） | `src/components/`（项目公共组件） | 公共组件放 `src/components/`，业务块私有组件放模块内 `components/` |
| `config/` `enum/` `utils/` `types/` | 散在页面里 | 按目标 4 提取 |
| 列表页骨架 | `useTable`（`src/composables/useTable.js`）+ `IotTable`（`src/components/IotTable.vue`） | Element Plus 表格封装 |

## 放置规则

1. **新增 / 修改 / 详情都在 `addOrEdit` 表单页目录里**，列表页只保留 `index.vue`。
2. **表单页目录内文件可拆可合**，不一定叫 `addOrEdit.vue`：
   - **在一起**：一个文件承载三个模式（如 `addOrEdit.vue`，靠 `mode` 区分）
   - **三个独立**：`add.vue` / `edit.vue` / `detail.vue` 各一个文件
   - **某两在一起**：任意组合，如 `addOrEdit.vue`（新增+修改）+ `detail.vue`、`add.vue` + `editOrDetail.vue`
3. **`addOrEdit` 内部同样可以堆 `apis` / `components` / `config` / `enum` / `utils` / `types`**，放的是仅本页独立使用的内容。
4. **递归**：如果新增/修改/详情页内还有嵌套的新增/修改/详情，就继续往下一层加同样的结构——在基础结构（`apis` / `components` / `config` / `enum` / `utils` / `types`）上，**还可能再穿插一层 `addOrEdit`**（内层同样可再套，逐层递归）。
5. **共用放外层，独立放当前**：
   - 当前业务块（列表页 + 表单页）共用的 `components` / `config` / `enum` / `utils` / `types` → 放到上级**外层**目录
   - 只被当前页面（如 `addOrEdit`）独立使用的 → 放到**当前**目录里面
6. **`utils/` 默认只能放 `index.ts`**：
   - **例外 1**：`*.composable.ts` —— 含 vue lifecycle 钩子的纯 composable（命名 `useXxx`）
   - **例外 2**：`validation.ts` —— 大块 DTO 校验对齐表（`FormRules` + `MAX` 常量 + factory，>100 行）
   - **例外 3**：`*.test.ts` —— vitest 单元测试
   - 其他工具（format / 计算 / 相关用户视图 / 事件总线非 composable 部分）一律合进 `utils/index.ts`
   - 详细判定与反模式见 `references/file-responsibilities.md`
