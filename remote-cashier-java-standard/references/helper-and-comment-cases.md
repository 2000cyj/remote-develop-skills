# helper-and-comment-cases — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

### 19. 实现类 `@Override` 方法不加方法 Javadoc：3 个 StoreAuditOnboarding Impl 的 21 处违规（V20260916 新增）

> 来源：`StoreAuditOnboardingApplicationServiceImpl` / `CompanyServiceImpl` / `StoreServiceImpl` 3 个 Impl 类（2026-09-16）。原文件每个 `@Override` 方法上都加了 `/** {@inheritDoc} */` 或 IDE 风格的"实现要点"型 Javadoc——**冗余**，接口已有完整 Javadoc（参见 §0），Impl 重复写一遍不增加任何信息，反而拖维护。

#### 量化整改

| 文件 | `@Override` 方法数 | 修正前 `@Override` 上方 Javadoc 数 | 修正后 |
|------|---|---|---|
| `StoreAuditOnboardingApplicationServiceImpl.java` | 7 | 7（5 处 `{@inheritDoc}` + 2 处带"实现要点/软删字段"附注）| 0 |
| `StoreAuditOnboardingCompanyServiceImpl.java` | 5 | 5 | 0 |
| `StoreAuditOnboardingStoreServiceImpl.java` | 9 | 9 | 0 |
| **合计** | **21** | **21** | **0** |

#### 反面案例（21 处之一）

```java
// ❌ 场景 1：裸 `{@inheritDoc}` 占位符反模式
/**
 * {@inheritDoc}
 */
@Override
public String generateUniqueValue() {
    String date = LocalDate.now().format(DATE_FORMATTER);
    return UNIQUE_VALUE_PREFIX + IDUtils.getId(date, UNIQUE_VALUE_TYPE);
}

// ❌ 场景 2：{`@inheritDoc`} + 附加"实现要点"同样是违规——接口已写完整语义，Impl 重复写一遍仍为零增量
/**
 * {@inheritDoc}
 *
 * <p>实现要点：CAS 比较列 + 一次性 set 全部新字段 + 版本号自增 SQL；
 * 没有事务注解——单条 UPDATE 不需要事务；如调用方在同一事务内调用，
 * 由聚合层通过 {@code @Transactional(rollbackFor = Exception.class)} 包裹。</p>
 */
@Override
public int casAdvanceStatus(StoreAuditOnboardingAdvanceStatusDTO req) {
    ...
}

// ❌ 场景 3：试图补"实现理由"——理由应放私有 helper Javadoc，不应放 @Override 方法头上
/**
 * {@inheritDoc}
 *
 * <p>本表已有软删除字段 {@code deleted}，但调用方（仅"草稿状态"才允许删除）决定走
 * 物理删除以彻底级联清理子表，理由见 {@code StoreAuditOnboardingManageServiceImpl#delete}。</p>
 */
@Override
public int deleteByUniqueValue(String uniqueValue) {
    ...
}
```

#### 正面做法（修复后）

```java
// ✅ 实现类 @Override 方法：裸签名，无任何方法 Javadoc
@Override
public String generateUniqueValue() {
    String date = LocalDate.now().format(DATE_FORMATTER);
    return UNIQUE_VALUE_PREFIX + IDUtils.getId(date, UNIQUE_VALUE_TYPE);
}

@Override
public int casAdvanceStatus(StoreAuditOnboardingAdvanceStatusDTO req) {
    ...
}

@Override
public int deleteByUniqueValue(String uniqueValue) {
    ...
}

// ✅ 自定义 helper：保留 Javadoc 说明业务规则（与 @Override 方法的"裸签名"明确区分）
/**
 * V2.0.1：审核员通过时把已分配主体写入 onboarding_store 子表。
 *
 * <p>子表行已由 {@link #create} / {@link #update} 在草稿/驳回态插入（{@code company_id} 等为 NULL）。
 * 本方法按 rowNo 升序取出子表行，把传入的主体条目依次写入到前 N 行。</p>
 */
private void writeAssignedCompaniesToSubTable(StoreAuditOnboardingWriteAssignedContext ctx) {
    ...
}
```

#### 判断口径（何时用哪种注释）

