---
name: remote-write-scope
description: Use when 当前 Agent 即将对任何文件执行写操作，包括 write / edit / apply_patch / multi_edit / bash / powershell / mcp__idea__execute_tool 内的 apply_patch、create_new_file、execute_terminal_command，或调用 python / node -c / heredoc / 重定向等会写盘的方式。写前必须确认 hook 已挂载、写路径落在 <启动目录>/.pi/write-allowlist.json 的 roots/confirmRoots 或 Agent 自己的 PM/ 下；headless/RPC 模式下临时写入一律拒绝；被拒绝后不得换工具重试。不要用于纯读取任务、数据库查询、网络搜索或其他不需要写盘的操作。
---

# remote-write-scope

约束 Agent 的所有写操作严格落在启动目录下的 `.pi/write-allowlist.json` 中。Skill 提供表象规则与拒绝后的修正路径；底层控制由 `packages/agent-script/write-allowlist.ts` hook 执行。即使 Skill 未被加载，hook 也会按同一规则拦截越权写入。

Use `references/allowlist-lookup.md` when 需要在会话中复现或核对 `.pi/write-allowlist.json` 内容、根路径与相对路径换算。
Use `references/hook-overlap.md` when 需要厘清本 Skill 与 `remote-idea-mcp-usage`、`remote-commit-git` 在写权限上的边界，以及 hook 未挂载时的手动验证步骤。

## Workflow

1. **识别当前 Agent 启动目录**：当前进程 cwd 即 Agent 目录。例如 `apps/agent-java8-vue3`。仅当 cwd 向上能找到名为 `apps` 的父目录时才视为本 Skill 生效；否则停止所有写操作并向用户报告“非 Agent 启动目录”。
2. **确认 hook 已挂载**：检查 `apps/<agent>/.pi/settings.json` 的 `extensions` 中是否包含 `packages/agent-script/write-allowlist.ts`（或当前生效路径）。如果未引用该模块，hook 不会被加载；此时仍必须按本 Skill 的规则手动验证每个写路径，不得默许。
3. **读取最新 allowlist**：读取 `<cwd>/.pi/write-allowlist.json`。**该文件由 hook 每次写操作前自动重新生成**，以 `workgroup.yaml` 的 `permissions` 为唯一真相。文件不存在或解析失败 = 无可写根，所有写操作一律停手。不允许 Agent 自己创建、重写、删除或重命名该文件来扩展权限。
4. **判定目标路径**：
   - `write` / `edit` / `apply_patch` / `multi_edit`：取 `input.path` 或 patch 头部路径。
   - `bash` / `powershell`：从 `command` 中解析会写盘的子命令路径（重定向、`tee`、`sed -i`、`python -c`、`node -e`、`cp`/`mv`/`rsync`、`git apply --` 等）。
   - `mcp__idea__execute_tool` 与所有 `mcp__*` 工具：直接读取 `input.command` / `input.filePath` / `input.path` / `input.file` / `input.files`，再用 shell 同样的子句解析覆盖嵌套场景。
5. **落点判定**（三种状态）：
   - **永久允许写入**：目标路径的规范形式落在 `roots` 任意根内，或落在 Agent 自己的 `PM/` 子目录内。这种写是配置上长期授权的，不需要任何运行时授权。
   - **临时写入**：目标路径的规范形式落在 `confirmRoots` 任意根内。这种写在配置上只是“可能要写”，每次必须由用户当场授权一次：TUI 模式下弹出选择 + `ALLOW` 输入；headless / RPC / SDK 模式下没有用户在场，一律拒绝。
   - **越权写入**：目标路径既不在 `roots` 内、也不在 `confirmRoots` 内，也不属于 Agent 自己的 `PM/`。一律拒绝；Agent 不允许“换个工具重试”。
6. **执行写操作**：
   - 永久允许 → 直接写。
   - 临时写入 → 仅在用户当场授权后才能写；不授权视为拒绝。
   - 越权 → 停手，要求用户在 `workgroup.yaml` 中将目标路径加入 `permissions.writeDirectories`（永久）或 `permissions.temporaryWriteDirectories`（临时），再继续。**不得**通过改用 `mcp__idea__execute_tool`、`bash`、`python -c` 等工具重试。
7. **回报**：在响应中说明：
   - 当前 Agent 目录与 `<cwd>/.pi/write-allowlist.json` 路径；
   - hook 是否已挂载（依据 settings.json 的 `extensions` 列表）；
   - 实际写入的目标路径及其相对根；
   - 属于永久允许还是临时写入。

## Required Constraints

