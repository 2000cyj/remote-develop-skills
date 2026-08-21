# Store Audit Detail UI Card Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the four cashier audit detail pages into share-component-backed white card sections without changing any business logic or action behavior.

**Architecture:** Keep every existing API call, computed value, permission check, action handler, data field, editable `DynamicForm`, `SubAccountEditor`, attachment component, and audit timeline behavior. Reuse the existing `Descriptions`, `AuditNodeIndicator`, and `AuditAttachmentList` components, while adding only local section/card classes and page-specific accent colors. Replace repeated read-only store grids with `Descriptions` configurations only where the current data is already computed for display.

**Tech Stack:** Vue 3.5, TypeScript, Element Plus, `@ob-web/share` (`Descriptions`), existing cashier audit components, Tailwind CSS 4, scoped SCSS.

## Global Constraints

- Preserve all API calls, permissions, actions, computed data, handlers, field values, editable `DynamicForm`/`SubAccountEditor` behavior, and route behavior.
- Modify only the four requested `src/pages/storeAudit*/addOrEdit/detail.vue` files and this plan document.
- Reuse existing `Descriptions`, `AuditNodeIndicator`, and `AuditAttachmentList`; do not modify shared components.
- Use white rounded cards, light-gray headers, colored left bars, and consistent spacing.
- Use abnormal orange, change cyan, grounding green, and undercarriage blue accents.
- Do not run `pnpm test`; validate with `npx eslint src --format stylish` and `npx vue-tsc --noEmit`.
- Do not commit changes unless explicitly requested.

---

### Task 1: Add reusable read-only description configurations

**Files:**
- Modify: `src/pages/storeAuditAbnormal/addOrEdit/detail.vue`
- Modify: `src/pages/storeAuditChange/addOrEdit/detail.vue`
- Modify: `src/pages/storeAuditGrounding/addOrEdit/detail.vue`
- Modify: `src/pages/storeAuditUndercarriage/addOrEdit/detail.vue`

**Interfaces:**
- Consumes: each page's existing computed detail data, formatter helpers, and existing `Descriptions` usage.
- Produces: page-local `DescriptionItemConfig[]` computed configurations for application, flow, and store read-only sections; no changed payload or action interface.

- [ ] **Step 1: Keep existing application and flow description data unchanged**

Retain each page's existing `applicationDescItems`, `applicationDescData`, `flowDescItems`, and `flowDescData` computed values. Do not rename their props or alter formatter logic.

- [ ] **Step 2: Add store description item configurations for the read-only sections**

For the abnormal page, add a computed configuration that represents the current store card values:

```ts
const storeBaseDescItems = [
  { prop: "storeUniqueValue", label: "店铺" },
  { prop: "storeName", label: "店铺名称" },
  { prop: "storeCode", label: "店铺编码" },
  { prop: "companyName", label: "所属公司" },
  { prop: "sourceStatus", label: "调整前状态" },
  { prop: "targetStatus", label: "调整后状态" }
]
```

Use the existing page helpers to build each row's data object; do not change the displayed values. Add equivalent configurations for change and undercarriage using their current labels and values. For grounding, keep the existing `DynamicForm` node editor and `SubAccountEditor` untouched; only add a read-only description configuration for the fields that are currently rendered in the static grid.

- [ ] **Step 3: Run targeted source lint**

Run:

```bash
npx eslint src/pages/storeAuditAbnormal/addOrEdit/detail.vue src/pages/storeAuditChange/addOrEdit/detail.vue src/pages/storeAuditGrounding/addOrEdit/detail.vue src/pages/storeAuditUndercarriage/addOrEdit/detail.vue --format stylish
```

Expected: no errors caused by the new configurations.

---

### Task 2: Convert the four detail templates to unified card sections

**Files:**
- Modify: `src/pages/storeAuditAbnormal/addOrEdit/detail.vue`
- Modify: `src/pages/storeAuditChange/addOrEdit/detail.vue`
- Modify: `src/pages/storeAuditGrounding/addOrEdit/detail.vue`
- Modify: `src/pages/storeAuditUndercarriage/addOrEdit/detail.vue`

**Interfaces:**
- Consumes: existing computed data and configurations from Task 1.
- Produces: the same detail page content and controls with a consistent card-based presentation.

- [ ] **Step 1: Add page-local root accent classes**

