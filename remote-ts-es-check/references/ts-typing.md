# TypeScript 错误签名 + 后端契约（ts-typing）

本文件是 remote-ts-es-check 的 reference。包含：TypeScript 错误签名（TS2300-TS2599 + TS7006-TS7053）+ 后端契约形态 G + 非职责范围说明。**与 `baseline-eslint.md`（ESLint 基础错）和 `reactive-errors.md`（reactive 4 形态）互不重叠**。

**导读**：先读"7 次漏检总根因"理解 skill 升级的通用根因，再读各签名。
**通用根因**："**类型契约声明**"与"**实际数据/调用方式**"**两边不对齐**。skill 升级的核心是**从错误码走到数据流**——主动 grep 各种 "声明 vs 实际" 形态，让 agent 在没 vue-tsc 时也能主动发现。

先对照签名定位，再动手。只有签名位于本次任务的编辑文件和 changed hunks 内时才修复；根因或修复点落在范围外时只报告，不扩大修改范围。

## 7 次漏检总根因

| 顺序 | 错误码 | 根因 | 错位点 | skill 升级 |
|---|---|---|---|---|
| 1 | TS2345 spread | 调用方 spread 源 = string / number；形参 = union literal | **调用方侧 vs 形参侧** | 加 "spread 跨对象" |
| 2 | TS2345 透传 | 对象字面量 ES6 简写 vs 形参 union literal | **调用方侧 vs 形参侧** | 加 "对象字段透传" |
| 3 | TS2339 Set vs Array | props 类型 `Set<T>`，内部用 Array 方法 | **声明 vs 实际方法** | 加 "Set<T> vs Array 误用" |
| 4 | TS2339 fieldCode | `enabled: string[]` (union 限死后改 string)，但 `f.fieldCode` | **改错方向** | 复用第 3 项 |
| 5 | TS2304 未 import | 类型 `FormRules` 用在 `<...>` 注解但 import 漏 | **声明位置 vs import 列表** | 加 "未 import 类型" |
| 6 | TS2322 cast 错 X | `as Record<string, unknown>` 让值变 unknown | **cast 侧 vs 下游期望** | 加 "`as Record<string, X>` 错 X" |
| **7** | **TS2345 / TS2339 `as const` 元素形参不对齐** | **形参字段 vs 元素 union 字段不对齐** | **形参侧 vs 元素 union 侧** | **加 "`as const` 元素 union 传给函数形参"** |
| **8** | **TS7053 / TS2322 后端契约跟前端类型对齐 3 子形态** | **后端 JSON key / VO 字段名 / VO 字段类型 union 跟前端 type / 形参 / 返回类型 漂移** | **跨仓契约（Java VO vs TS type）** | **加 "后端契约跟前端类型对齐 3 子形态"** |

**通用根因**："**类型契约声明**"与"**实际数据/调用方式**"**两边不对齐**。skill 升级的核心是**从错误码走到数据流**——主动 grep 各种 "声明 vs 实际" 形态，让 agent 在没 vue-tsc 时也能主动发现。

**已升级的 8 类扫描项**覆盖：
- 调用方形态：spread (A) / 简写 (B) / 元素 union (F)
- 形参 / props 形态：Set<T> (C) / 形参字段 (F) / 后端 JSON key 映射 (G-1) / VO 字段名 (G-2) / 索引返回类型 (G-3)
- 主动 cast：`as unknown` (E) / 错 X 类型 (E) / 形参 literal union (F)
- import 列表：未 import (D)

## TS2551：字段不存在（死代码兜底表达式）**签名**：
```
src/pages/.../index.vue(NN,COL): error TS2551: Property 'xxx' does not exist on type 'FileUploadRecord'. Did you mean 'file_name'?
```

**根因**：前端代码用 `file.file_name || file.fileName || ""` 这种"snake + camel 双兜底"表达式——但 `FileUploadRecord` 类型只声明了 `file_name` 一种字段，`fileName` 是死代码。

**为什么会写兜底**：历史经验里后端字段命名混乱，既返 snake 又返 camel，于是前端写了双兜底。但**当前类型已经对齐后端 PO（只有 snake_case）**，所以 camel 部分永远走不到。

**ESLint 为什么没报**：cashier 的 `package.json` 没有 `type-check` 脚本，`pnpm dev / build` 走 esbuild 不做类型检查；ESLint 也不带 `parserOptions.project`，无法跑 type-aware 规则（如 `@typescript-eslint/no-unsafe-member-access`）。

**skill 默认行为**：成员链出现 `||` 兜底、字段名与 `*type.ts` 定义不一致时，**按 changed-hunk 约束不擅自删**，记录为"预存问题、不在本任务范围"。如用户要求全面验证：
```bash
cd <project>
npx vue-tsc --noEmit 2>&1 | grep <task-file-pattern>
```
把过滤后的清单交用户决策。

**修复示例**（仅当表达式**全部位于 changed hunk 内**时）：
```ts
// ❌ 死代码
const fileName = file.file_name || file.fileName || ""

// ✅ 只保留类型已声明的字段
const fileName = file.file_name || ""
```
若 `fileName` 兜底是真有兜底必要（如后端真有时只返 camel），说明 `FileUploadRecord` 类型定义与后端实际不符，应改 `*type.ts` 而不是删兜底——但改类型定义又可能扩散影响，按 changed-hunk 范围应单独立任务。


## TS2322 / TS2345：跨文件类型不匹配

**签名**：
```
index.vue(NN,COL): error TS2322: Type 'FileUploadRecordList[]' is not assignable to type 'CompanyAuditItem["attachments"]'
```
其中 `CompanyAuditItem["attachments"]` 是 `FileUploadRecord[]`，实际传入 `FileUploadRecordList[]`（多了一层 `unName / tagNameList / effectiveTime`）。

**根因**：DTO/VO 类型与目标位置不匹配。可能是：
- 字段在重构中下/上沉了一级
- 类型定义在 `*type.ts` 与 `@/common/types/shared` 之间漂移

**skill 默认行为**：与 TS2551 同——按 changed-hunk 不修，记录预存问题。但**这种错误必须报告**给用户，因为它往往意味着整条数据流不通（不只是字段名）。


## TS2305：跨文件 import 成员缺失（2 种形态）

### 形态 1：成员真实不存在（跨仓类型漂移）

**签名**：
```
apis/type.ts(1,15): error TS2305: Module '"@/common/types/shared"' has no exported member 'AuditNode'.
```

**根因**：`type.ts` 从 `@/common/types/shared` 导入 `AuditNode / AuditPermissionSet`，但 `shared.ts` 没导出这两个。可能：
- share 类型定义在重构中被删/移走
- tsconfig paths 解析到 node_modules 过期 dist-types（见下文"tsconfig paths 陷阱"）

**skill 默认行为**：报告给用户，不擅改 `type.ts` 的 import 列表（删 import 等于改业务契约）。

### 形态 2：成员真实存在，只是 import 路径错位

**签名**：同形态 1。

**根因**：标识符**在仓内另一文件定义**（如 `src/common/components/audit/auditTypes.ts` 导出了 `AuditNode / AuditPermissionSet`），但 `type.ts` 写错了 import 路径（写成 `@/common/types/shared` 而非 `@/common/components/audit/auditTypes`）。

**判断方法**：跑 vue-tsc 前先 grep 标识符在 `src/` 全局出现位置（排除 type.ts 自己），看哪个模块**实际定义**了它：

```bash
cd <project>
grep -rn "export interface AuditNode\|export type AuditNode" src/ --include="*.ts" --include="*.vue"
```

**修复方法**：把 import 路径改为真实定义所在模块。**业务逻辑 0 改动**——标识符是同一份，只是路径错了。

```ts
// ❌ 错误路径
import type { AuditNode, AuditPermissionSet, FileReferenceItem, FileUploadRecord } from "@/common/types/shared"

// ✅ 拆分：AuditNode / AuditPermissionSet 从 auditTypes 取，其他保持 shared
import type { AuditNode, AuditPermissionSet } from "@/common/components/audit/auditTypes"
import type { FileReferenceItem, FileUploadRecord } from "@/common/types/shared"
```

### 形态 3：成员定义在 utils，但 detail.vue 直接从 apis/type 导入

**签名**：
```
detail.vue(12,15): error TS2305: Module '"../apis/type"' has no exported member 'NormalizedOnboardingDetail'.
detail.vue(NN,CC): error TS7006: Parameter 'item' implicitly has an 'any' type.
```

**根因**：业务类型（如 `NormalizedOnboardingDetail`）定义在 `utils/index.ts`，但 detail.vue 直接从 `apis/type` 导入——导致 TS2305；连锁 TS7006：`detail` 的 ref 类型退化成 any，导致 `detail.value.items.some(item => ...)` 中 `item` 隐式 any。

**判断方法**：
1. grep 标识符在 `src/` 全局 `export` 位置
2. 看定义在 `utils/` 还是 `apis/`——业务归一化层常放 `utils/`

**修复方法**：在 `apis/type.ts` 文件末尾 re-export，**保持 detail.vue 的 import 路径不变**：

```ts
// 在 apis/type.ts 末尾
export type { NormalizedOnboardingDetail } from "../utils"
```

**为什么不是业务改动**：标识符**早就在 utils 定义**且**运行时已经在用**（detail.vue 之前通过隐式 any 跑通）。修复仅是类型契约对齐，运行时 0 变化。


## TS7006：Parameter implicitly has an 'any' type（连锁型）

**签名**：`detail.vue(NN,CC): error TS7006: Parameter 'item' implicitly has an 'any' type.`

