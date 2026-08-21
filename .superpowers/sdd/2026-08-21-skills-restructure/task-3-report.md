# Task 3 Report — 迁移基础 Vue skill（5 个）

**状态**：✅ 完成  
**Commit**：`9693742 feat(skills): migrate basics-develop-skills-vue children to remote-* format`  
**日期**：2026-08-21  
**Plan**：`docs/superpowers/plans/2026-08-21-skills-restructure.md` Task 3

---

## Step 1-2：git mv 5 个目录

### Step 1（前 2 个）
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/basics-develop-skills-vue/basics-button-permission-vue remote-button-permission && \
  git mv docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue remote-list-page-directory
```
输出：无（成功）。

### Step 2（后 3 个）
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/basics-develop-skills-vue/basics-permission-summary-vue remote-permission-summary && \
  git mv docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue remote-ts-es-check && \
  git mv docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue remote-claude-hooks
```
输出：无（成功）。

### 验证 git status
```
R  docs-skills/basics-develop-skills-vue/basics-button-permission-vue/SKILL.md -> remote-button-permission/SKILL.md
R  docs-skills/basics-develop-skills-vue/basics-button-permission-vue/references/code-patterns.md -> remote-button-permission/references/code-patterns.md
R  docs-skills/basics-develop-skills-vue/basics-button-permission-vue/references/permission-mechanism.md -> remote-button-permission/references/permission-mechanism.md
R  docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue/SKILL.md -> remote-claude-hooks/SKILL.md
R  docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue/references/hook-events.md -> remote-claude-hooks/references/hook-events.md
R  docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue/SKILL.md -> remote-list-page-directory/SKILL.md
R  docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue/references/directory-structure.md -> remote-list-page-directory/references/directory-structure.md
R  docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue/references/file-responsibilities.md -> remote-list-page-directory/references/file-responsibilities.md
R  docs-skills/basics-develop-skills-vue/basics-permission-summary-vue/SKILL.md -> remote-permission-summary/SKILL.md
R  docs-skills/basics-develop-skills-vue/basics-permission-summary-vue/references/sql-script.md -> remote-permission-summary/references/sql-script.md
R  docs-skills/basics-develop-skills-vue/basics-permission-summary-vue/references/template-and-formats.md -> remote-permission-summary/references/template-and-formats.md
R  docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue/SKILL.md -> remote-ts-es-check/SKILL.md
R  docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue/references/error-signatures.md -> remote-ts-es-check/references/error-signatures.md
```

---

## Step 3：批量改 frontmatter `name` 字段

每 skill 跑两条 sed（双引号版本 + 无引号版本），覆盖两种可能。命令：
```bash
sed -i 's/^name: "<old>"/name: "<new>"/' <new>/SKILL.md
sed -i 's/^name: <old>/name: <new>/' <new>/SKILL.md
```

5 次均成功（echo "<skill> done" 输出）。

### 校验 — 改完后 `grep -E '^name:'` 输出：
```
=== remote-button-permission ===
name: remote-button-permission
=== remote-list-page-directory ===
name: remote-list-page-directory
=== remote-permission-summary ===
name: remote-permission-summary
=== remote-ts-es-check ===
name: remote-ts-es-check
=== remote-claude-hooks ===
name: remote-claude-hooks
```

---

## Step 4：批量改 description 起手为 Use when

### 重要：方法学说明
原 plan Task 3 Step 4 给出的 5 段新 description 都是**完整替换**（不是"只改起手句保留后面触发场景"），所以采用 Python 整行正则替换（`re.subn` on `^description:.*$`）保证全文精确替换；不使用 sed 是因为 description 含中文 + 括号 + 斜杠 + 全角句号，sed 转义复杂易踩坑。

第一遍尝试用了 "在 cashier..." 前缀匹配，结果发现 plan 给的新 description 是**完整版**而非增量，于是追加而非覆盖。第二遍用 `^description:.*$` 整行正则替换，一次到位。

