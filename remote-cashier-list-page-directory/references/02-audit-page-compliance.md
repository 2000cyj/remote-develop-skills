# 目标 2：审查现有页面合规性

**适用场景**：检查某业务模块目录是否完全合规，输出**违规清单 + 分类结论**。

> 本目标是**只读审查**，不要擅自修改代码。所有整改动作见 `references/03-refactor-page.md`。

## 审查总则（先读这一段，优先于所有检查项）

> **不要用关键字扫。** 本文件所有 `grep` / 扫描命令**只是规范的可选执行器**，不是审查方法。审查方法是：**按 7 项目录的职责，逐文件判定文件里每一条声明的归属目录**。命令没命中 **≠** 合规。

### 审查方法：按职责定位，不按关键字定位

**不要**先 grep 关键字找违规。要**先定归属，再看现状**：

```
Step 1  列出业务块的 7 项目录（index.vue / addOrEdit/ / apis/ / components/ / config/ / enum/ / utils/ / types/）
Step 2  逐个文件读完，把里面**每一条顶层声明**（const / function / interface / type / computed / ref / reactive）列出来
Step 3  对每一条声明查下表 → 得到它**应该**在哪个目录
Step 4  与它**实际**所在位置对比 → 不同 = 违规（凭据 = 归属表行号）
```

**声明种类 → 归属目录**（这张表就是规范，不要拿 grep 当规范）：

| 声明种类 | 应该在哪 | 实例 |
|---|---|---|
| `interface` / `type`（任何名字、任何形式，包括泛型 / 联合 / 交叉） | 业务块根 `types/index.ts`；只被内层用且名字带 `Row`/`Item` 等组件私有语义 → 仍进 `types/index.ts` | `StoreEntryPlatformFormState`、`PageResult<T>` |
| `FormRules` 对象（任何名字：formRules / rules / phoneRules / fieldRules） | 纯静态 → `addOrEdit/config/index.ts`；引 enum 工厂 → `addOrEdit/enum/index.ts`；依赖 props / 含 validator → `addOrEdit/config/` 的 factory | `STORE_ENTRY_PLATFORM_FORM_RULES` |
| `computed`（任何名字） | **一律**提 `config/`：体内无响应式依赖 → 常量化 `export const X = [...]`；体内引用 `.value` / `props.` / `reactive` → 抽成方法 `export function getXxx(args)`，把这些值**当参数传进去**，`computed` 留 .vue 侧调方法 | `getXxxFormItems(companyOptions.value, formData.operatorId)` |
| 静态数组 / 字典 / `Record<KEY, value>` | `config/`（内层用）或 `enum/`（字典语义） | `CLOSE_STORE_FORM_ITEMS` |
| 映射函数 / 格式化 / 校验工具 | `utils/index.ts` | `formatDateTime`、`getFieldLabel` |
| 接口请求函数 | `apis/index.ts` | `pageStoreEntryPlatformApi` |
| 枚举 / 状态码 / label 映射表 / **魔法值** | **先查公共**：① `@/common/enum` 有同语义 → 直接复用 ② 本业务块 `enum/` 有 → 复用 ③ 都没有 → 建到就近 `enum/index.ts`，并把该魔法值在业务块内**全部**改为引用它 | `pageModeEnum`、`subAccountFieldPool` |
| 页面状态（ref / reactive）、事件处理、副作用编排 | `.vue` 内部（唯一例外） | `formData`、`handleSave` |
| 组件 | 内层 `addOrEdit/components/` 或外层 `components/`，按真 import 数判定 | `FieldsSelector.vue` |
| 刷新信号 / 缓存 composable | `utils/`（`*.composable.ts` 或 index.ts barrel） | `requestListRefresh` |

**Step 4 判定后的 4 条要求**：

1. **扫描命令只是加速器**：本文件后文各检查项里的 `grep` 只用于“快速列出待判定的声明”，不用于“判定有无违规”。
2. **不许拿“命令没命中”当结论**：命令没命中只说明命令模式没覆盖写法，必须回到 Step 2 逐文件读完。
3. **命名不影响归属**：变量叫 `rules` 还是 `formRules`、`XxxVO` 还是 `XxxRow`，都不改变它应该去的目录。命令按关键字写会漏；归属表按种类写不会漏。
4. **发现归属表没覆盖的声明种类**：先修代码，再回本表加一行（按**种类**描述，不按变量名）。

> 事故记录（storeEntryPlatform/ 2026-10-15）：旧审查方式用 `grep "^const formRules"` 找违规，命令只匹配 `formRules` 这个名字，漏掉了 `const rules: FormRules<T>`（14 行纯静态），user 直接点名才抽出。**根因不是 grep 写错，是拿 grep 当规范**——改成“按声明种类查归属目录”后，变量叫什么名都跑不掉。

## 检查清单（按 7 项固定目录逐项）

### 检查 1：7 项目录职责是否齐全

