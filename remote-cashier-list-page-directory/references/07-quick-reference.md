# Quick Reference（一页查表）

**适用场景**：日常查表用，不必读完整 SKILL.md。

## 7 项固定目录（必须齐全）

```
src/pages/<业务模块>/
├── index.vue          ← 列表页
├── addOrEdit/         ← 新增/修改/详情
├── apis/              ← 接口
├── components/        ← 组件（即使空也要保留）
├── config/              ← 列表配置
├── enum/              ← 字典/枚举
└── utils/             ← 工具（默认只放 index.ts，3 类例外见下）
```

> 7 项是**职责清单**，不是"初始必须全部创建"。**禁预创建空目录 + `.gitkeep` 占位**——git 无法追踪空目录是惯例，需要文件时直接创建文件。

## `utils/` 文件规则（默认仅 index.ts）

| 文件类型 | 是否例外 | 判定 |
|---|---|---|
| `utils/index.ts` | ✅ 默认唯一允许 | 状态映射 / format / 计算 / 相关视图 / 一切纯函数 |
| `utils/*.composable.ts`（**例外 1**） | ✅ 例外 | 含 vue lifecycle 钩子（`onBeforeUnmount` / `onMounted` / `watch`），如 `useCompanyViewTab` |
| `utils/validation.ts`（**例外 2**） | ✅ 例外 | DTO 校验对齐表：`FormRules` + `MAX` 常量 + `requiredNotBlank` factory，总行数 >100 行才算"大块" |
| `utils/*.test.ts`（**例外 3**） | ✅ 例外 | vitest 单元测试，与 `index.ts` 同目录就近放 |
| `utils/format.ts` / `utils/relatedUser.ts` / 其他 | ❌ 违规 | 应合进 `utils/index.ts`（除 7 行外的 format/计算工具都没资格独立） |
| `utils/confirm.ts` | ❌ 不推荐 | 2026-09-21 重构后取消，调用方直接 `import { confirmDelete } from "@/common/utils"` |

## 内层 enum/config 触发条件（高频遗漏）

**`addOrEdit/` 出现以下模式必须拆**：

