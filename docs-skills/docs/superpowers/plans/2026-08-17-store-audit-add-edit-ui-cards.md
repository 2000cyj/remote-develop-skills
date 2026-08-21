# Store Audit Add/Edit UI Card Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the four cashier audit add/edit pages to use the personnel `DynamicForm` group-card visual language while preserving all existing business behavior.

**Architecture:** Keep the existing page-level data, API, validation, dynamic item arrays, remote search handlers, and attachment components unchanged. Add a `type: "group"` item to each existing top-level `DynamicForm` configuration so the application-information block uses the shared group title rendering, and restyle only the surrounding application/shop cards and section headers with page-local utility classes. Complex dynamic shop rows remain hand-written because they contain page-specific controls and interactions that should not be migrated solely for visual consistency.

**Tech Stack:** Vue 3.5, TypeScript, `@ob-web/share` `DynamicForm`, Element Plus, Tailwind CSS 4, scoped Vue SFC styles where needed.

## Global Constraints

- Preserve all existing business logic, API calls, validation, remote-search behavior, dynamic add/remove behavior, attachment behavior, field order, and route behavior.
- Modify only the four requested `src/pages/storeAudit*/addOrEdit/index.vue` files and the implementation plan document.
- Prefer `DynamicForm` for the existing application-information fields; do not migrate dynamic shop rows to `DynamicForm`.
- Match the reference style with white cards, subtle borders/radius, light header areas, colored left vertical bars, and consistent spacing.
- Use distinct page-local accent colors where useful; colors do not need to be purple.
- Do not modify shared components, APIs, stores, or unrelated pages.
- Do not commit changes unless the user explicitly requests a commit.

---

### Task 1: Add DynamicForm application-information groups

**Files:**
- Modify: `src/pages/storeAuditAbnormal/addOrEdit/index.vue:38-41,225`
- Modify: `src/pages/storeAuditChange/addOrEdit/index.vue:38-41,267`
- Modify: `src/pages/storeAuditGrounding/addOrEdit/index.vue:95-102,232`
- Modify: `src/pages/storeAuditUndercarriage/addOrEdit/index.vue:37-40,213`

**Interfaces:**
- Consumes: each page's existing reactive `form`, `applyDateItems`/`formItems`, and existing `DynamicForm` ref/rules.
- Produces: the same form model and validation behavior, with one visual `type: "group"` item preceding the existing application fields.

- [ ] **Step 1: Add a group item before the existing application fields**

For the abnormal, change, and undercarriage pages, change the computed configuration from:

```ts
const applyDateItems = computed<FormItemConfig[]>(() => [
  { prop: "applyDate", label: "申请日期", type: "date", valueFormat: "YYYY-MM-DD", placeholder: "请选择申请日期", span: 12 }
])
```

to the same configuration with a visual group item first, using the page-specific accent:

```ts
const applyDateItems = computed<FormItemConfig[]>(() => [
  { prop: "applyInfo", label: "申请信息", type: "group", color: "#0EA5A4" },
  { prop: "applyDate", label: "申请日期", type: "date", valueFormat: "YYYY-MM-DD", placeholder: "请选择申请日期", span: 12 }
])
```

Use these colors:

- `storeAuditAbnormal`: `#F59E0B`
- `storeAuditChange`: `#0EA5A4`
- `storeAuditGrounding`: `#10B981`
- `storeAuditUndercarriage`: `#3B82F6`

For `storeAuditGrounding`, add the group item before its existing five application fields:

```ts
const formItems = computed<FormItemConfig[]>(() => [
  { prop: "applyInfo", label: "申请信息", type: "group", color: "#10B981" },
  { prop: "applyDate", label: "申请日期", type: "date", valueFormat: "YYYY-MM-DD", placeholder: "请选择申请日期", span: 12 },
  { prop: "applicantName", label: "申请人", type: "input", placeholder: "当前用户", maxlength: 50, disabled: true, span: 12 },
  { prop: "departmentId", label: "申请部门", type: "select", placeholder: "请选择申请部门", options: CASHIER_BELONGS_DEPARTMENT.options, filterable: true, clearable: true, span: 12 },
  { prop: "platform", label: "目标平台", type: "select", placeholder: "请选择目标平台", options: ONBOARDING_PLATFORMS.map(item => ({ label: item.label, value: item.value })), span: 12 },
  { prop: "priority", label: "优先级", type: "select", placeholder: "请选择优先级", options: ONBOARDING_PRIORITY_OPTIONS.map(item => ({ label: item.label, value: item.value })), span: 12 }
])
```

