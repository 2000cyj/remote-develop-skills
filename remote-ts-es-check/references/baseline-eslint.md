# ESLint 基础错 + 格式 + 工具类（baseline）

本文件是 remote-ts-es-check 的 reference。包含：基础 ESLint 错（style/vue/imports/格式）+ jsdoc + 死代码 + Tailwind。**与 `ts-typing.md`（TS 错误签名）和 `reactive-errors.md`（reactive 4 形态）互不重叠**。

先对照签名定位，再动手。只有签名位于本次任务的编辑文件和 changed hunks 内时才修复；根因或修复点落在范围外时只报告，不扩大修改范围。

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


## jsdoc/multiline-blocks：JSDoc 起始行同行接文字

**签名**：`error  Should have no text on the "0th" line (after the \`/**\`)  jsdoc/multiline-blocks`

**根因**：JSDoc 块注释的写法不规范——把文字直接写在 `/**` 同行，而不是 `/**` 单独一行 + ` *` 起头。

| 错误写法（lint 报错） | 正确写法 |
|---|---|
| `/** 加载主体池中的公司列表；keyword 空表示不过滤。<br> *  ponytail: 累加重查 ... */` | `/**<br> * 加载主体池中的公司列表；keyword 空表示不过滤。<br> *<br> * ponytail: 累加重查 ...<br> */` |

**为什么容易踩坑**：手写 JSDoc 时习惯"标题+说明"一段写完，遇到多行注释下意识 `/** <标题>` 起头；后半段用 ` * <说明>` 续行——后半段 OK，但首行违规。

**触发场景**：
1. 新增复杂函数/常量注释，原本想"标题+解释一段写完" → 触发
2. 老旧 markdown 文档转换 → 触发
3. 从 Java 后端注释风格移植（Java 是 `/**\n * <text>\n */` 自动换行） → TypeScript 风格需手动起新行

**判断方法**：
```bash
grep -nE "^\s*/\*\* [^/\*\s]" src/ -r --include="*.ts" --include="*.vue"
```
- 匹配项 = 违规
- 期望：所有 `/**` 后跟空行或 ` *`

**修复**：把违规的 `/** <text>` 改成：
```
/**
 * <text>
 */
```
所有原本在第一行的" * ponytail: ..."也提到主体注释内部。

**业务逻辑 0 改动**：纯注释格式调整，运行时无影响。

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位） | import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown） | `const x = () => arr.map(...)` 无签名 → 返回 `unknown[]` |
| TS2322（mock 缺字段） | mock / test 数据 vs 接口契约字段缺失 |
| **jsdoc/multiline-blocks** | **JSDoc 起始行 `/**` 同行接文字** |

**SKILL 升级点**：见 `SKILL.md` 第 6 步"格式嫌疑主动扫描"新增的"JSDoc 起始行同行接文字"扫描项。本形态是 2026-09-21 实际修复
- `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/detail.vue` line 60/138/169/177
- `ob_web/packages/micro/cashier/src/pages/AccountChangeDetails/index.vue` line 43/48
时发现。


## 未使用代码（死代码 + 孤儿 API）

**签名**：`error  '_xxx' is assigned a value but never used  no-unused-vars`

ESLint 默认配置（ cashier 项目）禁用了 `no-unused-vars`（避免误报 props/emits），导致默认 lint 0 报错时仍有大量死代码残留。

**典型形态**：

| 形态 | 例子 | 处理 |
|---|---|---|
| **下划线前缀死代码** | `const _pageTitle = computed(...)`<br>`function _handleAddToQueue() {...}` | **直接删除**（下划线只是 ESLint 逃生口，不是合法命名） |
| **孤儿 API 函数** | `export function listAllFileTagsApi(...)` 无任何调用方 | **删除** |
| **未使用 import** | `import { foo } from "..."` 但文件内未引用 | 删除 |

**为什么容易踩坑**：

1. **历史遗留**：写完代码后逻辑改了，但变量 / 函数忘了删。
2. **逃生口习惯**：发现 ESLint 报警后下意识加下划线前缀或 `eslint-disable`，问题从"代码死"变成"代码隐式死"。
3. **大文件重构**：一次重构后部分函数 / import 变孤儿，但代码量大不易一眼看出。

**主动扫描方法（不依赖项目 ESLint 配置）**：

