---
name: remote-cashier-list-page-directory
description: Use when 在 src/pages/ 下新建或改造页面/业务模块目录、组织新增/修改/详情表单页、确定 apis/components/config/enum/utils 的归属、判定共用放外层与独立放当前，确保所有页面目录结构一致；或 prompt 中出现显式触发短语「使用 oboweb 规范」「按 oboweb 规范组织」「按 oboweb 规范改造」中的任意一个、并伴随对 src/pages/ 下页面/业务模块目录的新建或改造描述。
---

# Cashier List Page Directory

本 skill 主入口只放**触发与目标速查**。每个目标的具体执行细节见 `references/<编号>-<目标>.md`。

## 显式触发短语（用户约定触发器）

为了让团队成员在不方便显式说目录范围时也能稳定触发本 skill，约定以下三类显式触发短语（出现任意一个即视为命中本 skill 的触发条件，无需再额外指定 `src/pages/` 路径前缀）：

- `使用 oboweb 规范`
- `按 oboweb 规范组织`
- `按 oboweb 规范改造`

命中后，紧随其后的 prompt 仍需描述具体的页面/业务模块目录新建或改造任务（如"帮我建 XX 页面" / "重构 XX 列表页目录" / "组织 XX 模块的目录结构" 等）。仅触发短语而无具体任务描述时，应向用户反问澄清，不要默认加载本 skill。

> 该约定来自团队内部对"如何稳定触发前端列表目录规范"的讨论记录，与 `remote-cashier-java-standard` 的「oboJava 规范」触发机制同源。目的是降低误报（不强制要求每次都说目录前缀）+ 提高稳定性（即使 prompt 中省略 `src/pages/` 也能命中）。本 skill 适用范围（`src/pages/` 下页面目录结构）保持不变。

## 目标速查表

按用户实际目标直接进入对应文档，**不必读完所有 references**：

| 目标 | 何时读 | 文档 |
|---|---|---|
| **目标 1：建新页面** | 从 0 到 1 搭一个全新业务模块目录 | `references/01-create-new-page.md` |
| **目标 2：审查现有页面合规性** | 检查某模块目录是否合规，列出违规项 | `references/02-audit-page-compliance.md` |
| **目标 3：重构/迁移现有页面** | 把不合规目录改成合规 | `references/03-refactor-page.md` |
| **目标 4：判断 apis/components/config/enum/utils 归属**（**最高频**） | 仅内层用 vs 业务块共用——具体场景判定 | `references/04-shared-vs-private.md` |
| **目标 5：递归嵌套 addOrEdit** | 表单页内还有嵌套表单页 | `references/05-nested-addoredit.md` |
| **目标 6：判断规范 vs 产品 vs 业务事实** | 是否该改动？该改动是否在 skill 范围内？ | `references/06-product-boundary.md` |
| **目标 8：禁止在 .vue 顶层定义 enum 风格变量**（**预防规范**） | 枚举违规的 9 种模式（含 columns/formRules）+ 静态数据集合 vs 业务逻辑判定 + 验收检查清单 + 反模式 + 3 个实战案例 | `references/08-no-inline-enum-in-vue.md` |
| **目标 9：禁止在 .vue/.ts 顶层声明 type/interface，集中到就近 `types/index.ts`**（**预防规范**） | type/interface 违规的 8 种模式 + A/B 选项归属判定 + 验收检查清单 + 反模式 + company 实战案例 | `references/09-no-inline-type-in-vue.md` |
| **目标 10：JSDoc 注释和被注释代码之间不允许空行**（**预防规范**） | doc 与 code 紧贴规则 + 适用对象 + 4 种例外 + perl 一行命令自动修 + 实战案例 | `references/10-no-blank-line-between-doc-and-code.md` |
| **目标 11：改完必须用 `remote-ts-es-check` 扫描修复**（**强制规则**，所有目标适用） | 只能扫本 skill 改过的文件 + 禁止全项目扫 + 禁止 --fix + 验收检查清单 + 命中处理流程 + 3 事故回放 | `references/11-must-use-remote-ts-es-check.md` |
| **速查** | 一页查表 | `references/07-quick-reference.md` |

通用底层知识（无论做哪个目标都要读）：

- `references/directory-structure.md` —— 7 项固定目录的目录树与放置规则原文
- `references/file-responsibilities.md` —— 每个文件的职责、数据流、设计要点

## Required Constraints（硬约束，所有目标适用）

