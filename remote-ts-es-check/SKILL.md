---
name: remote-ts-es-check
description: Use when a frontend task changes a limited set of Vue, TypeScript, or JavaScript files and linting or repair must stay within the current task's edited files and changed hunks, without IDE/MCP or project-wide scans.
---

# Edited TS & ESLint Check

只检查本次任务实际编辑的前端文件，只修复本次任务产生的代码行。**任务编辑清单是范围边界**；工作区里的其他改动、同文件其他行和全项目诊断都不自动纳入。

## Scope Contract

检查前列出本次任务的编辑清单：文件路径及对应的 changed hunks。范围来源按优先级排列：

1. 当前任务实际执行过的编辑记录。
2. 用户明确指定的文件或代码范围。
3. `git diff --unified=0 -- <task-files...>`，仅用于确认上述范围。

`<task-files...>` 包含本次任务编辑的全部文件，包括配置文件；`<lint-files...>` 只是其中可交给 ESLint 的 `.vue`、`.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs` 子集。ESLint 不支持的配置文件（如 `tsconfig.json`）可以保留在手工修复范围内，但不能传给 ESLint；`vite.config.ts` 等受支持文件仍可属于 lint files。

不要从整个 `git status`、全仓 diff 或目录扫描推导范围，它们可能包含用户原有改动。新建文件的全部内容视为本次编辑范围。

ESLint 必须解析完整文件才能正确理解 Vue/TS 语法，因此检查命令的最小可靠粒度是文件；**可修复范围仍然是 changed hunks**。同文件其他行的诊断只记录为范围外问题，不修复。

## Workflow

1. **确认范围**：记录全部 task files 及 changed hunks，再从中筛出 lint files。
2. **只读检查目标文件**：

   ```bash
   npx eslint <lint-files...> --format stylish
   ```

   不传目录、`.`、glob 或整个工作区文件列表。
3. **筛选诊断**：只有"文件在编辑清单内且报错行与 changed hunk 相交"的诊断属于本次修复范围。其他诊断单独报告，不处理。
4. **手工最小修复**：只编辑对应 changed hunk。不要使用 `--fix`；即使只传一个文件，ESLint 也可能改写该文件的其他行。

   > **【强制】4a. 修复 import 路径后必须做"路径校验"**（防 TS2305 形态 2 / 形态 4）：
   >
   > 任何对 `import ... from "<path>"` 的路径或路径间标识符迁移修改（合并两个 `from "../apis"` 的 import、调整 import path 在 type.ts / index.ts / utils.ts 之间调动、改 `../apis` 到 `../apis/type` 等），修改前必跑：
   >
   > ```bash
   > grep -rn "export interface <Name>\|export type <Name>\|export const <Name>\|export function <Name>" src/ --include="*.ts" --include="*.vue"
   > ```
   >
   > 其中 `<Name>` 为被移动的每个标识符。把"文本上"写在 import 里的 path 与 `export` 出现的实际文件进行逐个对照。**不一致 → 报告为 TS2305 形态 2，不擅自修**。
   >
   > 背景：ESLint 不会扫跨文件类型图，不会发现 TS2305 路径错位；vue-tsc 默认不跑；本次修 `import/no-duplicates` 合并 import 时，如果仅以"同根路径多次 import"作为合并依据、不看实际 export 位置，就会把 value-export 里的接口名误到 type-only path 里，发生本错位。
   >
   > 简便记法：**"import path 合并/改动 → 先 grep export 再写代码"**。

5. **复查同一范围**：

   ```bash
   npx eslint <lint-files...> --format stylish
   git diff --check -- <task-files...>
   git diff --unified=0 -- <task-files...>
   ```

   最后确认没有新增范围外 hunk。ESLint 若只剩同文件其他行的既有问题，应明确说明，不能宣称整个文件通过。
