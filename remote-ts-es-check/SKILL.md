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
3. **筛选诊断**：只有"文件在编辑清单内且报错行与 changed hunk 相交"的诊断属于本次修复范围。其他诊断单独报告，不处理。
4. **手工最小修复**：只编辑对应 changed hunk。不要使用 `--fix`；即使只传一个文件，ESLint 也可能改写该文件的其他行。

   > **【强制】4a. 修复 import 路径后必须做"路径校验"**（防 TS2305 形态 2 / 形态 4）：
   >
   > 任何对 `import ... from "<path>"` 的路径或路径间标识符迁移修改（合并两个 `from "../apis"` 的 import、调整 import path 在 type.ts / index.ts / utils.ts 之间调动、改 `../apis` 到 `../apis/type` 等），修改前必跑：
   >
   > ```bash
   > grep -rn "export interface <Name>\|export type <Name>\|export const <Name>\|export function <Name>" src/ --include="*.ts" --include="*.vue"
   > ```
   >
   > 其中 `<Name>` 为被移动的每个标识符。把"文本上"写在 import 里的 path 与 `export` 出现的实际文件进行逐个对照。**不一致 → 报告为 TS2305 形态 2，不擅自修**。
   >
   > 背景：ESLint 不会扫跨文件类型图，不会发现 TS2305 路径错位；vue-tsc 默认不跑；本次修 `import/no-duplicates` 合并 import 时，如果仅以"同根路径多次 import"作为合并依据、不看实际 export 位置，就会把 value-export 里的接口名误到 type-only path 里，发生本错位。
   >
   > 简便记法：**"import path 合并/改动 → 先 grep export 再写代码"**。

5. **复查同一范围**：

   ```bash
   npx eslint <lint-files...> --format stylish
   git diff --check -- <task-files...>
   git diff --unified=0 -- <task-files...>
   ```

   最后确认没有新增范围外 hunk。ESLint 若只剩同文件其他行的既有问题，应明确说明，不能宣称整个文件通过。
6. **类型嫌疑主动扫描**（即使 ESLint 0 报错也要做）：
   - grep 任务文件中的 `\|\|` 兜底链、`as any` 断言、`@ts-ignore`、`eslint-disable`
   - **grep import 后未使用**：对每个 import 标识符，grep 该文件（除 import 行外）出现次数 = 0
   - **同名多源 import / 跨文件 import 路径错位**（形态 2 TS2305，**任何修改了 `from "<path>"` 的操作都必须走这一步**）：grep 标识符在 `src/` 全局（除 type.ts 自己）的 `export` 出现位置，对比 type.ts 写出的 import 路径；不一致则报告"路径错位、成员在另一文件真实存在"
   - **同名类型重复定义**（防 TS2322：同名 `interface` / `type` 在多个文件独立 `export`，TS 视为两个独立类型）：grep 同名任务 interface 定义数量 > 1 时，报告"重复定义 + 哪一份可选性更严/宽"。Ponytail rung 1：DTO / type 侧为唯一 source of truth，组件 / props 从 DTO import。
     ```bash
     # 找出同名字 interface / type 多次定义点
     grep -nE "(interface|type)\s+OnboardingSubAccount\b" src/ -r --include="*.ts" --include="*.vue"
     ```
     命中 > 1 处 → 报告"重复定义"，不擅自合并（判断保留哪一份需业务上下文）
   - **函数返回类型推断 unknown / 缺签名**（防 TS2345：函数体从 `Record<string, unknown>` 取出后用 `||` 兑底为字符串，推断为 `unknown | string`，调用方期待纯 `string` 时报错）：grep 函数参数为 `Record<string, unknown>` / `Record<string, any>` / `{ [k: string]: any }` 等索引返回未定类型的定义，同时函数体含 `|| "..."` 兑底表达式 → 该函数返回类型会被推为 `unknown | string`；查看调用方参数类型是否期待纯 `string`。命中 → 报告为"函数签名漏标注返回类型"，不擅自修。
     ```bash
     grep -nE 'Record<string,\s*(unknown|any)>|\{\s*\[k:\s*string\]:\s*(unknown|any)\s*\}' src/ -r --include="*.ts" --include="*.vue"
     ```
     ```bash
     # 另一面：函数体中 `|| "..."` 兑底（怀疑 LHS 是 unknown）
     grep -nE '=>.*\|\|\s*"' src/ -r --include="*.ts" --include="*.vue"
     ```
   - **mock / test 数据 vs 接口契约不一致**（防 TS2322：mock 函数返回的对象字面量缺必填字段，或字段类型不一致）：触发场景——编辑 `*.mock.ts` / `*Mock*.ts` / `mock.ts` / `*.test.ts` / `*.spec.ts` 等包含静态示例数据的文件。grep 同文件内 `export interface` 定义的所有必填字段（无 `?` 后缀）与所有 `.map((...) => ({...}))` / 对象字面量逐字段对照。必填字段缺失 → 报告为"mock 字段缺失"，不擅自修（判断是接口过严还是 mock 漏字段，需看调用方兑底逻辑）。
     ```bash
     # 找出 mock 文件内的 interface 定义
     grep -nE 'export\s+interface\s+\w+\s*\{' src/ -r --include="*.mock.ts" --include="*.test.ts" --include="*.spec.ts" --include="*Mock*.ts"
     # 找出 mock 文件内的对象字面量返回位置
     grep -nE 'stores:\s*stores\.map|=>\s*\(\s*\{' src/ -r --include="*.mock.ts" --include="*.test.ts" --include="*.spec.ts" --include="*Mock*.ts"
     ```
     参考 `references/error-signatures.md` 中的 "TS2322 形态：mock 对象字面量字段缺失"。
   - 命中 → Read 相关 `type.ts` / `*.d.ts` 对比字段名/类型
   - 不一致 → 报告"预存问题"，**不擅自修**
   - 用户要求全面验证 → 跑 `npx vue-tsc --noEmit | grep <pattern>` 全项目扫描（必须标注范围）

