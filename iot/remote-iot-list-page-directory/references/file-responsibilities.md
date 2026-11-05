# 文件职责、数据流与设计要点

本文件是 `remote-iot-list-page-directory` 的底层参考——**每个文件干什么**。归属判断（共用 vs 独立）见 `references/04-shared-vs-private.md`，审查清单见 `references/02-audit-page-compliance.md`。

## 文件职责

| 目录/文件 | 位置 | 职责 | 关键点 |
|---|---|---|---|
| `index.vue` | 外层 | 列表页 | `useTable`（`src/composables/useTable.js`）+ `IotTable`（`src/components/IotTable.vue`）；路由跳 `/xxx/insert\|change\|check`，按业务唯一编码（`deviceCode` / `productCode`）定位 |
| `addOrEdit/*.vue` | 内层 | 新增/修改/详情 表单页 | 文件可拆可合（一个或多个）；`mode` 由路由派生或按文件区分；`el-form` 分区块配置；含局部弹窗 |
| `apis/index.ts` | 共用外层 / 独立内层 | 接口 | 业务主接口 + 辅助下拉接口；复用其他模块接口时注释说明 |
| `apis/type.ts` | 共用外层 / 独立内层 | 类型 | 对齐后端 DTO/VO：查询、保存、VO 类型；列表/详情共用 VO |
| `config/index.ts` | 共用外层 / 独立内层 | 列表配置 | `getSearchFormItems` 搜索项工厂 + `getTableColumns` 列工厂；下拉选项由 index.vue 异步注入 |
| `enum/index.ts` | 共用外层 / 独立内层 | 字典/枚举 | 全部 `createDictionaryEnum` 对接字典；无字典的用本地固定值兜底 |
| `utils/index.ts` | 共用外层 / 独立内层 | 展示工具 | **唯一默认允许** 的 utils/ 文件；状态 → el-tag 映射（`getXxxStatusTagType` 等），纯函数无副作用；其他工具一律合进此处 |
| **`utils/*.composable.ts`**（**例外 1**） | 共用外层 / 独立内层 | composable | 含 vue lifecycle 钩子（`onBeforeUnmount` / `onMounted` / `watch` / `ref` / 跨路由事件总线等）的**纯 composable**。命名带 `useXxx` 前缀。例：`companyEventBus.ts` 含 `useCompanyViewTab` + `emitCompanyViewTab`，**因后者含 `onBeforeUnmount` 钩子属例外 1** |
| **`utils/validation.ts`**（**例外 2**） | 共用外层 / 独立内层 | DTO 校验对齐表 | 大块 DTO 校验对齐：`FormRules` 对象 + `MAX` 常量（如 `BANK_CARD_ACCOUNT_NUMBER_MAX`）+ `requiredNotBlank` factory 函数，**总行数 >100 行才算"大块"**。例：`bankCard/utils/validation.ts`（158 行）、`businessScope/utils/validation.ts`（95 行）。小块校验直接合进 `utils/index.ts` |
| **`utils/*.test.ts`**（**例外 3**） | 共用外层 / 独立内层 | 单元测试 | vitest 单元测试。与 `utils/index.ts` 同目录就近放，便于 mock 与重构同步。不计 utils/ 文件数限制 |
| **`addOrEdit/config/index.ts`**（**内层**） | `addOrEdit/config/` | 表单配置 + 描述项 + 组件 rules 工厂 | 表单项数组 / 校验规则 / 描述项 items + **组件 rules 工厂**（`getXxxFormRules(ctx)`：抽 `addOrEdit/components/*.vue` 的 `rules`，依赖 props 传入 ctx）。**样式类名（UnoCSS 原子类）不在本 skill 管辖范围**——模板里怎么写类名按 `iot-web/STYLE_GUIDE.md`。 |
| **不推荐 `utils/confirm.ts`** | ~~共用外层 / 独立内层~~ | ~~二次确认~~ | **已取消**：调用方直接用 `ElMessageBox.confirm`（或 `src/utils/` 里的公共封装），去除无业务价值的一行转发中间层 |
| `components/*.vue` | 共用外层 / 独立内层 | 局部组件 | 弹窗内容**不含 el-dialog**，由调用方用 `el-dialog` 命令式包裹；必须暴露 `submit(): Promise<boolean>` |

> 位置判定：业务块共用 → 外层；仅当前页使用 → 当前目录内。

## 数据流

```
index.vue (列表)
  ├─ useTable → 分页接口                ←─ apis/
  ├─ getSearchFormItems/getTableColumns ←─ config/
  ├─ 枚举/字典选项                        ←─ enum/
  ├─ el-tag 文本/颜色                    ←─ utils/
  └─ 删除确认                            ←─ `ElMessageBox.confirm` / `src/utils/` 公共封装
        │  跳转 /xxx/{insert|change|check}?code={业务唯一编码}
        ▼
addOrEdit/*.vue (表单)
  ├─ 详情/新增/更新接口                   ←─ apis/
  ├─ 下拉选项（异步加载）                 ←─ apis/
  ├─ 局部弹窗 → el-dialog（命令式）     ←─ components/
  └─ 附件组件                            ←─ src/components/
```

## 设计要点

1. **主键定位约定**：列表/详情/编辑/删除全按业务唯一编码（`deviceCode` / `productCode` / `protocolKey` 等），不用自增 `id`。
2. **三合一表单页**：新增/修改/详情可在一个文件（按 `mode` 派生路由区分），也可拆成多个文件（`add.vue` / `edit.vue` / `detail.vue`）；表单页间可**递归嵌套 `addOrEdit`**，逐层加深。
3. **弹窗无壳模式**：局部弹窗组件不包 `el-dialog`，由调用方的 `el-dialog` 命令式包裹，契约是暴露 `submit()`。
4. **列表/详情共用 VO**：一个类型两用，详情字段标 optional。
5. **配置与视图分离**：表格列/搜索项全部工厂化，操作列走 `customAction` slot。
6. **`utils/` 默认只能放 `index.ts`**：例外仅 3 个（composable / 大块 validation / `.test.ts`）。判定细节见上方表格。**Ponytail rung 1 实践**：默认拒绝"为了命名清晰拆文件"，3 个例外存在是因为它们有独立的运行时语义（composable 需要被 Vue 编译器识别 + cleanup 钩子；`validation.ts` 是 DTO 对齐独立系统；`.test.ts` 是 vitest 入口约定）—— 不属于"无业务价值的拆文件"。其他一律合进 `index.ts`。

## 标准参考实现（iot-web 现状）

- 列表页：`src/views/device/index.vue`、`src/views/product/index.vue`、`src/views/protocol/index.vue`
- 表单页（现状叫 `widget/`，目标结构 `addOrEdit/`）：`src/views/device/widget/editDia.vue`
- 表格封装：`src/components/IotTable.vue`；列表组合式：`src/composables/useTable.js`
- 公共组件：`src/components/`（`PageHeader.vue` / `AlarmDetailDialog.vue` / `IconInput.vue` 等）
