# Cashier V2 Audit API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace V2 audit and sub-account audit mocks with the documented `/api/cashier/...` endpoints and align request/response contracts used by the existing pages.

**Architecture:** Keep each audit flow's existing `apis/index.ts` and `apis/type.ts` as its public boundary so pages retain their current imports. Each module maps its API names to its dedicated controller prefix; no aggregate `/audit/applications/**` route is used. The sub-account audit module maps to its own controller and preserves the existing list/detail/export/delete API surface.

**Tech Stack:** Vue 3.5, TypeScript, Vite 7, `@ob-web/share` request client, Vitest.

## Global Constraints

- Every API request uses `method: "post"` and JSON payloads through `data`.
- Frontend paths use `/api/cashier/...`; do not use deprecated `/api/cashier/audit/applications/**` or flow metadata endpoints.
- Write actions include the page-provided `version` and `idempotencyKey`; do not generate alternate payload keys.
- Pagination consumes only `data.total` and `data.records`.
- Do not edit `src/layouts`, `src/pages/error`, `src/pages/login`, `src/pages/redirect`, or `src/pages/dashboard`.
- Do not alter unrelated uncommitted files and do not commit without explicit user permission.

---

### Task 1: Wire onboarding audit endpoints

**Files:**
- Modify: `src/pages/storeAuditGrounding/apis/index.ts`
- Modify: `src/pages/storeAuditGrounding/apis/type.ts` only if the documented response fields are absent
- Test: `tests/storeAuditGrounding/apis/index.test.ts`

**Interfaces:**
- Produces: Existing exports mapped to `/api/cashier/store/audit/onboarding`: `queryOnboardingPageApi`, `createOnboardingApi`, `updateOnboardingApi`, `queryOnboardingDetailApi`, `submitOnboardingApi`, `approveOnboardingApi`, `rejectOnboardingApi`, `saveOnboardingNodeDataApi`, `deleteOnboardingApi`.
- Consumes: Existing `Onboarding*DTO` and `ApiEnvelope<T>` types.

- [ ] **Step 1: Write the failing test**

```ts
it("posts onboarding detail requests to the dedicated controller", async () => {
  await queryOnboardingDetailApi("AUD-1")
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    url: "/api/cashier/store/audit/onboarding/AUD-1/detail",
    method: "post"
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storeAuditGrounding/apis/index.test.ts`
Expected: FAIL because the old mock/route does not match the dedicated onboarding controller.

- [ ] **Step 3: Write minimal implementation**

```ts
const ONBOARDING_BASE = "/api/cashier/store/audit/onboarding"
export const queryOnboardingDetailApi = (uniqueValue: string) =>
  request<ApiEnvelope<AuditApplicationDetailVO>>({ url: `${ONBOARDING_BASE}/${uniqueValue}/detail`, method: "post" })
```

