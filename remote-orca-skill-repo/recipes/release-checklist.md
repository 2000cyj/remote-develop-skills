# 发布前逐项清单

## 1. 路径与命名

- [ ] skill 放在仓库根 `remote-*/SKILL.md`（**不**放 `docs/`、**不**放 `.superpowers/`、**不**套 `skills/` 父目录）。
- [ ] 目录名形如 `remote-<领域>`，全小写、连字符分隔；不含空格、中文、下划线。
- [ ] 父目录名 = SKILL.md frontmatter `name` 字段值（自检脚本逐字比对）。

## 2. frontmatter

- [ ] YAML 块用三连短横线包围（开头 `---`、结尾 `---`）。
- [ ] 仅有 `name` 与 `description` 两字段（不要加 `--version` / `author` / 自定义 metadata）。
- [ ] `name` 与父目录名完全一致（区分大小写）。
- [ ] `description` 第一句以 `Use when ` 起手（自检脚本 `grep -q "^Use when"` 命中）。
- [ ] description 风格对齐现有 8 个 skill（中文 + 工具/路径锚点 + 任务动词，3-6 个并列触发场景；末尾可加 `；不要用于 X` 反向边界）。

## 3. 正文结构

- [ ] 顶部 `# Title` 标题。
- [ ] 索引段（`Use references/<file>.md when <场景>` 或 `Use recipes/<file>.md when <场景>`），**不要**散落 "Read xxx first"。
- [ ] `## Workflow` 段：分步流程，每步一个动作。
- [ ] `## Required Constraints` 段：硬约束（必须 / 禁止）。
- [ ] `## Response Shape` 段：调用后回报格式。
- [ ] 不要学 `remote-flowable-task-with-next` 的纯数字编号段落风格。
- [ ] 不要在 SKILL.md 里塞 `<!-- HOOK CONFIG START ... -->` 这种 legacy 兼容块——放 `recipes/` 或 changelog。

## 4. references / recipes

- [ ] SKILL.md 中所有 `Use references/<file>.md when ...` 引用的文件**真实存在**（自检脚本不校验这一项，必须人工核对）。
- [ ] `references/` 是唯一被实际使用的子目录；`agents/` / `scripts/` / `assets/` **目前 0 个 skill 用过**，新 skill 不必为这三者强建文件，除非真有 Codex openai.yaml / 可执行脚本 / 静态资源。
- [ ] `recipes/` 子目录按需使用（如本仓库的 `remote-orca-skill-repo/recipes/`）。

## 5. 自检脚本

- [ ] 在仓库根跑：

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

- [ ] 输出必须静默（无 `MISSING` / `MISMATCH` / `BAD DESC`）。
- [ ] 如果报错：定位 `d`（目录名）、`name`（frontmatter name）、`desc`（description 第一句），对应修复。

## 6. README 索引

- [ ] 在 `README.md` 的「Skill 索引」节加一行（`$remote-<name> — 一句话描述`），并归到正确小节（后端规范 / 前端规范 / 工作流 / 工具链）。
- [ ] README 是 source of truth——README 没列，consumer 找不到。

## 7. 同步路径选择（三选一）

| 路径 | 适用 | 步骤 |
|---|---|---|
| **cc-switch** | 本机 / 团队内 | cc-switch 扫仓库根；`Sync Skills` 即可生效 |
| **Codex installer** | 远程 / 临时 | `Use $skill-installer to install skill from <url>` |
| **手动复制** | 一次性 / 排错 | `cp -r remote-<name> ~/.codex/skills/` 或 `~/.claude/skills/` |

- [ ] **不要**用 `orca skills install`——它装的是 Orca 自带的 8 个 sub-skill，**不是本仓库**。
- [ ] 选定路径后**实际跑通**：cc-switch 同步后**重启会话**才能让 frontmatter 生效。
- [ ] 验证：在新会话提「触发场景关键词」，期望 SKILL.md 被加载。

## 8. 交叉检查

- [ ] grep `orca` / `claude-hooks` 等术语在本 skill 内是否与既有 8 个 skill 撞车——若有，确认是引用而非重复。
- [ ] description 触发关键词是否覆盖目标场景（最少 3 个、最多 6 个并列）。
- [ ] 反向边界句（`；不要用于 X`）是否覆盖最常见的误用场景。

## 9. 提交

- [ ] commit message 含本仓库约定格式：`TicketNo:XXXX Description:【<模块>】<变更说明> Feature or BugFix: feat|fix Impact Scope:<影响范围>`。
- [ ] 改动文件清单：`SKILL.md` + `references/*.md` / `recipes/*.md` + `README.md`。
- [ ] 自检脚本运行结果（粘在 PR 描述或 commit body 里）。

## 常见 MISMATCH 原因

| 现象 | 原因 | 修复 |
|---|---|---|
| `MISMATCH remote-button-permission/ vs button-permission` | frontmatter `name` 写成 `button-permission` | 改成 `remote-button-permission` |
| `BAD DESC remote-xxx/` | description 第一句不是 `Use when` | 在第一句开头加 `Use when ` |
| `MISSING remote-xxx/SKILL.md` | 目录里没建 SKILL.md | 在 `remote-xxx/` 下新建 `SKILL.md`，frontmatter 两字段齐 |
| 自检脚本无输出 | 全部通过 | ✅ 完成 |

## 不要再写 README 第 48-60 行的脚本

README 已有自检脚本。**不要**在 SKILL.md 或 recipes/ 里复制整段脚本——只引用 + 解释每行含义即可。脚本维护在 README，本 skill 只是它的"使用说明"。