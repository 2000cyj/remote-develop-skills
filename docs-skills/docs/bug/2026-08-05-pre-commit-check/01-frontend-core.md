# 提交前自检 · 前端核心（脚本 / 路由 / 字典 / 新组件）

> 审查时间：2026-08-05
> 审查范围：`scripts/` 3 个工具脚本 + `src/router/index.ts` + `src/common/constants/dictionary.ts` + 新增组件 `src/components/RemoteSearchSelect/index.vue`
> 审查方法：逐文件通读 + Node 复现路径计算 + 调用链回溯（vite.config.ts）
> 说明：本次提交**新引入**的实质性代码改动只有 `RemoteSearchSelect` 新组件和 `dictionary.ts` 加常量；其他文件的改动均为 import 顺序 / var→let / 模板字符串等 lint 风格调整。`scripts/share-dev-server.mjs` 的 SHARE_DIST 路径错误**不是本次引入**，但当前文件仍带病上线，所以一并登记。

---

## 严重程度图例
- 🔴 **高**：直接导致功能不可用或数据错误，必须修
- 🟡 **中**：行为偏差 / 类型不安全 / 隐性 bug / 资源未释放，建议修
- 🟢 **低**：可读性 / 死代码 / 优化建议

---

# 🔴 高严重度

## BUG-1 · `scripts/share-dev-server.mjs` 计算的 `SHARE_DIST` 路径错误，dev 模式 `/share/*` 全部 404

**文件**：`scripts/share-dev-server.mjs:18-20`

**问题描述**
脚本在 `__dirname`（即 `packages/micro/cashier/scripts/`）下只回退一层得到 `ROOT = packages/micro/cashier`，再拼 `packages/share/dist`，最终落到 `packages/micro/cashier/packages/share/dist`。这个目录在仓库里根本不存在（实测 `existsSync` 返回 `false`），而真正的 share 构建产物在 `packages/share/dist`（位于 ob_web 根，再往上两层才是 packages）。

```js
const __dirname = fileURLToPath(new URL(".", import.meta.url))
const ROOT = resolve(__dirname, "..")                              // ← 只回退一层
const SHARE_DIST = resolve(ROOT, "packages/share/dist")            // ← 多了一级 packages
```

**Node 复现**（在 cashier 目录运行）：
```
SHARE_DIST (current code) = D:\OB\ob_web\packages\micro\cashier\packages\share\dist
EXISTS? false
correct = D:\OB\ob_web\packages\share\dist
CORRECT EXISTS? true
```

**触发场景**
1. 启动 dev server（`pnpm dev:dev` 等）→ `shareDevPlugin` 注册 `handleShareReq` 中间件。
2. 浏览器访问 `/share/manifest.json`、`/share/share.css`、`/share/vendor/vue.xxx.mjs` 等。
3. `existsSync(filePath)` 全部 false → 走到 `if (next) return next()` → 落到 Vite 内置中间件 → 没有命中资源 → SPA fallback 返回 index.html。
4. 浏览器 `importmap` 解析失败 → 控制台 `Failed to resolve module specifier "vue"`，页面空白。

**注**：本仓库 `CLAUDE.md` 明确写「前置条件：先构建共享组件库。dev 模式由 `shareDevPlugin` 直接服务 `packages/share/dist`」，所以这个中间件是 dev 启动的硬依赖，路径错误 = dev 完全不可用。

**修复建议**（任选其一）
```js
// 方案 A：从 cashier 上溯 2 层到 packages，再拼 share/dist
const SHARE_DIST = resolve(__dirname, "..", "..", "share", "dist")

// 方案 B：把 ROOT 改成 ob_web 根，再拼 packages/share/dist
const ROOT = resolve(__dirname, "..", "..", "..")
const SHARE_DIST = resolve(ROOT, "packages/share/dist")
```

> 这是**历史遗留 bug**（自 b5e993f 初始提交就存在），不在本次 commit 引入；但提交前顺手修一行成本极低，避免新人 clone 后 dev 起不来。

---

# 🟡 中严重度

## BUG-2 · `RemoteSearchSelect` 组件未在 unmount 时清理 `searchTimer`，存在内存 / 状态泄漏

**文件**：`src/components/RemoteSearchSelect/index.vue:78-80, 117-124`

**问题描述**
组件内部用 `let searchTimer` 保存 debounce 句柄，但**没有** `onBeforeUnmount(() => clearTimeout(searchTimer))`。场景：
- 用户在 debounce 窗口内（默认 300ms）输入关键词 → timer 排队。
- 父组件因为路由切换 / 条件渲染把 RemoteSearchSelect 卸载。
- timer 仍然到点触发 → 进入 `query(true)` → 仍然调用 `props.fetchOptions` → 用已卸载组件的响应去改 `options.value / loading.value`。

