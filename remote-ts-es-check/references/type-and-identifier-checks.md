# type-and-identifier-checks

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

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

     命中后 Read 上下文确认是真"未 import"（报 TS2304）还是上述误报场景。**修法（ponytail rung 1）**：在 import 块加 `import type { Xxx } from "..."`；如已在 import 块内，只加标识符名（同一来源）。参考 `references/ts-typing.md` 中的 "TS2304 形态：类型未 import"。

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

     参考 `references/ts-typing.md` 中的 "TS2322 形态：`as Record<string, X>` 错 X 类型"。

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

     参考 `references/ts-typing.md` 中的 "TS2345 / TS2339 形态：`as const` 元素 union 传给函数形参字段不对齐"。

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

     参考 `references/ts-typing.md` 中的 "TS7053 / TS2322 形态 G：后端契约跟前端类型对齐"。

     **为什么这一项要单独列**：skill 之前的 7 个升级都查“TS 类型层”的 mismatch（spread / Set / cast / import / element union / mock 字段 / 重复定义），**不查“跨仓契约”**（后端 Java VO 字段名 vs 前端 type 字段名 vs 后端 JSON key vs 前端函数形参）。cashier 项目改造「表结构 + VO + 前端 type」是高频场景，**改后端必做“前后端字段名 diff”**。

