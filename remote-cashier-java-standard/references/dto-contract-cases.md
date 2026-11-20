# dto-contract-cases — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。


### 12. DTO/VO/PO 链路全面遵循 oboJava 规范：OperatingScope 案例（V20260914）

> 来源：`OperatingScopeController` / `IOperatingScopeManageService` / `OperatingScopeManageServiceImpl` / `OperatingScopeServiceImpl` / `IOperatingScopeService` 配套的 DTO/VO/PO 全部过一遍 skill 规范（2026-09-14）。原文件 8 处违规（3 处 PO 泄漏 + 1 处自引用栈溢出 + 4 处规约细节）。

#### 违规清单（8 处）

| # | 文件 | 违规 | 规则引用 |
|---|---|---|---|
| 1 | `OperatingScopeController.listAllOperatingScope` | 返回 `List<OperatingScope>`（PO 泄漏）| §10 + §7 |
| 2 | `IOperatingScopeManageService.listAllOperatingScope` | 返回 `List<OperatingScope>`（PO 泄漏）| §7 |
| 3 | `OperatingScopeManageServiceImpl.listAllOperatingScope` | 返回 `List<OperatingScope>`（PO 泄漏）| §7 |
| 4 | `OperatingScopeTreeVO` | 裸 `@Data` + 自引用 `List<TreeVO> children` → toString/equals/hashCode 栈溢出 | §7 + 隐藏 bug |
| 5 | `OperatingScopeSaveDTO` | 无校验注解（`@NotBlank` / `@Min` / `@Size` + 中文 message）| §7 |
| 6 | `OperatingScopeController` 3 个 `@RequestBody` 方法 | 缺 `@Validated`（Bean Validation 不生效）| §7 |
| 7 | `OperatingScopePageDTO` / `OperatingScopeSaveDTO` / `OperatingScopeVO` / `OperatingScopeTreeVO` | 缺类 Javadoc | §0（应推广到 DTO/VO/PO）|
| 8 | `OperatingScopeVO.industryCategory` / `OperatingScope.industryCategory` | `@ApiModelProperty` 描述不一致（“字符串类型” vs “支持多选ID逗号分隔”）| §7 + §6 |

#### 1. PO 不能暴露在 Service 接口 / Manage 实现 / Controller 返回（3 处必须同步改）

**反面案例**（PO 底表字段泄漏到前端）：

```java
// Controller
public Result<List<OperatingScope>> listAllOperatingScope() {
    return Result.success(operatingScopeManageService.listAllOperatingScope());
}

// Manage Service 接口
List<OperatingScope> listAllOperatingScope();

// Manage Service 实现
@Override
public List<OperatingScope> listAllOperatingScope() {
    return operatingScopeService.listAllOperatingScope();
}
```

**为什么是硬违规**：
- 前端响应 JSON 会拿到 `deleted` / `create_user` / `update_user` / `create_time` / `update_time`（BaseEntity 字段）
- 软删状态泄漏（前端可能根据 `deleted` 猜业务规则）
- 接口契约与 PO 架构耦合——PO 加字段（`update_by` / 业务状态）直接污染前端

**修复**（三层同步改）：

```java
// 1. Service 接口
List<OperatingScopeVO> listAllOperatingScope();

// 2. Manage 实现（空集合走 §8 + 转换走 §9）
@Override
public List<OperatingScopeVO> listAllOperatingScope() {
    List<OperatingScope> list = operatingScopeService.listAllOperatingScope();
    if (CollectionUtils.isEmpty(list)) {
        return Collections.emptyList();
    }
    return BeanCopyUtils.copyList(list, OperatingScopeVO::new);
}

// 3. Controller
public Result<List<OperatingScopeVO>> listAllOperatingScope() {
    return Result.success(operatingScopeManageService.listAllOperatingScope());
}
```

#### 2. TreeVO 自引用 + @Data → StackOverflowError（隐藏 bug）

**反模式**：

```java
@Data
@ApiModel("经营范围树形VO")
public class OperatingScopeTreeVO {
    @ApiModelProperty("子节点")
    private List<OperatingScopeTreeVO> children;   // 自引用
}
```

**为什么会炸**：`@Data` = `@Getter + @Setter + @ToString + @EqualsAndHashCode + @RequiredArgsConstructor`。
`@ToString` 递归打印 children 列表里的每个子节点的 children 列表……一旦树超过 5 层就堆栈溢出。
`@EqualsAndHashCode` 同样递归。

