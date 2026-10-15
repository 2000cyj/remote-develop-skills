# 目标 4：判断 apis/components/config/enum/utils 归属（最高频）

**适用场景**：每次新建/重构都要判断某个文件/接口/组件/工具该放外层还是内层。本文档是**最高频的目标**，单独抽出。

> 底层规则："共用放外层，独立放当前"。本文档是它的**决策流程版**。

## 决策树（强记）

```
某文件 X（API / component / util / interface / config）
  │
  ├─ grep 全部调用方：
  │    - 是否被本业务块多页面共用？（列表页 + addOrEdit）
  │    - 是否被业务块外部其他模块共用？（如被 AccountChangeDetails 等）
  │
  ├─ 共用 → 放外层（业务块共用）
  │
  └─ 仅当前目录内单文件/少数文件用 → 放当前目录（独立内层）
```

## 场景化判定表

| 文件类型 | 判定要点 | 归属决策 |
|---|---|---|
| **业务主接口**（如 `pageOnboardingApi` / `createOnboardingApi` / `approveOnboardingApi`） | 列表页或 addOrEdit 多处用 | **外层** `apis/` |
| **辅助下拉接口**（如 `listAvailableCompanysApi`） | 仅 addOrEdit/detail.vue 用 | **内层** `addOrEdit/apis/` |
| **跨页面接口**（如 `deleteOnboardingApi` 被列表页 + detail.vue 都用） | 跨页面 | **外层** `apis/` |
| **业务主类型**（如 `AuditApplicationListVO` / `OnboardingItem`） | 列表/详情共用 VO | **外层** `apis/type.ts` |
| **辅助下拉类型**（如 `AssignableCompany` / `FileTagKeyValue`） | 仅辅助下拉 API 用 | **内层** `addOrEdit/apis/type.ts` |
| **业务块共用组件**（如 store/components 的 `SubAccountManager`——store 模块多页面共用） | 业务块共用 | **外层** `components/` |
| **仅当前页面用**（如 SubAccountEditor 只被 detail.vue / fill.vue 用） | addOrEdit 内单用 | **内层** `addOrEdit/components/` |
| **列表配置**（`getSearchFormItems` + `getTableColumns`） | 列表页用 | **外层** `config/` |
| **详情描述项配置**（如 `baseDescItems` / `storeCardItems` 工厂——Descriptions items 数组 + 数据格式化工厂） | 仅 detail.vue 用，且总行数 >10 行 | **内层** `addOrEdit/config/` |
| **表单 items 配置**（如 `getFormItems` 工厂——DynamicForm formItems 数组） | 仅 index.vue 用，且总行数 >15 行 | **内层** `addOrEdit/config/` |
| **表单校验规则**（如 `EDIT_OR_CHECK_FORM_RULES` 常量）| 仅 1 个 .vue 用 + 总行数 ≥7 行 + 纯静态 (无 validator / 不依赖 enum 工厂) | **内层** `addOrEdit/config/`（**就近原则**：离 .vue 最近的目录）|
| **表单校验规则（与字典共享字段名）**（如 `COMPANY_ADD_FORM_RULES`）| formRules 引用 `createDictionaryEnum` 等 enum 工厂 / 跨页共享字段名 / 需要跟字典（taxpayerType/accountingCompany 等）严格对齐 | **内层** `addOrEdit/enum/`（**作为允许特例**，**默认仍应放 config**）|
| **组件级 form rules 工厂**（如 `getSubAccountFormRules(ctx)`——抽 `addOrEdit/components/*.vue` 的 `rules: FormRules`，依赖 props 传 ctx） | `addOrEdit/components/*.vue` 的 rules ≥7 行 + 包含自定义 validator（去重 / 异步校验 / 格式正则）或依赖组件 props | **内层** `addOrEdit/config/`（**与 FORM_RULES 同质**，仅作用域不同：页面级 vs 组件级） |
| **顶栏 UI 资源 + actions 工厂**（如 `PAGE_HEADER_CLASSES` 常量 + `DETAIL_HEADER_TITLE` 文案 + `getDetailHeaderActions(ctx)` 工厂） | ≥3 行 inline 顶栏 container class 重复 + ≥2 个 .vue 复用同一标题文本 / ≥2 个按钮 v-if + ≥3 个页面共用 actions | **内层** `addOrEdit/config/`（与表单 items / 描述项 同质，**只用一个目录**，**不建 `addOrEdit/menu/`**） |
| **业务块共用字典/枚举**（如 `AUDIT_STATUS` / `ONBOARDING_PLATFORMS`） | 业务块共用 | **外层** `enum/` |
| **跨模块共用字典**（如 `ONBOARDING_PLATFORMS` 被 AccountChangeDetails 引用） | 跨模块共用证据 → 提升优先级 | **外层** `enum/` |
| **内层筛选选项**（如 `STORE_COUNT_OPTIONS` + `StoreCountBucket` type——detail.vue 内的下拉筛选条件） | 仅 1 个 addOrEdit .vue 用 + 行数 ≥5 行 + 无 reactive 依赖 | **内层** `addOrEdit/enum/` |

