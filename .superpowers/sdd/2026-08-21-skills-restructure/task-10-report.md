# Task 10 Report — 根 README.md

## Step 1: 写入 README

| | 大小 |
|---|---|
| 写入前（Task 1 占位） | 23 bytes（`# Remote Develop Skills` 一行） |
| 写入后 | 2018 bytes |

内容逐字采用 plan Task 10 Step 1 给定文本，未增删。

### `head -30 README.md`

```
# Remote Develop Skills

BI/OBO 远程开发技能仓库，对齐 [jetlinks-develop-skills](https://github.com/jetlinks/jetlinks-develop-skills) 结构。

## 启用方式

- **cc-switch**：仓库根目录为扫描入口，同步启用需要的 skill
- **Codex**：`Use $skill-installer to install skill from <url>`
- **手动**：把 skill 目录复制到 `~/.codex/skills/`

## Skill 索引

### 后端规范
- $remote-java-standard — BI/OBO Java 后端分层与编码规范

### 前端规范
- $remote-button-permission — 按钮操作权限（适用于 cashier 等子应用）
- $remote-list-page-directory — 列表页目录结构
- $remote-permission-summary — 权限汇总导出
- $remote-ts-es-check — TS & ESLint 静态检查
- $remote-claude-hooks — Claude Code hooks 说明

### 工作流
- $remote-flowable-task-with-next — Flowable completeTaskWithNext 规范

### 工具链
- $remote-idea-mcp-usage — IDEA MCP 使用规范
```

索引中 8 个 skill 名称已与仓库根现有目录逐一核对，全部一致。

## Step 2: 提交

`git add README.md` + 单次 commit。

### `git log --oneline | head -5`

```
5380eda docs: write README with skill index table
4d6f10a chore: remove docs-skills/ after migration complete
3662ba2 chore(docs): migrate historical superpowers specs/plans into docs/
e57675a chore(docs): migrate all subdirs out of docs-skills/
b604832 feat(skills): rebuild idea-mcp-usage as standard skill
```

### `git status --short`

工作区 clean（仅剩未跟踪的 `.superpowers/sdd/.../task-*.md` 报告文件，非本任务范围）。

## 校验脚本试跑

按 README 内脚本原样跑了一遍，结果：

```
BAD DESC remote-button-permission/
BAD DESC remote-claude-hooks/
BAD DESC remote-flowable-task-with-next/
BAD DESC remote-idea-mcp-usage/
BAD DESC remote-java-standard/
BAD DESC remote-list-page-directory/
BAD DESC remote-permission-summary/
BAD DESC remote-ts-es-check/
```

无 `MISSING` / `MISMATCH` / `RESIDUAL` —— name 与目录名 8/8 一致，SKILL.md 8/8 存在。

## Concerns

1. **校验脚本的 desc 检查逻辑有 bug（8/8 误报）。** 脚本用
   `awk '/^description:/{getline; print}'` 取 description 的**下一行**，
   但实际 frontmatter 是单行写法：

   ```
   description: Use when 新建或审查 BI/OBO Java 后端代码……
   ```

   于是 getline 取到的是 `---` 结束行，`grep "^Use when"` 必然失败。
   8 个 skill 的 description 实际都以 `Use when` 开头，是**脚本错，不是 skill 错**。
   本次按指令逐字采用 plan 文本，未擅自修正。建议 Task 11 把该行改为
   `awk -F'description: *' '/^description:/{print $2; exit}'` 之类的单行提取，
   或明确保留现状（若约定 description 走多行 YAML 折叠语法，则应反过来改 8 个 SKILL.md）。

2. `remote-java-standard/SKILL.md` 的 `name` 带引号（`name: "remote-java-standard"`），
   其余为裸值。脚本已用 `sed 's/"//g'` 兜住，无影响，仅记录风格不统一。

3. Git 提示 `LF will be replaced by CRLF`（Windows autocrlf），仓库内已有同类提示，非本次引入。