**修复**（子节点排除递归）：

```java
@Data
@ToString(exclude = "children")
@EqualsAndHashCode(exclude = "children")
@ApiModel("经营范围树形VO")
public class OperatingScopeTreeVO {
    @ApiModelProperty("子节点")
    private List<OperatingScopeTreeVO> children;
}
```

**判定标准**：VO 含 `List<XxxVO>` 字段且 `XxxVO` 是同类型（本类 / 父类 / 常见递归类型）→ 必须 exclude 该字段。

#### 3. DTO 校验注解 + Controller @Validated

**SaveDTO 校验**：

```java
@Data
@ApiModel("经营范围保存DTO")
public class OperatingScopeSaveDTO {
    @NotBlank(message = "名称不能为空")
    @Size(max = 100, message = "名称长度不能超过100")
    private String name;

    @Min(value = 0, message = "排序不能小于0")
    private Integer sort;

    @Size(max = 500, message = "备注长度不能超过500")
    private String remark;
    ...
}
```

**Controller 开启校验**：

```java
// 原（不生效）
public Result<Boolean> addOperatingScope(@RequestBody OperatingScopeSaveDTO dto) { ... }

// 修（项目用 @Validated 不是 @Valid，参考 EmployeeController）
public Result<Boolean> addOperatingScope(@RequestBody @Validated OperatingScopeSaveDTO dto) { ... }
```

> 注：skill §7 原文写 `@Valid`，bi-cashier 实际用 Spring 的 `@Validated`（能启用方法级校验），两者效果对 `@RequestBody` 一致。

#### 4. 字段描述一致性（PO ↔ VO）

PO 写完整定义，VO 复制时**只可精简、不能加错**。

```java
// PO：包含完整业务描述
@ApiModelProperty("所属行业字典（支持多选ID逗号分隔）")

// VO：同样描述（不能简化为“字符串类型”——丢信息）
@ApiModelProperty("所属行业字典（支持多选ID逗号分隔）")
```

#### 5. 类 Javadoc（DTO/VO/PO 推广）

DTO/VO/PO 原本项目习惯不加类 Javadoc，但 §0 明确“**接口契约**”型需要 Javadoc。考虑 Controller / Service / Mapper / Component 实现都是“服务”类，而 DTO/VO/PO 是“**数据契约**”类，建议加：

```java
/**
 * 经营范围详情 VO。
 *
 * <p>对外暴露的经营范围完整信息，包含审计字段（创建/更新时间），但不包含
 * 持久层敏感字段（如 deleted / create_user / update_user）。</p>
 */
```

不强制（未加进 code-review-checklist），但 Controller 传参 / 跨服务 Feign 接收参数时类 Javadoc 能帮助理解。

#### 关联规则

- SKILL.md §7 + §10（PO 不可泄漏）
- `code-review-checklist.md` §7（加了 2 条新检查项）
- §11 BeanCopyUtils copyList 模式（本案例 `BeanCopyUtils.copyList(list, OperatingScopeVO::new)` 复用 §11 决策表）


### 13. DTO 边界跨端同步：后端 `@Validated` ↔ 前端 `FormRules`（V20260914）

> 来源：`OperatingScopeSaveDTO` 后端加了 `@Validated` 校验后，前端 `businessScope` 页面两处表单（`BusinessScopeModal.vue` 弹窗 + `index.vue` 内联编辑）未同步对齐，发现 5 处不一致（V20260914）。

#### 违规清单（5 处）

| # | 位置 | 前端原值 | 后端边界 | 问题 |
|---|---|---|---|---|
| 1 | `BusinessScopeModal.vue` formRules | `max: 50`（name）| `@Size(max=100)` | 前端过严，用户输 60 字符会被前端拒，后端其实允许 |
| 2 | `BusinessScopeModal.vue` formItems | `maxlength: 50`（name）| `@Size(max=100)` | 同上，浏览器原生限制错 |
| 3 | `BusinessScopeModal.vue` formItems | `maxlength: 200`（description）| `@Size(max=500)`（remark）| 前端过严 |
| 4 | `BusinessScopeModal.vue` formItems | 无 maxlength（businessScope）| `@Size(max=1000)` | **完全未限制**，可粘贴任意长文本 |
| 5 | `index.vue` scopeText | 无 maxlength | `@Size(max=1000)` | 同上 |