6. **类型嫌疑主动扫描**（即使 ESLint 0 报错也要做）：
   - grep 任务文件中的 `\|\|` 兜底链、`as any` 断言、`@ts-ignore`、`eslint-disable`
   - **grep import 后未使用**：对每个 import 标识符，grep 该文件（除 import 行外）出现次数 = 0
   - **同名多源 import / 跨文件 import 路径错位**（形态 2 TS2305，**任何修改了 `from "<path>"` 的操作都必须走这一步**）：grep 标识符在 `src/` 全局（除 type.ts 自己）的 `export` 出现位置，对比 type.ts 写出的 import 路径；不一致则报告"路径错位、成员在另一文件真实存在"
   - **同名类型重复定义**（防 TS2322：同名 `interface` / `type` 在多个文件独立 `export`，TS 视为两个独立类型）：grep 同名任务 interface 定义数量 > 1 时，报告"重复定义 + 哪一份可选性更严/宽"。Ponytail rung 1：DTO / type 侧为唯一 source of truth，组件 / props 从 DTO import。
     ```bash
     # 找出同名字 interface / type 多次定义点
     grep -nE "(interface|type)\s+OnboardingSubAccount\b" src/ -r --include="*.ts" --include="*.vue"
     ```
     命中 > 1 处 → 报告"重复定义"，不擅自合并（判断保留哪一份需业务上下文）
   - **函数返回类型推断 unknown / 缺签名**（防 TS2345：函数体从 `Record<string, unknown>` 取出后用 `||` 兑底为字符串，推断为 `unknown | string`，调用方期待纯 `string` 时报错）：grep 函数参数为 `Record<string, unknown>` / `Record<string, any>` / `{ [k: string]: any }` 等索引返回未定类型的定义，同时函数体含 `|| "..."` 兑底表达式 → 该函数返回类型会被推为 `unknown | string`；查看调用方参数类型是否期待纯 `string`。命中 → 报告为"函数签名漏标注返回类型"，不擅自修。
     ```bash
     grep -nE 'Record<string,\s*(unknown|any)>|\{\s*\[k:\s*string\]:\s*(unknown|any)\s*\}' src/ -r --include="*.ts" --include="*.vue"
     ```
     ```bash
     # 另一面：函数体中 `|| "..."` 兑底（怀疑 LHS 是 unknown）
     grep -nE '=>.*\|\|\s*"' src/ -r --include="*.ts" --include="*.vue"
     ```
   - **mock / test 数据 vs 接口契约不一致**（防 TS2322：mock 函数返回的对象字面量缺必填字段，或字段类型不一致）：触发场景——编辑 `*.mock.ts` / `*Mock*.ts` / `mock.ts` / `*.test.ts` / `*.spec.ts` 等包含静态示例数据的文件。grep 同文件内 `export interface` 定义的所有必填字段（无 `?` 后缀）与所有 `.map((...) => ({...}))` / 对象字面量逐字段对照。必填字段缺失 → 报告为"mock 字段缺失"，不擅自修（判断是接口过严还是 mock 漏字段，需看调用方兑底逻辑）。
     ```bash
     # 找出 mock 文件内的 interface 定义
     grep -nE 'export\s+interface\s+\w+\s*\{' src/ -r --include="*.mock.ts" --include="*.test.ts" --include="*.spec.ts" --include="*Mock*.ts"
     # 找出 mock 文件内的对象字面量返回位置
     grep -nE 'stores:\s*stores\.map|=>\s*\(\s*\{' src/ -r --include="*.mock.ts" --include="*.test.ts" --include="*.spec.ts" --include="*Mock*.ts"
     ```
     参考 `references/error-signatures.md` 中的 "TS2322 形态：mock 对象字面量字段缺失"。
   - 命中 → Read 相关 `type.ts` / `*.d.ts` 对比字段名/类型
   - 不一致 → 报告"预存问题"，**不擅自修**
   - 用户要求全面验证 → 跑 `npx vue-tsc --noEmit | grep <pattern>` 全项目扫描（必须标注范围）
   - **spread 后跨对象类型不兼容（防 TS2345：形参是 union literal，spread 传入 string）**：调用方使用 `return { ...item, ... }` 或 `...shops.value.map(...)` 后传给函数，函数形参的 interface 字段是 `field: "a" | "b" | ...`（< 10 元素的 string union literal），而 spread 源对应字段是 `string`。ESLint 抓不到（type-aware 错误），vue-tsc 默认不跑。
     ```bash
     # 步骤 1：找 union literal 字段定义（内联 string union + 数组形态）
     grep -nE '\?\s*:\s*"[a-z_]+"(\s*\|\s*"[a-z_]+"){1,9}' src/ -r --include="*.ts" --include="*.vue"
     grep -nE '\?\s*:\s*\w+\[\]' src/ -r --include="*.ts" --include="*.vue"
     # 步骤 2：找 union literal 类型别名（import 形式）
     grep -nE '^export type \w+ = "[a-z_]+"(\s*\|\s*"[a-z_]+"){1,9}\s*$' src/ -r --include="*.ts"
     # 步骤 3：找 spread 源（调用方）
     grep -nE 'return \{\s*\.\.\.' src/ -r --include="*.ts" --include="*.vue"
     # 步骤 4：找 .map 后立即调函数 / 或赋值给 Payload 后调
     grep -nE 'const \w+Payload\s*=\s*.+\.map\(' src/ -r --include="*.ts" --include="*.vue"
     ```
     交叉看步骤 1/2 的"含 union literal 字段"和步骤 3/4 的 spread 源，**名字相同的字段** → 报告"spread 源字段是 string，但目标接口字段是 union literal"。修复方向（需业务判断，不擅自修）：
     - (A) 接口字段放宽到 `string`（当实际数据本来就是任意 string，如平台字典 code）
     - (B) 加 type guard（`as Union`）转换
     - (C) 改 spread 源字段类型为 union literal（不推荐，业务实际是 string）
     参考 `references/error-signatures.md` 中的 "TS2345 形态：spread 后字段类型不兼容"。

   - **对象字段直接透传形参（防 TS2345：形参 union literal，字段值是变量引用，不是 spread）**：与上一项同根因但形态不同——对象字面量里字段值是**外部变量**（无 spread、无 spread 源），例如 `buildOnboardingSavePayload(form, meta)` 内部 `return { platformList, priority, ... }` 里的 `platformList,` 是从 `form.platformList` 透传。如果 `form.platformList: string[]` 但目标形参 DTO 字段是 `AuditPlatform[]`，**不报 spread 形态的 step 3 也漏掉**。
     ```bash
     # 步骤 A：找 union literal 字段名（从 type.ts / *.d.ts）
     # 已在 step 1/2 命中，提取字段名（如 platformList / entryPlatform / priority 等）

     # 步骤 B：找对象字面量里的简写字段（key, 形式：key 后跟逗号或换行，key 前是空白）
     # 命中上下文通常是 return { ... } 或 const obj = { ... } 里
     # 简写 = ES6 语法 { key } 等价于 { key: key }，type 取自外部变量
     grep -nE '^\s{2,}\w+,?\s*$' src/ -r --include="*.ts" --include="*.vue"

     # 步骤 C：更精准：限定在 return { / const \w+ = { 后 8 行内的简写
     # 用 perl 多行模式
     perl -0777 -ne 'while (/(?:return|const\s+\w+\s*=\s*)\s*\{([^{}]+)\}/g) { my $b = $1; while ($b =~ /^\s*(\w+)\s*,?\s*$/mg) { print "$ARGV:$. field=$1\n" } }' src/ -r --include="*.ts" --include="*.vue"
     ```
     步骤 B/C 命中后，**字段名**与步骤 A 的 union literal 字段名交叉，**同名** → 报告"对象字面量字段透传，形参 DTO 期望 union literal，实参是 string"。修复方向同 spread 形态：(A) DTO 字段放宽 / (B) 加 type guard / (C) 不推荐改源。参考 `references/error-signatures.md` 中的 "TS2345 形态 B：对象字段透传形参"。

     **为什么这一项要单独列**：spread 形态的 step 3/4 只抓 `return { ...item, ... }` 或 `*Payload = items.map(...)`；对象字段直接透传（如 `platformList,` 引用外部变量）既无 spread 也不走 Payload 命名模式，会漏。**实际高频**：buildDTO / toDTO / saveDto(form) 类工具函数。

   - **Set<T> 与 Array 方法误用（防 TS2339：props 声明为 Set<T> 但内部用 .length / .some / .find / .filter）**：Set 本身**没有** `.length` / `.some` / `.find` / `.filter` / `.map` / `.indexOf` / `.includes` / `.forEach` / `.every` / `.reduce` —— 这些都是 Array 方法（Set 有 `.has` / `.size` / `.add` / `.delete` / `.forEach(callback)`，但**无 .length / .some**）。如 props 误声明为 `Set<T>` 而调用方与内部都用 Array 方法，报 `TS2339: Property X does not exist on type Set<T>`。cashier 实际高频：
     - props 声明 `Set<T>` 但调用方传 `new Set(...)`（fill.vue 风格）
     - 内部用 `Array.from(props.xxx ?? [])` 或 `props.xxx ?? []` 后调 `.length` / `.some` / `.find`
     - 调用方强转 `(arr as unknown as Set<T>)` 掩盖类型不兼容（**伪装豁免、不是修法**）
     ```bash
     # 步骤 1：找所有 Set<T> 类型的 props / 变量声明
     perl -ne 'while (/\b(\w+)\s*\??\s*:\s*Set<\w+>/g) { print "$ARGV:$.:$1\n" }' $(find src -name "*.ts" -o -name "*.vue")

     # 步骤 2：对步骤 1 的每个变量名，在同文件内查 Array 方法调用
     for f in $(find src -name "*.ts" -o -name "*.vue"); do
       for v in $(perl -ne 'while (/\b(\w+)\s*\??\s*:\s*Set<\w+>/g) { print "$1\n" }' "$f" | sort -u); do
         # 查 Array 方法调用（排除 .forEach 因为 Set/Array 都有，但保留作提示）
         hits=$(grep -nE "\b$v\.(length|some|find|filter|map|indexOf|includes|every|reduce|sort|slice|concat|forEach)\b" "$f" 2>&1)
         # 查该变量在文件内是否有 Array.from(...) 包裹（兼容写法）
         from_wrap=$(grep -cE "Array\.from\([^)]*$v|Array\.from\([^)]*props\.$v" "$f" 2>&1)
         if [ -n "$hits" ] && [ "$from_wrap" = "0" ]; then
           echo "$f: $v (Set<T>) 用了 Array 方法但没 Array.from 包裹"
           echo "$hits" | head -3
         fi
       done
     done
     ```
     命中后 Read 上下文判断。修复方向（ponytail rung 1 最小改）：

     | 方向 | 适用场景 | 改动范围 |
     |---|---|---|
     | (A) props 类型 union + `Array.from()` 包裹 | 调用方有传 Set 和传 Array 两种 | 改 props 类型 + 加 `Array.from(props.xxx ?? [])` |
     | (B) props 类型统一为 `readonly T[]` | 调用方都改成 Array | 改 props 类型 + 所有调用方去掉 `new Set(...)` 或 cast |
     | (C) 内部改用 Set 方法 | 调用方都传 Set，内部用 `.has` / `.size` | 改 props 类型保留 Set + 内部用 Set 方法 |

     **警惕 `as unknown as Set<T>` 强转**：调用方 `(arr as unknown as Set<T>)` 传 props 是"伪装豁免"，**不修底层类型契约**。grep 抓 `as unknown as Set<` 命中 → 报告"调用方强转掩盖类型不兼容，应从 props 类型侧根因修"。

     参考 `references/error-signatures.md` 中的 "TS2339 形态：Set<T> 与 Array 方法误用"。

   - **未 import 类型引用（防 TS2304：文件内类型注解缺 import）**：文件使用了某个 PascalCase 类型作 `:` 注解或 `<...>` 泛型，但未在 import 列表中引入该类型，报 `TS2304: Cannot find name Xxx`。ESLint 默认不抓（type-aware 错误），vue-tsc 不跑。cashier 高频场景：Element Plus / Vue / 业务 type.ts 类型调包。

     ```bash
     # 步骤 1：提取文件内 import 的所有标识符（import / import type / 命名 / 默认）
     f=src/.../Foo.vue
     imports=$(perl -ne 'while (/import\s+(?:type\s+)?\{([^}]+)\}|import\s+(?:type\s+)?(\w+)/g) { my $b = $1 || $2; for my $id (split /\s*,\s*/, $b) { $id =~ s/^\s+|\s+$//g; $id =~ s/^type\s+//; print "$id\n" if $id =~ /^\w+$/ } }' "$f" | sort -u)

     # 步骤 2：提取文件内"作为类型注解"的大写标识符
     # 模式：: PascalCase / <PascalCase / as PascalCase（type position）
     types=$(perl -ne 'while (/\b:\s*([A-Z]\w*)\b|\b<([A-Z]\w*)\b|\bas\s+([A-Z]\w*)\b/g) { print "$1$2$3\n" }' "$f" | sort -u)

     # 步骤 3：提取本地声明的类型（type X / interface X）并从 types 中减掉
     locals=$(grep -hoE '^(export\s+)?(type|interface)\s+([A-Z]\w*)' "$f" | sed -E 's/.*\b([A-Z]\w*)$/\1/' | sort -u)
     # 减去 locals + 减去 JS/TS 内置类型（手动维护白名单）
     whitelist="Promise Error Record Partial Required Readonly Pick Omit Exclude Extract ReturnType Parameters InstanceType NonNullable Uppercase Lowercase Capitalize Uncapitalize Awaited ThisType ThisParameterType OmitThisParameter Array Map Set Date RegExp Symbol Object Function String Number Boolean IterableIterator ArrayLike ReadonlyArray ReadonlyMap ReadonlySet Partial"
     suspects=$(comm -23 <(echo "$types") <(echo -e "$imports\n$locals\n$whitelist" | sort -u))

     # 步骤 4：判断
     if [ -n "$suspects" ]; then
       echo "❌ $f: 下面类型可能被引用但未 import："
       echo "$suspects"
     fi
     ```

     **误报处理**（扫描率高，需 Read 上下文确认）：
     - **业务 type alias**（`type Tables = ...` / `type Users = ...`）：本扫描的 `locals` 只识别 `interface` / 顶层 `type`，**不识别嵌套 / 函数内 type alias**。`grep -hoE 'type\s+([A-Z]\w*)\s*=' "$f"` 补充提取
     - **泛型参数**（`<T>` / `<K, V>`）：`T` / `K` / `V` 等单字母会误报，**加入 whitelist**
     - **注释 / 字符串字面量**里的 PascalCase（`// AccountChangeDetailsBatchDeleteDTO`）：perl `\b:\s*` 不会区分代码 vs 注释里的 `：`。**实际报 TS2304 一定在代码上下文**，注释里命中是误报需 Read 排除
     - **常量全大写**（`BANK_CARD_ACCOUNT_NAME_MAX`）：perl `[A-Z]\w*` 仍匹配。**手动排除**：扫描后 grep `[A-Z][A-Z0-9_]+$` 过滤
     - **全局类型**（`HTMLElement` / `MouseEvent` / `window.X`）：加入 whitelist
     - **模板里的组件名**（`<el-form>` / `<MyComp>`）：本扫描不扫 `<template>` 块（grep -E 不在 `<template>` 内运行），不命中。如误报 Read 上下文确认

     命中后 Read 上下文确认是真"未 import"（报 TS2304）还是上述误报场景。**修法（ponytail rung 1）**：在 import 块加 `import type { Xxx } from "..."`；如已在 import 块内，只加标识符名（同一来源）。参考 `references/error-signatures.md` 中的 "TS2304 形态：类型未 import"。

     **为什么这一项要单独列**：skill 之前的 9 个扫描项 + 4 个形态（TS2345 spread / 透传 / TS2339 Set / 重复定义）都不抓"未 import 类型"——ESLint 默认 type-aware 规则缺失，cashier 项目 eslint.config.js 也没启用 `@typescript-eslint/no-unbound-method` / `@typescript-eslint/no-unsafe-*` 等会间接发现该问题的规则。

     **Cashier 项目验证**：实际跑全仓扫描命中率受业务 type alias / 泛型参数 / 注释字面量影响，**false positive ~60%**（现金业务类型 50+ / 泛型参数 5+ / 注释 10+）。agent 需 Read 上下文筛掉，**不要把"误报"也当 TS2304 上报**。

   - **`as Record<string, X>` 错 X 类型（防 TS2322：cast 后值类型与下游期望不兼容）**：cast `as Record<string, X>` 让任意 string 索引合法，但**值类型被设为 X**。如 X 是 `unknown` / `any`，下游期望具体类型（如 `FormItemRule | FormItemRule[]`）时必报 `TS2322: Type unknown is not assignable to type FormItemRule | FormItemRule[]`。常见于 props `:rules` / `:model` 动态 key 访问。

     ```bash
     # 步骤 1：grep 所有 `as Record<string, X>` / `as Record<string, X[]>` 形式
     grep -nE "as\s+Record<string,\s*\w+(\[\])?>" src/ -r --include="*.ts" --include="*.vue"

     # 步骤 2：提取 X 分类统计
     grep -hoE "as\s+Record<string,\s*\w+(\[\])?>" src/ -r --include="*.ts" --include="*.vue" | \
       sed -E 's/as\s+Record<string,\s*(\w+(\[\])?)>/\1/' | sort | uniq -c | sort -rn

     # 步骤 3：标记 `X = unknown | any` 为可疑
     # Read 同文件上下文，查看下游 props / 函数返回 / 形参 期望的"具体类型"
     ```

     **判断哪些是错修**：
     - `as Record<string, unknown>` / `as Record<string, any>` / `as Record<string, unknown[]>` 几乎都是 **错修** —— `unknown` / `any` 下游接不住具体类型。**真正应 cast 的 X** = 下游 props / 函数期望的类型（如 `FormItemRule[]` / `string` / `number` / `T`）
     - `as Record<string, string>` 在 `Object.fromEntries(...)` 后转 dict 是合法用法（cashier 9 处都这样）
     - `as Record<string, FormItemRule[]>` / `as Record<string, UserType>` 保留具体类型 = 正确修法

     **本次 case 错修 / 正修对照**：
     ```ts
     // 错修（line 338 / 360 原版）：unknown 下游期望 FormItemRule 报 TS2322
     :rules="(rules as Record<string, unknown>)[field.fieldCode]"

     // 正修：保留值类型 = FormItemRule[]，下游 form-item 接得上
     :rules="(rules as Record<string, FormItemRule[]>)[field.fieldCode]"
     ```

     **Cashier 项目验证**：全仓 22 处 `as Record<string, X>` 命中，其中 10 处 `unknown` + 1 处 `any` = **11 处可疑**。agent 需 Read 每个上下文判断下游期望类型。

     **修法（ponytail rung 1）**：
     1. 看下游 props / 函数 / 形参期望的类型（看 element-plus / type.ts 定义）
     2. 把 `X` 改成下游期望的具体类型
     3. 如 X 是 union（`FormItemRule | FormItemRule[]`），写 `X | X[]`
     4. 需 import 该类型时加 `import type { X } from "..."`

     参考 `references/error-signatures.md` 中的 "TS2322 形态：`as Record<string, X>` 错 X 类型"。

     **为什么这一项要单独列**：skill 之前的 5 个升级（TS2345 spread / 透传 / TS2339 Set / TS2339 fieldCode / TS2304 未 import）都查“类型对不对 / 在不在 import”，**不查“cast 后值类型下游接不接得住”**。cashier 项目 11 处 `unknown` / `any` cast 里有 7+ 处下游会报 TS2322，是高频率的隐错。

   - **`as const` 元素 union 传给函数形参字段不对齐（防 TS2345 / TS2339：`as const` 数组元素 = 精确 literal union，函数形参字段必须 “宽化”）**：`as const` 让数组 / 对象元素变成**精确 literal union**（每个元素只有自己有的字段）。调用方 `formatValue(raw, f)` 传 `f: typeof SUB_ACCOUNT_FIELDS[number]` 给函数形参时常见两类错：
     - **TS2345 形参字段不足**：`function formatValue(f: { mask?: boolean, yesno?: boolean })` 但调用方元素 union 第一项是 `{ key: "account", label: "取数宝账号" }` **根本没 mask/yesno** —— 报 "has no properties in common with type"
     - **TS2339 形参是精确 literal union**：`function formatValue(f: typeof X[number])` 形参也变成精确 union，内部访问 `f.mask` 在 union 第一项（没 mask）报 TS2339
     - **正确形参**：与 union 每个元素**共有字段**全列 + 全 optional + 类型放宽到 supertype：`function formatValue(f: { key: string, label: string, mask?: boolean, yesno?: boolean })` —— `key: "account"` (literal) 可赋给 `key: string` (supertype)

     ```bash
     # 步骤 1：找所有 as const 数组 / 对象
     grep -nE '\]\s*as\s+const|\}\s*as\s+const' src/ -r --include="*.ts" --include="*.vue"

     # 步骤 2：对每个 as const 所在文件，找函数形参是对象字面量类型 + 同文件有 as const 引用
     # 形参模式：function xxx(f: { ... }) 或 f: typeof X[number] / typeof X[number]["key"]
     grep -nE 'function\s+\w+\([^)]*:\s*\{[^}]+\}|function\s+\w+\([^)]*:\s*typeof\s+\w+\[number\]' src/ -r --include="*.ts" --include="*.vue"

     # 步骤 3：看函数体访问的字段 vs 形参声明字段
     # 形参是 typeof X[number] 形式 + 内部访问 X 元素中“部分才有”的字段 → TS2339
     # 形参是 { ... } 对象 + 字段少于调用方 X 元素中“每个都有”的字段 → TS2345
     ```

     **判断哪些是错修**：
     - 形参 `f: typeof X[number]`（精确 literal union） + 内部访问 `f.fieldName` 其中 `fieldName` 不是 union 每个成员都有 → **TS2339**
     - 形参 `f: { fieldA?, fieldB? }` 字段**少于**调用方 X 元素 union **每个成员都有的字段**（如 `key` / `label`） → **TS2345**（如本次 `formatValue(f: { mask?, yesno? })` 缺 `key/label`）
     - **正确**：形参 `f: { 共有字段: supertype, 共有字段: supertype, 可选字段?: supertype, ... }`  —— union literal 可赋给 supertype 形参

     **Cashier 验证**：`as const` 数组 cashier 7 处（`BOOLEAN_LIST` / `BUSINESS_SOURCE_OPTIONS` / `OPERATION_TYPE_OPTIONS` / `CASHIER_BELONGS_DEPARTMENT` / `SUB_ACCOUNT_FIELDS` / company tag / 详情描述等）。`SUB_ACCOUNT_FIELDS` 元素 union 是 10 个 literal 对象，传给 `formatValue` 形参时需“共有字段 + supertype”表述。

     **修法（ponytail rung 1）**：
     1. 提取 `as const` 数组 / 对象的元素 union
     2. 列出 union **每个成员都有的字段**（必传）与**部分有的字段**（可选）
     3. 形参 = `{ 必传字段: supertype, ..., 可选字段?: supertype }` —— 避免“字面量多反少漏”的双向错
     4. 避免 `f: typeof X[number]`（精确 literal union）除非函数只读不写某个字段

     参考 `references/error-signatures.md` 中的 "TS2345 / TS2339 形态：`as const` 元素 union 传给函数形参字段不对齐"。

     **为什么这一项要单独列**：skill 之前的 6 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 未 import / TS2322 错 X）都查“spread / 简写 / Set / cast / import”，**不查"`as const` 元素 union 与函数形参字段对齐"**。cashier 项目 7 处 `as const` 数组中常传给 `getLabel` / `format` / `toXxx` 助手函数，错修高频。

   - **后端契约跟前端类型对齐 3 子形态**（防 TS7053 / TS2322：跨仓类型漂移）：
     改后端 Java（PO / VO / Map 序列化 JSON）时，前端 type / 函数形参 / 返回类型没同步对齐，一次性报多个 TS 错误。三子形态：
     - **G-1 TS7053**：后端 JSON key（"original"/"new"）跟前端函数形参（"orig"/"new"）不一致。grep `snap[side]?.[snapKey]` + snap interface 字段名 vs 形参 string union diff。
     - **G-2 TS2322**：前端 type 字段名（`*Masked`）跟后端 VO 字段名（`*Cipher`）拼错。grep 前端 type vs 后端 VO 字段名 diff（**source of truth = 后端 VO**）。
     - **G-3 TS2322**：`row[keyof X]` 推成 `string | number | boolean | undefined`，函数返回类型 `string | null | undefined` 接不住。修法：返回类型放宽到 `unknown` + formatValue 内部 `String()` 转换。

     ```bash
     # G-1：找 snap[key] 索引访问 + snap interface key 跟形参 string union diff
     grep -nE '\bsnap\[[a-z]+\]\?\.?\[[a-zA-Z]+\]' src/ -r --include="*.ts" --include="*.vue"
     # 看形参定义：grep "side: \"orig\"|side: \"original\"" + snap interface key

     # G-2：跨仓字段名 diff（后端是 source of truth）
     grep -E "private String" /D/OB/bi-FOB/bi-cashier/bi-cashier-api/src/main/java/com/obo/bi/cashier/vo/*.java | grep -oE "\b(original|new)\w+"
     grep -E "\b(original|new)\w+\?:" /D/OB/ob_web/packages/micro/cashier/src/api/*.ts

     # G-3：找 row[keyof X] / obj[keyof X] 索引访问
     grep -nE '\b\w+\[(keyof\s+\w+|vo\[[^\]]+\])\]' src/ -r --include="*.ts" --include="*.vue"
     # 命中 + 函数返回类型是 string | null | undefined → 报告 "row[vo.x] 推成 string|number|boolean|undefined，函数签名需放宽到 unknown"
     ```

     **判断"哪些是错修"**：
     - G-1 错修：改 JSON key 适配函数形参——**错**（影响后端 + 序列化）
     - G-1 正修：函数内做 `side === "orig" ? "original" : "new"` 映射
     - G-2 错修：改后端 VO 字段名适配前端——**错**（影响后端 + 跨端契约）
     - G-2 正修：改前端 type 跟后端 VO 对齐
     - G-3 错修：`as string` 强转（row[vo.orig] 实际可能是 undefined，掩盖问题）
     - G-3 正修：返回类型放宽到 `unknown`（让 formatValue 内部 `String()` 转换）

     参考 `references/error-signatures.md` 中的 "TS7053 / TS2322 形态 G：后端契约跟前端类型对齐"。

     **为什么这一项要单独列**：skill 之前的 7 个升级都查“TS 类型层”的 mismatch（spread / Set / cast / import / element union / mock 字段 / 重复定义），**不查“跨仓契约”**（后端 Java VO 字段名 vs 前端 type 字段名 vs 后端 JSON key vs 前端函数形参）。cashier 项目改造「表结构 + VO + 前端 type」是高频场景，**改后端必做“前后端字段名 diff”**。

   - **未定义 identifier 主动扫描（防 TS2304：小写 identifier 被 .访问但文件内未声明）**：ESLint 默认不抓 type-aware 错误（`TS2304: Cannot find name 'xxx'`），vue-tsc 不跑。业务代码常用 await/Promise 后取属性，**改完上面没改下面**是高频 typo 错。典型形态：
     - `const ok = await saveApi(payload)` 之后用 `ok.data`（**saveApi 已经 `requestData` 解 envelope，返裸 boolean / string，不是 ApiEnvelope**）
     - 复制粘贴时改**上面**变量名（`res` → `ok`）漏改**下面**成员访问（`if (res.data === "string")` 仍留 `res.data`）
     - 异步函数返回值取属性用错变量名（`result.foo` 但实际声明是 `data`）
     ```bash
     # per-file 扫：声明 vs 访问的差集
     f=src/.../Foo.vue
     # 步骤 1: 提取文件内“被声明”的小写 identifier（let/const/var/function/形参/import 命名导入）
     declared=$(perl -ne '
       # let/const/var 声明
       while (/\b(?:let|const|var)\s+([a-z]\w*)\b/g) { print "$1\n" }
       # function 声明
       while (/function\s+([a-z]\w*)/g) { print "$1\n" }
       # 形参：function name(a, b) / (a, b) =>
       while (/\(([^)]*)\)\s*(?:=>|\{)/g) { my $p = $1; for my $id (split /\s*,\s*/, $p) { $id =~ s/[:?\s].*//; print "$id\n" if $id =~ /^[a-z]\w*$/ } }
       # import 命名导入（限定小写：函数 / composable）
       while (/import\s+(?:type\s+)?\{([^}]+)\}/g) { my $b = $1; for my $id (split /\s*,\s*/, $b) { $id =~ s/^\s+|\s+$//g; $id =~ s/^type\s+//; $id =~ s/\s+as\s+\w+//; print "$id\n" if $id =~ /^[a-z]\w*$/ } }
     ' "$f" | sort -u)

     # 步骤 2: 提取“被 .访问 或 if/while 条件”的小写 identifier
     accessed=$(perl -ne '
       # xxx.yyy / xxx?.yyy / xxx!.yyy
       while (/([a-z]\w*)\s*[\.\?\!]\s*[a-zA-Z_]/g) { print "$1\n" }
       # if (xxx) / if (!xxx) / while (xxx)
       while (/\b(?:if|while)\s*\(\s*!?\s*([a-z]\w*)/g) { print "$1\n" }
     ' "$f" | sort -u)

     # 步骤 3: 差集 = accessed - declared = 引用了但文件内没声明
     suspects=$(comm -23 <(echo "$accessed") <(echo "$declared"))
     if [ -n "$suspects" ]; then
       echo "❌ $f 引用了以下 identifier 但文件内未声明："
       echo "$suspects"
     fi
     ```

     **误报处理**（扫描率高，需 Read 上下文确认，**false positive ~40%**）：
     - **JS 全局**：`window` / `document` / `console` / `Math` / `JSON` / `Date` —— 实际首字母**大写**不命中（小写 pattern 不抓大写）
     - **Vue / 组合式 API**：`computed` / `ref` / `reactive` / `watch` / `onMounted` —— 必 import，declared 包含
     - **destructured 解构**（`const { data, status } = await loadApi()` 后用 `data`）—— `data` 是解构非 let/const 声明，perl 提取不到。**手工补查**
     - **形参解构**（`function foo({ a, b }: { a: string, b: string })`）—— perl 提取的是 `foo`，不是 `a` / `b`。**手工补查**
     - **async 函数 callback 闭包变量**（`fetchData().then(res => { result = res })` 中 `result`）—— 需外层声明，perl 提取依赖 let/const 所在 scope。**手工补查**
     - **事件对象**（`function handleAdd(e: MouseEvent)`）—— 形参 `e` 会被 perl 误报为未声明。**手工排除**
     - **Vue 模板 ref**（`const formRef = ref<FormInstance>()` 后 `<DynamicForm ref="formRef">`）—— 模板是 string attribute，perl 不扫模板，**不命中**
     - **library 全局挂载**（`axios` / `$` / `jQuery` / `dayjs`）—— 罕见，需手动维护白名单

     **Cashier 项目验证**（2026-10-14 实际命中）：
     - `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:590` `if (typeof res.data === "string")` —— 上 579 行声明 `const ok = ...`，`res` 引用但**未声明**。改用 `ok` 即可。

     **命中后修法**（ponytail rung 1）：
     1. 找上下文（行 5-10 内）有没有同名同语义的变量声明，**很可能是上面 await/Promise 改了名**
     2. 把错引用 `xxx.yyy` → 正确变量名（user 报的 case 是 `res` → `ok`）
     3. 修法只动引用点，**不动声明点**（声明点是源头）
     4. 不擅自删除（虽然是 typo 但可能是函数返回值 / 参数 / 全局挂载）

     **为什么这一项要单独列**：skill 之前的 8 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 PascalCase 未 import / TS2322 错 X / element union / mock 字段 / 重复定义 / 后端契约）都查“类型 / 字段 / 路径”是否对齐，**不查“identifier 本身在文件内是否声明过”**。cashier 项目高频场景：编辑时改上面 await/Promise 变量名（`res` → `ok`），忘改下面 `.data` 引用 —— 这种**“用错变量名”**的纯 typo 错误所有升级都不抓。参考 `references/error-signatures.md` 中的 "TS2304 形态：小写 identifier 引用但未声明（典型 `res.data` 但 `res` 未声明）"。


