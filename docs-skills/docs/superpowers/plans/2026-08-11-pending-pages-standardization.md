# 当前未提交页面规范化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 cashier 业务 API 语义、权限码和受保护目录的前提下，规范化当前未提交改动涉及的页面结构，并修复已确认的审核与子账号高风险回归。

**Architecture:** 保留现有 Vue 3 + Pinia + Element Plus + `@ob-web/share` 页面模式。通过文件移动和 import 调整统一页面边界；审核详情复用现有 API、由命令式弹窗的 Promise 负责提交闭环；店铺子账号在现有保存接口契约允许的范围内完成前端调用编排，后端和数据库不纳入本计划。

**Tech Stack:** Vue 3.5, TypeScript, Vite 7, Element Plus, `@ob-web/share`, Vue Router 4, pnpm, ESLint, Vitest。

## Global Constraints

- 只处理当前未提交改动涉及的页面和组件：`store`、`companyOffboarding`、`shopOnboarding`、`subAccountChangeLog`、Audit 组件及其直接关联文件。
- 不修改 `src/layouts/**`、`src/pages/login/**`、`src/pages/error/**`、`src/pages/redirect/**`、`src/pages/dashboard/**`。
- 不修改后端、数据库或 SQL。
- 不改变现有路由 name、业务路径、权限码、API 字段语义和响应 envelope。
- cashier 项目已配置 Vue/Vue Router 自动导入；目标文件禁止重复手动导入常用 API。
- Element Plus 图标使用全局 PascalCase 字符串配置；目标文件不新增图标组件 import。
- 页面私有组件放在页面目录或 `addOrEdit/components`；跨模块审核组件放入 `src/common/components`，模块私有组件放入对应模块 `components`。
- 保留用户现有未提交修改，不执行 `git commit` 或 `git push`。
- 每个任务完成后只运行与该任务相关的定向验证，不把全量非源码 ESLint 基线错误误报为本次回归。

---

## 文件与职责地图

- `src/pages/companyOffboarding/index.vue`：公司销户/审核申请列表，负责查询、权限和打开详情/编辑路由。
- `src/pages/companyOffboarding/addOrEdit/index.vue`：公司销户申请新增/编辑表单。
- `src/pages/companyOffboarding/detail/index.vue`：现有公司审核详情页，迁移后作为 `addOrEdit/detail.vue`。
- `src/pages/shopOnboarding/index.vue`：店铺上架申请列表。
- `src/pages/shopOnboarding/addOrEdit/index.vue`：店铺上架申请新增/编辑表单。
- `src/pages/shopOnboarding/detail/index.vue`：现有店铺审核详情页，迁移后作为 `addOrEdit/detail.vue`。
- `src/pages/companyOffboarding/apis/index.ts`、`src/pages/shopOnboarding/apis/index.ts`：审核分页、详情、保存、提交、审批和驳回 API；只修正已确认的前端调用编排，不虚构后端接口。
- `src/components/AuditApprovalDialog.vue`：审批意见内容组件，暴露 `submit(): Promise<boolean>` 给 `renderDialog`。
- `src/components/AuditAttachmentList.vue`、`src/components/AuditNodeIndicator.vue`、`src/components/auditTypes.ts`：两个审核页面共用的展示组件与类型，迁移到 `src/common/components/audit/`。
- `src/pages/store/addOrEdit/addOrEdit.vue`：店铺新增/编辑/详情复用表单及子账号、变更信息接线。
- `src/pages/store/components/ChangeInfoModal.vue`、`SubAccountEditor.vue`：只由店铺表单使用的命令式弹窗内容/编辑器，迁移到 `store/addOrEdit/components`。
- `src/pages/store/apis/index.ts`、`src/pages/store/apis/type.ts`：店铺和子账号请求/DTO 类型；修正新增子账号 endpoint 和前端保存编排所需的最小类型。
- `src/pages/subAccountChangeLog/index.vue`：变更日志列表；移除内联详情 render 函数，仅保留详情请求和打开组件动作。
- `src/pages/subAccountChangeLog/addOrEdit/detail.vue`：新增的只读详情展示组件，接受明确的详情 props。
- `scripts/start-main.mjs`：当前未提交的主应用启动脚本，按项目 ESLint 风格修正，不改变 Node 22 Windows `shell: true` 行为。

---

### Task 1: 建立当前 diff 基线并锁定路由引用

**Files:**
- Inspect: `git status`, `git diff --name-status`, `src/router/**`, `src/pages/**/index.vue`
- Modify: none
- Test: none

