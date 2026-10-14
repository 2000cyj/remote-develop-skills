# 目标 11：改完必须用 remote-ts-es-check 扫描修复（强制规则）

**核心问题**：本 skill 的 8/9/10 目标改完代码后，agent 经常**忘了**跑 TypeScript/ESLint 验证；或者**偷懒**用 `npx eslint src` / `pnpm lint` / `npx vue-tsc --noEmit` 做**全项目扫描**——这两种做法都违反 `remote-ts-es-check` 的"changed hunks only"范围约束，会把不属于本次任务的问题带回来，让 diff 变臃肿、改无可改。

**本目标分两件事**：
1. **强制规则**——改完必须用 `remote-ts-es-check` 跑，且**只能**扫本 skill 改过的文件
2. **操作流程**——具体怎么调用、报告什么、命中后怎么修

---

## 1. 强制规则（最高优先级）

> **本 skill（remote-cashier-list-page-directory）改任何文件后，验收环节必须用 `remote-ts-es-check` 跑 TypeScript + ESLint 验证。**
>
> **硬约束**：
> 1. **只能用 `remote-ts-es-check`**——不传目录、`.`、glob、整个工作区文件列表。
> 2. **只能扫本 skill 改过的文件**——改了几个文件就传几个文件路径，**禁止**扩展到其他文件。
> 3. **不跑全项目扫**——禁止 `npx eslint src` / `npx eslint .` / `pnpm lint` / `npm run lint` / `npx vue-tsc --noEmit`（无 grep 过滤的全项目命令）。
> 4. **不跑 `--fix`**——会改写未编辑的代码行，违反 changed-hunk 边界。
> 5. **不擅自扩大范围**——同文件其他行 / 其他文件即使有错，只报告不修。

**违反任一条** = 本次任务验收失败，需重做。

---

## 2. 改过的文件清单怎么确定

**Step 1**：本 skill 改过的文件 = 当前对话中 agent 通过 `edit` / `write` / `mcp__idea__execute_tool` 等工具修改过的所有文件。

**Step 2**：从中筛出 lint files（`.vue` / `.ts` / `.tsx` / `.js` / `.jsx` / `.mjs` / `.cjs`）。配置文件（如 `tsconfig.json`）保留在手工修复范围，不传 ESLint。

**Step 3**：例如下列改动对应 lint files：

| 改动 | lint files |
|---|---|
| 新建 `enum/index.ts` + 改 `addOrEdit/add.vue` 加 import | `enum/index.ts`、`addOrEdit/add.vue` |
| 改 `types/index.ts` + 改 5 个引用文件 | `types/index.ts` + 5 个引用文件 |
| 删 2 个空 `apis/type.ts` 文件 | （空文件无需 lint） |
| 修 JSDoc 与代码紧贴 | 修过的 .ts 文件 |

---

## 3. 调用 remote-ts-es-check 的 3 个命令

```bash
# ESLint 只读检查（不修复）
cd "D:/OB/ob_web/packages/micro/cashier"
npx eslint <改过的 lint files> --format stylish

# 类型嫌疑主动扫描（即使 ESLint 0 报错也要做）
# 见 remote-ts-es-check §6 类型嫌疑主动扫描各项，常见 grep：
grep -nE "as\s+any|@ts-ignore|eslint-disable" <改过的文件>

# 类型检查（如必要，**必须 grep 过滤**，不能裸跑）
npx vue-tsc --noEmit 2>&1 | grep -E "<改过的文件路径>"
```

**禁止**：

```bash
# ❌ 全项目扫
npx eslint src
npx eslint .
pnpm lint
npm run lint

# ❌ 跑 --fix 改未编辑代码
npx eslint <file> --fix

# ❌ 裸跑类型检查（无法限制到 changed files）
npx vue-tsc --noEmit
```

---

## 4. 命中后处理流程

```
1. 看到 ESLint 报错 → 读 errors 行号
2. 判断是否在本任务 changed hunk 内
   - 是 → 手工最小修复（不跑 --fix）
   - 否 → 单独报告"预存问题"，**不修**
3. 改完重跑 1 次 ESLint 确认 0 错
4. 输出报告：本次改的 N 个文件全部 0 ESLint 错 / 类型检查结果
```

**报告模板**：

