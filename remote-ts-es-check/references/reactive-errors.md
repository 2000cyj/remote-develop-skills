# reactive<T>() 错误形态（reactive-errors）

本文件是 remote-ts-es-check 的 reference。包含 3 个 reactive<T>() 相关错误形态：identifier 未声明（TS2304/TS2551） + 形参缺字段（TS2345） + 实例字段引用错（TS2339）。**与 `baseline-eslint.md`（ESLint 基础错）和 `ts-typing.md`（TS 错误签名）互不重叠**。

3 个形态 root cause 同源（interface 字段缺失或 typo），但报错位置不同：
- TS2304/TS2551 identifier: 编辑时改上面 await/Promise 变量名，忘改下面 .访问引用
- TS2345 形参缺字段: interface 加新字段后 reactive 字面量机械补全漏行
- TS2339 实例字段引用: 模板/脚本里 `formData.xxx` 中 xxx 不在 FormState 内

**扫描需分构造点 / 引用点两支**才能各自覆盖。详见 SKILL.md 步骤 6 三个 reactive 相关升级。

先对照签名定位，再动手。只有签名位于本次任务的编辑文件和 changed hunks 内时才修复；根因或修复点落在范围外时只报告，不扩大修改范围。

## TS2304 / TS2551：小写 identifier 引用但未声明（典型 `res.data` 但 `res` 未声明）

**签名**：
```
TS2304: Cannot find name 'res'
TS2551: Property 'data' does not exist on type 'never'
（vue-tsc 报错在引用点行）
```

**根因**：
- 编辑时改**上面** await/Promise 变量名（`res` → `ok`）漏改**下面** `.xxx` 成员访问
- 复制粘贴 A 函数 `if (res.data === "string")` 到 B 函数，B 函数实际变量名是 `ok` / `data` / `result` —— **`res` 在 B 文件内从未声明**
- 异步函数返回值取属性时，**ApiEnvelope 与裸值混淆**：`requestData<T>` 已自动解 envelope，返裸 T（string / boolean / number / Record），**没有 `.data` 包装**。`const ok = await saveApi(...)` 后用 `ok.data` = TS2551 Property 'data' does not exist on type 'boolean'

**典型错形态**（cashier 高频）：
```ts
// 错（addOrEdit.vue line 579-591 实际命中）
const ok = isEdit.value ? await updateStoreAllApi(payload) : await addStoreAllApi(payload)
//                                     ^^^^^^^ 返 boolean                ^^^^^^^ 返 string（裸 uniqueValue）
if (ok) {
  // ...
  if (!isEdit.value && typeof res.data === "string") {  // ← res 未声明 + .data 不应存在
    formData.uniqueValue = res.data
  }
}

// 正
if (!isEdit.value && typeof ok === "string") {  // ok 实际是 uniqueValue string
  formData.uniqueValue = ok
}
```

**ESLint 为什么没报**：`TS2304` / `TS2551` 是 type-aware 错误，cashier 的 `package.json` 没有 `type-check` 脚本、`pnpm dev / build` 走 esbuild 不做类型检查；ESLint 也不带 `parserOptions.project`，无法跑 type-aware 规则（如 `@typescript-eslint/no-unsafe-member-access`）。