> ⚠️ **批量执行**（全仓扫 .vue 顶层 enum 风格 const + 提取到就近 enum/）见 `references/08-appendix-remediation.md`（仅历史一次性清理）。本文档只判定**单变量归属**；批量扫是附录的职责。
>
> ⚠️ **type/interface 集中**（全仓扫 .vue/.ts 顶层 type/interface + 集中到就近 `types/index.ts`）见 `references/09-no-inline-type-in-vue.md`（预防规范）+ `references/09-appendix-remediation.md`（一次性清理）。本表「业务主类型 / 辅助下拉类型」两行的归属原则在 A 选项（用户授权）下退化为全部集中到 `types/index.ts`。
| **业务归一化函数**（如 `normalizeOnboardingDetail`） | 列表页 + addOrEdit 通用 | **外层** `utils/` |
| **状态 → el-tag 映射**（如 `getStatusTagType`） | 列表页 + addOrEdit 通用 | **外层** `utils/` |
| **页面级 flow utility**（如 `createOperationIdStore`） | 仅 detail.vue 用 | **内层** `addOrEdit/utils/` |
| **二次确认**（`utils/confirm.ts`） | 每个模块都需要 | **外层** `utils/confirm.ts` |

## 实操步骤（推荐）

### 步骤 1：grep 全仓调用方

```bash
# 例：判断某 API 函数归属
grep -rln "\b<函数名>\b" src/pages/<业务模块>/ --include="*.vue" --include="*.ts" | grep -v "apis/index.ts"
```

### 步骤 2：分类

- 0 处调用 → 死代码 → 删（不要"先放着"）
- 1 处调用（仅声明）→ 死代码
- 仅 addOrEdit 内某文件用 → **内层**
- 列表页 + addOrEdit 都有用 → **外层**
- 被其他业务模块引用 → **外层**

### 步骤 3：判 attribute（type / interface）

如果文件 X 是 type/interface，看被哪些文件 import：
- 与 X 关联的 API 在哪 → type 也跟去
- 列表/详情共用的 VO → 外层 type.ts
- 仅辅助下拉 API 用的 type → 内层 type.ts

## 实战案例（StoreAuditOnboarding）

| 文件 | 调用方 | 归属 |
|---|---|---|
| `pageOnboardingApi` | 外层 index.vue | **外层** `apis/` |
| `deleteOnboardingApi` | 外层 index.vue + addOrEdit/detail.vue | **外层** `apis/`（跨页面） |
| `queryOnboardingDetailApi` | addOrEdit 内 3 个 .vue | **外层** `apis/`（业务主接口） |
| `createOnboardingApi` / `updateOnboardingApi` / `submitOnboardingApi` | 仅 addOrEdit/index.vue | **外层** `apis/`（业务主接口） |
| `approveOnboardingApi` / `rejectOnboardingApi` | 仅 addOrEdit/detail.vue | **外层** `apis/`（业务主接口） |
| `fillAndCompleteOnboardingApi` | 仅 addOrEdit/fill.vue | **外层** `apis/`（业务主接口） |
| **`listAvailableCompaniesApi`** | **仅** addOrEdit/detail.vue | **内层** `addOrEdit/apis/` |
| **`listDistinctTagsByCompanyIdsApi`** | **仅** addOrEdit/detail.vue | **内层** `addOrEdit/apis/` |
| `AssignableCompany` / `FileTagOption` 等 5 个 interface | 仅 listAvailableCompaniesApi 等 2 个 API | **内层** `addOrEdit/apis/type.ts` |
| `SubAccountEditor` | 仅 addOrEdit/detail.vue + fill.vue | **内层** `addOrEdit/components/` |
| `createOperationIdStore`（前 detail-flow.ts） | 仅 addOrEdit/detail.vue | **内层** `addOrEdit/utils/` |