**根因**：上游类型缺失（如 TS2305）连锁导致。`detail: Ref<NormalizedOnboardingDetail | undefined>` 因 import 失败退化成 `Ref<any | undefined>`，访问 `detail.value.items.some(item => ...)` 时 `item` 隐式 any。

**修复**：先修复上游 TS2305 / TS2304（成员没导出），TS7006 自动消失。**不要单独给 `item` 加显式类型**——那只是遮蔽根因。


## TS18048：链式访问 undefined 风险（连锁型）

**签名**：
```
detail.vue(NN,CC): error TS18048: 'item.grounding' is possibly 'undefined'.
```

**根因**：上游类型定义中 `grounding?: OnboardingItem` 是可选字段（`?`），链式访问 `.mainAccount` 时 TS 严格模式下报"可能 undefined"。若调用方只对 `mainAccount` 加 `?.` 但忘了对 `grounding` 加 `?.`，TS18048 触发。

**修复**：对**链上每个可选字段**加 `?.`：

```ts
// ❌ 只对叶子字段加 ?
!item.grounding.mainAccount?.trim()

// ✅ 链上每个可选字段都加 ?
!item.grounding?.mainAccount?.trim()
```

**业务逻辑 0 改动**：当 `grounding` undefined 时，`?.mainAccount` 短路返回 undefined，`!undefined = true`，与"grounding 存在但 mainAccount 为空"语义等价。

**为何 skill 没自动检测**：TS18048 是 type-aware 错误，需要 vue-tsc 跑全项目 + 严格模式才能抓，ESLint 默认无 type-aware 规则。


## TS2339：属性不存在于联合类型

**签名**：
```
detail.vue(NN,CC): error TS2339: Property 'applicationStoreId' does not exist on type 'OnboardingItem & { grounding: OnboardingItem; }'.
```

**根因**：前端代码用了**历史遗留字段名** `applicationStoreId`，但后端 VO 已不再返该字段——后端真实返的是 `items[].id`（store row 主键）。E2E 脚本 `docs/.../e2e-onboarding-real.mjs:391` 已显式 fallback：`const value = item?.applicationStoreId ?? item?.id`。

**判断方法**：
1. grep 后端 VO 类（如 `StoreAuditOnboardingDetailVO`）字段定义
2. 查 E2E 测试 artifact JSON 实际响应字段
3. 查 E2E 脚本注释（通常会说明"原字段已改"）

**修复**：把前端访问改为后端真实字段。**业务逻辑 0 改动**——之前 `item.applicationStoreId` 永远 undefined（后端不返）→ `|| index` fallback；改后 `item.id ?? index` 直接取真值，v-for key 行为等价（同一行重复渲染场景下反而修了潜在 Vue key 冲突）。

```vue
<!-- ❌ 历史遗留字段名 -->
<div v-for="(item, index) in detail.items" :key="item.applicationStoreId || index">

<!-- ✅ 后端真实字段 -->
<div v-for="(item, index) in detail.items" :key="item.id ?? index">
```


## tsconfig paths 陷阱

`tsconfig.json` 的 `paths` 相对 `baseUrl`（= cashier 目录）解析。

| 写法 | 实际解析路径 | 结果 |
|---|---|---|
| `"@ob-web/share": ["../../share/index.ts"]` ✅ | `packages/share/index.ts` | 本地源码（对） |
| `"@ob-web/share": ["../../packages/share/index.ts"]` ❌ | `packages/packages/share/index.ts`（不存在） | TS 回落 node_modules 过期类型 |
| vite.config.ts 用 `resolve(__dirname, "../../share")` 解析 | 与 tsconfig 一致 | ✅ |
| tsconfig paths 与 vite alias 写法**不一致** | dev/build 能跑、类型解析到过期 dist | ❌ |

**症状**：本地已删除/重命名的类型成员，`tsc` 仍报"已声明但未使用"或反过来"找不到声明"。


## TS2305 形态 4：修 ESLint `import/no-duplicates` 时贪心合并 value-export 到 type-only path

**签名**：
```
detail.vue(NN,COL): error TS2305: Module '"../apis/type"' has no exported member 'FileTagKeyValue'.
detail.vue(NN,COL): error TS2305: Module '"../apis/type"' has no exported member 'FileTagOption'.
```

**根因**：文件原本有两路 import：
```ts
import { apiFunctions } from "../apis"             // value-import
import type { OnboardingItem } from "../apis/type" // type-only
```

ESLint `import/no-duplicates` 报"同一路径多次 import"后，**贪心地**把另外两个 type 名字一起合并到 `from "../apis/type"`：
```ts
import { apiFunctions } from "../apis"
import type { FileTagKeyValue, FileTagOption, OnboardingItem } from "../apis/type"  // ❌ 错位
```

但 `FileTagKeyValue / FileTagOption` 实际定义在 `../apis/index.ts`（value-export 模块），不在 `../apis/type`（type-only 模块）。TS 解析报 TS2305。

**为什么 ESLint 没报**：`import/no-duplicates` 是文本级 lint（看 path 字符串是否重复），不扫跨文件类型图，不验证 import 标识符在目标模块是否真实存在。`unused-imports/no-unused-imports` 也不会报（标识符在文件内确有使用）。

**判断方法**：
1. **修 import 前必 grep export**（见 `SKILL.md` 第 4a 步强制检查）：
   ```bash
   grep -rn "export interface FileTagKeyValue\|export type FileTagKeyValue" src/ --include="*.ts" --include="*.vue"
   ```
2. 把 grep 命中的实际文件路径与 import 文本路径逐个对照
3. 不一致 → 该标识符属于"路径错位"，拆分到正确的 path

**修复**：把误合并的 value-export 标识符拆回 value-import path：
```ts
// ✅ 拆分：value-export 和 type-export 分到各自 path
import { apiFunctions } from "../apis"
import type { FileTagKeyValue, FileTagOption } from "../apis"          // value 模块也允许 type-only import
import type { OnboardingItem } from "../apis/type"                      // type-only 模块
```

**业务逻辑 0 改动**：仅类型契约对齐，运行时 0 变化。

**与形态 1/2/3 的区别**：

| 形态 | 标识符真实位置 | 错位 path | 触发场景 |
|---|---|---|---|
| 1 | 不存在 / share 包过期 dist-types | 任意 | 跨仓类型漂移、tsconfig paths 解析错 |
| 2 | 仓内另一文件 | 任意 | type.ts import path 写错 |
| 3 | 同包 utils/index.ts | apis/type | 业务归一化层在 utils 但 detail.vue 直接从 apis 拉 |
| **4** | **同包 apis/index.ts** | **apis/type** | **修 ESLint `import/no-duplicates` 贪心合并** |

**SKILL 升级点**：见 `SKILL.md` 第 4a 步"修复 import 路径后必须做路径校验"。本形态是 2026-09-21 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/detail.vue` 时发现，已加入 skill 强制检查点。


## TS2345：函数返回类型推断 `unknown | string`，调用方期待纯 `string`

**签名**：
```
detail.vue(NN,COL): error TS2345: Argument of type {} is not assignable to parameter of type string.
```

**根因**：函数定义使用了 `Record<string, unknown>` / `Record<string, any>` 等索引返回未定类型的参数；函数体取出 `log[key]` 得到 `unknown`，再用 `|| "兑底字符串"` 连接返回。TS 推断函数返回类型为 `unknown | string`。调用方期待的 `string` 参数收到 `unknown` 部分，报 TS2345。

典型形态：
```ts
const logValue = (log: Record<string, unknown>, keys: string[]) =>
  keys.map(key => log[key]).find(item => item !== undefined && item !== null && item !== "") || "-"
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^unknown 起点^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

调用方：
```vue
<template #default="{ row }">{{ translateOperatorName(logValue(row, ["operator", "operatorName"])) }}</template>
<!--                                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                                logValue 返回 unknown | string -->
<!--                                                              translateOperatorName(operator: string) 报 TS2345 -->
```

**为什么 ESLint 没报**：
- `import/no-duplicates` 是文本级 lint，不检查函数返回类型
- 未启用 `parserOptions.project`，无 type-aware 规则
- `vue-tsc --noEmit` 才能扫出，但 skill 默认不跑

**判断方法**（避坑技术）：
1. grep 函数参数中含 `Record<string, unknown>` / `Record<string, any>` / `{ [k: string]: any }`：
   ```bash
   grep -nE 'Record<string,\s*(unknown|any)>|\{\s*\[k:\s*string\]:\s*(unknown|any)\s*\}' src/ -r --include="*.ts" --include="*.vue"
   ```
2. grep 函数体含 `|| "..."` / `|| '-'` 兑底：
   ```bash
   grep -nE '=>.*\|\|\s*"' src/ -r --include="*.ts" --include="*.vue"
   ```
3. 同时命中 → 查看调用方参数类型是否期待纯 `string`/`number`，是 → 函数签名漏标注返回类型

**修复**：函数声明加显式返回类型 `: string`，函数体内用 `String(...)` 或类型守卫把 `unknown` 转 `string`：

```ts
// ✅ 显式标注返回类型 + 循环中转字符串
function logValue(log: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = log[key]
    if (v !== undefined && v !== null && v !== "") return String(v)
  }
  return "-"
}
```

**业务逻辑 0 改动**：`unknown` 在运行时本就是字符串（后端只返字符串字段），仅类型契约补齐。

