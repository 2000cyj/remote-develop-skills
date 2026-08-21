# Hook 事件完整规范

本文件是 `remote-claude-hooks` skill 的深度参考：每个事件的全字段、matcher 语法、退出码语义、配置作用域与 JSON 样例，以及本项目（cashier / ob_web 仓库）当前已生效的 hooks 实例。

## 1. 事件 → 触发时机

| 事件 | 触发时机 | 阻断能力 | 支持 matcher |
|---|---|---|---|
| `Setup` | 会话初始化（init/maintenance） | ✗ | ✅ `init\|maintenance` |
| `SessionStart` | 会话启动 / 恢复 / compact / clear | ✗（stdout 注入上下文） | ✅ `startup\|resume\|clear\|compact` |
| `UserPromptSubmit` | 用户提交 prompt 后、Claude 处理前 | ✅ exit 2 拒绝该 prompt | ✗ |
| `PreToolUse` | 工具即将执行前（参数已生成） | ✅ exit 2 阻止、可 `updatedInput` 改参 | ✅ 按工具名 |
| `PostToolUse` | 工具成功完成后 | ✗（`decision:"block"` 反馈给 Claude） | ✅ 按工具名 |
| `Notification` | Claude Code 发出通知 | ✗ | ✅ 按通知类型（`permission_prompt`、`idle_prompt`、`auth_success`、`elicitation_dialog`） |
| `Stop` | 主 agent 回复完成（用户手动打断则跳过） | ✅ 可强制继续 | ✗ |
| `PreCompact` | 上下文压缩之前 | ✗ | ✅ `manual`（/compact）/ `auto`（自动） |
| `SubagentStop` | Task 子代理完成 | ✅ 可强制继续 | ✅ 按 agent 类型 |
| `SessionEnd` | 会话终止 | ✗（仅清理/日志） | ✗ |

> 版本说明：新版本还新增了 `PostToolUseFailure`、`PermissionRequest`、`SubagentStart`、`TeammateIdle`、`TaskCompleted`、`ConfigChange`、`WorktreeCreate`、`WorktreeRemove` 等，不同版本存在差异，以官方文档为准（code.claude.com/docs/en/hooks）。

## 2. Matcher 语法

大小写敏感。

| 写法 | 匹配 |
|---|---|
| `Write` | 精确工具名 |
| `^Write$` | 仅 Write 工具（精确限定符） |
| `Edit|Write` | 正则 OR |
| `Web.*` | 正则前缀 |
| `*` 或空串 `""` 或省略 matcher | 全部 |
| `mcp__server__tool` | 指定 MCP 工具 |
| `mcp__server__*` | 某 MCP server 全部工具 |
| `Bash(git commit:*)` | Bash 命令前缀 |
| `Bash(npm run:*)` | Bash 命令前缀 |

## 3. 退出码语义

| 退出码 | 含义 |
|---|---|
| `0` | 成功。stdout 按需解析 JSON（如 `updatedInput`、`decision`） |
| `2` | 阻断。stderr 内容反馈给 Claude |
| 其他 | 非阻断错误 |

`timeout` 超时默认 60s；可显式配置，如 codegraph 的 `UserPromptSubmit` 设 120s。

## 4. 配置作用域与优先级

| 作用域 | 文件 | 是否随 git 共享 |
|---|---|---|
| Managed（企业托管） | `managed-settings.json` | 是（IT 下发，优先级最高） |
| User | `~/.claude/settings.json` | 否 |
| Project | `<repo>/.claude/settings.json` | 是 |
| Local | `<repo>/.claude/settings.local.json` | 否（自动 gitignore） |

优先级（高→低）：**Managed > 命令行参数 > Local > Project > User**。数组型设置（`permissions.allow`）跨作用域**合并去重**；权限 deny 任何层级都不能被下级覆盖。

## 5. 配置 JSON 样例

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "codegraph prompt-hook", "timeout": 120 }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/block_memory_write.sh" }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          { "type": "command", "command": "sh \"${CLAUDE_PLUGIN_ROOT}/hooks/always-on.sh\"", "timeout": 5 }
        ]
      }
    ]
  }
}
```

## 6. 本项目（cashier / ob_web）已生效 hooks 实例

cashier 项目自身**没有** Claude Code hooks（`cashier/.claude/` 不存在）；生效的都来自用户级 + 启用的插件：

| 来源 | 事件 | 命令 | 作用 |
|---|---|---|---|
| 用户级 settings | `UserPromptSubmit` | `codegraph prompt-hook`（120s） | 每次提问注入 CodeGraph 代码图谱上下文 |
| superpowers 插件 | `SessionStart` | `run-hook session-start` | 加载 superpowers 技能上下文 |
| i-have-adhd 插件 | `SessionStart` | `always-on.sh` | ADHD 输出模式常驻 |
| mem0 插件 | `Setup` / `SessionStart` | `ensure_deps.sh`、`on_session_start.sh` | 安装 SDK、加载记忆上下文 |
| mem0 插件 | `UserPromptSubmit` | `on_user_prompt.sh` | 每次提问检查记忆相关性 |
| mem0 插件 | `PreToolUse` | `block_memory_write.sh`（Write/Edit）、`enforce_metadata_defaults.sh`（mem0 工具）、`on_file_read.sh`（Read） | 拦直接改记忆文件 / 强制 user_id+app_id / 记录读文件 |
| mem0 插件 | `PostToolUse` | `on_post_tool_use.sh`、`on_bash_output.sh` | mem0 工具后处理、捕获 Bash 输出 |
| mem0 插件 | `Stop` / `PreCompact` | `on_stop.sh`、`on_pre_compact.sh` | 结束整理、压缩前摘要 |
| codex 插件 | `SessionStart` / `SessionEnd` | `session-lifecycle-hook.mjs` | 记录会话生命周期 |
| codex 插件 | `Stop` | `stop-review-gate-hook.mjs`（900s） | 停止时 review 检查门 |

> ⚠️ 若 mem0 提示 "SDK installation failed"，其记忆存取部分功能可能未生效，属插件环境问题，与配置无关。
