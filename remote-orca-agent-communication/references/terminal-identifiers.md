# Orca Terminal 标识与恢复范围

| 字段 | 生命周期 | 主要用途 |
|---|---|---|
| `handle` | 当前 Orca runtime 的实时控制标识 | `orca terminal read/send/wait` 的直接参数；可能失效 |
| `ptyId` | 逻辑终端 / PTY 会话 | handle 失效后重新发现同一 Agent 的首选依据 |
| `incarnationId` | 一次进程实例 / 重启代次 | 判断目标是否重启、上下文可能是否丢失 |
| `tabId` | Orca terminal 页签 | UI 页签定位；一个 tab 可包含多个 pane |
| `leafId` | 页签内特定 split pane | UI 中定位某个 pane，比 tabId 更精确 |
| `worktreeId` | 仓库 + worktree 隔离身份 | 防止把消息投递到同名但不同项目的 Agent |
| `agentIdentity` | Orca 已识别的 Agent 类型（可选） | 约束 Claude / Pi 等已标注类型；为空不表示终端一定不是 Agent |

## 选择和恢复规则

保存目标时优先记录：

```text
handle + ptyId + incarnationId + worktreeId
```

解析脚本按以下顺序尝试找回唯一的当前终端：

```text
ptyId → incarnationId → leafId → handle → tabId
```

`worktreeId` 和 `agentIdentity` 是所有匹配阶段的约束。`tabId` 单独命中多个 pane 时，结果必须是歧义而非任意选择。

## 生命周期边界

- **发送/读取/等待**：只使用此次解析结果中的 `handle`。
- **重建后找回**：使用 `ptyId`；若实例变更，`incarnationId` 会不同。
- **布局自动化**：使用 `tabId + leafId`。
- **防串项目**：始终附带 `worktreeId`。
- **模型原生恢复**：不使用这些 Orca 字段，改用 Claude/Pi 自己的 session/resume 机制。
