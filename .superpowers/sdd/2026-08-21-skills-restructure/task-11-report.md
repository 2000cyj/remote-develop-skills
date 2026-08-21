# Task 11 Report — 最终校验 + 前序 spec gap 修复

**Status:** COMPLETE
**Base:** `5380eda` (Task 10)
**Commit:** `e7c994d chore: final validation pass and cleanup`

---

## Fix 1 — README 校验脚本 bug

原脚本 `awk '/^description:/{getline; print}'` 取的是 description 的**下一行**（单行 description 时即 frontmatter 结束符 `---`），对所有 8 个 skill 都会误报 `BAD DESC`。

改为：

```bash
desc=$(awk -F'description: *' '/^description:/{print $2; exit}' "$d/SKILL.md")
```

### 负向测试（证明修复非空过）

```
awktest/BAD.md   (description: 在 cashier 中做某事。)
  OLD awk -> [---]              => BAD DESC   ← 误报来源
  NEW awk -> [在 cashier 中做某事。] => BAD DESC   ← 正确拒绝
awktest/GOOD.md  (description: Use when 做某事。)
  OLD awk -> [---]              => BAD DESC   ← BUG：合法 desc 被误判
  NEW awk -> [Use when 做某事。]  => PASS       ← 正确通过
```

旧脚本对合法 description 误报，新脚本合法通过、非法拒绝。

---

## Fix 2 — stale `basics-*` 引用清理（11 处）

Python 批量替换（UTF-8 安全，最长匹配优先）：

| 旧 | 新 |
|---|---|
| `basics-develop-skills-vue/basics-button-permission-vue/SKILL.md` | `remote-button-permission/SKILL.md` |
| `basics-button-permission-vue` | `remote-button-permission` |
| `basics-list-page-directory-vue` | `remote-list-page-directory` |
| `basics-permission-summary-vue` | `remote-permission-summary` |
| `basics-ts-es-check-vue` | `remote-ts-es-check` |
| `basics-claude-hooks-vue` | `remote-claude-hooks` |

输出：

```
 1 replacements -> remote-button-permission/references/code-patterns.md
 1 replacements -> remote-button-permission/references/permission-mechanism.md
 1 replacements -> remote-claude-hooks/references/hook-events.md
 2 replacements -> remote-claude-hooks/SKILL.md              ← $basics-ts-es-check-vue → $remote-ts-es-check
 1 replacements -> remote-list-page-directory/references/directory-structure.md
 1 replacements -> remote-list-page-directory/references/file-responsibilities.md
 1 replacements -> remote-permission-summary/references/sql-script.md
 2 replacements -> remote-permission-summary/references/template-and-formats.md  ← 含 :56 path 字符串
 1 replacements -> remote-ts-es-check/references/error-signatures.md
TOTAL 11
```

校验：`grep -rn "basics-" remote-*/` → exit 1（无匹配）。

> 备注：任务书写"6 处 references 描述头"，实际为 **8 处**（另含 hook-events.md、error-signatures.md）。总数 11 与任务书一致，全部已处理。

---

## Fix 3 — `remote-java-standard/SKILL.md` 拆分（2359 → 189 行）

### 拆分前章节（18 个 H2，含行数）

| 章节 | 行数 | 处置 |
|---|---:|---|
| 核心规范 | 43 | **留** |
| 注释规范 | 99 | → `coding-quality.md` |
| 代码规范（8 条速查） | 87 | **留**（Quick Reference） |
| 目录归属规则 | 21 | **留** |
| Controller 模式规范 | 285 | → `architecture-layers.md` |
| 细则导航 | 14 | **留**（已扩充导航行） |
| 红线 | 16 | **留**（Required Constraints） |
| 调用链规范 | 277 | → `architecture-layers.md` |
| 调用链行级模板（4 层逐行规范） | 356 | → `call-chain-templates.md`（新建） |
| PO 字段映射规约 | 146 | → `data-model-sql.md` |
| 异常处理完整规约 | 103 | → `coding-quality.md` |
| 日志格式细化 | 115 | → `coding-quality.md` |
| DTO/VO 设计规范 | 138 | → `code-structure.md` |
| 代码评审清单 | 114 | → `code-review-checklist.md`（新建） |
| 安全性规约 | 107 | → `coding-quality.md` |
| 错误码/错误信息规范 | 98 | → `coding-quality.md` |
| Feign 客户端使用规约 | 122 | → `coding-quality.md` |
| 业务-数据归属精确规则 | 210 | → `concerns-separation.md` |

