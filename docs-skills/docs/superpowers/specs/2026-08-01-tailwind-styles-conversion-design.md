# 子应用样式迁移 Tailwind 设计文档（转换规范）

> 日期：2026-08-01
> 分支：dev-chenyanjun
> 范围：cashier 子应用全部 35 个仍带 scoped SCSS 的 `.vue` 文件
> 执行方式：6 个并行 agent，按本规范逐文件转换

## 1. 背景与目标

项目已接入 **Tailwind CSS v4.1.18**（`@tailwindcss/vite`，CSS-first 配置）。全子应用共 59 个 vue 文件，其中 18 个已在模板中使用 Tailwind 工具类，35 个仍保留 `<style lang="scss" scoped>` 块（约 3900 行 SCSS）。

**目标**：把 35 个文件的可转换样式改为模板内 Tailwind 工具类，使 `<style>` 块显著缩小或删光，且不产生视觉回归。

**验收标准**：
1. 每个文件样式语义逐条保留（值不变）
2. `pnpm build` 通过、`pnpm lint` 无新增报错
3. 复杂页面（公司 add/editOrCheck、store、seal、businessScope）Chrome DevTools 截图核对无视觉回归

## 2. 环境事实（agent 必须知道）

### 2.1 Tailwind 配置位置
```
src/common/assets/styles/tailwind.css            # 入口（无 preflight！）
src/common/assets/styles/tailwind/theme.css      # @theme 语义 token
src/common/assets/styles/tailwind/components.css # .card 组件类
src/common/assets/styles/tailwind/utilities.css  # 自定义 @utility
```

### 2.2 可用语义色（映射到 Element Plus 变量）
`text-primary / text-success / text-warning / text-danger / text-info`（及 `bg-*`、`border-*` 等）。
⚠️ 语义色仅在原 SCSS 用 `var(--ep-color-primary)` 一类时才用；普通色值（`#374151` 等）用默认色板（`text-gray-700`）或任意值（`text-[#374151]`）。

### 2.3 自定义工具类（直接复用）
| 类 | 等价 |
|---|---|
| `flex-center` | flex + 居中 |
| `flex-between` | flex + space-between + items-center |
| `flex-col-center` | flex-col + 居中 |
| `text-ellipsis` | overflow hidden + ellipsis + nowrap |
| `absolute-center` | absolute + 50% + translate |
| `.card` | bg-white rounded-lg shadow-md p-4 |

### 2.4 注意
- **无 preflight**（基础重置被禁用），所以依赖浏览器默认样式（如 ul 默认 padding）的布局保持不变，转换时不要引入 preflight 副作用。
- Tailwind v4 只对源码中出现完整类名的静态字符串生成样式。**禁止**用字符串拼接动态构造类名（除非完整类名以字面量出现在文件中）。
- `!important` 在 v4 写法为后缀 `!`：`text-[#1f2937]!`。

## 3. 转换策略（核心规则）

**三档处理，按复杂度降级：**

### 档位 1：常规规则 → 模板内工具类
布局（flex/grid/间距/宽高）、颜色、字号、行高、圆角、边框、阴影、溢出 —— 全部写成 `class="..."` 工具类。
- 标准值用默认工具类：`flex items-center gap-2 px-4 text-sm text-gray-500`…
- 非标值用任意值：`w-[120px]` `mt-[16px]` `text-[13px]` `text-[#374151]` `bg-[#fafafa]` `rounded-[6px]` `border-[1px_solid_#f0f0f5]` `shadow-[0_2px_8px_rgba(99,102,241,0.3)]`…

### 档位 2：简单 `:deep()` 单规则 → 任意变体
单个选择器、单条或极少数规则的 `:deep()`，用 `[&_子选择器]:工具类` 表达。
例：
```scss
.eoc-bs-detail-item :deep(.ep-tag) { margin-right: 8px; vertical-align: middle; }
```
→
```html
<div class="[&_.ep-tag]:mr-[8px] [&_.ep-tag]:align-middle">
```
判定标准：变体内选择器路径 ≤ 2 层且规则 ≤ 2 条，否则降档到档位 3。

