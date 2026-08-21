# Task 8 Supplement Report — migrate `docs-skills/docs/superpowers/` → `docs/superpowers/`

Status: **DONE**
Commit: `3662ba2` chore(docs): migrate historical superpowers specs/plans into docs/
Parent HEAD before: `e57675a`

## 1. Pre-migration inventory

### Source: `docs-skills/docs/superpowers/`
```
plans/
specs/
```

`docs-skills/docs/superpowers/specs/` (4 files):
```
2026-08-01-tailwind-styles-conversion-design.md
2026-08-11-pending-pages-standardization-design.md
2026-08-14-onboarding-application-department-design.md
2026-08-14-onboarding-detail-attachments-removal-design.md
```

`docs-skills/docs/superpowers/plans/` (8 files):
```
2026-08-11-pending-pages-standardization.md
2026-08-14-onboarding-department-id.md
2026-08-14-onboarding-detail-attachments-removal.md
2026-08-14-v2-audit-api-integration.md
2026-08-17-store-audit-add-edit-ui-cards.md
2026-08-17-store-audit-approval-contract-fix.md
2026-08-17-store-audit-detail-ui-cards.md
2026-08-18-store-audit-change-flowable-plan.md
```

### Destination before migration: `docs/superpowers/`
```
docs/superpowers/plans:
2026-08-21-skills-restructure.md

docs/superpowers/specs:
2026-08-21-skills-dir-design.md
```

**Filename conflict check: none.** All source files are dated 2026-08-01..08-18; the only pre-existing destination files are dated 2026-08-21.

## 2. Copy commands and actual output

```bash
cp -rnv docs-skills/docs/superpowers/specs/*.md docs/superpowers/specs/
cp -rnv docs-skills/docs/superpowers/plans/*.md docs/superpowers/plans/
```

Output (all 12 copies executed; `-n` no-clobber triggered on zero files, confirming no overwrite):
```
'docs-skills/docs/superpowers/specs/2026-08-01-tailwind-styles-conversion-design.md' -> 'docs/superpowers/specs/2026-08-01-tailwind-styles-conversion-design.md'
'docs-skills/docs/superpowers/specs/2026-08-11-pending-pages-standardization-design.md' -> 'docs/superpowers/specs/2026-08-11-pending-pages-standardization-design.md'
'docs-skills/docs/superpowers/specs/2026-08-14-onboarding-application-department-design.md' -> 'docs/superpowers/specs/2026-08-14-onboarding-application-department-design.md'
'docs-skills/docs/superpowers/specs/2026-08-14-onboarding-detail-attachments-removal-design.md' -> 'docs/superpowers/specs/2026-08-14-onboarding-detail-attachments-removal-design.md'
--- plans ---
'docs-skills/docs/superpowers/plans/2026-08-11-pending-pages-standardization.md' -> 'docs/superpowers/plans/2026-08-11-pending-pages-standardization.md'
'docs-skills/docs/superpowers/plans/2026-08-14-onboarding-department-id.md' -> 'docs/superpowers/plans/2026-08-14-onboarding-department-id.md'
'docs-skills/docs/superpowers/plans/2026-08-14-onboarding-detail-attachments-removal.md' -> 'docs/superpowers/plans/2026-08-14-onboarding-detail-attachments-removal.md'
'docs-skills/docs/superpowers/plans/2026-08-14-v2-audit-api-integration.md' -> 'docs/superpowers/plans/2026-08-14-v2-audit-api-integration.md'
'docs-skills/docs/superpowers/plans/2026-08-17-store-audit-add-edit-ui-cards.md' -> 'docs/superpowers/plans/2026-08-17-store-audit-add-edit-ui-cards.md'
'docs-skills/docs/superpowers/plans/2026-08-17-store-audit-approval-contract-fix.md' -> 'docs/superpowers/plans/2026-08-17-store-audit-approval-contract-fix.md'
'docs-skills/docs/superpowers/plans/2026-08-17-store-audit-detail-ui-cards.md' -> 'docs/superpowers/plans/2026-08-17-store-audit-detail-ui-cards.md'
'docs-skills/docs/superpowers/plans/2026-08-18-store-audit-change-flowable-plan.md' -> 'docs/superpowers/plans/2026-08-18-store-audit-change-flowable-plan.md'
```

## 3. Source removal

```bash
git rm -r docs-skills/docs/superpowers
```
Succeeded. Post-check: `ls docs-skills/docs/superpowers` → `No such file or directory`.

