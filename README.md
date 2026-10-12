# Remote Develop Skills — 规范文档

> **仓库定位**：BI/OBO 团队远程开发的**规范集合**。每个 skill 是独立的开发守则（Java 后端规范、前端目录规范、工具链用法、Flowable 流程调用等），由根 `SKILL.md` 做路由、`pi-extension` 做状态可视化。

> **本文档**面向两类读者：
> - **使用者**：CI / IDE / Claude Code / Codex 装了本仓库后，**怎么选**、**怎么用**这些 skill
> - **贡献者**：新加 / 修改 / 发布 `remote-*` skill 时**怎么写**、**怎么检**、**怎么发版**

---

## 1. 仓库结构

```
.
├── SKILL.md                            # 根路由器（Pi 加载后第一个读）
├── package.json                        # pi.skills / pi.extensions 挂载点
├── pi-extension/                       # Pi host 扩展：状态栏 + /rds 命令
│   ├── index.js
│   ├── package.json
│   └── test/
│       └── index.test.js
├── remote-*/                           # 已发布的 10 个子 skill
│   ├── SKILL.md                        # 入口
│   ├── references/                     # 按目标分档的深度参考
│   └── recipes/                        # （按需）操作手册
├── incubating/                         # 孵化中、未发布的 skill
├── deprecated/                         # 弃用、仅作历史归档
├── docs/                               # 非 skill 资产（bug 记录 / 设计稿 / 计划）
├── .superpowers/                       # 历史 superpowers 数据
└── .claude/                            # Claude Code 项目级配置
```

| 目录 / 文件 | 角色 | 同步分发 |
|------------|------|----------|
| `SKILL.md` | 根路由器 | ✅ |
| `pi-extension/` | host 状态栏 | ✅ |
| `remote-*/SKILL.md` | 已发布子 skill | ✅（10 个）|
| `incubating/remote-*/SKILL.md` | 孵化中 skill | ❌（毕业才挪到根）|
| `deprecated/remote-*/SKILL.md` | 弃用 skill | ❌（仅作历史归档）|
| `docs/` `superpowers/` `.claude/` | 工程产物 / 私有配置 | ❌ |

---

## 2. skill 命名约定

- **前缀必填**：`remote-`（已发布的子 skill 一律 `remote-<领域>`）
- **领域用 kebab-case**：`remote-cashier-java-standard` / `remote-idea-mcp-usage` / `remote-write-scope`
- **目录名 = `name` 字段**：自检脚本逐字比对，**不**允许 `Remote-Foo` / `remote_foo` / `foo`
- **cashier 模块专属加 `cashier` 中缀**：`remote-cashier-flowable-task-with-next` / `remote-cashier-java-standard` / `remote-cashier-list-page-directory` —— 显式标注模块组归属
- **不允许**空格 / 中文 / 下划线 / 全大写

---

## 3. SKILL.md frontmatter 规范

```yaml
---
name: <目录名>
description: Use when <触发场景 1>；或 <触发场景 2>；<末尾可加>; 不要用于 <反向边界>。
---
```

| 字段 | 要求 |
|------|------|
| `name` | 与父目录名完全一致（区分大小写）|
| `description` 第一句 | **必须** `Use when ` 起手（自检脚本 `grep -q "^Use when"` 命中）|
| `description` 风格 | 中文为主，工具 / 路径锚点 + 任务动词，3-6 个并列触发场景 |
| `description` 末尾 | 可加 `；不要用于 X` 反向边界 |
| 其他字段 | **禁止**加 `--version` / `author` / 自定义 metadata |

> **反面**（BAD DESC）：markdown 标题 / 引言 / 英文摘要开头都会被判定 BAD DESC。

---

## 4. SKILL.md 正文结构（三段式）

```markdown
# <Title>

本 skill 一句话定位。

Use references/<file>.md when <场景 1>。
Use references/<file>.md when <场景 2>。

## Workflow
1. 第一步动作
2. 第二步动作
...

## Required Constraints
- 硬约束 1（必须 / 禁止）
- 硬约束 2
...

## Response Shape
- 调用后回报格式
```

| 段落 | 内容 |
|------|------|
| 顶部 `# Title` | 一句话定位 |
| 索引段 | `Use references/<file>.md when <场景>` —— **不要**散落 "Read xxx first" |
| `## Workflow` | 分步流程，每步一个动作 |
| `## Required Constraints` | 硬约束（必须 / 禁止）|
| `## Response Shape` | 调用后回报格式 |

---

## 5. 子目录使用约定

| 子目录 | 用途 | 是否必备 |
|--------|------|---------|
| `references/` | 按目标 / 形态分档的深度参考 | 按需 |
| `recipes/` | 操作手册 / 发布清单 / 决策表 | 按需 |
| `agents/` | Codex `openai.yaml` | **0 个 skill 使用**，不强制建 |
| `scripts/` | 自检 / 同步脚本 | **0 个 skill 使用**，不强制建 |
| `assets/` | 模板、示例文件 | **0 个 skill 使用**，不强制建 |

**只 `references/` 和 `recipes/` 是真实使用的子目录**。`agents/` / `scripts/` / `assets/` 是预留位置，新 skill 不必为这三者强建文件。

---

## 6. 同步路径（消费者怎么拿到这些 skill）

| 渠道 | 命令 | 适用场景 |
|------|------|----------|
| **cc-switch** | 仓库根目录为扫描入口，同步启用 | 推荐 |
| **Codex** | `Use $skill-installer to install skill from <url>` | Codex 环境 |
| **手动** | `cp -r remote-<name> ~/.codex/skills/` | 调试单 skill |
| **Orca CLI** | ❌ `orca skills install` 装的是 Orca 自带 8 个 sub-skill，**不**装本仓库 | 不要混用 |

