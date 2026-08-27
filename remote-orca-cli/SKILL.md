---
name: remote-orca-cli
description: Use when 在 Orca 运行环境中执行 orca 命令、起停 worktree / terminal、调用 Orca 内置浏览器、抓已登记 repo 与自动化、在 8 个内置 sub-skill (computer-use / orca-cli / orca-linear / orchestration / orca-emulator / orca-emulator-android / orca-per-workspace-env) 之间选型；不要用于 Orca 桌面 app UI、移动端模拟器、Linear 工单阅读——这些分别由内置 sub-skill 自己负责。
---

# Orca CLI 使用规范

本 skill 约束如何调用 `orca` CLI。Orca 自身提供的 8 个内置 sub-skill（`orca-cli` / `orchestration` / `orca-linear` / `computer-use` / `orca-emulator*` / `orca-per-workspace-env` / `linear-tickets`）的边界在 `references/sub-skills.md`，本 skill 不重复它们的内部规则。

Use `references/commands.md` when 需要查 18 类命令分组下的具体子命令与高频示例。
Use `references/selectors-and-handles.md` when 需要在 worktree / repo / tab 之间用 selector 还是 handle 定位对象。
Use `references/sub-skills.md` when 需要在 8 个内置 sub-skill 中选型。

## Workflow

1. **确认 runtime 就绪**：先 `orca status` 看 app/runtime/graph 状态；未起来就跑 `orca open`（等 runtime 可达）或 `orca serve`（无窗口启动）。远程配对走 `orca environment add <pairing-code>` 或环境变量 `ORCA_PAIRING_CODE` / `ORCA_ENVIRONMENT`。
2. **无 runtime 也要能查**：要拿权威命令 schema，**只读**跑 `orca agent-context --json`，它"works without a running Orca app, so it is safe over SSH and in headless contexts"。
3. **定位对象**：一次性查询用 selector（`repo name:xxx`、`worktree path:...`、`worktree active`），多次操作转 handle（`terminal <id>`、`tab <pageId>`）。注意同名的 `cashier` repo 在本机有 2 个 UUID（`D:/OB/ob_web/packages/micro/cashier` 与 `D:/OB/cashier`），必须用 `id:<uuid>` 或 `path:<path>` 消歧。
4. **执行操作**：按任务在 18 类里挑——建/拉 worktree → `orca worktree create --name X --agent codex --prompt "..."`；在已有 worktree 内追加 agent → `orca terminal create --worktree active --command codex`；读终端输出 → `orca terminal read` 或 `orca terminal wait --for exit`；内嵌浏览器 → 先 `orca tab create`，再使用顶层 `orca goto / snapshot / click / fill / wait / screenshot`（完整参数见 `references/commands.md`）。
5. **跨 agent 协调**：用户说"给另一个 agent"或"全部交出去" → `orca-cli` 风格的 `worktree create --agent` 或 `terminal create --command`；用户明确要"监督 / 等待 / DAG / 决策门" → `orchestration`（见 `references/sub-skills.md`）。
6. **完事报告**：调用结束时回报「实际跑过的命令 + 验证结果 + 未验证内容」；不要把 `agent-context` / `repo list` 这类只读查询当操作报。

## Required Constraints

- **先 `orca status` 再干活**：命令形参已生成但 runtime 未就绪会直接报错；status 输出含 `app` / `runtime` / `graph` 三个布尔位，必须三者均 ready。
- **不要绕过 `orca` 直接操作 `.git/worktrees/`**：Orca 维护自己的 worktree 元数据（UUID / displayName / parentWorktreeId），手改 git worktree 后 Orca 视图会失同步。
- **浏览器 refs 用完即弃**：每次 navigation、reload 或导致 DOM 重渲染的点击后，element ref（如 `@e3`）会失效，必须重新 `orca snapshot` 再 click/fill/select。跨多 tab 协作时用 `tab list --json` 拿 `browserPageId`，后续命令传 `--page <id>` 复用页面。
- **浏览器命令以 schema 为准**：当前 CLI 使用 `orca tab create/list/show/current/switch/close` 管理 Tab，使用顶层 `orca goto/snapshot/click/fill/type/select/hover/keypress/scroll/wait/screenshot/full-screenshot/eval/dialog` 操作页面；版本差异先查 `orca agent-context --json`。
- **agent handle 来源**：用 `orca worktree create --agent --json` 时，新 agent handle 在 `result.agentTerminalHandle`；老 runtime 只返 `result.startupTerminal.handle`；folder-based repo 可能两者都不返——按 runtime 版本取对应字段。
- **selector vs handle**：selector 用于一次性查询（name / path / active / branch / id:），handle 用于重复操作（terminal id、tab pageId）。混用会导致 selector 误命中同名对象（如 `cashier` 双 repo）。
- **远程运行时走环境变量**：CI 或 SSH 场景不要交互 `orca environment add`，用 `ORCA_PAIRING_CODE=...` 或 `ORCA_ENVIRONMENT=<id-or-name>` 让命令自动连。
- **不要手动装 Orca 内置 skill**：`orca skills install` / `orca skills update` 装的是 Orca **自带**的 8 个 sub-skill，**不是本仓库**的 remote-*；本仓库 skill 的启用走 cc-switch / Codex installer / 手动复制（见 `remote-orca-skill-repo`）。

## Response Shape

每次调用 `orca` 后回报：

- 实际跑过的命令（含 `--json` 与否）。
- 关键返回字段（如 worktree UUID、agent terminal handle、tab pageId），便于后续步骤继续用 handle。
- runtime / 验证结果（如 `orca status` 输出、`orca worktree show --worktree active` 的 parent 是否符合预期）。
- 未验证的内容（如远程 environment 配对本机无法复现，仅静态参考）。

涉及 sub-skill 选型时，说明选了哪一个、为什么没选另一个（如"用 `orca-cli` 的 `terminal create` 而非 `orchestration` 的 `dispatch`，因为用户没要求 DAG 监督"）。