### 档位 3：复杂规则 → 保留最小残留 `<style lang="scss" scoped>`
以下情况**保留**在残留块中，不强行转换：
- 复杂 `:deep()` 多选择器/`:not()` 链（如 editOrCheck 查看模式文字加深块）
- 伪元素/伪类组合逻辑（`::before`/`::after` 双端 clearfix）
- `@include mixins.clearfix` / `mixins.scrollbar`
- `@keyframes` 动画
- 依赖状态类组合的复合规则（`.a.b` 需多类同时存在）

残留块**只含转换不掉的规则**，必须保留原注释说明为什么残留。

## 4. 高频映射对照（避免各 agent 写法不一致）

| SCSS | Tailwind |
|---|---|
| `display: flex; align-items: center;` | `flex items-center` |
| `display: flex; justify-content: space-between; align-items: center;` | `flex-between` |
| `gap: 16px` | `gap-[16px]` 或 `gap-4`（4px 倍） |
| `padding: 16px 24px` | `px-[24px] py-[16px]` |
| `margin-top: 12px` | `mt-[12px]` 或 `mt-3` |
| `font-size: 12px` | `text-xs`（12px） |
| `font-size: 13px` | `text-[13px]` |
| `font-size: 14px` | `text-sm`（14px） |
| `font-weight: 500` | `font-medium` |
| `font-weight: 600` | `font-semibold` |
| `color: #1f2937` | `text-[#1f2937]` 或 `text-gray-800`（值须完全一致） |
| `color: #374151` | `text-gray-700` 或 `text-[#374151]` |
| `color: #9ca3af` | `text-gray-400` 或 `text-[#9ca3af]` |
| `border-radius: 8px` | `rounded-lg`（8px） |
| `border: 1px solid #e8e8e8` | `border border-[#e8e8e8]` |
| `height: 100%` | `h-full` |
| `position: sticky; top: 0;` | `sticky top-0` |
| `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` | `text-ellipsis` |

**统一原则**：
- 颜色值必须与原 SCSS **逐字节一致**。能用默认色板（gray-700 等）且值恰好匹配才用默认，否则一律 `text-[#hex]`，避免色差。
- 非 4px 倍数的间距一律任意值（`mt-[10px]`），避免取整偏差。
- 单位换算：Tailwind 无 `px` 单位标注，任意值里直接写数字+单位。

## 5. 必须遵守的边界（禁止项）

- 不改 `<script>` 逻辑、不变量名、不改接口调用
- 不改 Element Plus / 业务组件的属性和插槽结构（`style="width: 100%"` 这类行内样式**保留**，不迁移——那是组件属性不是 CSS 类）
- 不删除"看起来没用到"的类（可能被 JS 动态引用）
- 不顺手重构相邻代码、不改注释格式
- 类名在模板中**必须静态完整出现**（动态 `:class` 的对象 key 也要完整类名）
- 转换后立即检查：残留块里的选择器必须仍然命中对应模板元素

## 6. 验证流程

每个 agent 完成后：
1. `pnpm eslint --fix <本次改动文件列表>`（或对整个项目 `pnpm lint`），确认无新增 error
2. 复查自己文件：残留 `<style>` 是否只剩档位 3 规则
3. 汇报：每个文件 `<style>` 块前后行数变化 + 残留规则清单 + 任何拿不准的点

全部 agent 完成后，由主线程统一：
- `pnpm build` 全量构建
- Chrome DevTools 截图核对复杂页面（公司 add/editOrCheck、store、seal、businessScope、login）

## 7. 文件清单与 Agent 分批（互不重叠）