**主动扫描方法**（per-file 声明 vs 访问差集）：
```bash
f=src/.../Foo.vue
# 步骤 1: 提取文件内“被声明”的小写 identifier
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
- **JS 全局**：`window` / `document` / `console` / `Math` / `JSON` / `Date` —— 首字母**大写**不命中
- **Vue / 组合式 API**：`computed` / `ref` / `reactive` / `watch` / `onMounted` —— 必 import，declared 包含
- **destructured 解构**（`const { data, status } = await loadApi()` 后用 `data`）—— perl 提取不到。**手工补查**（grep `: \w+;\|: \w+ =\|= \w+;`）
- **形参解构**（`function foo({ a, b }: { a, b })`）—— perl 提取的是 `foo`，不是 `a` / `b`。**手工补查**
- **async callback 闭包变量**（`fetchData().then(res => { result = res })`）—— 需外层声明。**手工补查**
- **事件对象形参**（`function handleAdd(e: MouseEvent)`）—— 形参 `e` 会被 perl 误报。**手工排除**
- **library 全局挂载**（`axios` / `$` / `jQuery` / `dayjs`）—— 罕见，手动维护白名单

**Cashier 项目验证**（2026-10-14 实际命中）：
- `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:590` `if (typeof res.data === "string")` —— 上 579 行声明 `const ok = ...`，`res` 引用但**未声明**。改用 `ok` + 去 `.data`（addStoreAllApi 返 string 裸值，无 envelope）。

**修法（ponytail rung 1）**：
1. 找上下文（行 5-10 内）有没有同名同语义的变量声明，**很可能是上面 await 改了名**
2. 把错引用 `xxx.yyy` → 正确变量名（user 报的 case 是 `res` → `ok`）
3. 修法只动引用点，**不动声明点**（声明点是源头）
4. 不擅自删除（虽然是 typo 但可能是函数返回值 / 参数 / 全局挂载）

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位）| import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown）| `const x = () => arr.map(...)` 无签名 → 返回 `unknown[]` |
| TS2322（mock 缺字段）| mock / test 数据 vs 接口契约字段缺失 |
| jsdoc/multiline-blocks | JSDoc 起始行 `/**` 同行接文字 |
| 未使用代码（默认 ESLint 不抓）| 项目 eslint.config.js 默认禁用 no-unused-vars 导致死代码 + 孤儿 API 残留 |
| TS2322（同名类型重复定义）| 同名 interface / type 在两处独立 `export`，可选性不一致 |
| 后端契约 3 子形态 G | 改后端 Java VO / JSON key 跟前端 type / 函数形参没对齐 |
| **TS2304 / TS2551（identifier 未声明）** | **小写 identifier 被 .访问但文件内未声明 —— await/Promise 改完上面忘改下面的纯 typo 错** |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 新增的"未定义 identifier 主动扫描"扫描项。本形态是 2026-10-14 实际修复
- `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:590` `if (typeof res.data === "string")` —— `res` 引用但上 579 行声明的是 `ok` 不是 `res`
时发现。skill 之前的 8 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 PascalCase 未 import / TS2322 错 X / element union / mock 字段 / 重复定义 / 后端契约）都查"类型 / 字段 / 路径"是否对齐，**不查"identifier 本身在文件内是否声明过"**——这种"用错变量名"的纯 typo 错误**所有升级都不抓**。


## TS2345：reactive<T>() 形参缺字段（典型 `formData = reactive<FormState>` 加字段后漏同步）

**签名**：
```
TS2345: Argument of type {
  uniqueValue: undefined;
  storeCode: string;
  companyId: undefined;
  // ... 22 more fields
  guaranteeReturnStatus: '';
} is not assignable to parameter of type FormState

Type { ... } is missing the following properties from type FormState: shopEmail, emailRegisterDate
```

**根因**：spec 迭代时 FormState interface 加新字段（例 spec §3.5 加 `shopEmail` / `emailRegisterDate`），**4 个同步点**:
1. ✅ `interface FormState { ... }` 加字段（developer 记得）
2. ✅ `formItems` 动态表单配置加 `{ prop: "shopEmail", ... }`（developer 记得）
3. ✅ 详情回显 `formData.shopEmail = s.shopEmail || ""`（developer 记得）
4. ❌ **`const formData = reactive<FormState>({...})` 字面量里加** `shopEmail: ""` —— **高频漏**

**为什么会漏**：vue-tsc 不跑、ESLint 不带 `parserOptions.project`，type-aware 错误抓不到；且字面量补全**机械重复**（跟 interface 一字不差），容易复制粘贴时漏 1-2 行。

**ESLint 为什么没报**：cashier 的 `package.json` 没有 `type-check` 脚本，`pnpm dev / build` 走 esbuild 不做类型检查；ESLint 也不带 `parserOptions.project`，无法跑 type-aware 规则。

**主动扫描方法**（per-file reactive<T> 形参 vs interface 字段 diff）：
```bash
# 步骤 1: 找所有 reactive<Name>( 形式
grep -rnE "\breactive<\w+>\s*\(" src/ --include="*.vue" --include="*.ts"

# 步骤 2: 对每个调用点 (LineN)，从 LineN 到首个 ^}) 提取 reactive 字面量范围 + 字段
# 用 awk 扫 reactive 起点到 ^}) 终点
for f in $(grep -rlE "\breactive<\w+>\s*\(" src/ --include="*.vue" --include="*.ts"); do
  awk -v file="$f" '
    /\breactive<[A-Z]\w*>\s*\(/ { in_reactive=1; type_start=NR; next }
    in_reactive && /^\}\)/ { in_reactive=0; type_end=NR; print type_start"-"type_end; next }
  ' "$f" | while read range; do
    start=$(echo $range | cut -d- -f1)
    end=$(echo $range | cut -d- -f2)
    reactive_fields=$(sed -n "${start},${end}p" "$f" | grep -oE "^\s+[a-zA-Z]\w*\s*:" | sed -E 's/^\s+([a-zA-Z]\w*)\s*:.*/\1/' | sort -u)
    name=$(sed -n "${start}p" "$f" | grep -oE "reactive<([A-Z]\w*)>" | sed -E 's/reactive<(\w+)>/\1/')
    interface_fields=$(awk -v name="$name" '
      $0 ~ "^interface "name" |^type "name" " { in_iface=1; next }
      in_iface && /^}/ { in_iface=0 }
      in_iface && /^\s+[a-zA-Z]\w*\s*\??:/ { print }
    ' "$f" | grep -oE "^\s+[a-zA-Z]\w*\s*\??:" | sed -E 's/^\s+([a-zA-Z]\w*)\s*\??:.*/\1/' | sort -u)
    if [ -n "$interface_fields" ]; then
      missing=$(comm -23 <(echo "$interface_fields") <(echo "$reactive_fields"))
      if [ -n "$missing" ]; then
        echo "❌ $f 行 $start-$end: reactive<$name>() 缺字段: $missing"
      fi
    fi
  done