| 模式 | 阈值 | 拆到哪里 |
|---|---|---|
| `const FOO_OPTIONS = [{ value, label }, ...] as const` + `type Foo` | ≥5 行 + 仅 1 个 .vue 用 | `addOrEdit/enum/index.ts` |
| `const descItems = [{ prop, label, span }, ...]`（Descriptions items） | ≥10 行 + 仅 1 个 .vue 用 | `addOrEdit/config/index.ts` |
| `function descItemsFactory(item)` / `function descDataFormatter(item)` | ≥10 行工厂 | `addOrEdit/config/index.ts` |
| `const formItems = computed<FormItemConfig[]>(() => [...])` | ≥15 行 + 仅 1 个 .vue 用 | `addOrEdit/config/index.ts` |
| `const FORM_RULES = { ... }` 校验规则对象 | ≥7 行 + 仅 1 个 .vue 用 | `addOrEdit/config/index.ts` |
| `const rules: FormRules = {...}` 组件级表单校验 | ≥7 行 / 含自定义 validator / 依赖组件 props | `addOrEdit/config/index.ts` 的 `getXxxFormRules(ctx)` factory |
| 顶栏容器 className（`sticky top-0 z-10 flex ...`） | ≥2 个 .vue 重复 | `addOrEdit/config/index.ts` 常量（**不建 menu/**） |
| 顶栏 el-button / LoadingButton v-if 组合 | ≥2 个按钮 + ≥3 个页面 header 复用 | `addOrEdit/config/index.ts` factory（**不建 menu/**） |
| `const xData = computed(() => ({...}))` 依赖 reactive | —— | **不拆**（依赖 .vue 内变量） |
| 函数 <3 行 / 数组 <4 项 | —— | **不拆**（不够阈值） |

**扫描命令**：
```bash
grep -rn "const.*OPTIONS.*=" src/pages/<业务块>/addOrEdit/*.vue
grep -rn "const.*Items.*=" src/pages/<业务块>/addOrEdit/*.vue
grep -rn "function.*Items.*(" src/pages/<业务块>/addOrEdit/*.vue
grep -rn "const.*RULES.*=" src/pages/<业务块>/addOrEdit/*.vue
grep -rn "sticky top-0 z-10" src/pages/<业务块>/addOrEdit/*.vue

# 扫组件级 FormRules inline（检查 11 触发）
grep -rn "const rules.*FormRules\|: FormRules =" src/pages/<业务块>/addOrEdit/components/*.vue
grep -rn "validator:.*=>" src/pages/<业务块>/addOrEdit/components/*.vue
```

如命中但 `addOrEdit/{enum,config}/index.ts` 无对应 export → **必须整改**。

## addOrEdit 内文件形态

| 形态 | 文件结构 | 适用 |
|---|---|---|
| 三合一 | `addOrEdit/{addOrEdit.vue 或 index.vue}` | 三模式逻辑相近 |
| 三独立 | `addOrEdit/{add.vue, edit.vue, detail.vue}` | 逻辑差异大 |
| 某两在一起 | `addOrEdit/{addOrEdit.vue, detail.vue}` 等 | 折中 |

## 归属决策（高频）

| 文件类型 | 归属 | 示例 |
|---|---|---|
| 业务主接口 | 外层 `apis/` | `pageOnboardingApi` / `createOnboardingApi` |
| 跨页面接口 | 外层 `apis/` | `deleteOnboardingApi` |
| 辅助下拉接口 | 内层 `addOrEdit/apis/` | `listAvailableCompanysApi` |
| 业务主类型 | 外层 `apis/type.ts` | `AuditApplicationListVO` |
| 辅助下拉类型 | 内层 `addOrEdit/apis/type.ts` | `AssignableCompany` |
| 业务块共用组件 | 外层 `components/` | `SubAccountManager`（store 模块） |
| 仅 addOrEdit 用组件 | 内层 `addOrEdit/components/` | `SubAccountEditor` |
| 列表配置 | 外层 `config/` | `getSearchFormItems` |
| 字典枚举 | 外层 `enum/` | `AUDIT_STATUS` |
| 状态映射 util | 外层 `utils/` | `getStatusTagType` |
| 二次确认 | 直接 `import from "@/common/utils"` | 不再推荐 utils/confirm.ts 中间层 |
| 页面级 utility | 内层 `addOrEdit/utils/` | `createOperationIdStore` |

## 弹窗无壳模式契约

```ts
// ✅ 正确
defineExpose({ submit: () => Promise<boolean> })

// ❌ 违规：组件内含 el-dialog
<el-dialog>...</el-dialog>
```

## 命令

```bash
# ❌ 不允许：创建空目录 + .gitkeep 占位
# git 无法追踪空目录是惯例，不需要文件占位
# mkdir -p src/pages/<业务模块>/components
# touch src/pages/<业务模块>/components/.gitkeep

# ✅ 正确：需要目录时直接创建首个文件
touch src/pages/<业务模块>/components/Foo.vue

# 调用方直接 import（不推荐 utils/confirm.ts 中间层）
# ```ts
# import { confirmDelete } from "@/common/utils"
# ```

## 验证

```bash
# 7 项固定目录检查
ls src/pages/<业务模块>/

# ESLint
npx eslint src/pages/<业务模块> --ext .vue,.ts

# 重复审查
cat references/02-audit-page-compliance.md
```

## 输出格式（所有目标）

- 列出新建/改动的目录树
- 标注每个 apis/components/config/enum/utils 是外层还是内层
- 说明 addOrEdit 文件形态
- 区分三类结论（必须整改/建议优化/无需修改）

## 反模式（速记）

- ❌ 缺 7 项任意一项
- ❌ 列表页和 addOrEdit 共用 index.vue
- ❌ 把仅 addOrEdit 用的放外层
- ❌ 弹窗组件含 el-dialog
- ❌ 弹窗组件未暴露 submit()
- ❌ 工具用 try/catch + ElMessageBox.confirm（应改 confirmDelete）
- ❌ 创建 utils/confirm.ts 一行转发中间层（2026-09-21 重构后取消，调用方直连 @/common/utils）
- ❌ `utils/` 下放 `format.ts` / `relatedUser.ts` 等非例外文件（应合进 `index.ts`）
- ❌ `utils/validation.ts` 总行数 <100 行（不属"大块"，应合进）
- ❌ `*.composable.ts` 实际不含 lifecycle 钩子（违规独立成文件）
- ❌ **`addOrEdit/*.vue` 出现 ≥5 行 OPTIONS 数组 / ≥10 行 Descriptions items 数组 / ≥10 行 items 工厂却未拆到 `addOrEdit/{enum,config}/`**（**检查 9** 必检）
- ❌ **`addOrEdit/*.vue` ≥2 个文件使用相同 `sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b` 顶栏 class 却未拆 `addOrEdit/config/index.ts`**（**检查 10** 必检；**不建 `addOrEdit/menu/`**）
- ❌ **`addOrEdit/components/*.vue` 含 `rules: FormRules` ≥7 行 / 自定义 validator / 依赖 props 却未抽 `getXxxFormRules(ctx)` factory**（**检查 11** 必检）
- ❌ 建议优化项下发为必须整改
- ❌ import 同一路径多次（应合并）