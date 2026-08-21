---
name: basics-ts-es-check-vue
description: 在 cashier 微应用中运行 TypeScript 与 ESLint 静态检查并定位/修复问题。适用于改动前或提交前批量扫描 src/、处理 vue-tsc 或 eslint 报出的错误、遇到 TS2554（renderDialog 参数个数）、style/member-delimiter-style 缺逗号、vue/valid-template-root 模板缺根元素、no-multiple-empty-lines、unused-imports、unused eslint-disable 等错误时定位根因，以及区分「cashier 自身问题」与「packages/share 包既有问题」。
---

# Cashier TS & ESLint Check

对本子应用做 TypeScript / ESLint 静态检查，按错误签名定位根因并修复。**默认只扫描、不改文件**；确认后再修。

## Hook 检查配置（实时生效）

> 下面的配置块会被 `.claude/hooks/ts-es-check-gate.sh` 读取执行。**改这里即可调整 hook 的检查行为**，无需改脚本。当前会话若没有改动 `src/` 代码，hook 会自动跳过检查。

<!-- HOOK CONFIG START
HOOK_ESLINT_ARGS="--format stylish"
HOOK_TSC_ARGS="--noEmit"
HOOK_MAX_ATTEMPTS=3
HOOK_SRC_REGEX='^src/.*\.(vue|ts|tsx|js|jsx|mjs|cjs)$'
HOOK CONFIG END -->

| 配置项 | 作用 | 默认值 |
|---|---|---|
| `HOOK_ESLINT_ARGS` | eslint 额外参数（追加在变更文件列表后） | `--format stylish` |
| `HOOK_TSC_ARGS` | vue-tsc 参数 | `--noEmit` |
| `HOOK_MAX_ATTEMPTS` | 自动修复最大尝试次数，超过转人工审核 | `3` |
| `HOOK_SRC_REGEX` | 要扫描的变更文件正则 | `^src/.*\.(vue\|ts\|tsx\|js\|jsx\|mjs\|cjs)$` |

## Workflow

1. **ESLint 扫描（报告模式）**：`npx eslint src --format stylish`
   - ⚠️ 不要用 `pnpm lint`——脚本是 `eslint . --fix`，会**直接改写文件**。先报告、后修复。
   - 报告出的 warning 多为纯格式问题，可对单个文件跑 `npx eslint <file> --fix` 自动清理。
2. **TypeScript 检查**：`npx vue-tsc --noEmit`
   - 全量 check 较慢（含 `packages/share` 源码），仅改某个文件时可只信该文件的报错。
3. **按错误签名定位**：对照 `references/error-signatures.md` 的「签名 → 根因 → 修复」表，逐条处理。
4. **收尾复查**：重新跑 `npx eslint src --format stylish` 与 `npx vue-tsc --noEmit`，确认 0 error。

## Quick Reference

| 命令 | 用途 | 注意 |
|---|---|---|
| `npx eslint src --format stylish` | 扫描 src，只报告不改 | 默认方式 |
| `npx eslint <file> --fix` | 自动修复单个文件格式问题 | 只对目标文件跑，避免误伤其他改动 |
| `pnpm lint` | 全仓 eslint + fix | ⚠️ 会改文件，扫描时禁用 |
| `npx vue-tsc --noEmit` | TS 类型检查 | 慢，含 share 源码 |

## 常见错误速查

| 报错 | 根因 | 修复 |
|---|---|---|
| `TS2554 Expected 1-3 arguments, but got 4`（renderDialog） | `@ob-web/share` 解析到 node_modules 过期类型 | 修 tsconfig paths（见 references） |
| `style/member-delimiter-style: Expected a comma` | 单行内联类型字面量用了 `;` | 改成 `,` |
| `vue/valid-template-root` | `<template>` 里只有注释，无根元素 | 无渲染需求则删掉 `<template>` 块 |
| `unused-imports/no-unused-imports` | 导入了没用的符号 | 删掉 |
| `style/no-multiple-empty-lines` | 连续多个空行 | 合并为 1 个 |
| `vue/singleline-html-element-content-newline` | 元素内容该换行没换行 | `eslint --fix` 自动修 |
| 未使用的 `eslint-disable` | 对应规则已关闭（如 `perfectionist/sort-imports: off`） | 删掉该注释 |

## Required Constraints

- **扫描不改文件**：报告模式跑 ESLint；只有确认要修时才改，或用 `--fix` 精确到文件。
- **只修 cashier 的 `src/`**：`packages/share` 里报的类型错误是 share 包自身问题（见 references），不在本目录职责内，不要顺手改共享包。
- **报错先对签名**：同一个错误签名的根因往往是固定的（尤其 TS2554），先查表再动手，不要瞎改调用处。
- 修完必须重跑两个检查验证，别口头宣称通过。