done
```

**重要前提**：reactive<Name> 的 Name 必须**本文件内能找到 interface/type 定义**。如果 Name 来自跨文件 import（如 `reactive<StoreSavePayload>` 来自 apis/type.ts），本扫描看不到 — 需 grep `import.*\bName\b` 跨文件追踪（**手动**）。

**误报处理**（false positive ~20%，需 Read 上下文确认）：
- **interface 全部字段是 optional**（带 `?`）—— 不报缺字段（TypeScript 不报 TS2345）
- **interface extends 其他 interface** —— awk 提取会漏 extend 的字段 —— **手工补查**
- **interface 字段是函数 / 复杂类型** —— awk `^\s+name:` 只能抓简单 identifier —— **手工补查**
- **`Partial<T>` / `Pick<T, K>` / `Omit<T, K>` 包裹**（`reactive<Partial<FormState>>`）—— 全部字段 optional，**永远不报缺字段** —— awk 不会解析 `Partial<>`，本扫描逻辑失效，需手工识别
- **类型来自跨文件 import**（如 `StoreSavePayload` 来自 apis/type.ts）—— 本扫描看不到 —— `grep -rn "interface StoreSavePayload\|type StoreSavePayload" src/` 手动补查

**Cashier 项目验证**（2026-10-14 实际命中）：
- `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:115` `reactive<FormState>({...})` 缺 `shopEmail` / `emailRegisterDate` —— FormState interface 行 110-111 加了 spec §3.5 字段，formData reactive 字面量漏了。修法：在 `closeDate: ""` 后 + `guaranteeReturnStatus: ""` 前加 `shopEmail: ""` / `emailRegisterDate: ""`。
- cashier 项目 `reactive<Name>({...})` 出现 20 处（formData + searchForm）—— 高频。

**修法（ponytail rung 1）**：
1. 找 `interface Name { }` 完整字段列表（不漏 optional）
2. 按 interface 顺序在 reactive 字面量内**补全缺字段**（同 formItems 顺序方便调试）
3. 默认值用 `""` / `0` / `false` / `[]` / `undefined` —— 看其他同类型字段的初始值约定
4. 详情回显 (`formData.xxx = s.xxx || ""`) / 提交 payload 也要同步加，**但本次扫描只看 reactive 形参**，其他两处靠 `grep` 跨字段一致性补查
5. **不要**为消除错误用 `as FormState` 强转（掩盖问题）

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位）| import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown）| `const x = () => arr.map(...)` 无签名 → 返回 `unknown[]` |
| TS2322（mock 缺字段）| mock / test 数据 vs 接口契约字段缺失 |
| jsdoc/multiline-blocks | JSDoc 起始行 `/**` 同行接文字 |
| 未使用代码（默认 ESLint 不抓）| 项目 eslint.config.js 默认禁用 no-unused-vars 导致死代码 + 孤儿 API 残留 |
| TS2322（同名类型重复定义）| 同名 interface / type 在两处独立 `export`，可选性不一致 |
| 后端契约 3 子形态 G | 改后端 Java VO / JSON key 跟前端 type / 函数形参没对齐 |
| TS2304 / TS2551（identifier 未声明）| 小写 identifier 被 .访问但文件内未声明 —— await/Promise 改完上面忘改下面的纯 typo 错 |
| **TS2345（reactive<T>() 形参缺字段）** | **interface 加字段后 reactive 字面量漏同步 —— formData / searchForm 机械补全漏行** |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 新增的"reactive<T>() 形参缺字段主动扫描"扫描项。本形态是 2026-10-14 实际修复
- `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:115` `const formData = reactive<FormState>({...})` 缺 `shopEmail` / `emailRegisterDate`
时发现。skill 之前的 9 个升级（TS2345 spread / 透传 / TS2339 Set / fieldCode / TS2304 PascalCase 未 import / TS2322 错 X / element union / mock 字段 / 重复定义 / 后端契约 / identifier 未声明）都查"**已有数据**是否对齐形参 / 类型"，**不查"**interface 加字段后** reactive 字面量是否同步"** —— 这种"**机械补全漏 1-2 行**"的同步型错误所有升级都不抓。cashier 项目 20 处 reactive<Name>({...}) 高频，每次 spec 迭代都易中招。


## TS2339：reactive<T>() 实例字段引用错（典型 `formData.belongsDepartment` 但 FormState 没这字段）

**签名**：
```
TS2339: Property 'belongsDepartment' does not exist on type {
  uniqueValue?: string | undefined;
  storeCode: string;
  companyId: number | undefined;
  // ... 22 more fields
  guaranteeReturnStatus: '' | GuaranteeReturnStatus;
}
（type 是 reactive<FormState> 推断出的）
```

**根因**：与上一项"reactive<T>() 形参缺字段（TS2345）"是**对偶**形态：
- TS2345: **构造点**报，reactive 字面量缺必填字段
- TS2339: **引用点**报，模板/脚本里 `formData.xxx` 中 xxx 不在 reactive 推断类型上

**两者 root cause 同源**：FormState interface 没这个字段 + formData reactive 字面量也没这个字段。**但报错位置不同导致 type-aware 工具报在不同位置**。

**典型错形态**（cashier 高频）：

| 场景 | 表现 | 根因 |
|---|---|---|
| **typo** | `formData.belongsDepartment`（应为 `departmentId`）| commit 加新集成时拼错字段名 |
| **漏加字段** | `formData.shopEmail`（FormState 有但 reactive 字面量漏了）| 4 同步点（interface/formData/回显/payload）漏 1 个 |
| **复制粘贴残留** | 别的文件用 `applyDepartment`，addOrEdit 错粘成 `belongsDepartment` | 业务名不一致没注意 |
| **重构遗漏** | 重命名 `departmentId → deptId` 后，模板忘改某处 | grep 不彻底 |

**ESLint 为什么没报**：`TS2339` 是 type-aware 错误，cashier 的 `package.json` 没有 `type-check` 脚本、`pnpm dev / build` 走 esbuild 不做类型检查；ESLint 也不带 `parserOptions.project`，无法跑 type-aware 规则（如 `@typescript-eslint/no-unsafe-member-access`）。

**主动扫描方法**（per-file reactive 实例字段 vs reactive 字面量字段 diff）：
```bash
# per-file 扫：reactive 字面量字段 vs formData/obj.xxx 引用 diff
for f in $(grep -rlE "\breactive<\w+>\s*\(" src/ --include="*.vue" --include="*.ts"); do
  awk -v file="$f" '
    /\bconst\s+(\w+)\s*=\s*reactive<[A-Z]\w*>\s*\(/ {
      match($0, /const[[:space:]]+([a-zA-Z_]\w*)[[:space:]]*=/, arr); varname=arr[1]; in_reactive=1; print NR":"varname; next
    }
    in_reactive && /^\}\)/ { in_reactive=0; next }
  ' "$f" | while read line_var; do
    start=$(echo "$line_var" | cut -d: -f1)
    varname=$(echo "$line_var" | cut -d: -f2)
    literal_fields=$(sed -n "${start},/^})/p" "$f" | grep -oE "^\s+[a-zA-Z]\w*\s*:" | sed -E 's/^\s+([a-zA-Z]\w*)\s*:.*/\1/' | sort -u)
    ref_fields=$(grep -oE "\b$varname\.[a-zA-Z]\w+" "$f" | sed -E "s/$varname\.([a-zA-Z]\w+)/\1/" | sort -u)
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
- **template 里的 `reactiveVar.method()`**（如 `formData.someMethod()`）—— grep `\b$varname\.` 会命中 method 名，但 method 不在 reactive 字面量字段里 —— **手工判断是 method 还是 field**

