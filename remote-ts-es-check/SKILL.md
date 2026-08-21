---
name: remote-ts-es-check
description: Use when a frontend task changes a limited set of Vue, TypeScript, or JavaScript files and linting or repair must stay within the current task's edited files and changed hunks, without IDE/MCP or project-wide scans.
---

# Edited TS & ESLint Check

只检查本次任务实际编辑的前端文件，只修复本次任务产生的代码行。**任务编辑清单是范围边界**；工作区里的其他改动、同文件其他行和全项目诊断都不自动纳入。

## Scope Contract

检查前列出本次任务的编辑清单：文件路径及对应的 changed hunks。范围来源按优先级排列：

1. 当前任务实际执行过的编辑记录。
2. 用户明确指定的文件或代码范围。
3. `git diff --unified=0 -- <task-files...>`，仅用于确认上述范围。

`<task-files...>` 包含本次任务编辑的全部文件，包括配置文件；`<lint-files...>` 只是其中可交给 ESLint 的 `.vue`、`.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs` 子集。ESLint 不支持的配置文件（如 `tsconfig.json`）可以保留在手工修复范围内，但不能传给 ESLint；`vite.config.ts` 等受支持文件仍可属于 lint files。

不要从整个 `git status`、全仓 diff 或目录扫描推导范围，它们可能包含用户原有改动。新建文件的全部内容视为本次编辑范围。

ESLint 必须解析完整文件才能正确理解 Vue/TS 语法，因此检查命令的最小可靠粒度是文件；**可修复范围仍然是 changed hunks**。同文件其他行的诊断只记录为范围外问题，不修复。

## Workflow

1. **确认范围**：记录全部 task files 及 changed hunks，再从中筛出 lint files。
2. **只读检查目标文件**：

   ```bash
   npx eslint <lint-files...> --format stylish
   ```

   不传目录、`.`、glob 或整个工作区文件列表。
3. **筛选诊断**：只有“文件在编辑清单内且报错行与 changed hunk 相交”的诊断属于本次修复范围。其他诊断单独报告，不处理。
4. **手工最小修复**：只编辑对应 changed hunk。不要使用 `--fix`；即使只传一个文件，ESLint 也可能改写该文件的其他行。
5. **复查同一范围**：

   ```bash
   npx eslint <lint-files...> --format stylish
   git diff --check -- <task-files...>
   git diff --unified=0 -- <task-files...>
   ```

   最后确认没有新增范围外 hunk。ESLint 若只剩同文件其他行的既有问题，应明确说明，不能宣称整个文件通过。

## TypeScript / Vue Type Checking

默认不运行 `vue-tsc --noEmit`、`tsc --noEmit` 或项目级 `type-check` 脚本。它们依赖完整 `tsconfig` 和跨文件类型图，不能可靠地限制到单个 Vue/TS 文件或 changed hunks；直接传文件会丢失项目配置，过滤全量输出仍属于全局扫描。

没有 IDE/MCP 时，不用不准确的单文件 TypeScript 命令冒充类型检查。如果项目已配置 type-aware ESLint 规则，这些规则可以继续生效，但不能等同于完整类型检查。

只有用户明确要求全量类型验证时才运行项目级类型检查，并必须标注其范围是全项目；仍只修复任务编辑清单内的问题，不处理其他文件。

## Quick Reference

| 操作 | 是否允许 | 范围 |
|---|---|---|
| `npx eslint <lint-files...> --format stylish` | 允许 | 只读解析编辑源码文件；只处理 changed hunks 的诊断 |
| 手工修改 changed hunks | 允许 | 只修改本次编辑代码 |
| `git diff --check -- <task-files...>` | 允许 | 只检查本任务目标文件补丁 |
| `npx eslint src` / `npx eslint .` | 禁止 | 会扫描目录或全项目 |
| `pnpm lint` / `npm run lint` | 禁止 | 可能展开为全仓扫描或自动修复 |
| `npx eslint <file> --fix` | 禁止 | 可能改写目标文件中的未编辑代码 |
| `npx vue-tsc --noEmit` | 默认禁止 | 只能可靠地做项目级检查 |

## Error Signatures

需要定位已编辑行中的常见错误时，读取 `references/error-signatures.md`。错误签名只帮助判断根因，不会扩大允许修改的文件或行范围；根因落在范围外时，只报告，不修复。

## Required Constraints

- 不用 `eslint-disable`、`@ts-ignore`、`any` 或修改全局配置来隐藏诊断。
- 不顺手清理同文件其他行、其他脏文件或 `packages/share` 的既有问题。
- 验证结果必须区分“本次 changed hunks 无相关诊断”和“整个文件/项目通过”。未运行全量类型检查时明确标注未验证跨文件类型关系。

## Legacy Hook Compatibility

已有安装可能通过 `.claude/hooks/ts-es-check-gate.sh` 读取下面的配置块，因此保留原有字段。它不属于本技能的严格局部工作流，也不授权执行全量命令。本仓库没有该 hook 脚本，无法验证外部 hook 是否遵守 changed-hunk 边界。

<!-- HOOK CONFIG START
HOOK_ESLINT_ARGS="--format stylish"
# ponytail: legacy hook 没有可验证的禁用开关；--version 保留字段兼容性且不扫描项目。
HOOK_TSC_ARGS="--version"
HOOK_MAX_ATTEMPTS=3
HOOK_SRC_REGEX='^src/.*\.(vue|ts|tsx|js|jsx|mjs|cjs)$'
HOOK CONFIG END -->
