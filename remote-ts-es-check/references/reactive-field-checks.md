# reactive-field-checks

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

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

     **为什么这一项要单独列**：skill 之前的 8 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 PascalCase 未 import / TS2322 错 X / element union / mock 字段 / 重复定义 / 后端契约）都查“类型 / 字段 / 路径”是否对齐，**不查“identifier 本身在文件内是否声明过”**。cashier 项目高频场景：编辑时改上面 await/Promise 变量名（`res` → `ok`），忘改下面 `.data` 引用 —— 这种**“用错变量名”**的纯 typo 错误所有升级都不抓。参考 `references/reactive-errors.md` 中的 "TS2304 形态：小写 identifier 引用但未声明（典型 `res.data` 但 `res` 未声明）"。

   - **reactive<T>() 形参缺字段主动扫描（防 TS2345：interface 加字段后 formData reactive 漏同步）**：ESLint 默认不抓 type-aware 错误（`TS2345: Argument of type { ... } is not assignable to parameter of type FormState`），vue-tsc 不跑。cashier 项目高频场景：FormState interface 加新字段（spec 迭代）→ formItems 用 + 详情回显赋值 + 表单提交 payload 都同步了 → **formData reactive 字面量漏了** → TS2345。错误信号 100% 出现在 `reactive<T>(\{...})` 这种构造点，报错说“is missing the following properties from type T: xxx, yyy”。
     ```bash
     # 步骤 1: 找所有 reactive<Name>( 形式
     grep -rnE "\breactive<\w+>\s*\(" src/ --include="*.vue" --include="*.ts"

     # 步骤 2: 对每个 reactive<Name>( 调用点 (LineN)，提取从 LineN 到首个 ^}) 字面量范围的字段
     # 用 awk 扫 reactive 起点到 ^}) 终点：
     for f in $(grep -rlE "\breactive<\w+>\s*\(" src/ --include="*.vue" --include="*.ts"); do
       awk -v file="$f" '
         /\breactive<[A-Z]\w*>\s*\(/ { in_reactive=1; type_start=NR; next }
         in_reactive && /^\}\)/ { in_reactive=0; type_end=NR; print type_start"-"type_end; next }
       ' "$f" | while read range; do
         start=$(echo $range | cut -d- -f1)
         end=$(echo $range | cut -d- -f2)
         # reactive 字面量字段
         reactive_fields=$(sed -n "${start},${end}p" "$f" | grep -oE "^\s+[a-zA-Z]\w*\s*:" | sed -E 's/^\s+([a-zA-Z]\w*)\s*:.*/\1/' | sort -u)
         # 提取 Name
         name=$(sed -n "${start}p" "$f" | grep -oE "reactive<([A-Z]\w*)>" | sed -E 's/reactive<(\w+)>/\1/')
         # 同一文件找 interface Name { } 或 type Name = { } 字段
         interface_fields=$(awk -v name="$name" '
           $0 ~ "^interface "name" |^type "name" " { in_iface=1; next }
           in_iface && /^}/ { in_iface=0 }
           in_iface && /^\s+[a-zA-Z]\w*\s*\??:/ { print }
         ' "$f" | grep -oE "^\s+[a-zA-Z]\w*\s*\??:" | sed -E 's/^\s+([a-zA-Z]\w*)\s*\??:.*/\1/' | sort -u)
         # diff: interface 有但 reactive 字面量没的
         if [ -n "$interface_fields" ]; then
           missing=$(comm -23 <(echo "$interface_fields") <(echo "$reactive_fields"))
           if [ -n "$missing" ]; then
             echo "❌ $f 行 $start-$end: reactive<$name>() 缺字段: $missing"
           fi
         fi
       done
     done
     ```

     **重要前提**：reactive<Name> 形参的 Name 必须**本文件内能找到 interface/type 定义**。如果 Name 来自跨文件 import（如 `reactive<StoreSavePayload>` 来自 apis/type.ts），本扫描看不到 — 需 grep `import.*\bName\b` 跨文件追踪（**手动**）。

     **误报处理**（false positive ~20%，需 Read 上下文确认）：
     - **interface 全部字段是 optional**（带 `?`）—— 不报缺字段（TypeScript 不报 TS2345）
     - **interface 字段带默认值 / 是 getter** —— interface 必填但 reactive 实际运行时不会缺 —— 极少见
     - **interface 是 union type / extends 其他 interface** —— awk 提取会漏 extend 的字段 —— **手工补查**
     - **interface 字段是函数 / 复杂类型** —— awk 提取 `^\s+name:` 只能抓简单 identifier，函数类型会漏 —— **手工补查**
     - **dynamic key**（`[key: string]: T`）—— interface 是 index signature 时所有字段 optional —— 不报
     - **类型来自跨文件 import**（如 `StoreSavePayload` 来自 apis/type.ts）—— 本扫描看不到 —— 需 `grep -rn "interface StoreSavePayload\|type StoreSavePayload" src/` 手动补查
     - **`Partial<T>` 包裹**（`reactive<Partial<FormState>>`）—— 全部字段 optional，**永远不报缺字段** —— awk 不会解析 `Partial<>`，本扫描逻辑失效，需手工识别
     - **`Pick<T, K>` / `Omit<T, K>`** —— 同上，awk 失效

     **Cashier 项目验证**（2026-10-14 实际命中）：
     - `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:115` `reactive<FormState>({...})` 缺 `shopEmail` / `emailRegisterDate` —— FormState interface 行 110-111 加了 spec §3.5 字段，formData reactive 字面量漏了。修法：在 `closeDate: ""` 后 + `guaranteeReturnStatus: ""` 前加 `shopEmail: ""` / `emailRegisterDate: ""`。
     - cashier 项目 `reactive<Name>({...})` 出现 20 处（formData + searchForm）—— 高频。

     **命中后修法**（ponytail rung 1）：
     1. 找 `interface Name { }` 完整字段列表（不漏 optional）
     2. 按 interface 顺序在 reactive 字面量内**补全缺字段**（同 formItems 顺序方便调试）
     3. 默认值用 `""` / `0` / `false` / `[]` / `undefined` —— 看其他同类型字段的初始值约定
     4. 详情回显 (`formData.xxx = s.xxx || ""`) / 提交 payload 也要同步加，**但本次扫描只看 reactive 形参**，其他两处靠 `grep` 跨字段一致性补查
     5. **不要**为消除错误用 `as FormState` 强转（掩盖问题）

     **为什么这一项要单独列**：skill 之前的 8 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 PascalCase 未 import / TS2322 错 X / element union / mock 字段 / 重复定义 / 后端契约 / identifier 未声明）都查“**已有数据**是否对齐形参 / 类型”，**不查“**interface 加字段后** reactive 字面量是否同步”**。cashier 项目高频场景：spec 迭代时 FormState interface 加新字段 → formItems 用了 + 详情回显用了 + 提交 payload 用了 → 唯独 reactive 字面量漏 → TS2345。参考 `references/reactive-errors.md` 中的 "TS2345 形态：reactive<T>() 形参缺字段（典型 `formData = reactive<FormState>` 加字段后漏同步）"。

   - **reactive<T>() 实例字段引用错主动扫描（防 TS2339：模板/脚本里 `formData.xxx` 中 xxx 不在 FormState 内 —— typo 或漏加字段）**：与上一项"reactive<T>() 形参缺字段（TS2345）"是对偶形态 —— 都是"interface/formData 实际声明 vs 代码使用 diff"，**只是报错位置不同**：TS2345 报在 reactive 构造点（字面量缺必填字段），TS2339 报在**引用点**（`formData.xxx` 中 xxx 不在 reactive 推断类型上）。本扫描查**引用点错**这一支。
     ```bash
     # per-file 扫：reactive 字面量字段 vs formData/obj.xxx 引用 diff
     for f in $(grep -rlE "\breactive<\w+>\s*\(" src/ --include="*.vue" --include="*.ts"); do
       # 步骤 1: 找每个 reactive<Name>(varname={...}) 的字面量范围 + 提取字段 + 记录 varname
       awk -v file="$f" '
         /\bconst\s+(\w+)\s*=\s*reactive<[A-Z]\w*>\s*\(/ {
           match($0, /const[[:space:]]+([a-zA-Z_]\w*)[[:space:]]*=/, arr); varname=arr[1]; in_reactive=1; print NR":"varname; next
         }
         in_reactive && /^\}\)/ { in_reactive=0; next }
       ' "$f" | while read line_var; do
         start=$(echo "$line_var" | cut -d: -f1)
         varname=$(echo "$line_var" | cut -d: -f2)
         # reactive 字面量字段
         literal_fields=$(sed -n "${start},/^})/p" "$f" | grep -oE "^\s+[a-zA-Z]\w*\s*:" | sed -E 's/^\s+([a-zA-Z]\w*)\s*:.*/\1/' | sort -u)
         # 同 file 内 varname.xxx 引用
         ref_fields=$(grep -oE "\b$varname\.[a-zA-Z]\w+" "$f" | sed -E "s/$varname\.([a-zA-Z]\w+)/\1/" | sort -u)
         # 差集 = 引用了但字面量没的
         missing=$(comm -23 <(echo "$ref_fields") <(echo "$literal_fields"))
         if [ -n "$missing" ]; then
           echo "❌ $f: $varname.xxx 引用了但字面量没定义: $missing"
         fi
       done
     done
     ```

     **重要前提**：reactive 的 Name 必须**本文件内能找到 interface/type 定义**，否则推断类型不完整，扫描误报多。Name 来自跨文件 import（如 `reactive<StoreSavePayload>` 来自 apis/type.ts）需手动跨文件 grep `interface Name` / `type Name` 提取字段。

     **误报处理**（false positive ~30%，需 Read 上下文确认）：
     - **reactive<T> 中 T 是 `Partial<T>` / `Pick<T, K>` / `Omit<T, K>`** —— 推断类型字段是 T 的子集，引用了 T 上有但 reactive 推断没的字段 TS 不报 —— 误报
     - **reactive<T> 中 T 是 `Record<string, X>`** —— 任意 string key 都合法，**永远不报** —— awk 扫不到，无误报
     - **`xxx.yyy` 中 yyy 是 `obj["dynamicKey"]` 动态访问** —— grep 抓不到动态 key —— **手工补查**
     - **`xxx.yyy` 中 xxx 是解构出来的局部变量**（`const { data } = await api(); data.xxx`）—— awk 抓的只是 reactive 实例，data 解构不算 —— **手工补查**
     - **同名 type alias 在不同上下文**（如 type Status 既是表单也是接口响应）—— reactive 字面量字段 vs 引用字段对不上 —— **手工判断**
     - **computed / ref 推断字段**（`const field = computed(() => formData.xxx)`）—— computed 不算 reactive 实例，但 field.xxx 引用算 —— awk 不会误报
     - **template 里的 `reactiveVar.method()`**（如 `formData.someMethod()`）—— grep `\b$varname\.` 会命中 method 名，但 method 不在 reactive 字面量字段里 —— **手工判断是 method 还是 field**

     **Cashier 项目验证**（2026-10-14 实际命中）：
     - `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:749` 模板 `:apply-department="formData.belongsDepartment"` —— FormState + formData reactive 字面量都没 `belongsDepartment` 字段（commit 0ce7fff 加 SubAccountManager 集成时漏改字段名，**typo**）→ TS2339。修法：改成 `formData.departmentId`（已存在的部门字段，值就是字典 one_id 同源）。

     **命中后修法**（ponytail rung 1）：
     1. 看报错信息"Property 'xxx' does not exist on type FormState" —— 99% 是**字段名拼错**或**漏加字段**
     2. **(A) typo** —— grep `interface FormState` 找相似名（如 user 这次 belongsDepartment → departmentId），改 typo 即可
     3. **(B) 漏加字段** —— FormState + formData reactive 字面量 + 详情回显 + payload 4 处都要加（参考"reactive<T>() 形参缺字段"扫描章节的 4 同步点）
     4. **不要**为消除错误用 `as any` 强转（掩盖问题，运行时实际 undefined）

     **为什么这一项要单独列**：skill 之前的 9 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 PascalCase 未 import / TS2322 错 X / element union / mock 字段 / 重复定义 / 后端契约 / identifier 未声明 / reactive<T>() 形参缺字段）都查"**已有数据 vs 形参**"或"**identifier 引用**"是否对齐，**不查"**reactive 实例字段引用 vs 推断类型声明**"的对齐**。TS2345 vs TS2339 报错位置不同（构造点 vs 引用点），但 root cause 同源（interface 字段缺失）—— 两支扫描要分开列才能各自覆盖。参考 `references/reactive-errors.md` 中的 "TS2339 形态：reactive<T>() 实例字段引用错（典型 `formData.belongsDepartment` 但 FormState 没这字段 —— typo 或漏加）"。