外加两处 `formRules` 逻辑重复：弹窗 + 内联编辑各自定义 `name` 规则（完全相同的 2 条），后端改边界后两处都会源。

#### 为什么必须跨端同步

1. **后端边界是“最大允许”，前端必须≥后端边界**：`@Size(max=100)` 表示后端允许 0-100 字符，前端 `maxlength: 50` 是人为过严，用户输 80 字符前端拒、后端放行——体验不一致
2. **前端 maxlength 是“输入限位”、rule 是“提交校验”**：两者必须与后端对齐才能在“输入”与“提交”两个节点都报中文 message
3. **DTO 在前端多个表单复用**（弹窗 / 内联编辑 / Drawer / 查询表单），重复定义规则会漂移，必须抽公共文件

#### 正确做法：共享 `utils/validation.ts`

**`pages/businessScope/utils/validation.ts`**（新文件，与后端 DTO 边界常量一一对齐）：

```ts
import type { FormRules } from "element-plus"

// 后端 OperatingScopeSaveDTO 常量
export const BUSINESS_SCOPE_NAME_MAX = 100          // @Size(max=100)
export const BUSINESS_SCOPE_REMARK_MAX = 500         // @Size(max=500)
export const BUSINESS_SCOPE_DESCRIPTION_MAX = 1000   // @Size(max=1000)

export const businessScopeFormRules: FormRules = {
  name: [
    { required: true, message: "请输入名称", trigger: "change" },
    { max: BUSINESS_SCOPE_NAME_MAX, message: `名称不能超过 ${BUSINESS_SCOPE_NAME_MAX} 个字符`, trigger: "change" }
  ],
  description: [
    { max: BUSINESS_SCOPE_REMARK_MAX, message: `备注不能超过 ${BUSINESS_SCOPE_REMARK_MAX} 个字符`, trigger: "change" }
  ],
  businessScope: [
    { max: BUSINESS_SCOPE_DESCRIPTION_MAX, message: `经营范围描述不能超过 ${BUSINESS_SCOPE_DESCRIPTION_MAX} 个字符`, trigger: "change" }
  ]
}
```

**两处表单复用**：

```vue
<!-- BusinessScopeModal.vue -->
<script setup>
import { businessScopeFormRules, BUSINESS_SCOPE_NAME_MAX, ... } from "../utils/validation"
const formRules = businessScopeFormRules
const formItems = [
  { prop: "name", maxlength: BUSINESS_SCOPE_NAME_MAX, ... },
  { prop: "description", maxlength: BUSINESS_SCOPE_REMARK_MAX, ... },
  ...
]
</script>
```

```vue
<!-- index.vue -->
<script setup>
import { businessScopeFormRules, BUSINESS_SCOPE_NAME_MAX, ... } from "./utils/validation"
const editRules: FormRules = businessScopeFormRules
</script>

<template>
  <el-input v-model="editForm.name" :maxlength="BUSINESS_SCOPE_NAME_MAX" />
  <el-input v-model="editForm.description" :maxlength="BUSINESS_SCOPE_REMARK_MAX" />
  <el-input v-model="scopeText" :maxlength="BUSINESS_SCOPE_DESCRIPTION_MAX" />
</template>
```

#### 字段名错位（前端字段名 ≠ 后端 DTO 字段名）

`OperatingScopeSaveDTO` 后端用 `remark` / `businessScopeDescription`，前端习惯用 `description` / `businessScope`。校验文件里加注释明确映射，防止后人修改时改错。

#### `@NotBlank` vs `required: true` 语义差异（隐藏 gap）

后端 `@NotBlank` 拒绝三种值：`null` / 空字符串 `""` / **纯空白 `"   "`**。
Element Plus `required: true` 只拒绝 `null` / `undefined` / 空字符串，**纯空白字符串会通过**。

后果：用户输入 `"   "`（3 个空格）→ 前端提交校验通过 → 后端抛 `@NotBlank` 失败 → 用户看到大白话“名称不能为空”，但前端已经让 submit 走了一步，体验割裂且调用栈难追。

**修复**：抽 `requiredNotBlank` validator 工厂代替 `required: true`：