Map the remaining exports to `${ONBOARDING_BASE}/page`, `/create`, `/${uniqueValue}/update`, `/${uniqueValue}/submit`, `/${uniqueValue}/approve`, `/${uniqueValue}/reject`, `/${uniqueValue}/nodes/${nodeCode}`, and `/${uniqueValue}/delete` with their existing data objects.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/storeAuditGrounding/apis/index.test.ts`
Expected: PASS.

### Task 2: Wire offboarding, company-change, and abnormal audit endpoints

**Files:**
- Modify: `src/pages/storeAuditUndercarriage/apis/index.ts`
- Modify: `src/pages/storeAuditChange/apis/index.ts`
- Modify: `src/pages/storeAuditAbnormal/apis/index.ts`
- Modify: corresponding `apis/type.ts` only for documented missing fields
- Test: `tests/storeAuditFlows/apis/index.test.ts`

**Interfaces:**
- Produces: Existing exports bound respectively to `/api/cashier/store/audit/offboarding`, `/change`, and `/abnormal`.
- Consumes: Existing `CompanyAuditPageQuery`, `CompanyAuditSaveDTO`, `AuditActionDTO`, and `AuditRejectDTO`.

- [ ] **Step 1: Write the failing test**

```ts
it.each([
  [queryOffboardingPageApi, "/api/cashier/store/audit/offboarding/page"],
  [queryStoreChangePageApi, "/api/cashier/store/audit/change/page"],
  [queryStoreAbnormalStatusPageApi, "/api/cashier/store/audit/abnormal/page"]
])("uses the documented flow page endpoint", async (api, url) => {
  await api({ pageNum: 1, pageSize: 20 } as never)
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ url, method: "post" }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storeAuditFlows/apis/index.test.ts`
Expected: FAIL because the request configuration still points at a mock or aggregate endpoint.

- [ ] **Step 3: Write minimal implementation**

```ts
const OFFBOARDING_BASE = "/api/cashier/store/audit/offboarding"
const CHANGE_BASE = "/api/cashier/store/audit/change"
const ABNORMAL_BASE = "/api/cashier/store/audit/abnormal"
```

For each existing API export, map `page/create/detail/update/submit/approve/reject/delete` to its base. Keep rollback only if the documented backend exposes it; otherwise remove its UI call and export in the follow-up page task.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/storeAuditFlows/apis/index.test.ts`
Expected: PASS.

### Task 3: Connect documented common selectors and remove unsupported action calls

**Files:**
- Modify: `src/pages/storeAuditUndercarriage/apis/index.ts`
- Modify: `src/pages/storeAuditChange/apis/index.ts`
- Modify: `src/pages/storeAuditAbnormal/apis/index.ts`
- Modify: affected `addOrEdit/*.vue` only where imports/calls reference removed APIs
- Test: `tests/storeAuditFlows/apis/commonSearch.test.ts`

**Interfaces:**
- Produces: store selector calls to `/api/cashier/audit/common/store/search`, company selector calls to `/api/cashier/audit/common/company/search`, and company detail calls to `/api/cashier/company/queryCompanyDetail`.
- Consumes: Current form selector query objects.

- [ ] **Step 1: Write the failing test**

```ts
it("posts store selector criteria to the common audit search endpoint", async () => {
  await searchAuditStoreApi({ keyword: "旗舰店" })
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    url: "/api/cashier/audit/common/store/search",
    method: "post",
    data: { keyword: "旗舰店" }
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storeAuditFlows/apis/commonSearch.test.ts`
Expected: FAIL because the selector uses a mock or unsupported path.

- [ ] **Step 3: Write minimal implementation**

```ts
export const searchAuditStoreApi = (data: Record<string, unknown>) =>
  request<ApiEnvelope<AuditStoreOption[]>>({
    url: "/api/cashier/audit/common/store/search",
    method: "post",
    data
  })
```

Use the corresponding company URL and move `uniqueValue` to `params` only for `queryCompanyDetail?uniqueValue=...`. Remove rollback UI/API wiring because the active contract exposes reject, not a separate rollback action.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/storeAuditFlows/apis/commonSearch.test.ts`
Expected: PASS.

### Task 4: Wire sub-account change audit endpoints

**Files:**
- Modify: `src/pages/storeAccountChangeDetails/apis/index.ts`
- Modify: `src/pages/storeAccountChangeDetails/apis/type.ts` only for documented missing query/result fields
- Test: `tests/storeAccountChangeDetails/apis/index.test.ts`

**Interfaces:**
- Produces: existing list/detail/export/batch-delete API exports mapped to `/api/cashier/sub-account-change-audits/{page|detail|export|batch-delete}`.
- Consumes: `SubAccountChangeAuditPageQuery` and selected IDs.

- [ ] **Step 1: Write the failing test**

```ts
it("posts selected IDs to the documented batch-delete endpoint", async () => {
  await batchDeleteSubAccountChangeAuditsApi({ ids: [1, 2], idempotencyKey: "key" })
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    url: "/api/cashier/sub-account-change-audits/batch-delete",
    method: "post",
    data: { ids: [1, 2], idempotencyKey: "key" }
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storeAccountChangeDetails/apis/index.test.ts`
Expected: FAIL because the route is not the documented audit controller route.

- [ ] **Step 3: Write minimal implementation**

```ts
const SUB_ACCOUNT_AUDIT_BASE = "/api/cashier/sub-account-change-audits"
export const batchDeleteSubAccountChangeAuditsApi = (data: { ids: number[], idempotencyKey: string }) =>
  request<ApiEnvelope<boolean>>({ url: `${SUB_ACCOUNT_AUDIT_BASE}/batch-delete`, method: "post", data })
```

Map page, detail, and export to their documented endpoints. Preserve export handling: it consumes `{ fileId, fileName }`; do not expect an HTTP file stream.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/storeAccountChangeDetails/apis/index.test.ts`
Expected: PASS.

### Task 5: Align shop API field contracts and verify type checking

**Files:**
- Modify: `src/pages/store/apis/index.ts`
- Modify: `src/pages/store/apis/type.ts`
- Modify: `src/pages/store/index.vue`, `src/pages/store/addOrEdit/addOrEdit.vue`, and `src/pages/store/addOrEdit/detail.vue` only where fields are consumed
- Test: `tests/store/apis/storeContract.test.ts`

**Interfaces:**
- Produces: `pageStore` filters and results supporting `mainAccount` and `subAccountCount`, and add/update/detail payloads supporting non-sensitive `subAccounts`.
- Consumes: documented V2 shop API endpoints which retain existing URLs.

- [ ] **Step 1: Write the failing test**

```ts
it("passes mainAccount as a pageStore filter", async () => {
  await pageStoreApi({ mainAccount: "138" } as never)
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    url: "/api/cashier/store/pageStore",
    method: "post",
    data: expect.objectContaining({ mainAccount: "138" })
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/store/apis/storeContract.test.ts`
Expected: FAIL because the query type cannot express `mainAccount` or the API drops it.

- [ ] **Step 3: Write minimal implementation**

```ts
interface StorePageQuery {
  mainAccount?: string
}
interface StoreListVO {
  mainAccount?: string
  subAccountCount?: number
}
```

Extend existing types without adding password-cipher fields. Ensure UI displays only returned masked/non-sensitive values and sends no password cipher fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/store/apis/storeContract.test.ts`
Expected: PASS.

### Task 6: Full verification and focused review

**Files:**
- Verify only; no planned source change.

- [ ] **Step 1: Run targeted API tests**

Run: `pnpm test tests/storeAuditGrounding/apis/index.test.ts tests/storeAuditFlows/apis/index.test.ts tests/storeAuditFlows/apis/commonSearch.test.ts tests/storeAccountChangeDetails/apis/index.test.ts tests/store/apis/storeContract.test.ts`
Expected: PASS.

- [ ] **Step 2: Run static checks**

Run: `pnpm lint && pnpm build`
Expected: exit code 0 without TypeScript or ESLint errors.

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- src/pages/storeAuditGrounding src/pages/storeAuditUndercarriage src/pages/storeAuditChange src/pages/storeAuditAbnormal src/pages/storeAccountChangeDetails src/pages/store`
Expected: only documented paths, payloads, and contract fields changed.
