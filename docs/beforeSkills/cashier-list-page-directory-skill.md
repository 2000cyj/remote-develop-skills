# Cashier 列表页目录结构 skill

## 用途

cashier 微应用「列表页目录结构」的统一标准。当在 `src/pages/` 下**新建页面 / 业务模块**，或**改造现有页面目录**时，按本 skill 组织目录，确保所有页面目录结构一致。

> 本文件是 cashier 列表页目录结构的**唯一标准**。新建 / 改造页面目录一律以本文为准。

---

## 触发条件

用户说以下任意一项时触发：

- "新建 XXX 模块 / 页面"
- "给 XXX 加列表页 / 管理页 / 表单页"
- "新建 / 改造页面目录结构"
- 涉及 `src/pages/` 下新增目录、拆分文件、挪动 apis/components/config/enum/utils 时
- 或类似表达，需要确定文件放哪个目录

---

## 固定目录项（先理解再动手）

每个页面（业务模块）固定包含 7 项，结构一致：

```
index.vue、addOrEdit、apis、components、config、enum、utils
```

> `addOrEdit` 是表单页目录，**目录名固定**，但**内部文件名不固定**——新增/修改/详情可拆可合；且可在基础结构上**递归嵌套 `addOrEdit`**（见"放置规则"）。

## 目录结构

```
src/pages/<业务模块>/
├── index.vue                     # 列表页
├── addOrEdit/                    # 新增 / 修改 / 详情 表单页目录（目录名固定）
│   ├── <新增/修改/详情>.vue       # 内部文件可拆可合（见"放置规则"）
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

## 放置规则（强制）

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

## 文件职责

| 目录/文件 | 位置 | 职责 | 关键点 |
|---|---|---|---|
| `index.vue` | 外层 | 列表页 | `useListPage` + `PageVxeTable`；行权限按 `checkPermission`；路由跳 `/xxx/insert\|change\|check`，按业务唯一流水号定位 |
| `addOrEdit/*.vue` | 内层 | 新增/修改/详情 表单页 | 文件可拆可合（一个或多个）；`mode` 由路由派生或按文件区分；`DynamicForm` 分区块配置；含局部弹窗 + 附件组件 |
| `apis/index.ts` | 共用外层 / 独立内层 | 接口 | 业务主接口 + 辅助下拉接口；复用其他模块接口时注释说明 |
| `apis/type.ts` | 共用外层 / 独立内层 | 类型 | 对齐后端 DTO/VO：查询、保存、VO 类型；列表/详情共用 VO |
| `config/index.ts` | 共用外层 / 独立内层 | 列表配置 | `getSearchFormItems` 搜索项工厂 + `getTableColumns` 列工厂；下拉选项由 index.vue 异步注入 |
| `enum/index.ts` | 共用外层 / 独立内层 | 字典/枚举 | 全部 `createDictionaryEnum` 对接字典；无字典的用本地固定值兜底 |
| `utils/index.ts` | 共用外层 / 独立内层 | 展示工具 | 状态 → el-tag 映射（`getXxxStatusTagType` 等），纯函数无副作用 |
| `utils/confirm.ts` | 共用外层 / 独立内层 | 二次确认 | 一行转发 `@/common/utils/confirmDelete` |
| `components/*.vue` | 共用外层 / 独立内层 | 局部组件 | 弹窗内容**不含 el-dialog**，配合 `renderDialog` 命令式弹窗；必须暴露 `submit(): Promise<boolean>` |

> 位置判定：业务块共用 → 外层；仅当前页使用 → 当前目录内。

## 数据流

```
index.vue (列表)
  ├─ useListPage → 分页接口             ←─ apis/
  ├─ getSearchFormItems/getTableColumns ←─ config/
  ├─ 枚举/字典选项                        ←─ enum/
  ├─ el-tag 文本/颜色                    ←─ utils/
  └─ 删除确认                            ←─ utils/confirm.ts → common/confirmDelete
        │  跳转 /xxx/{insert|change|check}?id={uniqueValue}
        ▼
addOrEdit/*.vue (表单)
  ├─ 详情/新增/更新接口                   ←─ apis/
  ├─ 下拉选项（异步加载）                 ←─ apis/
  ├─ 局部弹窗 → renderDialog（命令式）    ←─ components/
  └─ 附件组件                            ←─ src/components/
```

## 设计要点

1. **主键定位约定**：列表/详情/编辑/删除全按业务唯一流水号 `uniqueValue`，不用自增 `id`。
2. **三合一表单页**：新增/修改/详情可在一个文件（按 `mode` 派生路由区分），也可拆成多个文件（`add.vue` / `edit.vue` / `detail.vue`）；表单页间可**递归嵌套 `addOrEdit`**，逐层加深。
3. **弹窗无壳模式**：局部弹窗组件不包 `el-dialog`，由 `renderDialog` 包裹，契约是暴露 `submit()` —— 命令式弹窗统一写法。
4. **列表/详情共用 VO**：一个类型两用，详情字段标 optional。
5. **配置与视图分离**：表格列/搜索项全部工厂化，操作列走 `customAction` slot，权限由页面传 `showAction`。

---

## 标准参考实现

以下页面已按本结构落地，可作为参考模板：

- 完整 7 项结构 + addOrEdit 三合一：`src/pages/store/`
- 同结构列表页：`src/pages/bankCard/`、`src/pages/employee/`、`src/pages/seal/`、`src/pages/fileExpiration/`
- 弹窗无壳模式 + renderDialog：`src/pages/store/components/ChangeInfoModal.vue`