分类依据现有 `细则导航` 表的既有语义（如 coding-quality.md 本就声明覆盖"命名、注释、注解、错误处理、文件敏感信息、Feign"）。仅 2 个主题无对应 references，新建 2 个文件。

### 拆分后

**SKILL.md = 189 行**，保留 5 个 H2（原相对顺序不变）：

```
10  ## 核心规范
53  ## 代码规范
140 ## 目录归属规则
161 ## 细则导航     ← 扩充为 11 行，覆盖全部 11 个 references
177 ## 红线
```

**references 行数变化：**

| 文件 | 前 | 后 | Δ |
|---|---:|---:|---:|
| architecture-layers.md | 303 | 869 | +566 |
| call-chain-templates.md | — | 362 | 新建 |
| code-review-checklist.md | — | 120 | 新建 |
| code-structure.md | 287 | 427 | +140 |
| coding-quality.md | 258 | 914 | +656 |
| concerns-separation.md | 240 | 453 | +213 |
| data-model-sql.md | 209 | 357 | +148 |
| file-attachment-pattern.md | 169 | 169 | 0 |
| mybatis-vs-xml.md | 169 | 169 | 0 |
| performance.md | 175 | 175 | 0 |
| translation-aop.md | 154 | 154 | 0 |

### 内容完整性校验（逐行比对 HEAD 原文）

```
orig chars: 60482
MISSING original lines: 5
   (549..551, 554..555)  ← 全部为 细则导航 表格行（本次有意扩充）
```

原 2359 行中 **2354 行逐字保留**；唯一变更的 5 行即导航表格行。章节顺序、正文均未重组或删减。

### 编码保真

各 references 原有 BOM / 行尾风格逐文件保留，追加内容自动匹配目标文件行尾：

```
architecture-layers.md   BOM   CRLF  utf8-OK
call-chain-templates.md  noBOM LF    utf8-OK
code-review-checklist.md noBOM LF    utf8-OK
code-structure.md        BOM   CRLF  utf8-OK
coding-quality.md        BOM   CRLF  utf8-OK
concerns-separation.md   noBOM CRLF  utf8-OK
data-model-sql.md        BOM   CRLF  utf8-OK
file-attachment-pattern.md noBOM LF  utf8-OK
mybatis-vs-xml.md        noBOM LF    utf8-OK
performance.md           BOM   CRLF  utf8-OK
translation-aop.md       BOM   CRLF  utf8-OK
```

---

## Fix 4 — 冗余 `.gitkeep` 清理

```
REMOVED docs/bug/.gitkeep (dir has 5 other entries)
REMOVED docs/变更/.gitkeep (dir has 2 other entries)
REMOVED docs/字典/.gitkeep (dir has 3 other entries)
REMOVED docs/权限/.gitkeep (dir has 3 other entries)
REMOVED docs/测试文档/.gitkeep (dir has 2 other entries)
REMOVED docs/beforeSkills/.gitkeep (dir has 4 other entries)
```

每个目录均先确认存在真实文件才删除。剩余 `.gitkeep`：0。

---

## 完整校验输出（plan Task 11 Step 1-4）

### Step 1 — skill 校验脚本

```
=== Step 1: skill validation ===
(no output above = all pass)
```

无 `RESIDUAL cashier` / `MISSING` / `MISMATCH` / `BAD DESC` / `UNEXPECTED README.md`。

```
=== skill dirs ===
remote-button-permission/
remote-claude-hooks/
remote-flowable-task-with-next/
remote-idea-mcp-usage/
remote-java-standard/
remote-list-page-directory/
remote-permission-summary/
remote-ts-es-check/
```