**Interfaces:**
- Consumes: 当前工作树状态、动态菜单路由转换结果、现有模块路径。
- Produces: 后续任务使用的文件迁移清单和路由/import 引用清单。

- [ ] **Step 1: 记录工作区基线**

运行：

```bash
cd /d D:/OB/ob_web/packages/micro/cashier
git status --short
git diff --name-status
git ls-files --others --exclude-standard
```

Expected: 只记录当前状态，不清理、暂存或覆盖任何文件。

- [ ] **Step 2: 搜索目标页面引用**

运行：

```bash
rg -n "companyOffboarding|shopOnboarding|subAccountChangeLog|AuditApprovalDialog|AuditAttachmentList|AuditNodeIndicator|ChangeInfoModal|SubAccountEditor" src scripts package.json
```

Expected: 列出路由、页面 import、命令式弹窗和启动脚本引用；将任何 `src/pages/*/detail` 的引用登记为迁移后必须复核的项。

- [ ] **Step 3: 确认动态菜单地址不需要本次修改**

检查 cashier 路由转换和页面组件命名，确认迁移仅改变组件文件路径，保留 route name、menu address 和业务 path。若发现主应用菜单地址依赖旧文件路径，记录为阻塞，不擅自修改主应用。

- [ ] **Step 4: 运行迁移前定向检查**

运行：

```bash
pnpm exec eslint src/pages/store/index.vue src/pages/store/addOrEdit/addOrEdit.vue src/pages/store/components/ChangeInfoModal.vue src/pages/store/components/SubAccountEditor.vue src/pages/companyOffboarding/index.vue src/pages/companyOffboarding/addOrEdit/index.vue src/pages/companyOffboarding/detail/index.vue src/pages/shopOnboarding/index.vue src/pages/shopOnboarding/addOrEdit/index.vue src/pages/shopOnboarding/detail/index.vue src/pages/subAccountChangeLog/index.vue src/components/AuditApprovalDialog.vue src/components/AuditAttachmentList.vue src/components/AuditNodeIndicator.vue scripts/start-main.mjs
```

Expected: 记录现有错误，区分基线错误和本次改动错误；不以失败结果阻止后续结构迁移。

---

### Task 2: 规范化审核页面目录和共用组件归属

**Files:**
- Move: `src/pages/companyOffboarding/detail/index.vue` → `src/pages/companyOffboarding/addOrEdit/detail.vue`
- Move: `src/pages/shopOnboarding/detail/index.vue` → `src/pages/shopOnboarding/addOrEdit/detail.vue`
- Move: `src/components/AuditApprovalDialog.vue` → `src/common/components/audit/AuditApprovalDialog.vue`
- Move: `src/components/AuditAttachmentList.vue` → `src/common/components/audit/AuditAttachmentList.vue`
- Move: `src/components/AuditNodeIndicator.vue` → `src/common/components/audit/AuditNodeIndicator.vue`
- Move: `src/components/auditTypes.ts` → `src/common/components/audit/auditTypes.ts`
- Modify: `src/pages/companyOffboarding/index.vue`, `src/pages/shopOnboarding/index.vue`, `src/pages/companyOffboarding/addOrEdit/detail.vue`, `src/pages/shopOnboarding/addOrEdit/detail.vue`
- Test: route/import search and targeted ESLint

**Interfaces:**
- Consumes: Existing route names and query contract (`id`/`uniqueValue`).
- Produces: Same page components at standard paths; audit components imported through `@/common/components/audit/...`.

- [ ] **Step 1: Create target directories and move files without changing content**

Use plain filesystem moves, not `git mv`, so already-untracked files remain visible:

```bash
mkdir -p src/common/components/audit src/pages/companyOffboarding/addOrEdit src/pages/shopOnboarding/addOrEdit
mv src/pages/companyOffboarding/detail/index.vue src/pages/companyOffboarding/addOrEdit/detail.vue
mv src/pages/shopOnboarding/detail/index.vue src/pages/shopOnboarding/addOrEdit/detail.vue
mv src/components/AuditApprovalDialog.vue src/common/components/audit/AuditApprovalDialog.vue
mv src/components/AuditAttachmentList.vue src/common/components/audit/AuditAttachmentList.vue
mv src/components/AuditNodeIndicator.vue src/common/components/audit/AuditNodeIndicator.vue
mv src/components/auditTypes.ts src/common/components/audit/auditTypes.ts
```

