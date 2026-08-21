# Onboarding Department ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the onboarding application department a frontend-selected, authorized string `departmentId` that the backend maps to the persisted `applyDepartment` field.

**Architecture:** The cashier Vue form exposes `departmentId` as a select backed by `CASHIER_BELONGS_DEPARTMENT`. The frontend payload sends only `departmentId`; the Spring Boot create/update DTOs accept that string and the service validates it against current DPGL department-management permissions before assigning it to `OnboardingApplication.applyDepartment`.

**Tech Stack:** Vue 3, TypeScript, Vitest, Spring Boot, Java, MyBatis, Lombok.

## Global Constraints

- Request field name is exactly `departmentId`; its JSON type is `String`.
- Persist to the existing entity/database field `applyDepartment`; do not change schema, Mapper XML, URLs, HTTP methods, or other audit flows.
- `CASHIER_BELONGS_DEPARTMENT.options` is the frontend option source; option values are string department IDs.
- Both create and update reject blank or unauthorized department IDs using the current user's `TwoLevelEnum.DPGL` management-permission IDs.
- Do not use `getCurrentCashierDepartment()` to derive onboarding application department.
- Keep the user's existing uncommitted changes intact. Do not commit or push without explicit permission.

---

### Task 1: Send the department ID from the onboarding form

**Files:**
- Modify: `src/pages/storeAuditGrounding/addOrEdit/index.vue:29-49,95-102,117-121`
- Modify: `src/pages/storeAuditGrounding/apis/type.ts` (`AuditApplicationSaveDTO`)
- Modify: `src/pages/storeAuditGrounding/utils/index.ts:3-9,48-68`
- Modify: `tests/storeAuditGrounding/contracts.test.ts`

**Interfaces:**
- Consumes: `CASHIER_BELONGS_DEPARTMENT.options`, each `{ value: string, label: string }`.
- Produces: `AuditApplicationSaveDTO.departmentId: string` sent to onboarding create/update APIs.
- Compatibility: detail response keeps using `baseInfo.applyDepartment: string`, which loads into `form.departmentId`.

- [ ] **Step 1: Write the failing frontend regression test**

Add an assertion that reads `addOrEdit/index.vue` and requires the department form item to use the request/model field and dictionary options:

```ts
it("uses the department dictionary to submit a string departmentId", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../../src/pages/storeAuditGrounding/addOrEdit/index.vue"), "utf8")

  expect(source).toContain('departmentId: ""')
  expect(source).toContain('prop: "departmentId"')
  expect(source).toContain('options: CASHIER_BELONGS_DEPARTMENT.options')
  expect(source).toContain('form.departmentId = typeof base.applyDepartment === "string" ? base.applyDepartment : ""')
})
```

Update the payload-contract assertion to expect `departmentId: "D001"` and `applyDepartment` to be absent from the frontend request payload.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm test tests/storeAuditGrounding/contracts.test.ts
```

Expected: FAIL because the source still uses `applyDepartment` and the payload still sends that field.

- [ ] **Step 3: Implement the minimum frontend mapping**

Update the form state, rules, form item, detail mapping, save-form interface, and request DTO property:

```ts
// addOrEdit/index.vue
import { CASHIER_BELONGS_DEPARTMENT } from "@/pages/store/enum"

// form state
 departmentId: "",

// form item
{ prop: "departmentId", label: "申请部门", type: "select", placeholder: "请选择申请部门", options: CASHIER_BELONGS_DEPARTMENT.options, filterable: true, span: 12 },

// detail mapping
form.departmentId = typeof base.applyDepartment === "string" ? base.applyDepartment : ""
```

```ts
// utils/index.ts
interface OnboardingSaveForm {
  applyDate: string
  departmentId: string
  platform: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  items: AuditApplicationItem[]
}

// payload return
 departmentId: form.departmentId,
