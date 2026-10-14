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