Expected: no source content change yet; old directories/files no longer exist.

- [ ] **Step 2: Update relative API/type imports after detail moves**

In both moved detail files, change imports from `../apis` and `../apis/type` to `../../apis` and `../../apis/type`, because `detail.vue` is now one directory deeper relative to the module root.

- [ ] **Step 3: Update audit component internal type imports**

In `AuditAttachmentList.vue` and `AuditNodeIndicator.vue`, change `./auditTypes` to `./auditTypes` only if both files remain beside the moved type; otherwise use the exact sibling path `./auditTypes`. Keep type names unchanged.

- [ ] **Step 4: Update all page imports**

Change both detail pages and any other callers to:

```ts
import AuditApprovalDialog from "@/common/components/audit/AuditApprovalDialog.vue"
import AuditAttachmentList from "@/common/components/audit/AuditAttachmentList.vue"
import AuditNodeIndicator from "@/common/components/audit/AuditNodeIndicator.vue"
```

- [ ] **Step 5: Update route component paths only where static routes reference the old detail path**

If route config uses direct component imports, point it to `./pages/companyOffboarding/addOrEdit/detail.vue` and `./pages/shopOnboarding/addOrEdit/detail.vue`. Preserve route name/path/meta/permission values exactly. If routes are menu-generated, verify no route file needs editing.

- [ ] **Step 6: Verify no stale references remain**

Run:

```bash
rg -n "pages/.*/detail/index|@/components/Audit|src/components/Audit|auditTypes" src
```

Expected: no stale old audit imports or old detail paths.

- [ ] **Step 7: Run targeted lint**

Run ESLint over the moved files and their callers. Expected: only pre-existing unrelated errors remain; new path/import errors must be fixed before continuing.

---

### Task 3: Close audit approval async and edit/permission correctness gaps

**Files:**
- Modify: `src/common/components/audit/AuditApprovalDialog.vue`
- Modify: `src/pages/companyOffboarding/addOrEdit/detail.vue`
- Modify: `src/pages/shopOnboarding/addOrEdit/detail.vue`
- Modify: `src/pages/companyOffboarding/addOrEdit/index.vue`
- Modify: `src/pages/shopOnboarding/addOrEdit/index.vue`
- Modify: `src/pages/companyOffboarding/index.vue`
- Modify: `src/pages/shopOnboarding/index.vue`
- Test: targeted type/lint plus manual route behavior

**Interfaces:**
- Consumes: Existing `renderDialog` submit contract (`submit(): Promise<boolean>`), existing detail APIs and save APIs, existing `permissions`/`canView`/`canEdit` fields.
- Produces: Approval dialog that awaits `onSubmit(payload)` and returns `true` only on success; edit pages that load detail before update; fail-closed action visibility.

- [ ] **Step 1: Define the dialog callback contract**

Change `AuditApprovalDialog` props to include:

```ts
onSubmit?: (payload: { targetNodeNo?: number, remark: string }) => Promise<boolean | void> | boolean | void
```

Keep `emit` only if another caller needs it; the `renderDialog` path must use the callback directly.

- [ ] **Step 2: Make dialog submission await the callback**

Implement the submit flow as:

```ts
async function submit(): Promise<boolean> {
  if (!form.remark.trim()) {
    ElMessage.warning(...)
    return false
  }
  if (props.action === "reject" && form.targetNodeNo === undefined) {
    ElMessage.warning("请选择驳回节点")
    return false
  }
  submitting.value = true
  try {
    const result = await props.onSubmit?.({
      targetNodeNo: form.targetNodeNo,
      remark: form.remark.trim()
    })
    return result !== false
  } catch {
    return false
  } finally {
    submitting.value = false
  }
}
```

The parent callback must return `true` after the API and `load()` succeed; it must return `false` for invalid reject payloads or API failure.

- [ ] **Step 3: Update both detail pages to pass and return the callback**

For approve/reject callbacks, return `true` only after the corresponding API succeeds and `load()` completes. For reject, return `false` when no target node is supplied. Remove the unused `ElMessage` and `submitOnboardingApi` imports from the shop detail page.

- [ ] **Step 4: Load detail data in edit mode before enabling save**

In each `addOrEdit/index.vue`, derive `uniqueValue` from the route, call the existing detail API when mode is edit/view, and map the response into the existing form state, attachments, nodes/items and `version`. Set a `detailLoaded`/loading guard so `handleSave` returns before API submission when the required detail request failed. Do not replace existing default state for insert mode.

