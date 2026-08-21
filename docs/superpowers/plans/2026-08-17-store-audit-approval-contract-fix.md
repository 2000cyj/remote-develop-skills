# Store Audit Approval Contract Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make store audit approval and rejection requests satisfy the backend Flowable task contract by exposing the current task ID and using the backend field names.

**Architecture:** The backend adds a read-only `taskId` to onboarding detail responses, resolving the current Flowable task assigned to the authenticated operator. The frontend carries that value into approval/rejection payloads and maps the existing dialog remark to `comment` (and `rejectReason` for rejection). No new test files are added.

**Tech Stack:** Java/Spring backend, Flowable client adapter, Vue 3, TypeScript, Vite, pnpm.

**Spec:** Approved in conversation on 2026-08-17.

## Global Constraints

- Do not create test files.
- Do not use `processInstanceId` as `taskId`.
- Preserve existing idempotency key and optimistic-lock version semantics.
- Do not commit or push changes without explicit user permission.

---

### Task 1: Add task ID to onboarding detail response

**Files:**
- Modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/vo/OnboardingDetailVO.java`
- Modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/OnboardingManageServiceImpl.java`

- [ ] Add a documented `taskId` property to `OnboardingDetailVO`.
- [ ] In `detail`, query `flowableService.listCurrentTasks(uniqueValue)`, match the authenticated username against task assignee, and set only the matching task ID.
- [ ] Preserve null task ID for users who cannot act on the current task.

### Task 2: Align audit DTO types and action payloads

**Files:**
- Modify: `src/pages/storeAuditGrounding/apis/type.ts`
- Modify: `src/pages/storeAuditGrounding/addOrEdit/detail.vue`
- Modify: corresponding `apis/type.ts` and `addOrEdit/detail.vue` files under `storeAuditChange`, `storeAuditAbnormal`, and `storeAuditUndercarriage`.

- [ ] Add optional/required task ID according to loaded detail data and rename action text to `comment`.
- [ ] Include `taskId` and `comment` in approval requests.
- [ ] Include `taskId`, `rejectReason`, and `comment` in rejection requests.
- [ ] Avoid generating or substituting a task ID on the client.

### Task 3: Verify without adding tests

**Files:** None.

- [ ] Search all affected approval/rejection calls for stale `remark`-only payloads.
- [ ] Run frontend lint/type/build commands available in the cashier package.
- [ ] Run backend compile/verification command if the repository supports it; report known environment blockers accurately.
- [ ] Review the final diff and confirm no test files or unrelated files were changed.
