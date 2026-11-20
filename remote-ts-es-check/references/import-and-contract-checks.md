# import-and-contract-checks

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

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
     参考 `references/ts-typing.md` 中的 "TS2322 形态：mock 对象字面量字段缺失"。
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
     参考 `references/ts-typing.md` 中的 "TS2345 形态：spread 后字段类型不兼容"。

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
     步骤 B/C 命中后，**字段名**与步骤 A 的 union literal 字段名交叉，**同名** → 报告"对象字面量字段透传，形参 DTO 期望 union literal，实参是 string"。修复方向同 spread 形态：(A) DTO 字段放宽 / (B) 加 type guard / (C) 不推荐改源。参考 `references/ts-typing.md` 中的 "TS2345 形态 B：对象字段透传形参"。

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

     参考 `references/ts-typing.md` 中的 "TS2339 形态：Set<T> 与 Array 方法误用"。