7. **格式嫌疑主动扫描**（即使 ESLint 0 报错也要做）：
   - **JSDoc 起始行同行接文字**（防 jsdoc/multiline-blocks）：grep 文件内所有 `/**` 行，若 `/**` 后紧跟非空字符（非换行、非空格引导的 ` *`），则该注释违规。修复：把首行 `/**` 单独成行，文字挪到下一行 ` * <text>`，未行用 ` */`。参考 `references/error-signatures.md` 中的 "jsdoc/multiline-blocks 形态"。
     ```bash
     grep -nE "^\s*/\*\* [^/\*\s]" src/ -r --include="*.ts" --include="*.vue" --include="*.js"
     ```
   - 命中 → Read 上下文确认是否为多行注释（不是首行就是单行注释）
   - 违规 → 手动调整 `/**` 起头位置，不加 `eslint-disable`
   - 不主动添加 `eslint-disable-next-line jsdoc/multiline-blocks` 绕过
8. **未使用代码主动扫描**（即使 ESLint 默认 0 报错也要做）：
   - **背景**：cashier 项目的 eslint.config.js 默认禁用了 `no-unused-vars`（避免误报 props/emits 等子类型），导致代码中的孤儿 import / 死代码变量 / 孤儿 API 函数 默认不会被 ESLint 报警。
   - **主动开启 no-unused-vars 扫一遍**（不写入项目配置，只在 CLI 加 `--rule`）：
     ```bash
     npx eslint <lint-files...> --rule '{"unused-imports/no-unused-imports":"error","no-unused-imports":"error","unused-imports/no-unused-vars":"error","no-unused-vars":"error","vue/no-unused-components":"error","vue/no-unused-vars":"error"}'
     ```
     命中 → 逐项 Read 上下文判断是"真死代码"还是"动态/反射场景假装豁免"。
   - **判断 "真死代码 vs 假装豁免"**：
     - 真死代码：删除 var/const/function/import 行，运行逻辑不变
     - 假装豁免（下划线前缀）：`const _xxx = ...`、`function _yyy() {...}`——这是错误的逃生口，下划线前缀让 ESLint 不报警但死代码仍存在，**必须直接删**。例外：`_<slot-name>` / `_event` 之类是 Vue 模板 slot 占位符或事件保留名，**保留**。
     - 动态场景：JSX/模板反射用法、props 解构、`v-for` 中 `:key`、模板字符串拼装的标识符——Read 上下文确认后再决定。
   - **下划线前辍死代码主动扫描**（grep 不依赖 ESLint 配置）：
     ```bash
     # 找出声明的下划线前辍变量/函数/常量（疑似死代码逃生口）
     grep -nE '(const|let|function|class)\s+_\w+\s*[=(:]' src/ -r --include="*.ts" --include="*.vue"
     ```
     命中 → 逐项 Read 上下文确认：
     - 如果被引用（如 `_handleAddRowToQueue(companyId)`）→ 合法命名，保留
     - 如果仅声明无引用 → **真死代码，删掉**
     - 不要"为了安全再加下划线"
   - **孤儿 API 函数扫描**（声明了 `export function` 但全局无调用方）：
     ```bash
     # 找出 apis 目录的所有 export 函数
     grep -nE '^export\s+(async\s+)?function\s+\w+' src/ -r --include="*.ts" --include="*.vue"
     ```
     对每个函数名 grep 跨文件调用方（排除声明处本身）：
     ```bash
     grep -rn "\b<函数名>\b" src/ --include="*.ts" --include="*.vue" | grep -v "^<声明文件>:<行号>:"
     ```
     - 唯一调用方 = 自己（声明 + 自己 import）→ 孤儿函数，删
     - 多处调用 → 保留
   - **行为验证**：删除后跑 5 个 E2E 脚本（如业务域内）或 `npx vue-tsc --noEmit`（如跨域），确认行为不变
   - **不修改 eslint.config.js**：检测只在 CLI 加 `--rule`，不写入项目配置（用户可能故意关掉 disable，避免写代码风格无法控制）
