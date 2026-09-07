# Target Resolution Protocol

脚本位置：`scripts/resolve-agent-terminal.mjs`

```bash
node <skill-dir>/scripts/resolve-agent-terminal.mjs \
  --handle term_old \
  --pty-id 'repo-id::C:/project@@agent' \
  --incarnation-id old-incarnation \
  --worktree-id 'repo-id::C:/project'
```

脚本始终向 stdout 输出 JSON，且不发送任何终端输入。

## 成功

```json
{
  "ok": true,
  "usable": true,
  "resolution": "recovered-by-pty-id",
  "recovered": true,
  "terminal": {
    "handle": "term_new",
    "ptyId": "repo-id::C:/project@@agent",
    "connected": true,
    "writable": true,
    "orphaned": false
  },
  "warnings": [],
  "sendTarget": { "terminalHandle": "term_new" }
}
```

调用方只可使用 `terminal.handle` 或 `sendTarget.terminalHandle` 继续执行 `orca terminal wait/send`。

## 失败

| 退出码 | 错误码 | 含义和动作 |
|---:|---|---|
| `2` | `terminal_not_found` | 目标不存在、已关闭，或会话标识属于其他 runtime/worktree；停止发送 |
| `3` | `ambiguous_terminal` | 标识不足，匹配多个目标；要求用户补充 `ptyId`、`leafId` 或 `worktreeId` |
| `4` | `terminal_orphaned` / `terminal_disconnected` / `terminal_read_only` | 已匹配但无法接收消息；停止发送 |
| `64` | `missing_selector` / `orca_query_failed` | 参数不完整或 Orca 查询失败；停止发送并检查输入/Orca runtime |

错误输出也包含 `supplied`，歧义时额外包含 `candidates`。调用方不得把候选列表中的任意 handle 当作默认目标。