```
src/pages/<业务模块>/
├── index.vue          ← 列表页（必须）
├── addOrEdit/         ← 新增/修改/详情（仅 add / edit / detail 业务存在时创建）
├── apis/              ← 接口（仅业务有调用时创建）
├── components/        ← 组件（仅业务有跨页复用组件时创建）
├── config/            ← 列表配置（仅配置逻辑提取到 config/ 时创建）
├── enum/              ← 字典/枚举（仅业务有独立枚举时创建）
└── utils/             ← 工具（仅业务有独立工具时创建）
```

**规则**：
- 7 项目录是**职责清单**，不是"必须初始全部创建"。
- **禁预创建空目录 + `.gitkeep` 占位**——实际无文件时不需要创建目录。
- `addOrEdit/` 仅在业务有新增/修改/详情需求时创建；初始仅 `index.vue` 列表页时无需建。
- 哪一项业务存在才创建哪一项，**不预先占位**。

**违规标志**：
- ❌ 缺 `index.vue`（列表页放错位置）
- ❌ 缺 `addOrEdit/`（表单页直接放外层）
- ❌ **预先创建空目录 + `.gitkeep` 占位**（git 无法追踪空目录是惯例，不需要文件占位）
- ❌ 多出额外目录名（如 `constants/` `helpers/` `models/` 等不固定目录名）

**补足方法**（仅在确实需要该目录且已有首个文件时）：
```bash
# 直接创建文件，不需要 .gitkeep 占位
touch src/pages/<业务模块>/components/Foo.vue
```

### 检查 2：列表页 vs 表单页分离

- ✅ 列表页只放 `index.vue`
- ❌ 把新增/修改/详情页放外层（必须放 `addOrEdit/` 内）

### 检查 3：addOrEdit 内文件形态

| 形态 | 文件结构 |
|---|---|
| 三合一 | `addOrEdit/{addOrEdit.vue 或 index.vue}`（一个文件按 `mode` 区分） |
| 三个独立 | `addOrEdit/{add.vue, edit.vue, detail.vue}` |
| 某两在一起 | 任意两文件（如 `addOrEdit.vue` + `detail.vue`） |

**违规标志**：
- ❌ 出现 4 个及以上独立文件（违反"某两在一起"的最简原则）—— 应评估是否可以三合一或拆三独立

### 检查 4：apis 归属判断（高频）

走 `references/04-shared-vs-private.md` 的决策树。**关键违规**：
- ❌ 业务主接口（如 `pageXxxApi` / `createXxxApi`）放进 addOrEdit 内层
- ❌ 仅 addOrEdit 用的辅助下拉接口（如 `listAvailableCompanysApi`）放外层（污染业务块共用）

### 检查 5：components/config/enum/utils 归属

同 apis，按 `references/04-shared-vs-private.md`。

**不推荐 `utils/confirm.ts`**（2026-09-21 取消）：调用方直接 `import { confirmDelete } from "@/common/utils"`，不再创建中间转发层。审查清单中**不再要求**该文件存在。

#### 检查 5a：components 真跨页复用判定（高频违规点）

> 业务背景：之前 store/ 案例中 SubAccountManager 凭印象被误判为"fill.vue 用了"（实际只 doc 注释提了，未真 import）—— agent 凭语感判定跨页复用导致组件错放外层 `components/`。本节定义**唯一证据**判定法。

**扫描命令**（强制执行，**不接受** grep 命令之外的判定）：

```bash
# 步骤 1: 列出 components/ 下所有 .vue 文件名
ls src/pages/<业务块>/components/*.vue 2>&1

# 步骤 2: 对每个组件，**grep 真正的 import 路径**（不是字符串提及）
# 命中规则：精确匹配 `import <ComponentName> from "..."` 其中路径指向该组件
for comp in $(ls src/pages/<业务块>/components/*.vue | xargs -n1 basename | sed 's/\.vue$//'); do
  echo "=== $comp 真调用方 ==="
  grep -rnE "^import[[:space:]]+${comp}[[:space:]]+from" src/pages/ --include="*.vue" --include="*.ts" 2>&1
done
```

**判定标准**（满足以下**全部**才认作"真跨页复用"）：
- 1️⃣ grep 输出**至少 2 个**真 import（import 行 + `from` 路径指向该 .vue 文件）
- 2️⃣ 这 2 个 import 来自**不同业务模块**的 .vue / .ts（不是同一文件 + 同一目录内的子组件引用）
- 3️⃣ 调用方**不限于** addOrEdit 目录——必须包含 `index.vue` / 其他 addOrEdit 之外的 .vue

**判定红线**（**不认作**"跨页复用"的 4 种情况）：
- ❌ grep 只命中 doc 注释 / JSDoc / 中文说明里提到组件名（**不是 import**）—— 之前 SubAccountManager 误判就是这种情况（fill.vue 注释提了但没 import）
- ❌ grep 只命中 1 个 import（即使来自另一个 .vue）—— 单调用方也该放 addOrEdit/components/
- ❌ grep 命中的多个 import 都来自同一 addOrEdit 目录（fill.vue 跟 detail.vue 同目录）—— 仍是 addOrEdit 内复用
- ❌ grep 命中的 import 路径不对应（"SubAccountManager" 字符串在别处使用但不是该组件）—— 必须验证 from 路径

