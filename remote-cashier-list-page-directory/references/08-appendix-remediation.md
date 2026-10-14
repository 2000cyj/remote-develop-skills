# 附录 A：一次性现状清理（仅历史违规补救）

> **警告**：本附录只在收到「把现状 src/pages 下的 inline enum 全提取了」类指令时执行。**新代码必须遵守** `08-no-inline-enum-in-vue.md` 规范，**不要再走批量清理**。

## 触发

用户偶尔会对现状做一次性扫荡（"我看很多地方那样写才让你扫的"），仅在收到这种指令时执行本附录。

> 📘 **兄弟规范**：type/interface 集中（目标 9）见 `references/09-no-inline-type-in-vue.md` + `09-appendix-remediation.md`。目标 8 管 enum 字面量，目标 9 管 type/interface，**两者并行**——用户可一次任务同时要求扫 enum + type。
>
> 📘 **代码风格**：JSDoc 注释与代码之间不允许空行（目标 10）见 `references/10-no-blank-line-between-doc-and-code.md`。批量提取 enum/type 后，**步骤 4 末尾**用 `perl -i -0pe 's| \*/\n\nexport | */\nexport |g'` 一次清空。
>
> 📘 **验收硬规则**：本附录步骤 5 必须走 `references/11-must-use-remote-ts-es-check.md`——只能扫本附录改过的文件，禁止全项目扫。

## 5 步流程

