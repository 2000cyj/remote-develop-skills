# type-check-boundaries

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

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

参考签名见 `references/ts-typing.md`（TS2551 字段不存在 / TS2339 成员访问 / TS2322 类型不匹配 / TS2345 类型不匹配）+ `references/baseline-eslint.md`（TS2554 参数个数）。

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
| 修 import path 之前 grep export 位置 | **强制**（见第 4a 步） | 防 TS2305 形态 2 / 形态 4 / 形态 5 路径错位 |
| `.vue` 文件用 `@/pages/...` 绝对路径 import 业务模块 utils | **强制**（见 references/ts-typing.md "TS2307 形态"） | 避免 vue-tsc 在 `.vue` 文件处理相对路径 import 偶发失败 |
| `npx eslint <files> --rule '{"no-unused-vars":"error",...}'` | 允许（未使用代码主动扫描步骤） | CLI 加 --rule，不改 eslint.config.js；扫死代码 + 孤儿 API |
| grep `(const\|let\|function\|class)\s+_\w+\s*[=(:]` | 允许（未使用代码主动扫描步骤） | 查下划线前缀死代码逃生口 |
| 加下划线前缀 / `eslint-disable-next-line` 保留死代码 | **禁止** | 错误逃生口；死代码应直接删 |

## Error Signatures

需要定位已编辑行中的常见错误时，读取 `references/{baseline-eslint,ts-typing,reactive-errors}.md`。错误签名只帮助判断根因，不会扩大允许修改的文件或行范围；根因落在范围外时，只报告，不修复。

## Required Constraints

- 不用 `eslint-disable`、`@ts-ignore`、`any` 或修改全局配置来隐藏诊断。
- 不顺手清理同文件其他行、其他脏文件或 `packages/share` 的既有问题。
- 验证结果必须区分”本次 changed hunks 无相关诊断”和”整个文件/项目通过”。未运行全量类型检查时明确标注未验证跨文件类型关系。
- **类型嫌疑表达式**：成员链出现 `||` 兜底、字段名与 `*type.ts` / `*.d.ts` 定义不一致时，不擅自删，按 changed-hunk 约束报告为”预存问题”，由用户决定是否作为独立任务处理。