## 实战案例

### AccountChangeDetails - 2026-10-15：baseDescItems + statusDescItems 抽 config

| 源文件 | 变量 | 原形式 | 抽后位置 | 原因 |
|---|---|---|---|---|
| `addOrEdit/detail.vue` | `baseDescItems`（12 行 + computed 包装） | `computed(() => [...12 静态 item...])` | `addOrEdit/config/index.ts` `export const baseDescItems` | computed 包纯静态 + 行数 ≥10 双触发 |
| `addOrEdit/detail.vue` | `baseDescData`（**不抽**） | `computed(() => ({ ...依赖 props.detail.xxx + 调 getSourceLabel/getOperationLabel 等... }))` | 留 detail.vue | **真 computed**——依赖响应式 props，拆出后丧失响应式 |
| `addOrEdit/detail.vue` | `statusDescItems`（5 行 + computed 包装） | `computed(() => [...2 静态 item...])` | `addOrEdit/config/index.ts` `export const statusDescItems` | computed 包纯静态（**行数 <10 但仍抽**）|
| `addOrEdit/detail.vue` | `statusDescData`（**不抽**） | `computed(() => ({ ...依赖 props.detail.xxx + 调 getShopStatusText... }))` | 留 detail.vue | **真 computed** |

**双变量名模式**（Items + Data 配对）决策：
- **Items**（字段定义）= 纯静态 → 抽 config
- **Data**（数据填充）= 调函数读 props → 留 .vue

**diff 动**：
- `addOrEdit/config/index.ts` 从 0 字节增到 42 行（2 个 const + 注释）
- `addOrEdit/detail.vue` 减 18 行（2 个 computed 包装 + 空行）
- import 块加 1 行：`import { baseDescItems, statusDescItems } from "./config"`（与 StoreAuditOnboarding/addOrEdit/config/index.ts 命名保持小驼峰一致）

**反思**：
- 之前 `statusDescItems` 5 行 < 模式 2 阈值 ≥10，**严格按阈值不抽**——但 `computed 包装本身是反模式`（行数任意都要去 computed）—— **现有阈值表漏了"computed 反模式"这个判定维度**
- 现在补在 04-shared-vs-private.md 模式 2 表格（新增 1 行）+ 判定顺序口诀（**先看 computed，再看行数**）
- 以后类似情况：看到 `const X = computed(() => [...])` 先看内部是否有 props/reactive/函数依赖 → **无依赖 = 反模式，必拆**

### store - 2026-10-15：closeStoreFormItems 抽 config（formItems 留 .vue 区分判定）

| 源文件 | 变量 | 原形式 | 抽后位置 | 原因 |
|---|---|---|---|---|
| `addOrEdit/addOrEdit.vue` | `closeStoreFormItems`（9 行 + computed 包装） | `computed(() => [...6 静态 item + ElSwitch + CASHIER_GUARANTEE_RETURN_STATUS_OPTIONS.options...])` | `addOrEdit/config/index.ts` `export const CLOSE_STORE_FORM_ITEMS` | computed 包纯静态——无 `.value.` / `props.` / `reactive` / `ref` 任何响应式依赖 |
| `addOrEdit/addOrEdit.vue` | `formItems`（**不抽**） | `computed(() => [...35 item 含 companyOptions.value.map(...)...])` | 留 addOrEdit.vue | **真 computed**——依赖 `companyOptions.value.map(...)` 响应式，拆出后丧失响应式 |

**双 const 同 .vue 区分判定**（Items + Items 配对）：
- **A `closeStoreFormItems`**（关店与保证金分组）= 纯静态（无响应式）→ 抽 config
- **B `formItems`**（动态表单配置）= 依赖 `usePlatformOptions().options.value` 等响应式 → 留 .vue
- 判定公式：grep 体内 `\.value\.|props\.|reactive|ref\(` → 有 = 留 .vue；无 = 抽 config

**diff 动**：
- `addOrEdit/config/index.ts` 从 35 行增到 54 行（+19 行 = `import { ElSwitch } + import { CASHIER_GUARANTEE_RETURN_STATUS_OPTIONS } + CLOSE_STORE_FORM_ITEMS 14 行 + 注释`）
- `addOrEdit.vue` 833 → 824 行（-9：删 computed 包装 + 改 import 顺序去 unused `ElSwitch`/`CASHIER_GUARANTEE_RETURN_STATUS_OPTIONS`）
- 同 .vue 内 `formRules` + `closeStoreFormItems` 都从 `./config` 引入（perfectionist/sort-named-imports 排序：`CLOSE_STORE_FORM_ITEMS` 在 `STORE_ADD_OR_EDIT_FORM_RULES` 之前）