7. **格式嫌疑主动扫描**（即使 ESLint 0 报错也要做）：
   - **JSDoc 起始行同行接文字**（防 jsdoc/multiline-blocks）：grep 文件内所有 `/**` 行，若 `/**` 后紧跟非空字符（非换行、非空格引导的 ` *`），则该注释违规。修复：把首行 `/**` 单独成行，文字挪到下一行 ` * <text>`，未行用 ` */`。参考 `references/error-signatures.md` 中的 "jsdoc/multiline-blocks 形态"。
     ```bash
     grep -nE "^\s*/\*\* [^/\*\s]" src/ -r --include="*.ts" --include="*.vue" --include="*.js"
     ```
   - 命中 → Read 上下文确认是否为多行注释（不是首行就是单行注释）
   - 违规 → 手动调整 `/**` 起头位置，不加 `eslint-disable`
   - 不主动添加 `eslint-disable-next-line jsdoc/multiline-blocks` 绕过
8. **未使用代码主动扫描**（即使 ESLint 默认 0 报错也要做）：
   - **背景**：cashier 项目的 eslint.config.js 默认禁用了 `no-unused-vars`（避免误报 props/emits 等子类型），导致代码中的孤儿 import / 死代码变量 / 孤儿 API 函数 默认不会被 ESLint 报警。
   - **主动开启 no-unused-vars 扫一遍**（不写入项目配置，只在 CLI 加 `--rule`）：
     ```bash
     npx eslint <lint-files...> --rule '{"unused-imports/no-unused-imports":"error","no-unused-imports":"error","unused-imports/no-unused-vars":"error","no-unused-vars":"error","vue/no-unused-components":"error","vue/no-unused-vars":"error"}'
     ```
     命中 → 逐项 Read 上下文判断是"真死代码"还是"动态/反射场景假装豁免"。
   - **判断 "真死代码 vs 假装豁免"**：
     - 真死代码：删除 var/const/function/import 行，运行逻辑不变
     - 假装豁免（下划线前缀）：`const _xxx = ...`、`function _yyy() {...}`——这是错误的逃生口，下划线前缀让 ESLint 不报警但死代码仍存在，**必须直接删**。例外：`_<slot-name>` / `_event` 之类是 Vue 模板 slot 占位符或事件保留名，**保留**。
     - 动态场景：JSX/模板反射用法、props 解构、`v-for` 中 `:key`、模板字符串拼装的标识符——Read 上下文确认后再决定。
   - **下划线前辍死代码主动扫描**（grep 不依赖 ESLint 配置）：
     ```bash
     # 找出声明的下划线前辍变量/函数/常量（疑似死代码逃生口）
     grep -nE '(const|let|function|class)\s+_\w+\s*[=(:]' src/ -r --include="*.ts" --include="*.vue"
     ```
     命中 → 逐项 Read 上下文确认：
     - 如果被引用（如 `_handleAddRowToQueue(companyId)`）→ 合法命名，保留
     - 如果仅声明无引用 → **真死代码，删掉**
     - 不要"为了安全再加下划线"
   - **孤儿 API 函数扫描**（声明了 `export function` 但全局无调用方）：
     ```bash
     # 找出 apis 目录的所有 export 函数
     grep -nE '^export\s+(async\s+)?function\s+\w+' src/ -r --include="*.ts" --include="*.vue"
     ```
     对每个函数名 grep 跨文件调用方（排除声明处本身）：
     ```bash
     grep -rn "\b<函数名>\b" src/ --include="*.ts" --include="*.vue" | grep -v "^<声明文件>:<行号>:"
     ```
     - 唯一调用方 = 自己（声明 + 自己 import）→ 孤儿函数，删
     - 多处调用 → 保留
   - **行为验证**：删除后跑 5 个 E2E 脚本（如业务域内）或 `npx vue-tsc --noEmit`（如跨域），确认行为不变
   - **不修改 eslint.config.js**：检测只在 CLI 加 `--rule`，不写入项目配置（用户可能故意关掉 disable，避免写代码风格无法控制）
