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

## 目录约定

- 每个 skill 一个目录，直接放仓库根
- 命名：`remote-<领域>`，如 `remote-java-standard`
- 子目录：`references/`（按需深度参考）、`agents/`（Codex openai.yaml）、`scripts/`、`assets/`

## 文档归档

非 skill 资产在 `docs/`：

- `superpowers/specs/` — brainstorming 设计稿
- `superpowers/plans/` — 实施计划
- `bug/` — bug 修复记录
- `变更/` — 变更整理
- `字典/` — 数据字典产物
- `权限/` — 权限 SQL 产物
- `测试文档/` — 测试记录
- `beforeSkills/` — 历史学习资料

## Skill 校验

发布前必须通过：

```bash
for d in remote-*/; do
  case "$d" in remote-cashier-*) echo "RESIDUAL cashier $d"; continue;; esac
  [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
  name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
  [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
  desc=$(awk -F'description: *' '/^description:/{print $2; exit}' "$d/SKILL.md")
  echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
done
```