- [ ] **Step 5: Make action permissions fail closed**

Use both the global permission check and an explicit row/detail permission flag. Do not use `row.canView !== false`; require `row.canView === true` for a view action when the field is part of the current API contract. Require `row.canEdit === true` plus the module edit permission for edit. Keep backend authorization as final enforcement.

- [ ] **Step 6: Verify approval and edit behavior**

Manual checks in the main-app shell:

1. Open an approval dialog, submit valid approval, confirm API success closes dialog and refreshes detail.
2. Force API failure, confirm dialog remains open and no unhandled Promise is produced.
3. Open reject dialog without target node, confirm validation blocks submission.
4. Open existing edit item, confirm detail fields/version populate before save.
5. With missing/false row permission flags, confirm view/edit controls are hidden.

---

### Task 4: Move store-private components and repair subaccount persistence contract

**Files:**
- Move: `src/pages/store/components/ChangeInfoModal.vue` → `src/pages/store/addOrEdit/components/ChangeInfoModal.vue`
- Move: `src/pages/store/components/SubAccountEditor.vue` → `src/pages/store/addOrEdit/components/SubAccountEditor.vue`
- Modify: `src/pages/store/addOrEdit/addOrEdit.vue`
- Modify: `src/pages/store/apis/index.ts`
- Modify: `src/pages/store/apis/type.ts`
- Test: targeted API/type/lint and manual store save flow

**Interfaces:**
- Consumes: `SubAccountEditor` `v-model:modelValue`, `ChangeInfoModal` `submit(): Promise<boolean>`, existing store add/update APIs and subaccount API functions.
- Produces: Standard component paths; correct subaccount create endpoint; explicit handling of save/delete operations without claiming persistence when backend ignores unsupported fields.

- [ ] **Step 1: Move components and update imports**

```bash
mkdir -p src/pages/store/addOrEdit/components
mv src/pages/store/components/ChangeInfoModal.vue src/pages/store/addOrEdit/components/ChangeInfoModal.vue
mv src/pages/store/components/SubAccountEditor.vue src/pages/store/addOrEdit/components/SubAccountEditor.vue
```

Update `addOrEdit.vue` imports to `./components/ChangeInfoModal.vue` and `./components/SubAccountEditor.vue`.

- [ ] **Step 2: Remove duplicate Vue and icon imports only in affected store files**

Remove explicit `ref/reactive/computed/watch/onMounted` imports where auto-import is configured. Replace any affected icon component imports with the configured PascalCase string. Do not change the protected or unrelated historical pages.

- [ ] **Step 3: Preserve the editor content contract**

Keep `SubAccountEditor` as a controlled editor with `modelValue` and `update:modelValue`. If it is opened inline by the form, preserve its local `el-dialog`; only remove the wrapper if the actual caller uses `renderDialog` for that editor. Do not alter validation rules or masked-password handling while moving it.

- [ ] **Step 4: Correct the subaccount create endpoint and request shape**

Update the create API to use the confirmed save endpoint:

```ts
POST /api/cashier/store/{uniqueValue}/sub-accounts/save
```

Keep query/detail endpoint separate. Ensure delete requests include the row `version` when the backend contract exposes optimistic locking. Do not leave a create wrapper pointing at the query endpoint.

- [ ] **Step 5: Choose an explicit persistence strategy in the page**

Before showing store-save success, inspect the existing `addStoreAllApi/updateStoreAllApi` response contract. If the backend accepts `subAccounts` in the store save DTO, submit the normalized `SubAccountSavePayload[]` and verify the response code. If it does not, perform the existing subaccount save/delete APIs after the store save succeeds, in sequence, and abort success messaging when any sub-operation fails. Preserve original IDs and versions for edits/deletes; do not silently treat local `modelValue` changes as persisted.

- [ ] **Step 6: Verify subaccount persistence**

Manual checks:

1. Add a new subaccount, save store, reopen detail, and verify it remains.
2. Edit an existing subaccount without entering its masked password, save, and verify the password is not overwritten.
3. Delete an existing subaccount and verify it is absent after reopen.
4. Trigger a stale version response and verify the page does not show overall success.

---

### Task 5: Extract subaccount change-log detail component

**Files:**
- Create: `src/pages/subAccountChangeLog/addOrEdit/detail.vue`
- Modify: `src/pages/subAccountChangeLog/index.vue`
- Create if absent: `src/pages/subAccountChangeLog/enum/index.ts`, `src/pages/subAccountChangeLog/utils/index.ts`
- Test: targeted lint/type check and manual detail opening