```
步骤 1：扫描 .vue 顶层 <script setup>，识别 enum 风格的顶层 const 定义
步骤 2：分类——按就近 enum 目录归属（外层 / addOrEdit 内层 / pages/dashboard 之类无 enum 子目录）
步骤 3：写入就近 enum/index.ts
步骤 4：删 .vue 里的本地定义 + 改 import（alias 保持原名，最小 diff）

> ⚠️ **【强制】4a. 删定义必删 doc 三件套**（2025-01 事故点）：
>
> 删 const / type / interface 块时，**必须**同时删：
> 1. **定义块本身**（`const NAME = { ... }` / `interface Name { ... }`）
> 2. **定义上面的 doc comment**（如 `/** 工商状态 value -> el-tag type */` —— 描述的是 const 的"映射"，const 没了 doc 成了无主注释）
> 3. **空行**（定义与上方/下方代码之间的空行 —— 不删会报 `no-multiple-empty-lines`）
>
> 漏任何一项 = 残留。常见漏点：
> - const 块之前的 `/** <name> value -> xxx */`（描述映射规则）
> - function 块之前的 `/** xxx 辅助方法 */`（描述 const 行为，const 没后无意义）
> - 同位置出现 2 个 doc（`/** Type → 颜色（用于 Tag background） */` + `/** Type value -> 颜色字符串 */` —— 删 const 后 2 个 doc 重复，删 1 个）
>
> **验证清单**（删除后必跑）：
> - [ ] `grep "value ->" <file>` —— 描述 const 行为的 doc 应为 0
> - [ ] `grep "颜色字符串\|颜色（用于" <file>` —— 描述 const 行为的 doc 应为 0
> - [ ] eslint `style/no-multiple-empty-lines` 应 0 错
> - [ ] vue-tsc 0 错
>
> **2025-01 事故案例**：`addOrEdit/utils/index.ts` 提取 5 个 map 到 `addOrEdit/enum/index.ts` 后，方法上面的 `/** xxx value -> el-tag type */` 5 个 doc 全部残留 + 印章 2 个重复 doc 残留。

> ⚠️ **【强制】4b. 跨文件抽取后的 doc 归属**：
>
> 把定义从 .vue 抽到 enum/index.ts 后，doc comment 也**跟定义走**——留在原 .vue 会变成无主注释。如 `company/addOrEdit/utils/index.ts` 的 `/** 印章状态 value -> 颜色字符串 */` 应跟着 `SEAL_STATUS_COLOR_MAP` 一起搬到 `addOrEdit/enum/index.ts`，不是留在 .vue。
>
> 抽取时**必读原文件**（Read 上下文确认 doc 语义），不要 regex 一刀切。

> ⚠️ **【强制】4c. 搬动数据必 git HEAD 拿原值，diff 验证（数据性保护）**（2025-01 重大事故点）：
>
> 适用场景：搬动 `Record<KEY, value>` 字典 / 搬动 `[{ key, label }]` 数组 / 搬动任何**字面量数据**（字符串、数字、URL、权限码、字段名、enum 名字等）。
>
> **强约束 5 条**：
> 1. **权威源是 `git show HEAD:<file>`，不是 working tree 当前内容**。
> 2. 搬动前 `git show HEAD:<file>` 拿**原值**（commit 后的版本），不要 Read 当前文件。
> 3. 把**原值**复制到新位置（不是 Read 看到的值）。
> 4. 搬完 `diff <(git show HEAD: ... | sed -n '/<DICT_NAME>/,/^}/p') <(working tree ... | sed -n '/<DICT_NAME>/,/^}/p')` 验证**值完全一致**。
> 5. 任何不一致 → 立刻停，问用户："working tree 当前值 vs git HEAD 不一致，你期望哪个？"**不要自己挑一个**。
>
> **反模式**（事故 2025-01-14）：
> - 任务：把 `COMPANY_TAB_PERM` 从 `utils/companyEventBus.ts` 搬到 `enum/index.ts`（纯结构改动）
> - 错误做法：Read 当前 working tree → 看到 `cashier:company:edit:*` → 照抄到新位置
> - 实际 git HEAD 值是 `gsglCheck*`（后端菜单下发的真实权限码）
> - 后果：8 个权限码全错 → 全公司模块 tab 全部无权限可见 → 业务事故
> - 根因：working tree 之前某次未 commit 的改动（可能 agent 幻觉或手动改）污染了源数据 → 搬动时直接照抄 → "幽灵值"扩散到新位置
> - 救回：user 提醒 + `git show HEAD:` + `git log --all -S` 验证
>
> **为什么 working tree 不可信**：
> - 可能存在未 commit 的改动（手动改 / agent 改 / stash drop / rebase 残留）
> - agent 的 summary / 上下文记忆可能污染判断（"我之前看到过这个值"）
> - Read 工具读的是 disk 文件，但 disk 文件**可能已经是错的**
> - 唯一权威：git HEAD（commit 后的版本）

> ⚠️ **【强制】4d. 防 agent 幻觉污染**（2025-01 事故点）：
>
> **强约束 3 条**：
> 1. **任何值改动，先 `git show HEAD:<file>` 拿原值比对**，禁止凭 summary / 记忆 / "看起来应该这样" 写值。
> 2. **不要把模型"看起来对"的值**（如通用命名规范 `xxx:yyy:zzz`、模板代码、推测的权限码）**当作事实写进代码**。agent 看到 `cashier:company:edit:*` 是"通用命名规范"就改原值 = 幻觉污染。
> 3. **改完任何字面量值**（特别是权限码 / 业务字段 / URL / 路径 / enum 名字）→ 必须 `git diff` 对比原值 → 任何非预期差异 = 立即回滚 + 报 user。
>
> **agent 幻觉常见 4 模式**：
> 1. **命名规范化幻觉**：看到 `foo:bar:baz` 觉得"通用"就改成 `category:sub:action` 形式
> 2. **类型推断幻觉**：看到 `string` 觉得"应该是 enum"就改成 enum 形式
> 3. **业务合理性幻觉**：看到旧字段觉得"不合理"就改成"更合理"的命名
> 4. **记忆污染幻觉**：之前 session 改过 working tree（没 commit）→ 后面 session 把"上次看到的值"当作 disk 实际值照抄
>
> **反模式 → 正模式**：
> - ❌ Read 当前文件 → 看到值 A → 直接用 A
> - ✅ `git show HEAD: <file>` → 拿到原值 B → 核对 B 是权威 → 用 B
> - ❌ summary 里写过值 X → 搬动时写 X
> - ✅ 不信 summary → `git show HEAD:` 验证 → 用 git HEAD 的值
> - ❌ "这看起来是命名不规范" → 主动改"更规范"
> - ✅ 业务字段 / 权限码 = 后端契约，不能改（user 没让改就不动）

> ⚠️ **【强制】4e. 防"业务合理性幻觉"**（2025-01 第二次事故点）：
>
> 适用场景：tag type / el-tag color / status 颜色编码 / enum value 映射 / 任何**业务字段映射**。
>
> **强约束 3 条**：
> 1. **业务字段映射 = 后端契约**，agent 不能凭"看起来更合理"改值。
> 2. 必查 `DictionaryKey.X` 或后端 enum 定义 / git HEAD 原值。
> 3. 任何值修改 → 必问 user："git HEAD 是 X，working tree 是 Y，保留哪个？"
>
> **反模式**（事故 2025-01-14）：
> - 任务：把 `COMPANY_STATUS_TAG_MAP` 从 `utils/index.ts` 搬到 `enum/index.ts`（结构性搬动）
> - 错误做法：搬动时凭"业务合理性"改了 4 个值（agent 觉得 `closed:warning` 应该是 `info`、`cancelled:info` 应该是 `danger`）
> - 实际 git HEAD 值是 `closed:warning / preparing:info / liquidating:info / cancelled:info` —— **是后端约定的颜色编码**
> - 后果：公司经营状态列的 el-tag 颜色全错（warning 变 info / info 变 warning / info 变 danger）
> - 根因：agent 凭"业务合理性幻觉"改值（"cancelled 看起来应该是 danger 不是 info"）
> - 救回：user 提醒 + `git show HEAD:` diff 验证 → 4 个值改回
>
> **判断点**（哪些不能改）：
> - ✅ **能改**：字段名（不涉及后端）/ import 路径 / 命名空间 / 文件结构
> - ❌ **不能改**：权限码 / enum value / tag type 颜色 / 状态值 / URL / 路径 / 菜单码
> - 判断标准：改了会不会影响后端契约 / 其他模块 / 用户可见行为 → 改前必查

> ⚠️ **【强制】4f. 防"架构变更幻觉"**（2025-01 第三次事故点）：
>
> 适用场景：路由路径 / router config / 菜单 / import 路径命名空间 / 任何**跨模块**改动。
>
> **强约束 3 条**：
> 1. **架构改动 = 多模块影响**，agent **不能**自作主张改。
> 2. 任何路径 / 路由 / 菜单改动 → 必查 router config + 主应用菜单 + git HEAD 原值。
> 3. 发现 git HEAD vs working tree 不一致 → **立即停，问 user**。user 没批准就**改回 git HEAD**。
>
> **反模式**（事故 2025-01-14）：
> - 任务：重构 `index.vue handleViewTab` 函数（从 mitt 事件总线传 tab）
> - 错误做法：agent 看到 `/gsgl/check` 路径觉得"应该统一到 `/company/edit/${uniqueValue}`" → 凭"架构统一幻觉"改了
> - 实际 git HEAD 是 `/gsgl/check`（gsgl 命名空间 = 公司管理模块的传统命名），user 之前**没批准**这次重构
> - 后果：列表"查看"按钮跳到**编辑页**（路径不一致 + query mode 错位）→ UX 严重 bug
> - 根因：agent 凭"架构统一幻觉"改路径（"其他路径都用 gsgl 命名空间，但 edit 路径已经改成 /company/edit/，所以 check 路径应该统一"）
> - 救回：user 提醒 → 改回 /gsgl/check
>
> **判断点**（哪些是架构改动）：
> - 任何 `path: "/..."` 字符串改动
> - 任何 router config 改动
> - 任何 import 路径命名空间改动（如 `./utils` → `../utils`）
> - 任何菜单 / 导航 / 权限相关改动
> - 判断标准：跨模块影响 + 改后需要多处同步 → 改前必问

> ⚠️ **【强制】4g. 改值必问 user（最高优先级，覆盖 4a-4f 所有场景）**：
>
> **唯一原则**：**任何 working tree vs git HEAD 字面量值差异 = 立即停，问 user**。
>
> **强约束 3 条**：
> 1. 不论差异大小（即使一个 value 字符串 / 一个常量 / 一个数字）= **必问 user**。
> 2. agent 不能"看起来更对就改了" / "之前觉得这样不对" / "应该统一" / "看起来更规范"。
> 3. **默认行为**：git HEAD 是权威，working tree 当前值 = **可能是污染**。除非 user 明确说"用 working tree 的值"，否则**改回 git HEAD**。
>
> **3 次事故总结**（3 次都是没问 user 就改了）：
> 1. `cashier:company:edit:*`（agent 凭"通用命名规范"幻觉，没问 user）
> 2. `COMPANY_STATUS_TAG_MAP` 4 个值（agent 凭"业务合理性"幻觉，没问 user）
> 3. `index.vue` 路径（agent 凭"架构统一"幻觉，没问 user）
>
> **必须问 user 的 3 类场景**：
> - 任何 working tree vs git HEAD 值差异
> - 任何"业务字段 / 路径 / 权限码"修改
> - 任何"agent 觉得应该改"但 user 没明说的改动
>
> **例外**（不需要问 user）：
> - 结构性搬动（删 const + 加 import）→ diff 验证一致即可
> - 删空文件 / 删空 import / 删无用注释
> - 拼写错误修复 / 注释优化 / 格式调整
步骤 5：用 remote-ts-es-check 验证 TS / ESLint / Vite build

> ⚠️ **硬约束（目标 11）**：步骤 5 必须遵循 `references/11-must-use-remote-ts-es-check.md`——**只能扫本附录改过的文件**（不传目录 / `.` / glob），禁止 `npx eslint src` / `pnpm lint` / `--fix` / 裸跑 `vue-tsc --noEmit`。
```