**反思**：
- 2 个 formItems 共存易混淆，**先看每个 computed 体内是否有响应式依赖**—— 1 处 `companyOptions.value.map(...)` 就够定性为"真 computed"（其余 30 行字面量/字典/组件引用不能掩盖这 1 处响应式）
- 抽 config 后 `ElSwitch`/`CASHIER_GUARANTEE_RETURN_STATUS_OPTIONS` 在 .vue 变 unused → 必须删 import，**否则 ESLint unused-imports 报错**

## 判定口诀

> **主接口外层放，辅助下拉内层放。跨页面必外层，单页面必内层。**

## components 真跨页复用判定（强证据法，2026-10-15 补）

> 业务背景：之前 store/ 案例中 SubAccountManager 凭印象被误判为"fill.vue 用了"（实际只 doc 注释提了）—— 错放外层 components/。本节定义**唯一证据**判定法。

**判定命令**（**不接受**其他判定方式）：

```bash
# 对 components/ 下每个 .vue 文件，grep 真 import 路径
for comp in $(ls src/pages/<业务块>/components/*.vue 2>/dev/null | xargs -n1 basename | sed 's/\.vue$//'); do
  echo "=== $comp 真调用方 ==="
  grep -rnE "^import[[:space:]]+${comp}[[:space:]]+from" src/pages/ --include="*.vue" --include="*.ts" 2>&1
done
```

**判定标准**（满足以下**全部**才认作"真跨页复用"）：

| 条件 | 要求 |
|---|---|
| 1️⃣ import 数量 | ≥ 2 个真 import（**不**接受 doc 注释 / 字符串提及） |
| 2️⃣ 跨调用方 | 来自 ≥2 个**不同**业务模块的 .vue/.ts |
| 3️⃣ 跨目录 | 调用方**不限于** addOrEdit 目录（必须含 index.vue 或其他 addOrEdit 之外） |

**判定红线**（**不认作**"跨页复用"的 4 种情况）：
- ❌ grep 只命中 doc 注释 / JSDoc / 中文说明里提到组件名（**不是 import**）
- ❌ grep 只命中 1 个 import（即使来自另一个 .vue）—— 单调用方也该放 addOrEdit/components/
- ❌ grep 命中的多个 import 都来自同一 addOrEdit 目录（fill.vue 跟 detail.vue 同目录）—— 仍是 addOrEdit 内复用
- ❌ grep 命中的 import 路径不对应（"SubAccountManager" 字符串在别处使用但不是该组件）

**违规案例**（store/ 2026-10-15）：
- ❌ `ChangeInfoModal` 凭"业务块共用组件"判定放外层，实际 grep 仅 1 个真 import（addOrEdit.vue）—— 应放 addOrEdit/components/
- ❌ `SubAccountManager` 凭"fill.vue 用了"判定放外层，实际 fill.vue 只 doc 注释提到（**不**是 import）—— 应放 addOrEdit/components/

**反模式**：
- ❌ "这个组件以后会跨页用，先放外层"—— 首次就该放内层（"以后" = 不可证伪的预言）
- ❌ "doc 注释提到 = 算用到"—— doc 注释是给人看的，import 是机器验证的
- ❌ "外层有 components/ 目录就该填东西"—— 业务块没跨页组件就**不创建**该目录

## FormRules 抽离位置决策（就近原则）

> **默认**：`.vue` 顶层 `const formRules: FormRules = { ... }`（纯静态 / 无 validator）→ `addOrEdit/config/index.ts` 作 `EDIT_OR_CHECK_FORM_RULES`。
>
> **特例**：formRules 依赖 `createDictionaryEnum` 等 enum 工厂 / 跨页共享字段名 → `addOrEdit/enum/index.ts` 作 `COMPANY_ADD_FORM_RULES`。
>
> **判定公式**：grep `formRules` 体内是否 import 自 `../enum` / 引用 enum 工厂 → 是 = enum；否 = config。

**公司模块实战**：