**Interfaces:**
- Consumes: `SubAccountChangeAuditDetailVO` returned by `detailSubAccountChangeAuditApi` (or the exact existing detail type in `apis/type.ts`).
- Produces: `SubAccountChangeLogDetail` component with props `{ detail: SubAccountChangeAuditDetailVO }`, used by `renderDialog`.

- [ ] **Step 1: Define the detail component props**

Use the existing detail type, not `any`:

```ts
const props = defineProps<{ detail: SubAccountChangeAuditDetailVO }>()
```

Render the current fields (`storeName`, `businessSource`, `operationType`, `originalAccount`, `newAccount`, `remark`) using the existing labels and `-` fallbacks.

- [ ] **Step 2: Replace inline `h()` rendering**

Remove `h` from `subAccountChangeLog/index.vue`. Keep `detailSubAccountChangeAuditApi` and the non-zero response guard. Pass the result into `renderDialog(SubAccountChangeLogDetail, { detail: res.data }, { title: "子账号变更详情", width: "560px" })`.

- [ ] **Step 3: Add only required fixed directories**

Create `enum/index.ts` and `utils/index.ts` only if project checks require the seven-directory shape and no useful code is invented. Keep them empty only if the repository convention permits empty directories; otherwise move a real operation enum/formatter into them and update imports.

- [ ] **Step 4: Verify detail behavior**

Run the list page in the main-app shell, open a detail row, verify all current fields render and a failed detail request does not open an empty dialog.

---

### Task 6: Normalize startup script and affected imports

**Files:**
- Modify: `scripts/start-main.mjs`
- Modify: all files changed by Tasks 2–5 that still contain affected explicit Vue/Vue Router/icon imports
- Test: ESLint and script smoke check

**Interfaces:**
- Consumes: Existing `start-main.mjs` behavior, including Windows `shell: true`, port cleanup, signal forwarding, and `pnpm run serve:local`.
- Produces: Same startup behavior with project ESLint style.

- [ ] **Step 1: Apply repository ESLint style to script**

Use double quotes, remove trailing commas rejected by the project config, and preserve all process behavior. Do not change the `spawn("pnpm run serve:local", { shell: true })` workaround.

- [ ] **Step 2: Remove only affected unused imports**

Run ESLint on the exact changed paths, remove unused imports reported in those files, and do not modify unrelated historical pages merely because full-repository lint reports them.

- [ ] **Step 3: Smoke-test script without starting a second app**

Run a syntax check:

```bash
node --check scripts/start-main.mjs
```

Expected: exit code 0. Do not run the script if it would kill a user process or start the main app without explicit need.

---

### Task 7: Run verification and report blockers

**Files:**
- Inspect: all changed files
- Modify: only files required to fix verification failures introduced by Tasks 2–6
- Test: cashier build, targeted ESLint, typecheck, test command

**Interfaces:**
- Consumes: completed page/component changes.
- Produces: evidence-based verification report with successful checks and environment blockers separated.

- [ ] **Step 1: Check changed-file status and stale paths**

```bash
git status --short
rg -n "pages/.*/detail/index|@/components/Audit|from \"vue\"|from \"vue-router\"|@element-plus/icons-vue" src/pages/store src/pages/companyOffboarding src/pages/shopOnboarding src/pages/subAccountChangeLog src/common/components/audit scripts
```

Expected: no stale moved paths or prohibited imports in the targeted changed files, except imports explicitly required by a non-auto-imported API such as `ElMessage`.

- [ ] **Step 2: Run targeted ESLint**

```bash
pnpm exec eslint <exact list of changed .vue/.ts/.mjs files>
```

Expected: no new errors in changed files. Record any baseline errors separately.

- [ ] **Step 3: Run type generation/typecheck as configured**

Run the repository’s configured type command. If it fails because shared package declarations are unavailable, record the exact missing declaration and do not claim typecheck passed.

- [ ] **Step 4: Run build**

```bash
pnpm build
```

Expected: production build completes. If it fails, fix only failures caused by this plan; report unrelated environment failures.

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: report the actual result. If Vitest finds no test files, record that as an infrastructure/repository condition rather than a passing test suite.

- [ ] **Step 6: Final diff review**

Review `git diff --stat`, `git diff --check`, and all moved-file imports. Confirm no protected directory, backend, SQL, commit, or push was touched. Report changed files and verification evidence without claiming unverified runtime behavior.