8 个 skill 目录 ✅

### Step 2 — SKILL.md 行数 ≤ 500

```
OK remote-button-permission/       (34 lines)
OK remote-claude-hooks/            (87 lines)
OK remote-flowable-task-with-next/ (487 lines)
OK remote-idea-mcp-usage/          (252 lines)
OK remote-java-standard/           (189 lines)   ← 本次 2359 → 189
OK remote-list-page-directory/     (33 lines)
OK remote-permission-summary/      (32 lines)
OK remote-ts-es-check/             (64 lines)
```

8/8 全部 ≤ 500 ✅

### Step 3 — docs-skills/ 已删除

```
OK docs-skills gone
```

### Step 4 — docs/ 子目录非空

```
superpowers/specs: 5 files
superpowers/plans: 9 files
bug: 11 files
变更: 3 files
字典: 3 files
权限: 3 files
测试文档: 2 files
beforeSkills: 4 files
```

全部非空 ✅

### 附加 — Global Constraints 抽查

```
=== forbidden dirs in skills ===
(none)                        ← 无 examples/ tests/ templates/ skills/
=== top-level subdirs per skill ===
remote-button-permission/:       references
remote-claude-hooks/:            references
remote-flowable-task-with-next/: references
remote-idea-mcp-usage/:          (none)
remote-java-standard/:           references
remote-list-page-directory/:     references
remote-permission-summary/:      references
remote-ts-es-check/:             references
```

```
basics refs: 0
gitkeep:     0
java SKILL:  189 lines
```

---

## Git 状态

```
e7c994d chore: final validation pass and cleanup
5380eda docs: write README with skill index table
4d6f10a chore: remove docs-skills/ after migration complete
3662ba2 chore(docs): migrate historical superpowers specs/plans into docs/
e57675a chore(docs): migrate all subdirs out of docs-skills/
b604832 feat(skills): rebuild idea-mcp-usage as standard skill
e83b23a refactor(skills): split flowable plan-a/b patterns into references to meet 500-line guideline
b2431a9 feat(skills): rebuild flowable-task-with-next as standard skill
ffce3c7 chore(skills): merge duplicate list-page content, archive original
c6e9d05 feat(skills): migrate java-standard to remote-* format
```

`git status --short`（仅剩未跟踪的 sdd 报告，与前序 task 一致，未提交）：

```
?? .superpowers/sdd/2026-08-21-skills-restructure/task-1-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-10-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-2-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-3-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-3-review.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-4-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-5-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-6-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-7-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-8-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-8-supplement-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-9-report.md
```

Commit diffstat：24 files changed, 2224 insertions(+), 2190 deletions(-)

---

## Concerns

1. **`coding-quality.md` 现 914 行、`architecture-layers.md` 869 行** — plan 的 500 行上限只约束 SKILL.md，references 无上限，故不违规。但这两个文件偏大，后续如需可再按主题细分（如把 Feign / 安全性 / 日志各自独立）。本次优先遵守"扩展已有 9 个 references 而非新建更多"的指示，只新建了 2 个必要文件。

2. **追加章节的 H2 编号风格不统一** — 已有 references 用 `## N. 标题` 连续编号，本次追加的章节保留原 SKILL.md 的 `## 标题`（无编号），以 `---` 分隔。这是为遵守"保留原语义、不删减不重组"约束而有意为之；若后续要统一编号，属纯格式化改动。

3. **仓库 `core.autocrlf` 会把新写入的 LF 文件转成 CRLF** — `git add` 阶段有 14 条 "LF will be replaced by CRLF" 警告。这是仓库既有配置行为（前序 task 同样适用），非本次引入，内容不受影响。

4. **Task 12（cc-switch 实测扫描）仍为人工步骤** — 需人工在 cc-switch 中添加仓库根为扫描入口并确认列出 8 个 skill，本 task 范围内无法自动验证。

5. **任务书中"6 处 references 描述头"与实测 8 处不符** — 总数 11 一致，已全部替换，无残留。
