---
name: remote-develop-skills
description: >
  Use on ANY coding task in the orca-workflow workspace: Java 8 back-end
  work, Vue 3 front-end work, bi-cashier modifications, bi-flowable
  tasks, IDEA tooling, orca-cli, TypeScript type checks, git commits,
  or write-permission discussions. This skill is a ROUTER — it points
  you to the specialized sub-skill for the topic at hand. Follow the
  4-step decision algorithm below; pick the first matching step; load
  that sub-skill's SKILL.md from <available_skills> (do NOT guess
  paths). When no step matches, fall back to AGENTS.md and general
  practice.
argument-hint: "[topic]"
license: MIT
---

# Remote develop skills (router)

This skill routes coding tasks in the orca-workflow workspace to
specialized sub-skills. Always read this router first when the
workspace is orca-workflow; then load the sub-skill the decision
algorithm below points at.

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
2. Run the 4-step decision algorithm below; pick the first match.
3. Call the read tool on the matched sub-skill's `<location>` (do
   NOT guess paths; `<available_skills>` is the source of truth for
   which sub-skills are loaded and where they live).
4. Apply the sub-skill's rules.

If a step names a sub-skill that is NOT in `<available_skills>`,
that sub-skill is not loaded in this session — skip it and continue
to the next step. Do NOT try to read it; fall back to AGENTS.md per
"When no step matches" below.

## Decision algorithm

Run these 4 steps **in order**. **Pick the first step that
matches.** A step matches when **all** of its positive tokens appear
in the prompt AND **none** of its negative tokens appear.

Token matching is **case-insensitive substring match** (token as a
substring of the prompt). Multi-word tokens are split on `,` and `+`
in the table below.

### Step 1 — Specific tool / API / file path (highest priority)

A specific tool name, API method, or file path in the prompt is
the strongest signal. These wins over general module or technology
matches.

| Positive tokens (case-insensitive substring) | Negative tokens (do NOT match if prompt contains) | Sub-skill |
|---|---|---|
| `BiFlowableClient.completeTaskWithNext`, `Flowable`, `审批`, `下一节点`, `幂等` | — | `remote-cashier-flowable-task-with-next` |
| `mcp__idea__`, `IDEA` (in context of executing a tool or DB op) | `orca`, `worktree`, `commit` | `remote-idea-mcp-usage` |
| `orca` (as a CLI command, not in `BiFlowableClient` etc.) | `BiFlowableClient`, `审批` | `remote-orca-cli` |
| `ptyId`, `incarnationId`, `tabId`, `跨agent`, `跨 agent`, `派发` | — | `remote-orca-agent-communication` |
| `conventional commits`, `commitlint`, `lint-staged`, `拆批`, `分批提交` | — | `remote-commit-git` |
| `write-allowlist`, `allowlist`, `写权限`, `写盘` | — | `remote-write-scope` |
| `vue-tsc`, `ESLint` (in frontend / Vue / TS context) | `bi-cashier`, `.java` | `remote-ts-es-check` |
| `src/pages/`, `src/pages` | `bi-cashier`, `Java` | `remote-cashier-list-page-directory` |

### Step 2 — Module + file type (medium priority)

When no Step 1 row matches, look for a specific Maven module +
file extension.

| Positive tokens | Negative tokens | Sub-skill |
|---|---|---|
| `bi-cashier` AND (`.java` OR `.xml` OR `.sql` OR `改` OR `新加` OR `审查`) | `Flowable`, `审批`, `mcp__idea__`, `IDEA` | `remote-cashier-java-standard` |

The negative tokens ensure: a prompt about bi-cashier + Flowable
goes to Step 1's `remote-cashier-flowable-task-with-next`, and a
prompt about bi-cashier + IDEA tool goes to Step 1's
`remote-idea-mcp-usage`, not here.

### Step 3 — Skill maintenance (this repo)

When the prompt is about modifying the rds repository itself
(router + sub-skill authoring), not about business code.

| Positive tokens | Negative tokens | Sub-skill |
|---|---|---|
| `remote-*` skill, `SKILL.md` frontmatter, `cc-switch`, `Codex installer`, `自检` (in the context of rds repo maintenance) | `bi-cashier`, `Vue`, `IDEA` | `remote-develop-skills-repo` |

### Step 4 — No match

If no step above matches, do NOT pick a sub-skill. Fall back to
`AGENTS.md` and general practice. Do NOT silently apply rules from
a sub-skill that didn't match.

## Examples

These are concrete `prompt → sub-skill` cases to anchor the
algorithm. Use them as a reference, not as the only source of
truth.

| User prompt | Matched step | Selected sub-skill | Why |
|---|---|---|---|
| "改 `bi-cashier-service` 下的 `XxxService.java`" | Step 2 | `remote-cashier-java-standard` | bi-cashier + .java |
| "调 IDEA 看 `BiFlowableClient.completeTaskWithNext` 调用链" | Step 1 (flowable wins) | `remote-cashier-flowable-task-with-next` | Specific token `BiFlowableClient.completeTaskWithNext` beats general IDEA/bi-cashier |
| "在 `bi-cashier` 项目里调 IDEA 改 `.java`" | Step 1 (idea wins) | `remote-idea-mcp-usage` | Specific action `IDEA` + `mcp__idea__` beats module context; the action (tool being used) is more specific than the module |
| "前端 ESLint 检查刚改的 .vue 文件" | Step 1 | `remote-ts-es-check` | Specific tool `ESLint` in frontend context |
| "在 `src/pages/cashier-list/` 下新建页面" | Step 1 | `remote-cashier-list-page-directory` | Specific path `src/pages/` |
| "跑 `orca worktree spawn` 起新 worktree" | Step 1 | `remote-orca-cli` | Specific CLI command `orca worktree` |
| "给另一个 agent 发 terminal 消息，ptyId 找不到了" | Step 1 | `remote-orca-agent-communication` | Specific token `ptyId` |
| "把这一批改动按 conventional commits 拆批提交" | Step 1 | `remote-commit-git` | Specific token `conventional commits` |
| "在 rds 仓库加个新 skill `remote-foo`" | Step 3 | `remote-develop-skills-repo` | Repo maintenance |
| "更新 README.md" | None | (no skill) | Step 4 — fall back to AGENTS.md |

## When no step matches

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
