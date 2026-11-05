# 目标 8：禁止在 .vue 顶层定义 enum 风格变量（预防规范）

> **示例说明**：本文中的变量名 / 模块名（`company` / `store` / `bankCard` 等）沿用源 skill 的历史案例，仅作**写法示意**，与 iot-web 实际模块（`device` / `product` / `protocol` / `driver` / `ota` / `rule-chain` 等）无对应关系。

**核心问题**：业务代码里常见"在 .vue 顶层 `<script setup>` 块内写 `const X_OPTIONS = [{...}] as const` / `const X_ENUM = { ... } as const`"——这种 enum 风格字面量本应放就近 `enum/index.ts`，却硬塞进页面文件，污染组件、阻碍复用。

**本目标分两件事**：
1. **规范定义**（预防）——以后 vue 页面不能再这样写
2. **现状补救**（一次性清理）——已存在的违规一次性提取（详 `references/90-remediation-enum-playbook.md`）

---

## 1. 规范定义（**核心**）

### 1.1 规则原文

> **禁止**在 `src/views/**/*.vue` 顶层 `<script setup>` 块内定义 enum 风格的字面量 const。
>
> 违反本规则的常量必须**就近**提取到当前业务块或子目录的 `enum/index.ts`。
>
> 不允许"为了简单先放 .vue"——首次写代码就该放对位置。

### 1.2 哪些写法算违规（必拆）

| 违规模式 | 示例 | 提取到 |
|---|---|---|
| `Record<KEY, value> as const` 字典对象 | `const X_ENUM = { KEY: "value" } as const` | 就近 `enum/` |
| `[{ value, label }, ...] as const` 选项数组 | `const FOO_OPTIONS = [{...}, ...] as const` | 就近 `enum/` |
| `[{ key, label, ... }, ...] as const` 列表项 | `const VIEW_TABS = [{ key, label, perm }] as const` | 就近 `enum/` |
| `Record<string, [c1, c2]>` 配色对象 | `const SECTION_COLORS = { basic: [...] }` | 就近 `enum/` |
| `[{ title, description }, ...] as const` stepper | `const STEPS = [{...}, ...] as const` | 就近 `enum/` |
| `readonly string[] as const` 字符串元组 | `const COMMON_CODES = ["a", "b"] as const` | 就近 `enum/` |
| `readonly Type[] as const` 元数据数组 | `const FIELD_POOL = [{...}] as const` | 就近 `enum/` |
| `const columns = [{ prop, label, ... }]` 表格列定义 | `const columns = [{ prop: "deviceCode", label: "设备编码" }]` | 就近 `enum/` |
| `const formRules: FormRules = { ... }` 静态表单校验规则 | `const formRules: FormRules = { field: [{ required: true, message, trigger }] }` | **就近 `config/`**（默认）/ 就近 `enum/`（仅当 formRules 引用 createDictionaryEnum 等 enum 工厂时） |
| 任意 `Record<KEY, value>` 字典对象（无类型注解） | `const SECTION_COLORS = { basic: [...], ... }` | 就近 `enum/` |

### 1.3 哪些不违规（保留）