9. **Tailwind 任意值飘红主动扫描**（IDE Tailwind IntelliSense 提示，**ESLint 抓不到，需 grep**）：
   - **背景**：项目用 Tailwind CSS 4.x（cashier 项目为 4.1.18），IDE Tailwind IntelliSense 会提示 `The class 'min-h-[48px]' can be written as 'min-h-12'`——这些是 spacing / sizing / text-size 任意值的"等价短写"提示。颜色任意值飘红（`bg-[#xxx]`）是另一问题（需抽 `<style scoped>` 或加 Tailwind 主题，本 skill 不覆盖）。
   - **默认比例映射表**：
     - spacing / sizing：`gap / p / px / py / pt / pb / pl / pr / m / mx / my / mt / mb / ml / mr / space / inset / w / h / min-* / max-*` 数值任意值（如 `gap-[8px]` → `gap-2`）
     - text size：`text-[12px]` → `text-xs`、`text-[14px]` → `text-sm`、`text-[16px]` → `text-base`
     - rounded：`rounded-[2px]` → `rounded-sm`、`rounded-[8px]` → `rounded-lg`、`rounded-[10px]` → `rounded-xl`
   - **不可转换**：`text-[13px]` / `text-[15px]`（不在默认字号比例）、`rounded-[20px]`（不是 full 语义）、颜色 / 阴影 / 渐变任意值
   - **主动扫描方法**：
     ```bash
     grep -hoE '\b(min-h|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|rounded|w|h|space-x|space-y|top|bottom|left|right|text)-\[\s*([0-9.]+)(px|rem)?\s*\]' src/ -r --include="*.vue" | sort -u
     ```
   - **Ponytail rung 选择**：
     1. rung 1：仅换短写不改逻辑，业务 0 改动
     2. rung 6：写一次性 Python 脚本批量替换（见 `references/error-signatures.md`）
   - **修复**：批量 Python 脚本见 `references/error-signatures.md` 中 "Tailwind 任意值需等价短写" 形态

## TypeScript / Vue Type Checking

**核心限制**：skill 默认只跑 `npx eslint --format stylish`，**不跑 `vue-tsc --noEmit`**。原因：
1. `vue-tsc --noEmit` 依赖完整 tsconfig + 跨文件类型图，不能限制到单个文件
2. 全项目跑 = 全项目扫描 → 违反 "changed hunks only" 范围约束
3. cashier 这类 monorepo 跑一次 30-60s+ → 不能在每次小改动时跑

**为什么这意味着 ESLint 抓不到以下错误**：
| 错误码 | 含义 | ESLint 默认能抓吗 |
|---|---|---|
| TS2551 | 字段不在类型上 | ❌ 需 type-aware 规则 |
| TS2339 | 成员访问失败 | ❌ 同上 |
| TS2345 | 类型赋值不兼容 | ❌ 同上 |
| TS2305 | 跨文件导入成员不存在 | ❌ 同上 |
| TS2554 | 函数签名不兼容（参数过多/过少） | ⚠️ 部分可抓（参数个数），但根因（share 包路径）抓不到 |
| jsdoc/multiline-blocks | JSDoc 起始行同行接文字 | ✅ eslint-plugin-jsdoc 默认能抓（不需 type-aware） |
| no-unused-vars | 未使用变量 / import / function | ⚠️ 项目常禁用（避免误报 props/emits）——需 CLI 加 `--rule` 主动扫 |

没有 IDE/MCP 时，不用不准确的单文件 TypeScript 命令冒充类型检查。如果项目已配置 type-aware ESLint 规则（如 `@typescript-eslint/no-unsafe-member-access`、`parserOptions.project`），这些规则可以继续生效，但不能等同于完整类型检查。

