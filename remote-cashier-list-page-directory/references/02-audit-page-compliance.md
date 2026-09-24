# 目标 2：审查现有页面合规性

**适用场景**：检查某业务模块目录是否完全合规，输出**违规清单 + 分类结论**。

> 本目标是**只读审查**，不要擅自修改代码。所有整改动作见 `references/03-refactor-page.md`。

## 检查清单（按 7 项固定目录逐项）

### 检查 1：7 项目录职责是否齐全

```
src/pages/<业务模块>/
├── index.vue          ← 列表页（必须）
├── addOrEdit/         ← 新增/修改/详情（仅 add / edit / detail 业务存在时创建）
├── apis/              ← 接口（仅业务有调用时创建）
├── components/        ← 组件（仅业务有跨页复用组件时创建）
├── config/            ← 列表配置（仅配置逻辑提取到 config/ 时创建）
├── enum/              ← 字典/枚举（仅业务有独立枚举时创建）
└── utils/             ← 工具（仅业务有独立工具时创建）
```

**规则**：
- 7 项目录是**职责清单**，不是"必须初始全部创建"。
- **禁预创建空目录 + `.gitkeep` 占位**——实际无文件时不需要创建目录。
- `addOrEdit/` 仅在业务有新增/修改/详情需求时创建；初始仅 `index.vue` 列表页时无需建。
- 哪一项业务存在才创建哪一项，**不预先占位**。

**违规标志**：
- ❌ 缺 `index.vue`（列表页放错位置）
- ❌ 缺 `addOrEdit/`（表单页直接放外层）
- ❌ **预先创建空目录 + `.gitkeep` 占位**（git 无法追踪空目录是惯例，不需要文件占位）
- ❌ 多出额外目录名（如 `constants/` `helpers/` `models/` 等不固定目录名）

**补足方法**（仅在确实需要该目录且已有首个文件时）：
```bash
# 直接创建文件，不需要 .gitkeep 占位
touch src/pages/<业务模块>/components/Foo.vue
```

### 检查 2：列表页 vs 表单页分离

- ✅ 列表页只放 `index.vue`
- ❌ 把新增/修改/详情页放外层（必须放 `addOrEdit/` 内）

### 检查 3：addOrEdit 内文件形态

| 形态 | 文件结构 |
|---|---|
| 三合一 | `addOrEdit/{addOrEdit.vue 或 index.vue}`（一个文件按 `mode` 区分） |
| 三个独立 | `addOrEdit/{add.vue, edit.vue, detail.vue}` |
| 某两在一起 | 任意两文件（如 `addOrEdit.vue` + `detail.vue`） |

**违规标志**：
- ❌ 出现 4 个及以上独立文件（违反"某两在一起"的最简原则）—— 应评估是否可以三合一或拆三独立

### 检查 4：apis 归属判断（高频）

走 `references/04-shared-vs-private.md` 的决策树。**关键违规**：
- ❌ 业务主接口（如 `pageXxxApi` / `createXxxApi`）放进 addOrEdit 内层
- ❌ 仅 addOrEdit 用的辅助下拉接口（如 `listAvailableCompanysApi`）放外层（污染业务块共用）

### 检查 5：components/config/enum/utils 归属

同 apis，按 `references/04-shared-vs-private.md`。

**不推荐 `utils/confirm.ts`**（2026-09-21 取消）：调用方直接 `import { confirmDelete } from "@/common/utils"`，不再创建中间转发层。审查清单中**不再要求**该文件存在。

### 检查 6：components/*.vue 弹窗无壳模式

```ts
// ✅ 正确：内容不含 el-dialog，暴露 submit()
defineExpose({ submit })

// ❌ 违规：组件内含 el-dialog
<el-dialog>...</el-dialog>
```

### 检查 7：数据流契约（参考 file-responsibilities.md）

- 列表/详情/编辑/删除全按业务唯一流水号 `uniqueValue`，不用自增 `id`
- 列表/详情共用 VO（一个类型两用）
- 配置与视图分离：表格列/搜索项全部工厂化
- 下拉选项由 `index.vue` 异步注入（不是写死）

### 检查 8：`utils/` 文件例外审查（高频违规点）

> **`utils/` 默认只能放 `index.ts`**。仅 3 类例外可独立成文件（`*.composable.ts` / `validation.ts` / `*.test.ts`），其他文件一律合进 `utils/index.ts`。

**违规标志**：
- ❌ `utils/` 下出现非例外文件（如 `format.ts` / `relatedUser.ts` / `companyEventBus.ts` 中不带 lifecycle 钩子的纯函数部分）—— 应合进 `utils/index.ts`
- ❌ `utils/validation.ts` 总行数 <100 行（不属"大块"，应合进 `utils/index.ts`）
- ❌ `*.composable.ts` 命名不带 `useXxx` 前缀（违规）
- ❌ `*.composable.ts` 实际不含任何 vue lifecycle 钩子（不应独立成文件）
- ❌ `utils/*.test.ts` 与 `utils/index.ts` 不在同一目录