`docs-skills/docs/` still contains (untouched, reserved for Task 9):
```
basics-develop-skills-vue/
basics-develop-skills-vue.7z
skills/
```

## 4. Verification — file counts

```
specs count: 5    (expected 5 = 4 historical + 1 current restructure spec)  OK
plans count: 9    (expected 9 = 8 historical + 1 current restructure plan)  OK
```

## 5. Commit verification

`git show --stat --name-status HEAD` reports all 12 files as **R100** (pure rename, 100% content similarity) — no md content was modified:

```
R100  docs-skills/docs/superpowers/plans/2026-08-11-pending-pages-standardization.md            -> docs/superpowers/plans/2026-08-11-pending-pages-standardization.md
R100  docs-skills/docs/superpowers/plans/2026-08-14-onboarding-department-id.md                 -> docs/superpowers/plans/2026-08-14-onboarding-department-id.md
R100  docs-skills/docs/superpowers/plans/2026-08-14-onboarding-detail-attachments-removal.md    -> docs/superpowers/plans/2026-08-14-onboarding-detail-attachments-removal.md
R100  docs-skills/docs/superpowers/plans/2026-08-14-v2-audit-api-integration.md                 -> docs/superpowers/plans/2026-08-14-v2-audit-api-integration.md
R100  docs-skills/docs/superpowers/plans/2026-08-17-store-audit-add-edit-ui-cards.md            -> docs/superpowers/plans/2026-08-17-store-audit-add-edit-ui-cards.md
R100  docs-skills/docs/superpowers/plans/2026-08-17-store-audit-approval-contract-fix.md        -> docs/superpowers/plans/2026-08-17-store-audit-approval-contract-fix.md
R100  docs-skills/docs/superpowers/plans/2026-08-17-store-audit-detail-ui-cards.md              -> docs/superpowers/plans/2026-08-17-store-audit-detail-ui-cards.md
R100  docs-skills/docs/superpowers/plans/2026-08-18-store-audit-change-flowable-plan.md         -> docs/superpowers/plans/2026-08-18-store-audit-change-flowable-plan.md
R100  docs-skills/docs/superpowers/specs/2026-08-01-tailwind-styles-conversion-design.md        -> docs/superpowers/specs/2026-08-01-tailwind-styles-conversion-design.md
R100  docs-skills/docs/superpowers/specs/2026-08-11-pending-pages-standardization-design.md     -> docs/superpowers/specs/2026-08-11-pending-pages-standardization-design.md
R100  docs-skills/docs/superpowers/specs/2026-08-14-onboarding-application-department-design.md -> docs/superpowers/specs/2026-08-14-onboarding-application-department-design.md
R100  docs-skills/docs/superpowers/specs/2026-08-14-onboarding-detail-attachments-removal-design.md -> docs/superpowers/specs/2026-08-14-onboarding-detail-attachments-removal-design.md
```

## 6. Final state

`git log --oneline | head -5`:
```
3662ba2 chore(docs): migrate historical superpowers specs/plans into docs/
e57675a chore(docs): migrate all subdirs out of docs-skills/
b604832 feat(skills): rebuild idea-mcp-usage as standard skill
e83b23a refactor(skills): split flowable plan-a/b patterns into references to meet 500-line guideline
b2431a9 feat(skills): rebuild flowable-task-with-next as standard skill
```

`git status --short` (working tree clean apart from untracked SDD task reports):
```
?? .superpowers/sdd/2026-08-21-skills-restructure/task-1-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-2-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-3-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-3-review.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-4-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-5-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-6-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-7-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-8-report.md
```

## 7. Concerns

1. **Non-blocking — CRLF warnings.** `git add` emitted `LF will be replaced by CRLF the next time Git touches it` for all 12 files. This is standard Windows `core.autocrlf` behaviour; the blobs are byte-identical in the index (R100 confirms), so content is unaffected. No action needed unless the repo wants an explicit `.gitattributes`.
2. **No conflicts encountered.** `cp -n` did not skip a single file, so nothing was silently dropped and nothing was overwritten.
3. **Task 9 scope untouched.** `docs-skills/skills1111/`, `skills2222/`, `basics-develop-skills-vue/`, `docs-skills/docs/skills/`, and `docs/skills/` were not read or modified by this task.
4. **`docs-skills/docs/` is not yet empty** — it still holds `basics-develop-skills-vue/`, `basics-develop-skills-vue.7z`, and `skills/`. Task 9 will need to clear these before `docs-skills/` can be removed entirely.
