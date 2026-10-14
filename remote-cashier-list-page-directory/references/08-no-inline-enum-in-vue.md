# 目标 8：禁止在 .vue 顶层定义 enum 风格变量（预防规范）

**核心问题**：业务代码里常见"在 .vue 顶层 `<script setup>` 块内写 `const X_OPTIONS = [{...}] as const` / `const X_ENUM = { ... } as const`"——这种 enum 风格字面量本应放就近 `enum/index.ts`，却硬塞进页面文件，污染组件、阻碍复用。

**本目标分两件事**：
1. **规范定义**（预防）——以后 vue 页面不能再这样写
2. **现状补救**（一次性清理）——已存在的违规一次性提取（详 `references/08-appendix-remediation.md`）

---

## 1. 规范定义（**核心**）

### 1.1 规则原文

> **禁止**在 `src/pages/**/*.vue` 顶层 `<script setup>` 块内定义 enum 风格的字面量 const。
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

**判定口诀**：「这个 const 是 `Record<...>` 字典、`[]` 选项数组、还是跨调用方共用的字面量？」——任一为是就违规；都不是就保留。

### 1.4 归属判定（提取到哪个 enum/）

按目标 4「共用放外层、独立放当前」：

| 变量被调用方 | 归属 |
|---|---|
| 仅 addOrEdit 内 1 个 .vue 用 | **内层** `addOrEdit/enum/index.ts` |
| addOrEdit 内 2+ 个 .vue 用 | **内层** `addOrEdit/enum/index.ts` |
| 列表页（外层 index.vue）+ addOrEdit 都有 | **外层** `enum/index.ts` |
| 被其他业务模块 import | **外层** `enum/index.ts`（再考虑是否提到 `@/common/enum`） |

**grep 实操**：

```bash
# 看变量 X 的所有调用方
grep -rn "\bX\b" src/pages/<业务块>/ --include="*.vue" --include="*.ts" | grep -v "enum/index.ts"
```

### 1.5 写法规约（写入就近 enum 的姿势）

```ts
// src/pages/<业务块>/enum/index.ts 末尾追加
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
- [ ] 如果必须保留（如函数内部局部 const），理由是？**留白**——业务代码无正当理由
- [ ] import 段是否合并到已有的 `./enum` import？**是** → 不要新建重复 import 段
- [ ] 删除原 .vue 里的定义时，是否连带删了关联注释 + 空行？**是** → 否则 ESLint 报 no-multiple-empty-lines

---

## 3. 自动化检查（pi 编辑时）

agent 在编辑 .vue 文件后，自动跑：

```bash
# 扫所有大写 const 顶层定义（识别 enum 风格）
# 用 ctx_execute 跑，参考附录 A 脚本
cd micro/cashier && npx ctx_execute --code "
const fs = require('fs');
const path = require('path');
// ... (附录 A 完整脚本)
"
```

**命中后处理流程**：
1. 报告给用户：「X.vue 第 N 行检测到 inline enum 风格 `Y = {...} as const`」
2. **不擅自修改**——询问用户是否提取；用户确认后按目标 4 归属判定提取

---

## 4. 反模式（不要做）

- ❌ "为了简单先放 .vue"——首次就该放对位置
- ❌ "反正只有 1 个调用方"——单调用方也是内层 enum 判定依据
- ❌ 顺手把 `MAX_*` 数字标量也搬进 enum/——非 enum 风格，YAGNI
- ❌ 全部 enum 提到 `@/common/enum`——就近 enum 才是规范
- ❌ 保留旧 .vue 文件 re-export 兼容——直接删，pages 内 TS 单步构建
- ❌ 删 import 时漏看是否还有别处用——先 grep 再删
- ❌ 跑 `npx eslint src/pages/<业务块>/` 整目录——只跑本次改的文件

---

## 5. 与其他 reference 的关系

- **目标 2（审查）**：第 9 项检查项扫出 "inline enum 未拆" 违规
- **目标 3（重构）**：路径 1-7 讲单文件挪位
- **目标 4（归属）**：1.4 节归属判定直接复用
- **04-shared-vs-private.md 模式 1**：描述了 inline 枚举选项数组违规

**一次性历史清理**（把现状已存在的违规提取掉）见附录 `references/08-appendix-remediation.md`——只有在收到"扫一遍 src/pages 把 inline enum 全提取了"这类指令时才执行，**不作为新代码规范的一部分**。
