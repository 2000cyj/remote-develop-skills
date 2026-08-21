# Task 4 Report: Migrate java-standard to remote-* format

Date: 2026-08-21
Plan: docs/superpowers/plans/2026-08-21-skills-restructure.md
Source: docs-skills/skills1111/
Target: remote-java-standard/

## Step-by-step Execution

### Step 1: mkdir -p remote-java-standard/references

```bash
mkdir -p remote-java-standard/references
```

Output:
```
drwxr-xr-x 1 20614 197609 0 Aug 21 10:52 references/
```

### Step 2: git mv SKILL.md + sed name

```bash
git mv docs-skills/skills1111/SKILL.md remote-java-standard/SKILL.md
sed -i 's/^name: "bi-cashier-java-standard"/name: "remote-java-standard"/' remote-java-standard/SKILL.md
sed -i 's/^name: bi-cashier-java-standard/name: remote-java-standard/' remote-java-standard/SKILL.md
```

Result (first 3 lines of SKILL.md):
```
---
name: "remote-java-standard"
description: "OBO BI 出纳模块 Java 开发规范。适用于 bi-cashier 模块的新增功能、代码审查、DTO/VO/PO 字段调整、Mapper SQL 编写。"
---
```

### Step 3: git mv 9 references/*.md

```bash
git mv docs-skills/skills1111/references/architecture-layers.md remote-java-standard/references/architecture-layers.md
git mv docs-skills/skills1111/references/code-structure.md remote-java-standard/references/code-structure.md
git mv docs-skills/skills1111/references/coding-quality.md remote-java-standard/references/coding-quality.md
git mv docs-skills/skills1111/references/concerns-separation.md remote-java-standard/references/concerns-separation.md
git mv docs-skills/skills1111/references/data-model-sql.md remote-java-standard/references/data-model-sql.md
git mv docs-skills/skills1111/references/file-attachment-pattern.md remote-java-standard/references/file-attachment-pattern.md
git mv docs-skills/skills1111/references/mybatis-vs-xml.md remote-java-standard/references/mybatis-vs-xml.md
git mv docs-skills/skills1111/references/performance.md remote-java-standard/references/performance.md
git mv docs-skills/skills1111/references/translation-aop.md remote-java-standard/references/translation-aop.md
```

### Step 4: Verify references count = 9

```bash
ls remote-java-standard/references/ | wc -l
```

Output: **9**

Files confirmed (all 9):
- architecture-layers.md
- code-structure.md
- coding-quality.md
- concerns-separation.md
- data-model-sql.md
- file-attachment-pattern.md
- mybatis-vs-xml.md
- performance.md
- translation-aop.md

### Step 5: sed description

```bash
sed -i 's|^description: "OBO BI 出纳模块 Java 开发规范.*|description: Use when 新建或审查 BI/OBO Java 后端代码、调整 DTO/VO/PO 字段、编写 Mapper SQL、分层调用违反规范、Service 聚合层与 Component 层职责混淆、跨服务 Feign 调用边界不清晰。|' remote-java-standard/SKILL.md
```

Result (first 3 lines of SKILL.md):
```
---
name: "remote-java-standard"
description: Use when 新建或审查 BI/OBO Java 后端代码、调整 DTO/VO/PO 字段、编写 Mapper SQL、分层调用违反规范、Service 聚合层与 Component 层职责混淆、跨服务 Feign 调用边界不清晰。
---
```

### Step 6: Verify name + description

```bash
grep -n "^name:" remote-java-standard/SKILL.md
grep -n "^description:" remote-java-standard/SKILL.md
```

Output:
```
2:name: "remote-java-standard"
3:description: Use when 新建或审查 BI/OBO Java 后端代码、调整 DTO/VO/PO 字段、编写 Mapper SQL、分层调用违反规范、Service 聚合层与 Component 层职责混淆、跨服务 Feign 调用边界不清晰。
```

### Step 7: wc -l SKILL.md

```bash
wc -l remote-java-standard/SKILL.md
```

Output: **2359 remote-java-standard/SKILL.md**

Per plan Task 4 Step 7: > 500 lines → do not split, record concern for Task 11.
**Concern:** SKILL.md is 2359 lines, far exceeds 500-line guideline. Per plan, deferral to Task 9 (re-stated as Task 11 final validation pass). Not in scope for Task 4.

### Step 8: Single commit

```bash
git add remote-java-standard/
git commit -m "feat(skills): migrate java-standard to remote-* format"
```

Commit output:
```
[master c6e9d05] feat(skills): migrate java-standard to remote-* format
 10 files changed, 2 insertions(+), 2 deletions(-)
 rename {docs-skills/skills1111 => remote-java-standard}/SKILL.md (99%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/architecture-layers.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/code-structure.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/coding-quality.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/concerns-separation.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/data-model-sql.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/file-attachment-pattern.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/mybatis-vs-xml.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/performance.md (100%)
 rename {docs-skills/skills1111 => remote-java-standard}/references/translation-aop.md (100%)
```

Note: Only 2 insertions / 2 deletions because the only line changes are the two frontmatter lines
(`name:` and `description:`). All content files are pure renames.

## Final State

### git log --oneline | head -5

```
c6e9d05 feat(skills): migrate java-standard to remote-* format
9693742 feat(skills): migrate basics-develop-skills-vue children to remote-* format
102a3ee chore: scaffold docs/ layout
e9b49c3 chore: add placeholder README before restructure
```

### git status

```
On branch master
Your branch is based on 'origin/master', but the upstream is gone.

Untracked files:
  .superpowers/sdd/2026-08-21-skills-restructure/task-1-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-2-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-3-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-3-review.md

nothing added to commit but untracked files present
```

## Summary

- Source: docs-skills/skills1111/SKILL.md (2359 lines) + 9 references
- Target: remote-java-standard/ (10 files)
- Frontmatter updated: name → "remote-java-standard", description → "Use when ..." format
- 1 commit: c6e9d05
- All renames detected by git (R) — content unchanged except frontmatter

## Concerns

1. **SKILL.md size (2359 lines)** — exceeds 500-line guideline significantly. Per plan Task 4 Step 7,
   split deferred to a later task (referenced as Task 9 in plan, will be in Task 11 final validation
   scope). Not split in Task 4 per instructions.
2. **Source description originally referenced "OBO BI 出纳模块 Java 开发规范"** — the original description
   was specific to bi-cashier. The new "Use when ..." description uses generic "BI/OBO Java 后端代码"
   semantics from plan. The body of SKILL.md still contains bi-cashier-specific text (e.g., "本模块继承 OBO BI
   Java 开发规范" and bi-cashier module names in tables). Body content was preserved verbatim per plan
   instruction "不要修改 references/*.md 内容" (interpreted strictly as no content edits). If the body
   needs de-bi-cashier-ization, that's a separate concern for later tasks.
3. **docs-skills/skills1111/ residual files** — per instructions, did NOT clean up the three non-target
   files remaining there (cashier-list-page-directory-skill.md, flowable-complete-task-with-next.md,
   idea-mcp-usage-scope.md). These are handled by Tasks 5/6/7 per plan.