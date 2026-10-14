# 目标 10：JSDoc 注释和被注释代码之间不允许空行（预防规范）

**核心问题**：JSDoc 注释（`/** ... */`）的结束行（` */`）与被注释的代码（function / interface / type / const / class）之间**不允许**有空行。空行会让 IDE / 阅读者视觉上"断开"——以为 doc 跟下面的代码无关。

**本目标分两件事**：
1. **规范定义**（预防）——新代码必须紧贴
2. **现状补救**（一次性清理）——已存在的空行用一条 perl 命令批量删

---

## 1. 规范定义（**核心**）

### 1.1 规则原文

> JSDoc 注释的结束行 ` */` 与被注释的代码声明之间**必须紧贴**，中间不允许空行。
>
> ```ts
> // ✅ 合规
> /**
>  * 函数描述
>  */
> export function foo() {}
>
> // ❌ 违规
> /**
>  * 函数描述
>  */
>                                       ← 空行
> export function foo() {}
> ```

### 1.2 适用对象

| 被注释对象 | 是否适用 |
|---|---|
| `export function` / `function` | ✅ 必须紧贴 |
| `export interface` / `interface` | ✅ 必须紧贴 |
| `export type` / `type` | ✅ 必须紧贴 |
| `export const` / `const` | ✅ 必须紧贴 |
| `export class` / `class` | ✅ 必须紧贴 |
| `export enum` / `enum` | ✅ 必须紧贴 |
| `export default` 任意 | ✅ 必须紧贴 |
| 文件顶部 file-level doc block | ✅ 必须紧贴第一个 import/声明 |

### 1.3 反例

**反例 1：doc 跟 function 中间空行**
```ts
/**
 * 出纳-人员信息列表
 */
                              ← 空行
export function listCashierEmployeesApi() {}
```

**反例 2：JSDoc 内部连续多空行**（虽然内部允许多行，但单行间也不该插空行）
```ts
/**
 * 描述第一段
 *                              ← 空行（违规）
 * 描述第二段
 */
export function foo() {}
```

**反例 3：doc 末尾空行 + import 之间又插空行**
```ts
/**
 * 文件说明
 */
                              ← 空行
import { x } from "y"
```
（file-level doc 块后面允许接一个空行再开始 import，因为 import 段本来就分组——但**不鼓励**）

### 1.4 例外（允许空行的情况）

| 场景 | 是否允许 |
|---|---|
| 章节分隔（连续多个 `export` 之间） | ✅ 允许（属于代码块之间的章节分隔，**不**算 doc 与代码之间） |
| import 段之间分组（空行分组 import） | ✅ 允许 |
| 文件末尾 doc 注释（无被注释对象） | ✅ 允许 |
| `// 单行注释` 紧贴代码 | ✅ 允许（仅 JSDoc 强制紧贴） |
| 类内方法之间空行 | ✅ 允许（属于方法之间的章节分隔，**不**算 doc 与方法之间） |
| interface 内字段之间空行（按逻辑分组） | ✅ 允许（属于字段之间的分组，**不**算 doc 与字段之间——但字段 JSDoc 仍要紧贴字段） |

---

## 2. 验收检查清单（新增/修改 .ts/.vue 时必跑）

- [ ] 我是否在 JSDoc 结束行 ` */` 与被注释代码之间留了空行？**是** → 删空行
- [ ] 章节之间（多个 export 之间）空行是否仍保留？**是** → 保留（不属于本目标范围）
- [ ] import 分组空行是否仍保留？**是** → 保留
- [ ] class/interface 内部方法/字段之间的空行是否仍保留？**是** → 保留（但方法/字段的 JSDoc 仍要紧贴）

---

## 3. 自动化修复（一条 perl 命令）

适用：批量删 **` */\n\nexport` 模式** 的空行（doc 后紧跟 export 类代码）。

```bash
# 单文件
perl -i -0pe 's| \*/\n\nexport | */\nexport |g' src/pages/<业务块>/apis/index.ts

# 整个业务块
find src/pages/<业务块> -type f \( -name "*.ts" -o -name "*.vue" \) -exec \
  perl -i -0pe 's| \*/\n\nexport | */\nexport |g' {} \;
```

**变体**（覆盖 `function` / `interface` / `type` / `const` / `class` 等所有声明）：

```bash
# 删 doc 与下一行任意声明之间的空行（注意：这一条更激进，会误伤正常的"doc 独立成段"情况，建议先 dry-run）
perl -i -0pe 's| \*/\n\n(export |function |interface |type |const |class |enum )| */\n$1|g' src/path/to/file.ts
```

**dry-run 验证**（不改文件，只报命中位置）：

```bash
# 用 grep -nE 找违规位置
grep -nE '^\s*\*\s*/$' -A 1 src/path/to/file.ts | awk '/^\s*\*\s*\/$/{getline next_line; if (next_line ~ /^\s*$/ && getline next_next && next_next ~ /^(export |function |interface |type |const |class |enum )/) print FILENAME":"NR": doc->空行->"next_next}'
```

---

## 4. 反模式（不要做）

- ❌ "doc 长所以隔一行呼吸"——doc 紧贴代码是规范，呼吸靠章节之间空行
- ❌ "ESLint 没报就 ok"——ESLint 默认不强制 JSDoc 紧贴，本目标更严格
- ❌ 误把"两个 export 之间的章节空行"也删了——`perl` 命令用 `*/\n\nexport` 锚点只删 doc 后那 1 个空行，不会误伤章节空行
- ❌ file-level doc 与第一个 import 之间也强求紧贴——允许保留 1 个空行（不鼓励但不算违规）
- ❌ 跑 `npx eslint src/pages/<业务块>/` 整目录看 JSDoc 紧贴问题——ESLint 默认不查，**手动 perl 修**

---

## 5. 与其他 reference 的关系

- **目标 8（enum 风格）**：批量提取 enum 时由 perl 修空行（见 `08-appendix-remediation.md` 步骤 4）
- **目标 9（type/interface 集中）**：批量提取 type 时由 perl 修空行（见 `09-appendix-remediation.md` 步骤 4）
- **目标 2（审查）**：新增检查项 13 扫"doc 与代码之间空行"违规
- **04-shared-vs-private.md**：无直接关系（属于归属判定，不涉及代码风格）
- **07-quick-reference.md**：速查表加一行

**适用范围**：本目标适用**所有** `src/**/*.{ts,vue}` 文件，不仅限 `src/pages/`。但 skill 入口在 `remote-cashier-list-page-directory`（与目标 8/09 同入口），其他模块（`@/common` / `@/components`）的同类问题按本目标修。

---

## 6. 实战案例（company 模块 2026-10-14）

**修复前**：`addOrEdit/apis/index.ts` 6 处 `*/` 后空行（listCashierEmployeesApi / pageCashierEmployeesForSelectApi / listAllBankCardApi / listAllFileTagsApi / listAllOperatingScopeApi / cashierPageQueryBrandApi）。

**修复命令**：
```bash
perl -i -0pe 's| \*/\n\nexport function| */\nexport function|g' \
  D:/OB/ob_web/packages/micro/cashier/src/pages/company/addOrEdit/apis/index.ts
```

**修复后**：6 处全部紧贴，0 错（ESLint 0 错 + 验证脚本 0 命中）。