| 页面 | formRules 抽离位置 | 名称 | 原因 |
|---|---|---|---|
| `addOrEdit/add.vue` | `addOrEdit/enum/index.ts` | `COMPANY_ADD_FORM_RULES` | 字段名（`companyName` / `creditCode` 等）跟 enum 字典同源（与 `createDictionaryEnum` 联动），作为允许特例 |
| `addOrEdit/editOrCheck.vue` | `addOrEdit/config/index.ts` | `EDIT_OR_CHECK_FORM_RULES` | 纯静态（仅 `required` / `min` / `max`），就近放 config（默认位置） |

**反模式**：

- ❌ **就近原则违反**：把纯静态 formRules（不引用 enum 工厂）也抽到 enum——会让 enum 变成"大杂烩"（混了字典/校验规则/状态码），违反就近原则。
- ❌ **就近原则违反**：把依赖 enum 工厂的 formRules 抽到 config——会导致 config 反向依赖 enum 的工厂函数，破坏单层依赖。
- ❌ **重复定义**：同一 formRules 在 `add.vue` 和 `editOrCheck.vue` 各定义一份（应该考虑用 `getXxxFormRules()` 工厂还是各自就近——若两页字段集合差异大，建议各自就近）

## 反模式（不要做）

- ❌ "先放着外层以后再挪"——首次就该正确
- ❌ "反正只有 1 个调用方"—— 单调用方也是内层判定依据
- ❌ "目录名冲突所以放外层"—— 不要为了回避冲突打乱归属
- ❌ 把"建议共用"误判为"已共用"—— 必须有 grep 证据
- ❌ detail.vue / fill.vue / index.vue 出现 >10 行的 inline enum 数组或 Descriptions items 数组却未拆到 `addOrEdit/enum/` 或 `addOrEdit/config/`—— 必须拆
- ❌ `const descItems = computed(() => [...纯静态字面量...])` —— computed 包静态 = 无意义 computed 包装 = 反模式，必须**去 computed + 抽 config**（行数任意；参考模式 2 表格）

## 何时回退判定

如果用户给的产品需求/技术约束明确要求放特定位置（如"这个工具未来要跨模块用，先放外层"），以**用户要求**为准，但需要在 Javadoc 注明"未来提升至 share 包的计划"。

## 内层 enum/config 触发条件（高频遗漏点）

**原则**：`addOrEdit/*.vue` 出现以下 4 种模式时**必须拆**到 `addOrEdit/{enum,config}/`：

### 模式 1：inline 枚举选项数组（→ enum/）

| 特征 | 阈值 | 示例 |
|---|---|---|
| `const FOO_OPTIONS = [{ value, label }, ...] as const` | 行数 ≥5 行 | `STORE_COUNT_OPTIONS`（5 个选项 + 1 个 type） |
| `type Foo = typeof FOO_OPTIONS[number]["value"]` | 紧跟 OPTIONS 声明 | `StoreCountBucket` type |

### 模式 2：Descriptions items 数组（→ config/）

| 特征 | 阈值 | 示例 |
|---|---|---|
| `const descItems = [{ prop, label, span }, ...]` | 行数 ≥10 行 + 仅 1 个 .vue 用 | `baseDescItems`（12 行） |
| `const descItems = computed(() => [...纯静态字面量...])` | **行数任意**（computed 包纯静态 = 无意义 computed 包装 = 反模式，必须**去 computed + 抽 config**）| `statusDescItems`（5 行但 computed 包装） |
| `function descItemsFactory(item)` 工厂 | 行数 ≥10 行 | `storeCardItems` factory |
| `function descDataFormatter(item)` 工厂 | 行数 ≥10 行 | `storeCardData` factory |

**为什么 computed 包纯静态是反模式**：
- computed 依赖响应式源才能发挥缓存/依赖追踪作用；纯静态字面量无任何依赖图 → 包装无意义
- 占 response 状态位，每次 setup 执行都多算一次（虽然有缓存但概念是误用）
- 抽到 config 后该文件是一份**只读 const**，模板 import 直接用，更清晰

**判定顺序**（口诀：**先看 computed，再看行数**）：
1. 命中 `computed(() => [...])` + 内部无 props/reactive/函数 → **必抽 config + 去 computed**（不管行数）
2. 未用 computed + 行数 ≥10 → **抽 config**（行数阈值）
3. 未用 computed + 行数 <10 → 留 .vue（不拆）
4. 命中 `computed(() => ({ ... 依赖 props.xxx ... }))` → **不拆**（真 computed，参考模式 4）

### 模式 3：DynamicForm items 数组（→ config/）

