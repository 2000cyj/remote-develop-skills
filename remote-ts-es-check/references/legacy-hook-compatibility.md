# legacy-hook-compatibility

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

## Legacy Hook Compatibility

已有安装可能通过 `.claude/hooks/ts-es-check-gate.sh` 读取下面的配置块，因此保留原有字段。它不属于本技能的严格局部工作流，也不授权执行全量命令。本仓库没有该 hook 脚本，无法验证外部 hook 是否遵守 changed-hunk 边界。

<!-- HOOK CONFIG START
HOOK_ESLINT_ARGS="--format stylish"
# ponytail: legacy hook 没有可验证的禁用开关；--version 保留字段兼容性且不扫描项目。
HOOK_TSC_ARGS="--version"
HOOK_MAX_ATTEMPTS=3
HOOK_SRC_REGEX='^src/.*\.(vue|ts|tsx|js|jsx|mjs|cjs)$'
HOOK CONFIG END -->
