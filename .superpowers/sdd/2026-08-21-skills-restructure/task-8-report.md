# Task 8 Report: 迁移 `docs/` 子目录全部内容

**状态**：✅ 完成
**Commit**：`e57675a chore(docs): migrate all subdirs out of docs-skills/`
**基线 HEAD**：`b604832`

---

## 1. 前置检查（迁移前）

### 目标目录状态（Task 2 建立的骨架）

全部 6 个目标目录仅含 `.gitkeep` 占位符，`beforeSkills/` 额外含 Task 5 归档的一个文件：

```
docs/bug/.gitkeep
docs/变更/.gitkeep
docs/字典/.gitkeep
docs/权限/.gitkeep
docs/测试文档/.gitkeep
docs/beforeSkills/.gitkeep
docs/beforeSkills/cashier-list-page-directory-skill.md
```

**关键判定**：源目录中**没有任何 `.gitkeep`**，因此 `cp -r src/* dst/` **不存在覆盖冲突**，无需 `cp -rn` 或 `rsync --ignore-existing`。直接按 plan 原样执行。

### `docs-skills/basics-develop-skills-vue/` 状态

```
$ ls -a docs-skills/basics-develop-skills-vue/
./  ../  README.md
```

符合预期：Task 3 已迁走 5 个 skill 子目录，仅剩 `README.md`。**无额外文件**，无需记 concern。

---

## 2. 各步骤实际命令 + 输出

### Step 1: 迁移 `docs/bug/`

```bash
ls docs-skills/docs/bug/ && cp -r docs-skills/docs/bug/* docs/bug/ && rm -rf docs-skills/docs/bug
```
```
2026-08-05-pre-commit-check/
代码审查_列表页_V1.2.03.md
修复版本V1.2.01.md
修复版本V1.2.02.md
解决方案/
STEP1_EXIT=OK
```

### Step 2: 迁移 `docs/变更/`

```bash
ls docs-skills/docs/变更/ && cp -r docs-skills/docs/变更/* docs/变更/ && rm -rf docs-skills/docs/变更
```
```
sql编辑变更整理/
共享组件适用性分析及改造方案.md
STEP2_EXIT=OK
```

### Step 3: 迁移 `docs/字典/`

```bash
ls docs-skills/docs/字典/ && cp -r docs-skills/docs/字典/* docs/字典/ && rm -rf docs-skills/docs/字典
```
```
package.json
字典.sql
字典模板.sql
STEP3_EXIT=OK
```

### Step 4: 迁移 `docs/权限/`

```bash
ls docs-skills/docs/权限/ && cp -r docs-skills/docs/权限/* docs/权限/ && rm -rf docs-skills/docs/权限
```
```
package.json
权限.sql
权限模板.sql
STEP4_EXIT=OK
```

### Step 5: 迁移 `docs/测试文档/`

```bash
ls docs-skills/docs/测试文档/ && cp -r docs-skills/docs/测试文档/* docs/测试文档/ && rm -rf docs-skills/docs/测试文档
```
```
店铺上架流程API测试记录.md
店铺下架流程-Orca真实测试操作手册.md
STEP5_EXIT=OK
```

### Step 6: 迁移 `docs/beforeSkills/`

```bash
ls docs-skills/docs/beforeSkills/ && cp -r docs-skills/docs/beforeSkills/* docs/beforeSkills/ && rm -rf docs-skills/docs/beforeSkills
```
```
列表目录结构/
创建skills基础结构/
STEP6_EXIT=OK
```

### Step 7: 归档 `basics-develop-skills-vue/README.md`

```bash
mkdir -p docs/beforeSkills/basics-develop-skills-vue && \
git mv docs-skills/basics-develop-skills-vue/README.md docs/beforeSkills/basics-develop-skills-vue/README.md
```
```
STEP7_EXIT=OK
# 迁移后源目录为空：
$ ls -a docs-skills/basics-develop-skills-vue/
./  ../
# 目标文件（大小一致，3747 bytes）：
-rw-r--r-- 1 20614 197609 3747 Aug  1 12:07 docs/beforeSkills/basics-develop-skills-vue/README.md
```

### Step 9: 提交

```bash
git add -A docs/ docs-skills/
git commit -m "chore(docs): migrate all subdirs out of docs-skills/"
```
→ `e57675a`

---

## 3. 迁移前后文件计数对比

| 目录 | SRC (迁移前) | DST 迁移前 | DST 迁移后 | 校验 |
|------|-------------|-----------|-----------|------|
| `bug/`          | 11 | 1 (`.gitkeep`) | **12** | 11 + 1 ✅ |
| `变更/`         | 3  | 1 (`.gitkeep`) | **4**  | 3 + 1 ✅ |
| `字典/`         | 3  | 1 (`.gitkeep`) | **4**  | 3 + 1 ✅ |
| `权限/`         | 3  | 1 (`.gitkeep`) | **4**  | 3 + 1 ✅ |
| `测试文档/`     | 2  | 1 (`.gitkeep`) | **3**  | 2 + 1 ✅ |
| `beforeSkills/` | 2  | 2 (`.gitkeep` + cashier) | **5** | 2 + 2 + 1(README) ✅ |