**违规处置**：
- ❌ `store/components/ChangeInfoModal.vue` 仅 `addOrEdit.vue` 1 个真 import → 应挪到 `addOrEdit/components/`
- ❌ `store/components/SubAccountManager.vue` 仅 `addOrEdit.vue` 1 个真 import（fill.vue 只是 doc 注释提到）→ 应挪到 `addOrEdit/components/`
- ❌ 业务块没跨页组件却保留 `components/` 空目录 → 删目录（**禁预创建空目录**）

**判定例外**（以下情况**不违规**）：
- ✅ grep 命中 ≥2 个真 import 且跨业务块（如 `StoreAuditOnboarding/fill.vue` 用了 store 的 SubAccountManager）—— 业务块共用
- ✅ 组件被 `defineExpose` + `renderDialog` 命令式调用（命令式调用也是真调用方）

**反模式**：
- ❌ "这个组件以后会跨页用，先放外层"—— 首次就该放内层（"以后" = 不可证伪的预言）
- ❌ "doc 注释提到 = 算用到"—— doc 注释是给人看的，import 是机器验证的
- ❌ "grep 命中文本就算引用"—— 必须是 `^import` 开头的行
- ❌ "外层有 components/ 目录就该填东西"—— 业务块没跨页组件就**不创建**该目录

#### 检查 5b：components 私有的 formRules inline 审查

