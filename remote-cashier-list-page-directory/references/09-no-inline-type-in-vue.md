# 目标 9：禁止在 .vue / .ts 顶层声明 type/interface，集中到就近 `types/index.ts`（预防规范）

**核心问题**：业务代码里常见"在 .vue 顶层 `<script setup>` 块内 / .ts 顶层声明 `interface FormState` / `type ViewTabKey` / `interface BiUserOption`"——这种 type/interface 本应集中到就近 `types/index.ts`，却散在 10 个文件里，重复定义 + 跨文件难找 + 无法用 `paths`/`as const` 共享。

**本目标分两件事**：
1. **规范定义**（预防）——以后 type/interface 必须集中到就近 `types/index.ts`
2. **现状补救**（一次性清理）——已存在的散落 type 一次性集中（详 `references/09-appendix-remediation.md`）

---

## 1. 规范定义（**核心**）

### 1.1 规则原文

> **禁止**在 `src/pages/**/*.vue` 顶层 `<script setup>` 块内 / `src/pages/**/*.ts` 顶层声明 `interface` 或 `type` 业务类型。
>
> 违反本规则的 type/interface 必须**就近**集中到当前业务块或子目录的 `types/index.ts`。
>
> 不允许"为了简单先放 .vue / 当前 .ts"——首次写代码就该放对位置。

**例外**（保留在原文件）：
- 全局共享类型（`@/common/types/*`）——跨业务块共用，已在 share 包集中
- 第三方库类型（`VxeGridPropTypes` / `ElTableProps` 等）——用 `import type` 引入
- 简单 helper type 且仅 1 行（如 `type Mode = "view" | "edit"`，且是局部 string union）—— 见 1.3

### 1.2 哪些写法算违规（必拆）

**8 种违规模式**（与 company 模块 44 个集中点完全对应）：

| 违规模式 | 示例 | 提取到 |
|---|---|---|
| **.vue `<script setup>` 顶层 `interface FormState`** | `interface FormState { companyName: string, ... }` | 就近 `types/index.ts` |
| **.vue 顶层 `interface BiUserOption` / `FileEntry`** 等页面组件子类型 | `interface BiUserOption { id: number, name: string }` | 就近 `types/index.ts` |
| **.vue 顶层 `type ViewTabKey = ...`** string union 引用其他 enum | `type ViewTabKey = typeof VIEW_TABS[number]["key"]` | 就近 `types/index.ts`（依赖项要解耦，见 1.5） |
| **.ts 顶层 `interface CashierEmployeeListItem`** 等辅助下拉 DTO | `interface CashierEmployeeListItem { ... }` | 就近 `types/index.ts` |
| **.ts 顶层 `type ElTagType = "primary" \| ...`** | `type ElTagType = "primary" \| "success" \| ...` | 就近 `types/index.ts` |
| **apis/type.ts 散落 DTO/VO**（业务主类型） | `interface Company { ... }` 等 11 个 | 业务块根 `types/index.ts` |
| **addOrEdit/apis/type.ts 散落 DTO/VO**（辅助下拉类型） | `interface CompanySavePayload { ... }` 等 9 个 | 业务块根 `types/index.ts`（按 A 选项统一）**或** `addOrEdit/types/index.ts`（按 B 选项，仅内层） |
| **config/index.ts 顶层 `type TableColumn<T>`**（与第三方库集成） | `type TableColumn<T> = VxeGridPropTypes.Column<T> & {...}` | 就近 `types/index.ts` |
| **utils/companyEventBus.ts 顶层 `interface Events` + `type CompanyViewTab` + `const COMPANY_TAB_PERM`**（事件总线强类型） | `interface Events { "company:view-tab": CompanyViewTab }` | 就近 `types/index.ts` |

### 1.3 哪些不违规（保留）