| 模式 | 示例 | 原因 |
|---|---|---|
| 纯数字标量 | `const MAX_VISIBLE_TAGS = 2` | 业务配置常量，非字典 |
| string sentinel | `const STALE_SENTINEL = "__STALE__"` | 单值 sentinel |
| URL 常量 | `const FILE_UPLOAD_URL = "/api/..."` | 单值常量 |
| 长度上限 | `const MAX_REMARK_LENGTH = 200` | 数字配置 |
| 派生 computed | `const visible = computed(() => [...])` | 依赖 reactive 状态 |
| 函数声明 | `function sectionTitleStyle(key) {...}` | 函数不是 enum |
| enum import 自就近 enum | `import { X } from "./enum"` | 这是合规用法 |
| `function getTableColumns(options) { return [...动态拼接] }` 内部 const | 函数内动态构造（options 条件 push） | **保留**——是函数内的局部推导，不算"数据集合" |
| `function getSearchFormItems() { return [static array] }` 内部 const | 纯静态 + 显式 getter 函数包装 | 视情况：如果是单纯的 getter shell（调用方只调函数），保留 config/；如果调用方可以直接 import 数组，**提取到 enum/** |
| `const formRules = { field: [{ ..., validator: (rule, value, cb) => {...} }] }` 含 validator 闭包 | validator 是函数逻辑 | **保留**在 .vue——含闭包逻辑不算"数据集合"；提取会让闭包丢失 reactive 依赖 |

**判定口诀**：「这个 const 是 `Record<...>` 字典、`[]` 选项数组、还是跨调用方共用的字面量？」——任一为是就违规；都不是就保留。

### 1.3.5 魔法值归属优先级（先查公共，再建局部）

> 遇到散落的魔法值（`"normal"` / `"pdd"` / `1` / `"warning"` 这类**业务含义的字面量**），**先翻公共 enum，有就直接用；没有才建局部 enum**。顺序反了会造出 10 个同名局部枚举。

**判定流程**（按序，不可跳步）：

| 步 | 动作 | 命中则 |
|---|---|---|
| 1 | 翻项目公共层 `@/utils`（`src/utils/`）—— 看有没有语义**完全一致**的现成枚举 / 映射 / 字段池 | **直接 import 复用**，不建新的 |
| 2 | 翻本业务块已有 `enum/index.ts` + `types/index.ts` 里的 type（字符串字面量 union 也算） | **复用**，不重复定义 |
| 3 | 都没有 | **建局部 enum** 到就近 `enum/index.ts`，并把该魔法值在业务块内**全部**改为引用它 |
| 4 | 建完发现别的业务块也命中同样语义 | 上提到 `@/utils`（第 3 步的复用判据） |

**"公共" 指**（按复用面从小到大）：
1. `@/utils` —— 全站共享（`pageModeEnum` / `subAccountFieldPool` / `SUB_ACCOUNT_WIDGET` / `yesNoStringEnum` 等）
2. `src/views/<业务块>/enum/index.ts` —— 业务块内共享
3. `src/views/<业务块>/addOrEdit/enum/index.ts` —— 仅表单用

**建局部 enum 的 3 个必做动作**：
1. **扫全量引用**：把该字面量在本业务块内**所有**出现位置（`.vue` / `.ts` / 模板里的 `v-if="x === 'normal'"`）都改成引用，漏一处 = 后续又漂移
2. **写 ponytail 注释**：`ponytail: 从 XXX 提取；@/utils 无对应语义（对比过 X/Y/Z）`
3. **确认不是后端契约裸值**：如果字面量必须与后端枚举**逐字一致**（如 `platformCode = "pdd"`），在 enum 里保留原值 + 注释后端含义，**不得**"顺手规范化"（见目标 10 改值必问 user）

**反模式**：
- ❌ 跳过第 1 步直接在 `addOrEdit/enum/` 建同义枚举（`NORMAL_STATUS` 已有 `shopStatusEnum` 还建一遍）
- ❌ 建了 enum 但只改了一处字面量，其余仍散落 `.vue` 里
- ❌ 把业务专属枚举硬塞 `@/utils`（只有 1 个业务块用）

### 1.4 归属判定（提取到哪个 enum/）

按目标 4「共用放外层、独立放当前」：

| 变量被调用方 | 归属 |
|---|---|
| 仅 addOrEdit 内 1 个 .vue 用 | **内层** `addOrEdit/enum/index.ts` |
| addOrEdit 内 2+ 个 .vue 用 | **内层** `addOrEdit/enum/index.ts` |
| 列表页（外层 index.vue）+ addOrEdit 都有 | **外层** `enum/index.ts` |
| 被其他业务模块 import | **外层** `enum/index.ts`（再考虑是否提到 `@/utils`） |

**怎么数调用方**：逐个 read `src/views/<业务块>/` 下的 `.vue` / `.ts`，数出该符号被几个文件引用（定义文件本身不算）。只认真 import / 真调用，doc 注释里提到不算。

### 1.5 写法规约（写入就近 enum 的姿势）

```ts
// src/views/<业务块>/enum/index.ts 末尾追加
/**
 * 章节标题渐变色（company/add 页 7 个 step 标题双色渐变）
 *  ponytail: 从 company/addOrEdit/add.vue 顶层提取。
 */