- **7 项目录名固定**（`index.vue` / `addOrEdit` / `apis` / `components` / `config` / `enum` / `utils`），不另起名；**即使为空也要保留**目录结构。
- 列表页只保留 `index.vue`，新增/修改/详情不放外层。
- `addOrEdit` **目录名固定**，但内部文件名不固定（可拆可合）。
- **共用放外层，独立放当前**（详见 `references/04-shared-vs-private.md`，**components 跨页判定走强证据 grep**：grep 真 import 路径，**不接受** doc 注释提及；详见 `references/02-audit-page-compliance.md` 检查 5a）。
- 递归嵌套 `addOrEdit` 时每层结构一致（7 项可重复）。
- **`utils/` 默认只能放 `index.ts`**（作为 barrel 重导出）。**三个例外**可独立成文件：
  1. `*.composable.ts` —— 含 vue lifecycle 钩子（`onBeforeUnmount` / `onMounted` / `watch` / `ref` 等）的纯 composable（如 `useCompanyViewTab`）
  2. `validation.ts` —— 大块 DTO 校验对齐（`FormRules` + `MAX` 常量 + `requiredNotBlank` factory，总行数 >100 行才算"大块"）
  3. `*.test.ts` —— vitest 单元测试（与 `utils/index.ts` 同目录就近放，便于 mock 与重构同步）

  其他文件（format/相关用户视图/事件总线非 composable 部分/计算工具等）一律合进 `utils/index.ts`。判定细节与反模式见 `references/file-responsibilities.md`。
- **`addOrEdit/` 顶部 header 的纯 UI 资源**（容器 class 常量、标题文案）放 `addOrEdit/config/index.ts`（与描述项 / 表单 items / 头部 actions 工厂同质）。**不建 `addOrEdit/menu/` 目录**。**触发条件**：`addOrEdit/*.vue` 出现 ≥3 行 inline 顶栏 container class 重复 + ≥2 个 .vue 复用同一标题文本。
- **`addOrEdit/components/*.vue` 的 `rules: FormRules` 抽出** → `addOrEdit/config/index.ts` 的 `getXxxFormRules(ctx)` 工厂。**触发条件**：rules ≥7 行 + 包含自定义 validator（去重 / 异步校验 / 格式正则）或依赖组件 props。验证见 `references/02-audit-page-compliance.md` 检查 11。
- **`addOrEdit/*.vue` 顶层 `rules: FormRules` 抽出**（详见 `references/04-shared-vs-private.md`「FormRules 抽离位置决策」段，**就近原则**）：
  - **默认** → `addOrEdit/config/index.ts` 作 `EDIT_OR_CHECK_FORM_RULES`（离 .vue 最近的目录，纯静态 formRules）
  - **特例** → `addOrEdit/enum/index.ts` 作 `COMPANY_ADD_FORM_RULES`（仅当 formRules 引用 `createDictionaryEnum` 等 enum 工厂 / 跨页共享字段名）
  - **判定公式**：grep formRules 体内是否 import 自 `../enum` / 引用 enum 工厂 → 是 = enum；否 = config
  - **公司模块实战**：add.vue → enum（`COMPANY_ADD_FORM_RULES`，与字典共享字段名）作为允许特例；editOrCheck.vue → config（`EDIT_OR_CHECK_FORM_RULES`，纯静态就近）作为默认位置。**反模式**：把纯静态 formRules 也抽到 enum = 违反就近原则，让 enum 变成大杂烩。
  - **扫描命令**（必检）：`grep -rnE "^const[[:space:]]+formRules" src/pages/<业务块>/addOrEdit/*.vue`（详见 `references/02-audit-page-compliance.md` 检查 12）