| 模式 | 示例 | 原因 |
|---|---|---|
| 全局共享类型 import | `import type { FileUploadRecordVO } from "@/common/types/shared"` | share 包已集中 |
| 第三方库类型 import | `import type { VxeGridPropTypes } from "vxe-table"` | 库自带 .d.ts |
| `import type { Foo } from "./types"` | 引用就近 types 的合规 import | 这是合规用法 |
| 局部 1 行 helper type（仅 string union） | `type Mode = "view" \| "edit"` 且仅 1 个 .vue 用 | YAGNI，不为 1 个 union 新建 types 文件 |
| 局部 enum 风格字面量（→ 归目标 8 管） | `const FOO_OPTIONS = [...] as const` | 由 `08-no-inline-enum-in-vue.md` 管辖，不在本目标 |
| 注释里的 type 描述 | `/** @param {string} name */` | JSDoc 注释非 TS 类型 |

**判定口诀**：
1. 这是 TS `interface` / `type` 声明（不是 import / 函数 / const / enum）？**是** → 违规
2. 是 share/第三方 import？**是** → 不违规
3. 是 1 行 string/number union 且仅 1 个文件用？**是** → 不违规（YAGNI）
4. 其他 → **就近 `types/index.ts`**

### 1.4 归属判定（提取到哪个 types/）

按目标 4「共用放外层、独立放当前」+ 用户授权范围（A vs B）：

| type/interface 被调用方 | 归属 |
|---|---|
| 仅 addOrEdit 内 1 个 .vue 用 | **内层** `addOrEdit/types/index.ts`（B 选项）**或** **外层** `types/index.ts`（A 选项，用户授权的"全部"覆盖） |
| addOrEdit 内 2+ 个 .vue 用 + 列表页用 | **外层** `types/index.ts` |
| 仅列表页（外层 index.vue）用 | **外层** `types/index.ts` |
| 被其他业务模块 import | **外层** `types/index.ts`（再考虑是否提到 `@/common/types`） |
| 与 mitt / pinia / vue-router 等库强类型集成（Events / RouteRecordRaw 包装） | **外层** `types/index.ts`（集中便于库强类型约束） |

**A vs B 选项**（用户授权决定范围）：
- **A 选项（推荐）**：所有 type/interface 全部集中到业务块根 `types/index.ts`，**包括 apis/type.ts + addOrEdit/apis/type.ts 里的 DTO/VO**。
  - 优点：单一入口，调用方不需要在 3 个 type 文件间切换
  - 缺点：`apis/type.ts` 变成"瘦壳"，只剩 `import type { ... } from "../types"` re-export（向后兼容可选）
  - 适用：业务块首次集中化、追求"一处改全处生效"
- **B 选项（保守）**：仅 .vue 顶层 + config/utils 散落的 type 集中；`apis/type.ts` + `addOrEdit/apis/type.ts` 保留 DTO 定义。
  - 优点：与传统 04 规范对齐（业务主类型放 `apis/type.ts`）
  - 缺点：types/index.ts 仍要 import 反向依赖
  - 适用：与既有 04 规范严格对齐、不希望破坏 DTO 归属约定

**company 模块 2026-10-14 选用 A**（44 个全部集中到一个 `types/index.ts`），符合用户原话"所有的类型对象全部放到 types/index.ts 下面"。

**grep 实操**：

```bash
# 看某 type X 的所有调用方（用 word boundary 避免匹配到 Xxx）
grep -rln "\bX\b" src/pages/<业务块>/ --include="*.vue" --include="*.ts" | grep -v "types/index.ts"
```

### 1.5 写法规约（写入就近 types 的姿势）

**API 风格**（与 08 enum 一致）：

```ts
// src/pages/<业务块>/types/index.ts 末尾追加
/**
 * 业务主类型 / 列表分页/筛选 DTO / 列表批量操作 DTO / ...
 *  ponytail: 从 <原文件路径> 提取
 *  ponytail: 与 <xxx 库> 强类型集成（如果涉及）
 */
export interface X {
  prop1: string
  // ...
}
```

**姿势要点**：
- **写 `ponytail: 从 XX 提取` 注释**（给后人留轨迹，避免反向搬回原文件）
- 章节分隔用 `/* ── 章节名 ── */` 注释，便于人读
- 跨文件 import（如 `VxeGridPropTypes` / `FileUploadRecordVO`）放文件**头部** import 段
- 库强类型集成（如 mitt `<Events>`）要解耦：types 不反向依赖 enum/，用 `import type` 形式
- 与第三方库强类型不兼容时（如 `ts/consistent-type-definitions` 要求 `interface` 但 mitt 要求 `type`）——**局部 `// eslint-disable-next-line`** 而不是改全局规则

