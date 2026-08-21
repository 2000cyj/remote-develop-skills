# Task 7 Report: 重建 remote-idea-mcp-usage skill

## 步骤实际命令 + 输出

### Step 1+2: 创建目录 + git mv

```bash
mkdir -p remote-idea-mcp-usage && git mv docs-skills/skills1111/idea-mcp-usage-scope.md remote-idea-mcp-usage/SKILL.md
```

输出：
```
--- AFTER ---
remote-idea-mcp-usage/SKILL.md
docs-skills/skills1111/references/  (剩 references/ 目录)
git status:
Changes to be committed:
  renamed: docs-skills/skills1111/idea-mcp-usage-scope.md -> remote-idea-mcp-usage/SKILL.md
```

源文件 247 行已搬至 `remote-idea-mcp-usage/SKILL.md`，git 自动识别为 rename。

### Step 3: 插入 frontmatter

```bash
edit(SKILL.md, old="# IDEA MCP 使用范围与操作规范",
     new="---\nname: remote-idea-mcp-usage\ndescription: Use when 通过 JetBrains IDEA MCP 读取代码、构建项目、查询数据库、设置本地权限，需判断操作是否需要确认或用户授权，或解释默认允许/需确认/必须授权的三级权限。\n---\n\n# IDEA MCP 使用范围与操作规范")
```

插入位置：原首行之前。`---` 闭合后留一空行，再接原标题 `# IDEA MCP 使用范围与操作规范`。

### Step 4: 校验

```bash
$ wc -l remote-idea-mcp-usage/SKILL.md
252 remote-idea-mcp-usage/SKILL.md

$ head -6 remote-idea-mcp-usage/SKILL.md
---
name: remote-idea-mcp-usage
description: Use when 通过 JetBrains IDEA MCP 读取代码、构建项目、查询数据库、设置本地权限，需判断操作是否需要确认或用户授权，或解释默认允许/需确认/必须授权的三级权限。
---

# IDEA MCP 使用范围与操作规范
```

校验结果：
- name = `remote-idea-mcp-usage` ✓
- description 起手 `Use when` ✓
- 总行数 252（247 + 5 frontmatter）≤ 500 ✓
- 与原标题之间留一空行 ✓

### Step 5: 单次 commit

```bash
git add remote-idea-mcp-usage/SKILL.md
git commit -m "feat(skills): rebuild idea-mcp-usage as standard skill"
```

输出：
```
[master b604832] feat(skills): rebuild idea-mcp-usage as standard skill
 1 file changed, 5 insertions(+)
 rename docs-skills/skills1111/idea-mcp-usage-scope.md => remote-idea-mcp-usage/SKILL.md (97%)
```

## 最终 git 状态

```bash
$ git log --oneline | head -5
b604832 feat(skills): rebuild idea-mcp-usage as standard skill
e83b23a refactor(skills): split flowable plan-a/b patterns into references to meet 500-line guideline
b2431a9 feat(skills): rebuild flowable-task-with-next as standard skill
ffce3c7 chore(skills): merge duplicate list-page content, archive original
c6e9d05 feat(skills): migrate java-standard to remote-* format

$ git status
On branch master
Your branch is based on 'origin/master', but the upstream is gone.
Untracked files:
  .superpowers/sdd/2026-08-21-skills-restructure/task-*-report.md (历史报告)
nothing added to commit but untracked files present
```

工作区中除历史 task 报告文件外无其他更改。

## concerns

- 无重大 concerns。
- 源文件 247 行 ≤ 500 行阈值，未触发 references 拆分（与 plan Task 7 约束一致）。
- description 较长（包含三级权限说明），但 SKILL 规范未限制 description 长度，保持语义完整。
- `docs-skills/skills1111/` 剩 `references/` 子目录，将在 Task 9 删除源目录时一并清理。
- 工作区 LF/CRLF 警告是 Git 默认行为，不影响内容。