**合计迁移文件数：24 + 1 (README) = 25**，与 git 检出的 25 条 rename 记录完全一致。

---

## 4. Step 8 校验脚本输出

```bash
for d in bug 变更 字典 权限 测试文档 beforeSkills; do
  count=$(find "docs/$d" -type f 2>/dev/null | wc -l)
  echo "$d: $count files"
done
```

```
bug: 12 files
变更: 4 files
字典: 4 files
权限: 4 files
测试文档: 3 files
beforeSkills: 5 files
```

✅ **每个目录均 ≥ 1 个文件**，全部通过。（提交后复跑结果一致。）

### 完整 `docs/` 文件清单（排除 `superpowers/`）

```
docs/beforeSkills/.gitkeep
docs/beforeSkills/basics-develop-skills-vue/README.md
docs/beforeSkills/cashier-list-page-directory-skill.md
docs/beforeSkills/列表目录结构/列表页目录结构.md
docs/beforeSkills/创建skills基础结构/创建skills基础结构.md
docs/bug/.gitkeep
docs/bug/2026-08-05-pre-commit-check/00-overview.md
docs/bug/2026-08-05-pre-commit-check/01-frontend-core.md
docs/bug/2026-08-05-pre-commit-check/02-frontend-pages-A.md
docs/bug/2026-08-05-pre-commit-check/03-frontend-pages-B.md
docs/bug/2026-08-05-pre-commit-check/04-frontend-fileExpiration.md
docs/bug/2026-08-05-pre-commit-check/05-backend-bicashier.md
docs/bug/代码审查_列表页_V1.2.03.md
docs/bug/修复版本V1.2.01.md
docs/bug/修复版本V1.2.02.md
docs/bug/解决方案/修复版本V1.2.01.md
docs/bug/解决方案/修复版本V1.2.02.md
docs/变更/.gitkeep
docs/变更/sql编辑变更整理/调试-create1.sql
docs/变更/sql编辑变更整理/调试-update-menu-file-address.sql
docs/变更/共享组件适用性分析及改造方案.md
docs/字典/.gitkeep
docs/字典/package.json
docs/字典/字典.sql
docs/字典/字典模板.sql
docs/权限/.gitkeep
docs/权限/package.json
docs/权限/权限.sql
docs/权限/权限模板.sql
docs/测试文档/.gitkeep
docs/测试文档/店铺上架流程API测试记录.md
docs/测试文档/店铺下架流程-Orca真实测试操作手册.md
```

---

## 5. 内容完整性验证（超出 plan 的额外校验）

由于 plan 使用 `cp -r` + `rm -rf`（而非 `git mv`），存在内容损坏 / 中文文件名编码丢失的风险。提交前用 git rename detection 做了字节级校验：

```bash
git diff --cached --find-renames --name-status | wc -l          # → 25
git diff --cached --find-renames --name-status | grep -v "^R100" # → (none)
```

**结果：25 条记录全部为 `R100`（100% 相似度 = 字节完全一致）**，零内容改动、零丢失。中文路径（`变更/`、`字典/`、`权限/`、`测试文档/`、`解决方案/`、`sql编辑变更整理/`、`列表目录结构/`、`创建skills基础结构/`）全部正确保留。

`git add` 阶段有 17 条 `LF will be replaced by CRLF` 警告——这是 Windows `core.autocrlf` 的常规行为，非本次迁移引入（原文件在 `docs-skills/` 下也是同样处理），不影响 `R100` 判定。

---

## 6. 最终 `git log` + `git status`

```bash
$ git log --oneline | head -5
e57675a chore(docs): migrate all subdirs out of docs-skills/
b604832 feat(skills): rebuild idea-mcp-usage as standard skill
e83b23a refactor(skills): split flowable plan-a/b patterns into references to meet 500-line guideline
b2431a9 feat(skills): rebuild flowable-task-with-next as standard skill
ffce3c7 chore(skills): merge duplicate list-page content, archive original
```

```bash
$ git status --short
?? .superpowers/sdd/2026-08-21-skills-restructure/task-1-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-2-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-3-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-3-review.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-4-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-5-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-6-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-7-report.md
```

工作区干净，仅剩历次 task 报告（未跟踪，符合预期）。

---

## 7. Concerns

### ✅ 已排除的风险

1. **`cp -r` 中文路径**：完全正常。Git Bash on Windows 处理 `变更/`、`字典/`、`权限/`、`测试文档/` 无任何问题，未触发 plan 中预留的 PowerShell 备选方案。25/25 文件 `R100` 佐证。
2. **README.md 归档**：成功。`git mv` 保留了 rename 历史（`R100`），文件大小 3747 bytes 一致，源目录 `docs-skills/basics-develop-skills-vue/` 已空。
3. **`.gitkeep` 覆盖冲突**：不存在。源目录无 `.gitkeep`，无需特殊处理。
4. **skills1111 / skills2222 未被触碰**：已验证 `git diff --cached` 中无任何 `skills1111` / `skills2222` 路径，留给 Task 9。