**SKILL 升级点**：见 `SKILL.md` 第 6 步"类型嫌疑主动扫描"中"函数返回类型推断 unknown / 缺签名"扫描项。本形态是 2026-09-21 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/detail.vue` line 837 时发现。


## TS2322：mock 数据 vs 接口契约字段缺失

**签名**：
```
detail-mock.ts(70,5): error TS2322: Type '{ id: string; storeCode: string; storeName: string; platform: string; departmentName: string; shopStatus: string; }[]' is not assignable to type 'CompanyAssignStore[]'.
  Property 'departmentId' is missing in type '{ id: string; storeCode: string; storeName: string; platform: string; departmentName: string; shopStatus: string; }' but required in type 'CompanyAssignStore'.
```

**根因**：mock 文件里同时定义了 `CompanyAssignStore` interface（必填 `departmentId`）和 `company()` 函数（生成的 store 对象缺 `departmentId`）。

```ts
// 接口定义
export interface CompanyAssignStore {
  id: string
  storeCode: string
  storeName: string
  platform: string
  departmentId: string  // ← 必填
  departmentName: string
  shopStatus: string
}

// mock 函数生成的 store 缺 departmentId
function company(...): CompanyAssignInfo {
  return {
    ...
    stores: stores.map(([storeId, storeCode, storeName, platform, shopStatus]) => ({
      id: storeId,
      storeCode,
      storeName,
      platform,
      departmentName,  // ← 只有公司级别 departmentName
      shopStatus
      // ❌ 缺 departmentId
    }))
  }
}
```

**为什么 ESLint 没报**：
- TS2322 是 type-aware 错误，需 vue-tsc 扫
- ESLint 默认无 `parserOptions.project`，无 type-aware 规则
- skill 默认不跑 vue-tsc

**判断方法**：
1. grep 同文件内 `export interface`，列出所有必填字段（无 `?` 后缀）
   ```bash
   grep -nE 'export\s+interface\s+\w+\s*\{' src/ -r --include="*.mock.ts" --include="*.test.ts" --include="*.spec.ts"
   ```
2. grep mock 函数内的 `.map((...) => ({...}))` 位置，对照对象字面量字段
   ```bash
   grep -nE 'stores:\s*stores\.map|=>\s*\(\s*\{' src/ -r --include="*.mock.ts" --include="*.test.ts" --include="*.spec.ts"
   ```
3. 查看调用方是否用 `(s.field as string) ?? ""` 兑底 → 字段本质可选 → 优先放宽接口

**修复方向**（需业务判断，不擅自修）：
1. **接口放宽**：把 `departmentId: string` 改为 `departmentId?: string`，对齐调用方兑底逻辑（推荐，详情页已用 `(s.departmentId as string) ?? ""` 兑底）
2. **mock 补字段**：在 `company()` 加第 6 个参数 `departmentId`，给所有 store 赋值（如果接口严格且 mock 有数据源）
3. **加 `as CompanyAssignStore` 断言遮蔽**（不推荐，掩盖问题）

**业务逻辑 0 改动**：mock 缺字段 / 接口过严 是类型契约层问题，运行时本就能跑（mock 数据本身已经是 mock）。

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2322（跨文件类型不匹配） | 后端 VO 与前端接口字段名/类型漂移 |
| TS2551（字段不存在） | 前端访问历史遗留字段名，后端已不返 |
| **TS2322（mock 缺字段）** | **mock / test 文件本身接口与对象字面量不一致** |

**SKILL 升级点**：见 `SKILL.md` 第 6 步"类型嫌疑主动扫描"新增的"mock / test 数据 vs 接口契约不一致"扫描项。本形态是 2026-09-21 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/detail-mock.ts` line 70 时发现。


## TS2322：同名类型跨文件独立定义导致赋值不兼容

**签名**：
```
TS2322: Type import('X/types.ts').OnboardingSubAccount[]
is not assignable to type import('Y/component.vue').OnboardingSubAccount[]

Types of property account are incompatible.
Type string | undefined is not assignable to type string
SubAccountEditor.vue(13, 3): The expected type comes from property modelValue which is declared here on type
```

**根因**：同名类型（例 `OnboardingSubAccount`）在两个文件独立 `export interface` 定义，TypeScript 视为两个独立标识符。定义间可选性不一致时（一个 `account?: string`，另一个 `account: string`），赋值不兼容。即使字段名 + 类型看起来一致，只要**字段修饰符**（optional `?` / `readonly` / `| undefined`）不同，结构化赋值失败。

**典型场景**：

| 场景 | 错误表现 |
|---|---|
| DTO 接口与 Vue 组件 props 重复定义同名 interface | `model-value="(item.subAccounts || []) as OnboardingSubAccount[]"` 报 TS2322 |
| 两个 DTO 接口重复定义 | 跨模块 import 同一个名字时分配到不同定义 |
| 类同名但可选性不同 | `account: string` vs `account?: string` 互相赋值 |

**主动扫描方法**：

```bash
# 找出同名字 interface / type 定义
grep -nE "(interface|type)\s+OnboardingSubAccount\b" src/ -r --include="*.ts" --include="*.vue"
```

**判断 "重复 vs 同名合法"**：

| 标志 | 判断 | 处理 |
|---|---|---|
| 同名 interface 定义两处或以上 | **重复定义** | 删掉重复那一份（保留 DTO 接口定义，组件 import DTO） |
| 同名 type alias 定义两处或以上 | **重复定义** | 同上 |
| 同名类在不同上下文（如 Express `Request` 与 Vue `Request`） | 独立业务名 | 不一定合并，需业务判断 |

**修复**（Ponytail rung 1 ——“不应该是两个”）：
1. 选源: **DTO / type 侧为唯一 source of truth**，组件 / props 从 DTO import
   ```ts
   // components/SubAccountEditor.vue（从前有重复定义，改后唯一源）
   import type { OnboardingSubAccount } from "../apis/type"
   ```
2. 修文件使用方：
   ```ts
   // addOrEdit/fill.vue（之前从组件 import，改后从 DTO import）
   import type { OnboardingSubAccount } from "../apis/type"
   ```
3. 如果两处重复都依赖不同 import 路径，出现 `import/no-duplicates` 报错（同一路径 import 多次），合并为同一行：
   ```ts
   import type { NormalizedOnboardingDetail, OnboardingSubAccount } from "../apis/type"
   ```

**为什么 "从组件 import type" 是反模式**：
1. Vue 组件会随业务重命名 / 迁移 / 拆分，DTO 是稳定契约层
2. 组件局部 `export interface` 常与 DTO 重复但可选性不一致 → 反复出现 TS2322
3. `export interface` 从 .vue 文件导出本身是能力（用于 prop 类型转 external），但**同名字只能有一份定义**

**业务逻辑 0 改动**：唯一源重新 import，运行时无任何实际影响。

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位） | import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown） | `const x = () => arr.map(...)` 无签名 → 返回 `unknown[]` |
| TS2322（mock 缺字段） | mock / test 数据 vs 接口契约字段缺失 |
| jsdoc/multiline-blocks | JSDoc 起始行 `/**` 同行接文字 |
| 未使用代码（默认 ESLint 不抓） | 项目 eslint.config.js 默认禁用 no-unused-vars 导致死代码 + 孤儿 API 残留 |
| **TS2322（同名类型重复定义）** | **同名 interface / type 在两处独立 `export`，可选性不一致** |

**SKILL 升级点**：见 `SKILL.md` 第 6 步“同名多源 import”扫描项补充“同名类型定义也要扫”。本形态是 2026-09-21 实际修复
- `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/components/SubAccountEditor.vue` `OnboardingSubAccount` 重复定义
- `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/fill.vue` 从组件 import 改为从 DTO import
时发现。


## TS2305 形态 5：ApiEnvelope 不存在于 `@ob-web/share`

**签名**：`src/pages/StoreAuditOnboarding/addOrEdit/apis/index.ts(1,15): error TS2305: Module '"@ob-web/share"' has no exported member 'ApiEnvelope'.`

**根因**：`ApiEnvelope<T> = { code: number; data: T; message?: string }` 是**业务模块自己的泛型契约**，并非 share 包公开类型。share 包只提供 `request` / `renderDialog` 等基础设施。错误地写 `import type { ApiEnvelope } from "@ob-web/share"` 会导致：

1. vue-tsc 报 TS2305 Module has no exported member
2. 整条 import 链失败，导致依赖此文件的调用方连带报 TS2307（Cannot find module）
3. 业务模块的 ApiEnvelope 定义被旁路

**触发场景**：
1. 新建业务模块 apis/ 时，复制了某个 share 包 import 的写法，但 `ApiEnvelope` 不是 share 包的
2. 误以为 share 包提供通用 envelope 类型

**判断方法**：

```bash
# 1. 看 share 包实际导出哪些类型
grep -rn "ApiEnvelope" 'ob_web/packages/share/' --include="*.ts"

# 2. 看其他业务模块怎么 import ApiEnvelope
grep -rn "import.*ApiEnvelope" 'ob_web/packages/micro/cashier/src/' --include="*.ts"
```

**期望**：所有业务模块都从**本地 type.ts** import（`./type` 或 `@/pages/<module>/apis/type`），不是 `@ob-web/share`。

**修复**：

```ts
// ❌ 错误
import type { ApiEnvelope } from "@ob-web/share"

// ✅ 正确：从业务模块本地 type.ts import
import type { ApiEnvelope } from "../../apis/type"
// 或
import type { ApiEnvelope } from "./type"
```

**业务逻辑 0 改动**：纯 import 路径修正，运行时无影响。

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描" 新增的"同名多源 import / 跨文件 import 路径错位"扫描项。本形态是 2026-09-21 实际修复 `StoreAuditOnboarding/addOrEdit/apis/index.ts` 时发现。