9. **Tailwind 任意值飘红主动扫描**（IDE Tailwind IntelliSense 提示，**ESLint 抓不到，需 grep**）：
   - **背景**：项目用 Tailwind CSS 4.x（cashier 项目为 4.1.18），IDE Tailwind IntelliSense 会提示 `The class 'min-h-[48px]' can be written as 'min-h-12'`——这些是 spacing / sizing / text-size 任意值的"等价短写"提示。颜色任意值飘红（`bg-[#xxx]`）是另一问题（需抽 `<style scoped>` 或加 Tailwind 主题，本 skill 不覆盖）。
   - **默认比例映射表**：
     - spacing / sizing：`gap / p / px / py / pt / pb / pl / pr / m / mx / my / mt / mb / ml / mr / space / inset / w / h / min-* / max-*` 数值任意值（如 `gap-[8px]` → `gap-2`）
     - text size：`text-[12px]` → `text-xs`、`text-[14px]` → `text-sm`、`text-[16px]` → `text-base`
     - rounded：`rounded-[2px]` → `rounded-sm`、`rounded-[8px]` → `rounded-lg`、`rounded-[10px]` → `rounded-xl`
   - **不可转换**：`text-[13px]` / `text-[15px]`（不在默认字号比例）、`rounded-[20px]`（不是 full 语义）、颜色 / 阴影 / 渐变任意值
   - **主动扫描方法**：
     ```bash
     grep -hoE '\b(min-h|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|rounded|w|h|space-x|space-y|top|bottom|left|right|text)-\[\s*([0-9.]+)(px|rem)?\s*\]' src/ -r --include="*.vue" | sort -u
     ```
   - **Ponytail rung 选择**：
     1. rung 1：仅换短写不改逻辑，业务 0 改动
     2. rung 6：写一次性 Python 脚本批量替换（见 `references/error-signatures.md`）
   - **修复**：批量 Python 脚本见 `references/error-signatures.md` 中 "Tailwind 任意值需等价短写" 形态