> 业务背景：addOrEdit/components/*.vue 里若内联 `const formRules: FormRules = {...}` 且依赖 props / 含 validator，**必须抽 factory 到 addOrEdit/config/。** 详见 检查 11。

#### 检查 5c：computed 包纯静态（高频违规点）

> 业务背景：之前 closeStoreFormItems 9 行 + computed 包装（纯静态）→ 反模式。**先看 computed，再看行数**。

**扫描命令**（必检）：

```bash
# 扫 .vue / .ts 顶层 const X = computed(() => [...]) 模式
grep -rnE "^const[[:space:]]+\w+[[:space:]]*=[[:space:]]*computed\(" src/pages/<业务块>/ 2>&1
```

**判定**（按以下顺序执行）：

```bash
# 对每个命中行，紧跟查看 computed 体内是否含响应式依赖
# 命中以下任意关键字 = 真 computed（不拆）
grep -A 10 "^const.*=.*computed(" src/pages/<业务块>/addOrEdit/<file>.vue | grep -E "\.value\.|props\.|reactive\(|ref\("
```

**判定公式**（**v3 最终态，2026-10-15 补"纯数据写成方法、值传进去"**）：

> 前提认知：`computed` 体内**全是纯数据**（数组 / 对象字面量），没有副作用、没有异步。所以它**总能**搬进 `config/`，唯一区别是**依赖的值从哪来**。

- 命中 `computed(() => [...])` + 体内**无** `.value` / `props.` / `reactive` → **去 computed + 抽 addOrEdit/config/ 常量化**（`export const X = [...]`）
- 命中 `computed(() => [...])` + 体内**引用**了 `.value` / `props.` / `reactive`（如 `companyOptions.value.map(...)`）→ **抽成方法放 config，把这些值当参数传进去**：
  - config：`export function getXxxFormItems(companyOptions: Opt[], operatorId?: string): FormItemConfig[] { return [...] }`
  - .vue：`const formItems = computed(() => getXxxFormItems(companyOptions.value, formData.operatorId))`
  - 响应式依赖留在 `.vue` 侧的 `computed` 回调里求值（`.value` / `props.x` 就在回调中），追踪自然生效，**不需要**传 `Ref` / `Reactive` 包装
- 命中 `computed(() => ({ ... }))` 同理 → 方法返回对象，依赖值当参数传入
- 命中 `computed(() => 布尔表达式)`（如 `isView = computed(() => mode.value === VIEW)`，1 行）→ **可留 .vue**，它不是数据

**违规处置**：
- ❌ `addOrEdit.vue:203 closeStoreFormItems = computed(() => [...6 静态 item...])`（9 行 + 无响应式依赖）→ 抽 `addOrEdit/config/CLOSE_STORE_FORM_ITEMS` 常量
- ❌ `addOrEdit/detail.vue:baseDescItems = computed(() => [...12 静态 item...])` → 抽 `addOrEdit/config/baseDescItems` 常量
- ❌ `addOrEdit/detail.vue:statusDescItems = computed(() => [...2 静态 item...])`（5 行但 computed 包装）→ 抽 `addOrEdit/config/statusDescItems` 常量

**反模式**：
- ❌ "computed 包装一下未来可扩展"—— 未来可扩展是借口；当前纯静态就是反模式
- ❌ "体内有响应式依赖 = 留 .vue，拆出去丧失响应式"—— **错**！computed 体内是纯数据，把依赖的值当参数传进 config 方法即可；`.value` / `props.x` 仍在 .vue 侧 computed 回调里求值，追踪不丢（store/ formItems 2026-10-15，user 纠正）
- ❌ "怕丧失响应式，所以把 `Ref<T>` / `Reactive<T>` 容器传给 config 方法"—— **多余**：config 方法只用到值，不需要 ref 容器；传 `.value` 解包后的值就够
- ❌ "computed 是 Vue 写法，const 写法不对"—— Vue 写法 ≠ 任何地方都该用；纯静态数据用 const 更直白
- ❌ "我先 computed 包装，下次加 reactive 依赖"—— 等真要加再换 computed；**当前**就该是 const

### 检查 6：components/*.vue 弹窗无壳模式

```ts
// ✅ 正确：内容不含 el-dialog，暴露 submit()
defineExpose({ submit })

// ❌ 违规：组件内含 el-dialog
<el-dialog>...</el-dialog>
```

### 检查 7：数据流契约（参考 file-responsibilities.md）

- 列表/详情/编辑/删除全按业务唯一流水号 `uniqueValue`，不用自增 `id`
- 列表/详情共用 VO（一个类型两用）
- 配置与视图分离：表格列/搜索项全部工厂化
- 下拉选项由 `index.vue` 异步注入（不是写死）

### 检查 8：`utils/` 文件例外审查（高频违规点）

> **`utils/` 默认只能放 `index.ts`**。仅 3 类例外可独立成文件（`*.composable.ts` / `validation.ts` / `*.test.ts`），其他文件一律合进 `utils/index.ts`。

**违规标志**：
- ❌ `utils/` 下出现非例外文件（如 `format.ts` / `relatedUser.ts` / `companyEventBus.ts` 中不带 lifecycle 钩子的纯函数部分）—— 应合进 `utils/index.ts`
- ❌ `utils/validation.ts` 总行数 <100 行（不属"大块"，应合进 `utils/index.ts`）
- ❌ `*.composable.ts` 命名不带 `useXxx` 前缀（违规）
- ❌ `*.composable.ts` 实际不含任何 vue lifecycle 钩子（不应独立成文件）
- ❌ `utils/*.test.ts` 与 `utils/index.ts` 不在同一目录

**合法示例**（当前仓库已存在）：
- ✅ `bankCard/utils/validation.ts`（158 行 >100 行阈值）—— 例外 2
- ✅ `businessScope/utils/validation.ts`（95 行，刚好 ≤100；如未来扩展可加）—— **边缘案例，按"接近阈值"放宽**
- ✅ `company/utils/companyEventBus.ts` 含 `onBeforeUnmount` 的 `useCompanyViewTab` composable —— 例外 1
- ✅ `StoreAuditOffboarding/utils/index.test.ts` vitest 单测 —— 例外 3

**整改动作**：
```bash
# 违规文件合并
cat src/pages/<业务块>/utils/format.ts >> src/pages/<业务块>/utils/index.ts
rm src/pages/<业务块>/utils/format.ts
# import 改："./format" → "."
```

### 检查 9：内层 enum/config/utils 触发审查（**高频遗漏点**）

> 这是**反向扫描**检查——不仅看目录存在性，还要扫 .vue 内容看是否有该拆未拆的 inline enum/config/utils。

**扫描命令**：
```bash
# 扫 inline 枚举选项数组（应拆到 addOrEdit/enum/）
grep -rn "const.*OPTIONS.*=" src/pages/<业务块>/addOrEdit/*.vue

# 扫 inline Descriptions items 数组（应拆到 addOrEdit/config/）
grep -rn "const.*Items.*=" src/pages/<业务块>/addOrEdit/*.vue

# 扫 Descriptions items 工厂函数（应拆到 addOrEdit/config/）
grep -rn "function.*Items.*(" src/pages/<业务块>/addOrEdit/*.vue

# 扫行数，判断是否超阈值
wc -l src/pages/<业务块>/addOrEdit/*.vue
```

**违规标志**（必须满足以下三条才算"该拆"）：
- 1️⃣ 在 `addOrEdit/*.vue` 中命中上述 grep 模式
- 2️⃣ 该数组/函数 **仅被 1 个 .vue 文件使用**（grep 验证）
- 3️⃣ 行数满足阈值（enum ≥5 行 / config Descriptions items ≥10 行 / DynamicForm items ≥15 行）

**违规处置**：
- ❌ `addOrEdit/detail.vue` 出现 `STORE_COUNT_OPTIONS`（5 项选项 + type）但未对应 `addOrEdit/enum/index.ts` —— 应拆
- ❌ `addOrEdit/detail.vue` 出现 `baseDescItems` / `storeCardItems` / `storeCardData` 但未对应 `addOrEdit/config/index.ts` —— 应拆
- ❌ `addOrEdit/*.vue` 任一文件 >400 行且包含 ≥3 个 inline 数组/工厂函数 —— 应拆

**判断例外**（以下情况不违规）：
- ✅ computed 依赖 reactive state（如 `baseDescData = computed(() => ({...}))`）—— 依赖 .vue 内变量，留 .vue
- ✅ 工厂函数仅 1-3 行（如 `maskIdCard` 1 行函数）—— 不够"大块"阈值
- ✅ 选项数组仅 1-4 项（如 `[{ value: "1", label: "启用" }]`）—— 不够"枚举"阈值

**反模式**：
- ❌ "反正只有 1 个 .vue 用，拆出来反而麻烦"——这就是内层判断的反向证据，必须拆
- ❌ "等到 addOrEdit 文件 >500 行再拆"——发现就拆，不是阈值过后才拆
- ❌ "拆出去跨文件 import 更繁琐"——跨文件 import 是 Vue 项目常态，不是反拆理由

### 检查 10：顶部 header 触发审查（顶栏复用 → config/）

> `addOrEdit/` **不建 `menu/` 目录**。顶部 header 的 UI 资源（容器 class / 标题文案）和 actions 工厂均放 `addOrEdit/config/index.ts`，与表单 items / 描述项 同质。

**扫描命令**：
```bash
# 扫顶栏容器 class 重复（config/ 触发）
grep -rn "sticky top-0 z-10" src/pages/<业务块>/addOrEdit/*.vue

# 扫顶栏 container 长 className（≥3 行重复）
grep -rn "flex items-center justify-between px-6 py-4 bg-white border-b" src/pages/<业务块>/addOrEdit/*.vue

# 扫 header 标题常量模式
grep -rn "text-base font-semibold text-\[#1f2937\]" src/pages/<业务块>/addOrEdit/*.vue
```

**违规标志**（满足以下任一条必须拆）：
- 1️⃣ ≥2 个 .vue 出现完全相同的 `sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b` 容器 class —— 应提取 `PAGE_HEADER_CLASSES` 常量到 `addOrEdit/config/index.ts`
- 2️⃣ ≥2 个 .vue 出现 ≥2 个按钮 v-if 条件 + 标题文字 —— 应提取 `getXxxHeaderActions(ctx)` factory 到 `addOrEdit/config/index.ts`
- 3️⃣ header 内的标题/状态标签 chip 文本（"店铺上架流程-详情" / "当前状态："）直接 inline —— 应提取为 const

**违规处置**：
- ❌ detail.vue / fill.vue / index.vue 3 个文件均使用同一 `sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-[#e8e8e8]` 容器 class —— 应拆 `PAGE_HEADER_CLASSES`
- ❌ 3 个文件均有顶栏 el-button v-if 操作按钮组（detail 4 个 / fill 2 个 / index 3 个）—— 应拆 `getDetailHeaderActions` / `getFillHeaderActions` / `getIndexHeaderActions` factory
- ❌ 标题文字"店铺上架流程-详情" 直接 inline —— 应拆 `DETAIL_HEADER_TITLE` 常量

**判断例外**：
- ✅ 顶栏仅 1 个 .vue 文件用 + 无 v-for 渲染需求 —— 不拆（仅用于 ≥2 个页面复用）
- ✅ 顶栏结构高度特化（如包含特殊 el-tabs / el-steps 等）—— 不拆，inline 更清晰

**反模式**：
- ❌ "header 差异太大没法抽" —— 容器 class / 标题 / actions 数组都能拆，差异大反而说明需要工厂函数定制
- ❌ "为 header 单建 `addOrEdit/menu/`" —— header 资源与表单 / 描述项 同质，都放 `config/`；**外层业务块不建 menu/，addOrEdit 也不建 menu/**

### 检查 11：组件级 form rules 触发审查（→ config factory）

> `addOrEdit/components/*.vue` 的 `const rules: FormRules = {...}` 含自定义 validator 或依赖 props 时，抽到 `addOrEdit/config/index.ts` 的 `getXxxFormRules(ctx)` factory。与页面级 FORM_RULES 同质，仅作用域不同。

**扫描命令**：
```bash
# 扫组件级 FormRules inline（检查 11 触发）
grep -rn "const rules.*FormRules\|: FormRules =" src/pages/<业务块>/addOrEdit/components/*.vue 2>&1

# 扫组件级自定义 validator（强烈指标）
grep -rn "validator:.*=>" src/pages/<业务块>/addOrEdit/components/*.vue 2>&1
```

**违规标志**（满足以下任一条必须拆）：
- 1️⃣ `addOrEdit/components/*.vue` 的 `rules` 行数 ≥7 行
- 2️⃣ rules 包含自定义 `validator`（去重 / 异步校验 / 格式正则）
- 3️⃣ rules 依赖组件 `props.*`（如 `props.existing` / `props.editingIndex`）

**违规处置**：
- ❌ `addOrEdit/components/SubAccountForm.vue` 内联 `rules: FormRules = {...}` 27 行（含去重 validator + 邮箱·手机格式校验 + 依赖 `props.existing` / `props.editingIndex`）—— 应拆 `getSubAccountFormRules(ctx)` 到 `addOrEdit/config/index.ts`
- ❌ 子组件规则含异步 validator（如 `listAvailable({...}).then(...)`）未拆 —— 必须抽 factory 传 ctx

**判断例外**：
- ✅ rules 仅是必填 + 长度校验（无 validator + 无 props 依赖），且 ≤6 行 —— 不拆，inline 更易读

**反模式**：
- ❌ "rules 是组件内部细节不必抽" —— 与表单 items / 描述项同质，多文件复用时拆 factory 是避免修改者四处同步；未来出现第二个组件复用人去重 / 格式校验时可复用
- ❌ "把 props 直接传进 factory 函数体里" —— 破坏 props 响应式订阅，应传 ctx（factory 调用时拍快照即可，表单 rules 本身不依赖响应式更新）

### 检查 12：页面级 FormRules 抽离位置审查（→ config/ 或 enum/）

> 业务背景：`addOrEdit/*.vue` 顶层的 `FormRules` 对象（不管变量名叫 `formRules` / `rules` / `xxxRules`）抽离到哪——`config/` 还是 `enum/`——**就近原则**有明确的判定公式。之前 store/ 案例中 `STORE_ADD_OR_EDIT_FORM_RULES` 错放外层 `enum/` 就是没遵守就近原则。

**扫描命令**（**v2：按类型注解扫，不按变量名扫**）：

```bash
# 主命令：扫 addOrEdit/*.vue 顶层所有 FormRules 注解的 const（任意变量名）
grep -rnE "^const[[:space:]]+\w+[[:space:]]*:[[:space:]]*FormRules" src/pages/<业务块>/addOrEdit/*.vue 2>&1
# 补充：扫 .ts config 里的具名导出（判位置对错）
grep -rnE "^export const[[:space:]]+\w+_FORM_RULES.*FormRules" src/pages/<业务块>/enum/*.ts src/pages/<业务块>/addOrEdit/config/*.ts 2>&1
```

> ⚠️ **v2 变更（storeEntryPlatform 2026-10-15 事故）**：v1 只扫 `^const[[:space:]]+formRules`，漏掉了 `const rules: FormRules<X>` / `const phoneRules: FormRules<X>` / `const fieldRules: ...` 等任意命名。**判定依据是类型注解 `FormRules`，不是变量名**。事故：`storeEntryPlatform/addOrEdit/index.vue:148 const rules: FormRules<StoreEntryPlatformFormState> = {...14 行纯静态...}` 被 v1 扫描漏掉，user 直接点名才抽出。

**判定**（**就近原则 2 选 1**）：

```bash
# 步骤 1: 检查 rules 体内是否 import 自 ../enum 或引用 enum 工厂
grep -A 50 "^const[[:space:]]+\w+[[:space:]]*:[[:space:]]*FormRules" src/pages/<业务块>/addOrEdit/<file>.vue | grep -E "from \"\.\./enum\"|createDictionaryEnum|new \w+Enum\("

# 步骤 2: 检查是否跨页共享字段名（多个 addOrEdit/*.vue 引用同一 formRules 名字）
grep -rn "<FORM_RULES_NAME>" src/pages/<业务块>/addOrEdit/ 2>&1
```

**判定公式**：
- 步骤 1 **命中**（import 自 `../enum` 或引用 `createDictionaryEnum` 等 enum 工厂）→ 抽到 `addOrEdit/enum/index.ts`（**允许特例**，与字典共享字段名）
- 步骤 1 **不命中**（纯静态、仅 required/min/max/type）→ 抽到 `addOrEdit/config/index.ts`（**默认位置**）
- 步骤 2 命中（多 .vue 共享）→ 抽到 `addOrEdit/config/index.ts` 作 factory（如果差异大）或各 .vue 就近（如果差异小）

**违规处置**：
- ❌ `addOrEdit/addOrEdit.vue:135 const formRules: FormRules = {...27 行...}`（纯静态，无 enum 工厂引用）→ 抽到 `addOrEdit/config/index.ts` 作 `STORE_ADD_OR_EDIT_FORM_RULES`
- ❌ `addOrEdit/index.vue:148 const rules: FormRules<StoreEntryPlatformFormState> = {...14 行纯静态...}`（**变量名不叫 formRules，v1 扫描漏掉**）→ 抽到 `addOrEdit/config/index.ts` 作 `STORE_ENTRY_PLATFORM_FORM_RULES`，调用方 `import { STORE_ENTRY_PLATFORM_FORM_RULES as rules } from "./config"`（**alias import 保住模板 `:rules="rules"` 不改**）
- ❌ `store/enum/index.ts:88 export const STORE_ADD_OR_EDIT_FORM_RULES: FormRules = {...}`（纯静态 formRules 错放外层 enum/）→ 挪到 `addOrEdit/config/index.ts`
- ❌ `addOrEdit/add.vue` 与 `addOrEdit/editOrCheck.vue` 各自重复定义同一 formRules → 抽 `addOrEdit/config/getFormRules()` factory（如果差异大）或就近（如果差异小）

**判断例外**：
- ✅ rules <7 行 + 仅 required / min / max / type（无 validator）—— 可保留 inline（就近可读，**不**强行抽）
- ✅ rules 引用 enum 工厂（如 `createDictionaryEnum`）→ 抽到 `addOrEdit/enum/index.ts`（**允许特例**）
- ✅ rules 体内只是把 config 里的字段规则重新组装（如 `phone: phoneRules`）→ 保留薄壳 inline，字段规则本体在 config

**反模式**：
- ❌ **扫描只 grep 变量名 `formRules`**（漏 `rules` / `xxxRules` / `FormRules<T>` 泛型形式）——**必须按类型注解 `FormRules` 扫**，这是 storeEntryPlatform 2026-10-15 事故根因
- ❌ "抽到 config/ 但模板 `:rules="rules"` 要改"—— 用 `import { XXX_FORM_RULES as rules }` alias import，模板零改动
- ❌ "formRules 抽到 enum/ 让所有字典集中管理"—— enum/ 应该装字典 / 状态码，不该装 formRules；纯静态 formRules 放 enum/ = 大杂烩
- ❌ "formRules 抽到 config/ 但 config/ 反向依赖 enum 工厂"—— 破坏单层依赖，违反就近原则
- ❌ "formRules 跨 addOrEdit/*.vue 重复定义，懒得抽"—— 重复定义会随字段增减漂移，必须抽 factory 或就近统一

**抽到 config 后的 2 个必做动作**：
1. **相对路径**：`addOrEdit/config/index.ts` 里 import 业务块根 types 要写 `"../../types"`（不是 `"../types"`）
2. **import 排序**：`perfectionist/sort-named-imports` 要求 `import { getFormItems, XXX_FORM_RULES as rules, validateSaveForm }`——alias import 排在最后，非 alias 按字母序

## 结论分类（必填）

按 `references/06-product-boundary.md` 严格区分三类：

| 结论 | 何时使用 | 是否下发 |
|---|---|---|
| **必须整改（规范违规）** | 检查清单明确判定为不合规 | ✅ 直接下发整改 |
| **建议优化（需需求确认）** | 不影响现有流程但有改进空间 | ⚠️ 等用户确认 |
| **无需修改（已符合规范）** | 当前实现合规 | ❌ 不动 |

## 输出格式（审查报告）

```
## 审查结论：[业务模块名]

### 必须整改（X 项）
1. [违规项] —— [违规位置] —— [整改建议]
2. ...

### 建议优化（Y 项，待需求确认）
1. [建议项] —— [潜在影响] —— [需确认的内容]
2. ...

### 无需修改（Z 项）
1. [合规项]
2. ...
```

## 反模式（不要做）

- ❌ 把"建议"标注为"必须整改"（混淆规范结论）
- ❌ 把产品建议（如"加个 Tab"）混入目录规范违规清单
- ❌ 审查同时擅自修改代码（本目标是只读）

### 检查 13：inline type/interface 集中化审查（**目标 9 反向扫描**）

> 业务背景：业务代码常见"在 .vue 顶层 `<script setup>` 块内 / .ts 顶层声明 `interface FormState` / `type ViewTabKey` / `interface BiUserOption`"——这种 type/interface 本应集中到就近 `types/index.ts`，却散在 10 个文件里，重复定义 + 跨文件难找 + 无法用 `paths`/`as const` 共享。store/ 模块 2026-10-15 集中化案例：22 个 type/interface 从 `apis/type.ts` 集中到 `types/index.ts`，删 apis/type.ts 455 行；addOrEdit.vue 1 个 inline BiUserOption 复用 @/pages/company/types 避免重复定义。详见 `references/09-no-inline-type-in-vue.md`。

**扫描命令**（**6 种 .ts 顶层 + 2 种 .vue 顶层**）：

```bash
# 1. 扫 .ts 顶层 interface 声明（apis/type.ts + apis/index.ts + config/index.ts + utils/*.ts + addOrEdit/apis/*.ts）
for f in $(find src/pages/<业务块> -type f -name "*.ts" 2>/dev/null); do
  if [ -f "$f" ]; then
    # 跳过 types/index.ts（已合规）
    case "$f" in */types/index.ts) continue ;; esac
    grep -nE "^(export[[:space:]]+)?(interface|type)[[:space:]]+[A-Z]\w*" "$f" 2>/dev/null
  fi