```
[验收] 改过的 4 个文件
  - src/pages/company/enum/index.ts
  - src/pages/company/addOrEdit/enum/index.ts
  - src/pages/company/components/CompanyStoreModal.vue
  - src/pages/company/addOrEdit/add.vue
命令: npx eslint <4 files> --format stylish
结果: ✓ 0 errors
类型检查: npx vue-tsc --noEmit | grep -E "company/"
结果: ✓ 0 errors
```

---

## 5. 边界情况处理

| 场景 | 决策 |
|---|---|
| 改了 1 个文件但 1+ 同目录未改的文件已有 ESLint 错 | 只扫改过的 1 个文件，**不**顺手修同目录其他文件 |
| 改了 5 个文件，其中 1 个是空文件 | 5 个都扫（空文件 eslint 通过 0 错） |
| 改了 5 个文件，其中 2 个是 `references/*.md` | 3 个 lint files（`.ts` / `.vue`），2 个 .md 不传 |
| 用户明确要求全项目验证 | 跑 `npx vue-tsc --noEmit` 但**必须标注"全项目范围"**，且仍只修本次任务 changed hunks |
| 改了 Java 后端代码（不在本 skill 范围） | 走 `remote-cashier-java-standard` 流程，不调本 skill 的 remote-ts-es-check |

---

## 6. 验收检查清单（每次改完必跑）

- [ ] 我列出了本任务**实际改过的**所有文件清单
- [ ] 我筛出了 lint files（`.vue` / `.ts` / `.tsx` / `.js` / `.jsx` / `.mjs` / `.cjs`）
- [ ] 我跑了 `npx eslint <lint files> --format stylish`（不传目录、`.`、glob）
- [ ] ESLint 0 错，或者我手工最小修复到 0 错（**不跑 --fix**）
- [ ] 我跑了类型嫌疑主动扫描（grep `as any` / `@ts-ignore` / `eslint-disable` / import 后未使用）
- [ ] 必要类型检查：`npx vue-tsc --noEmit 2>&1 | grep <本任务文件>` 0 错
- [ ] 报告里**明确列出**改了哪 N 个文件 + 0 错结论

---

## 7. 反模式（不要做）

- ❌ **"跑下全项目 ESLint 看看"**——`npx eslint src` / `pnpm lint` 都是禁止命令
- ❌ **"用 `--fix` 一键修"**——会改写未编辑代码，违反 changed-hunk 边界
- ❌ **"顺手改下同目录其他文件的错"**——超出本任务范围
- ❌ **"不跑 ESLint，vue-tsc 一下过就行"**——vue-tsc 不能限制到 changed files
- ❌ **"远程跑一次全项目类型检查更稳"**——违反"不能扫描其他文件"硬约束
- ❌ **"ESLint 跑了 5 个文件有 0 错就交付"**——还要做类型嫌疑主动扫描

---

## 8. 与其他 reference 的关系

- **`remote-ts-es-check/SKILL.md`**：本目标的核心约束完全来自此 skill。改完代码 → 调它扫 changed files → 报告 0 错
- **目标 8/9/10 验收检查清单**（各 references 文档）：每个目标的验收清单最后一步都应引用本目标的"必跑 remote-ts-es-check"约束
- **`04-shared-vs-private.md`**：归属判定后，落地时同样要走本目标的 ESLint 验证流程
- **`08-appendix-remediation.md` 步骤 5**（`remote-ts-es-check` 验证）已部分覆盖本目标，但只覆盖"扫一遍"场景；本目标覆盖"每次改完必跑"

---

## 9. 为什么强制这条规则

**事件回放**（2025-01 实际发生）：
- agent 改完 `types/index.ts` 集中 44 个 type 后，**没跑 ESLint**，把 5 个 TS7053 路径错位 + 7 个 import 路径少一层带进 release
- agent 改 add.vue formRules 时**跑了** `npx eslint src/pages/`（**全目录扫**），把 6 个无关文件的既有错都修了，diff 从 12 文件膨胀到 18 文件
- agent 改完后**跑了 `--fix`**，把未编辑的 `addOrEdit/apis/index.ts` 多空行格式改了，但那是 user 既有风格

**三条事故**都违反 `remote-ts-es-check` 核心约束。本目标把这些事故**显式禁止**写进规范。

**原则**：
- 改完 → 必扫 changed files
- 扫 → 不超范围
- 修 → 不 --fix
- 报 → 明确清单