- **删定义必删 doc 三件套**（详见 `08-appendix-remediation.md` 步骤 4a，**贯穿所有提取/重构场景**）：删 const / type / interface 块时，**必须同时**删 (1) 定义块本身 (2) 定义上面的 doc comment（描述该定义的） (3) 关联空行。漏 doc = 无主注释，漏空行 = ESLint `no-multiple-empty-lines` 错。**通用规则**：适用于目标 8/9/10 的所有提取场景，不只是 enum。
- **搬动数据必 git HEAD 拿原值，diff 验证**（详见 `08-appendix-remediation.md` 步骤 4c，**数据性保护**）：搬动 `Record<KEY, value>` 字典 / 字面量数组 / 任何字面量值（字符串、数字、URL、权限码、字段名、enum 名字）→ **强约束 5 条**：(1) 权威源是 `git show HEAD:<file>`，不是 working tree 当前内容 (2) 搬动前 `git show HEAD:<file>` 拿原值 (3) 把原值复制到新位置 (4) 搬完 `diff` 验证值完全一致 (5) 任何不一致 → 立刻停，问 user。**事故 2025-01-14**：搬动 `COMPANY_TAB_PERM` 时 working tree 已经被改 `cashier:company:edit:*`，agent 照抄 → 8 个权限码全错（git HEAD 是 `gsglCheck*`）。
- **防 agent 幻觉污染**（详见 `08-appendix-remediation.md` 步骤 4d，**最高优先级**）：任何值改动先 `git show HEAD:<file>` 拿原值比对，**禁止凭 summary / 记忆 / "看起来应该这样" 写值**。agent 幻觉常见 4 模式：命名规范化幻觉 / 类型推断幻觉 / 业务合理性幻觉 / 记忆污染幻觉。**改完任何字面量值必 `git diff` 对比原值** → 任何非预期差异 = 立即回滚 + 报 user。**业务字段 / 权限码 = 后端契约，user 没让改就不动**。
- **防业务合理性幻觉**（详见 `08-appendix-remediation.md` 步骤 4e，**业务字段保护**）：tag type / el-tag color / status 颜色编码 / enum value 映射 = **后端契约**，agent 不能凭"看起来更合理"改值。**事故 2025-01-14**：搬动 `COMPANY_STATUS_TAG_MAP` 时凭业务幻觉改了 4 个颜色（`closed:warning → info`, `cancelled:info → danger`）→ el-tag 列颜色全错。**任何值修改必问 user**："git HEAD 是 X，working tree 是 Y，保留哪个？"
- **防架构变更幻觉**（详见 `08-appendix-remediation.md` 步骤 4f，**跨模块保护**）：路径 / router config / 菜单 / import 命名空间改动 = **多模块影响**，agent 不能自作主张改。**事故 2025-01-14**：`index.vue handleViewTab` 把 `/gsgl/check` 改成 `/company/edit/${uniqueValue}`（凭"架构统一"幻觉），user 之前没批准 → 跳到编辑页 → UX bug。**任何路径改动必查 router config + 主应用菜单 + git HEAD 原值**，不一致 = 立即停 + 问 user。
- **改值必问 user**（详见 `08-appendix-remediation.md` 步骤 4g，**最高优先级，覆盖所有场景**）：**任何 working tree vs git HEAD 字面量值差异 = 立即停 + 问 user**。不论差异大小（一个 value / 一个常量 / 一个数字）= 必问。**agent 不能**"看起来更对就改" / "觉得不对就改" / "应该统一" / "看起来更规范"。**默认行为**：git HEAD 是权威，working tree 当前值 = 可能是污染。3 次事故都是没问 user 就改了：cashier:company:edit / COMPANY_STATUS_TAG_MAP 4 个值 / index.vue 路径。
- **改完必跑 `remote-ts-es-check` 验证**（详见 `references/11-must-use-remote-ts-es-check.md`）：**只能扫本 skill 改过的文件**（不传目录 / `.` / glob），禁止 `npx eslint src` / `pnpm lint` / `--fix` / 裸跑 `vue-tsc --noEmit`。这是**所有目标**的通用验收环节，违反 = 任务验收失败。
- **`const X = computed(() => [...])` 包纯静态 = 反模式**（2026-10-15 补，store/ closeStoreFormItems 案例）：computed 包装必须有响应式依赖（`.value.` / `props.` / `reactive` / `ref`）才能发挥缓存/依赖追踪作用；纯静态字面量无任何依赖图 → 包装无意义。**判定顺序**（口诀：**先看 computed，再看行数**）：(1) 命中 `computed(() => [...])` + 内部无响应式依赖 → **必抽 `addOrEdit/config/` + 去 computed**（行数任意）(2) 未用 computed + 行数 ≥10 → 抽 config (3) 命中 `computed(() => ({ ...依赖 props.xxx... }))` → **不拆**。**扫描命令**：`grep -rnE "^const[[:space:]]+\w+[[:space:]]*=[[:space:]]*computed\(" src/pages/<业务块>/`（详见 `references/02-audit-page-compliance.md` 检查 5c）。

## Response Shape（所有目标的输出格式）

- 列出新建/改动的目录树。
- 标注每个 `apis` / `components` / `config` / `enum` / `utils` 是**共用外层**还是**独立内层**。
- 说明 addOrEdit 采用哪种文件形态（在一起 / 独立 / 某两在一起）。
- 若涉及递归嵌套，画出嵌套层级。
- 区分三类结论：`必须整改（规范违规）` / `建议优化（需需求确认）` / `无需修改（已符合规范）`——详见 `references/06-product-boundary.md`。