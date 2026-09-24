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
| **速查** | 一页查表 | `references/07-quick-reference.md` |

通用底层知识（无论做哪个目标都要读）：

- `references/directory-structure.md` —— 7 项固定目录的目录树与放置规则原文
- `references/file-responsibilities.md` —— 每个文件的职责、数据流、设计要点

## Required Constraints（硬约束，所有目标适用）

- **7 项目录名固定**（`index.vue` / `addOrEdit` / `apis` / `components` / `config` / `enum` / `utils`），不另起名；**即使为空也要保留**目录结构。
- 列表页只保留 `index.vue`，新增/修改/详情不放外层。
- `addOrEdit` **目录名固定**，但内部文件名不固定（可拆可合）。
- **共用放外层，独立放当前**（详见 `references/04-shared-vs-private.md`）。
- 递归嵌套 `addOrEdit` 时每层结构一致（7 项可重复）。
- **`utils/` 默认只能放 `index.ts`**（作为 barrel 重导出）。**三个例外**可独立成文件：
  1. `*.composable.ts` —— 含 vue lifecycle 钩子（`onBeforeUnmount` / `onMounted` / `watch` / `ref` 等）的纯 composable（如 `useCompanyViewTab`）
  2. `validation.ts` —— 大块 DTO 校验对齐（`FormRules` + `MAX` 常量 + `requiredNotBlank` factory，总行数 >100 行才算"大块"）
  3. `*.test.ts` —— vitest 单元测试（与 `utils/index.ts` 同目录就近放，便于 mock 与重构同步）

  其他文件（format/相关用户视图/事件总线非 composable 部分/计算工具等）一律合进 `utils/index.ts`。判定细节与反模式见 `references/file-responsibilities.md`。
- **`addOrEdit/` 顶部 header 的纯 UI 资源**（容器 class 常量、标题文案）放 `addOrEdit/config/index.ts`（与描述项 / 表单 items / 头部 actions 工厂同质）。**不建 `addOrEdit/menu/` 目录**。**触发条件**：`addOrEdit/*.vue` 出现 ≥3 行 inline 顶栏 container class 重复 + ≥2 个 .vue 复用同一标题文本。
- **`addOrEdit/components/*.vue` 的 `rules: FormRules` 抽出** → `addOrEdit/config/index.ts` 的 `getXxxFormRules(ctx)` 工厂。**触发条件**：rules ≥7 行 + 包含自定义 validator（去重 / 异步校验 / 格式正则）或依赖组件 props。验证见 `references/02-audit-page-compliance.md` 检查 11。

## Response Shape（所有目标的输出格式）

- 列出新建/改动的目录树。
- 标注每个 `apis` / `components` / `config` / `enum` / `utils` 是**共用外层**还是**独立内层**。
- 说明 addOrEdit 采用哪种文件形态（在一起 / 独立 / 某两在一起）。
- 若涉及递归嵌套，画出嵌套层级。
- 区分三类结论：`必须整改（规范违规）` / `建议优化（需需求确认）` / `无需修改（已符合规范）`——详见 `references/06-product-boundary.md`。