---
name: remote-orca-skill-repo
description: Use when 在 C:\Users\20614\orca\remote-develop-skills 仓库新增、修改、发布 remote-* skill，写 SKILL.md frontmatter、维护 references 目录、跑 README 自检脚本，或在 cc-switch / Codex installer / Orca CLI / 手动复制 之间选择本仓库 skill 的同步路径；不要用于消费 orca CLI 调用本身——那是 remote-orca-cli 的活。
---

# remote-develop-skills 仓库运维

本 skill 约束 `C:\Users\20614\orca\remote-develop-skills\` 仓库内 `remote-*` skill 的新增 / 修改 / 发布流程，以及它与 cc-switch、Codex installer、Orca CLI 之间的关系。**不要**用它去写业务代码或消费 `orca` 命令本身。

Use `recipes/release-checklist.md` when 发布新 skill 前逐项自检。
Use `recipes/skill-coexistence.md` when 需要厘清本仓库 skill 与 Orca 自带 sub-skill、`remote-claude-hooks` 之间的边界。

## Workflow

1. **判断范围**：本任务是不是在改 / 新增 `remote-*/SKILL.md` 或其 `references/` / `recipes/`？不是 → 不要触发本 skill；改业务代码 / Java / 前端 → 用对应业务 skill。
3. **写 frontmatter**：YAML 块三连短横线包围；`name` 必须等于父目录名（如 `remote-button-permission` 写在 `remote-button-permission/SKILL.md`）；`description` 第一句必须 `Use when ...`（中文为主，工具/路径锚点 + 任务动词，3-6 个并列触发场景，末尾可加 `；不要用于 X` 反向边界）。
4. **维护 references / recipes**：SKILL.md 内用 `Use references/<file>.md when <场景>` 或 `Use recipes/<file>.md when <场景>` 显式路由读者；不要用 "Read xxx first" 这种散落写法。
5. **跑 README 自检**（详见 `recipes/release-checklist.md`）：

   ```bash
   cd /c/Users/20614/orca/remote-develop-skills
   for d in remote-*/; do
     [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
     name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
     [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
     desc=$(awk -F'description: *' '/^description:/{print $2; exit}' "$d/SKILL.md")
     echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
   done
   ```

   期望：所有 `remote-*/` 静默通过。新加 skill 后必须再跑一次。
7. **确认本机已登记**（`remote-orca-cli` 写法不同——它是消费 CLI；本 skill 不依赖 `orca status`）：

   ```bash
   orca repo list | grep remote-develop-skills
   ```

   期望：命中 `dad07f73-9067-453a-a903-e6ee42db434c`（本仓库自身的 UUID）。如果未命中，先 `orca repo add C:/Users/20614/orca/remote-develop-skills`。

## Required Constraints

- **`name == 父目录名`**：自检脚本逐字比对。`remote-button-permission` 写在 `remote-button-permission/SKILL.md`，**不能**写在 `button-permission/` 或 `Remote-Button-Permission/`。
- **`description` 必须以 `Use when` 起手**：自检用 `grep -q "^Use when"`。前面加 markdown 标题、引言、英文摘要都会被判定 BAD DESC。
- **`docs/`、`superpowers/`、`.claude/`、`docs/beforeSkills/` 都不是 skill 路径**：cc-switch 只扫仓库根 `remote-*/`；放进 `docs/` 不会被任何 consumer 加载。
- **`orca skills install` 装的是 Orca 自带 sub-skill，不是本仓库 skill**：`orca skills list` 输出的 8 个 sub-skill（`computer-use` / `orca-cli` / `orchestration` / ...）走 `orca skills install` 链路；本仓库 `remote-*` 走 cc-switch / Codex installer / 手动复制。**不要混用**。
- **`references/` 是唯一被实际使用的子目录**：`agents/` / `scripts/` / `assets/` 是 README 约定的预留位置，**目前 0 个 skill 真正使用**，新 skill 不必为这三个目录强建文件。
- **frontmatter 路由用 `Use references/<file>.md when <场景>`**：不要在 SKILL.md 正文里散落 "Read xxx first"（这是 `remote-button-permission` 等老 skill 的写法，新 skill 应统一）。
- **正文三段式**：推荐 `# Title` + `Read references/quickref.md first.` 或 `Use ... when ...` 索引 + `## Workflow` + `## Required Constraints` + `## Response Shape`。**不要**学 `remote-flowable-task-with-next` 的纯数字编号段落风格。
- **不要在 SKILL.md 塞 legacy 兼容块**：`remote-claude-hooks` 末尾有 `<!-- HOOK CONFIG START ... -->` 那种 legacy 字段块，新 skill 不沿用；遗留字段放 `recipes/` 或单独的 changelog。

## Response Shape

每次发布 / 修改 skill 后回报：

- 改动的 `SKILL.md` 与 `references/*.md` / `recipes/*.md` 路径清单。
- 自检脚本的运行结果（必须静默通过）。
- `description` 第一句的触发场景（3-6 个并列）。
- 同步路径选择（cc-switch / Codex installer / 手动复制），以及是否已跑通。
- 若新增 skill：在 README 的 Skill 索引里加一行（README 是 source of truth）。

## 三条同步路径（性质不同，**不能互换**）

| 路径 | 装什么 | 用法 | 适用 |
|---|---|---|---|
| **cc-switch** | 本仓库 `remote-*` skill | cc-switch 扫仓库根 `C:\Users\20614\orca\remote-develop-skills`；按配置同步到 `~/.codex/skills/` 或 `~/.claude/skills/` | 本机 / 团队内开发者 |
| **Codex installer** | 本仓库 `remote-*` skill | `Use $skill-installer to install skill from <url>` | 远程 / 临时环境 |
| **手动复制** | 本仓库 `remote-*` skill | `cp -r remote-* ~/.codex/skills/` 或 `~/.claude/skills/` | 一次性 / 排错 |
| **`orca skills install`** | **Orca 自带**的 8 个 sub-skill | `orca skills install` / `update` / `share` | **与本仓库无关**——常被误用 |

## 不要做的事

- 不要把 `orca skills install` 当成本仓库 `remote-*` 的安装入口。它装的是 Orca 自带 sub-skill；本仓库 skill 在 `orca skills get` 里**取不到**。
- 不要在 `docs/` 下建 skill 目录——cc-switch / Codex 都不扫。
- 不要在 frontmatter 加 `--version`、`--author`、自定义元数据——README 自检脚本只看 `name` / `description` 两字段；多写无害但也别写。
- 不要在 SKILL.md 里散落 references 引用（"see also xxx"、"ref: xxx.md"）——必须用 `Use references/<file>.md when <场景>` 路由。
- 不要把 legacy / 实验性字段塞进 SKILL.md——放 `recipes/` 或 changelog。
- 不要让 `name` 与目录名差一个字符就提交——自检脚本会报 MISMATCH，但 cc-switch / Codex 加载会按 frontmatter 找目录，落空。

## 进一步阅读

- 仓库「宪法」：`docs/superpowers/specs/2026-08-21-skills-dir-design.md` §4.1（目录内部布局）、§4.2（frontmatter 规则）、§4.3（references 路由）。
- 老版蓝图（仅参考）：`docs/beforeSkills/创建skills基础结构/创建skills基础结构.md`—— jetlinks 来源，含 `agents/openai.yaml` 蓝图，本仓库 0 个 skill 用过 `agents/`。
- 现有 8 个 skill 的 frontmatter 风格范本：`remote-cashier-java-standard`（中文长 description + 反向边界）、`remote-button-permission`（中文并列触发 + "确保全模块…一致" 收尾）、`remote-idea-mcp-usage`（中文 + 权限矩阵 + 执行流程 + 快速检查四段式）。