```bash
# 步骤 1: CLI 开启 no-unused-vars 扫一遍
npx eslint src/<scope> --ext .ts,.vue \
  --rule '{"unused-imports/no-unused-imports":"error","no-unused-imports":"error","unused-imports/no-unused-vars":"error","no-unused-vars":"error","vue/no-unused-components":"error","vue/no-unused-vars":"error"}'

# 步骤 2: grep 下划线前缀变量/函数（不依赖 ESLint 配置）
grep -nE '(const|let|function|class)\s+_\w+\s*[=(:]' src/ -r --include="*.ts" --include="*.vue"

# 步骤 3: grep apis 目录的所有 export 函数，验证每个有调用方
grep -nE '^export\s+(async\s+)?function\s+\w+' src/ -r --include="*.ts" --include="*.vue"
# 然后对每个函数 grep 跨文件调用方
```

**判断 "真死代码 vs 假装豁免"**：

| 标志 | 判断 | 处理 |
|---|---|---|
| `_xxx` 仅声明 1 次，无其他引用 | 真死代码 | **删** |
| `_xxx` 被其他代码引用（如 `_handleAddRowToQueue(companyId)`） | 合法命名约定 | 保留 |
| `_<slot-name>` / Vue slot 占位符 | Vue 模板约定 | 保留 |
| `_<event-name>` 事件保留名 | 框架约定 | 保留 |

**修复**：
1. 真死代码：直接删除 var / const / function / import 行
2. 假装豁免（`_xxx`）：去掉下划线前缀（如果代码真用）或删除（如果真死）
3. 孤儿 API 函数：删除函数体（保留 interface type 如果仍被用）

**业务逻辑 0 改动**：删除未引用代码，运行时无影响。

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位） | import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown） | `const x = () => arr.map(...)` 无签名 → 返回 `unknown[]` |
| TS2322（mock 缺字段） | mock / test 数据 vs 接口契约字段缺失 |
| jsdoc/multiline-blocks | JSDoc 起始行 `/**` 同行接文字 |
| **未使用代码（默认 ESLint 不抓）** | **项目 eslint.config.js 默认禁用 no-unused-vars 导致死代码 + 孤儿 API 残留** |

**SKILL 升级点**：见 `SKILL.md` 第 6 步后新增的"未使用代码主动扫描"步骤。本形态是 2026-09-21 实际清理
- `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/apis/index.ts` `listAllFileTagsApi`（孤儿 API）
- `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/detail.vue` line 308 `_detailCurrentNodeLabel` + line 414 `_handleAddToQueue`（下划线前缀死代码）
- `ob_web/packages/micro/cashier/src/pages/StoreAuditOnboarding/addOrEdit/fill.vue` line 30 `_pageTitle`（下划线前缀死代码）
时发现。

**反思**：之前 ESLint 清零时加下划线前缀保留"死代码"是错的——下划线让 ESLint 不报警，但死代码仍存在。下划线前缀**只在框架占位（Vue slot / 事件保留名）时**才合法；普通业务逻辑的"为了 ES 不报警加下划线"是错误逃生口。


## Tailwind 任意值需等价短写（IDE Tailwind IntelliSense 提示）

**签名**（IDE 提示不是 ESLint 报错，需 grep 主动扫）：
```
The class `min-h-[48px]` can be written as `min-h-12`
The class `px-[16px]` can be written as `px-4`
The class `rounded-[2px]` can be written as `rounded-sm`
```

**根因**：Tailwind 默认 spacing 比例（1 单位 = 0.25rem = 4px）和默认字号表存在近似等价项，IDE Tailwind IntelliSense 提示用户"用更短的等价写法"。IDE 飘红，不影响运行。**不是 ESLint 报错——ESLint 查不出，需 grep 主动扫**。

**默认比例映射表**：

| 原写法 | 短写 |
|---|---|
| `gap-\[4px\]` / `gap-\[8px\]` / `gap-\[12px\]` / `gap-\[16px\]` | `gap-1` / `gap-2` / `gap-3` / `gap-4` |
| `gap-\[6px\]` | `gap-1.5` |
| `p-\[12px\]` / `p-\[16px\]` / `p-\[24px\]` | `p-3` / `p-4` / `p-6` |
| `px-\[12px\]` / `px-\[16px\]` / `px-\[24px\]` | `px-3` / `px-4` / `px-6` |
| `py-\[4px\]` / `py-\[8px\]` / `py-\[12px\]` / `py-\[16px\]` / `py-\[20px\]` / `py-\[24px\]` | `py-1` / `py-2` / `py-3` / `py-4` / `py-5` / `py-6` |
| `mb-\[8px\]` / `mb-\[12px\]` / `mb-\[16px\]` | `mb-2` / `mb-3` / `mb-4` |
| `mt-\[8px\]` / `ml-\[4px\]` / `mx-\[2px\]` | `mt-2` / `ml-1` / `mx-0.5` |
| `space-y-\[16px\]` | `space-y-4` |
| `min-h-\[48px\]` | `min-h-12` |
| `w-\[4px\]` / `w-\[6px\]` / `w-\[8px\]` | `w-1` / `w-1.5` / `w-2` |
| `h-\[8px\]` / `h-\[14px\]` / `h-\[18px\]` | `h-2` / `h-3.5` / `h-4.5` |
| `rounded-\[2px\]` / `rounded-\[3px\]` / `rounded-\[8px\]` / `rounded-\[10px\]` | `rounded-sm` / `rounded` / `rounded-lg` / `rounded-xl` |
| `text-\[12px\]` / `text-\[14px\]` / `text-\[16px\]` | `text-xs` / `text-sm` / `text-base` |