```ts
// utils/validation.ts
export function requiredNotBlank(message: string, trigger: FormItemRule["trigger"] = "change"): FormItemRule {
  return {
    required: true,
    validator: (_rule, value, callback) => {
      if (value === null || value === undefined || String(value).trim().length === 0) {
        callback(new Error(message))
      } else {
        callback()
      }
    },
    trigger
  }
}

// 使用
export const businessScopeFormRules: FormRules = {
  name: [
    requiredNotBlank("请输入名称"),   // ❌ { required: true, ... } 接受纯空白
    { max: BUSINESS_SCOPE_NAME_MAX, message: `名称不能超过 ${BUSINESS_SCOPE_NAME_MAX} 个字符`, trigger: "change" }
  ]
}
```

**检测脚本**（扫前端是否还有纯 `required: true` 用法）：

```bash
grep -rEn "\\{\\s*required:\\s*true" --include="*.vue" --include="*.ts" packages/
```

每条命中的 `required: true` 都需检查：后端该字段是否用 `@NotBlank`，是 → 改 `requiredNotBlank`；后端用 `@NotNull`（接受空串）→ 保留 `required: true`。

#### 交付检查表（5 条 checklist）

后端加 `@Validated` 后同步前端时逐条检查：

1. **边界值是否相同**：后端 `@Size(max=100)` → 前端 `max: 100`（不能 50 也不能 200）
2. **是否加到所有表单项**：同一 DTO 的弹窗 / 内联编辑 / Drawer 都要同步，不能漏
3. **是否加 `maxlength` 属性**：`maxlength` 是浏览器原生限制、`rules` 是提交前校验，两者都要
4. **是否抽公共文件**：两份以上表单必须共享 `FormRules`
5. **字段名映射是否清晰**：前端字段名 ≠ 后端字段名时必须在 validation.ts 里加注释
6. **语义是否对齐**：后端 `@NotBlank` 不能用 Element Plus 的 `required: true` 代替（`required` 接受纯空白）；必须用 `requiredNotBlank` validator 工厂

#### 关联规则

- SKILL.md §7 DTO/VO 评审 + `code-review-checklist.md` §7（加了「DTO 边界跨端同步」检查项）
- 后端 `@Validated` 启用见本 skill §7 校验注解条目 + `code-review-checklist.md` §1 Controller 评审（`@Validated`）
- §12 OperatingScope DTO/VO/PO 案例——本案例是 §12 补位案例，原 §12 仅改后端、未追前端


### 14. Component 层契约信任：DTO 默认值 + Mapper contract 不再防御（V20260914）

> 来源：`OperatingScopeServiceImpl.pageOperatingScope` 在 DTO 已有默认值 + `@Min` 校验 + PageHelper contract 保障的情况下，重复做 `dto.getPageNum() == null ? 1 : Math.max(1, ...)` 与 `records == null ? Collections.emptyList() : records` 防御，违反"信任契约"原则（V20260914）。

#### 反面案例（OperatingScopeServiceImpl.pageOperatingScope 原状）

```java
@Override
public PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto) {
    // PageHelper.startPage(...) 自动完成 count + 追加 LIMIT；SQL 本身不带 LIMIT，
    // 不走 MyBatis-Plus 分页拦截器，避免 JSqlParser 4.x 触发的 AST toString 自递归 StackOverflowError。
    int pageNum = dto.getPageNum() == null ? 1 : Math.max(1, dto.getPageNum());
    int pageSize = dto.getPageSize() == null ? 10 : Math.max(1, dto.getPageSize());
    PageHelper.startPage(pageNum, pageSize);
    List<OperatingScopePageVO> records = baseMapper.pageOperatingScope(dto);
    long total = ((Page<OperatingScopePageVO>) records).getTotal();
    return new PageResult<>(total, records == null ? Collections.emptyList() : records);
}
```

#### 三处冗余

| # | 冗余代码 | 为什么冗余 |
|---|---|---|
| 1 | `dto.getPageNum() == null ? 1 : ...` | DTO 字段已有 `private Integer pageNum = 1;` 默认值；`@Min(1)` 在 Controller `@Validated` 阶段已拒绝 `< 1`；DTO + `@Validated` 是契约层，Component 不再二次兜底 |
| 2 | `Math.max(1, dto.getPageNum())` | 同上：`@Min(1)` 保证 `pageNum >= 1`；Component 层不需要夹一道 |
| 3 | `records == null ? Collections.emptyList() : records` | PageHelper contract：`startPage` 后下一次查询结果必为 `com.github.pagehelper.Page<T>`（继承 `ArrayList`），**绝不为 null**；该分支是死代码 |