## 扫描时必看的 9 种违规模式（来自 `08-no-inline-enum-in-vue.md` §1.2）

1. `Record<KEY, value> as const` 字典对象
2. `[{ value, label }, ...] as const` 选项数组
3. `[{ key, label, ... }, ...] as const` 列表项
4. `Record<string, [c1, c2]>` 配色对象
5. `[{ title, description }, ...] as const` stepper
6. `readonly string[] as const` 字符串元组
7. `readonly Type[] as const` 元数据数组
8. **`const columns: VxeGridPropTypes.Columns = [...]` 表格列定义**
9. **`const formRules: FormRules = { ... }` 静态表单校验规则**

**保留（不算违规）**：
- `function getTableColumns(options) { return [...动态 push] }`——函数内动态构造
- `const formRules = { field: [{ validator: (_, val, cb) => {...} }] }`——含 validator 闭包

## 步骤 1：扫描脚本

```javascript
// 用 pi 的 ctx_execute 跑（避免 bash 内存压力，结果自动出现在聊天窗口）
const fs = require('fs');
const path = require('path');
const base = 'src/pages'; // 或 micro/cashier/src/pages

const findVueFiles = (dir) => {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...findVueFiles(full));
    else if (e.isFile() && e.name.endsWith('.vue')) files.push(full);
  }
  return files;
};

const findings = [];
for (const file of findVueFiles(base)) {
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) continue;
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('function ') || trimmed.startsWith('async function ')) continue;
    if (/^const\s+\w+\s*=\s*(ref|reactive|computed|useRoute|useRouter|useStore|onMounted|onUnmounted|watch|defineProps|defineEmits|defineExpose)/.test(trimmed)) continue;
    if (trimmed.startsWith('interface ') || trimmed.startsWith('type ') || trimmed.startsWith('enum ')) continue;
    const match = trimmed.match(/^const\s+([A-Z][A-Z0-9_]*)\s*(?::\s*[^=]+)?\s*=\s*(.+?)$/);
    if (!match) continue;
    const name = match[1];
    let rhs = match[2].trim();
    let j = i;
    while (j < lines.length - 1 && (rhs.split('{').length !== rhs.split('}').length || rhs.split('[').length !== rhs.split(']').length)) {
      j++;
      rhs += '\n' + lines[j].trim();
    }
    if (!rhs.startsWith('[') && !rhs.startsWith('{') && !/^["']/.test(rhs) && !/^-?\d/.test(rhs) && !/^true|^false/.test(rhs)) continue;
    findings.push({ file: file.replace(/\\/g, '/'), line: i + 1, name, rhsPreview: rhs.slice(0, 200) });
  }
}
console.log(`findings: ${findings.length}`);
for (const f of findings) console.log(`${f.file}:${f.line}  ${f.name} = ${f.rhsPreview.replace(/\n/g, ' | ')}`);
```

