---
name: remote-orca-agent-communication
description: Use when 需要通过 Orca 向另一个 Claude、Pi 或其他 Agent terminal 发送消息，尤其是已保存的 handle 可能过期、需要用 ptyId/incarnationId/tabId/leafId/worktreeId 重新定位目标；发送前必须验证目标唯一、连接且可写。不要用于仅查看终端输出、创建 worktree 或无需跨 Agent 消息的本地代码任务。
---

# Remote Agent Communication

本 skill 约束 Agent 间的安全终端消息投递。核心原则：**先解析验证，后等待就绪，再发送**。绝不能把旧 `handle` 直接当成永久身份，也不能在目标不存在、匹配歧义或终端不可用时盲发。

Use `references/terminal-identifiers.md` when 需要理解 `handle`、`ptyId`、`incarnationId`、`tabId`、`leafId` 与 `worktreeId` 的生命周期和恢复优先级。
Use `references/resolution-protocol.md` when 需要查看 JSON 输出、退出码和失败后的用户告知方式。

## Required Workflow

1. **保存身份信息**：创建或发现目标 Agent 后，保存 `handle`、`ptyId`、`incarnationId`、`tabId`、`leafId`、`worktreeId`，以及存在时的 `agentIdentity`。至少应保存 `handle + ptyId + incarnationId + worktreeId`。
2. **解析和可用性验证**：先运行本 skill 的脚本；传入所有已知标识。脚本只会调用 `orca terminal list --json`，不会发送输入。
   ```bash
   node <skill-dir>/scripts/resolve-agent-terminal.mjs \
     --handle <old-handle> \
     --pty-id <pty-id> \
     --incarnation-id <incarnation-id> \
     --worktree-id <worktree-id>
   ```
3. **处理解析结果**：只有 JSON 同时满足 `ok: true` 和 `usable: true` 时才可继续。必须使用返回的 `terminal.handle`，而不是调用方原来的旧 handle。
4. **等待 TUI 进入可输入状态**：对返回的最新 handle 执行：
   ```bash
   orca terminal wait --terminal <resolved-handle> --for tui-idle --timeout-ms 120000 --json
   ```
   对慢启动或 prompt 状态不确定的 Agent，可额外调用项目的 `wait-agent-ready.mjs` 做 prompt/spinner 检查。
5. **只向已验证的 handle 发送**：
   ```bash
   orca terminal send --terminal <resolved-handle> --text "<message>" --enter --json
   ```
6. **失败即停止**：脚本非零退出、JSON 不是可用状态，或等待就绪失败时，绝不发送。直接告知用户目标 Agent 不存在、会话信息过期/错误、目标不唯一或当前不可用。

## Required Constraints

- 不得跳过 `resolve-agent-terminal.mjs` 而直接对缓存的 `handle` 调用 `orca terminal send`。
- 不得在 `terminal_not_found`、`ambiguous_terminal`、`terminal_orphaned`、`terminal_disconnected`、`terminal_read_only` 或 `orca_query_failed` 后尝试猜测 handle、扫描其他终端或继续发送。
- `ptyId` 是终端逻辑身份的首选恢复依据；`handle` 仅适合当前 Orca runtime 内的实时控制。
- 如果成功结果含 `warnings`，说明 `incarnationId`、`tabId` 或 `leafId` 已变化。目标可能重启或上下文丢失；发送内容应包含必要任务上下文。
- `tabId` 可能对应多个 pane。只给 `tabId` 并匹配到多个终端时，必须视为歧义；要求补充 `ptyId`、`leafId` 或 `worktreeId`。
- 不把 Orca 的 `ptyId` / `incarnationId` 当作 Claude、Pi 的模型原生对话恢复 ID；原生会话恢复仍应使用各 CLI/runtime 的机制。

## Response Shape

每次尝试跨 Agent 通信后，至少报告：

- 传入的目标标识及解析结果（`resolution`）；
- 实际用于发送的最新 `terminal.handle`，或未发送的明确原因；
- 是否发生 `ptyId` 恢复、实例重启告警或 TUI 就绪等待失败；
- 实际执行的 `orca terminal wait/send` 命令；
- 未验证内容，例如未确认目标 Agent 对消息的业务回复。

## Verification

```bash
node --test <skill-dir>/scripts/resolve-agent-terminal.test.mjs
```