对短期页面不会崩，但：
1. 触发一次"幽灵请求"（浪费接口）；
2. 若父组件在同一页签短时间内多次挂载 / 卸载，可能出现「上一个实例的请求结果覆盖下一个实例的 options」的串扰（虽然 `requestSeq` 能在同一组件实例内防乱序，但跨实例不防）；
3. 卸载后 `wrapEl` 仍持有 popper DOM 引用，延长 GC 时间。

**触发场景**：表单页 / 抽屉页频繁打开关闭，每次关闭都丢一个未触发的 timer 和 popper DOM 引用。

**修复建议**
```ts
import { onBeforeUnmount } from "vue"
// ...
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchTimer = undefined
  wrapEl = null
})
```

---

## BUG-3 · `RemoteSearchSelect` 请求失败时无任何用户反馈，且 `appending` 状态未复位

**文件**：`src/components/RemoteSearchSelect/index.vue:105-111`

**问题描述**
`query()` 的 catch 块只做了 `pageNum -= 1`（仅 append 失败），既不 toast 也不修改任何 UI 状态；同时 `appending.value` 在 catch/finally 中都没复位。

```ts
} catch {
  if (seq === requestSeq && !reset) pageNum -= 1
} finally {
  if (seq === requestSeq) loading.value = false
}
```

**问题 1（用户感知）**：`fetchOptions` 抛错 → 组件静默吞掉 → loading 状态恢复 → 用户看到列表为空但没有错误提示，会以为是「没数据」而不会重试。

**问题 2（内部状态）**：append 失败后 `appending` 仍为 true（line 89 设置的），下一次 `query(true)` 会重置成 false 所以**一般不可见**；但若用户不再操作，组件内部 `appending` 与真实状态不一致，未来扩展（增加 disabled 状态、防重复点击）时容易踩坑。

**触发场景**：网络抖动 / 后端 500 → 组件表现如同"查询无数据" → 用户不会意识到是请求失败。

**修复建议**
- 暴露 `error` 事件，由调用方决定提示方式（`emit("error", err)`）。
- finally 里同时复位 `appending`：`if (seq === requestSeq) { loading.value = false; appending.value = false }`。
- 调用方约定（组件注释 line 12 已写明「请求失败需 throw」），但组件侧仍应有兜底反馈。

---

## BUG-4 · `scripts/share-dev-server.mjs` `createReadStream().pipe(res)` 缺 error 处理，竞态下请求会挂死

**文件**：`scripts/share-dev-server.mjs:64`

**问题描述**
```js
if (!existsSync(filePath) || !statSync(filePath).isFile()) { ... 404 }
createReadStream(filePath).pipe(res)
```
`existsSync` → `createReadStream` 之间存在 TOCTOU 窗口（文件被删 / 权限变更），或读取中途 I/O 失败时，stream 会触发 `'error'`，但没监听，`res` 不会被 end，浏览器会一直 hang 到超时。

**触发场景**：share 目录正在被 `pnpm dev`（packages/share 仓 watch 模式 rebuild）边读边覆盖 → 极端情况下单个 chunk 读到一半被替换。

**修复建议**
```js
const stream = createReadStream(filePath)
stream.on("error", () => {
  if (!res.headersSent) res.writeHead(500)
  res.end("share read error")
})
stream.pipe(res)
```

---

## BUG-5 · `scripts/gen-types.mjs` 静默吞错 + 总是 exit 0，postinstall 失败不易察觉

**文件**：`scripts/gen-types.mjs:35-48`

**问题描述**
脚本里两处 `try { ... } catch { /* 忽略 */ }`，且 `process.exit(0)` 无条件执行。注释（line 40-42）说明意图是「d.ts 多半已写出」，但实际是「不知道写没写」。postinstall 链路下若 vite 插件 transform 中途崩溃，d.ts 残缺，开发者后续 `vue-tsc` 会看到一堆 TS2304，但 gen-types 步骤返回 0，CI / husky / 同事本地都看不到根因。

**触发场景**：vite 插件（unplugin-auto-import 等）某次升级改了 transform 行为 → 中途抛错 → d.ts 部分写入或不完整 → gen-types 静默返回 0 → 提交前的 type-check 报一堆「Cannot find name 'ref'」误以为是代码问题。

**修复建议**
- 至少在 catch 里 `console.warn("[gen-types] transform 异常，d.ts 可能不完整:", err.message)`，并 `process.exitCode = 1` 让 husky 能拦下。
- 或者跑完后 `console.log("[gen-types] 已生成:", generatedFiles.join(", "))`，让用户看到究竟写出了什么；缺失则告警。

---