| 位置 | 是否加 Javadoc | 说什么 |
|------|--------------|------|
| 接口方法（`IXxxService` / `IXxxManageService`） | **必须**加 | 业务语义 + 入参/出参 + 异常场景（参见 §0）|
| Impl `@Override` 方法 | **禁止**加 | 裸签名即可；如需"实现理由"放私有 helper Javadoc |
| Impl 自定义 helper（`private` / `static`） | **必须**加 | 业务规则、why、与其它 helper 的依赖、潜在限制 |
| Impl 类级别（类名上方） | **必须**加 | 整个类的职责（与 §0 interface 类级别规则一致）|

#### 为何不让 Impl 写 `@Override` 方法 Javadoc

1. **冗余无增量**：接口已写完整 Javadoc（业务语义、入参约束、返回值、异常），Impl 重复写一遍不增加任何信息
2. **维护负担**：接口改了 Javadoc，Impl 的 Javadoc 必须同步改——双倍维护成本
3. **`{@inheritDoc}` 是反模式**：IDE 自动生成的占位符，没有任何语义价值；读者点进 Impl 看不到任何实现细节说明
4. **隐藏"为什么"在 helper**：业务约束应该在 helper 方法里（因为 helper 是私有的、只在本类里被调用），而不是 public 接口（接口只承诺契约）
5. **"代替"型表达习惯反模式**：现有代码习惯上写 `{@inheritDoc}` 是为了跨 interface × implementation 在 javadoc 上"显得一致"——但实现类里读者需要的不是与 interface 一样的描述，而是这个实现版本的额外信息（调用顺序、与 helper 的依赖、潜在限制等）。这些信息要么放在代码逻辑本身（`// 1. xxx` 阶段化注释，参见 §6），要么写在私有 helper 的 Javadoc 里，不应该贴在 public `@Override` 方法头上

#### 审查硬指标

```bash
# 1. 扫所有 Impl 文件 @Override 方法上方是否还有 /** ... */ 紧邻（违规）
grep -rEn "@Override" bi-cashier-{component,service}/src/main/java/com/obo/bi/cashier/**/impl/*.java \
  | while IFS=: read -r file line _; do
      # @Override 上一行是 */，或上上一行是 /**（无其他代码）→ 违规
      if sed -n "$((line-1))p" "$file" | grep -qE "^\s*\*\*/\s*$"; then
        echo "$file:$line @Override 上方有 Javadoc 结束符（违规）"
      fi
      if sed -n "$((line-2))p" "$file" | grep -qE "^\s*/\*\*"; then
        echo "$file:$line @Override 上方有 Javadoc 起始符（违规）"
      fi
    done

# 2. 扫 {@inheritDoc} 残留（最常见的反模式）
grep -rn "{@inheritDoc}" bi-cashier-{component,service}/src/main/java/ --include="*.java"

# 3. 配套必查：自定义 helper 必须有 Javadoc
grep -nE "^    private\s+(static\s+)?[\w<>,\[\]?\s]+\s+\w+\s*\(" bi-cashier-{component,service}/src/main/java/com/obo/bi/cashier/**/impl/*.java \
  | while IFS=: read -r file line match; do
      if ! sed -n "$((line-1))p" "$file" | grep -qE "^\s*\*\*/\s*$" && \
         ! sed -n "$((line-2))p" "$file" | grep -qE "^\s*/\*\*"; then
        echo "$file:$line private helper 无 Javadoc（违规）"
      fi
    done
```

#### 关联规则

- `SKILL.md` §0「接口（interface）注释规范」— 本案例是 §0 的配套（接口必带 Javadoc，Impl @Override 必不带 Javadoc）
- `references/coding-quality.md` 「注释规范」章节 — Javadoc 风格的字面规则
- `SKILL.md` §6 方法体内部规范（阶段化注释）— 实现理由的替代承载
- `SKILL.md` 红线 — 「禁止实现类 @Override 方法上加方法 Javadoc」条目

### 20. 1-调用私有 helper 反模式全集：StoreAuthorizationManageServiceImpl 案例（V20260929 新增）

**黄金原则**（先于案例看这条）：

> **不要为只使用一次的方法抽 helper，除非那个方法真的特别长（≥ 30 行）或特别绕。**
>
> 写完第一版后看到「这个 5 行只服务 1 处调用」的方法 → 第一反应应该是「能不能直接内联」而不是「这个方法叫什么名字好」。

**反面案例**（店铺授权管理第一版一口气写出 5 个 1-调用私有 helper，全部是「名字像做事、身体没做事」的套壳）：

