# hook-overlap

本 Skill 与其他 skill / hook 在写权限上的边界：

| Skill / Hook | 关注点 | 与本 Skill 的边界 |
|---|---|---|
| `remote-idea-mcp-usage` | IDEA MCP 调用、最小范围构建验证 | 不管写权限，但要求所有写操作前先确认目标在允许根内 |
| `remote-commit-git` | Git 分批提交、commit 消息规范 | 不管写权限，但提交涉及的工作树修改应已在 `roots` 中 |
| `remote-orca-cli` | orca CLI 调用、worktree 管理 | 不管写权限；本 Skill 覆盖 orca CLI 内部脚本的写盘行为 |
| `write-allowlist` hook | 底层拦截 write/edit/apply_patch/bash/mcp 等写工具 | 是本 Skill 的执行层；两者数据源（allowlist）必须一致 |

## 边界判定

- 调用 `mcp__idea__execute_tool` 时：
  - Skill 层：根据目标路径是否在 `roots` 内决定是否发起；
  - Hook 层：拦截 IDEA MCP 内层的 `apply_patch` / `create_new_file` / `execute_terminal_command`，按同一份 allowlist 拒绝或放行；
  - IDEA MCP 自身的 `dev` 库 / 代理范围规则由 `remote-idea-mcp-usage` 单独约束。

- 通过 `bash` / `powershell` 写文件时：
  - Skill 层：禁止“换 shell 命令重试”绕过；
  - Hook 层：识别 `python -c` / `node -e` / heredoc / 重定向 / `tee` / `sed -i` / `Out-File` 等写盘命令，按同一份 allowlist 拒绝或放行。

- 通过 `commit-git` 提交时：
  - Skill 层：必须先确认每个被提交的文件来自 `roots`；
  - Hook 层：不参与 commit，但提交后落在 `roots` 之外的差异不会被允许再写。

## 触发顺序

1. Agent 决定要写文件 → 加载本 Skill；
2. 读取 `<cwd>/.pi/write-allowlist.json` 判定目标路径；
3. 调用写工具（`write` / `edit` / `apply_patch` / `bash` / `mcp__idea__execute_tool`）；
4. hook 同步判定并执行拦截；
5. 如被拒绝，按本 Skill 的修正路径请求用户授权或调整 `workgroup.yaml`。

## 失效处理

- hook 未挂载：所有写工具都不受底层拦截；本 Skill 要求 Agent 仍按相同规则手动验证，且必须在响应中明示“hook 未挂载”。
- allowlist 不存在：本 Skill 要求写操作全部停手并由用户确认是否需要 allowlist。
- hook 与 allowlist 不一致：以最新的 allowlist 为准，但要求 Agent 立即把不一致情况报告给用户。
- 仅 `apps/agent-java8` 的 `apps/agent-java8/.pi/settings.json` 中已正确引入 hook；`apps/agent-java8-vue3`、`apps/agent-tests`、`apps/agent-inbox` 的 settings.json 仍引用不存在的路径，hook 未加载。在后三个 Agent 上必须手动验证本 Skill 的三种状态。

## 拒绝后行为

被 hook 拒绝后，Agent 不得以以下方式重试：

- 换用 `mcp__idea__execute_tool`、`bash`、`powershell`、`python -c`、`node -e` 等其他写工具走同一目标路径。
- 修改 `apps/<agent>/.pi/write-allowlist.json` 来“补上”路径。
- 重命名或移动 allowlist 文件后再次读取。

唯一受允许的后续动作：

- 报告给用户并停止任务；
- 请用户修改 `workgroup.yaml` 的 `permissions.writeDirectories` 或 `permissions.temporaryWriteDirectories`；
- 等用户修改后，hook 会自动重生成 allowlist，再继续。