export const SECTION_TITLE_COLORS: Record<string, [string, string]> = {
  basic: ["#6366f1", "#8b5cf6"],
  // ...
}
```

**姿势要点**：
- 写 `ponytail: 从 XX 提取` 注释（给后人留轨迹，避免反向搬回 .vue）
- 保持原名 export（无 alias），让 import 段简洁
- 已存在的 import 段直接合并，不要新建

---

## 2. 验收检查清单（新增/修改 .vue 时必跑）

每次新建或修改 .vue 顶层 `<script setup>` 块后，问自己：

- [ ] 我是否在 .vue 里写了 `const X = [...] as const` 或 `const X = { ... } as const`？**是** → 提取到就近 enum/
- [ ] 我是否在 .vue 里写了 `const columns = [...]` / `const formRules = { ... }` / `const steps = [...]` / `const tabs = [...]`？**是** → 提取到就近 enum/
- [ ] 如果必须保留（如函数内部局部 const），理由是？**留白**——业务代码无正当理由
- [ ] import 段是否合并到已有的 `./enum` import？**是** → 不要新建重复 import 段
- [ ] 删除原 .vue 里的定义时，是否连带删了关联注释 + 空行？**是** → 否则 ESLint 报 no-multiple-empty-lines
- [ ] template 里引用是否同步改成导出的全大写名（`columns` → `DEVICE_MODAL_COLUMNS`）？**是** → template 直接读导出名

## 2.5 静态数据集合 vs 业务逻辑（必看）

提取前用这张表判断：

| 形态 | 例子 | 决策 |
|---|---|---|
| 纯 `Record<KEY, value>` 字典 | `COMPANY_STATUS_TAG_MAP` | ✅ 必拆 enum/ |
| 纯 `[{ field, title, width }]` 静态列 | `COMPANY_STORE_MODAL_COLUMNS` | ✅ 必拆 enum/ |
| 纯 `Record<field, [{ required, message, trigger }]>` 无 validator | `COMPANY_ADD_FORM_RULES` | ✅ 必拆 `config/`（默认）/ `enum/`（仅当 formRules 引用 createDictionaryEnum 等 enum 工厂时）|
| `function getTableColumns(options) { return columns.push(...) }` | 动态 push | ❌ 保留 config/ |
| `function getTableColumns() { return [...static] }` 无动态 | 单纯 getter shell | ⚠️ 优先提取到 enum/，让调用方直接 import 数组 |
| `Record<field, [{ validator: (_, val, cb) => {...} }]>` 含 validator | SetExpirationModal 的 rules | ❌ 保留 .vue——validator 闭包依赖组件状态 |

---

## 3. 怎么检查（pi 编辑时）

**逐文件 read，列出每条顶层声明，查 `02-audit-page-compliance.md` 的归属表。** 不提供扫描脚本——命令只匹配写法，接口名有规律、接口名没有规律，用命令必然漏检（见 `CHANGELOG.md` 事故 1）。

**命中后处理流程**：
1. 报告给用户：「X.vue 第 N 行有 inline enum 风格 `Y = {...} as const`」
2. **不擅自修改**——询问用户是否提取；用户确认后按归属判定提取

## 4. 反模式（不要做）

- ❌ "为了简单先放 .vue"——首次就该放对位置
- ❌ "反正只有 1 个调用方"——单调用方也是内层 enum 判定依据
- ❌ 顺手把 `MAX_*` 数字标量也搬进 enum/——非 enum 风格，YAGNI
- ❌ 全部 enum 提到 `@/utils`——就近 enum 才是规范
- ❌ 保留旧 .vue 文件 re-export 兼容——直接删，pages 内 TS 单步构建
- ❌ 删 import 时漏看是否还有别处用——先全局搜符号名再删
- ❌ 跑 `npx eslint src/views/<业务块>/` 整目录——只跑本次改的文件
- ❌ 删 const 块时**只删定义不删 doc**——`/** xxx value -> el-tag type */` 描述的是 const，const 没了 doc 成了无主注释。详情见 `90-remediation-enum-playbook.md` 步骤 4a。
- ❌ **formRules 抽错位置**（违反就近原则）：把纯静态 formRules（不引用 enum 工厂）也抽到 enum——默认应放就近 `addOrEdit/config/`，放 enum 会让 enum 变成"字典+校验规则+状态码"大杂烩。仅在 formRules 引用 `createDictionaryEnum` 等 enum 工厂时（与字典字段名强耦合），才放 enum。判定决策见 `04-shared-vs-private.md`「FormRules 抽离位置决策」段。

---

## 5. 与其他 reference 的关系

- **目标 2（审查）**：第 9 项检查项扫出 "inline enum 未拆" 违规
- **目标 3（重构）**：路径 1-7 讲单文件挪位
- **目标 4（归属）**：1.4 节归属判定直接复用
- **04-shared-vs-private.md 模式 1**：描述了 inline 枚举选项数组违规

**一次性历史清理**（把现状已存在的违规提取掉）见附录 `references/90-remediation-enum-playbook.md`——只有在收到"扫一遍 src/views 把 inline enum 全提取了"这类指令时才执行，**不作为新代码规范的一部分**。

---

## 6. 实战案例（columns + formRules 数据集合提取）

**触发**：user 在模块扫描时明确要求「columns / 数组 / 对象数据集合都要放到 enum 里」，触发了 columns + formRules 两个新违规模式的规范化。

### 6.1 案例 1：表格列定义提取

**前**（`components/DeviceModal.vue`）：

```vue
<script setup>
import IotTable from "@/components/IotTable.vue"
// ...