| Agent | 文件（样式行数） |
|---|---|
| A | `src/pages/company/components/add.vue`(343)、`src/pages/company/index.vue`(8)、`src/pages/company/components/CapitalFormatInput.vue`(15) |
| B | `src/pages/company/components/editOrCheck.vue`(405) |
| C | `src/pages/businessScope/index.vue`(299)、`src/pages/businessScope/components/BusinessScopeModal.vue`(14)、`src/pages/store/index.vue`(8) |
| D | `src/pages/store/addOrEdit/addOrEdit.vue`(218)、`src/pages/seal/components/addOrEdit.vue`(129)、`src/pages/seal/components/SealCropper.vue`(73)、`src/pages/seal/index.vue`(24)、`src/pages/seal/components/SealPreview.vue`(15)、`src/pages/bankCard/addOrEdit/addOrEdit.vue`(76)、`src/pages/bankCard/index.vue`(8) |
| E | `src/pages/employee/addOrEdit/addOrEdit.vue`(88)、`src/pages/employee/index.vue`(58)、`src/pages/employee/components/IdCardPreview.vue`(40)、`src/pages/fileExpiration/index.vue`(73)、`src/pages/fileExpiration/components/SetExpirationModal.vue`(58)、`src/pages/fileExpiration/ruleManagement/index.vue`(34) |
| F | layouts 10 个（LeftMode 128、Sidebar 110、LeftTopMode 74、TagsView 67、SelectLayoutMode 58、TopMode 48、NavigationBar 44、ScrollPane 35、Logo 34、AppMain 10）、login 2 个（Owl 74、index 8）、共享组件 3 个（AttachmentList 116、AttachmentAddModal/Content 58、AttachmentEditModal/Content 50） |

## 8. 参考文件（已转换的先例）

- `src/pages/dashboard/index.vue`（极简）
- `src/layouts/components/Header/index.vue`（任意值 + 自定义工具类）
- `src/layouts/components/Footer/index.vue`、`src/layouts/components/RightPanel/index.vue`

## 9. 执行后经验补充（2026-08-01，35 文件全部完成）

### 9.1 CSS Cascade Layer：Tailwind 工具类输给 Element Plus 未分层样式（最重要）
本项目 Tailwind 工具类在 `@layer utilities`（分层），而 Element Plus CSS 是未分层样式 —— **未分层 > 分层，无视特异性**。因此**任何覆盖 EP 默认属性的工具类必须加 `!` 后缀**，否则静默失效：
- 渐变按钮：`bg-[...]! border-none! rounded-lg!`（EP `.el-button` 设 `border-radius:4px`，`rounded` 不加 `!` 会退化成 4px）
- 覆盖 EP 内部（el-icon 尺寸、el-tag hover 色、el-tabs header 边距等）统一 `!`
- 只「新增」不冲突的（EP 未设的属性，如给 `.ep-col` 加 `margin-bottom`、给 `.ep-tag` 加 `margin-right`）**不需要** `!`

### 9.2 字号用精确 px 任意值
`12px→text-[12px]`、`13px→text-[13px]`、`14px→text-[14px]`，不要用 `text-sm`/`text-xs`（rem 依赖宿主根字号，微前端下不确定），保证逐字节一致。

### 9.3 BEM 双下划线在任意变体里必须转义
`[&_.el-card\_\_body]:p-0!` —— 不写 `\_\_` 的话 Tailwind 把 `_` 当空格，选择器被破坏。

### 9.4 预存构建 bug（本次修复，与转换无关）
`employee/addOrEdit/addOrEdit.vue` 的 `v-model:file-list="xxx as unknown as FileItemProps[]"` 会编译成 `((_unref(x) as ...).value = $event)` —— 对函数调用结果赋值，esbuild 必报 `Invalid assignment target`，**HEAD 即存在**。修法：ref 类型改为 `ref<FileItemProps[]>`，模板裸绑定（合法），把 `as unknown as` 强转移到数据赋值点（u/d → ref 写入处）。

