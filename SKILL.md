---
name: remote-develop-skills
description: >
  Use on ANY coding task in the orca-workflow workspace: Java 8 back-end
  work, Vue 3 front-end work, bi-cashier modifications, bi-flowable
  tasks, IDEA tooling, orca-cli, TypeScript type checks, git commits,
  or write-permission discussions. This skill is a ROUTER — it points
  you to the specialized sub-skill file for the topic at hand. Read
  the routing table below; pick the row that matches; read that
  sub-skill file before proceeding. When the task doesn't match any
  row, fall back to the workspace's AGENTS.md and general practice.
argument-hint: "[topic]"
license: MIT
---

# Remote develop skills (router)

This skill routes coding tasks in the orca-workflow workspace to
specialized sub-skill files. Always read this router first when the
workspace is orca-workflow; then jump to the sub-skill the routing
table points at.

## Persistence

ACTIVE EVERY coding task. Always re-check the routing table before
treating a task as solved directly. Sub-skill rules override the
generic rules here.

Off: "stop router" / "ignore remote-develop-skills".

## Routing table

| Task signal | Sub-skill file |
|---|---|
| Java 8 / `bi-cashier-api` / `bi-cashier-component` / `bi-cashier-service` / `bi-cashier-web` 改 `.java` / `.xml` / `.sql` | `remote-cashier-java-standard/SKILL.md` |
| Vue 3 + cashier 列表页 / 在 `src/pages/` 下新建或改造页面/业务模块目录 / apis·components·config·enum·utils 归属 | `remote-cashier-list-page-directory/SKILL.md` |
| `BiFlowableClient.completeTaskWithNext` 调用链 / 审批结果与幂等 / 下一节点信息查询 | `remote-cashier-flowable-task-with-next/SKILL.md` |
| 前端 ESLint / vue-tsc 范围检查 / 仅扫当前任务编辑过的文件 | `remote-ts-es-check/SKILL.md` |
| 调 IDEA 工具 / `mcp__idea__*` / 后端 Java·Spring Boot·数据库 | `remote-idea-mcp-usage/SKILL.md` |
| 调 `orca` CLI / worktree / terminal / 内置浏览器 | `remote-orca-cli/SKILL.md` |
| 跨 agent 派发 / 通过 Orca terminal 发送消息 / 重新定位 ptyId·incarnationId·tabId·leafId·worktreeId | `remote-orca-agent-communication/SKILL.md` |
| Conventional commits 拆批 / 多仓库 commit + 推送 | `remote-commit-git/SKILL.md` |
| 讨论写权限 / write-allowlist / allowlist 范围 / write·edit·apply_patch·multi_edit·bash·powershell 边界 | `remote-write-scope/SKILL.md` |
| 在本仓库根目录改 / 新增 `remote-*` skill / 写 SKILL.md frontmatter / 跑自检 | `remote-develop-skills-repo/SKILL.md` |

## When no row matches

Default behavior: follow `AGENTS.md` + standard practices. Do NOT
silently apply rules from a wrong sub-skill — if you're unsure, ask.

## About this repository

This repository hosts the `remote-*` skills for the orca-workflow
workspace. Each skill is a self-contained directory with a `SKILL.md`
entry point.

### Enable a skill

| Channel | How |
|---|---|
| **Pi shorthand** | Add `"git:github.com/2000cyj/remote-develop-skills@master"` (or with `skills: [...]`) to `packages[]` in `.pi/settings.json` |
| **Pi object form** | Use `{ "source": "git:github.com/2000cyj/remote-develop-skills@master", "skills": ["SKILL.md", "remote-*/SKILL.md"] }` to opt in per-skill |
| **cc-switch** | Repository root is the scan entry; sync the skills you need |
| **Codex** | `Use $skill-installer to install skill from <url>` |
| **Manual** | Copy the skill directory to `~/.codex/skills/` |

### Directory convention

Per-skill directory directly under the repo root, with optional:

- `references/` — deeper reference material grouped by target / form
- `agents/` — Codex `openai.yaml`
- `scripts/` — self-check / sync scripts
- `assets/` — templates, sample files

### Deprecated / incubating

- `deprecated/` — skills that are no longer maintained. Whole
  directories moved in; `name:` field retained with `Use when ...`
  describing why. Not synced by cc-switch / Codex installer.
- `incubating/` — skills still in development. `SKILL.md` frontmatter
  gets a `status:` field (`draft` / `wip` / `review` / `ready`). Not
  synced until they graduate to root.

### Skill validation (run before publishing)

```bash
# 切到本仓库根目录（路径按本机实际 checkout 位置）
cd <本仓库根>
for d in remote-*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
  name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
  [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
  desc=$(awk -F'description: *' '/^description:/{print $2; exit}' "$d/SKILL.md")
  echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
done
```

Plus this root `SKILL.md` (the router itself) — `name: remote-develop-skills`,
no `Use when` prefix (router, not a topic skill).
