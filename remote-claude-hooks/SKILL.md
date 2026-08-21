---
name: remote-claude-hooks
description: Use when 判断某个自动化任务该用 Skill 还是 Hook、选择哪个生命周期事件（SessionStart/UserPromptSubmit/PreToolUse/Stop 等）、排查 hook 不生效或误拦截、向新人解释 hook 生命周期。
---

# Claude Code Hooks 使用说明

hooks 是挂在 Claude Code 生命周期特定时点的自动命令（shell / HTTP / LLM），**无需人为调用**；Skill 是手动按需加载的指令文档。两者解决不同问题，先分清再用。

## 先判断：用 Skill 还是 Hook

```
自动化逻辑是"何时跑"？
├─ 需要时才用、由场景触发 → Skill（SKILL.md，按 description 匹配加载）
└─ 每次到某节点自动跑 → Hook（挂到生命周期事件）
```

| 特征 | Skill | Hook |
|---|---|---|
| 触发方式 | 手动 / 场景匹配 | 生命周期自动触发 |
| 适合 | 操作步骤、规范、知识参考 | 检查、注入上下文、拦截、日志 |
| 生效范围 | 被加载时才占用上下文 | 每次事件都跑，注意开销 |
| 示例 | `$basics-ts-es-check-vue` | codegraph 的 `UserPromptSubmit` |

**同一个逻辑两种形态都有**：如"提交前扫描 TS&ESLint"既可做成手动 skill（`$basics-ts-es-check-vue`），也可做成 PreToolUse/Stop hook 自动跑。优先做 Skill（按需、省上下文）；只有"必须每次都拦/每次都注入"才升级成 Hook。

## 9 大生命周期事件速查

| 事件 | 触发时机 | 可阻断 | 支持 matcher |
|---|---|---|---|
| `SessionStart` | 会话启动/恢复/compact/clear | ✗（stdout 注入上下文） | ✅ `startup\|resume\|clear\|compact` |
| `UserPromptSubmit` | 用户提交 prompt 后、处理前 | ✅ exit 2 拒绝该 prompt | ✗ |
| `PreToolUse` | 工具执行前（参数已生成） | ✅ exit 2 阻止、可改参数 | ✅ 按工具名 |
| `PostToolUse` | 工具成功完成后 | ✗（`decision:"block"` 反馈） | ✅ 按工具名 |
| `Notification` | 权限请求/闲置/认证成功等 | ✗ | ✅ 按通知类型 |
| `Stop` | 主 agent 回复完（手动打断跳过） | ✅ 可强制继续 | ✗ |
| `PreCompact` | 上下文压缩前 | ✗ | ✅ `manual` / `auto` |
| `SubagentStop` | Task 子代理完成 | ✅ 可强制继续 | ✅ 按 agent 类型 |
| `SessionEnd` | 会话终止 | ✗（仅清理/日志） | ✗ |

## 放到哪个阶段：按任务类型选

| 任务类型 | 推荐事件 | 为什么 |
|---|---|---|
| 每次提问注入最新上下文（项目规范、codegraph、记忆检索） | `UserPromptSubmit` | 每次提问都带，信息最新 |
| 会话开始的一次性状态说明 / 常驻规则 | `SessionStart` | 只跑一次，matcher 可区分首次/恢复 |
| 危险操作拦截（改记忆文件、`rm -rf`、force push） | `PreToolUse` | 执行前可阻断、可改参数 |
| 工具执行后的校验/记录（跑测试、检查输出） | `PostToolUse` | 能拿到结果再判断 |
| 权限弹窗时的提示 | `Notification` | 只在权限场景触发，精准 |
| 回复前的质量门（强制 review、TS&ESLint 扫描） | `Stop` | 主回复完成时收口 |
| 压缩前的摘要/状态保存 | `PreCompact` | 避免上下文压缩丢状态 |
| 子代理结果校验 | `SubagentStop` | Task 完成后单独把关 |
| 会话结束清理 / 打日志 | `SessionEnd` | 收尾、不影响本次会话 |
| 一次性安装依赖 / 初始化 | `Setup` | init/maintenance 时跑一次 |

## 各阶段优缺点

### 常用且推荐
- **`UserPromptSubmit`**：✅ 每次提问数据最新、可用 exit 2 拒掉无关 prompt；❌ 每次提问都跑、耗时叠加，无 matcher 无法挑 prompt，脚本必须快（本项目 codegraph 设为 120s 超时）。
- **`PreToolUse`**：✅ 执行前拦截最安全，matcher 按工具名精准（`Write`、`Bash(git push:*)`）；❌ 每个工具调用都触发，性能敏感，误 exit 2 会卡死正常流程，脚本要写得稳。
- **`PostToolUse`**：✅ 拿到结果做校验/记日志；❌ 无法阻断（已执行），错误分支要自己处理。

### 低频但特定
- **`SessionStart`**：✅ 只跑一次、开销小；❌ stdout 会注入上下文，别输出长内容；不阻塞。
- **`Stop`**：✅ 回复完成时收口做质量门；❌ 用户按 Esc 手动打断会**跳过** Stop，质量门失效；长会话每次都跑。
- **`PreCompact`**：✅ 压缩前保状态；❌ 只覆盖 compact 场景。
- **`Notification`**：✅ 场景精准；❌ 用途窄。
- **`SessionEnd`**：✅ 收尾日志；❌ 非正常退出（崩溃）可能不触发，不能依赖它做重要清理。
- **`SubagentStop`**：✅ 子代理独立把关；❌ 只对 Task 子代理生效。

## Quick Reference

- **退出码**：`0` 成功；`2` 阻断（stderr 反馈给 Claude）；其他 = 非阻断错误。
- **matcher 写法**：精确 `Write`；正则 `Edit|Write`、`Web.*`；全匹配 `*` 或省略；MCP `mcp__server__tool`；命令 `Bash(git commit:*)`。
- **配置作用域（优先级高→低）**：`Managed` > `命令行参数` > `Local(.claude/settings.local.json)` > `Project(.claude/settings.json)` > `User(~/.claude/settings.json)`。
- **结构**：`hooks.事件[{ matcher, hooks:[{ type, command, timeout }] }]`。

详细事件规范、配置样例、本项目已生效 hooks 实例 → 见 `references/hook-events.md`。

## Common Mistakes

- **把 Skill 误当 Hook**：Skill 不会自动跑，以为配置了就会触发 → 检查是否挂到了某事件。
- **无 matcher 的全局 hook 卡流程**：`PreToolUse` 配了 `matcher: "*"` 且 exit 2，所有工具全被拦 → matcher 精确到工具/命令。
- **exit 2 误用**：exit 2 是"阻断"，PostToolUse/SessionEnd 用了也不会有阻断效果（它们不支持）。
- **长脚本挂 `UserPromptSubmit`**：每次提问都阻塞几十秒 → 改到 SessionStart 或精简脚本。
- **SessionStart stdout 注入污染上下文**：hook 的 stdout 会进入上下文，别 print 无关内容。
- **改了配置不生效**：hook 配置在 settings.json，改完要重启会话；作用域优先级 Local > Project，项目级被 local 覆盖时以为没生效。