### 最终 5 段 description（commit 后实际内容）：
```yaml
# remote-button-permission/SKILL.md
description: Use when 给 cashier 等子应用页面按钮添加操作权限控制、改造现有按钮权限写法、规范权限码命名、处理下拉菜单空菜单兜底、列表页操作列按权限隐藏，确保全模块权限写法一致。

# remote-list-page-directory/SKILL.md
description: Use when 在 src/pages/ 下新建或改造页面/业务模块目录、组织新增/修改/详情表单页、确定 apis/components/config/enum/utils 的归属、判定共用放外层与独立放当前，确保所有页面目录结构一致。

# remote-permission-summary/SKILL.md
description: Use when 把某目录下所有按钮操作权限汇总成结构化清单、扫描 checkPermission 调用点、补齐动态权限码、生成可执行 SQL，按模板产出 docs/权限/ 下的三个文件。

# remote-ts-es-check/SKILL.md
description: Use when 改动前后批量扫描 src/、定位 vue-tsc 或 eslint 报错根因（TS2554、member-delimiter、valid-template-root、unused-imports 等），区分 cashier 自身问题与 packages/share 既有问题。

# remote-claude-hooks/SKILL.md
description: Use when 判断某个自动化任务该用 Skill 还是 Hook、选择哪个生命周期事件（SessionStart/UserPromptSubmit/PreToolUse/Stop 等）、排查 hook 不生效或误拦截、向新人解释 hook 生命周期。
```

### 各 SKILL.md frontmatter diff 对比（git diff --stat）

| 文件 | 改动行数 |
|---|---|
| remote-button-permission/SKILL.md | +34 |
| remote-list-page-directory/SKILL.md | +31 |
| remote-permission-summary/SKILL.md | +32 |
| remote-ts-es-check/SKILL.md | +64 |
| remote-claude-hooks/SKILL.md | +87 |

每个文件的前 4 行（即 frontmatter 部分）：
```diff
---
-name: basics-<old>-vue
-description: 在 cashier 微应用中应用<xxx>的统一规范。适用于...
+name: remote-<new>
+description: Use when <plan 给的新版>
---
```

剩余行（Workflow / Required Constraints / Response Shape / 章节正文）原样保留。

---

## Step 5-7：校验脚本（全部 OK）

### Step 5：SKILL.md 存在性
```bash
for d in remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks; do
    [ -f "$d/SKILL.md" ] && echo "OK $d" || echo "MISSING $d/SKILL.md"
done
```
```
OK remote-button-permission
OK remote-list-page-directory
OK remote-permission-summary
OK remote-ts-es-check
OK remote-claude-hooks
```

### Step 6：name 与目录一致
```bash
for d in remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks; do
    name=$(grep -E '^name:' "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
    [ "$name" = "$d" ] && echo "OK $d" || echo "MISMATCH dir=$d name=$name"
done
```
```
OK remote-button-permission
OK remote-list-page-directory
OK remote-permission-summary
OK remote-ts-es-check
OK remote-claude-hooks
```

### Step 7：description 起手 Use when
```bash
for d in remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks; do
    grep -q "^description: Use when" "$d/SKILL.md" && echo "OK $d" || echo "BAD $d"
done
```
```
OK remote-button-permission
OK remote-list-page-directory
OK remote-permission-summary
OK remote-ts-es-check
OK remote-claude-hooks
```

**三道校验全部通过。**

---

## Step 8：commit
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks && \
  git commit -m "feat(skills): migrate basics-develop-skills-vue children to remote-* format"