# 🟢 低严重度

## BUG-6 · `RemoteSearchSelect` 关闭面板再打开会自动触发一次"全量查询"，未做"打开面板时跳过已有结果"的优化

**文件**：`src/components/RemoteSearchSelect/index.vue:121`

**问题描述**
组件注释明确说明「重开面板 el-select 会自动触发 remote-method（空输入 = 查全量）」，所以这是**按设计实现**的。但实际体验：
- 用户输入 "张" 查到 30 条 → 关闭下拉 → 再打开 → el-select 自动 `remote-method("")` → 触发一次 `query(true)` 查全量 → 已加载的 30 条被丢弃，列表瞬间清空再逐条回来。
- 在 share 组件库中作为通用组件使用，"打开面板就刷新" 容易让用户感觉"我点了一下结果就没了"。

**修复建议**：在 `handleSearch` 里加一条跳过规则：`if (kw === "" && hasLoaded && loadedKeyword === "" && keyword === "") return`。或在组件外层加一个开关 `lazyReopen: boolean`（默认 false 保持现有行为）。

---

## BUG-7 · `RemoteSearchSelect` 无 total 时回退启发式不准，会浪费一次空请求

**文件**：`src/components/RemoteSearchSelect/index.vue:102-104`

**问题描述**
```ts
noMore.value = typeof res.total === "number"
  ? options.value.length >= res.total + exactCount
  : res.list.length < props.pageSize
```
当后端不返回 `total` 时，用 `list.length < pageSize` 判到底。若后端最后一页恰好满 `pageSize`（无零头），组件会再发一次空请求，把空结果当作"到底"。属于"接口契约不强时的边界行为"。

**修复建议**：在 `RemoteSelectPage` 类型 / JSDoc 中明确「请尽量返回 total（不含 exactCount）」，并在调用方注释里提示。

---

## BUG-8 · `RemoteSearchSelect` `findWrap()` 全局查询所有 `.ep-select-dropdown .ep-scrollbar__wrap` 缓存为单例，可能串扰

**文件**：`src/components/RemoteSearchSelect/index.vue:128-139`

**问题描述**
`findWrap` 在 `document` 范围查所有可见的 scrollbar wrap 并缓存到组件局部 `wrapEl`。每个 RemoteSearchSelect 实例独立缓存，理论上不会串；但：
1. `Array.from(querySelectorAll(...))` 每次弹层都遍历 DOM，开销 O(n)；
2. 若同一页内多个 RemoteSearchSelect 实例的 popper 同帧打开（极少见），`el.clientHeight > 0` 的判断不够精确，可能缓存错实例。

**修复建议**：用 Element Plus 的 `el-select` 暴露的 `popperEl` ref 直接拿当前实例的 popper（`popperEl.value`），避免 querySelector 全局扫描。如果版本不支持，至少在 cache miss 时只查一次并立即退出。

---

## BUG-9 · `RemoteSearchSelect` `handleChange` 把空字符串归一化为 `undefined`，但类型允许 null 进来

**文件**：`src/components/RemoteSearchSelect/index.vue:150-155`

**问题描述**
```ts
function handleChange(value: string | number | undefined) {
  const normalized = value === "" ? undefined : value
  // ...
}
```
Element Plus `el-select` 的 `change` 回调在某些场景（多选 / 自定义值）会传 `null`。`null === ""` 为 false，会原样 emit 出去。emit 的类型 `update:modelValue: [value: string | number | undefined]` 不含 `null`，会触发 TypeScript 报错（虽然 `<script setup>` 通常不强制检查 emit 入参，但语义上是 bug）。

**修复建议**：归一化逻辑改为 `value == null || value === "" ? undefined : value`（双等同时拦 null/undefined）。

---

## BUG-10 · `dictionary.ts` 顶部 file header 注释残留 `ob_web_personnel` 路径

**文件**：`src/common/constants/dictionary.ts:6`

**问题描述**
```ts
 * @FilePath: \ob_web_personnel\src\common\constants\dictionary.ts
```
注释里的 `@FilePath` 还指向 personnel 子应用（拷贝未更新）。`@Author/@LastEditors` 也都是 `lzw 807728941@qq.com`，不是 cashier 当前维护者。

**修复建议**：更新为 cashier 当前维护者信息，或删除 koroFileHeader 的自动 header，改用项目级 ESLint/Prettier 规范。也可以整体删掉顶部 header，只留 enum 本身。

---

## BUG-11 · `scripts/inject-importmap-plugin.mjs` 用 substring `html.includes("importmap")` 判断可能误伤

**文件**：`scripts/inject-importmap-plugin.mjs:62`