## TypeScript / Vue Type Checking

**核心限制**：skill 默认只跑 `npx eslint --format stylish`，**不跑 `vue-tsc --noEmit`**。原因：
1. `vue-tsc --noEmit` 依赖完整 tsconfig + 跨文件类型图，不能限制到单个文件
2. 全项目跑 = 全项目扫描 → 违反 "changed hunks only" 范围约束
3. cashier 这类 monorepo 跑一次 30-60s+ → 不能在每次小改动时跑

**为什么这意味着 ESLint 抓不到以下错误**：
| 错误码 | 含义 | ESLint 默认能抓吗 |
|---|---|---|
| TS2551 | 字段不在类型上 | ❌ 需 type-aware 规则 |
| TS2339 | 成员访问失败 | ❌ 同上 |
| TS2345 | 类型赋值不兼容 | ❌ 同上 |
| TS2305 | 跨文件导入成员不存在 | ❌ 同上 |
| TS2554 | 函数签名不兼容（参数过多/过少） | ⚠️ 部分可抓（参数个数），但根因（share 包路径）抓不到 |
| jsdoc/multiline-blocks | JSDoc 起始行同行接文字 | ✅ eslint-plugin-jsdoc 默认能抓（不需 type-aware） |
| no-unused-vars | 未使用变量 / import / function | ⚠️ 项目常禁用（避免误报 props/emits）——需 CLI 加 `--rule` 主动扫 |