**升级检测能力的 3 种方法**（用户选其一）：
1. **项目级 `pnpm type-check` 脚本** + husky pre-commit 钩子：`vue-tsc --noEmit` 跑全项目。CI 必卡、本地可选。
2. **ESLint type-aware 配置**：在 `eslint.config.js` 加 `@typescript-eslint/no-unsafe-member-access: error` 和 `parserOptions.project: ["./tsconfig.json"]`。lint 时间从 5s 变 30s+，但能在 ESLint 阶段抓类型错。
3. **本次临时跑 vue-tsc**（用户明确要求时）：`npx vue-tsc --noEmit 2>&1 | grep <task-file-pattern>`，必须标注全项目范围；只修任务编辑清单内的问题。

**默认走法**：方法 3。当用户提出"类型错误"或"字段不存在"等嫌疑问题时：
1. 主动 grep `\|\|` 兜底、类型断言、`as any` 等可疑模式
2. Read 相关 `type.ts` / `*.d.ts` 对比实际类型契约
3. 跑 `npx vue-tsc --noEmit | grep`，把过滤后清单交用户决策
4. 按 changed-hunk 范围约束修复，不扩大

只有用户明确要求全量类型验证时才运行项目级类型检查（命令形如 `npx vue-tsc --noEmit`），并必须标注其范围是全项目；仍只修复任务编辑清单内的问题，不处理其他文件。

## Type-aware 缺失场景的兜底

ESLint 单跑 `eslint --format stylish` **不会暴露**：
- 字段访问死代码（如 `file.fileName` 在 `FileUploadRecord` 类型上不存在）
- 类型不匹配（如 `attachments: FileUploadRecord[]` 实际为 `FileUploadRecordList[]`）
- 跨文件导入的导出成员缺失
- **未使用 import**（除非 ESLint 启用 `unused-imports/no-unused-imports` 规则，且 TS 启用 `noUnusedLocals`）
- **同名多源 import**（同一标识符在多个文件被独立定义，从语义上选哪个是架构判断，不在 lint 覆盖范围）
- **ApiEnvelope 与组件 props 类型不兼容**（如 `Promise<ApiEnvelope<string>>` 传给 `ExportButton` 的 `Promise<string>` 期望）—— 这是**特殊形态**：用户经常忘记"业务 API 返 envelope，但 UI 组件期望拆 envelope 后裸值"

发现这类嫌疑时（如成员链含 `||` 兜底、参数类型来自跨文件 interface），必须：

1. **主动 grep 嫌疑模式**：
   - `\|\|` 兜底链（可能遮蔽字段不存在错误）
   - `as any` / `as unknown as` 类型断言
   - `@ts-ignore` / `@ts-expect-error` 注释
   - `// eslint-disable` 注释
   - **import 后未使用**：grep 标识符在文件内（除 import 行）的出现次数 = 0
   - **同名多源 import**：grep 标识符在 `src/` 全局的出现次数 > 1 个定义点
   - **ApiEnvelope 适配嫌疑**：grep `:create-file-api\|:fetch-api\|:request-api\|@create-file` 等 UI 组件 props 绑定模式 + 同文件内 import 的 API 函数，对比函数返 `Promise<.*Envelope.*>` 与 props 期望 `Promise<[非 envelope 裸值]>`。典型 API 函数名匹配 `export.*Api$|exportSubAccount|exportAccount`
   - **跨文件 import 路径错位**（形态 2 TS2305）：grep 标识符在 `src/` 全局（除 type.ts 自己）的 `export` 出现位置，对比 type.ts 写出的 import 路径；不一致则报告"路径错位、成员在另一文件真实存在"
2. 用 `Read` 工具读相关 `type.ts` / `*.d.ts` 找定义
3. 对比字段名、类型、import 来源，确认是否真"字段不在类型上" / "import 实际未使用" / "envelope 未拆"
4. **不擅自修**——按 changed-hunk 范围约束，应记录为"预存问题、不在本任务范围"
5. 若用户要求全面验证，临时跑 `npx vue-tsc --noEmit` 全项目类型检查，按 grep 过滤本次任务文件，把过滤后的报错清单交给用户决策
6. **ApiEnvelope 适配的最小修法**：在 `apis/index.ts` 抽适配函数（如 `exportSubAccountChangeAuditFileApi = (data) => underlying(data ?? {}).then(res => res.data as string)`），保留原 envelope 版本给其它消费 envelope 完整字段的调用方继续使用。**不要改原 API 函数本身**，那会影响多个调用方。

参考签名见 `references/error-signatures.md` 中 `TS2551`（字段不存在）、`TS2339`（成员访问）、`TS2322`（类型不匹配）、`TS2345`（类型不匹配）、`TS2554`（参数个数）。