---

## 7. 发布前自检（硬约束）

```bash
# 切到本仓库根（路径按本机实际 checkout 填）
cd <本仓库根>
for d in remote-*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
  name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
  [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
  desc=$(awk -F'description: *' '/^description:/{print $2; exit}' "$d/SKILL.md")
  echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
done
```

| 检查项 | 期望 |
|--------|------|
| `MISSING <dir>/SKILL.md` | 0 命中 |
| `MISMATCH <dir> vs <name>` | 0 命中 |
| `BAD DESC <dir>` | 0 命中 |

**自检 0 命中才能合并到 master。** 详见 `remote-develop-skills-repo/recipes/release-checklist.md`。

---

## 8. 贡献流程（新加 / 修改 skill）

### 8.1 新加 skill

1. 创建目录：`mkdir remote-<domain>/`
2. 写 `SKILL.md`：按 §3 frontmatter + §4 三段式
3. 写 `references/`（按需）：按目标分档
4. 跑 §7 自检脚本，0 命中
5. 同步更新 `package.json` `pi.skills` 列表（按字母序插入新路径）
6. 同步更新根 `SKILL.md` 路由表（按任务类型插入新行）
7. 提交：`feat(skills): 新增 remote-<domain>` 或 `docs(skills): <改动>`
8. 推 master：触发 tag 发布

### 8.2 修改 skill

1. 改 `SKILL.md` / `references/`
2. 跑 §7 自检脚本
3. 同步更新引用该 skill 的其他 skill（如 `SKILL.md` 路由表 / `references/` 内引用）
4. 提交：`docs(skills): <skill> <改动一句话>` 或 `refactor(skills): ...`

### 8.3 弃用 skill

1. 整目录搬入 `deprecated/remote-<domain>/`（目录名保持原样）
2. `SKILL.md` 顶部加弃用说明 + 指向替代 skill
3. 从 `package.json` `pi.skills` 移除该路径
4. 从根 `SKILL.md` 路由表移除该行

### 8.4 孵化 skill

1. 整目录存入 `incubating/remote-<domain>/`
2. `SKILL.md` frontmatter 加 `status:` 字段（`draft` / `wip` / `review` / `ready`）
3. 不进 `package.json` `pi.skills` / 不进根 `SKILL.md` 路由表
4. 毕业后整目录挪到根 + 更新 package.json + 更新 SKILL.md 路由表

---

## 9. 根 SKILL.md 路由表维护

根 `SKILL.md` 是 Pi 加载后第一个读的路由器。新加 / 弃用 skill 时必须同步更新：

| 列 | 内容 |
|----|------|
| **任务描述** | 用正/负 token 描述（如 `mcp__idea__` / `orca` / `bi-cashier`）|
| **目标 sub-skill 路径** | `remote-*/SKILL.md` |

路由表更新口诀：**新加 sub-skill → 在「按任务匹配」表加一行 + 同步 `package.json` pi.skills**。

---

## 10. pi-extension 状态栏约定

`pi-extension/index.js` 暴露：

| 能力 | 状态 / 命令 |
|------|------------|
| 状态栏 | `○ 🛠 rds: <N> skills`（idle）/ `● 🛠 rds: router read` / `● 🛠 rds: <sub-skill>` |
| `/rds status` | 当前状态 |
| `/rds list` | 全部 skill 列表 |
| `/rds route <q>` | 关键词匹配路由 |
| `/rds show` / `hide` | 显式控制 |
| `/rds activate <s>` / `deactivate` | 标记激活 |

数据源：仓库根 `package.json` 的 `pi.skills`（与根 `SKILL.md` router 同源）。

---

## 11. 版本管理

- `package.json` `version` 字段：每次合并到 master 视情况 bump
- 现行 `1.0.2`（2026-10-09）：v1.0.0 起跑 / v1.0.1 加 `package.json` version / v1.0.2 删除 README + 加根 SKILL.md 路由 + 删除 3 个 longmemory skill
- 重大重构（删 skill / 改路由）必 bump minor（1.x.0）
- 单 skill 改动不强制 bump

---

## 12. 已知红线（任何 skill 改动禁止踩）

| # | 红线 | 出处 |
|---|------|------|
| 1 | **description 不以 `Use when ` 起手** | 自检脚本 |
| 2 | **目录名 ≠ name 字段** | 自检脚本 |
| 3 | **不写 `SKILL.md`** | 自检脚本 |
| 4 | **散落 "Read xxx first"** 而不用 `Use references/...` 索引 | §4 |
| 5 | **混用 `orca skills install` 与本仓库 skill** | §6 |
| 6 | **skill 放进 `docs/` / `.superpowers/`** | §1（cc-switch 不扫）|
| 7 | **在 SKILL.md 塞 legacy 兼容块**（`<!-- HOOK CONFIG START -->` 之类）| §4 |
| 8 | **为 `agents/` / `scripts/` / `assets/` 强建空文件** | §5 |
| 9 | **不跑 §7 自检脚本就合并** | §7 |
| 10 | **不更新 `package.json` `pi.skills` / 根 `SKILL.md` 路由表就新加 skill** | §8.1 / §9 |

---

## 13. 相关链接

- 仓库元 skill：[`remote-develop-skills-repo/SKILL.md`](remote-develop-skills-repo/SKILL.md)
- 发布前自检清单：[`remote-develop-skills-repo/recipes/release-checklist.md`](remote-develop-skills-repo/recipes/release-checklist.md)
- skill 共存边界：[`remote-develop-skills-repo/recipes/skill-coexistence.md`](remote-develop-skills-repo/recipes/skill-coexistence.md)
- 根路由：[`SKILL.md`](SKILL.md)
- Pi host 扩展：[`pi-extension/index.js`](pi-extension/index.js)