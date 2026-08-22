# Orca CLI 18 类命令速查

> Orca 小版本会增/改子命令。要拿权威 schema，运行时跑：
>
> ```bash
> orca agent-context --json
> ```
>
> 输出含 `schemaVersion`、`commandCount`、每条命令的 `path / flags / examples / notes`。本地缓存本文件时在文件头注释 `orca <version>` 与日期。

来源：`orca --help` 顶层分类（2026-08-22 抓取），共 **18 类 / 231 个子命令**（`commandCount: 231`，`schemaVersion: 1`）。

## 18 类分组

| # | 分类 | 一行说明 | 高频子命令 |
|---|---|---|---|
| 1 | Startup | 启 Orca 桌面端或 headless server | `open`、`serve`、`status` |
| 2 | Diagnostics | 抓 runtime 快照 | `diagnostics memory` |
| 3 | Agent Discovery | 机器可读命令 schema（agent 用） | `agent-context` |
| 4 | Accounts | 托管 Claude / Codex 账号 | `account add`、`account list` |
| 5 | Skills | 安装/分发 Orca **自带** skill | `skills list`、`skills installed`、`skills get`、`skills install`、`skills update`、`skills share` |
| 6 | Environments | 已配对的远程 runtime | `environment add`、`list`、`show`、`rm` |
| 7 | Environment Recipes | per-workspace 沙箱/VM 校验 | `vm recipe doctor` |
| 8 | Automations | 计划任务 | `automations list/show/create/edit/remove/run/runs` |
| 9 | Projects | 跨 host 的 project host setup | `project list/setups/setup-*` |
| 10 | Repos | 已登记的 git repo | `repo list/add/show/set-base-ref/search-refs` |
| 11 | Worktrees | Orca 维护的 worktree | `worktree list/show/current/create/set/rm/ps` |
| 12 | Files | 在 Orca 编辑器中打开文件 | `file open`、`file diff`、`file open-changed` |
| 13 | Terminals | 受 Orca 管理的终端会话 | `terminal list/show/read/send/wait/stop/create/rename/split/switch/focus/close` |
| 14 | Orchestration | 多 agent 编排（线程消息 / ask-reply / DAG / 决策门） | `orchestration run-create/run-use/send/check/ask/reply/dispatch/worker-*/gate-*/coordinator-*/reset` |
| 15 | Computer Use | 通过 a11y tree 操作桌面 app | `computer capabilities/permissions/list-apps/list-windows/get-app-state/click/scroll/drag/type-text/press-key/hotkey/...` |
| 16 | Linear | Linear 工单读写 | `linear ...` |
| 17 | Mobile Emulator (iOS Simulator) | iOS 模拟器 | `emulator list/attach/tap/type/gesture/button/rotate/exec/kill` |
| 18 | Browser Automation | Orca 内嵌浏览器 | `tab create/list/show/current/profile/switch/close/snapshot/goto/click/fill/type/select/hover/keypress/scroll/back/reload/screenshot/eval/wait/...` |

> 注意：`orca --help` 把 `Computer Use` / `Linear` / `Mobile Emulator` / `Browser Automation` 列成顶层分类，但 `agent-context --json` 把这些命令展开成了顶层 path（如 `computer`、`linear`、`emulator`、`tab`、`click`）。`agent-context --json` 的 `commandCount: 231` 是去重后的权威数字。

## 8 个高频子命令最小示例

```bash
# 1. 启动 / 看状态
orca open                                  # 启 Orca 桌面端并等 runtime 可达
orca status --json                         # 看 app/runtime/graph 就绪状态
orca serve --project-root <path>           # 无窗口起 runtime

# 2. 拿权威 schema（agent 用）
orca agent-context --json                  # 永远可跑，无需 runtime

# 3. 建 worktree 并直接拉 agent
orca worktree create \
  --repo name:bi-cashier \
  --name agent-task-1 \
  --agent codex \
  --prompt "开始实现 X 工单"

# 4. 在已有 worktree 追加新 agent（更轻量）
orca terminal create \
  --worktree active \
  --command codex

# 5. 读 / 等终端
orca terminal read --terminal term_123
orca terminal wait --terminal term_123 --for exit --timeout-ms 60000 --json

# 6. 列已登记 repo / worktree
orca repo list
orca worktree list --worktree active

# 7. 跨 agent 发消息
orca orchestration send --run <run-id> --to <recipient> --text "hi"

# 8. 内嵌浏览器四步走
orca tab create --url https://example.com
orca snapshot                                # 拿 element ref（@e1, @e2...）
orca click --element @e3
orca fill --element @e5 --value "search query"
```

## 通用 flag（很多子命令都有）

- `--json` — 机器可读输出（agent 首选）。
- `--help` — 子命令帮助。
- `--pairing-code <code>` / `--environment <selector>` — 远程 runtime 入口；也可用环境变量 `ORCA_PAIRING_CODE` / `ORCA_ENVIRONMENT`。
- `--page <id>` — 浏览器 tab 复用（`tab list --json` 拿 `browserPageId`）。

## 已登记的 repo / worktree（2026-08-22 抓取）

- **已登记 repo**：28 条，含 `bi-FOB/bi-{basics,basics-data,cashier,core,file,flowables,gateway,invoke,kingdee,logistics,message,monitor,openapi,pack,personnel,plan,product-factory,reorder,reorder-system,skill,sql,system}`、`ob_web` 三包（main / cashier / share）、独立 `cashier`、`remote-develop-skills` 自身（UUID `dad07f73-9067-453a-a903-e6ee42db434c`）。
- **同名歧义**：名为 `cashier` 的有 2 个 repo（`797c739d-...` micro-app vs `ccad9ddb-...` 独立 cashier），必须用 `id:<uuid>` 或 `path:<path>` 消歧。
- **当前 worktree**：本会话所在
  `0ee28200-afe7-44d0-aa4b-98f8110fa87f::C:/Users/20614/orca/workspaces/bi-cashier/dev-chenyanjun-one-3`，displayName `dev-chenyanjun-one-3`，父 `bi-cashier` 的 `dev-chenyanjun-one`。

## 不要做的事

- 不要把 `orca skills install` 当作本仓库 `remote-*` 的安装入口——它装的是 Orca 自带 skill，不是本仓库。
- 不要绕过 `orca` 命令直接 `git worktree add`——Orca 元数据会失同步。
- 不要在 SSH/无 runtime 时跑 `worktree create` / `terminal create`——只有 `agent-context` / `--help` 在无 runtime 下安全。