**命名约定**：
- 业务主类型 / DTO / VO：PascalCase（`Company` / `CompanySavePayload` / `FileUploadRecord`）
- string union type alias：PascalCase + 描述性后缀（`CompanyStatus` / `TaxpayerType` / `CompanyViewTab`）
- 事件总线 type alias：`Events`（与 mitt 约定一致）
- 跨页表单状态拆分：`AddFormState` + `EditOrCheckFormState`（按 .vue 文件名拆，避免同名冲突）
- 强类型依赖第三方库：`type X = Y + Z` 形式（如 `type TableColumn<T> = VxeGridPropTypes.Column<T> & {...}`）

**FormState 拆分原则**（同名 form 跨 add + edit 页面时）：
- add 页无 `id?` / `uniqueValue?` → `AddFormState`
- editOrCheck 页有 `id?` / `uniqueValue?` + 字段允许 `string | number | undefined`（后端回填） → `EditOrCheckFormState`
- 即使两个结构几乎一致，**不合并**——保留 2 个独立 interface 防止 add 页误用 edit 字段

---

## 2. 验收检查清单（新增/修改 .vue / .ts 时必跑）

每次新建或修改 .vue 顶层 `<script setup>` 块 / .ts 顶层声明后，问自己：

- [ ] 我是否在 .vue 里写了 `interface X { ... }` / `type X = ...`？**是** → 提取到就近 types/
- [ ] 我是否在 apis/index.ts / config/index.ts / utils/index.ts 顶层声明了新 type？**是** → 提取到就近 types/
- [ ] 如果必须保留（如 1.3 例外 4 的 1 行 union），理由是？**留白**——业务代码无正当理由
- [ ] import 段是否合并到已有的 `from "./types"` / `from "../types"`？**是** → 不要新建重复 import 段
- [ ] 删除原文件里的 `interface`/`type` 块时，是否连带删了关联注释 + 空行？**是** → 否则 ESLint 报 no-multiple-empty-lines
- [ ] 库强类型集成（如 mitt Events）是否满足 `Record<EventType, unknown>` 约束？**是** → 用 `type` 不用 `interface`，必要时局部 `// eslint-disable-next-line ts/consistent-type-definitions`
- [ ] add + edit 页面共用 FormState 拆 2 个了吗？**是** → `AddFormState` / `EditOrCheckFormState`

---

## 3. 自动化检查（pi 编辑时）

agent 在编辑 .vue 或 .ts 文件后，自动跑：

```bash
# 扫所有 .vue <script setup> 顶层 interface/type 声明
# 用 ctx_execute 跑，参考附录 A 脚本
cd micro/cashier && ctx_execute "
const fs = require('fs');
const path = require('path');
// ... (附录 A 完整脚本)
"
```

**命中后处理流程**：
1. 报告给用户：「X.vue 第 N 行检测到 inline `interface Y` / `type Y`」
2. **不擅自修改**——询问用户是否集中；用户确认后按 1.4 归属判定集中（A 或 B 选项）

---

## 4. 反模式（不要做）

- ❌ "为了简单先放 .vue"——首次就该放对位置
- ❌ "反正只有 1 个调用方"——单调用方也是就近 types 判定依据
- ❌ 把所有 type 都搬到 `@/common/types`——就近 types 才是规范
- ❌ 保留旧 .ts 文件 re-export 兼容——直接删，pages 内 TS 单步构建
- ❌ 删 import 时漏看是否还有别处用——先 grep 再删
- ❌ apis/type.ts + addOrEdit/apis/type.ts 保留 DTO 但 .vue 顶层 type 已集中（B 选项不一致）——必须 A 或 B 二选一到底
- ❌ 跨 add + edit 页面的 FormState 合并成 1 个 `FormState` 共享——拆 2 个 `AddFormState` / `EditOrCheckFormState`
- ❌ types/index.ts 反向依赖 `./enum`（如 `type ViewTabKey = typeof VIEW_TABS[number]["key"]`）——解耦，用 `type ViewTabKey = CompanyViewTab`
- ❌ 用 `interface` 写 mitt 强类型 `Events`（不满足 `Record<EventType, unknown>` 约束）——用 `type` 形式
- ❌ 跑 `npx eslint src/pages/<业务块>/` 整目录——只跑本次改的文件
- ❌ `import type { X } from "./types"` 后又 `import type { X } from "./apis/type"`（重复 import）——保留 1 个
- ❌ types/index.ts 头部加 `import { ... } from "./enum"`（反向依赖）——应从 enum 反向引 type，或把 type 留 types 不引 enum