Change only the content wrapper class to include a page modifier:

```vue
<div v-loading="loading" class="detail-content detail-content--abnormal">
```

Use `detail-content--change`, `detail-content--grounding`, and `detail-content--undercarriage` for the other pages. Keep all existing `v-loading`, `v-if`, and action bindings unchanged.

- [ ] **Step 2: Wrap application and flow information in cards**

Preserve the existing `Descriptions` props exactly, but wrap each section as:

```vue
<section class="detail-card">
  <header class="detail-card__header">
    <div class="detail-card__title">
      <span class="detail-card__bar" />
      <span>申请信息</span>
    </div>
  </header>
  <div class="detail-card__body">
    <Descriptions ... />
  </div>
</section>
```

Use the same structure for “流程信息”, keeping `AuditNodeIndicator` in the body after the existing descriptions.

- [ ] **Step 3: Convert store rows to nested detail cards**

Keep each existing `v-for`, key, item values, and conditional blocks. Use this structure for each store:

```vue
<section class="detail-card detail-card--store">
  <header class="detail-card__header detail-card__header--store">
    <div class="detail-card__title detail-card__title--store">
      <span class="detail-card__bar detail-card__bar--store" />
      <span>店铺 {{ index + 1 }}：{{ existingStoreTitle }}</span>
    </div>
  </header>
  <div class="detail-card__body">
    <Descriptions :desc-items="storeBaseDescItems" :data="storeBaseDescData(item)" :column="3" border />
    <!-- existing page-specific sub-sections remain below or become additional Descriptions cards -->
  </div>
</section>
```

Keep abnormal/change/undercarriage-specific labels and fields unchanged. For grounding, retain the editable `DynamicForm` and `SubAccountEditor` in the same conditional block after the read-only section.

- [ ] **Step 4: Wrap attachments and audit logs in cards**

Keep `AuditAttachmentList`, `el-alert`, `el-empty`, and `el-timeline` exactly functionally equivalent, but place each under the same `detail-card` header/body structure. Do not change `v-if`/`v-else-if` ordering or timeline item fields.

- [ ] **Step 5: Add scoped card styles to each page**

Add a `<style scoped lang="scss">` block using the page accent variable:

```scss
.detail-content {
  --detail-accent: #f59e0b;
}

.detail-card {
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  background: #fff;
}

.detail-card__header {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.detail-card__body {
  padding: 16px;
}

.detail-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.detail-card__title--store {
  font-size: 14px;
}

.detail-card__bar {
  display: inline-block;
  width: 6px;
  height: 18px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--detail-accent) 0%, #fbbf24 100%);
}

.detail-card__bar--store {
  width: 4px;
  height: 14px;
  border-radius: 2px;
}
```

Use `#0ea5a4`/`#2dd4bf` for change, `#10b981`/`#34d399` for grounding, and `#3b82f6`/`#60a5fa` for undercarriage. Do not add deep selectors unless required by an existing child component.

- [ ] **Step 6: Run targeted lint and diff checks**

Run:

```bash
npx eslint src/pages/storeAuditAbnormal/addOrEdit/detail.vue src/pages/storeAuditChange/addOrEdit/detail.vue src/pages/storeAuditGrounding/addOrEdit/detail.vue src/pages/storeAuditUndercarriage/addOrEdit/detail.vue --format stylish
git diff --check
```

Expected: targeted lint and whitespace checks pass, and only template/config/style changes appear in the four detail files.

---

### Task 3: Run cashier static validation

**Files:**
- Verify: the four modified detail pages

- [ ] **Step 1: Run the documented ESLint report**

```bash
npx eslint src --format stylish
```

Expected: exit code 0.

- [ ] **Step 2: Run the documented Vue TypeScript check**

```bash
npx vue-tsc --noEmit
```

Expected: report any existing `packages/share` declaration errors separately; do not modify share dependencies as part of this UI-only task.

- [ ] **Step 3: Confirm changed-file scope**

```bash
git status --short -- src/pages/storeAuditAbnormal/addOrEdit/detail.vue src/pages/storeAuditChange/addOrEdit/detail.vue src/pages/storeAuditGrounding/addOrEdit/detail.vue src/pages/storeAuditUndercarriage/addOrEdit/detail.vue
```

Confirm no API, enum, utility, shared component, or test file was changed.
