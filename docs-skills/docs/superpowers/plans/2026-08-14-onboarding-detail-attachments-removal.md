# Onboarding Detail Attachment Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the empty attachment section from the onboarding detail page.

**Architecture:** Delete the detail-only UI section and only its direct data/component dependencies. Keep all APIs, DTOs, backend behavior, and other audit pages unchanged.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vite.

## Global Constraints

- Only `src/pages/storeAuditGrounding/addOrEdit/detail.vue` and its targeted regression test may change.
- Do not alter API, DTO, backend, route, other audit workflow, or upload behavior.
- Keep existing user changes intact; do not commit or push.

---

### Task 1: Remove the empty attachment presentation

**Files:**
- Modify: `src/pages/storeAuditGrounding/addOrEdit/detail.vue`
- Modify: `tests/storeAuditGrounding/contracts.test.ts`

**Interfaces:**
- Produces: onboarding detail page without an attachment heading or attachment display component.

- [ ] **Step 1: Write a failing regression test**

Add a source-level test:

```ts
it("does not render an attachment section in onboarding detail", () => {
  const detailSource = readFileSync(resolve(import.meta.dirname, "../../src/pages/storeAuditGrounding/addOrEdit/detail.vue"), "utf8")

  expect(detailSource).not.toMatch(/<AttachmentManager\b/)
  expect(detailSource).not.toMatch(/>附件</)
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm test tests/storeAuditGrounding/contracts.test.ts
```

Expected: FAIL because the detail page currently renders the attachment section.

- [ ] **Step 3: Delete only the detail attachment section**

Delete the template block containing the “附件” heading and `AttachmentManager` presentation. Remove imports, computed state, and types that become unused solely due to this deletion.

- [ ] **Step 4: Run focused test and build verification**

Run:

```bash
pnpm test tests/storeAuditGrounding/contracts.test.ts
pnpm build
```

Expected: test passes and build exits 0.
