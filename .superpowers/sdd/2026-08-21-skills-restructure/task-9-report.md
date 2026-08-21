# Task 9 Report — 删除源目录

## 执行结果

### Step 1: `git rm -r docs-skills/skills2222`
```
rm 'docs-skills/skills2222/SKILL.md'
rm 'docs-skills/skills2222/references/architecture-layers.md'
rm 'docs-skills/skills2222/references/code-structure.md'
rm 'docs-skills/skills2222/references/coding-quality.md'
rm 'docs-skills/skills2222/references/concerns-separation.md'
rm 'docs-skills/skills2222/references/data-model-sql.md'
rm 'docs-skills/skills2222/references/file-attachment-pattern.md'
rm 'docs-skills/skills2222/references/mybatis-vs-xml.md'
rm 'docs-skills/skills2222/references/performance.md'
rm 'docs-skills/skills2222/references/translation-aop.md'
```
10 files deleted.

### Step 2: 校验 basics-develop-skills-vue/ 非空
```
basics-button-permission-vue/
basics-claude-hooks-vue/
basics-list-page-directory-vue/
basics-permission-summary-vue/
basics-ts-es-check-vue/
README.md
```
确认有 5 个子目录 + README.md。

### Step 3: `git rm -r docs-skills/docs/basics-develop-skills-vue`
14 files deleted (含 README.md + 5 个子目录的 SKILL.md + 8 个 references 文件)。

### Step 4: `git rm docs-skills/docs/basics-develop-skills-vue.7z`
```
rm 'docs-skills/docs/basics-develop-skills-vue.7z'
```

### Step 5: `git rm -r docs-skills/docs/skills`
```
rm 'docs-skills/docs/skills/cashier-list-page-directory-skill.md'
rm 'docs-skills/docs/skills/flowable-complete-task-with-next.md'
rm 'docs-skills/docs/skills/idea-mcp-usage-scope.md'
```
3 files deleted（计划外但属于 docs-skills/docs/ 残留，按 plan "删除源目录" 精神一并清理）。

### Step 6: `find docs-skills -type f` 校验
无输出（所有文件已 staged for delete）。

### Step 7: `git rm -r docs-skills` 兜底
- 第一次失败：`fatal: pathspec 'docs-skills' did not match any files`
  - 原因：Step 1-5 已将 docs-skills 下所有 tracked file staged 为 delete，`git ls-files --stage docs-skills` 返回空。
- 工作树残留 2 个空子目录（untracked，未在 HEAD 中）：`docs-skills/skills1111/{,references/}` 和 `docs-skills/basics-develop-skills-vue/`（`skills1111` 为 Task 4-7 旧 mv 残留的空壳）
- 处理：`rmdir` 逐个删除空目录，docs-skills 整个目录消失。

### Step 8: `ls -d remote-*/` 校验
```
remote-button-permission/
remote-claude-hooks/
remote-flowable-task-with-next/
remote-idea-mcp-usage/
remote-java-standard/
remote-list-page-directory/
remote-permission-summary/
remote-ts-es-check/
```
8 个目录，全部命中。

### Step 9: 单次 commit
```
[master 4d6f10a] chore: remove docs-skills/ after migration complete
 28 files changed, 7288 deletions(-)
```

## 最终 git log --oneline | head -10
```
4d6f10a chore: remove docs-skills/ after migration complete
3662ba2 chore(docs): migrate historical superpowers specs/plans into docs/
e57675a chore(docs): migrate all subdirs out of docs-skills/
b604832 feat(skills): rebuild idea-mcp-usage as standard skill
e83b23a refactor(skills): split flowable plan-a/b patterns into references to meet 500-line guideline
b2431a9 feat(skills): rebuild flowable-task-with-next as standard skill
ffce3c7 chore(skills): merge duplicate list-page content, archive original
c6e9d05 feat(skills): migrate java-standard to remote-* format
9693742 feat(skills): migrate basics-develop-skills-vue children to remote-* format
102a3ee chore: scaffold docs/ layout
```

## git status
```
On branch master
Your branch is based on 'origin/master', but the upstream is gone.
Untracked files:
  .superpowers/sdd/2026-08-21-skills-restructure/task-1-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-2-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-3-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-3-review.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-4-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-5-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-6-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-7-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-8-report.md
  .superpowers/sdd/2026-08-21-skills-restructure/task-8-supplement-report.md

nothing added to commit but untracked files present
```
仅有 10 个 report.md untracked，符合计划预期。

## Concerns

1. **`docs-skills/docs/skills/` 删除（计划外但符合 plan "删除源目录" 精神）**：
   - 包含 `cashier-list-page-directory-skill.md` / `flowable-complete-task-with-next.md` / `idea-mcp-usage-scope.md` 三个 md
   - 这三个 md 是历史单文件 skill spec，Task 5/6/7 重建的 `remote-*` skill 已包含其内容（合并/重建到 references/）
   - 未单独 commit，合并到本次 "remove docs-skills/" commit 内
   - 若需单独 commit 标识迁移历史，可后续用 `git revert` + 拆分重 commit

2. **Step 7 `git rm -r docs-skills` 失败处理**：
   - 因 Step 1-5 已将所有 tracked 文件 staged delete，docs-skills tree 已无 tracked content
   - 工作树残留 2 个空子目录 + 1 个 docs-skills 空壳（均 untracked）
   - 已用 `rmdir` 删除，不影响 git 历史（HEAD tree 中 docs-skills 的子树在本次 commit 中整体消失）

3. **`docs-skills/skills1111/` 残留**：Task 4-7 git mv 后此目录应为空（确认），仅作为 untracked 空目录遗留。本次 rmdir 清理，不入 commit。

## 总结

Task 9 全部完成。docs-skills/ 源目录整体从 HEAD 中消失，单 commit `4d6f10a` 提交 28 个 file delete。8 个 remote-* 目录全部存在，符合计划预期。