# Quick Reference（一页查表）

**适用场景**：日常查表用，不必读完整 SKILL.md。

> **用法**：先查下面的「声明种类 → 归属目录」表定归属，再看现状。后文所有 `grep` 只是**列出待判定声明的加速器**，不是规范；命令没命中 ≠ 合规。

## 声明种类 → 归属目录（审查主表）

| 声明种类 | 应该在哪 |
|---|---|
| `interface` / `type`（任何名字 / 泛型 / 联合） | 业务块根 `types/index.ts` |
| `FormRules` 对象（任何名字） | 纯静态 → `addOrEdit/config/index.ts`；引 enum 工厂 → `addOrEdit/enum/index.ts`；依赖 props / 含 validator → `addOrEdit/config/` factory |
| `computed`（任何名字） | **一律**提 `config/`：体内无响应式依赖 → 常量化 `export const X = [...]`；体内引用 `.value` / `props.` / `reactive` → 抽成方法 `export function getXxx(args)`，把这些值**当参数传进去**，`computed` 留在 .vue 侧调方法 | `getXxxFormItems(companyOptions.value, formData.operatorId)` |
| 静态数组 / 字典 / `Record<KEY,value>` | `config/` 或 `enum/` |
| 格式化 / 校验 / 映射工具函数 | `utils/index.ts` |
| 接口请求函数 | `apis/index.ts` |
| 枚举 / 状态码 / label 映射表 / 魔法值 | **先查 `@/common/enum`** → 有就复用；本块 `enum/` 有 → 复用；都没有 → 建就近 `enum/` + 业务块内全量改引用 |
| 页面状态（ref/reactive）、事件处理、副作用编排 | `.vue` 内部 |
| 组件 | `addOrEdit/components/` 或外层 `components/`（按真 import 数判定）|

**审查 4 步**：① 列 7 项目录 → ② 逐文件读完、列出每条顶层声明 → ③ 每条查上表得归属 → ④ 对比实际位置，不同即违规。

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

### components 真跨页复用判定（检查 5a，**强证据**）

```bash
# 强制执行:对 components/ 下每个 .vue，grep 真 import 路径（不接受 doc 提及）
for comp in $(ls src/pages/<业务块>/components/*.vue 2>/dev/null | xargs -n1 basename | sed 's/\.vue$//'); do
  echo "=== $comp 真调用方 ==="
  grep -rnE "^import[[:space:]]+${comp}[[:space:]]+from" src/pages/ --include="*.vue" --include="*.ts" 2>&1
done
```

**判定**：
- ≥2 个真 import + 跨业务模块 + 跨目录 → 业务块共用，**外层** `components/`
- 0-1 个真 import / 仅 addOrEdit 内 / 仅 doc 注释提到 → **内层** `addOrEdit/components/`

事故案例（store/ 2026-10-15）：SubAccountManager 凭"fill.vue 用了"判定放外层，实际 fill.vue **只 doc 注释提到**（非 import）—— 按本命令应挪内层。

### 页面级 FormRules 抽离位置判定（检查 12，**就近原则**）

```bash
# 列出待判定的 FormRules 声明（只是加速器，不是规范）
grep -rnE "^const[[:space:]]+\w+[[:space:]]*:[[:space:]]*FormRules" src/pages/<业务块>/addOrEdit/*.vue 2>&1

# 判定 rules 体内是否引用 enum 工厂（决定放 config/ 还是 enum/）
grep -A 50 "^const[[:space:]]+\w+[[:space:]]*:[[:space:]]*FormRules" src/pages/<业务块>/addOrEdit/<file>.vue | grep -E "from \"\.\./enum\"|createDictionaryEnum|new \w+Enum\("
```

**判定**：
- 引用 enum 工厂 / import 自 `../enum` → 抽到 `addOrEdit/enum/index.ts`（**允许特例**）
- 否则（纯静态）→ 抽到 `addOrEdit/config/index.ts`（**默认位置，就近原则**）

**抽到 config 后的 2 个必做动作**：
1. `addOrEdit/config/index.ts` 里 import 业务块根 types 写 `"../../types"`（不是 `"../types"`）
2. 模板 `:rules="rules"` 用 alias import `import { XXX_FORM_RULES as rules } from "./config"` 保住零改动；alias import 在 `perfectionist/sort-named-imports` 里排在最后

**2 个事故案例**：
- store/ 2026-10-15：`STORE_ADD_OR_EDIT_FORM_RULES` 纯静态 formRules 错放外层 `enum/` —— 应放 `addOrEdit/config/`。
- storeEntryPlatform/ 2026-10-15：`const rules: FormRules<X> = {…14 行纯静态}` 变量名**不叫** formRules，v1 扫描 `^const formRules` 漏掉 —— 必须按 `FormRules` 类型注解扫。

