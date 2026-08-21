# fileExpiration 子模块 - 提交前代码审查报告

**审查日期**：2026-08-05
**审查范围**：`src/pages/fileExpiration/` 全模块
**审查者**：code-reviewer（只读）
**审查依据**：
- `src/pages/fileExpiration/apis/index.ts`（260 行）
- `src/pages/fileExpiration/apis/type.ts`（181 行）
- `src/pages/fileExpiration/utils/index.ts`（51 行）
- `src/pages/fileExpiration/ruleManagement/apis/index.ts`（118 行）
- `src/pages/fileExpiration/ruleManagement/apis/type.ts`（86 行）
- 引用关系通过 codegraph `analyze_calls` + 全文 grep 验证

---

## 🔴 高严重度

### H1. 两个 `FileExpirationRule` 接口字段不一致（核心类型冲突）

**位置**：
- `src/pages/fileExpiration/apis/type.ts:72-88`（父级 `FileExpirationRule`）
- `src/pages/fileExpiration/ruleManagement/apis/type.ts:19-36`（ruleManagement 本地 `FileExpirationRule`）

**问题描述**：
两份同名 interface 字段定义不同：

| 字段 | 父级 apis/type.ts | ruleManagement/apis/type.ts | 实际接口后端返回 |
|---|---|---|---|
| 主键字段 | `uniqueId: string` | `uniqueValue: string` | `uniqueValue`（ruleManagement 实际使用） |
| `reminderDays` | `number[]` | `string[]` | 字符串（ruleManagement 走的就是 `string[]`） |
| `reminderRecipientNameList` | 缺失 | `?: string[]` | ruleManagement 模板用 `row.reminderRecipientNameList` |
| `id` | `number`（必有） | `number`（必有） | 一致 |

`FileExpirationRuleSave` 也有同样的分裂：
- 父级：`id?: number`（无主键字段）
- ruleManagement：`uniqueValue?: string`（无 id 字段）

**触发场景**：
- 现在 ruleManagement 走的是本地 `ruleManagement/apis/type.ts` 链路，**表面上看运行正常**。
- 但 `fileExpiration/index.vue`、`fileExpiration/config/index.ts`、`fileExpiration/components/SetExpirationModal.vue`、`fileExpiration/enum/index.ts` 等 4 处都从父级 `apis/type.ts` 导入 `FileExpirationRule`。
- 一旦将来把规则入口合并到主列表（例如列表里直接做"按规则筛选"或"跳转到规则"），父级类型与 ruleManagement 类型会冲突：开发会拿到错误的 `uniqueId` 字段、错误的 `reminderDays: number[]` 类型，编译能过、运行时报 undefined 或后端字段绑定失败。
- 父级 `apis/index.ts` 的 `addRuleApi / updateRuleApi` 即使被调用，也无法回传 `uniqueId`（父级 `FileExpirationRuleSave` 没有这个字段），后端拿不到主键 → 编辑态必失败。

**修复建议**：
- 立即统一类型：把 `FileExpirationRule` / `FileExpirationRuleSave` 等规则相关 interface 收敛到父级 `apis/type.ts`，字段名按 ruleManagement 的真实数据 `uniqueValue: string` / `reminderDays: string[]` 对齐。
- 删掉 `ruleManagement/apis/type.ts`，让 `ruleManagement/index.vue`、`ruleManagement/config/index.ts`、`ruleManagement/components/RuleDialog.vue` 改为从 `../../apis/type` 导入。
- 同时把 `apis/index.ts` 里的 `queryRuleByUniqueIdApi` / `deleteRuleApi` / `toggleRuleApi` 也改名为 `UniqueValue` 版本（详见 H2）。

---

### H2. 父级 `apis/index.ts` 中 6 个规则 API 函数为死代码，且与后端契约不一致

**位置**：`src/pages/fileExpiration/apis/index.ts:91-142`

**问题描述**：
父级 `apis/index.ts` 重新声明了 6 个规则 API 函数，但全项目 grep 后确认**没有调用方**（ruleManagement 全部从自己的 `ruleManagement/apis/index.ts` 导入）：