const columns = [
  { prop: "deviceCode", label: "设备编码", width: 120 },
  { prop: "deviceName", label: "设备名称", minWidth: 160 },
  // ...7 列
]
</script>
<template><IotTable :columns="columns" /></template>
```

**后**：

```js
// enum/index.ts 末尾
/**
 * DeviceModal 弹窗表格列定义
 *  ponytail: 从 components/DeviceModal.vue 顶层 const columns 提取
 */
export const DEVICE_MODAL_COLUMNS = [
  { prop: "deviceCode", label: "设备编码", width: 120 },
  // ...
]
```

```vue
<script setup>
import { DEVICE_MODAL_COLUMNS } from "../enum"
// 删 const columns 整段
</script>
<template><IotTable :columns="DEVICE_MODAL_COLUMNS" /></template>
```

### 6.2 案例 2：静态 FormRules 提取

**前**（`addOrEdit/add.vue`）：

```vue
<script setup>
const formRules = {
  deviceName: [{ required: true, message: "请输入设备名称", trigger: "blur" }],
  // ...10 字段
}
</script>
<template><el-form :rules="formRules" /></template>
```

**后**：

```js
// addOrEdit/enum/index.ts 末尾
/**
 * 设备新增页表单校验规则（仅 required / min / max，无 validator 函数）
 *  ponytail: 从 addOrEdit/add.vue 顶层 const formRules 提取
 */
export const DEVICE_ADD_FORM_RULES = {
  deviceName: [{ required: true, message: "请输入设备名称", trigger: "blur" }],
  // ...
}
```

```vue
<script setup>
import { DEVICE_ADD_FORM_RULES } from "./enum"
// 删 const formRules 整段
</script>
<template><el-form :rules="DEVICE_ADD_FORM_RULES" /></template>
```

**关键点**：
- **模板直接用导出原名**：`:rules="DEVICE_ADD_FORM_RULES"`，**不要** `import { X as rules }`（转发别名禁令，见 `02-audit-page-compliance.md`「转发别名禁令」）
- **含 validator 的 rules 留在 .vue**：validator 闭包依赖组件状态，抽出去会丢依赖

### 6.3 案例 3：命名用全大写还是保留小写？

| 场景 | 选全大写 export | 选小写 export |
|---|---|---|
| 表达「这是数据集合 / 配置」语义 | ✅ 一眼看出是配置 | ❌ 掩盖意图 |
| 跨业务模块复用 | ✅ | ❌ |
| 模板里引用名 | `:columns="DEVICE_MODAL_COLUMNS"` | `:columns="deviceModalColumns"` |

**规则**：数据集合（enum / config 导出）一律**全大写 export**，模板直接引用导出名；**不做 alias import**（`as xxx` 也是转发别名的一种形态）。