没有 IDE/MCP 时，不用不准确的单文件 TypeScript 命令冒充类型检查。如果项目已配置 type-aware ESLint 规则（如 `@typescript-eslint/no-unsafe-member-access`、`parserOptions.project`），这些规则可以继续生效，但不能等同于完整类型检查。

**升级检测能力的 3 种方法**（用户选其一）：
1. **项目级 `pnpm type-check` 脚本** + husky pre-commit 钩子：`vue-tsc --noEmit` 跑全项目。CI 必卡、本地可选。
2. **ESLint type-aware 配置**：在 `eslint.config.js` 加 `@typescript-eslint/no-unsafe-member-access: error` 和 `parserOptions.project: ["./tsconfig.json"]`。lint 时间从 5s 变 30s+，但能在 ESLint 阶段抓类型错。
3. **本次临时跑 vue-tsc**（用户明确要求时）：`npx vue-tsc --noEmit 2>&1 | grep <task-file-pattern>`，必须标注全项目范围；只修任务编辑清单内的问题。

**默认走法**：方法 3。当用户提出"类型错误"或"字段不存在"等嫌疑问题时：
1. 主动 grep `\|\|` 兜底、类型断言、`as any` 等可疑模式
2. Read 相关 `type.ts` / `*.d.ts` 对比实际类型契约
3. 跑 `npx vue-tsc --noEmit | grep`，把过滤后清单交用户决策
4. 按 changed-hunk 范围约束修复，不扩大

