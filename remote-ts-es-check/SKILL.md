---
name: remote-ts-es-check
description: Use when a frontend task changes a limited set of Vue, TypeScript, or JavaScript files and linting or repair must stay within the current task's edited files and changed hunks, without IDE/MCP or project-wide scans. Read this entry first and load only the relevant reference sections.
---

# Edited TS & ESLint Check

只检查本次任务实际编辑的前端文件，只修复本次任务产生的代码行。本入口保留范围、流程和验证底线；长诊断清单按需读取，不加载全部 references。

## Scope Contract

- 编辑清单来源：本任务编辑记录 → 用户明确指定范围 → `git diff --unified=0 -- <task-files...>` 确认。不从整个 git status、全仓 diff 或目录扫描推导范围，避免包含用户原有改动。
- `task-files` 包含本任务全部文件，包括配置文件；`lint-files` 只包含其中 ESLint 支持的 `.vue/.ts/.tsx/.js/.jsx/.mjs/.cjs`。不把 tsconfig.json 等不支持文件传给 ESLint。
- ESLint 必须解析完整文件，但可修复范围仍是 **changed hunks**；新建文件全部内容视为本次范围。同文件其他行或其他文件的问题只报告，不顺手修复。
- 相关类型、导出位置与调用方可以按已知符号只读追踪；不把参考示例中的 `src/` 搜索扩大为默认全项目诊断或清理。

## Workflow

1. 列出 task-files、changed hunks 与 lint-files；没有可 lint 文件就跳过 ESLint，不用目录替代。
2. 对明确文件运行只读检查：

   ```bash
   npx eslint <lint-files...> --format stylish
   ```

3. 筛选“文件属于任务且诊断与 changed hunk 相交”的问题，手工最小修复。禁止 `--fix`，即使只指定一个文件也可能改写其他行。
4. 修改 import 路径或合并 import 前，核对每个标识符的真实 export 位置及 barrel re-export，不能只凭路径相似合并；根因在范围外时报告，不擅自迁移。
5. 在任务范围内检查类型、格式、未使用代码和样式嫌疑；根据下表加载对应清单。ESLint 零错误不代表类型图正确；文本命中也不自动证明代码有错，需读定义/调用上下文。
6. 对相同文件复查 ESLint 和补丁：

   ```bash
   npx eslint <lint-files...> --format stylish
   git diff --check -- <task-files...>
   git diff --unified=0 -- <task-files...>
   ```

7. 确认未新增范围外 hunk；报告本次检查结果、范围外诊断及未验证项。

## 按需导航

以下路径均相对于本 skill 目录。单个参考文件仍过大时按标题/行号分段读取，不拼接全部细则。

Use references/edited-file-workflow.md when 需要原局部检查流程、范围定义或 import 修改前的 export 核验示例。
Use references/import-and-contract-checks.md when 涉及导入导出错位、同名类型、unknown 返回值、mock 必填字段、spread/union 类型或 Set/Array 混用。
Use references/type-and-identifier-checks.md when 涉及类型缺 import、Record 值类型、as const 精确联合类型或前后端契约漂移。
Use references/reactive-field-checks.md when 涉及未声明 identifier、reactive 初始化缺字段或 formData 字段访问错。
Use references/format-unused-tailwind-checks.md when 涉及 JSDoc 格式、未使用 import/变量/API 或 Tailwind 任意值等价短写；只处理任务范围，先核实配置/版本/动态引用。
Use references/type-check-boundaries.md when 需要 ESLint 与 vue-tsc 能力边界、ApiEnvelope 适配或命令范围说明；项目级类型检查以本入口的明确授权要求为准。
Use references/baseline-eslint.md when 定位已编辑行中的 ESLint、JSDoc、参数个数或 Tailwind 错误签名。
Use references/ts-typing.md when 定位 TS2304/2305/2307/2322/2339/2345/2551 等类型错误；该文件较大，只读取相关错误码章节。
Use references/reactive-errors.md when 定位 Vue reactive/ref/props 相关错误签名。
Use references/legacy-hook-compatibility.md when 维护外部旧 hook 的配置字段；不属于默认执行流程，也不授权自动全量检查。

## Required Constraints

- 禁止 `eslint src`、`eslint .`、目录/glob 扫描、范围不明的 `pnpm lint/npm run lint` 或自动 fix；只传本任务明确文件。
- 默认不运行 `vue-tsc --noEmit`：它依赖完整 tsconfig 与跨文件类型图，不能靠 grep 输出变成单文件检查。**只有用户明确要求项目级/全量类型验证时才运行**，报告标注全项目范围，仍只修任务 hunks。仅发现类型嫌疑不构成授权。
- 不用单文件 tsc 或 ESLint 零告警冒充完整类型验证；已有 type-aware ESLint 可继续生效，但不是完整类型检查。
- 不用 any、ts-ignore、eslint-disable 或修改全局配置掩盖错误；不以加下划线隐藏死代码。动态引用、slot/事件占位符及公共 API 必须结合上下文判断，不凭 grep 无命中直接删除。
- 只在项目已配置对应规则/plugin 时通过 CLI 临时开启未使用检查，不盲目引用不存在的 rule，不写入 eslint.config.js。不会把参考清单中的示例 E2E 数量或批量脚本作为默认强制步骤。
- Tailwind 短写只有在当前主题/版本下确实等价时才替换，不根据历史固定映射盲改。
- 发现范围外根因时列出位置和影响，交用户决定是否扩展任务；不把所有新发现问题武断称为“预存问题”。

## Response Shape

- 检查的 task-files 与 changed-hunk 范围。
- 实际命令、退出码及本次范围内诊断处理结果。
- 范围外诊断单独列出；区分“本次修改无相关诊断”与“整个文件/项目通过”。
- 未运行项目类型检查时明确说明：未验证完整跨文件类型关系。

## Legacy Hook Compatibility

旧安装可能通过 `.claude/hooks/ts-es-check-gate.sh` 读取下列块，保留字段避免破坏外部消费者。该 hook 不在本仓库，无法验证其行为；字段不授权全项目命令。历史说明见 references/legacy-hook-compatibility.md。

<!-- HOOK CONFIG START
HOOK_ESLINT_ARGS="--format stylish"
# --version 仅保留字段兼容性，不扫描项目。
HOOK_TSC_ARGS="--version"
HOOK_MAX_ATTEMPTS=3
HOOK_SRC_REGEX='^src/.*\.(vue|ts|tsx|js|jsx|mjs|cjs)$'
HOOK CONFIG END -->