- **严禁越权写盘**：任何写操作的最终落点必须落在 `roots` 或 `confirmRoots` 之一内；Agent 自己的 `PM/` 子目录永远允许；其他一律拒绝。
- **严禁跳过 allowlist**：不得通过“新建/复制/重命名 allowlist 文件”“直接调用 shell 写文件”等方式绕过 hook。即便 hook 暂时未挂载，也必须按同一规则手动验证；hook 未挂载时不允许默认放行。
- **allowlist 不存在时的默认行为**：默认全部写盘行为停手；如果当前 Agent 在 `apps/<agent>/` 内，hook 会自动创建 `<cwd>/.pi/write-allowlist.json`，但不得在没有 allowlist 时擅自写入 `apps/<agent>` 之外的路径。
- **不得修改 allowlist 来扩展权限**：Agent 不得创建、重写、删除或重命名 `.pi/write-allowlist.json` 来改变自身权限；权限变更必须由用户在 `workgroup.yaml` 的 `permissions.writeDirectories` / `permissions.temporaryWriteDirectories` 中修改并由 hook 重新生成 allowlist。
- **拒绝后必须修正路径或请求授权**：被 hook 拒绝时，先确认目标路径；如确实需要写入该路径，停下来并要求用户在 `workgroup.yaml` 中显式添加，再继续。不允许“换个工具再试一次”以绕过拦截：换 `mcp__idea__execute_tool`、换 `bash`、`python -c`、重写脚本等都在禁止之列。
- **不允许手工改文件覆盖 hook 控制**：不允许直接用 `mcp__idea__execute_tool`、`bash`、`python -c` 等工具在写权限之外的目标路径创建或修改文件，即便这些路径不在当前 Agent 的 `PM/` 中。
- **临时写入**：仅 `confirmRoots` 内的目录允许临时写入，且每次必须由用户当场授权一次；TUI 走选择 + `ALLOW` 流程，headless / RPC / SDK 模式因用户不在场直接拒绝；其他目录一律按越权处理。
- **跨 Agent 写入**：不得为其他 Agent（如 `apps/agent-tests`、`apps/agent-manager`）的目录或 PM 写入；本规则只覆盖本 Agent 自己的 `PM/` 与 `roots`/`confirmRoots`。
- **以 hook 生成的 allowlist 为唯一真相**：Agent 不得使用与 `<cwd>/.pi/write-allowlist.json` 不一致的“推断允许根”；如需新增允许根，只能改 `workgroup.yaml` 后等 hook 重新生成。

## 与 hook 的关系

- 写入拦截由 `packages/agent-script/write-allowlist.ts` hook 在 `tool_call` 上统一执行；覆盖 `write` / `edit` / `apply_patch` / `multi_edit` / `bash` / `powershell` / `mcp__*` 等所有可能写盘的工具。
- Skill 与 hook 使用同一份 `<cwd>/.pi/write-allowlist.json` 作为唯一真相；hook 在每次写操作前**重新从 `workgroup.yaml` 解析并重写**该文件，Agent 读到的不再反映用户已经改 yaml 后 hook 重生成的新值。
- 拒绝信息由 hook 给出，但拒绝原因和修复路径与本 Skill 规则一致；Agent 在响应中可以直接引用 hook 错误并按本 Skill 的修正路径处理。
- **hook 未挂载的 Agent**：例如 `apps/agent-java8-vue3` / `apps/agent-tests` / `apps/agent-inbox` 的 settings.json 仍引用不存在或别的路径的 extension，hook 不会被加载。这类 Agent 必须在每一步写操作前主动验证本 Skill 的三种状态，不允许以“hook 没拦”为由放行。

## 不做的事

- 不读取其他 Agent 的 `PM/` 之外的目录；
- 不修改 `workgroup.yaml` 本身（该文件由经理 Agent 管理并由启动器同步）；
- 不为“完成任务”而临时放宽 allowlist、临时增加根目录或临时跳过 hook；
- 不在没有 `roots` 的情况下默认把当前 Agent 目录当作可写根。

## Response Shape

每次写操作完成后回报：

- 当前 Agent 启动目录与 `<cwd>/.pi/write-allowlist.json` 路径；
- hook 是否已挂载（依据 settings.json `extensions` 列表）；
- 实际写入的目标路径及其相对根；
- 是否属于 `roots` 永久允许或 `confirmRoots` 临时允许；
- 触发的工具名（`write` / `edit` / `apply_patch` / `bash` / `mcp__idea__execute_tool` 等）；
- 若被 hook 拒绝：被拒绝的目标路径、拒绝信息中提示的允许根、应建议用户修改的 `workgroup.yaml` 字段。