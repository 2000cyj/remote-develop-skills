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
| **表单校验规则**（如 `FORM_RULES` 常量） | 仅 1 个 .vue 用，且总行数 ≥7 行 | **内层** `addOrEdit/config/` |
| **组件级 form rules 工厂**（如 `getSubAccountFormRules(ctx)`——抽 `addOrEdit/components/*.vue` 的 `rules: FormRules`，依赖 props 传 ctx） | `addOrEdit/components/*.vue` 的 rules ≥7 行 + 包含自定义 validator（去重 / 异步校验 / 格式正则）或依赖组件 props | **内层** `addOrEdit/config/`（**与 FORM_RULES 同质**，仅作用域不同：页面级 vs 组件级） |
| **顶栏 UI 资源 + actions 工厂**（如 `PAGE_HEADER_CLASSES` 常量 + `DETAIL_HEADER_TITLE` 文案 + `getDetailHeaderActions(ctx)` 工厂） | ≥3 行 inline 顶栏 container class 重复 + ≥2 个 .vue 复用同一标题文本 / ≥2 个按钮 v-if + ≥3 个页面共用 actions | **内层** `addOrEdit/config/`（与表单 items / 描述项 同质，**只用一个目录**，**不建 `addOrEdit/menu/`**） |
| **业务块共用字典/枚举**（如 `AUDIT_STATUS` / `ONBOARDING_PLATFORMS`） | 业务块共用 | **外层** `enum/` |
| **跨模块共用字典**（如 `ONBOARDING_PLATFORMS` 被 AccountChangeDetails 引用） | 跨模块共用证据 → 提升优先级 | **外层** `enum/` |
| **内层筛选选项**（如 `STORE_COUNT_OPTIONS` + `StoreCountBucket` type——detail.vue 内的下拉筛选条件） | 仅 1 个 addOrEdit .vue 用 + 行数 ≥5 行 + 无 reactive 依赖 | **内层** `addOrEdit/enum/` |
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

## 判定口诀

> **主接口外层放，辅助下拉内层放。跨页面必外层，单页面必内层。**

## 反模式（不要做）

- ❌ "先放着外层以后再挪"——首次就该正确
- ❌ "反正只有 1 个调用方"—— 单调用方也是内层判定依据
- ❌ "目录名冲突所以放外层"—— 不要为了回避冲突打乱归属
- ❌ 把"建议共用"误判为"已共用"—— 必须有 grep 证据
- ❌ detail.vue / fill.vue / index.vue 出现 >10 行的 inline enum 数组或 Descriptions items 数组却未拆到 `addOrEdit/enum/` 或 `addOrEdit/config/`—— 必须拆

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
| `const descItems = [{ prop, label, span }, ...]` | 行数 ≥10 行 + 仅 1 个 .vue 用 | `baseDescItems`（10 行） |
| `function descItemsFactory(item)` 工厂 | 行数 ≥10 行 | `storeCardItems` factory |
| `function descDataFormatter(item)` 工厂 | 行数 ≥10 行 | `storeCardData` factory |

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