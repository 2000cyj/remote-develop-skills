# 目标 9 附录：一次性清理 src/pages 全仓散落 type/interface

**用途**：当用户说"扫一遍 src/pages 把 inline type 全集中了" / "把所有 type 搬到就近 types/" 时，按本文档 5 步流程一次性提取。

**重要**：本文档是**一次性补救**，不是日常规范。日常规范见 `09-no-inline-type-in-vue.md`。

---

## 1. 5 步流程

### 步骤 1：扫描现状（dry-run）

用 `ctx_execute` 跑 JS 脚本扫 `src/pages/**/*.{vue,ts}`，列出每个 type/interface 的位置 + 调用方 + 建议归属。

```js
// 附录 A 完整脚本
const fs = require('fs');
const path = require('path');
const base = 'D:/OB/ob_web/packages/micro/cashier/src/pages';

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(vue|ts)$/.test(f)) out.push(p);
  }
  return out;
}

const decls = [];
for (const f of walk(base)) {
  let content = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.vue')) {
    const m = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (m) content = m[1];
  }
  // 匹配 interface / type 声明（不匹配 import 后的）
  const re = /^(?:export\s+)?(?:interface|type)\s+(\w+)\b/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    decls.push({ file: path.relative(base, f), name: m[1] });
  }
}
console.log(`total: ${decls.length} declarations`);
for (const d of decls) {
  // 找所有调用方
  const usages = [];
  for (const f of walk(base)) {
    if (f === path.join(base, d.file)) continue;
    let c = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.vue')) {
      const mm = c.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (mm) c = mm[1];
    }
    const re = new RegExp(`\\b${d.name}\\b`, 'g');
    if (re.test(c)) usages.push(path.relative(base, f));
  }
  console.log(`${d.file}#${d.name}  used by ${usages.length}: ${usages.slice(0, 3).join(', ')}${usages.length > 3 ? '...' : ''}`);
}
```

**输出**（示例）：
```
total: 39 declarations
apis/type.ts#CompanyAttributionType  used by 8: addOrEdit/add.vue, addOrEdit/editOrCheck.vue, ...
apis/type.ts#CompanyStatus  used by 5: addOrEdit/add.vue, addOrEdit/editOrCheck.vue, ...
addOrEdit/add.vue#FormState  used by 1: addOrEdit/add.vue (仅自身)
...
```

### 步骤 2：判定归属（A vs B 选项）

按 `09-no-inline-type-in-vue.md` 第 1.4 节判定。

**A 选项**（推荐）：所有 type/interface 集中到业务块根 `types/index.ts`，包括 apis/type.ts 的 DTO。

**B 选项**（保守）：仅 .vue 顶层 + config/utils 散落的集中；apis/type.ts 保留 DTO。

**与用户确认 A 或 B**——user explicit 选择。

### 步骤 3：写入 `types/index.ts`

按章节组织，参考 `09-no-inline-type-in-vue.md` 第 1.5 节。

**易错点**：
- 库强类型集成（mitt `<Events>` / VxeGrid `<TableColumn<T>>`）要放头部 import 段
- `interface Events` 不满足 mitt `Record<EventType, unknown>` 约束 → 改 `type Events = {...}` 形式 + 局部 `// eslint-disable-next-line ts/consistent-type-definitions`
- 跨 add + edit 页面共用 FormState 拆 2 个：`AddFormState` + `EditOrCheckFormState`（不合并）
- 加 `ponytail: 从 XX 提取` 注释

### 步骤 4：删除原文件 type/interface 块 + 改 import 路径

> ⚠️ **【强制】4a. 删 type/interface 必删 doc 三件套**（同 08-appendix 4a）：
>
> 删 type/interface 块时**必须**同时删：(1) 定义块本身 (2) 上面的 doc comment（如 `/** 门店信息，type=1 自身 / 2 工商 / 3 平台 */`） (3) 关联空行。漏 doc = 无主注释，漏空行 = ESLint `no-multiple-empty-lines` 错。
>
> 脚本必读原文件（`fs.readFileSync` 全文）确认 doc 边界，**不要 regex 一刀切**——type alias 多行（如 `type CompanyStatus\n  = | "opening" | ...`）可能跨多行且无 `;`，regex 抓不准。详见 `08-appendix-remediation.md` 步骤 4a。


**4 个子步骤**（推荐一次脚本完成，避免 11 文件多次 edit 漏改）：