## TS2307：.vue 文件用相对路径 import 业务模块 utils 失败

**签名**：`src/pages/StoreAuditOnboarding/addOrEdit/detail.vue(17,31): error TS2307: Cannot find module '../../utils/confirm' or its corresponding type declarations.`

**根因**：vue-tsc 在 `.vue` 文件里处理 `from "../../utils/confirm"` 这类**业务模块相对路径 import** 时，存在路径解析失败的偶发问题——同一路径在 `.ts` 文件（composables / utils）能成功解析，在 `.vue` 文件里却报 TS2307。

**触发场景**：
1. `.vue` 文件在 `addOrEdit/` 子目录下，import 业务模块外层 `utils/confirm`
2. 同一路径在 5 个其他 `.ts` 文件（utils/index.ts / composables/*.ts）都能 resolve

**判断方法**：

```bash
# 看是哪些文件用这个路径
grep -rln "from \"\.\./\.\./utils/confirm\"" 'src/pages/'
# 如果其他 5 个文件都是 .ts，唯独 1 个 .vue 报 TS2307 → 是本形态
```

**修复**：把 `.vue` 文件的相对路径改成 `@/pages/<module>/utils/confirm` 绝对路径：

```ts
// ❌ .vue 文件报错
import { confirmDelete } from "../../utils/confirm"

// ✅ 改绝对路径
import { confirmDelete } from "@/pages/StoreAuditOnboarding/utils/confirm"
```

**业务逻辑 0 改动**：纯 import 路径修正，运行时无影响。

**SKILL 升级点**：见 `SKILL.md` 步骤 4a 路径校验 + 步骤 6 类型嫌疑主动扫描。本形态是 2026-09-21 实际修复 `StoreAuditOnboarding/addOrEdit/detail.vue` 时发现——5 个其他 `.ts` 文件同路径都 resolve 成功，仅 `.vue` 失败。**修复规则：`.vue` 文件优先用 `@/pages/...` 绝对路径，避免相对路径在 vue-tsc 解析时的偶发失败**。


## TS2345：spread 后字段类型不兼容（形参 union literal，源 string）

**签名**：
```
addOrEdit/fill.vue(163,11): error TS2345: Argument of type
{ rowNo: number; companyUniqueValue: string | undefined; companyName: string;
  ...; entryPlatform: string | undefined; subAccounts?: {...}[]; }[]
is not assignable to parameter of type OnboardingItem[]

Types of property entryPlatform are incompatible.
Type 'string | undefined' is not assignable to type 'AuditPlatform | undefined'
Type 'string' is not assignable to type 'AuditPlatform | undefined'
```

**根因**：函数形参接口 `OnboardingItem.entryPlatform: AuditPlatform`（`AuditPlatform = "tmall" | "jd" | "pdd" | "douyin" | "kuaishou" | "amazon" | "other"`，7 枚举字面量）；调用方 `shops.value.map(item => ({...item, rowNo, companyUniqueValue, companyName}))` 生成的 storesPayload 里 `entryPlatform` 是 `string`（`ShopFormValue.entryPlatform: string`）。spread 后传给 `validateOnboardingFill(storesPayload: OnboardingItem[])` → 形参期望 `AuditPlatform | undefined`，收到 `string | undefined`，报 TS2345。

**为什么会写 string**：**实际数据是任意 string**（`storeEntryPlatform` 字典里的 `platformCode` 可为 `test_pdd` / `test2` / `jd` / `pdd` 等），用 7 枚举限死反而表达不了真实数据。

**为什么 ESLint 没报**：
- TS2345 是 type-aware 错误，ESLint 默认无 `parserOptions.project`，无 type-aware 规则
- `vue-tsc --noEmit` 才能扫出，但本 skill 默认不跑

**为什么 TS2551 / TS18048 / TS2345 未知函数返回形态也扫不到**：它们的扫描项都是"函数/字段访问型"（如 `Record<string, unknown>` + `|| "兑底"`），不覆盖"spread 后赋值给 union literal 字段"这种跨对象类型不兼容。

**判断方法（grep 主动扫，不依赖 vue-tsc）**：

```bash
# 步骤 1：找 union literal 字段定义（内联 string union，2-10 个 literal）
grep -nE '\?\s*:\s*"[a-z_]+"(\s*\|\s*"[a-z_]+"){1,9}' src/ -r --include="*.ts" --include="*.vue"
# 命中例：
#   src/pages/StoreAuditOnboarding/apis/type.ts:23:  storeCountBucket?: "all" | "zero" | "1-5" | "6-20" | "20+"

# 步骤 2：找 union literal 类型别名（需以 union 为体）
grep -nE '^export type \w+ = "[a-z_]+"(\s*\|\s*"[a-z_]+"){1,9}\s*$' src/ -r --include="*.ts"
# 命中例：
#   src/pages/StoreAuditOnboarding/apis/type.ts:27:export type AuditPlatform = "tmall" | "jd" | "pdd" | "douyin" | "kuaishou" | "amazon" | "other"

# 步骤 3：找 spread 源（调用方）：{ ...item, ... } 或 .map 后调函数
grep -nE 'return \{\s*\.\.\.' src/ -r --include="*.ts" --include="*.vue"
# 命中例：
#   addOrEdit/fill.vue:154:  const storesPayload = shops.value.map((item, idx) => {
#   addOrEdit/fill.vue:155:    return {
#   addOrEdit/fill.vue:156:      ...item,
#   addOrEdit/fill.vue:157:      rowNo: idx + 1,

# 步骤 4：找赋值给 *Payload 后传给函数的模式
grep -nE 'const \w+Payload\s*=\s*.+\.map\(' src/ -r --include="*.ts" --include="*.vue"
# 命中例：
#   addOrEdit/fill.vue:154:  const storesPayload = shops.value.map((item, idx) => {
```

**交叉判断**：步骤 1/2 命中的每个 union literal 字段名 vs 步骤 3/4 的 spread 源对象字面量里**同名字段**：
- spread 源同名字段是 `string` / `string | undefined` → **本形态**，报 TS2345
- spread 源同名字段类型已对齐 union literal → 无问题
- 找不到同名字段 → spread 源没赋这个字段，安全

**修复方向**（需业务判断，不擅自修）：

| 方向 | 适用场景 | 改动范围 |
|---|---|---|
| (A) 接口字段放宽到 `string` | 实际数据本来就是任意 string（平台字典 code / 业务流水号等），用 union literal 限死反而表达不了 | 仅修改 `type.ts` 该字段类型，0 业务改动 |
| (B) 加 type guard | 数据应严控到 union literal 值，但调用方临时存了 string | 在 spread 后加 `(storesPayload as OnboardingItem[])` 断言或运行时校验 |
| (C) 改 spread 源字段类型为 union literal | 不推荐，源数据本身是 string 不可控 | 改 `ShopFormValue.entryPlatform: AuditPlatform` 会在其它位置连锁报错 |

**本次 case 修法**（A）：
```ts
// src/pages/StoreAuditOnboarding/apis/type.ts
- /** 入驻平台（来自申请单的目标平台，必填，spec §3.4） */
- entryPlatform?: AuditPlatform
+ /**
+  * 入驻平台（来自申请单的目标平台，必填，spec §3.4）
+  *  ponytail: 实际平台字典里 code 是任意 string（test_pdd/test2 等），不能用 AuditPlatform 7 枚举限死。
+  */
+ entryPlatform?: string
```

**业务逻辑 0 改动**：实际数据一直是 string，运行时无任何变化。

**反思**：union literal 字段是"业务希望数据严控到某几个值"的契约表达，但前端表单里用户在 select 里可能选到字典外的值（如 `test_pdd`）—— 字典值不在 union literal 内就报错。**业务实际**：union literal 应只用于"后端 API 枚举返回值"等真枚举场景；前端表单 / spread 源用 string 才对。

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描"新增的"spread 后跨对象类型不兼容"扫描项。本形态是 2026-10-10 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/fill.vue` line 163 时发现——skill 之前的扫描项（TS2551 / TS18048 / TS2345 函数返回 unknown）都覆盖不到。


## TS2345 形态 B：对象字段直接透传形参（无 spread）

**签名**：
```
utils/index.ts(65,5): error TS2322: Type 'string[] | undefined' is not assignable to type 'AuditPlatform[] | undefined'
Type 'string[]' is not assignable to type 'AuditPlatform[]'
Type 'string' is not assignable to type 'AuditPlatform'
type.ts(162, 3): The expected type comes from property platformList which is declared here on type AuditApplicationSaveDTO
```

**根因**：与“形态 A：spread 后跨对象类型不兼容”**同根因**——DTO 字段 `platformList?: AuditPlatform[]`（`AuditPlatform = "tmall" | "jd" | "pdd" | "douyin" | "kuaishou" | "amazon" | "other"`，7 枚举字面量）；调用方表单 `form.platformList?: string[]`（实际数据是任意 string 代码，如 `test_pdd` / `test2`）。`buildOnboardingSavePayload(form, meta)` 内部：

```ts
const platformList = form.platformList?.length ? form.platformList : undefined
return {
  applyDate: form.applyDate,
  applyDepartment: ...,
  platformList,       // ← 这里是 ES6 简写，透传 form.platformList
  priority: form.priority?.toLowerCase() as ...,
  ...
}
```

`platformList,` 是 ES6 对象简写，等价于 `platformList: platformList`。`platformList` 的类型 = `form.platformList?.length ? form.platformList : undefined` = `string[] | undefined`。目标形参 `AuditApplicationSaveDTO.platformList: AuditPlatform[] | undefined`，报 TS2345。