- [ ] **Step 2: Keep the existing template bindings unchanged except for presentation classes**

Do not change `v-model`, `:rules`, `:disabled`, refs, or form methods. The existing `DynamicForm` calls must continue to receive the same model and rules:

```vue
<DynamicForm
  ref="formRef"
  v-model="form"
  :form-items="applyDateItems"
  :rules="applyDateRules"
  label-position="top"
  :disabled="isView"
/>
```

For grounding, keep `:form-items="formItems"` and `:rules="rules"` unchanged.

- [ ] **Step 3: Run a focused type/build check for the four edited files**

Run from `D:/OB/ob_web/packages/micro/cashier`:

```bash
pnpm exec eslint src/pages/storeAuditAbnormal/addOrEdit/index.vue src/pages/storeAuditChange/addOrEdit/index.vue src/pages/storeAuditGrounding/addOrEdit/index.vue src/pages/storeAuditUndercarriage/addOrEdit/index.vue
```

Expected: no lint errors caused by the new group items.

---

### Task 2: Restyle application and dynamic shop cards

**Files:**
- Modify: `src/pages/storeAuditAbnormal/addOrEdit/index.vue:199-323`
- Modify: `src/pages/storeAuditChange/addOrEdit/index.vue:241-373`
- Modify: `src/pages/storeAuditGrounding/addOrEdit/index.vue:206-359`
- Modify: `src/pages/storeAuditUndercarriage/addOrEdit/index.vue:187-300`

**Interfaces:**
- Consumes: the existing templates and page-specific interactions from Task 1.
- Produces: a consistent card presentation with no changes to event handlers, bindings, conditional rendering, or text semantics.

- [ ] **Step 1: Introduce a page root accent class without changing behavior**

Add a page-local class to the scrollable content wrapper or the existing `v-loading` content container, for example:

```vue
<div v-loading="!detailLoaded" class="audit-form-content audit-form-content--change relative">
```

Use a distinct modifier per page:

- `audit-form-content--abnormal`
- `audit-form-content--change`
- `audit-form-content--grounding`
- `audit-form-content--undercarriage`

Keep all existing `v-loading` expressions and nesting intact.

- [ ] **Step 2: Convert application information wrapper to the reference card structure**

Replace only the application card's hard-coded title styling with a semantic title block that has a colored left bar and light header background. Preserve its text and all children:

```vue
<div class="audit-card audit-card--application">
  <div class="audit-card__header">
    <div class="audit-card__title">
      <span class="audit-card__bar" />
      <span>申请信息</span>
    </div>
  </div>
  <div class="audit-card__body">
    <!-- existing DynamicForm and applicant/department fields remain here -->
  </div>
</div>
```

Do not alter `form.applicantName`, `currentApplicantName`, `currentDepartmentName`, `formRef`, or any component props.

- [ ] **Step 3: Convert each dynamic shop row to the same card structure**

Keep the existing `v-for`, `:key`, delete condition, event handlers, component bindings, and field order. Change only wrapper/header/body classes and the left-bar span classes. The resulting structure must remain equivalent to:

```vue
<div v-for="(item, index) in form.items" :key="index" class="audit-card audit-card--item">
  <div class="audit-card__header audit-card__header--item">
    <div class="audit-card__title audit-card__title--item">
      <span class="audit-card__bar audit-card__bar--item" />
      <span>店铺 {{ index + 1 }}</span>
    </div>
    <!-- existing delete LoadingButton remains unchanged -->
  </div>
  <div class="audit-card__body">
    <!-- existing fields and AttachmentManager remain unchanged -->
  </div>
</div>
```