| 函数 | 父级实现 | 实际使用位置 |
|---|---|---|
| `pageRuleApi` | 调用 `/api/cashier/fileExpiry/pageRule` | ruleManagement/index.vue 走本地版本 |
| `queryRuleByUniqueIdApi` | 调用 `/queryRuleByUniqueId`，参数 `uniqueId` | 无调用方 |
| `addRuleApi` | 调用 `/addRule` | ruleManagement/components/RuleDialog.vue 走本地版本 |
| `updateRuleApi` | 调用 `/updateRule` | ruleManagement/components/RuleDialog.vue 走本地版本 |
| `deleteRuleApi` | 调用 `/deleteRule`，参数 `uniqueId` | ruleManagement/index.vue 走本地版本（传 `uniqueValue`） |
| `toggleRuleApi` | 调用 `/toggleRule`，参数 `uniqueId` | ruleManagement/index.vue 走本地版本（传 `uniqueValue`） |

后端实际契约是 `uniqueValue`（ruleManagement/apis/index.ts:22-64 一致），父级却叫 `uniqueId`，**如果将来被错误地使用，会 404 或后端字段绑定失败**。

**触发场景**：
- 短期：不影响运行（没人调用），但代码维护成本翻倍、未来新成员误用概率高。
- 长期：6 个 API 在两个文件里维护，两边实现会逐渐 drift（已经出现接口名差异：父级 `queryRuleByUniqueId`、子级 `queryRuleByUniqueValue`）。

**修复建议**：
- 父级 `apis/index.ts` 只保留"列表+记录"相关 API（`pageConfiguredApi / setExpirationApi / queryRecordByUnNameApi / cancelExpirationApi / replaceFileApi / previewFileApi`）。
- 父级 `apis/index.ts` 的"规则"区段（91-142 行）整段删除，规则相关 API 只在 `ruleManagement/apis/index.ts` 维护。

---

### H3. `cashierPageQueryUserApi` 及其类型在两个文件中重复定义

**位置**：
- `src/pages/fileExpiration/apis/index.ts:221-259`
- `src/pages/fileExpiration/ruleManagement/apis/index.ts:73-117`

**问题描述**：
两个文件都 export 了同名函数 `cashierPageQueryUserApi` 和同名 interface `CashierUserItem / CashierUserPageResult / CashierUserQuery`，实现完全相同。

实际调用方：
- `SetExpirationModal.vue:7` import 自 `../apis`（父级）
- `RuleDialog.vue:5` import 自 `../apis`（ruleManagement 本地）

**触发场景**：
- 短期：两个文件实现相同，TypeScript 静态分析能过。
- 长期：父级与 ruleManagement 各有一份，函数契约（如 `page_num` 默认值、是否带 `selectedUsernames`、超时）会逐渐 drift。
- 已有 drift 苗头：父级 `CashierUserQuery` 的注释"编辑回显：补全首页 30 条之外的历史匹配标签"与 ruleManagement 的注释"RuleDialog，支持按昵称远程搜索"侧重点不同，未来两边注释/参数演进方向不一致。

**修复建议**：
- 把 `CashierUserItem / CashierUserPageResult / CashierUserQuery` 和 `cashierPageQueryUserApi` 收敛到父级 `apis/index.ts`。
- `ruleManagement/apis/index.ts` 改为 `export { cashierPageQueryUserApi } from "../apis"`，类型 `import type` 自 `../apis/type`（前提是 H1 修复后 type.ts 统一）。

---

### H4. `getDaysRemaining` 在 UTC- 时区下日期偏移 1 天

**位置**：`src/pages/fileExpiration/utils/index.ts:6-13`

**问题描述**：
```ts
const today = new Date()
today.setHours(0, 0, 0, 0)            // 本地零点
const expiry = new Date(expiryDate)    // 纯日期字符串按 ISO-8601 → UTC 零点
expiry.setHours(0, 0, 0, 0)            // 强制改成本地零点
```

`new Date("2026-08-15")` 按 ECMAScript 规范是 UTC 零点（ISO date-only 形式）。对 `expiry` 再调 `setHours(0,0,0,0)` 在不同时区下结果不同：
- UTC+8（东八区）：UTC 零点 = 本地 08:00，再 `setHours(0)` 仍是 `2026-08-15` → 正确
- UTC-5（西区）：UTC 零点 = 本地前一日 19:00，再 `setHours(0)` 变成 `2026-08-14` → 差 1 天
- 极端时区（如 UTC-12）可能差更多

`today` 走的是 `new Date()` 后 `setHours(0,0,0,0)`，是本地当天，**不会有时区偏移**。