---

## 5. 与其他 reference 的关系

- **目标 2（审查）**：扫出 "inline type/interface 未集中" 违规（新增检查项 12：扫 .vue 顶层 interface/type + 扫 apis/type.ts / config/index.ts / utils/*.ts 顶层 interface/type）
- **目标 3（重构）**：路径 1-7 讲单文件挪位；目标 9 是"批量集中"专项
- **目标 4（归属）**：1.4 节归属判定直接复用（A vs B 选项）
- **目标 8（enum 风格）**：本目标与目标 8 是兄弟规范——目标 8 管 enum 字面量，本目标管 type/interface
- **04-shared-vs-private.md**：「步骤 3 判 attribute（type / interface）」段落已被本目标覆盖；A 选项下 `apis/type.ts` 退化为 re-export 壳

**一次性历史清理**（把现状已存在的散落 type 集中掉）见附录 `references/09-appendix-remediation.md`——只有在收到"扫一遍 src/pages 把 inline type 全集中了"这类指令时才执行，**不作为新代码规范的一部分**。

---

## 6. 实战案例（company 模块 2026-10-14 集中化）

**集中前散落**（10 个文件 39+ 个 type）：
- `apis/type.ts`：7 type alias（CompanyAttributionType/Status/TaxpayerType/TaxStatus/BusinessStatus/ArchiveStatus/TaxPeriod）+ 11 interface（Shareholder/Company/...）
- `addOrEdit/apis/type.ts`：9 DTO/VO（CompanySavePayload/ShareholderItem/...）
- `apis/index.ts` + `addOrEdit/apis/index.ts`：7 辅助 DTO
- `addOrEdit/add.vue` + `addOrEdit/editOrCheck.vue`：3 interface（FormState 拆 2 个 + BiUserOption + FileEntry）
- `config/index.ts`：`type TableColumn<T>`
- `utils/companyEventBus.ts`：`interface Events` + `type CompanyViewTab` + 关联 const
- `utils/index.ts`：`type ElTagType`
- `addOrEdit/config/bankCardOptions.ts`：`interface BankCardOption`
- `index.vue`：`type ViewTabKey`

**集中后**（单一 `types/index.ts`，44 export）：
- 7 章节：基础枚举 7 / 实体与共享子类型 6 / 关联子表 1 / 列表分页/筛选 3 / 列表批量操作 1 / 保存/详情 DTO 9 / 辅助下拉 7 / 页面表单 2 / 公共组件子类型 2 / 配置/工具辅助 6
- 957 行 / 0 重名 / 0 残留 / 0 ESLint 错 / 0 vue-tsc 错

**踩过的坑**（避免再犯）：
1. 路径算错：addOrEdit 下的文件实际只 `../types`，不是 `../../types`（同级上一级）
2. 多行 `type X = | "a" | "b"` 没 `;`，自动提取会吞到下一个 decl
3. interface 块不满足 mitt 的 `Record<EventType, unknown>` 约束 → 改 `type` 字面量
4. `getPushRoute()` 是 0 参返回函数，调用是 `getPushRoute()({...})`
5. `RouteInfo` 只接 `path` + `query`，无 `name`/`params`
6. 删 interface 时把后续 const/let 也连带删了 → companyEventBus 的 `emitter/KEY/latestTab/COMPANY_TAB_PERM` 全没了 → 完整重写
