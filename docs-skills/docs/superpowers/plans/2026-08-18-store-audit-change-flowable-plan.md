# Store Audit Change Flowable Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the store audit change detail approval flow consume current Flowable tasks and use stable protected operation IDs while preserving the existing business approval API and the simplified detail layout without a “流程信息” section.

**Architecture:** Keep `StoreChangeManageServiceImpl` as the business boundary and `StoreChangeFlowableServiceImpl` as the only direct Flowable client boundary. The service will continue to translate business node numbers to BPMN activity IDs and consume `completeTaskWithNext` snapshots for local state updates. The Vue detail page will query current tasks, authorize actions against the current user task, and retain the same operation ID across retries.

**Tech Stack:** Vue 3.5, TypeScript, Pinia, `@ob-web/share`, Spring Boot 2.7, Java, Flowable, MyBatis-Plus.

**Spec:** `D:/OB/ob_web/packages/micro/cashier/docs/skills/flowable-complete-task-with-next.md`

## Global Constraints

- Keep the detail page without a standalone “流程信息” section.
- New protected Flowable operations must use `operationId`, `twoLevelId`, and the real Flowable `taskId`.
- Reuse the same operation ID after a network timeout or retry; reset it only after a successful business response.
- Do not treat `businessKey`, `processInstanceId`, or business request number as `taskId` or `operationId`.
- Keep the business approval API as the frontend boundary; the browser must not call the raw Flowable completion endpoint.
- Keep business node-number validation and mapping in the backend; do not trust a frontend numeric node as a BPMN activity ID.
- Do not remove workflow persistence fields still needed by approval, rejection, list, or task synchronization.

---

### Task 1: Verify the existing Flowable boundary and contracts

**Files:**
- Read: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/flowable/StoreChangeFlowableServiceImpl.java`
- Read: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/StoreChangeManageServiceImpl.java`
- Read: `D:/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/dto/StoreChangeApproveDTO.java`
- Read: `D:/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/dto/StoreChangeRejectDTO.java`

**Interfaces:**
- Confirm `StoreChangeFlowableService.completeTask()` already delegates to `BiFlowableClient.completeTaskWithNext()`.
- Confirm `returnToNode()` maps a business target node to `targetActivityId` before calling Flowable.
- Confirm approval and rejection DTOs already carry the business idempotency key and real task ID.

- [ ] **Step 1: Verify the current implementation and record only gaps.**
- [ ] **Step 2: Do not modify code if the Flowable client boundary already satisfies the document.**
- [ ] **Step 3: Use the gaps found here to constrain Tasks 2-4.**

### Task 2: Add focused backend contract tests before changing behavior

**Files:**
- Create or modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/test/java/com/obo/bi/cashier/service/impl/StoreChangeFlowableContractTest.java`
- Test: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/test/java/com/obo/bi/cashier/service/impl/StoreChangeFlowableContractTest.java`

**Interfaces:**
- Test the source contract and DTO contract without requiring a live Flowable server.
- Preserve the existing Java project’s source-contract test style when Mockito integration is not available.

- [ ] **Step 1: Write a failing assertion that the主体变更 Flowable adapter uses `completeTaskWithNext` and carries `operation_id`, `two_level_id`, and `taskId`.**
- [ ] **Step 2: Run the focused test through IDEA MCP and confirm it fails only if the contract is missing.**
- [ ] **Step 3: Add the smallest backend changes needed to satisfy the contract.**
- [ ] **Step 4: Run the focused test again through IDEA MCP and confirm it passes.**

### Task 3: Harden backend next-task state mapping