**触发场景**：
- 出纳子应用用户多在国内（UTC+8）→ 实际不会触发，但若用户/系统时区不是 UTC+，**所有"剩余天数"都少算 1 天**。
- 典型表现：用户上传了"今天到期"的文件，列表里显示"-1 天"（已过期 1 天）。
- 进一步影响 `getDaysRemainingText`（"已过期 N 天"多算）、`getDaysRemainingColor`（红色区间偏移）、以及任何依赖 `getDaysRemaining` 的列表样式。

**修复建议**（任选一种）：
1. 解析时用 UTC：
   ```ts
   const expiry = new Date(`${expiryDate}T00:00:00Z`)
   const today = new Date()
   today.setUTCHours(0, 0, 0, 0)
   return Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
   ```
2. 字符串解析用 `Date.UTC`：
   ```ts
   const [y, m, d] = expiryDate.split("-").map(Number)
   const expiryMs = Date.UTC(y, m - 1, d)
   const todayMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
   ```
3. 直接用 `dayjs(expiryDate).startOf("day").diff(dayjs().startOf("day"), "day")`（若项目有 dayjs 依赖）。

---

## 🟡 中严重度

### M1. `queryRuleByUniqueIdApi` URL 与后端不一致

**位置**：`src/pages/fileExpiration/apis/index.ts:100-106`

**问题描述**：
```ts
export function queryRuleByUniqueIdApi(uniqueId: string) {
  return request<...>({ url: `${BASE}/queryRuleByUniqueId`, method: "post", params: { uniqueId } })
}
```

而 ruleManagement/apis/index.ts:22-28 实际调的是 `/queryRuleByUniqueValue` + 参数 `uniqueValue`。
当前函数无人调用（详见 H2），但若按这个函数调用，后端 404。

**触发场景**：
- 暂时不触发（死代码）。
- 未来若有人按父级实现照抄，必踩坑。

**修复建议**：随 H2 一起删掉此函数。

---

### M2. `handleSaveExpiration` 使用 `as unknown as` 强转

**位置**：`src/pages/fileExpiration/index.vue:373`

**问题描述**：
```ts
await setExpirationApi({ ...payload, unNameList } as unknown as Parameters<typeof setExpirationApi>[0])
```

`ExpirationPayload` 定义：
```ts
interface ExpirationPayload {
  expiryDate: string
  reminderDays: string[]
  reminderMethods: string[]       // ← string[]，不是 ReminderMethod[]
  reminderRecipients: string[]
}
```

`FileExpirationSetDTO.reminderMethods: ReminderMethod[]`（即 `"dingtalk"[]`），两边类型不一致，强转逃过类型检查。

**触发场景**：
- 当前数据是 `"dingtalk"` 字符串，运行时不出问题。
- 将来若 `ReminderMethod` 联合扩展（如加 `"sms"`），`ExpirationPayload` 不会自动同步，开发/编译都发现不了。
- 强转本身违反项目 "避免 any/unknown" 规范（见 cashier `.claude/CLAUDE.md`）。

**修复建议**：
- 把 `ExpirationPayload.reminderMethods` 改为 `ReminderMethod[]`：
  ```ts
  import type { ReminderMethod } from "./apis/type"
  interface ExpirationPayload {
    expiryDate: string
    reminderDays: string[]
    reminderMethods: ReminderMethod[]
    reminderRecipients: string[]
  }
  ```
- 同时 `SetExpirationModal.vue:13` 的 `reminderMethods: string[]` 也改为 `ReminderMethod[]`，并校验 UI 上只能勾选 `"dingtalk"`。
- 移除 `as unknown as` 强转。

---

### M3. `RuleDialog.vue` 中 `resetForm` 在 `onMounted` 后才声明（顺序敏感）

**位置**：`src/pages/fileExpiration/ruleManagement/components/RuleDialog.vue:165-167`、`:219-233`

**问题描述**：
```vue
onMounted(async () => {
  resetForm()       // line 166
  ...
})

function resetForm() {   // line 219，函数声明在 onMounted 之后
  Object.assign(form, { ... })
}
```

目前因为是 `function` 声明（hoisted）能跑通，但：
- ESLint 规则如果把 `no-use-before-define` 调到 error 级别，会报错。
- 项目 `ESLINT_RULES.md` 提到 antfu 默认开启 `no-use-before-define` 为 error（不同 antfu preset 配置不同，需要确认）。
- 后续若把 `resetForm` 改成 `const resetForm = () => {}` 就会直接运行时 `ReferenceError`。