**为什么 spread 形态的扫描项（SKILL.md 步骤 6 中"spread 后跨对象类型不兼容"）没扫到**：
- step 3（`return \{\s*\.\.\.`）：只抓**展开运算符** `...item` 形式。`platformList,` 是 ES6 简写，不是 spread。
- step 4（`const \w+Payload`）：只抓 `*Payload` 命名的中间变量。`platformList` 是局部变量名不是 Payload。
- 本次 case 在 utils/index.ts 里 spread 仅出现在 line 57（`return { ...cloned, rowNo: index + 1 }`，**其他字段**），与 `platformList` 无关。

**为什么 TS2551 / TS18048 / TS2345 函数返回 unknown 也不覆盖**：与形态 A 同——扫描项都是"函数/字段访问型"，不覆盖"对象字段透传"。

**判断方法（grep 主动扫，不依赖 vue-tsc）**：

```bash
# 步骤 A：找 union literal 字段定义（同形态 A，补充数组形态）
grep -nE '\?\s*:\s*"[a-z_]+"(\s*\|\s*"[a-z_]+"){1,9}' src/ -r --include="*.ts" --include="*.vue"
grep -nE '\?\s*:\s*\w+\[\]' src/ -r --include="*.ts" --include="*.vue"
grep -nE '^export type \w+ = "[a-z_]+"(\s*\|\s*"[a-z_]+"){1,9}\s*$' src/ -r --include="*.ts"
# 从上面提取字段名（如 platformList / entryPlatform / priority / priorityList / accountStatus / storeCountBucket 等）

# 步骤 B：找对象字面量里的 ES6 简写字段（key, 形式）
# 命中上下文：return { ... } / const obj = { ... } / 函数参数默认值
# 模式：2+ 空白 + 单词 + 可选逗号 + 行尾
grep -nE '^\s{2,}\w+,?\s*$' src/ -r --include="*.ts" --include="*.vue"
# 命中例：
#   src/pages/StoreAuditOnboarding/utils/index.ts:65:    platformList,
#   src/pages/StoreAuditOnboarding/utils/index.ts:67:    expectedShopCount: form.shopCount,
# （注意 platformList 是简写；expectedShopCount 是显式 key: expr，两种都是"透传"但含义不同）
# 简写需要额外判断（key 名 == 外部变量名）

# 步骤 C（更精准）：限定在 return { / const \w+ = { 后几行内的简写
# 用 perl 多行模式提取
perl -0777 -ne 'while (/(?:return|const\s+\w+\s*=\s*)\s*\{([^{}]+)\}/g) { my $b = $1; while ($b =~ /^\s*(\w+)\s*,?\s*$/mg) { print "$ARGV:$.:$1\n" } }' src/ -r --include="*.ts" --include="*.vue"
```

**交叉判断**：步骤 A 的 union literal 字段名 vs 步骤 B/C 的 ES6 简写字段名：
- 名字相同 + 上下文是"函数返回 DTO 对象字面量" → **本形态**，报 TS2345
- 名字相同 + 上下文是"spread" → 形态 A
- 名字相同 + 实参是显式 `key: expr` 但 expr 是 string → 隐式透传，需另查

**修复方向**（同形态 A，需业务判断，不擅自修）：

| 方向 | 适用场景 | 改动范围 |
|---|---|---|
| (A) DTO 字段放宽到 `string` / `string[]` | 实际数据本来就是任意 string（平台字典 code / 业务流水号等），用 union literal 限死反而表达不了 | 仅修改 `type.ts` 该字段类型，0 业务改动 |
| (B) 加 type guard | 数据应严控到 union literal 值，但表单/上游临时存了 string | 在透传前加 `.filter(...)` 过滤 / `.map(...)` 转枚举 / `.includes(...)` 校验 |
| (C) 改上游字段类型为 union literal | 不推荐，上游本身是 string 不可控 | 改 `form.platformList?: AuditPlatform[]` 会在表单里连锁报错 |

**本次 case 修法**（A）：4 处 `platformList?: AuditPlatform[]` 全部放宽到 `string[]`：
- `AuditApplicationPageQuery.platformList`（list 查询）
- `AuditApplicationListVO.platformList`（列表 VO）
- `AuditApplicationSaveDTO.platformList`（保存 DTO）
- `AuditApplicationDetailVO.platformList`（详情 VO）

**业务逻辑 0 改动**：实际数据一直是 string[]，运行时无任何变化。

**与形态 A 的区别**：

| 维度 | 形态 A（spread） | 形态 B（透传） |
|---|---|---|
| 语法 | `return { ...item, ... }` | `return { key, ... }`（ES6 简写） |
| 形参名 | `storesPayload`（*Payload 命名） | 通常 `form` / `source` / `input` |
| 漏检原因 | step 4 命名 *Payload 才抓 | step 3/4 都不抓无 spread 无 *Payload 的简写 |
| 调用方代码特征 | `validateXxx(storesPayload)` | `buildDto(form, meta)` |
| 高频场景 | 表单 map 后立即校验 | build / toDto / saveDto 工具函数 |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描"新增的"对象字段直接透传形参"扫描项（与“spread 跨对象”同根因但独立子项）。本形态是 2026-10-10 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/utils/index.ts` line 65 时发现——上一个升级（"spread 跨对象"）的 4 步 grep 仍漏了“ES6 简写透传”形态。


## TS2339 形态：Set<T> 与 Array 方法误用

**签名**：
```
SubAccountForm.vue(56, 9): error TS2339: Property 'length' does not exist on type 'Set<string> | never[]'
  Property 'length' does not exist on type 'Set<string>'
```

**根因**：props 声明为 `enabledFields?: Set<string>`，调用方 fill.vue 传 `new Set<string>(...)`、SubAccountManager 强转 `(arr as unknown as Set<string>)`。内部代码：
```ts
const enabled = props.enabledFields ?? []   // enabled: Set<string> | never[]
if (enabled.length === 0) { ... }            // TS2339
return subAccountFieldPool.filter(meta => enabled.some(f => f.fieldCode === meta.key))
                              // TS2339 .some / .find
```
Set **没有** `.length` / `.some` / `.find` / `.filter` / `.map` / `.indexOf` / `.includes` / `.every` / `.reduce` / `.sort` / `.slice` / `.concat`。Set 仅有 `.has(value)` / `.size` / `.add` / `.delete` / `.forEach(callback)` / `[Symbol.iterator]`。

**为什么 TS2551 / TS18048 / TS2345 都不覆盖**：本形态报的是 TS2339（属性访问失败），不是类型不匹配也不是字段名拼错。skill 之前 9 个扫描项 + 2 个 TS2345 形态（spread / 透传）都不抓。

**判断方法（perl + grep 主动扫）**：

```bash
# 步骤 1：找所有 Set<T> 类型的 props / 变量声明（perl 处理 lookbehind）
perl -ne 'while (/\b(\w+)\s*\??\s*:\s*Set<\w+>/g) { print "$ARGV:$.:$1\n" }' $(find src -name "*.ts" -o -name "*.vue")

# 步骤 2：对步骤 1 的每个变量名，在同文件内查 Array 方法调用
# 命中后用 .from_wrap 查是否 Array.from 包裹
for f in $(find src -name "*.ts" -o -name "*.vue"); do
  for v in $(perl -ne 'while (/\b(\w+)\s*\??\s*:\s*Set<\w+>/g) { print "$1\n" }' "$f" | sort -u); do
    hits=$(grep -nE "\b$v\.(length|some|find|filter|map|indexOf|includes|every|reduce|sort|slice|concat|forEach)\b" "$f" 2>&1)
    from_wrap=$(grep -cE "Array\.from\([^)]*$v|Array\.from\([^)]*props\.$v" "$f" 2>&1)
    if [ -n "$hits" ] && [ "$from_wrap" = "0" ]; then
      echo "❌ $f: $v (Set<T>) 用了 Array 方法但没 Array.from 包裹"
      echo "$hits" | head -3
    fi
  done
done

# 步骤 3：查 `as unknown as Set<` 强转（伪装豁免警报）
grep -rnE "as\s+unknown\s+as\s+Set<" src/ --include="*.ts" --include="*.vue"
```

**修复方向**（ponytail rung 1 最小改，需业务判断，不擅自修）：

| 方向 | 适用场景 | 改动范围 |
|---|---|---|
| (A) props union + `Array.from()` 包裹 | 调用方有传 Set 也有传 Array 两种 | 改 props 类型 `Set<T> \| readonly T[]` + 内部加 `Array.from(props.xxx ?? [])` |
| (B) props 类型统一为 `readonly T[]` | 调用方都能改 Array | 改 props 类型 + 所有调用方去掉 `new Set(...)` 或 cast |
| (C) 内部改用 Set 方法 | 调用方都传 Set，内部用 `.has` / `.size` | 改 props 类型保留 Set + 内部用 Set 方法 |

**本次 case 修法**（A）：props 类型 `Set<string>` → `Set<string> | readonly string[]`（兼容 fill.vue 传 Set / SubAccountManager 传 Array），内部加 `Array.from(props.enabledFields ?? [])` 统一转数组。fill.vue / SubAccountManager 调用方**不动**（hunk 之外，union 后两者都兼容）。

