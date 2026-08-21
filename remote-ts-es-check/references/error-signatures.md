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

## packages/share 既有类型错误（不在本目录职责内）

修正 tsconfig paths 后，`vue-tsc` 会把 share 本地源码自身的问题也带出来，**不要顺手改共享包**：

| 报错 | 说明 |
|---|---|
| `packages/share/components/Business/Approval/flowableDialog/FlowableDialog.vue(9,20): Could not find a declaration file for module 'bpmn-js/lib/Viewer'` | BPMN 组件 dev 阶段未完成，tsconfig 注释里已声明「先跳过」 |
| `packages/share/node_modules/.pnpm/vue-cropper@1.1.4/...: Could not find a declaration file for module './vue-cropper.vue'` | vue-cropper 缺 .vue 声明 |

两者都**不阻塞 `vite build`**（构建脚本只跑 `vite build`，不跑 vue-tsc）。需要处理时应改 `packages/share`，并知会共享包维护方。