只有用户明确要求全量类型验证时才运行项目级类型检查（命令形如 `npx vue-tsc --noEmit`），并必须标注其范围是全项目；仍只修复任务编辑清单内的问题，不处理其他文件。

## Type-aware 缺失场景的兜底

ESLint 单跑 `eslint --format stylish` **不会暴露**：
- 字段访问死代码（如 `file.fileName` 在 `FileUploadRecord` 类型上不存在）
- 类型不匹配（如 `attachments: FileUploadRecord[]` 实际为 `FileUploadRecordList[]`）
- 跨文件导入的导出成员缺失
- **未使用 import**（除非 ESLint 启用 `unused-imports/no-unused-imports` 规则，且 TS 启用 `noUnusedLocals`）
- **同名多源 import**（同一标识符在多个文件被独立定义，从语义上选哪个是架构判断，不在 lint 覆盖范围）
- **ApiEnvelope 与组件 props 类型不兼容**（如 `Promise<ApiEnvelope<string>>` 传给 `ExportButton` 的 `Promise<string>` 期望）—— 这是**特殊形态**：用户经常忘记"业务 API 返 envelope，但 UI 组件期望拆 envelope 后裸值"

发现这类嫌疑时（如成员链含 `||` 兜底、参数类型来自跨文件 interface），必须：