```js
// 附录 B 完整脚本（仅 .ts 文件用；.vue 用 sed）
const fs = require('fs');
const path = require('path');
const base = 'D:/OB/ob_web/packages/micro/cashier/src/pages/company';

// 1. 删 interface / type 块（从 `interface X {` 或 `type X =` 到匹配的 `}` 或 `;`）
function findBlock(content, name) {
  const re = new RegExp(`(^|\\n)((?:export\\s+)?(?:interface|type)\\s+${name}\\b[\\s\\S]*?(?:^\\}|;))`, 'm');
  const m = re.exec(content);
  if (!m) return null;
  let start = m.index + m[1].length;
  let end = start + m[2].length;
  if (content[end] === '\n') end++;
  return { start, end };
}

// 2. 改 import 路径
// ...（参考 company 改造脚本，路径按文件相对位置计算）
```

**关键陷阱**：
- **import 路径**按文件相对位置算：`addOrEdit/apis/*.ts` → `../../types`；`addOrEdit/*.vue` → `../types`；`apis/*.ts` → `./types`；外层 → `./types`
- **绝对路径** import（`@/pages/<业务块>/apis/type`）也会指向同一个 module → 删旧的 `import type { ... } from "@/pages/.../apis/type.ts"` 块（与新 import 重复）
- **跨 add + edit 页面 FormState rename**：先 `FormState` → `AddFormState`/`EditOrCheckFormState` 全局 rename，再删 interface 块
- **删 interface 时连带删 const/let**：脚本找 `interface Events { ... }` 块只到 `}`，但**如果**接下来是 `const emitter = mitt<Events>()` 等，要保留——手动验证不要被正则吃错
- **同名 type 跨文件**（如 `CashierEmployeeListItem` 出现 2 处）——合并到 1 个
- **同 name type 跨文件但 body 不同**（如 add.vue FormState vs editOrCheck.vue FormState）—— 拆 2 个 AddFormState/EditOrCheckFormState

### 步骤 5：验证（vue-tsc + eslint + vite build）

> ⚠️ **硬约束（目标 11）**：本步骤必须遵循 `references/11-must-use-remote-ts-es-check.md`——**只能扫本附录改过的文件**（不传目录 / `.` / glob），禁止 `npx eslint src` / `pnpm lint` / `--fix` / 裸跑 `vue-tsc --noEmit`。
>
> ⚠️ **禁止 `--fix`**：eslint 命令必须去掉 `--fix`，改成手工最小修复（只改本附录产生的代码行）。

```bash
cd micro/cashier
# 1. 本附录改过的文件 lint（不传 --fix）
npx eslint src/pages/<业务块>/types/index.ts src/pages/<业务块>/apis/type.ts src/pages/<业务块>/apis/index.ts src/pages/<业务块>/addOrEdit/apis/type.ts src/pages/<业务块>/addOrEdit/apis/index.ts src/pages/<业务块>/addOrEdit/add.vue src/pages/<业务块>/addOrEdit/editOrCheck.vue src/pages/<业务块>/index.vue src/pages/<业务块>/config/index.ts src/pages/<业务块>/utils/index.ts src/pages/<业务块>/utils/companyEventBus.ts src/pages/<业务块>/addOrEdit/config/bankCardOptions.ts

# 2. vue-tsc（看是否 0 错）
npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep -E "<业务块>/" | head -20

# 3. vite build
npx vite build --mode dev 2>&1 | tail -3
```

**期望**：公司模块 0 错 + build 成功。

---

## 2. 报告模板

完成后给用户的报告：

```
【公司模块 type 集中化完成】

types/index.ts: <N> 行 / <N> 个 type/interface export（全部唯一）
<其他文件>: interface/type 全部清空（仅 <N> 个 re-export 保留）

| 验证 | 结果 |
|---|---|
| <业务块> vue-tsc | 0 错 ✅ |
| <业务块> eslint | 0 错 ✅ |
| vite build | <N>s 成功 ✅ |

【踩过的坑】（已修）
- <坑 1>
- <坑 2>
...
```

---

## 3. 不要做的（与目标 9 同步）

- ❌ 不擅自修改——必须用户先授权 A 或 B 选项
- ❌ 跑全仓扫（影响其他业务块）——本次只扫用户指定的业务块
- ❌ 一次提取 2+ 业务块——容易混路径错误，1 块 1 跑
- ❌ 改 04 规范（业务主类型放 apis/type.ts）——A 选项下 apis/type.ts 退化为 re-export 壳，但 04 文档不删
- ❌ 改 types/index.ts 后忘了 vite 缓存清理——`rm -rf node_modules/.vite` 后再 build
- ❌ 跑 `npx eslint src/pages/<业务块>/` 整目录——只跑本次改的文件
