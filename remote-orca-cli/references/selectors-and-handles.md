# Selectors vs Handles

Orca 把"定位对象"的语法分成两类：selector（一次性查询，文本匹配）和 handle（操作句柄，重用稳定 ID）。混用会导致同名歧义（如 `cashier` 双 repo）或拿到过期对象（如 navigation 后的 element ref）。

## 概览

| 类型 | 用法 | 何时用 |
|---|---|---|
| **Selector** | `repo name:bi-cashier`、`worktree path:...`、`worktree active`、`worktree branch:X`、`worktree id:<uuid>`、`tab index:0` | 一次性查询、命令首次定位对象时 |
| **Handle** | `terminal <term-id>`、`tab <browser-page-id>` | 多次操作同一对象、跨命令引用 |

## Selector 语法

```
<key>:<value>
```

支持的 key（按 Orca 子命令不同而不同）：

| Key | 适用于 | 例 | 说明 |
|---|---|---|---|
| `name:<text>` | repo、worktree、terminal 等 | `repo name:bi-cashier` | 模糊匹配 name；**有歧义时换 `id:` 或 `path:`** |
| `id:<uuid>` | repo、worktree、terminal 等 | `worktree id:0ee28200-afe7-44d0-aa4b-98f8110fa87f` | 精确匹配，最稳 |
| `path:<path>` | repo、worktree | `worktree path:C:/Users/20614/orca/workspaces/bi-cashier/dev-chenyanjun-one-3` | 按绝对路径 |
| `branch:<branch>` | worktree | `worktree branch:dev-chenyanjun-one-3` | 按 git 分支 |
| `active` | worktree | `worktree active` | 当前 Orca 焦点 worktree |
| `current` | worktree、tab | `worktree current`、`tab current` | 当前会话所在 |
| `folder:<path>` / `worktree:<id>` | worktree create 的 `--parent-worktree` | `--parent-worktree folder:D:/OB/bi-FOB/bi-cashier` | 父 worktree 选择 |
| `issue:<id>` / `linear-issue:<id>` | worktree | `--linear-issue STA-335` | 按 Linear ticket 关联 |

## Handle 用法

handle 是 Orca 返回的稳定标识符。常见来源：

| 来源命令 | handle 字段（JSON 路径） | 用途 |
|---|---|---|
| `orca worktree create --json` | `result.agentTerminalHandle`（新）或 `result.startupTerminal.handle`（老） | 拉起 agent 后读终端 |
| `orca terminal create --json` | `result.terminalId` / `result.handle` | 在 worktree 内追加 agent |
| `orca tab list --json` | `tabs[].browserPageId` | 浏览器 tab 跨命令引用 |

handle 用法示例：

```bash
# 1. 建 worktree 拿到 agent handle
handle=$(orca worktree create --repo name:bi-cashier --name agent-task-1 \
  --agent codex --prompt "do X" --json | jq -r '.result.agentTerminalHandle')

# 2. 读这个终端
orca terminal read --terminal "$handle"

# 3. 等它退出
orca terminal wait --terminal "$handle" --for exit --timeout-ms 60000 --json
```

## 真实字段示例（本机 2026-08-22）

```
0ee28200-afe7-44d0-aa4b-98f8110fa87f::C:/Users/20614/orca/workspaces/bi-cashier/dev-chenyanjun-one-3  refs/heads/dev-chenyanjun-one-3  C:/Users/20614/orca/workspaces/bi-cashier/dev-chenyanjun-one-3
displayName: dev-chenyanjun-one-3
parentWorktreeId: null
childWorktreeIds: []
linkedIssue: null
comment:
```

`orca worktree current` 等价于 `orca worktree show --worktree active` 等价于 `orca worktree show --worktree current` 等价于 `orca worktree show --worktree path:C:/Users/20614/orca/workspaces/bi-cashier/dev-chenyanjun-one-3`——在本机四者都命中同一条。

## 同名歧义案例

- **`cashier` 双 repo**：`797c739d-05f6-4b93-a9c4-94624afa8036` → `D:/OB/ob_web/packages/micro/cashier`；`ccad9ddb-a51f-4bc5-82f6-defd4008aba9` → `D:/OB/cashier`。用 `name:cashier` 会随机命中。**必须用 `id:<uuid>` 或 `path:<path>`**。
- **多 worktree 同分支**：不同 repo 下可能有同名 `dev-chenyanjun-one`；`worktree branch:dev-chenyanjun-one` 会一次返回多条。**先用 `worktree list` 看清楚，再用 `id:` 精确定位**。

## 浏览器 element ref 是一次性 handle

`orca snapshot` 输出里 element 标为 `e1`、`e2`、`@e3` 之类的 ref 是 handle，但**页面变化即失效**（navigation、reload、DOM 重渲染都让它作废）。

正确流程：

```bash
orca snapshot                   # 拿 ref
orca click --element @e3        # 用 ref
# —— 若页面变化，必须重新 snapshot ——
orca snapshot                   # 重新拿 ref
orca click --element @e7        # 用新 ref
```

跨多 tab 协作：

```bash
page_id=$(orca tab list --json | jq -r '.tabs[0].browserPageId')
orca snapshot --page "$page_id"
orca click --page "$page_id" --element @e3
```

## 不要做的事

- 不要用 `name:` 选择器去拿有歧义的对象（同名 repo / 同分支 worktree）。
- 不要把 `orca snapshot` 的 ref 跨命令长期持有——只要页面 reload，ref 立即失效。
- 不要把 `terminal <handle>` 当成永久 ID——terminal close 后 handle 会失效；新会话需重新 `terminal create`。
- 不要在 `--parent-worktree` 用 `active` 之外的高歧义 selector——它会影响新建 worktree 的父链。