#### 判定为反模式的 3 个特征

1. **Component 层职责越界**：Component 是数据访问层，入参校验归 Controller + DTO（`@Validated`）；Component 重复校验 = 把 Controller 的活重做一遍，且**校验时机已晚**（应该在校验注解失败时抛大白话，Component 层抛则是底层异常翻译）
2. **代码膨胀但实质信息量=0**：5 行防御代码全部命中契约层已经覆盖的场景，没有任何新增保护
3. **违反"信任契约"原则**：DTO 字段默认值 + Bean Validation 是项目标准入参防御；PageHelper / MyBatis-Plus / MP BaseMapper 各自有明确的 contract，Component 层必须信任，否则每层都做"防御性兜底"，最终谁也不信谁，Diff 噪音爆炸

#### 正面做法（OperatingScopeServiceImpl.pageOperatingScope 修复后）

```java
@Override
public PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto) {
    // PageHelper.startPage(...) 自动完成 count + 追加 LIMIT；SQL 本身不带 LIMIT，
    // 不走 MyBatis-Plus 分页拦截器，避免 JSqlParser 4.x 触发的 AST toString 自递归 StackOverflowError。
    // DTO 默认值 (pageNum=1, pageSize=10) + @Min(1) 校验已覆盖边界；PageHelper contract 保证 records 非 null。
    PageHelper.startPage(dto.getPageNum(), dto.getPageSize());
    List<OperatingScopePageVO> records = baseMapper.pageOperatingScope(dto);
    long total = ((Page<OperatingScopePageVO>) records).getTotal();
    return new PageResult<>(total, records);
}
```

5 行变 4 行（注释变 1 行），实际可执行代码从 7 行缩到 4 行，零信息丢失。

#### 五类典型反模式扫描清单

| 反模式 | 出现位置 | 为什么错 |
|---|---|---|
| `dto.getXxx() == null ? defaultVal : ...`（DTO 字段已有 `= defaultVal`）| Component / Service 任何入参处理 | DTO 默认值兜底 |
| `Math.max(MIN, dto.getXxx())` / `Math.min(MAX, dto.getXxx())`（DTO 已有 `@Min` / `@Max`）| 同上 | `@Validated` 兜底 |
| `records == null ? Collections.emptyList() : records`（PageHelper / MP `page()` 后）| Component 分页方法 | PageHelper contract 保障非 null |
| `if (list == null) list = new ArrayList<>();`（MP `lambdaQuery().list()` 后）| 同上 | MP `list()` 返空 `ArrayList`，不返 null |
| `if (count == null) count = 0L;`（PageHelper / MP `count()` / `total` 后）| 同上 | PageHelper `getTotal()` 返 `long`（基本类型）不返 null |

**审查硬指标**：
```bash
# 扫"DTO 字段已有默认值但 Component 层又兜底"的反例
grep -rEn "dto\.get\w+\(\)\s*==\s*null\s*\?" bi-cashier-{component,service}/src/main/java/

# 扫"PageHelper 后置调用还做 null 兜底"的反例
grep -rEn "(records|list|result)\s*==\s*null\s*\?" bi-cashier-{component,service}/src/main/java/

# 扫"MP lambdaQuery().list() 后又空集合兜底"的反例（合规代码直接用结果即可，§8 要求空集合走 Collections.emptyList()，但前提是判断 list 本身）
grep -rEn "list\s*==\s*null\s*\?\s*Collections\.emptyList\(\)" bi-cashier-{component,service}/src/main/java/
```

#### 关联规则

- SKILL.md §7（API 入参对象化）+ §8（Service / Helper 入参对象化）—— DTO 是契约层，Component 不重复校验
- `mybatis-vs-xml.md §1` 决策表 — PageHelper 模式详见 §1
- SKILL.md §9（分页 PageResult 泛型链路对齐）— 本案例是该规则在 Component 层的补位案例
- `code-review-checklist.md §3` Component Service 评审 — 本案例加了「Component 不重检 DTO 默认值与校验注解」检查项