**问题描述**
```js
if (html.includes("importmap")) {
  return
}
```
若 `index.html` 里有注释 `<!-- 改 importmap 前请通知 xxx -->`、或注释里出现 importmap 关键字，会跳过注入；如果未来有人手动加了一份不完整的 importmap，脚本也不会再注入。

**修复建议**：用正则精确匹配 `<script[^>]*type=["']?importmap["']?[^>]*>` 才跳过，否则尝试注入（再检测重复）。

---

## BUG-12 · `RemoteSearchSelect` 暴露的 `refresh` 永远 reset 到 page 1，无法 reload 当前页

**文件**：`src/components/RemoteSearchSelect/index.vue:163`

**问题描述**
```ts
defineExpose({ refresh: () => query(true) })
```
调用方只能触发"重置到第 1 页"。如果调用方需要"刷新当前 keyword 的当前页"（比如用户新增一条数据后想让已有分页位置的数据刷新），无法实现。

**修复建议**：暴露两个方法：`reset()`（= refresh）、`reload()`（= `query(false)` 后再 query(true) 不合理，建议做成 `reloadCurrent()` 重新拉 pageNum 对应页）。

---

# 无问题清单（已确认 OK）

- `src/router/index.ts`：`dynamicRoutes` 数组清空（移除 `/fileExpiration` / `/fileExpiration/rules`）→ 合理：qiankun 子应用走 microMenu 动态路由（参见 `src/main.ts` 的 `transformMicroRoutes`），静态 dynamicRoutes 本来就不该写死两份。本次删除无回归风险。`resetRouter` 的 `meta.roles?.length` 过滤条件保留无影响。`createMemoryHistory("/")` 等 qiankun 模式行为无变化。
- `src/common/constants/dictionary.ts`：新增枚举值 `CASHIER_GUARANTEE_THRESHOLD` 命名规范、值格式（`CASHIER_*` 大写下划线）与其他项一致，注释语义清晰。
- `scripts/inject-importmap-plugin.mjs`：`SHARE_MANIFEST_PATH` 路径正确（实测指向 `D:\OB\ob_web\packages\share\dist\manifest.json`，存在）；`<head>` 注入位置正确（importmap 在 head 第一个子节点，必然先于所有 module script）。`enforce: "post"` 保证在 manifest 生成后再注入。
- `scripts/share-dev-server.mjs` 除 BUG-1 外的部分：`handleShareReq` 的路径遍历防护（`replace(/^(\.\.[/\\])+/, "")`）OK，能挡住 `/share/../foo`、`/share/foo/../../bar` 这类 URL。`getContentType` / `getCacheControl` / `configureServer` & `configurePreviewServer` 的 middleware unshift 顺序符合 Vite 插件约定。`no-store` 注释解释了为何 dev 不能用 immutable 缓存。
- `scripts/gen-types.mjs`：`silentLogger` 的 `hasErrorLogged: () => false`（方法）和 `hasWarned: false`（属性）符合 Vite Logger 接口契约；`createServer({ middlewareMode: true })` 不会启动 HTTP server，`server.close()` 释放资源；12s 超时上限避免 hang。
- `RemoteSearchSelect` 整体设计：分页式远程搜索 / 防抖 / requestSeq 防乱序 / 失败回滚 pageNum / `popper-class="remote-select-popper"` 限定非 scoped 样式作用域 / `:empty` 折叠无状态 footer — 这些点都写得很扎实。
- `RemoteSearchSelect` props 默认值：`debounce: 300` / `pageSize: 30` / `clearable: true` 与 share 库其它组件风格一致。
- `RemoteSearchSelect` 类型声明：`RemoteSelectOption.label/value` 必填 + `[key: string]: any` 兜底原字段；`emit("change", value, option)` 用 `Record<string, any>` 兜底避免与调用方字段类型强耦合 — 合理。
- `RemoteSearchSelect` 模板：`<el-option :key="opt.value" :label :value>` key 已用；底部 `<template #footer>` 用 `v-if appending && loading` / `v-else-if noMore && options.length > 0` 互斥正确。
- `SHARE_COMPONENTS.md`：仅文档，无运行时影响；改动主要为描述微调。

---

# 复现 / 验证脚本（如需）

```bash
# 验证 BUG-1
cd D:\OB\ob_web\packages\micro\cashier
node --input-type=module -e "
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
const __dirname = fileURLToPath(new URL('.', 'file:///D:/OB/ob_web/packages/micro/cashier/scripts/share-dev-server.mjs'))
const SHARE_DIST = resolve(resolve(__dirname, '..'), 'packages/share/dist')
console.log('SHARE_DIST =', SHARE_DIST, 'EXISTS?', existsSync(SHARE_DIST))
"
# 期望 EXISTS? true，实际 false → 确认 bug
```