**修复建议**：
- 把 `resetForm` 提到 `onMounted` 之前声明（按调用顺序阅读最自然）。
- 同步检查 `applyDetail`（line 213/239）也有同样顺序问题，建议一并提前。

---

### M4. `handleFileTagVisibleChange` 中 setTimeout 在组件卸载后仍会触发

**位置**：
- `src/pages/fileExpiration/index.vue:150-154`
- `src/pages/fileExpiration/ruleManagement/components/RuleDialog.vue:151-155`

**问题描述**：
```ts
if (prevFileTagOptions.value.length > 0) {
  setTimeout(() => {
    fileTagOptions.value = prevFileTagOptions.value
  }, 300)
}
```

300ms 魔法数（猜测是 el-select 关闭动画时长）。若用户在下拉关闭动画结束前就关闭弹窗/路由跳转：
- `setTimeout` 回调仍会执行，访问/修改已卸载组件的 ref → 内存泄漏（虽然 Vue 3 对 ref.value 赋值不会抛错，但产生了无效赋值）。
- 多个 `setTimeout` 排队可能导致关闭/打开交替时的 race condition（旧 timeout 把新一批数据回滚）。

**修复建议**：
- 用 `onBeforeUnmount` 清理 timeout：
  ```ts
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  function handleFileTagVisibleChange(visible: boolean) {
    ...
    if (prevFileTagOptions.value.length > 0) {
      closeTimer && clearTimeout(closeTimer)
      closeTimer = setTimeout(() => {
        fileTagOptions.value = prevFileTagOptions.value
        closeTimer = null
      }, 300)
    }
  }
  onBeforeUnmount(() => closeTimer && clearTimeout(closeTimer))
  ```
- 把 300ms 抽成常量或读 el-select 配置。

---

### M5. 父级 `apis/index.ts` 中 `queryRecordByUnNameApi` 注释与 URL 字段含义不清晰

**位置**：`src/pages/fileExpiration/apis/index.ts:37-47`

**问题描述**：
```ts
/**
 * 文件到期记录详情（POST /queryRuleByUnName，按 unName 查询）
 *  ...
 */
export function queryRecordByUnNameApi(unName: string) {
  return request<ApiEnvelope<FileExpirationRecord>>({
    url: `${BASE}/queryRuleByUnName`,
    ...
  })
}
```

- 函数名是 `queryRecordByUnNameApi`（"记录"），但 URL 是 `queryRuleByUnName`（"规则"），名称与 URL 含义不对齐，未来维护者容易混淆。
- 不影响运行，但配合 H1/H2 的接口命名混乱（`queryRuleByUniqueId` vs `queryRuleByUniqueValue`），整体命名一致性已经下降。

**修复建议**：
- 短期：补一行注释说明 "URL 路径命名延续后端 `queryRuleByUnName`"。
- 长期：和后端对齐 URL 命名规则（建议 /queryRecordByUnName）。

---

## 🟢 低严重度

### L1. `formatRecipients` 在父级和 ruleManagement 重复定义

**位置**：
- `src/pages/fileExpiration/utils/index.ts:46-50`
- `src/pages/fileExpiration/ruleManagement/utils/index.ts:5-10`

**问题描述**：两个 `formatRecipients` 实现完全相同：
```ts
export function formatRecipients(names: string[] | undefined | null): string {
  if (!names || names.length === 0) return "-"
  if (names.length > 2) return `${names.slice(0, 2).join("、")} 等${names.length}人`
  return names.join("、")
}
```

**触发场景**：现在两处都正确；将来两边文案微调（"等 N 人" 改 "等 N 位"），必然 drift。

**修复建议**：
- 删 `ruleManagement/utils/index.ts` 的 `formatRecipients`，让 ruleManagement/index.vue:25 改为从 `../../utils` 导入。
- ruleManagement/utils 只保留规则管理特有的 `formatValidity`（年/月/天）。

---

### L2. 重复的枚举与基础类型

**位置**：
- `src/pages/fileExpiration/apis/type.ts:9-19` 与 `src/pages/fileExpiration/ruleManagement/apis/type.ts:7-14`
- `src/pages/fileExpiration/apis/type.ts:120-133` 与 `src/pages/fileExpiration/ruleManagement/apis/type.ts:71-85`