### ⚠️ 需要关注的问题

#### C1（低）：6 个目录中残留的 `.gitkeep` 已失去作用

`docs/bug/.gitkeep` 等 6 个占位符所在目录现均已有真实文件，`.gitkeep` 已无存在意义。**未清理**——plan 全文未提及 `.gitkeep`（`grep -n "gitkeep"` 无匹配），清理属 Task 8 范围外动作。建议 Task 11 最终校验时统一删除这 6 个文件。

#### C2（**高**）：Task 9 会永久删除 12 个历史 plan/spec，plan 未安排迁移

`docs-skills/docs/superpowers/` 仍有 **12 个文件**（8 个 plans + 4 个 specs），全部为历史项目文档：

```
docs-skills/docs/superpowers/plans/2026-08-11-pending-pages-standardization.md
docs-skills/docs/superpowers/plans/2026-08-14-onboarding-department-id.md
docs-skills/docs/superpowers/plans/2026-08-14-onboarding-detail-attachments-removal.md
docs-skills/docs/superpowers/plans/2026-08-14-v2-audit-api-integration.md
docs-skills/docs/superpowers/plans/2026-08-17-store-audit-add-edit-ui-cards.md
docs-skills/docs/superpowers/plans/2026-08-17-store-audit-approval-contract-fix.md
docs-skills/docs/superpowers/plans/2026-08-17-store-audit-detail-ui-cards.md
docs-skills/docs/superpowers/plans/2026-08-18-store-audit-change-flowable-plan.md
docs-skills/docs/superpowers/specs/2026-08-01-tailwind-styles-conversion-design.md
docs-skills/docs/superpowers/specs/2026-08-11-pending-pages-standardization-design.md
docs-skills/docs/superpowers/specs/2026-08-14-onboarding-application-department-design.md
docs-skills/docs/superpowers/specs/2026-08-14-onboarding-detail-attachments-removal-design.md
```

而目标 `docs/superpowers/` 目前**只有本次重构的 2 个文件**：

```
docs/superpowers/plans/2026-08-21-skills-restructure.md
docs/superpowers/specs/2026-08-21-skills-dir-design.md
```

**问题**：plan 的 Task 8 只列了 6 个子目录，不含 `superpowers/`；而 Task 9 的说明写着"前提：Task 8 完成后 `docs-skills/docs/` 仅剩 `superpowers/` 子目录"，随后 Step 6 直接执行 `git rm -r docs-skills`。**结果是这 12 个历史文档会被直接删除而非迁移**——plan 全程没有安排它们的去向。

建议：Task 9 执行前先补一步 `cp -r docs-skills/docs/superpowers/* docs/superpowers/`（目标已有 `plans/`、`specs/` 子目录，文件名无冲突，可安全合并），或由上层明确确认「历史 plan/spec 可丢弃」。

#### C3（中）：2 个 skill 源文档仅存于 `docs-skills/`，Task 9 会一并删除

`docs-skills/docs/skills/` 有 3 个文件，是 Task 5/6/7 重建 skill 时的原始素材：

| 文件 | 是否已归档 |
|------|-----------|
| `cashier-list-page-directory-skill.md` | ✅ 已由 Task 5 归档到 `docs/beforeSkills/` |
| `flowable-complete-task-with-next.md` | ❌ **仅存于 `docs-skills/`** |
| `idea-mcp-usage-scope.md` | ❌ **仅存于 `docs-skills/`** |

已用 `git ls-files | grep -iE "flowable-complete-task-with-next|idea-mcp-usage-scope"` 确认后两者在仓库中**没有其他副本**。若与 `cashier-list-page-directory-skill.md` 保持一致的归档惯例，Task 9 前应把这 2 个也归档到 `docs/beforeSkills/`。（注：git 历史中仍可找回，非不可逆丢失。）

#### C4（低 / 信息）：`docs-skills/docs/basics-develop-skills-vue/` 是重复副本，可安全删除

该目录仍有 14 个跟踪文件（5 个 skill 的 SKILL.md + references + README.md），与 Task 3 迁到仓库根的 `remote-*` 内容重复。Task 9 Step 6 的 `git rm -r docs-skills` 删除它是合理的。仅提示：plan Task 9 的 Files 清单里没有单独列出这个目录（只列了 `.7z`），实际由 Step 6 兜底删除。

### Task 9 交接：`docs-skills/` 当前残留

```
docs-skills/docs/basics-develop-skills-vue/   14 tracked files  (重复副本，可删 — C4)
docs-skills/docs/basics-develop-skills-vue.7z  1 tracked file   (plan 已列，可删)
docs-skills/docs/skills/                       3 tracked files  (2 个未归档 — C3)
docs-skills/docs/superpowers/                 12 tracked files  (未迁移 — C2 ⚠️)
docs-skills/skills2222/                       10 tracked files  (plan 已列，可删)
docs-skills/skills1111/                        0 tracked files  (空目录 references/ 残留)
docs-skills/basics-develop-skills-vue/         0 tracked files  (本任务清空，空目录)
────────────────────────────────────────────────────────────────
合计跟踪文件：40
```