| 特征 | 阈值 | 示例 |
|---|---|---|
| `const formItems = computed<FormItemConfig[]>(() => [...])` | 行数 ≥15 行 + 仅 1 个 .vue 用 | index.vue 的 `formItems` 12 行（**边缘**，可视上下文决定） |
| `const rules = { ... }` 校验规则对象 | 行数 ≥10 行 | （边缘，校验规则一般紧贴表单保留） |

### 模式 4：computed 表单辅助（→ 不拆）

| 特征 | 原因 |
|---|---|
| `const xData = computed(() => ({...}))` 依赖 reactive 状态 | 必须留 .vue（computed 依赖响应式） |
| `function logValue(log, keys)` 依赖 runtime 参数 | 留 .vue |

### 模式 5：顶栏 header 配置（→ config/，**不建 menu/**）

| 特征 | 阈值 | 拆到哪里 |
|---|---|---|
| `<div class="sticky top-0 ...">` 顶栏容器 class | ≥3 行 + ≥2 个 .vue 重复 | `addOrEdit/config/index.ts` 常量 |
| 顶栏标题 / 状态标签 / 按钮文案常量 | ≥2 个 .vue 复用同一文本 | `addOrEdit/config/index.ts` 常量 |
| 顶栏右侧 el-button / LoadingButton v-if 组合 | ≥2 个按钮 v-if 条件 + ≥3 个页面共用 | `addOrEdit/config/index.ts` factory |

### 模式 6：组件级 form rules 抽出（→ config/，factory）

适用场景：`addOrEdit/components/*.vue` 内联 `const rules: FormRules = {...}`，包含自定义 validator（去重 / 异步校验 / 格式正则）或依赖组件 props。

| 特征 | 阈值 | 拆到哪里 |
|---|---|---|
| `const rules: FormRules = {...}` 组件级表单校验对象 | rules ≥7 行 + 包含自定义 validator（去重 / 异步 / 格式正则）或依赖组件 props | `addOrEdit/config/index.ts` 的 `getXxxFormRules(ctx)` factory |
| rules 仅是普通必填 + 长度校验（无 validator + 无 props 依赖） | —— | **不拆**（组件保留 inline，可随组件一起阅读） |

**工厂签名**（依赖 props 传 ctx）：
```ts
export function getSubAccountFormRules(ctx: {
  existing: OnboardingSubAccount[]
  editingIndex: number
}): FormRules
```

**组件侧使用**：
```ts
// 子组件只需一行
const rules = getSubAccountFormRules({ existing: props.existing, editingIndex: props.editingIndex ?? -1 })
```

### 检查命令（自动扫 inline 模式）

```bash
# 扫 .vue 中所有"似乎可拆"的 inline 数组/对象声明
grep -rn "const.*OPTIONS.*=" src/pages/<业务块>/addOrEdit/*.vue 2>&1
grep -rn "const.*Items.*=" src/pages/<业务块>/addOrEdit/*.vue 2>&1
grep -rn "function.*Items.*(" src/pages/<业务块>/addOrEdit/*.vue 2>&1

# 扫顶栏 header 重复（config/ 触发）
grep -rn "sticky top-0 z-10" src/pages/<业务块>/addOrEdit/*.vue 2>&1
grep -rn "flex items-center justify-between px-6 py-4 bg-white border-b" src/pages/<业务块>/addOrEdit/*.vue 2>&1

# 扫组件级 FormRules inline（检查 11 触发）
grep -rn "const rules.*FormRules\|: FormRules =" src/pages/<业务块>/addOrEdit/components/*.vue 2>&1
```

如果命中 .vue 文件中存在 `as const` / `Descriptions items` / `sticky top-0` 模式但未对应 `addOrEdit/{enum,config}/index.ts` 中的 export，**标记违规**。

## 批量扫描与提取

本文档只讲**单变量归属判定**。批量扫是**附录**的事——见 `references/08-appendix-remediation.md`（一次性现状清理脚本 + 流程）。**新代码必须遵守** `08-no-inline-enum-in-vue.md` 规范，**不要**先写 .vue 再批量清理。

**type/interface 集中**（目标 9）见：
- 预防规范：`references/09-no-inline-type-in-vue.md`
- 一次性清理附录：`references/09-appendix-remediation.md`
- A 选项下（user explicit 授权），`apis/type.ts` + `addOrEdit/apis/type.ts` 退化为 `import type { ... } from "../types"` re-export 壳。