**Cashier 项目验证**（2026-10-14 实际命中）：
- `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:749` 模板 `:apply-department="formData.belongsDepartment"` —— FormState + formData reactive 字面量都没 `belongsDepartment` 字段（commit 0ce7fff 加 SubAccountManager 集成时漏改字段名，**typo**）→ TS2339。修法：改成 `formData.departmentId`（已存在的部门字段，值就是字典 one_id 同源）。
- 同一文件修复前 awk 扫出 3 个字段引用了但字面量没：`belongsDepartment`（typo，本次修） + `emailRegisterDate` + `shopEmail`（前次 reactive 字面量缺字段已修）。

**修法（ponytail rung 1）**：
1. 看报错信息"Property 'xxx' does not exist on type FormState" —— 99% 是**字段名拼错**或**漏加字段**
2. **(A) typo** —— grep `interface FormState` 找相似名（如 user 这次 belongsDepartment → departmentId），改 typo 即可
3. **(B) 漏加字段** —— FormState + formData reactive 字面量 + 详情回显 + payload 4 处都要加（参考"reactive<T>() 形参缺字段"扫描章节的 4 同步点）
4. **不要**为消除错误用 `as any` 强转（掩盖问题，运行时实际 undefined）

**与已有形态区别**：

| 形态 | 触发场景 |
|---|---|
| TS2305（路径错位）| import 路径贪心合并导致 type-only 跑 value-only |
| TS2345（函数返回 unknown）| `const x = () => arr.map(...)` 无签名 → 返回 `unknown[]` |
| TS2322（mock 缺字段）| mock / test 数据 vs 接口契约字段缺失 |
| jsdoc/multiline-blocks | JSDoc 起始行 `/**` 同行接文字 |
| 未使用代码（默认 ESLint 不抓）| 项目 eslint.config.js 默认禁用 no-unused-vars 导致死代码 + 孤儿 API 残留 |
| TS2322（同名类型重复定义）| 同名 interface / type 在两处独立 `export`，可选性不一致 |
| 后端契约 3 子形态 G | 改后端 Java VO / JSON key 跟前端 type / 函数形参没对齐 |
| TS2304 / TS2551（identifier 未声明）| 小写 identifier 被 .访问但文件内未声明 —— await/Promise 改完上面忘改下面的纯 typo 错 |
| TS2345（reactive<T>() 形参缺字段）| interface 加字段后 reactive 字面量漏同步 —— formData / searchForm 机械补全漏行 |
| **TS2339（reactive<T>() 实例字段引用错）** | **模板/脚本里 `formData.xxx` 中 xxx 不在 FormState 内 —— typo 或 4 同步点漏 1 个** |