**合法示例**（当前仓库已存在）：
- ✅ `bankCard/utils/validation.ts`（158 行 >100 行阈值）—— 例外 2
- ✅ `businessScope/utils/validation.ts`（95 行，刚好 ≤100；如未来扩展可加）—— **边缘案例，按"接近阈值"放宽**
- ✅ `company/utils/companyEventBus.ts` 含 `onBeforeUnmount` 的 `useCompanyViewTab` composable —— 例外 1
- ✅ `StoreAuditOffboarding/utils/index.test.ts` vitest 单测 —— 例外 3

**整改动作**：
```bash
# 违规文件合并
cat src/pages/<业务块>/utils/format.ts >> src/pages/<业务块>/utils/index.ts
rm src/pages/<业务块>/utils/format.ts
# import 改："./format" → "."
```

### 检查 9：内层 enum/config/utils 触发审查（**高频遗漏点**）

> 这是**反向扫描**检查——不仅看目录存在性，还要扫 .vue 内容看是否有该拆未拆的 inline enum/config/utils。

**扫描命令**：
```bash
# 扫 inline 枚举选项数组（应拆到 addOrEdit/enum/）
grep -rn "const.*OPTIONS.*=" src/pages/<业务块>/addOrEdit/*.vue

# 扫 inline Descriptions items 数组（应拆到 addOrEdit/config/）
grep -rn "const.*Items.*=" src/pages/<业务块>/addOrEdit/*.vue

# 扫 Descriptions items 工厂函数（应拆到 addOrEdit/config/）
grep -rn "function.*Items.*(" src/pages/<业务块>/addOrEdit/*.vue

# 扫行数，判断是否超阈值
wc -l src/pages/<业务块>/addOrEdit/*.vue
```

**违规标志**（必须满足以下三条才算"该拆"）：
- 1️⃣ 在 `addOrEdit/*.vue` 中命中上述 grep 模式
- 2️⃣ 该数组/函数 **仅被 1 个 .vue 文件使用**（grep 验证）
- 3️⃣ 行数满足阈值（enum ≥5 行 / config Descriptions items ≥10 行 / DynamicForm items ≥15 行）

**违规处置**：
- ❌ `addOrEdit/detail.vue` 出现 `STORE_COUNT_OPTIONS`（5 项选项 + type）但未对应 `addOrEdit/enum/index.ts` —— 应拆
- ❌ `addOrEdit/detail.vue` 出现 `baseDescItems` / `storeCardItems` / `storeCardData` 但未对应 `addOrEdit/config/index.ts` —— 应拆
- ❌ `addOrEdit/*.vue` 任一文件 >400 行且包含 ≥3 个 inline 数组/工厂函数 —— 应拆

**判断例外**（以下情况不违规）：
- ✅ computed 依赖 reactive state（如 `baseDescData = computed(() => ({...}))`）—— 依赖 .vue 内变量，留 .vue
- ✅ 工厂函数仅 1-3 行（如 `maskIdCard` 1 行函数）—— 不够"大块"阈值
- ✅ 选项数组仅 1-4 项（如 `[{ value: "1", label: "启用" }]`）—— 不够"枚举"阈值

**反模式**：
- ❌ "反正只有 1 个 .vue 用，拆出来反而麻烦"——这就是内层判断的反向证据，必须拆
- ❌ "等到 addOrEdit 文件 >500 行再拆"——发现就拆，不是阈值过后才拆
- ❌ "拆出去跨文件 import 更繁琐"——跨文件 import 是 Vue 项目常态，不是反拆理由

### 检查 10：顶部 header 触发审查（顶栏复用 → config/）

> `addOrEdit/` **不建 `menu/` 目录**。顶部 header 的 UI 资源（容器 class / 标题文案）和 actions 工厂均放 `addOrEdit/config/index.ts`，与表单 items / 描述项 同质。

**扫描命令**：
```bash
# 扫顶栏容器 class 重复（config/ 触发）
grep -rn "sticky top-0 z-10" src/pages/<业务块>/addOrEdit/*.vue

# 扫顶栏 container 长 className（≥3 行重复）
grep -rn "flex items-center justify-between px-6 py-4 bg-white border-b" src/pages/<业务块>/addOrEdit/*.vue

# 扫 header 标题常量模式
grep -rn "text-base font-semibold text-\[#1f2937\]" src/pages/<业务块>/addOrEdit/*.vue
```

**违规标志**（满足以下任一条必须拆）：
- 1️⃣ ≥2 个 .vue 出现完全相同的 `sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b` 容器 class —— 应提取 `PAGE_HEADER_CLASSES` 常量到 `addOrEdit/config/index.ts`
- 2️⃣ ≥2 个 .vue 出现 ≥2 个按钮 v-if 条件 + 标题文字 —— 应提取 `getXxxHeaderActions(ctx)` factory 到 `addOrEdit/config/index.ts`
- 3️⃣ header 内的标题/状态标签 chip 文本（"店铺上架流程-详情" / "当前状态："）直接 inline —— 应提取为 const

