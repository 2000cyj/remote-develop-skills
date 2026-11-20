# edited-file-workflow

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

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