**Files:**
- Modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/StoreChangeManageServiceImpl.java`
- Modify if required: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/flowable/StoreChangeFlowableServiceImpl.java`
- Modify if required: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/flowable/dto/CompleteTaskResultDTO.java`

**Interfaces:**
- Consume `CompleteTaskResultDTO` values derived from `TaskCompleteWithNextVO`.
- Produce local application updates based on `nextTaskDefinitionKey`, `nextTaskName`, `nextAssignee`, `processEnded`, and `processInstanceId`.

- [ ] **Step 1: Add a failing test for an approval result with a next task and assert local node/handler values come from the Flowable result.**
- [ ] **Step 2: Add a failing test for `processEnded=true` and assert local status becomes `COMPLETED` rather than requiring a next task.**
- [ ] **Step 3: Remove any unconditional “next task must exist” validation from the approval path that prevents normal process completion.**
- [ ] **Step 4: Keep business node mapping explicit and reject an unmapped next activity instead of silently using a guessed node.**
- [ ] **Step 5: Keep the CAS/version update and audit log write in the same transaction.**
- [ ] **Step 6: Run the focused backend tests through IDEA MCP.**

### Task 4: Add stable frontend operation IDs and current-task loading

**Files:**
- Create: `D:/OB/ob_web/packages/micro/cashier/src/pages/storeAuditChange/addOrEdit/detail-flow.ts`
- Modify: `D:/OB/ob_web/packages/micro/cashier/src/pages/storeAuditChange/addOrEdit/detail.vue`
- Modify: `D:/OB/ob_web/packages/micro/cashier/src/pages/storeAuditChange/apis/type.ts`
- Reuse: `D:/OB/ob_web/packages/micro/cashier/src/common/apis/flowableTasks/index.ts`

**Interfaces:**
- `createOperationIdStore(createId?: () => string): { get(action: string): string; reset(action: string): void }`
- `queryFlowableTasksApi(businessKey: string)` returns current Flowable task snapshots.
- Detail page consumes the current task assigned to the current username.

- [ ] **Step 1: Write a failing unit test for operation ID reuse: two `get("approve")` calls return the same ID until `reset("approve")`.**
- [ ] **Step 2: Run the focused Vitest test and verify the expected failure.**
- [ ] **Step 3: Implement the small operation ID store by copying the established undercarriage pattern.**
- [ ] **Step 4: Run the focused Vitest test and verify it passes.**
- [ ] **Step 5: Load current Flowable tasks together with detail and audit logs for non-draft records.**
- [ ] **Step 6: Select the current user’s assigned task, falling back to the first task only for display compatibility, and gate actions on actual current-user assignment.**
- [ ] **Step 7: Keep the current detail layout unchanged apart from approval wiring; do not add workflow display fields or a workflow card.**

### Task 5: Rewrite frontend approve/return callbacks around the business APIs

**Files:**
- Modify: `D:/OB/ob_web/packages/micro/cashier/src/pages/storeAuditChange/addOrEdit/detail.vue`
- Modify: `D:/OB/ob_web/packages/micro/cashier/src/pages/storeAuditChange/apis/type.ts`
- Modify: `D:/OB/ob_web/packages/micro/cashier/src/pages/storeAuditChange/apis/index.ts` only if the backend DTO shape changes

**Interfaces:**
- `handleFlowableOperation(taskType: "approve" | "return", payload: { taskId: string; comment: string; targetActivityId?: string; returnToActivityId?: string })`
- Business API responses remain `{ code: number; message?: string; data?: ... }`.

- [ ] **Step 1: Add a failing frontend test for approve using the current task ID and stable operation ID.**
- [ ] **Step 2: Add a failing frontend test for return rejecting an unmapped target before sending the request.**
- [ ] **Step 3: Replace `Date.now()` operation keys with the operation ID store.**
- [ ] **Step 4: Route approval through the current task’s `id`, not the detail VO’s stale task field.**
- [ ] **Step 5: Keep business `targetNodeNo` conversion if the backend contract still requires it; resolve it from the selected BPMN activity code using the change node definition.**
- [ ] **Step 6: Reset the operation ID only when the business API returns `code === 0`; preserve it for retryable failures.**
- [ ] **Step 7: Refresh detail/tasks/logs after a successful operation.**
- [ ] **Step 8: Run frontend focused tests and `pnpm build`.**

### Task 6: Verify end-to-end contracts and review the diff

**Files:**
- Verify: all files changed by Tasks 2-5
- Verify: `D:/OB/ob_web/packages/micro/cashier/docs/skills/flowable-complete-task-with-next.md`

- [ ] **Step 1: Search for direct frontend calls to `/api/flowable/bpmn/tasks/complete-with-next`; there must be none for this feature.**
- [ ] **Step 2: Search the主体变更 backend for `completeTaskWithNext`, `operation_id`, `two_level_id`, and `taskId`.**
- [ ] **Step 3: Verify the detail page still contains no “流程信息” section.**
- [ ] **Step 4: Run frontend tests and build.**
- [ ] **Step 5: Run backend focused tests and IDEA MCP build/inspection.**
- [ ] **Step 6: Review `git diff` and ensure unrelated existing worktree changes were not modified.**