**警惕 `as unknown as Set<T>` 强转**：SubAccountManager.vue line 347 `:enabled-fields="(enabledFields as unknown as Set<string>)"` 是**伪装豁免**——`enabledFields` 实际类型是 `StoreEntryPlatformFieldItemVO[]`，强转成 Set 后面 props 接收就报 TS2339。**根因修法是改 props 类型侧**，调用方 cast 应当删除。

**与其它形态的区别**：

| 形态 | 错误码 | 报点 | 根因 |
|---|---|---|---|
| TS2551 字段不存在 | TS2551 | 调用方用了字段名 | 字段名拼错 / 接口过时 |
| TS2345 spread 后类型不兼容（形态 A）| TS2345 | `return { ...item }` 传参 | 形参是 union literal，源是 string |
| TS2345 透传形参（形态 B）| TS2345 | 对象字面量字段透传 | 同形态 A，无 spread |
| **TS2339 Set<T> vs Array**（形态 C）| TS2339 | `set.length` / `set.some` | props 误声明 Set，内部用 Array 方法 |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描"新增的"Set<T> 与 Array 方法误用"扫描项。本形态是 2026-10-10 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/components/SubAccountForm.vue` line 56 时发现——前两次升级（TS2345 spread / TS2345 透传）都不报 TS2339，且 Set 类型 vs Array 方法对照需要 perl 提取 Set<T> 变量名 + grep Array 方法双重扫描。


## TS2304 形态：未 import 类型引用

**签名**：
```
SubAccountForm.vue(196, 14): error TS2304: Cannot find name 'FormRules'
```

**根因**：line 196 `const rules: FormRules<OnboardingSubAccount> = {` 用了 `FormRules` 类型，但 line 10 import 只有 `import type { FormInstance } from "element-plus"`，**漏了 `FormRules`**。Element Plus 实际导出 `FormRules`（`node_modules/element-plus/es/components/form/src/types.d.ts:13`），其它文件（bankCard / businessScope / company）都正确 import `FormInstance, FormRules` 两个。

```ts
// line 10（修前）
import type { FormInstance } from "element-plus"  // ← 漏 FormRules
// line 196（用法）
const rules: FormRules<OnboardingSubAccount> = { ... }  // TS2304
```

**为什么之前 4 个升级项都不报**：前 4 个升级（TS2345 spread / 透传 / TS2339 Set / TS2339 fieldCode on string）都涉及"两个类型之间的不匹配"——本形态只涉及"**未引入类型**"，与类型不匹配无关。skill 的 9 个扫描项全在查类型对不对、字段有没有，没人查"声明了没"。

**判断方法（perl + comm 主动扫）**：

```bash
# 步骤 1：提取文件内 import 的所有标识符（import / import type / 命名 / 默认）
f=src/.../Foo.vue
imports=$(perl -ne 'while (/import\s+(?:type\s+)?\{([^}]+)\}|import\s+(?:type\s+)?(\w+)/g) { my $b = $1 || $2; for my $id (split /\s*,\s*/, $b) { $id =~ s/^\s+|\s+$//g; $id =~ s/^type\s+//; print "$id\n" if $id =~ /^\w+$/ } }' "$f" | sort -u)

# 步骤 2：提取文件内"作为类型注解"的大写标识符（type position）
# 模式：: PascalCase / <PascalCase / as PascalCase
types=$(perl -ne 'while (/\b:\s*([A-Z]\w*)\b|\b<([A-Z]\w*)\b|\bas\s+([A-Z]\w*)\b/g) { print "$1$2$3\n" }' "$f" | sort -u)

# 步骤 3：提取本地声明的类型（type X / interface X）
locals=$(grep -hoE '^(export\s+)?(type|interface)\s+([A-Z]\w*)' "$f" | sed -E 's/.*\b([A-Z]\w*)$/\1/' | sort -u)

# 步骤 4：减去 JS/TS 内置类型白名单 + locals + imports
whitelist="Promise Error Record Partial Required Readonly Pick Omit Exclude Extract ReturnType Parameters InstanceType NonNullable Uppercase Lowercase Capitalize Uncapitalize Awaited ThisType ThisParameterType OmitThisParameter Array Map Set Date RegExp Symbol Object Function String Number Boolean IterableIterator ArrayLike ReadonlyArray ReadonlyMap ReadonlySet"
suspects=$(comm -23 <(echo "$types") <(echo -e "$imports\n$locals\n$whitelist" | sort -u))

# 步骤 5：判断
[ -n "$suspects" ] && echo "❌ 下面类型可能被引用但未 import：$suspects"
```

**验证 cashior 项目**：反向模拟——临删 `FormRules` import，扫描命中 `FormRules`；还原后 0 命中。

**误报处理**：
- 字符串 / 注释里的 PascalCase：perl `\b:\s*` / `\b<` 限定 type position，不命中
- 模板里的组件名 `<el-form>` / `<MyComp>`：本扫描不扫模板（grep -E 不在 `<template>` 块内运行）
- 全局类型扩展（`window.X` / `declare global`）：手动加白名单或确认不需要 import

**修复方向**（ponytail rung 1 最小改，不擅自修）：

| 方向 | 适用场景 | 改动范围 |
|---|---|---|
| (A) 在 import 块加 `import type { Xxx } from "..."` | 唯一来源 | 加 1 行 import 或加到已有 import 块 |
| (B) 改为动态 import `import(...)` | 循环依赖 | 重构 import 结构 |
| (C) 改用同源类型（如 `OnboardingSubAccount` 改用本地 `type X`） | 业务实际不一致 | 重构类型定义 |

**本次 case 修法**（A）：line 10 `import type { FormInstance } from "element-plus"` → `import type { FormInstance, FormRules } from "element-plus"`。1 个标识符加到已有 import 块，0 业务改动。

**与其它形态的区别**：

| 形态 | 错误码 | 报点 | 根因 |
|---|---|---|---|
| TS2551 字段不存在 | TS2551 | 调用方用了字段名 | 字段名拼错 / 接口过时 |
| TS2345 spread 后类型不兼容（形态 A）| TS2345 | `return { ...item }` 传参 | 形参是 union literal，源是 string |
| TS2345 透传形参（形态 B）| TS2345 | 对象字面量字段透传 | 同形态 A，无 spread |
| TS2339 Set<T> vs Array（形态 C）| TS2339 | `set.length` / `set.some` | props 误声明 Set，内部用 Array 方法 |
| **TS2304 未 import 类型**（形态 D）| TS2304 | `const x: X = ...` | 用了类型但没 import |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描"新增的"未 import 类型引用"扫描项。本形态是 2026-10-10 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/components/SubAccountForm.vue` line 196 时发现——前 4 个升级（TS2345 spread / 透传 / TS2339 Set / TS2339 fieldCode）都查“类型对不对”，没人查“类型在不在 import 列表”。


## TS2322 形态：`as Record<string, X>` 错 X 类型

**签名**：
```
SubAccountForm.vue(338, 19): error TS2322: Type 'unknown' is not assignable to type
  EpPropMergeType<(new (...args: any[]) => FormItemRule | FormItemRule[]) | (() => Arrayable<FormItemRule>) | ((new (...args: any[]) => FormItemRule | FormItemRule[]) | (() => Arrayable<...>))[], unknown, unknown>
  | undefined'
form-item.vue.d.ts(98, 14): The expected type comes from property 'rules' which is declared here on type 'Partial<{...}> & Omit<...> & Record<...>'
```

**根因**：`as Record<string, X>` 让任意 string 索引合法，但**值类型被设为 X**。如 X 是 `unknown` / `any`，下游期望具体类型（如 `FormItemRule | FormItemRule[]`）时必报 `TS2322: Type unknown is not assignable`。

```ts
// 错修（line 338 / 360 原版）：unknown 下游期望 FormItemRule 报 TS2322
:rules="(rules as Record<string, unknown>)[field.fieldCode]"

// 正修：保留值类型 = FormItemRule[]，下游 form-item 接得上
:rules="(rules as Record<string, FormItemRule[]>)[field.fieldCode]"
```

**为什么前 5 个升级项都不报**：本形态涉及"**cast 后值类型与下游期望不兼容**"——skill 之前 5 个升级（TS2345 spread / 透传 / TS2339 Set / TS2339 fieldCode / TS2304 未 import）都查"类型对不对 / 在不在 import"，**不查"cast 后值类型下游接不接得住"**。

**判断方法（grep 主动扫）**：

```bash
# 步骤 1：grep 所有 `as Record<string, X>` / `as Record<string, X[]>` 形式
grep -nE "as\s+Record<string,\s*\w+(\[\])?>" src/ -r --include="*.ts" --include="*.vue"

# 步骤 2：提取 X 分类统计（出现次数）
grep -hoE "as\s+Record<string,\s*\w+(\[\])?>" src/ -r --include="*.ts" --include="*.vue" | \
  sed -E 's/as\s+Record<string,\s*(\w+(\[\])?)>/\1/' | sort | uniq -c | sort -rn

# 步骤 3：标记 `X = unknown | any` 为可疑，agent Read 上下文
# 步骤 4：查看下游 props / 函数 / 形参 期望的"具体类型"（element-plus / type.ts 定义）
```

**Cashier 项目验证**：全仓 22 处 `as Record<string, X>` 命中：

| X 出现次数 | 类型 | 是否可疑 |
|---|---|---|
| 10 | `unknown` | **可疑**：几乎都是错修 |
| 9 | `string` | 合法：`Object.fromEntries(...)` 后转 dict |
| 2 | `FormItemRule[]` | 正确：本次修法 |
| 1 | `any` | **可疑**：下游期望具体类型时必报 |

**判断哪些是错修**：

