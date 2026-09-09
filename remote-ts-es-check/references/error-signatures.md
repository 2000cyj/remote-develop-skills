# 错误签名 → 根因 → 修复

本文件是 remote-ts-es-check 的深度参考。先对照签名定位，再动手。只有签名位于本次任务的编辑文件和 changed hunks 内时才修复；根因或修复点落在范围外时只报告，不扩大修改范围。

## TS2554：renderDialog 参数个数

**签名**：`src/components/*/index.vue(62,5): error TS2554: Expected 1-3 arguments, but got 4.`

**根因**（cashier 最经典的坑）：`@ob-web/share` 的类型被解析到了 **node_modules 里的过期安装包**，而不是本地源码。

- 本地源码 `packages/share/components/Dialog/index.ts` 的 `renderDialog` 是 **4 参**：
  `renderDialog(component, props, modalProps, slots?)`（第 4 参 `slots` 转发插槽）。
- node_modules 里的 `@ob-web/share@1.0.0` dist-types 是 **3 参**（没有 `slots`）：
  `renderDialog(component, props, modalProps)`。

**为什么解析错**：`tsconfig.json` 的 `paths` 相对 `baseUrl`（= cashier 目录）解析。

| 写法 | 实际解析路径 | 结果 |
|---|---|---|
| `"../../share/index.ts"` ✅ | `packages/share/index.ts` | 本地源码（对） |
| `"../../packages/share/index.ts"` ❌ | `packages/packages/share/index.ts`（不存在） | TS 回落 node_modules 过期类型 |

vite.config.ts 的 alias 用的是 `resolve(__dirname, "../../share")`，tsconfig 必须与之一致。

**修复**：如果 `tsconfig.json` 本身就在本次任务编辑清单内，修正为：
```json
"paths": {
  "@/*": ["src/*"],
  "@@/*": ["src/common/*"],
  "@ob-web/share": ["../../share/index.ts"],
  "@ob-web/share/*": ["../../share/*"]
}
```

**别乱修调用处**：`renderDialog(Content, props, { ... }, { brand: slots.brand, tags: slots.tags })` 的第 4 参是刻意的插槽转发，不是写错。根因在 tsconfig，不在调用。若 `tsconfig.json` 不在编辑清单内，只报告根因，不修改调用处或配置。

## style/member-delimiter-style

**签名**：`style/member-delimiter-style: Expected a comma`（多列，都在同一行内）。

**根因**：antfu 风格要求单行内联类型字面量的成员用 `,` 分隔；多行成员（各自独立一行、无分隔符）不受影响。

```ts
// ❌ 单行内联类型用了分号
onSave: (data: { file: Record<string, any>; tagNameList: string[] }) => emit("save", data)
// ✅ 用逗号
onSave: (data: { file: Record<string, any>, tagNameList: string[] }) => emit("save", data)
```

## vue/valid-template-root

**签名**：`The template requires child element`。

**根因**：`<template>` 里只有注释（或为空），没有根元素。典型场景是「命令式弹窗触发层」这类不渲染 DOM 的组件。

**修复**：确实不渲染就把整个 `<template>` 块删掉，组件只剩 `<script setup>`，照样合法（渲染为空）。说明文字放进 script 注释或文件头注释。

## no-multiple-empty-lines / unused-imports / 未使用 eslint-disable

- `style/no-multiple-empty-lines`：连续空行合并为一个。
- `unused-imports/no-unused-imports`：删除未使用的 import。
- 未使用 `eslint-disable`：多半是规则在 eslint.config.js 里被 `off` 了（如 `perfectionist/sort-imports: "off"`），直接删注释行。

## 格式类 warning（手工修复）

- `vue/singleline-html-element-content-newline` / `vue/multiline-html-element-content-newline`：元素内容换行。
- 这些是纯格式，按 ESLint 报告手工修正对应 changed hunk。不要使用 `--fix`；它可能改写同一文件中的未编辑代码。

## TS2554：参数个数不匹配（3 种形态）

### 形态 1：share 包路径解析到过期 dist-types

**签名**：`Expected 1-3 arguments, but got 4.`

**根因**：`@ob-web/share` 的类型被解析到 node_modules 过期 dist-types，而不是本地源码。本地 `renderDialog` 是 4 参（带 `slots`），过期 dist-types 是 3 参。

**修复**：修正 `tsconfig.json` 的 `paths`：`"@ob-web/share": ["../../share/index.ts"]`。若 `tsconfig.json` 不在编辑清单内，只报告根因。

### 形态 2：函数本身被覆盖（require 解析顺序）

**签名**：`Expected 1 arguments, but got 2.`

**根因**：同名的工具函数被本地 composable 重新声明（同名覆盖），签名比原函数少 1 个参数。**判断方法**：grep 同名函数在 `src/` 内出现位置，对比各处签名。

### 形态 3：调用方误传第 2 参数（API 实际只接 1 参数）

**签名**：
```
src/pages/storeAuditChange/index.vue(NN,CC): error TS2554: Expected 1 arguments, but got 2.
```

**根因**：调用方 `someApi(uniqueValue, { version, idempotencyKey })` 以为 API 接 2 个参数，但实际 `someApi(uniqueValue: string)` 只接 1 个。后端 controller 通常 `@RequestParam("uniqueValue") String` 也只接 1 参数。

**判断方法**：
1. 读 `apis/index.ts` 看 `someApi` 实际签名
2. 读后端 Controller 看入参（`@RequestParam` / `@RequestBody`）
3. 两者都只 1 参数 → 调用方误传

**修复**：删调用方第 2 参数。**业务逻辑 0 改动**——多余参数在 HTTP 请求时不被发送（`request` 库只认 `params / data`），后端也不接收。

```ts
// ❌ 调用方误传
const res = await deleteCompanyChangeApi(row.uniqueValue, {
  version: row.version || 0,
  idempotencyKey: nanoid()
})

// ✅ 与 API 签名对齐
const res = await deleteCompanyChangeApi(row.uniqueValue)
```

**顺带连锁**：删除调用后该文件可能不再使用某些 import（如 `nanoid`），按 changed-hunk 范围约束可一并清掉。

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

## packages/share 既有类型错误（不在本目录职责内）

修正 tsconfig paths 后，`vue-tsc` 会把 share 本地源码自身的问题也带出来，**不要顺手改共享包**：

| 报错 | 说明 |
|---|---|
| `packages/share/components/Business/Approval/flowableDialog/FlowableDialog.vue(9,20): Could not find a declaration file for module 'bpmn-js/lib/Viewer'` | BPMN 组件 dev 阶段未完成，tsconfig 注释里已声明「先跳过」 |
| `packages/share/node_modules/.pnpm/vue-cropper@1.1.4/...: Could not find a declaration file for module './vue-cropper.vue'` | vue-cropper 缺 .vue 声明 |

两者都**不阻塞 `vite build`**（构建脚本只跑 `vite build`，不跑 vue-tsc）。需要处理时应改 `packages/share`，并知会共享包维护方。
