# 与其它 skill / sub-skill 的边界

`remote-orca-skill-repo` 不应与以下三类能力重叠：

1. **Orca CLI 自带的 8 个 sub-skill**（`orca skills list` 输出）。
2. **`remote-claude-hooks`** —— 同仓库的 hooks 配置规范 skill。
3. **`remote-orca-cli`** —— 本仓库新加的 Orca CLI 消费 skill（互为姊妹）。

## 1. 与 Orca CLI 自带 8 个 sub-skill 的边界

来源：`orca skills list`（2026-08-22 抓取）。

| Orca 自带 sub-skill | 一句话 | 与本 skill 的边界 |
|---|---|---|
| `orca-cli` | Orca CLI 总入口（worktree / terminal / repo / browser 内嵌 / artifact） | 互不重叠——`orca-cli` 是**消费** `orca` 命令；本 skill 是**运营**本仓库的 skill 仓库 |
| `orchestration` | 多 agent 编排（线程消息 / ask-reply / DAG / 决策门） | 互不重叠 |
| `orca-linear` | Linear 工单读写 | 互不重叠 |
| `linear-tickets` | `orca-linear` 的 legacy alias | 互不重叠（不是新任务入口） |
| `computer-use` | 桌面 app a11y 操作 | 互不重叠 |
| `orca-emulator` / `orca-emulator-android` | iOS / Android 模拟器 | 互不重叠 |
| `orca-per-workspace-env` | per-workspace 沙箱 / VM 配方 | 互不重叠 |

**关键边界**：

- **不要**在 `remote-orca-skill-repo` 里复述 Orca 自带 sub-skill 的命令细节；只引用 `remote-orca-cli` 与 `references/sub-skills.md` 即可。
- **不要**用 `orca skills install` / `update` / `share` 来安装本仓库 `remote-*` skill——它们只装 Orca 自带 sub-skill。
- **不要**给本仓库 skill 起名撞 Orca 自带 sub-skill 的前缀（如 `linear-*`）；它们触发词相同会重复加载。

## 2. 与 `remote-claude-hooks` 的边界

`remote-claude-hooks` 已经在仓库里，约束 Claude Code hooks 的生命周期选择与配置样式。

| 维度 | `remote-claude-hooks` | `remote-orca-skill-repo` |
|---|---|---|
| 对象 | Claude Code 生命周期事件（SessionStart / UserPromptSubmit / PreToolUse / ...） | `remote-develop-skills` 仓库的 `remote-*/` skill 运营 |
| 决定什么 | 自动化任务该用 Skill 还是 Hook | 新增 skill 怎么写、怎么同步 |
| 配置位置 | `.claude/settings.json` / `settings.local.json` | `SKILL.md` + `references/` + `recipes/` |
| 关键判定 | "必须每次都拦 / 注入" → hook；"按需" → skill | "新 skill 是否通过 frontmatter 自检" |

**协作关系**：

- hooks 在 `.claude/settings.local.json` / `settings.json` 里配置；本 skill 不动这些文件。
- 如果一个新 skill 同时适合做成 hook（如 `remote-ts-es-check`），按 `remote-claude-hooks` 的判定规则选择形态——本 skill 只负责 skill 形态的实现。
- **`remote-claude-hooks` 的 SKILL.md 末尾有一段 `<!-- HOOK CONFIG START ... -->` legacy 兼容块**——本 skill 不沿用此模式，遗留字段放 `recipes/` 或 changelog。

## 3. 与 `remote-orca-cli` 的边界（互为姊妹）

| 维度 | `remote-orca-cli` | `remote-orca-skill-repo` |
|---|---|---|
| 角色 | 消费者：在 Orca 环境里调 `orca` 命令 | 运营者：维护本仓库 `remote-*` skill |
| 何时触发 | "跑 orca 命令开 worktree" "查 orca 内置 sub-skill 怎么选" | "新增 / 修改 / 发布一个 remote-* skill" |
| 关键约束 | `orca status` 先确认 runtime；selector vs handle；不要绕过 `orca` 操作 git worktree | `name == 父目录名`；`description` 以 `Use when` 起手；同步路径不能混用 `orca skills install` |
| 是否依赖对方 | 否（独立消费） | 否（独立运营） |

**互引但不互相覆盖**：

- `remote-orca-skill-repo` 的「同步路径」节会引用 `remote-orca-cli` 的 `references/commands.md`（解释 `orca skills install` 装的是什么）。
- `remote-orca-cli` 的「不要做的事」节会引用 `remote-orca-skill-repo`（解释本仓库 skill 怎么启用）。
- 两个 skill 都不复述对方的细节。

## 4. 与业务侧 8 个 `remote-*` skill 的边界

`remote-cashier-java-standard` / `remote-button-permission` / `remote-permission-summary` / `remote-list-page-directory` / `remote-flowable-task-with-next` / `remote-ts-es-check` / `remote-idea-mcp-usage` / `remote-claude-hooks` 都是**业务或工具链规范**；本 skill 不复述它们的内容，只复述它们的 frontmatter 风格作为新 skill 范本。

| 范本 skill | 可借鉴的写法 |
|---|---|
| `remote-cashier-java-standard` | 中文长 description + 末尾 `；不要用于其他 BI/OBO 模块` 反向边界 + 多 references 拆主题 |
| `remote-button-permission` | 中文并列触发场景 + `确保全模块…一致` 收尾 |
| `remote-idea-mcp-usage` | 中文 + 权限矩阵 + 执行流程 + 快速检查四段式 |
| `remote-claude-hooks` | 「先规则-再表-再 Common Mistakes」结构（仅结构，不沿用 legacy 兼容块） |

## 不要做的事

- 不要把 Orca 自带 sub-skill 的命令细节写到本仓库 skill 里——consumer 用 `remote-orca-cli` / `references/sub-skills.md`。
- 不要把 hooks 配置样例塞进本仓库 skill——`remote-claude-hooks` 已覆盖。
- 不要复述业务 skill（如按钮权限）的具体规则——本 skill 只约束「怎么写 skill」，不约束「业务怎么做」。
- 不要在 frontmatter `description` 里写 Orca CLI 命令细节——description 只描述"何时触发"，具体命令细节放 SKILL.md 正文或 references。