## Quick Reference

| 操作 | 是否允许 | 范围 |
|---|---|---|
| `npx eslint <lint-files...> --format stylish` | 允许 | 只读解析编辑源码文件；只处理 changed hunks 的诊断 |
| 手工修改 changed hunks | 允许 | 只修改本次编辑代码 |
| `git diff --check -- <task-files...>` | 允许 | 只检查本任务目标文件补丁 |
| `npx eslint src` / `npx eslint .` | 禁止 | 会扫描目录或全项目 |
| `pnpm lint` / `npm run lint` | 禁止 | 可能展开为全仓扫描或自动修复 |
| `npx eslint <file> --fix` | 禁止 | 可能改写目标文件中的未编辑代码 |
| `npx vue-tsc --noEmit` | 默认禁止（仅用户明确要求全量类型验证时可跑，必须标注全项目范围） | 项目级检查，依赖完整 tsconfig |
| `npx vue-tsc --noEmit 2>&1 \| grep <pattern>` | 允许（用户明确要求类型验证时） | 全项目扫描 + grep 过滤，必须在报告中标注"全项目范围" |
| grep `\|\|` / `as any` / `@ts-ignore` 兜底模式 | 允许（类型嫌疑主动扫描步骤） | 只读，不修改代码 |
| grep import 后未使用 / 同名多源 import | 允许（主动扫描步骤） | 只读，不修改代码 |
| grep `:create-file-api` / `:fetch-api` 等 UI 组件 props 绑定模式 | 允许（ApiEnvelope 适配嫌疑扫描步骤） | 只读，不修改代码 |
| grep 标识符在 `src/` 全局 `export` 位置 | 允许（TS2305 路径错位嫌疑扫描步骤） | 只读，不修改代码 |
| grep 函数参数 `Record<string, unknown\|any>` / 索引返回 unknown 类型 | 允许（类型嫌疑主动扫描步骤） | 防函数返回类型推断为 `unknown \| string`，与纯 `string` 调用方报 TS2345 |
| grep mock / test 文件的 interface 必填字段 vs 对象字面量返回字段 | 允许（类型嫌疑主动扫描步骤） | 防 TS2322：mock 对象字面量缺必填字段 |
| 修 import path 之前 grep export 位置 | **强制**（见第 4a 步） | 防 TS2305 形态 2 / 形态 4 路径错位 |
| `npx eslint <files> --rule '{"no-unused-vars":"error",...}'` | 允许（未使用代码主动扫描步骤） | CLI 加 --rule，不改 eslint.config.js；扫死代码 + 孤儿 API |
| grep `(const\|let\|function\|class)\s+_\w+\s*[=(:]` | 允许（未使用代码主动扫描步骤） | 查下划线前缀死代码逃生口 |
| 加下划线前缀 / `eslint-disable-next-line` 保留死代码 | **禁止** | 错误逃生口；死代码应直接删 |

## Error Signatures

需要定位已编辑行中的常见错误时，读取 `references/error-signatures.md`。错误签名只帮助判断根因，不会扩大允许修改的文件或行范围；根因落在范围外时，只报告，不修复。

## Required Constraints

- 不用 `eslint-disable`、`@ts-ignore`、`any` 或修改全局配置来隐藏诊断。
- 不顺手清理同文件其他行、其他脏文件或 `packages/share` 的既有问题。
- 验证结果必须区分”本次 changed hunks 无相关诊断”和”整个文件/项目通过”。未运行全量类型检查时明确标注未验证跨文件类型关系。
- **类型嫌疑表达式**：成员链出现 `||` 兜底、字段名与 `*type.ts` / `*.d.ts` 定义不一致时，不擅自删，按 changed-hunk 约束报告为”预存问题”，由用户决定是否作为独立任务处理。

## Legacy Hook Compatibility

已有安装可能通过 `.claude/hooks/ts-es-check-gate.sh` 读取下面的配置块，因此保留原有字段。它不属于本技能的严格局部工作流，也不授权执行全量命令。本仓库没有该 hook 脚本，无法验证外部 hook 是否遵守 changed-hunk 边界。

<!-- HOOK CONFIG START
HOOK_ESLINT_ARGS="--format stylish"
# ponytail: legacy hook 没有可验证的禁用开关；--version 保留字段兼容性且不扫描项目。
HOOK_TSC_ARGS="--version"
HOOK_MAX_ATTEMPTS=3
HOOK_SRC_REGEX='^src/.*\.(vue|ts|tsx|js|jsx|mjs|cjs)$'
HOOK CONFIG END -->