**SKILL 升级点**：见 `SKILL.md` 步骤 6 新增的"reactive<T>() 实例字段引用错主动扫描"扫描项。本形态是 2026-10-14 实际修复
- `ob_web/packages/micro/cashier/src/pages/store/addOrEdit/addOrEdit.vue:749` `:apply-department="formData.belongsDepartment"` —— FormState 没这字段
时发现。skill 之前的 10 个升级（包括刚加的"reactive<T>() 形参缺字段 TS2345"）都查"**已有数据 vs 形参**"，**不查"**reactive 实例字段引用 vs 推断类型声明**"的对齐** —— TS2345 vs TS2339 报错位置不同（构造点 vs 引用点），但 root cause 同源（interface 字段缺失），**两支扫描要分开列才能各自覆盖**。cashier 项目 reactive<Name>({...}) 出现 20 处，每次新增集成/字段都易中招。

**反思 — 为什么之前没检测出来**：
- **TS2345 扫描（已加）**只扫 reactive 构造点的字面量字段缺必填，**对"调用点引用未声明字段"扫不到**
- **TS2304 扫描（已加）**perl pattern `([a-z]\w*)\s*[\.\?\!]\s*[a-zA-Z_]` 只抓 `.yyy` 前的 identifier（`formData`），**不抓 `.yyy` 后的字段名（`belongsDepartment`）** —— 这是 perl 提取逻辑的盲区
- ESLint 全配置无 type-aware 规则，vue-tsc 不跑，**所有 TS 错误都得靠 grep 主动扫**，**但 grep 只能抓"模式匹配"，抓不到"类型层对齐"** —— 必须**per-file 提 reactive 字面量字段 + 提 formData.xxx 引用 + diff** 三步才能命中
- 教训：**type-aware 错误的扫描必须分构造点 / 引用点两支**，不能合并成一项；TS 报错位置不同（`reactive<FormState>({...})` vs `formData.belongsDepartment`），**扫描也得对应分两支**才能各自覆盖