### computed 包纯静态扫描（检查 5c，**反模式**）

```bash
# 扫 .vue 顶层 const X = computed(() => [...]) 模式
grep -rnE "^const[[:space:]]+\w+[[:space:]]*=[[:space:]]*computed\(" src/pages/<业务块>/ 2>&1

# 验证 computed 体内是否有响应式依赖
grep -A 10 "^const.*=.*computed(" src/pages/<业务块>/addOrEdit/<file>.vue | grep -E "\.value\.|props\.|reactive\(|ref\("
```

**判定**（**v2 最终态，先看 computed，再看行数**）：
- `computed(() => [...])` + 体内**无**响应式依赖 → **反模式**：去 computed + 抽 `addOrEdit/config/` 常量化（`export const X = [...]`，行数任意）
- `computed(() => [...])` + 体内**有**响应式依赖（`.value` / `props.` / `reactive`）→ **抽成方法放 config，值当参数传进去**：`export function getXxxFormItems(companyOptions: Opt[], operatorId?: string) { return [...] }`，.vue 侧 `computed(() => getXxxFormItems(companyOptions.value, formData.operatorId))`。**不要**传 `Ref`/`Reactive` 容器包装
- `computed(() => ({...}))` + 体内**有**响应式依赖 → 同理，方法返回对象
- `computed(() => 布尔表达式)` 1 行 → 可留 .vue（不是数据）

事故案例（store/ 2026-10-15 v1）：`closeStoreFormItems` 9 行 + computed 包装 + 纯静态 → 抽 `addOrEdit/config/CLOSE_STORE_FORM_ITEMS` 常量。
事故案例（store/ 2026-10-15 v2）：`formItems` 35 行 + computed 包装 + 依赖 `companyOptions.value.map(...)` / `!!formData.operatorId` → 抽 `addOrEdit/config/getStoreAddOrEditFormItems(ctx)` factory（user 纠正「写个方法，值传进去」）。

### inline type/interface 集中化扫描（检查 13，**目标 9**）

```bash
# 1. 扫 .ts 顶层 interface/type 声明（排除 types/index.ts）
for f in $(find src/pages/<业务块> -type f -name "*.ts" 2>/dev/null); do
  case "$f" in */types/index.ts) continue ;; esac
  grep -nE "^(export[[:space:]]+)?(interface|type)[[:space:]]+[A-Z]\w*" "$f" 2>/dev/null
done

# 2. 扫 .vue <script setup> 顶层 interface/type
for f in $(find src/pages/<业务块> -type f -name "*.vue" 2>/dev/null); do
  awk '/<script[^>]*>/,/<\/script>/' "$f" 2>/dev/null | grep -nE "^(interface|type)[[:space:]]+[A-Z]\w*"
done

# 3. 看某 type X 的所有调用方（word boundary 避免匹配到 Xxx）
grep -rln "\bX\b" src/pages/<业务块>/ --include="*.vue" --include="*.ts" | grep -v "types/index.ts"
```

**判定**（**A vs B 选项**）：
- **A 选项**（推荐，store/ 2026-10-15 选用）：**所有 type/interface 全部集中到业务块根 `types/index.ts`**，包括 `apis/type.ts` 里的 DTO/VO；调用方统一从 `./types` / `../types` import；`apis/type.ts` 退化/删除
- **B 选项**（保守）：仅 .vue 顶层 + config/utils 散落的 type 集中；`apis/type.ts` 保留 DTO 定义

**判定口诀**：
1. 这是 TS `interface` / `type` 声明（不是 import / 函数 / const / enum）？**是** → 违规
2. 是 share/第三方 import？**是** → 不违规
3. 是 1 行 string/number union 且仅 1 个文件用？**是** → 不违规（YAGNI）
4. 其他 → **就近 `types/index.ts`**

事故案例（store/ 2026-10-15）：`store/apis/type.ts` 22 个 type/interface 散落 + `addOrEdit.vue` 1 个 inline `BiUserOption`（与 company/types 重复）→ 抽 `store/types/index.ts`（462 行） + 删 `apis/type.ts`（455 行） + 改 6 个调用方 import 路径 + BiUserOption 跨业务块复用 `@/pages/company/types`。

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
- ❌ **`.vue` 顶层 `const \w+: FormRules = {...}` 纯静态未抽 config**（**检查 12 必检**，扫描按 `FormRules` 类型注解不按变量名）
- ❌ 建议优化项下发为必须整改
- ❌ import 同一路径多次（应合并）