**违规处置**：
- ❌ detail.vue / fill.vue / index.vue 3 个文件均使用同一 `sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-[#e8e8e8]` 容器 class —— 应拆 `PAGE_HEADER_CLASSES`
- ❌ 3 个文件均有顶栏 el-button v-if 操作按钮组（detail 4 个 / fill 2 个 / index 3 个）—— 应拆 `getDetailHeaderActions` / `getFillHeaderActions` / `getIndexHeaderActions` factory
- ❌ 标题文字"店铺上架流程-详情" 直接 inline —— 应拆 `DETAIL_HEADER_TITLE` 常量

**判断例外**：
- ✅ 顶栏仅 1 个 .vue 文件用 + 无 v-for 渲染需求 —— 不拆（仅用于 ≥2 个页面复用）
- ✅ 顶栏结构高度特化（如包含特殊 el-tabs / el-steps 等）—— 不拆，inline 更清晰

**反模式**：
- ❌ "header 差异太大没法抽" —— 容器 class / 标题 / actions 数组都能拆，差异大反而说明需要工厂函数定制
- ❌ "为 header 单建 `addOrEdit/menu/`" —— header 资源与表单 / 描述项 同质，都放 `config/`；**外层业务块不建 menu/，addOrEdit 也不建 menu/**

### 检查 11：组件级 form rules 触发审查（→ config factory）

> `addOrEdit/components/*.vue` 的 `const rules: FormRules = {...}` 含自定义 validator 或依赖 props 时，抽到 `addOrEdit/config/index.ts` 的 `getXxxFormRules(ctx)` factory。与页面级 FORM_RULES 同质，仅作用域不同。

**扫描命令**：
```bash
# 扫组件级 FormRules inline（检查 11 触发）
grep -rn "const rules.*FormRules\|: FormRules =" src/pages/<业务块>/addOrEdit/components/*.vue 2>&1

# 扫组件级自定义 validator（强烈指标）
grep -rn "validator:.*=>" src/pages/<业务块>/addOrEdit/components/*.vue 2>&1
```

**违规标志**（满足以下任一条必须拆）：
- 1️⃣ `addOrEdit/components/*.vue` 的 `rules` 行数 ≥7 行
- 2️⃣ rules 包含自定义 `validator`（去重 / 异步校验 / 格式正则）
- 3️⃣ rules 依赖组件 `props.*`（如 `props.existing` / `props.editingIndex`）

**违规处置**：
- ❌ `addOrEdit/components/SubAccountForm.vue` 内联 `rules: FormRules = {...}` 27 行（含去重 validator + 邮箱·手机格式校验 + 依赖 `props.existing` / `props.editingIndex`）—— 应拆 `getSubAccountFormRules(ctx)` 到 `addOrEdit/config/index.ts`
- ❌ 子组件规则含异步 validator（如 `listAvailable({...}).then(...)`）未拆 —— 必须抽 factory 传 ctx

**判断例外**：
- ✅ rules 仅是必填 + 长度校验（无 validator + 无 props 依赖），且 ≤6 行 —— 不拆，inline 更易读

**反模式**：
- ❌ "rules 是组件内部细节不必抽" —— 与表单 items / 描述项同质，多文件复用时拆 factory 是避免修改者四处同步；未来出现第二个组件复用人去重 / 格式校验时可复用
- ❌ "把 props 直接传进 factory 函数体里" —— 破坏 props 响应式订阅，应传 ctx（factory 调用时拍快照即可，表单 rules 本身不依赖响应式更新）

## 结论分类（必填）

按 `references/06-product-boundary.md` 严格区分三类：

| 结论 | 何时使用 | 是否下发 |
|---|---|---|
| **必须整改（规范违规）** | 检查清单明确判定为不合规 | ✅ 直接下发整改 |
| **建议优化（需需求确认）** | 不影响现有流程但有改进空间 | ⚠️ 等用户确认 |
| **无需修改（已符合规范）** | 当前实现合规 | ❌ 不动 |

## 输出格式（审查报告）

```
## 审查结论：[业务模块名]

### 必须整改（X 项）
1. [违规项] —— [违规位置] —— [整改建议]
2. ...

### 建议优化（Y 项，待需求确认）
1. [建议项] —— [潜在影响] —— [需确认的内容]
2. ...

### 无需修改（Z 项）
1. [合规项]
2. ...
```

## 反模式（不要做）

- ❌ 把"建议"标注为"必须整改"（混淆规范结论）
- ❌ 把产品建议（如"加个 Tab"）混入目录规范违规清单
- ❌ 审查同时擅自修改代码（本目标是只读）