1. **主动 grep 嫌疑模式**：
   - `\|\|` 兜底链（可能遮蔽字段不存在错误）
   - `as any` / `as unknown as` 类型断言
   - `@ts-ignore` / `@ts-expect-error` 注释
   - `// eslint-disable` 注释
   - **import 后未使用**：grep 标识符在文件内（除 import 行）的出现次数 = 0
   - **同名多源 import**：grep 标识符在 `src/` 全局的出现次数 > 1 个定义点
   - **ApiEnvelope 适配嫌疑**：grep `:create-file-api\|:fetch-api\|:request-api\|@create-file` 等 UI 组件 props 绑定模式 + 同文件内 import 的 API 函数，对比函数返 `Promise<.*Envelope.*>` 与 props 期望 `Promise<[非 envelope 裸值]>`。典型 API 函数名匹配 `export.*Api$|exportSubAccount|exportAccount`
   - **跨文件 import 路径错位**（形态 2 TS2305）：grep 标识符在 `src/` 全局（除 type.ts 自己）的 `export` 出现位置，对比 type.ts 写出的 import 路径；不一致则报告"路径错位、成员在另一文件真实存在"
2. 用 `Read` 工具读相关 `type.ts` / `*.d.ts` 找定义
3. 对比字段名、类型、import 来源，确认是否真"字段不在类型上" / "import 实际未使用" / "envelope 未拆"
4. **不擅自修**——按 changed-hunk 范围约束，应记录为"预存问题、不在本任务范围"
5. 若用户要求全面验证，临时跑 `npx vue-tsc --noEmit` 全项目类型检查，按 grep 过滤本次任务文件，把过滤后的报错清单交给用户决策
6. **ApiEnvelope 适配的最小修法**：在 `apis/index.ts` 抽适配函数（如 `exportSubAccountChangeAuditFileApi = (data) => underlying(data ?? {}).then(res => res.data as string)`），保留原 envelope 版本给其它消费 envelope 完整字段的调用方继续使用。**不要改原 API 函数本身**，那会影响多个调用方。

参考签名见 `references/error-signatures.md` 中 `TS2551`（字段不存在）、`TS2339`（成员访问）、`TS2322`（类型不匹配）、`TS2345`（类型不匹配）、`TS2554`（参数个数）。

## Quick Reference

| 操作 | 是否允许 | 范围 |
|---|---|---|
| `npx eslint <lint-files...> --format stylish` | 允许 | 只读解析编辑源码文件；只处理 changed hunks 的诊断 |
| 手工修改 changed hunks | 允许 | 只修改本次编辑代码 |
| `git diff --check -- <task-files...>` | 允许 | 只检查本任务目标文件补丁 |
| `npx eslint src` / `npx eslint .` | 禁止 | 会扫描目录或全项目 |
| `pnpm lint` / `npm run lint` | 禁止 | 可能展开为全仓扫描或自动修复 |
| `npx eslint <file> --fix` | 禁止 | 可能改写目标文件中的未编辑代码 |
| `npx vue-tsc --noEmit` | 默认禁止（仅用户明确要求全量类型验证时可跑，必须标注全项目范围） | 项目级检查，依赖完整 tsconfig |
| `npx vue-tsc --noEmit 2>&1 \| grep <pattern>` | 允许（用户明确要求类型验证时） | 全项目扫描 + grep 过滤，必须在报告中标注"全项目范围" |
| grep `\|\|` / `as any` / `@ts-ignore` 兜底模式 | 允许（类型嫌疑主动扫描步骤） | 只读，不修改代码 |
| grep import 后未使用 / 同名多源 import | 允许（主动扫描步骤） | 只读，不修改代码 |
| grep `:create-file-api` / `:fetch-api` 等 UI 组件 props 绑定模式 | 允许（ApiEnvelope 适配嫌疑扫描步骤） | 只读，不修改代码 |
| grep 标识符在 `src/` 全局 `export` 位置 | 允许（TS2305 路径错位嫌疑扫描步骤） | 只读，不修改代码 |
| grep 函数参数 `Record<string, unknown\|any>` / 索引返回 unknown 类型 | 允许（类型嫌疑主动扫描步骤） | 防函数返回类型推断为 `unknown \| string`，与纯 `string` 调用方报 TS2345 |
| grep mock / test 文件的 interface 必填字段 vs 对象字面量返回字段 | 允许（类型嫌疑主动扫描步骤） | 防 TS2322：mock 对象字面量缺必填字段 |
| 修 import path 之前 grep export 位置 | **强制**（见第 4a 步） | 防 TS2305 形态 2 / 形态 4 / 形态 5 路径错位 |
| `.vue` 文件用 `@/pages/...` 绝对路径 import 业务模块 utils | **强制**（见 references/error-signatures.md "TS2307 形态"） | 避免 vue-tsc 在 `.vue` 文件处理相对路径 import 偶发失败 |
| `npx eslint <files> --rule '{"no-unused-vars":"error",...}'` | 允许（未使用代码主动扫描步骤） | CLI 加 --rule，不改 eslint.config.js；扫死代码 + 孤儿 API |
| grep `(const\|let\|function\|class)\s+_\w+\s*[=(:]` | 允许（未使用代码主动扫描步骤） | 查下划线前缀死代码逃生口 |
| 加下划线前缀 / `eslint-disable-next-line` 保留死代码 | **禁止** | 错误逃生口；死代码应直接删 |

## Error Signatures

需要定位已编辑行中的常见错误时，读取 `references/error-signatures.md`。错误签名只帮助判断根因，不会扩大允许修改的文件或行范围；根因落在范围外时，只报告，不修复。

## Required Constraints

- 不用 `eslint-disable`、`@ts-ignore`、`any` 或修改全局配置来隐藏诊断。
- 不顺手清理同文件其他行、其他脏文件或 `packages/share` 的既有问题。
- 验证结果必须区分”本次 changed hunks 无相关诊断”和”整个文件/项目通过”。未运行全量类型检查时明确标注未验证跨文件类型关系。
- **类型嫌疑表达式**：成员链出现 `||` 兜底、字段名与 `*type.ts` / `*.d.ts` 定义不一致时，不擅自删，按 changed-hunk 约束报告为”预存问题”，由用户决定是否作为独立任务处理。

## Legacy Hook Compatibility

已有安装可能通过 `.claude/hooks/ts-es-check-gate.sh` 读取下面的配置块，因此保留原有字段。它不属于本技能的严格局部工作流，也不授权执行全量命令。本仓库没有该 hook 脚本，无法验证外部 hook 是否遵守 changed-hunk 边界。

<!-- HOOK CONFIG START
HOOK_ESLINT_ARGS="--format stylish"
# ponytail: legacy hook 没有可验证的禁用开关；--version 保留字段兼容性且不扫描项目。
HOOK_TSC_ARGS="--version"
HOOK_MAX_ATTEMPTS=3
HOOK_SRC_REGEX='^src/.*\.(vue|ts|tsx|js|jsx|mjs|cjs)$'
HOOK CONFIG END -->