## 步骤 2：分类

按主文档 `08-no-inline-enum-in-vue.md` 1.2/1.3 表分类。

## 步骤 3：写入就近 enum/index.ts

每个常量 export 前加 `ponytail: 从 XX 提取` 注释。

## 步骤 4：改 import（最小 diff）

```ts
// 前
const SECTION_TITLE_COLORS: Record<string, [string, string]> = { /* 7 行 */ }

// 后
import { SECTION_TITLE_COLORS } from "./enum"  // 保持原名，无 alias
```

**alias 是最后手段**——只有原名跟 enum 里其他常量冲突时才用：

```ts
import { COMPANY_SECTION_STEPS as steps } from "./enum"  // 模板里 v-for="(s, idx) in steps"
```

**删干净原 .vue 里的**：定义 + 关联注释 + 空行（否则 ESLint 报 no-multiple-empty-lines）。

## 步骤 5：验证（remote-ts-es-check）

**只跑本次改的 N 个文件**：

```bash
# 1) ESLint
cd micro/cashier && npx eslint --no-warn-ignored <N 个文件路径> --format stylish

# 2) TS 类型（只 grep 本次文件）
cd micro/cashier && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep -E "error TS" | grep -E "<file-pattern>" | head

# 3) Vite build
cd micro/cashier && timeout 60 npx vite build --mode dev
```

**判定**：
- ESLint 0 errors
- 本次 N 个文件 0 TS 新错
- Vite build 成功
- 全项目剩余 TS 错 = pre-existing（不属本次范围）

## 报告模板

```
## 一次性清理结果

### 提取（X 个）
| 变量 | 提取到 | 删除处 |
|---|---|---|
| X | path/to/enum/index.ts | path/to/foo.vue |
...

### 跳过（X 个，非 enum 风格）
| 变量 | 原因 |
|---|---|
| MAX_X | 数字标量 |
...

### 验证
- ESLint: 0 errors
- TS: 0 新错（pre-existing N 个不属本次范围）
- Vite build: 成功
```