| # | helper 名 | 反模式 | 调用方数 | 处置 |
|---|-----------|--------|----------|------|
| 1 | `toStorePageVO(Store)` | BeanCopy 套壳（3 行 `new + copy + return`） | 1 | 内联 `BeanCopyUtils.copy(store, StorePageVO::new)` 1 行 |
| 2 | `toStorePageDTO(...)` | DTO→DTO 5 字段 1:1 setXxx 复制 | 1 | 内联 `BeanCopyUtils.copy(dto, StorePageDTO::new)` 1 行（BeanUtils.copyProperties 按属性名拷贝，target 独有字段保持 null = "不加筛选条件"） |
| 3 | `resolvePlatformName(p)` | 函数名暗示字典翻译，实际 body 只 return 原值 | 1 | 函数 + setXxx 调用一起删，VO 字段保持 null |
| 4 | `matchAggregateStatusFilter(row, filters)` | 纯 filter 4 行检查只服务 1 个 for 循环的 continue 判断 | 1 | filter 局部变量提到 for 外，逻辑下沉到循环体 |
| 5 | `generateUniqueValue()` | 2 行 ID 生成只服务 1 处 setUniqueValue | 1 | 内联 2 行到 `if (isInsert)` 块 |

**反面与正面对比**（节选 1 个代表）：

```java
// ❌ 反例 2：DTO→DTO 字段复制
private StorePageDTO toStorePageDTO(StoreAuthorizationPageDTO dto) {
    StorePageDTO r = new StorePageDTO();
    r.setPageNum(dto.getPageNum());
    r.setPageSize(dto.getPageSize());
    r.setStoreCode(dto.getStoreCode());
    r.setStoreName(dto.getStoreName());
    if (CollUtils.isNotEmpty(dto.getPlatforms())) r.setPlatforms(dto.getPlatforms());
    return r;
}

// ✅ 正例：BeanCopyUtils 一行解决
StorePageDTO storeDto = BeanCopyUtils.copy(dto, StorePageDTO::new);
// StoreMapper.xml 里 companyIds/departmentIdList 等都是 <if test="!=null and size()>0">
// → 源 DTO 没传的字段保持 null = "不加筛选条件"，语义一致
```

**事后教训**（写第一版时不该犯的）：

1. **看到 DTO 字段一一对应，就写 `setX(getX)` 复制**，没意识到 BeanUtils.copyProperties 就是干这个的
2. **函数名 "resolve / translate / convert / map / format / to / build" 是诱饵**，写时脑子默认它在做事，实际 body 只有 `return xxx` —— 该直接断言它没做事并删
3. **任何「只服务 1 个调用方 + 方法体 ≤ 3 行 + 无业务规则解析」的私有 helper 都是反例候选**，该内联不该留

**判定信号**（**3 条全满足**才保留）：

1. 内部有真业务逻辑（不是单纯 filter / map / collect / 赋值护环）
2. 至少 2 个调用方
3. 语义无法用 1-3 行业务代码内联表达

**关联规则**：

- `references/code-structure.md` §8.5「未使用代码剔除」— 0 调用 helper 处置
- `references/code-structure.md` §8.6「方法简化」— §8.6 表格已列出一判断 / 一调用 / 取列表第一个 / wrapper / 死方法等 6 类，本案例为 §8.7 补充 5 类（BeanCopy 套壳 / DTO 字段复制 / 名字撒谎 stub / 纯 filter / ID 生成）
- `references/code-structure.md` §8.7「2026-09 新增 5 类反例」— 完整代码示例
- `SKILL.md` §13.6「方法简化」+ `SKILL.md` §7「禁止简单数据筛选赋值 wrapper helper」— 同一原则的早期沉淀
- `references/code-review-checklist.md` §9「自检 quick 命令」— 新增扫 1-调用 wrapper 的 grep

---

## 红线（必须遵守）

> 任何"已构建通过" / "编译验证完成" / "已通过编译" 的声明，**必须**附可重放的证据。**首选 `IDEA MCP execute_terminal_command` 跑 `mvn install -pl 4 模块 -am`**，拿 `BUILD SUCCESS` 段与 4 模块 SUCCESS 列表进报告。
>
> 仅凭 `mcp__idea__execute_tool build_project` 返回 `{isSuccess: true, problems: []}` **不**构成编译通过的证据。详见 §21 / §22 编译验证。
>
> **当轮 edit 后必须用 IDEA MCP 跑真 mvn install**——不允许推到下一轮。发现漏跑时，响应开头明写"本轮漏跑 §22 验证，已补跑：<结果>"。

