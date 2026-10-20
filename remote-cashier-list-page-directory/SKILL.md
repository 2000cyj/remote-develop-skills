---
name: remote-cashier-list-page-directory
description: Use when 在 src/pages/ 下新建或改造页面/业务模块目录、组织新增/修改/详情表单页、确定 apis/components/config/enum/utils 的归属、判定共用放外层与独立放当前，确保所有页面目录结构一致；或 prompt 中出现显式触发短语「使用 oboweb 规范」「按 oboweb 规范组织」「按 oboweb 规范改造」中的任意一个、并伴随对 src/pages/ 下页面/业务模块目录的新建或改造描述。
---

# Cashier List Page Directory

**本文件是入口，不含规范正文。** 规范正文只在 `references/02-audit-page-compliance.md` 的「声明种类 → 归属目录」表里，见 [[单一真源]]。

## 显式触发短语

`使用 oboweb 规范` / `按 oboweb 规范组织` / `按 oboweb 规范改造` —— 任一出现即命中本 skill。命中后 prompt 仍需描述具体的页面目录新建或改造任务；只有短语没有任务时，反问澄清，不要默认加载。

## 目标速查

| 目标 | 何时读 | 文档 |
|---|---|---|
| 目标 1：建新页面 | 从 0 到 1 搭业务模块目录 | `references/01-create-new-page.md` |
| **目标 2：审查现有页面合规性** | 检查模块目录是否合规 | **`references/02-audit-page-compliance.md`（规范真源）** |
| 目标 3：重构/迁移现有页面 | 把不合规目录改成合规 | `references/03-refactor-page.md` |
| 目标 4：apis/components/config/enum/utils 归属 | 仅内层用 vs 业务块共用 | `references/04-shared-vs-private.md` |
| 目标 5：递归嵌套 addOrEdit | 表单页内还有嵌套表单页 | `references/05-nested-addoredit.md` |
| 目标 6：判断规范 vs 产品 vs 业务事实 | 该不该改、改动是否在范围内 | `references/06-product-boundary.md` |
| 目标 8：禁止 .vue 顶层 enum 风格变量 | enum 违规的 9 种模式 | `references/08-no-inline-enum-in-vue.md` |
| 目标 9：禁止 .vue/.ts 顶层 type/interface | type 违规的 8 种模式 | `references/09-no-inline-type-in-vue.md` |
| 目标 10：JSDoc 与代码之间不留空行 | doc/code 紧贴规则 | `references/10-no-blank-line-between-doc-and-code.md` |
| 目标 11：改完必须用 `remote-ts-es-check` | **强制，所有目标适用** | `references/11-must-use-remote-ts-es-check.md` |
| **目标 12：优先复用 share 包组件** | 写组件/组合式函数之前 | `references/12-prefer-share-package-components.md` |
| 一次性批量整改 enum | 收到「把 inline enum 全提取了」 | `references/90-remediation-enum-playbook.md` |
| 一次性批量整改 type | 收到「把 type 全搬到 types/」 | `references/91-remediation-type-playbook.md` |
| 速查表 | 一页查表 | `references/07-quick-reference.md` |

底层知识：`references/directory-structure.md`（目录树）、`references/file-responsibilities.md`（文件职责）。
事故与维护流程：`CHANGELOG.md`。

## 单一真源（读规范前先记住这条）

**规范正文只写在 `references/02-audit-page-compliance.md`。** 本文件与 `07-quick-reference.md` 只放链接。

遇到「SKILL.md 说的」和「reference 说的」不一致时，**以 `02-audit-page-compliance.md` 为准**。

## 硬约束（不含细则，细则见 reference）

1. **7 项目录名固定**：`index.vue` / `addOrEdit/` / `apis/` / `components/` / `config/` / `enum/` / `utils/` / `types/`。不另起名。
2. **列表页只保留 `index.vue`**，新增/修改/详情放 `addOrEdit/`。
3. **共用放外层，独立放当前**（细则见 `04-shared-vs-private.md`）。
4. **递归嵌套 `addOrEdit` 每层结构一致**（7 项可重复）。
5. **`utils/` 默认只能放 `index.ts`**（细则与 3 个例外见 `02-audit-page-compliance.md` 检查 8）。
6. **改完必须用 `remote-ts-es-check` 验证**，只能扫本次改过的文件（细则见 `11-must-use-remote-ts-es-check.md`）。
7. **搬动任何字面量值前必须 `git show HEAD:<file>` 拿原值**，搬完 diff 验证，不一致立即停并问 user（细则见 `02-audit-page-compliance.md`「数据搬运保护」）。
8. **写组件前先查 share 包 `@ob-web/share`**：share → `@ob-common`/`common/` → 本块 `components/`，三级都无才允许写（细则见 `12-prefer-share-package-components.md`）。

## 审查方法（唯一正确做法）

**逐文件 read，列出每条顶层声明，查归属表，比对实际位置。**

```
1. 列业务块的目录树
2. 逐个文件 read（不是 grep），列出里面每一条顶层声明
3. 每条查 02 的「声明种类 → 归属目录」表 → 得到应属目录
4. 与实际位置对比 → 不同 = 违规
```

**不要用 grep 找违规。** grep 命令只匹配写法，接口名有规律、接口名没有规律——写命令必然漏检。历史上 5 次漏检全部由此产生（见 `CHANGELOG.md`）。

变量叫什么名字不改变它应该去哪个目录。`rules` 和 `formRules` 都是 FormRules；`ShopFormValue` 和 `StoreFormState` 都是 type。

## Response Shape

- 列出新建/改动的目录树。
- 标注 `apis` / `components` / `config` / `enum` / `utils` 是**共用外层**还是**独立内层**。
- 说明 addOrEdit 的文件形态（在一起 / 独立 / 某两在一起）。
- 区分三类结论：`必须整改（规范违规）` / `建议优化（需需求确认）` / `无需修改（已合规）`。