- [ ] **Step 4: Restyle section headings without deleting dynamic controls**

For section headings such as “店铺清单”, “入驻筹备”, and “流程说明”, preserve their text and button/list children. Replace only ad-hoc utility combinations with the same `audit-section-title` class pattern:

```vue
<div class="audit-section-title">
  <span class="audit-section-title__bar" />
  <span>店铺清单（可批量添加，最多 50 条）</span>
</div>
```

For headings with action buttons, keep the existing outer `flex items-center justify-between` wrapper and apply `audit-section-title` only to the title child.

- [ ] **Step 5: Add scoped page-local presentation styles**

Add a `<style scoped lang="scss">` block to each of the four files. Use the page modifier to define its accent and common classes:

```scss
.audit-form-content {
  --audit-accent: #0ea5a4;
}

.audit-form-content--abnormal {
  --audit-accent: #f59e0b;
}

.audit-form-content--grounding {
  --audit-accent: #10b981;
}

.audit-form-content--undercarriage {
  --audit-accent: #3b82f6;
}

.audit-card {
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}

.audit-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.audit-card__body {
  padding: 16px;
}

.audit-card__title,
.audit-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.audit-card__title--item {
  font-size: 14px;
}

.audit-card__bar,
.audit-section-title__bar {
  display: inline-block;
  width: 6px;
  height: 18px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--audit-accent) 0%, color-mix(in srgb, var(--audit-accent) 70%, white) 100%);
}

.audit-card__bar--item {
  width: 4px;
  height: 14px;
  border-radius: 2px;
}

.audit-section-title {
  margin-top: 20px;
}
```

If the project’s PostCSS/Tailwind pipeline does not accept `color-mix`, use a fixed two-stop gradient for each page’s `--audit-accent` instead; do not change the visual structure or business logic. Avoid `:deep` selectors unless a local DynamicForm child needs a visual override.

- [ ] **Step 6: Run lint and inspect the diff for logic-only preservation**

Run:

```bash
pnpm exec eslint src/pages/storeAuditAbnormal/addOrEdit/index.vue src/pages/storeAuditChange/addOrEdit/index.vue src/pages/storeAuditGrounding/addOrEdit/index.vue src/pages/storeAuditUndercarriage/addOrEdit/index.vue
 git diff --check
```

Expected: lint and whitespace checks pass; the diff contains only group configuration, template classes/wrappers, and scoped presentation styles.

---

### Task 3: Verify the finished UI changes

**Files:**
- Verify: the four modified audit add/edit Vue files

**Interfaces:**
- Consumes: completed changes from Tasks 1 and 2.
- Produces: verified build/lint evidence and a final diff review; no source changes beyond the requested four files.

- [ ] **Step 1: Run the package lint command**

Run:

```bash
pnpm lint
```

Expected: ESLint completes successfully. If the command auto-fixes unrelated pre-existing files, stop and report that instead of retaining unrelated changes.

- [ ] **Step 2: Run the package test command**

Run:

```bash
pnpm test
```

Expected: the configured Vitest run completes. If no tests are discovered, report that explicitly.

- [ ] **Step 3: Run the cashier build**

Run:

```bash
pnpm build
```

Expected: the Vue/TypeScript/Vite production build succeeds.

- [ ] **Step 4: Review the final diff and changed-file scope**

Run:

```bash
git diff --check
git status --short -- src/pages/storeAuditAbnormal/addOrEdit/index.vue src/pages/storeAuditChange/addOrEdit/index.vue src/pages/storeAuditGrounding/addOrEdit/index.vue src/pages/storeAuditUndercarriage/addOrEdit/index.vue docs/superpowers/plans/2026-08-17-store-audit-add-edit-ui-cards.md
```

Confirm that only the four requested pages and this plan are changed by this task, and that no API, validation, handler, route, or shared-component logic was modified.

- [ ] **Step 5: Report verification faithfully**

Summarize the exact files changed, the chosen accent colors, whether `DynamicForm` group items were added, and the actual results of lint/test/build. Do not claim the app was browser-tested unless it was launched and inspected.