**不可转换（保留任意值）**：

| 原写法 | 为什么保留 |
|---|---|
| `rounded-\[20px\]` | 不是 `rounded-full`（9999px 棚圆），也不是默认比例，保留 |
| `text-\[13px\]` / `text-\[15px\]` | 不在 Tailwind 默认字号比例，保留 |
| `bg-\[#xxx\]` / `text-\[#xxx\]` / `border-\[#xxx\]` 颜色 | 不在默认色板，保留为任意值 或抽到 `<style scoped>` |
| `shadow-\[0_0_0_3px_rgba(...)\]` | 自定义阴影必保留 |
| `bg-\[linear-gradient(...)\]` | 自定义渐变必保留 |
| `border-\[rgba(...)\]` | rgba 颜色不在默认色板 |

**主动扫描方法**（ESLint 抓不到，需 grep + 正则）：

```bash
# 扫所有 spacing / sizing 任意值
grep -hoE '\b(min-h|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|rounded|w|h|space-x|space-y|top|bottom|left|right|text)-\[\s*([0-9.]+)(px|rem)?\s*\]' src/ -r --include="*.vue"
```

**Ponytail rung 选择**：
1. **rung 1 —— 是否需要这个 class？** 不改逻辑仅换短写，业务 0 改动
2. **rung 3 —— stdlib 覆盖？** Tailwind 默认比例就是 stdlib，原写法是"手动指定"
3. **rung 6 —— 批量替换最小代价**：写个一次性 Python 脚本，用 `re.subn` 批量替换 + 计数 + 报告

**修复**：写一次性 Python 脚本：

```python
import re, pathlib
replacements = [
    (r'\bmin-h-\[48px\]', 'min-h-12'),
    (r'\bspace-y-\[16px\]', 'space-y-4'),
    (r'\bgap-\[16px\]', 'gap-4'),
    (r'\bgap-\[12px\]', 'gap-3'),
    # ... 完整映射表
    # 注意：text-[13px] / text-[15px] / rounded-[20px] / 颜色 / shadow / gradient 不入表
]
for p in pathlib.Path('src/').rglob('*.vue'):
    s = p.read_text(encoding='utf-8')
    counts = {}
    for pat, repl in replacements:
        s, n = re.subn(pat, repl, s)
        counts[pat] = n
    if any(counts.values()):
        p.write_text(s, encoding='utf-8')
        print(f'{p}: {sum(counts.values())} replacements')
```

**业务逻辑 0 改动**：仅 class 名替换，运行时 0 变化。

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位） | import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown） | 函数无签名 → 返回 unknown |
| TS2322（mock 缺字段） | mock / test 数据 vs 接口契约 |
| jsdoc/multiline-blocks | JSDoc 起始行同行接文字 |
| 未使用代码 | 项目禁用 no-unused-vars |
| 同名类型重复定义 | 同名 interface 在多文件独立定义 |
| **Tailwind 任意值需等价短写** | **Tailwind IntelliSense 提示，需 grep 主动扫** |

**SKILL 升级点**：见 `SKILL.md` 第 6 步后新增的"Tailwind 任意值飘红主动扫描"。本形态是 2026-09-21 实际清理 StoreAuditOnboarding 4 个 .vue 148 处任意值时发现。

**反思**：IDE Tailwind IntelliSense 提示在 IDE 里看起来像"warning"，但 ESLint 报不到——grep 主动扫是唯一可靠手段。颜色任意值（`bg-[#xxx]`）和数值任意值（`min-h-[48px]`）是两件事：前者需抽 `<style scoped>`，后者只需替换短写。