```

Update `AuditApplicationSaveDTO` to declare `departmentId: string` and remove the request-side `applyDepartment` property.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
pnpm test tests/storeAuditGrounding/contracts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run frontend build validation**

Run:

```bash
pnpm build
```

Expected: exit code 0.

### Task 2: Accept and authorize `departmentId` in backend create and update

**Files:**
- Modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/dto/OnboardingCreateDTO.java`
- Modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/dto/OnboardingUpdateDTO.java`
- Modify: `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/OnboardingManageServiceImpl.java:124-218,249-314`
- Test: the existing or newly created onboarding service test source under `D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/test/java/...`

**Interfaces:**
- Consumes: `OnboardingCreateDTO.departmentId: String`, `OnboardingUpdateDTO.departmentId: String`.
- Consumes: `commonManageService.listCurrentCashierDepartmentManagePermissionIds(TwoLevelEnum.DPGL)`.
- Produces: `OnboardingApplication.applyDepartment` assigned from the authorized request `departmentId`.

- [ ] **Step 1: Write failing backend service tests**

Create or extend the onboarding service test class with direct service tests that arrange a permitted-ID set containing `"D001"` and a request `setDepartmentId("D001")`. Assert the entity supplied to persistence has `getApplyDepartment().equals("D001")` for create and update.

Add failures for blank and unauthorized values:

```java
assertThrows(ServiceException.class, () -> service.create(createDtoWithDepartmentId(" ")));
assertThrows(ServiceException.class, () -> service.create(createDtoWithDepartmentId("D999")));
assertThrows(ServiceException.class, () -> service.update(UNIQUE_VALUE, updateDtoWithDepartmentId(" ")));
assertThrows(ServiceException.class, () -> service.update(UNIQUE_VALUE, updateDtoWithDepartmentId("D999")));
```

Verify the create test does not stub or verify `commonManageService.getCurrentCashierDepartment()`.

- [ ] **Step 2: Run the backend test to verify it fails**

Run the target test using its IntelliJ test configuration or a runnable test location.

Expected: compile/test failure because DTOs lack `departmentId` and the services do not use it.

- [ ] **Step 3: Add the request fields**

Add this exact field to both Lombok DTOs:

```java
private String departmentId;
```

- [ ] **Step 4: Implement one shared authorization check in the service**

Add a private helper in `OnboardingManageServiceImpl` that returns the authorized string department ID or throws the project-standard business exception:

```java
private String requireManagedDepartment(String departmentId) {
    if (StrUtil.isBlank(departmentId)) {
        throw new ServiceException("申请部门不能为空");
    }
    List<String> managedDepartmentIds = commonManageService
        .listCurrentCashierDepartmentManagePermissionIds(TwoLevelEnum.DPGL);
    if (!managedDepartmentIds.contains(departmentId)) {
        throw new ServiceException("无权选择该申请部门");
    }
    return departmentId;
}
```

Adapt collection/exception types to the exact project imports and nearby authorization conventions without changing the messages' behavior elsewhere.

- [ ] **Step 5: Map the request ID to the existing persisted field**

In `create()`, replace the current employee-derived department assignment with:

```java
application.setApplyDepartment(requireManagedDepartment(dto.getDepartmentId()));
```

Remove the now-unused `getCurrentCashierDepartment()` call and local variable from this method.

In `update()`, after existing editable-state/version/record authorization checks and before persistence:

```java
application.setApplyDepartment(requireManagedDepartment(dto.getDepartmentId()));
```

Do not modify `applyDepartmentName`, entity fields, Mapper XML, or table schema.

- [ ] **Step 6: Run backend tests to verify they pass**

Run the target onboarding service test using IntelliJ.

Expected: create/update persist authorized `"D001"`; blank and `"D999"` are rejected; all existing targeted assertions pass.

- [ ] **Step 7: Compile the changed backend files using IntelliJ**

Compile the two DTOs and `OnboardingManageServiceImpl` using IntelliJ's project build.

Expected: no compilation errors in changed files.

### Task 3: End-to-end contract verification

**Files:**
- Modify only if verification exposes a contract mismatch in files listed in Tasks 1–2.
- Test: `tests/storeAuditGrounding/apis.test.ts`, `tests/storeAuditGrounding/contracts.test.ts`, backend onboarding service test.

**Interfaces:**
- Frontend JSON request: `{ departmentId: "D001" }`.
- Backend DTO: `String departmentId`.
- Persistence: `OnboardingApplication.applyDepartment == "D001"`.

- [ ] **Step 1: Add a request-body API contract assertion**

In `tests/storeAuditGrounding/apis.test.ts`, use a fixture with `departmentId: "D001"` and assert the captured create/update body contains that property and does not contain `applyDepartment`.

- [ ] **Step 2: Run the frontend API test to verify it fails**

Run:

```bash
pnpm test tests/storeAuditGrounding/apis.test.ts
```

Expected: FAIL until the fixture/assertion and frontend API DTO use `departmentId` consistently.

- [ ] **Step 3: Make only contract-alignment corrections**

Correct remaining frontend request type, fixture, or payload references so the request property is exactly `departmentId` and its value remains a string. Do not introduce `applyDepartment` as a request alias.

- [ ] **Step 4: Run complete targeted verification**

Run:

```bash
pnpm test tests/storeAuditGrounding/contracts.test.ts tests/storeAuditGrounding/apis.test.ts
pnpm build
```

Then run backend onboarding service tests and IntelliJ compilation for modified backend files.

Expected: all frontend tests/build pass; backend target tests/build pass.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff -- src/pages/storeAuditGrounding/addOrEdit/index.vue src/pages/storeAuditGrounding/apis/type.ts src/pages/storeAuditGrounding/utils/index.ts tests/storeAuditGrounding
```

Review the backend repository diff separately and confirm changes are limited to onboarding request DTOs, onboarding service behavior, and their tests.