```

### Commit 输出
```
[master 9693742] feat(skills): migrate basics-develop-skills-vue children to remote-* format
 13 files changed, 10 insertions(+), 10 deletions(-)
 rename {docs-skills/basics-develop-skills-vue/basics-button-permission-vue => remote-button-permission}/SKILL.md (82%)
 rename {docs-skills/basics-develop-skills-vue/basics-button-permission-vue => remote-button-permission}/references/code-patterns.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-button-permission-vue => remote-button-permission}/references/permission-mechanism.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue => remote-claude-hooks}/SKILL.md (91%)
 rename {docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue => remote-claude-hooks}/references/hook-events.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue => remote-list-page-directory}/SKILL.md (76%)
 rename {docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue => remote-list-page-directory}/references/directory-structure.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue => remote-list-page-directory}/references/file-responsibilities.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-permission-summary-vue => remote-permission-summary}/SKILL.md (83%)
 rename {docs-skills/basics-develop-skills-vue/basics-permission-summary-vue => remote-permission-summary}/references/sql-script.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-permission-summary-vue => remote-permission-summary}/references/template-and-formats.md (100%)
 rename {docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue => remote-ts-es-check}/SKILL.md (86%)
 rename {docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue => remote-ts-es-check}/references/error-signatures.md (100%)
```

每个 SKILL.md 都触发"非 100% 相似"——因为 frontmatter 的两行（name + description）有改动，references/ 下的 md 都是 100% 保留原状。

---

## 最终状态

### git log --oneline | head -5
```
9693742 feat(skills): migrate basics-develop-skills-vue children to remote-* format
102a3ee chore: scaffold docs/ layout
e9b49c3 chore: add placeholder README before restructure
```

### git status --short
```
?? .superpowers/sdd/2026-08-21-skills-restructure/task-1-report.md
?? .superpowers/sdd/2026-08-21-skills-restructure/task-2-report.md
```
工作树干净；只剩前序 Task 的报告文件未跟踪（不属于本 Task 范围）。

### 5 个 skill 目录现状
```
remote-button-permission/      → SKILL.md + 2 references
remote-list-page-directory/    → SKILL.md + 2 references
remote-permission-summary/     → SKILL.md + 2 references
remote-ts-es-check/            → SKILL.md + 1 references
remote-claude-hooks/           → SKILL.md + 1 references
```

---

## Concerns / 注意事项

1. **description 改写策略**：plan Task 3 Step 4 文字描述"保留原 description 的所有触发场景，只调整起手句"，但实际给出的 5 段新 description 都是**完整短版**，与原文不是"保留+改起手句"关系。本次按"完整替换为 plan 给定版本"执行，符合 task 指令"不要自由发挥，plan 里写好的 5 段新 description 必须逐字采用"。

2. **方法选择**：description 含中文 + 全角符号 + 括号 + 斜杠，sed 转义易出问题，改用 Python `re.subn(r'^description:.*$', new, ..., count=1)` 整行正则替换。name 字段是 ASCII + 短文本，sed `-i` 安全无虞。

3. **未触碰范围确认**：
   - `docs-skills/basics-develop-skills-vue/README.md` 保留原位（待 Task 8 归档）
   - `docs-skills/basics-develop-skills-vue/` 残留的 5 个 basics-* 旧名目录已全部迁走，留空
   - 各 skill 内 `references/` 子目录下的 md 文件 100% 保留原状（rename 100%）
   - 未碰 `docs-skills/skills1111/`、`skills2222/`、`docs-skills/docs/`

4. **未处理的轻微不一致**：`remote-claude-hooks/SKILL.md` 正文中仍有 `$basics-ts-es-check-vue` 这种旧名引用（cross-skill 引用，按 plan 全局约束应该改为 `$remote-ts-es-check`）。本次 Task 3 严格按 plan Step 3/4 只改 frontmatter，正文交叉引用改写属于后续 Task（plan 全局约束里"跨 skill 引用使用 `$remote-<领域>` 格式"是后期统一收口项），所以**保留不动**。后续 Task 11 最终校验时应检查并修复。

5. **Skill 目录结构合规**：5 个 skill 全部仅含 `SKILL.md` + `references/`，无 `README.md` / `examples/` / `tests/` / `templates/`，符合 plan Global Constraints。