| X | 何时错修 | 何时合法 |
|---|---|---|
| `unknown` | 几乎都是错修（下游接不住）| 几乎没合法场景 |
| `any` | 下游期望具体类型时错修 | 仅"明确不关心下游类型"（罕见）|
| `string` | 错修（下游期望 string 时可选，但用 `unknown` 更错）| `Object.fromEntries(...) as Record<string, string>` 后转 dict 是合法用法 |
| `FormItemRule[]` / `UserType` | 几乎都是正确 | 保留具体类型 = 正确修法 |

**修法（ponytail rung 1 最小改）**：

```bash
# 1. 查下游 props / 函数 / 形参 期望的类型
grep -n "rules\s*\??\s*:" node_modules/element-plus/es/components/form/src/form-item.mjs  # 或 form-item.vue.d.ts
# 期望：FormItemRule | FormItemRule[] | (() => Arrayable<FormItemRule>) | ...

# 2. 改 cast X
:rules="(rules as Record<string, FormItemRule[]>)[field.fieldCode]"
# 如 X 是 union：写 X | X[]

# 3. import 该类型（如未 import）
import type { FormItemRule } from "element-plus"
```

**本次 case 修法**：line 10 加 `FormItemRule` import；line 338 / 360 `as Record<string, unknown>` → `as Record<string, FormItemRule[]>`。0 业务改动。

**与其它形态的区别**：

| 形态 | 错误码 | 报点 | 根因 |
|---|---|---|---|
| TS2551 字段不存在 | TS2551 | 调用方用了字段名 | 字段名拼错 / 接口过时 |
| TS2345 spread 后类型不兼容（形态 A）| TS2345 | `return { ...item }` 传参 | 形参是 union literal，源是 string |
| TS2345 透传形参（形态 B）| TS2345 | 对象字面量字段透传 | 同形态 A，无 spread |
| TS2339 Set<T> vs Array（形态 C）| TS2339 | `set.length` / `set.some` | props 误声明 Set，内部用 Array 方法 |
| TS2304 未 import 类型（形态 D）| TS2304 | `const x: X = ...` | 用了类型但没 import |
| **TS2322 `as Record<string, X>` 错 X**（形态 E）| TS2322 | cast 后值类型 | X 是 `unknown` / `any` 下游接不住 |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描"新增的"`as Record<string, X>` 错 X 类型"扫描项。本形态是 2026-10-10 实际修复 `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/components/SubAccountForm.vue` line 338 / 360 时发现——前 5 个升级都查“类型对不对 / 在不在 import”，不查“cast 后值类型下游接不接得住”。cashier 项目 11 处 `unknown` / `any` cast 里有 7+ 处下游会报 TS2322，是高频率的隐错。


## TS2345 / TS2339 形态：`as const` 元素 union 传给函数形参字段不对齐

**签名**（两阶段）：
```
// 阶段 1：形参字段不足（TS2345）
formatValue.ts(196, 56): error TS2345: Argument of type
  '{ readonly key: "account"; readonly label: "取数宝账号"; } | { readonly key: "password"; ... readonly mask: true; } | ... 5 more ...'
  is not assignable to parameter of type '{ mask?: boolean | undefined; yesno?: boolean | undefined; }'
  Type '{ readonly key: 'account'; readonly label: '取数宝账号'; }' has no properties in common with type
  '{ mask?: boolean | undefined; yesno?: boolean | undefined; }'

// 阶段 2：形参是精确 literal union，访问某字段（TS2339）
formatValue.ts(199, 7): error TS2339: Property 'mask' does not exist on type
  '{ readonly key: "account"; readonly label: "取数宝账号"; } | { ... readonly mask: true; } | ...'
  Property 'mask' does not exist on type '{ readonly key: 'account'; readonly label: '取数宝账号'; }'
```

**根因**：`as const` 把数组 / 对象元素变成**精确 literal union**——每个元素只有自己有的字段（如 `{ key: "account", label: "取数宝账号" }` **没** mask/yesno；`{ key: "password", label: "密码", mask: true }` **没** yesno）。

调用 `formatValue(raw, f)` 传 `f: SUB_ACCOUNT_FIELDS[number]` 时，TS 严格检查每个 union 成员与形参的兼容性：

| 形参形态 | 错误 | 原因 |
|---|---|---|
| `f: { mask?, yesno? }` | TS2345 | union 第一项 `account` 根本没 `mask/yesno` 字段 |
| `f: typeof X[number]` | TS2339（内部 `f.mask`）| 形参是精确 literal union，`account` 元素没 `mask` |
| `f: { key, label, mask?, yesno? }` | ✓ | union literal `key: "account"` 可赋给 `key: string`（subtype → supertype）|

**本次 case 错误 - 错误 - 正确三连**：

```ts
// 错（1）原版：f: { mask?, yesno? } —— union 第一项 account 缺字段报 TS2345
function formatValue(raw: unknown, f: { mask?: boolean, yesno?: boolean }): string { ... }

// 错（2）我上次修法：f: typeof SUB_ACCOUNT_FIELDS[number] —— 形参是精确 union，内部 f.mask 报 TS2339
function formatValue(raw: unknown, f: typeof SUB_ACCOUNT_FIELDS[number]): string {
  if (f.mask) return "********"  // TS2339：account 元素没 mask
}

// 正：f: { key, label, mask?, yesno? } —— 共有字段 + supertype + 可选
function formatValue(raw: unknown, f: { key: string, label: string, mask?: boolean, yesno?: boolean }): string {
  if (f.mask) return "********"  // ✓ boolean | undefined narrowing
}
```

**为什么前 6 个升级项都不报**：本形态涉及 "**`as const` 元素 union 与函数形参字段对齐**"——skill 之前 6 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 未 import / TS2322 错 X）都查"spread / 简写 / Set / cast / import"，**不查"`as const` 元素 + 函数形参"**这种业务常见形态。

**判断方法（grep 主动扫）**：

```bash
# 步骤 1：找所有 as const 数组 / 对象
grep -nE '\]\s*as\s+const|\}\s*as\s+const' src/ -r --include="*.ts" --include="*.vue"

# 步骤 2：对每个 as const 所在文件，找函数形参是对象字面量类型 或 typeof X[number]
grep -nE 'function\s+\w+\([^)]*:\s*\{[^}]+\}|function\s+\w+\([^)]*:\s*typeof\s+\w+\[number\]' src/ -r --include="*.ts" --include="*.vue"

# 步骤 3：看函数体访问的字段 vs 形参声明字段 / vs 元素 union 字段
# 形参是 typeof X[number] 形式 + 内部访问 X 元素中“部分才有”的字段 → TS2339
# 形参是 { ... } 对象 + 字段少于调用方 X 元素中“每个都有”的字段 → TS2345
```

**Cashier 验证**：`as const` 数组 cashier 7 处：

| 文件 | 元素字段示例 | 传给函数 |
|---|---|---|
| `AccountChangeDetails/index.vue:148` | `SUB_ACCOUNT_FIELDS` 元素 10 个 literal 对象 | `formatValue` / `renderSide` |
| `AccountChangeDetails/addOrEdit/detail.vue:55` | 详情描述 | 详情渲染 |
| `StoreAuditOnboarding/enum/index.ts:25` | `SHOP_STATUS_*` 枚举 | `getLabel` |
| `storeEntryPlatform/enum/index.ts:36` | `subAccountFieldPool` 8 项 | `SubAccountForm` 字段池 |
| `company/index.vue:247` | 标签 / 显示 | 列表渲染 |
| `company/addOrEdit/add.vue:76` | 业务异常统计 | 表格渲染 |
| `StoreAuditOnboarding/addOrEdit/enum/index.ts:26` | 字段 | 表格列 |

**判断哪些是错修**：

| 形参 | 错 / 正 | 原因 |
|---|---|---|
| `f: { mask?: boolean, yesno?: boolean }` | **错**（TS2345）| 缺 `key/label` 共有字段 |
| `f: typeof X[number]`（精确 union）| **错**（TS2339）| 形参是精确 literal union，访问部分元素才有的字段报 TS2339 |
| `f: { key: string, label: string, mask?: boolean, yesno?: boolean }` | **正** | 共有字段 + supertype + 可选 |

**修法（ponytail rung 1 最小改）**：

1. 提取 `as const` 数组 / 对象的元素 union
2. 列出 union **每个成员都有的字段**（必传）= `key/label` 等
3. 列出 union **部分有的字段**（可选）= `mask/yesno` 等
4. 形参 = `{ 必传字段: supertype, ..., 可选字段?: supertype }` —— **避免"字面量多反少漏"的双向错**
5. 避免 `f: typeof X[number]`（精确 literal union）除非函数只读不写某个字段

**与其它形态的区别**：

| 形态 | 错误码 | 报点 | 根因 |
|---|---|---|---|
| TS2551 字段不存在 | TS2551 | 调用方用了字段名 | 字段名拼错 / 接口过时 |
| TS2345 spread 后类型不兼容（形态 A）| TS2345 | `return { ...item }` 传参 | 形参是 union literal，源是 string |
| TS2345 透传形参（形态 B）| TS2345 | 对象字面量字段透传 | 同形态 A，无 spread |
| TS2339 Set<T> vs Array（形态 C）| TS2339 | `set.length` / `set.some` | props 误声明 Set，内部用 Array 方法 |
| TS2304 未 import 类型（形态 D）| TS2304 | `const x: X = ...` | 用了类型但没 import |
| TS2322 `as Record<string, X>` 错 X（形态 E）| TS2322 | cast 后值类型 | X 是 `unknown` / `any` 下游接不住 |
| **TS2345 / TS2339 `as const` 元素 union 传给函数形参**（形态 F）| TS2345 / TS2339 | `formatValue(raw, f)` 形参字段 | 形参缺共有字段 / 形参是精确 union |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 "类型嫌疑主动扫描"新增的"`as const` 元素 union 传给函数形参字段不对齐"扫描项。本形态是 2026-10-10 实际修复 `ob_web/packages/micro/cashier/src/pages/AccountChangeDetails/index.vue` line 196 时发现——前 6 个升级都查"spread / 简写 / Set / cast / import"，不查"`as const` 元素 union 与函数形参字段对齐"。cashier 项目 7 处 `as const` 数组中常传给 `getLabel` / `format` / `toXxx` 助手函数，错修高频。