**问题描述**：
以下类型/接口在两份 type 文件中重复定义，且实现一致：
- `type FileSourceModule`
- `type ReminderMethod`
- `type TagMatchType`
- `interface SelectOption<V = string>`
- `interface PageResult<T>`
- `interface ApiEnvelope<T>`
- `interface FileExpirationRulePageQuery`

`FileExpirationRulePageQuery` 在父级 type.ts:158-164 缺 `enabled` 字段的说明，但 ruleManagement 实际通过 `enabled` 搜索（ruleManagement/index.vue:80），靠的是 `formatParams` 兜底；长期会形成隐藏的"两份类型契约"。

**修复建议**：随 H1 统一，删 ruleManagement/apis/type.ts，让所有规则管理代码从父级 `apis/type.ts` 导入。

---

### L3. `listAllFileTagsApi` 与 `listAllFileTagsByModulesApi` 接口重复

**位置**：`src/pages/fileExpiration/apis/index.ts:186-204`

**问题描述**：两个函数几乎一致，差异仅在入参 `sourceModule: string` vs `sourceModules: string[]`。前者是单值（"company"），后者是数组（["company","store"]）。当前两个函数被分别调用：
- `RuleDialog.vue:115` → `listAllFileTagsApi({ sourceModule: form.sourceModule })`
- `fileExpiration/index.vue:120` → `listAllFileTagsByModulesApi({ sourceModules: searchForm.sourceModules })`

**触发场景**：当前正确，但单值版用得不必要（ruleDialog 也可以传数组）；`sourceModule` 与 `sourceModules` 两个参数名容易拼写错。

**修复建议**：保留 `listAllFileTagsByModulesApi` 一个函数，`sourceModule` 单值场景传 `sourceModules: [form.sourceModule]`。但属于低优，未来如果后端 /listAllFileTags 标记 deprecated 再合并。

---

### L4. `CashierUserQuery` 中 `page_num` / `page_size` 命名风格不统一

**位置**：
- `src/pages/fileExpiration/apis/index.ts:242-244`
- `src/pages/fileExpiration/ruleManagement/apis/index.ts:94-96`

**问题描述**：
项目其余 `FileExpirationPageQuery` / `FileExpirationRulePageQuery` 一律用 camelCase（`pageNum` / `pageSize`），但 `CashierUserQuery` 用 snake_case（`page_num` / `page_size`），因为后端 `@NotNull` 字段名是 snake_case。
这是**有意识**的选择（保持请求体字段名与后端一致），不算 bug，但容易在 `formatParams` / 转换层被改坏。

**修复建议**：保留现状，但加一行 JSDoc 注明"snake_case 故意保留，与后端 @NotNull 字段对齐"。

---

### L5. `RuleDialog.vue:264` 编辑模式 `payload.uniqueValue` 设置后无显式去除 `id`

**位置**：`src/pages/fileExpiration/ruleManagement/components/RuleDialog.vue:262-272`

**问题描述**：
```ts
const payload: FileExpirationRuleSave = { ...form }
if (props.editing && props.editingUniqueValue) {
  payload.uniqueValue = props.editingUniqueValue
  await updateRuleApi(payload)
  ...
}
```

`FileExpirationRuleSave` 在 ruleManagement/apis/type.ts:39 定义了 `uniqueValue?: string`，但**没有 `id` 字段**。
父级 apis/type.ts:91-104 的 `FileExpirationRuleSave` 反而有 `id?: number`。

`{ ...form }` 后 form 没有 `id`（form 类型推导自 `FileExpirationRuleSave`，本地版无 id），所以不会带上 id，不会有副作用。

**触发场景**：当前不会触发（form 没有 id 字段）。但若 H1 修复后类型统一为父级版（带 `id?: number`），`{ ...form }` 会带上 form 的 id（form 默认值没 id，但用户编辑时 form 不会主动塞 id），整体无影响。
- 隐患：父级版 `FileExpirationRuleSave` 缺 `uniqueValue` 字段，updateRule 会丢主键（详见 H1 修复建议）。

**修复建议**：随 H1 一并修复。

---

## 无问题清单（确认 OK 的项）

下面这些点已逐一检查，**未发现 bug**：

