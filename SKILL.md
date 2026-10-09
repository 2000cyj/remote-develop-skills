---
name: remote-develop-skills
description: >
  Use on ANY coding task in the orca-workflow workspace: Java 8 back-end
  work, Vue 3 front-end work, bi-cashier modifications, bi-flowable
  tasks, IDEA tooling, orca-cli, TypeScript type checks, git commits,
  or write-permission discussions. This skill is a ROUTER — it points
  you to the specialized sub-skill for the topic at hand. Read the
  routing table below; pick the row that matches; use the read tool
  on that sub-skill's SKILL.md (the location is in your
  <available_skills> block) before proceeding. When the task doesn't
  match any row, fall back to the workspace's AGENTS.md and general
  practice.
argument-hint: "[topic]"
license: MIT
---

# Remote develop skills (router)

This skill routes coding tasks in the orca-workflow workspace to
specialized sub-skills. Always read this router first when the
workspace is orca-workflow; then load the sub-skill the routing
table points at.

## Persistence

ACTIVE EVERY coding task. Always re-check the routing table before
treating a task as solved directly. Sub-skill rules override the
generic rules here.

Off: "stop router" / "ignore remote-develop-skills".

## How to load a sub-skill

The Pi system prompt includes a `<available_skills>` block listing
every sub-skill loaded in this session, with each entry's
`<location>` (absolute path to its `SKILL.md`). To load a sub-skill:

1. Read this router (you are doing it now).
2. Match the user's task to a row in the routing table below.
3. Call the read tool on the matched sub-skill's `<location>`
   (do NOT guess paths; the `<available_skills>` block is the
   source of truth for which sub-skills are loaded and where they
   live).
4. Apply the sub-skill's rules.

If a row in the routing table names a sub-skill that is NOT in
`<available_skills>`, that sub-skill is not loaded in this session —
do NOT try to read it; fall back to AGENTS.md per "When no row
matches" below.

## Routing table

| Task signal | Sub-skill (name from `<available_skills>`) |
|---|---|
| Java 8 / `bi-cashier-api` / `bi-cashier-component` / `bi-cashier-service` / `bi-cashier-web` 改 `.java` / `.xml` / `.sql` | `remote-cashier-java-standard` |
| Vue 3 + cashier 列表页 / 在 `src/pages/` 下新建或改造页面/业务模块目录 / apis·components·config·enum·utils 归属 | `remote-cashier-list-page-directory` |
| `BiFlowableClient.completeTaskWithNext` 调用链 / 审批结果与幂等 / 下一节点信息查询 | `remote-cashier-flowable-task-with-next` |
| 前端 ESLint / vue-tsc 范围检查 / 仅扫当前任务编辑过的文件 | `remote-ts-es-check` |
| 调 IDEA 工具 / `mcp__idea__*` / 后端 Java·Spring Boot·数据库 | `remote-idea-mcp-usage` |
| 调 `orca` CLI / worktree / terminal / 内置浏览器 | `remote-orca-cli` |
| 跨 agent 派发 / 通过 Orca terminal 发送消息 / 重新定位 ptyId·incarnationId·tabId·leafId·worktreeId | `remote-orca-agent-communication` |
| Conventional commits 拆批 / 多仓库 commit + 推送 | `remote-commit-git` |
| 讨论写权限 / write-allowlist / allowlist 范围 / write·edit·apply_patch·multi_edit·bash·powershell 边界 | `remote-write-scope` |
| 在本仓库根目录改 / 新增 `remote-*` skill / 写 SKILL.md frontmatter / 跑自检 | `remote-develop-skills-repo` |

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