done

# 2. 扫 .vue <script setup> 顶层 interface 声明
for f in $(find src/pages/<业务块> -type f -name "*.vue" 2>/dev/null); do
  if [ -f "$f" ]; then
    # 提取 <script> 块扫顶层 interface / type
    awk '/<script[^>]*>/,/<\/script>/' "$f" 2>/dev/null | grep -nE "^(interface|type)[[:space:]]+[A-Z]\w*"
  fi
done

# 3. 快速检查（单行 grep，适合人脑查 1 个文件）
grep -nE "^(interface|type)[[:space:]]+[A-Z]\w*" src/pages/<业务块>/addOrEdit/*.vue
```

**判定公式**（**A vs B 选项**）：
- **A 选项**（推荐，user 2026-10-15 在 store/ 选用）：**所有 type/interface 全部集中到业务块根 `types/index.ts`**，包括 `apis/type.ts` + `addOrEdit/apis/type.ts` 里的 DTO/VO；调用方统一从 `./types`（或 `../types`）import；`apis/type.ts` 退化/删除
- **B 选项**（保守）：仅 .vue 顶层 + config/utils 散落的 type 集中；`apis/type.ts` 保留 DTO 定义

**违规标志**（满足以下任一条必须整改）：
- 1️⃣ `addOrEdit/*.vue` 顶层 `interface X` / `type X`（如 `interface FormState` / `interface BiUserOption`）—— 应抽到就近 `types/index.ts`
- 2️⃣ `apis/type.ts` 存在业务主类型 + 同时业务块根 `types/index.ts` 存在 —— 应**A 选项**集中（删 apis/type.ts，改调用方 import 路径）
- 3️⃣ `apis/index.ts` / `addOrEdit/apis/index.ts` / `config/index.ts` / `utils/*.ts` 顶层 `interface X`（如 `interface CompanySelectItem`）—— 应抽到就近 `types/index.ts`
- 4️⃣ 跨业务块 inline 重复定义（如 store/addOrEdit.vue 的 `interface BiUserOption` 跟 company/types/index.ts 的 `BiUserOption` 字段 100% 一样）—— 应**复用** `@/pages/<其他业务块>/types` 的 export，不复制

**违规处置**（**4 步流程**，详见 `references/09-appendix-remediation.md`）：
- 1️⃣ **步骤 1：扫描现状** — 跑上述 6 种命令 + JS 脚本（附录 A 完整脚本）列出所有 type/interface 位置 + 调用方
- 2️⃣ **步骤 2：判定 A/B** — 与 user 确认 A 选项（推荐）还是 B 选项
- 3️⃣ **步骤 3：写入 `types/index.ts`** — 按章节组织（基础枚举 / 实体与子类型 / 列表分页 / 批量操作 / 保存 DTO / 辅助下拉）
- 4️⃣ **步骤 4：删原文件 + 改 import 路径** — 必删 doc 三件套（4a 强制）；路径按文件相对位置算（`addOrEdit/apis/*.ts` → `../../types`；`addOrEdit/*.vue` → `../types`；`apis/*.ts` → `./types`；外层 → `./types`）

**判断例外**（以下情况不违规）：
- ✅ `types/index.ts` 自身是合规出口
- ✅ 全局共享类型 import（`import type { FileUploadRecordVO } from "@/common/types/shared"`）—— share 包已集中
- ✅ 第三方库类型 import（`import type { VxeGridPropTypes } from "vxe-table"`）—— 库自带 .d.ts
- ✅ `import type { Foo } from "./types"` 引用就近 types —— 合规用法
- ✅ 局部 1 行 helper type（仅 string union）—— `type Mode = "view" | "edit"` 且仅 1 个 .vue 用
- ✅ 跨 add + edit 页面共用 FormState 已拆 2 个（`AddFormState` / `EditOrCheckFormState`）—— 合规

**反模式**：
- ❌ "为了简单先放 .vue" —— 首次就该放对位置
- ❌ "反正只有 1 个调用方" —— 单调用方也是就近 types 判定依据
- ❌ 把所有 type 都搬到 `@/common/types` —— 就近 types 才是规范
- ❌ 保留旧 `apis/type.ts` re-export 兼容 —— 直接删，pages 内 TS 单步构建
- ❌ 删 import 时漏看是否还有别处用 —— 先 grep 再删
- ❌ `apis/type.ts` + `addOrEdit/apis/type.ts` 保留 DTO 但 .vue 顶层 type 已集中（B 选项不一致）—— 必须 A 或 B 二选一到底
- ❌ 跨 add + edit 页面的 FormState 合并成 1 个 `FormState` 共享 —— 拆 2 个 `AddFormState` / `EditOrCheckFormState`
- ❌ types/index.ts 反向依赖 `./enum`（如 `type ViewTabKey = typeof VIEW_TABS[number]["key"]`）—— 解耦，用 `type ViewTabKey = CompanyViewTab`
- ❌ 跑 `npx eslint src/pages/<业务块>/` 整目录 —— 只跑本次改的文件
- ❌ `import type { X } from "./types"` 后又 `import type { X } from "./apis/type"`（重复 import）—— 保留 1 个