## TS7053 / TS2322 形态 G：后端契约跟前端类型对齐（3 子形态）

**现场**（2026-10-13）：`ob_web/packages/micro/cashier/src/pages/AccountChangeDetails` 改造「原/新 14 列 + JSON snapshot」后，后端 Java 删 14 列 + 新增 `subaccount_field_snapshot` JSON 列，前端 type / helper 函数 / 后端 VO 三处契约名没对齐，一次性报 3 个 TS 错误。

### 子形态 G-1：TS7053 — 后端 JSON key 跟函数形参 key 不一致

```ts
// 后端 Java 写 JSON：{"original":{...},"new":{...}}
// 前端 interface 跟后端对齐
interface SubAccountSnapshot { original?: SnapshotSide, new?: SnapshotSide }

// 但函数形参沿用旧命名 "orig" | "new"
function readFieldValue(side: "orig" | "new", key: string) {
  const snap = JSON.parse(json) as SubAccountSnapshot
  return snap[side]?.[snapKey]  // ❌ TS7053: 'orig' | 'new' can't index SubAccountSnapshot（接口只有 "original" | "new"）
}
```

**根因**：函数形参是业务命名（`orig` / `new`），接口 key 是后端契约（`original` / `new`）—— **业务命名 ≠ JSON key**。

**修法（ponytail rung 1 最小改）**：函数内做映射，不动接口 / 不动调用方：

```ts
// ponytail: 后端 JSON key 是 "original"/"new"，函数形参是 "orig"/"new"，调用处统一映射
const snapSide = side === "orig" ? "original" : "new"
return snap[snapSide]?.[snapKey]
```

**为什么前 7 个升级不报**：本形态是 **「后端契约名 ≠ 前端业务名」**，前 7 个都查 TS 类型层（spread / Set / cast / import / element union），**不查"前后端契约名漂移"**。

### 子形态 G-2：TS2322 — 前端 type 字段名跟后端 VO 字段名拼错

```ts
// 后端 VO 实际字段名
public class AccountChangeDetailsVO {
  private String originalPasswordCipher;  // 真实是 Cipher
  private String newPasswordCipher;
}

// 前端 type 猜名字（错！）
interface AccountChangeDetailsVO {
  originalPasswordMasked?: string  // ❌ 跟后端 VO 字段名不匹配
  newPasswordMasked?: string
}

// 调用方想读 password 字段
const LEGACY_FIELD_TO_VO: Record<string, { orig: keyof AccountChangeDetailsVO, ... }> = {
  password: { orig: "originalPasswordCipher", ... }  // ❌ TS2322: '"originalPasswordCipher"' is not assignable to type 'keyof AccountChangeDetailsVO'
}
```

**根因**：前端 type 写错了字段名（**Masked** vs **Cipher**）；后端 VO 是 source of truth，**前端必须跟后端字段名一致**。

**修法**：
```ts
// 改前端 type 跟后端 VO 对齐（不能猜）
interface AccountChangeDetailsVO {
  originalPasswordCipher?: string
  newPasswordCipher?: string
}
```

**抓的方法**：
```bash
# 步骤 A：看后端 VO 字段名（source of truth）
grep -E "private String (original|new)" /D/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/vo/AccountChangeDetailsVO.java

# 步骤 B：grep 前端 type 字段名
grep -E "(original|new)\w+\?" /D/OB/ob_web/packages/micro/cashier/src/api/account-change-audit.ts

# 步骤 C：diff A vs B
# 同名 → ✅ 一致
# 后端有但前端没 / 前端有但后端没 → 报告「字段名拼错 / 漏 import / 漏声明」
```

**为什么前 7 个升级不报**：本形态是 **「跨仓类型漂移」**（前端 type.ts vs 后端 VO.java），前 7 个都查单仓类型层，**不查跨仓契约**。

### 子形态 G-3：TS2322 — `row[keyof X]` 返回类型不精确

```ts
// 后端 VO 字段类型不一：string / number / boolean 都有
interface AccountChangeDetailsVO {
  id: number                          // number
  operatorId?: string                 // string
  isRpaAccount?: string               // string
  placeholderFlag?: boolean           // boolean
  // ... 几十个字段类型 union
}

// 前端函数形参是 keyof X（精确字面量 union）
const vo = LEGACY_FIELD_TO_VO[key]  // vo.orig / vo.new: keyof X
return vo ? row[vo[side]] : undefined  // row[keyof X] 推成 string | number | boolean | undefined
                                          // ❌ TS2322: 不能赋给函数返回类型 string | null | undefined
```

**根因**：`row[keyof X]` TypeScript 索引访问返回**所有字段类型的 union**（包含 number / boolean / undefined），不是精确类型。

**修法（ponytail rung 1 最小改）**：
```ts
// 方案 A：函数返回类型放宽到 unknown（让 formatValue(String) 内部转换）
function readFieldValue(row, side, key): unknown {
  // ...
  return vo ? row[vo[side]] : undefined  // type: unknown
}

// 方案 B：as 类型断言（不推荐，掩盖类型）
return vo ? row[vo[side]] as string : undefined  // ❌ 危险，row[vo.orig] 实际可能是 undefined
```

**为什么选 A**：formatValue 接受 `unknown` + 内部 `String(raw)` 转换——上层调用方（renderSide / readField）一直走 formatValue，不需要强类型。

**抓的方法**：
```bash
# 找所有 row[keyof X] / obj[keyof X] / obj[vo[key]] 索引访问
grep -nE '\b\w+\[(keyof\s+\w+|vo\[.*\])\]' src/ -r --include="*.ts" --include="*.vue"
# 命中 + 函数返回类型是 string | null | undefined → 报告 "row[vo.x] 推成 string|number|boolean|undefined，函数签名需放宽到 unknown"
```

**为什么前 7 个升级不报**：本形态是 **「索引访问推断 union」**——前 7 个都查"声明 vs 实际调用"，**不查"索引访问的返回类型"**。

### 3 子形态通用修法（按"对齐到 source of truth"原则）

| 子形态 | source of truth | 对齐方向 |
|---|---|---|
| G-1（JSON key 不一致）| **后端 Java 序列化**（`Map<String, Object>` 的 put key）| 函数内映射（不改 JSON、不改形参）|
| G-2（VO 字段名错）| **后端 Java VO 字段** | **前端 type 改对**（不能猜名字）|
| G-3（索引返回类型不精确）| **后端 Java VO 字段类型 union** | **前端函数返回类型放宽**到 `unknown`，让 `formatValue` 内部 `String()` 转换 |

**共同根因**：「**后端契约（Java PO/VO/JSON）**」与「**前端 type / 函数形参**」**两边没对齐**。前 7 个升级都查 TS 类型层内的 mismatch，**不查"前后端契约"层的 mismatch**。

**Cashier 实际命中**（2026-10-13 一次修复同时遇到 3 个）：

| 文件 | 行 | 错误 |
|---|---|---|
| `AccountChangeDetails/addOrEdit/detail.vue` | 87 | G-1 TS7053 `snap[side]?.[snapKey]` side 是 `"orig" \| "new"`，snap key 是 `"original" \| "new"` |
| `AccountChangeDetails/index.vue` | 168 | G-2 TS2322 `"originalPasswordCipher"` 不在 `keyof AccountChangeDetailsVO`（前端 type 写错成 `*Masked`）|
| `AccountChangeDetails/index.vue` | 187 | G-3 TS2322 `row[vo[side]]` 返回 `string \| number \| boolean \| undefined` 不能赋给 `string \| null \| undefined` |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 新增的"后端契约跟前端类型对齐 3 子形态"扫描项。本形态是 2026-10-13 实际改造 `cashier_store_account_change_details` 表「14 列 → 1 JSON 列」时一次性遇到——前 7 个升级都查"TS 类型层"，不查"前后端跨仓契约"。cashier 项目改造「表结构 + VO 字段 + 前端 type」是高频场景，**改之前必做"前后端字段名 diff"**。


## packages/share 既有类型错误（不在本目录职责内）

修正 tsconfig paths 后，`vue-tsc` 会把 share 本地源码自身的问题也带出来，**不要顺手改共享包**：

| 报错 | 说明 |
|---|---|
| `packages/share/components/Business/Approval/flowableDialog/FlowableDialog.vue(9,20): Could not find a declaration file for module 'bpmn-js/lib/Viewer'` | BPMN 组件 dev 阶段未完成，tsconfig 注释里已声明「先跳过」 |
| `packages/share/node_modules/.pnpm/vue-cropper@1.1.4/...: Could not find a declaration file for module './vue-cropper.vue'` | vue-cropper 缺 .vue 声明 |

两者都**不阻塞 `vite build`**（构建脚本只跑 `vite build`，不跑 vue-tsc）。需要处理时应改 `packages/share`，并知会共享包维护方。