- ✅ **API 参数规则（<3 form-data，>=3 JSON body）**：
  - `queryRecordByUnNameApi(unName)` 单参数 → `params` ✓
  - `cancelExpirationApi(unName)` 单参数 → `params` ✓
  - `previewFileApi(unName)` 单参数 → `params` ✓
  - `queryRuleByUniqueIdApi(uniqueId)` / `deleteRuleApi(uniqueId)` / `toggleRuleApi(uniqueId, enabled)` → 2 个以内参数 → `params` ✓
  - `addRuleApi(data)` / `updateRuleApi(data)` / `pageRuleApi(data)` / `setExpirationApi(data)` / `pageConfiguredApi(data)` / `replaceFileApi(data)` / `listAllFileTagsApi(data)` 等多字段 → `data`（JSON body）✓

- ✅ **响应数据处理**：所有调用方都正确从 `res.data` 解构，`res.data?.records` 都有 `|| []` 兜底，无 undefined 风险（`fileExpiration/index.vue:124-125`、`ruleManagement/index.vue:56-57`、`RuleDialog.vue:93-94/119-122/188-189/204-208`）。

- ✅ **`v-for:key`**：所有 `v-for` 都带 `:key`，无缺失（`SetExpirationModal.vue:240/281`、`RuleDialog.vue:317/332/370/407/422/455`、`fileExpiration/index.vue:477`、`ruleManagement/index.vue:195/202/210/218/224`）。

- ✅ **`isImageFile` 工具**（`utils/index.ts:33-37`）：data URL 与文件后缀双分支，逻辑正确。

- ✅ **`formatReminderDays`**（`utils/index.ts:40-43`）：空值兜底、正常格式化都正确。

- ✅ **`useListPage` 集成**：`listReqSeq` + `STALE_SENTINEL` 防过期请求覆盖（`fileExpiration/index.vue:192-244`），是当前模块里质量较高的一段。

- ✅ **`SetExpirationModal.vue` 编辑回显**：先 `queryRecordByUnNameApi` 拿详情，再用 `usernames` 批量查 `cashierPageQueryUserApi` 补全下拉（`:82-95`），链路完整。

- ✅ **Pinia / 路由 / 全局 store**：本模块使用 `useListPage` + `usePageWatermark` 走 share 共享组件，未私自改路由或 store，约束严格。

- ✅ **ESLint 风格**：双引号、无分号、2 空格缩进，scan 一致。

- ✅ **`RuleDialog.vue` 表单校验**：4 个必填项（matchTags/reminderDays/reminderMethods/reminderRecipients）都有 validator 兜底，validityDays 是 number，OK。

- ✅ **`fetchRuleList` 适配器**（`ruleManagement/index.vue:51-60`）：把 `res.data.records` 重映射给 `useListPage` 期望的 `records`，符合 share 契约。

- ✅ **`ruleManagement/index.vue:97` `handleToggle`** 失败回滚（`row.enabled = !enabled`）逻辑正确。

---

## 总结

**核心问题**：
1. **H1+H2+H3** 三处高度相关的"重复 + 不一致"问题：父级 `apis/index.ts` 和 `ruleManagement/apis/index.ts` 重复声明了规则相关的 API + 类型，且字段命名（`uniqueId` vs `uniqueValue`）、类型（`reminderDays: number[]` vs `string[]`）已经漂移。**这套漂移是将来引入 bug 的最大温床**。
2. **H4 `getDaysRemaining` 时区偏移**是真 bug，只是因为用户多在 UTC+8 才没暴露。

**建议优先级**：
1. 必修：H1（统一类型）、H2（删除死代码）、H3（统一 `cashierPageQueryUserApi`）、H4（时区 bug）
2. 应修：M2（删除 `as unknown as` 强转）、M3（`resetForm` 顺序）
3. 建议修：M1/M5（注释和命名对齐）、L1-L2（重复类型）
4. 可选：L3-L5（微调）

**审查范围外（不在本次清单，仅备查）**：
- `src/pages/fileExpiration/index.vue` 全量逻辑、`config/index.ts` 列/搜索配置、`enum/index.ts` 字典、组件内部（已抽样检查关键路径，未发现 bug）。
- `ruleManagement/config/index.ts`、`ruleManagement/enum/index.ts` 未深入审查，但类型定义部分已被 H1/H2 间接覆盖。
- 共享组件 `useListPage` / `usePageWatermark` / `PageVxeTable` / `renderDialog` 的实现细节未审查（属 share 仓库范围）。
