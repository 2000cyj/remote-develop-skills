# data-access-cases — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

### 17. BankCard 三层架构整改：MP 与 XML 软删规则必须分类对待（V20260915 错例）

> 来源：`BankCardServiceImpl` / `BankCardMapper.xml` 重构（2026-09-15）。错误地将 §15「MP Lambda 自动加 `WHERE deleted = 0`」规则推广到 Mapper XML，导致 XML 里删除了 `WHERE deleted = 0`，严重违规。后修复并补充 §15 警示与判定表。

#### 错误路径（agent 第一轮 sweep）

```java
// BankCardServiceImpl.java — 这一步是正确的（MP 自动加）
List<BankCard> list = this.lambdaQuery()
        .orderByDesc(BankCard::getCreateTime)
        .list();  // 无 .eq(getDeleted, 0)

// BankCardMapper.xml — 这一步是错误的（XML 必须手写）
<select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">
    SELECT ... FROM cashier_bank_card
    WHERE 1 = 1   <!-- ❌ 错误：应该 WHERE deleted = 0 -->
    ...
</select>

// ❌ 错误 1：countByAccountNumber 不该走 XML（单表非分页应走 MP Lambda）
// ❌ 错误 2：且还漏了 deleted = 0（双重错）
<select id="countByAccountNumber" resultType="java.lang.Integer">
    SELECT COUNT(*) FROM cashier_bank_card
    WHERE account_number = #{accountNumber}
</select>
```

#### 错误本质

`§15 @TableLogic 自动行为一览` 表里明确区分了：

| 调用形式 | MP 是否自动加 `WHERE deleted = 0` |
|---|---|
| `lambdaQuery()` / `baseMapper.xxx()` | ✅ 自动 |
| **XML `<select>`** | **❌ 不自动，必须手写** |

agent 执行 sweep 时看到 Component 层“都删了 `.eq(getDeleted, 0)`”正确，就顺手把 XML 里 `WHERE deleted = 0` 也删了——**两条规则方向相反，但被当成同一条处理**。

#### 错误后果

- **查询接口**：XML 不加 `deleted = 0` → `pageBankCard` 返回软删记录 → 前端列表看到已删除银行卡
- **统计接口**：`countByAccountNumber` 不加 `deleted = 0` → “该账号已存在”误判可能让软删账号后被补不进冱（**V20260915 重构**：该方法本身已从 Mapper 迁移到 Component Service `this.count(LambdaQueryWrapper)`，本条作为历史教训保留）
- **上生产后果**：数据泄露 / 唯一约束冲突 / “删了的卡竟在列表里点开还报错”

#### 修复路径（正确状态）

```xml
<!-- BankCardMapper.xml — 保留 WHERE deleted = 0 -->
<select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">
    SELECT ... FROM cashier_bank_card
    WHERE deleted = 0   <!-- ✅ 必需，手写 -->
    <if test="dto.accountName != null and dto.accountName != ''">
        AND account_name LIKE CONCAT('%', #{dto.accountName}, '%')
    </if>
    ...
</select>
```

> **V20260915 重构更新**：原错例里同时出现的 `countByAccountNumber` XML 已**整体从 Mapper 接口/XML 移除**——单表非分页统计走 Component Service 的 MP Lambda，不在 Mapper 里声明该方法。**最终正确写法**：

> **V20260915 重构更新**：上述 `countByAccountNumber` XML 写法是错误路径里的历史快照。**最终正确写法是走 MP Lambda**（单表非分页不是 XML 场景）：

```java
// BankCardServiceImpl.java — 唯一性统计走 MP Lambda
@Override
public void validateAccountNumberUnique(String accountNumber, Long excludeId) {
    LambdaQueryWrapper<BankCard> wrapper = new LambdaQueryWrapper<BankCard>()
            .eq(BankCard::getAccountNumber, accountNumber);   // @TableLogic 自动加 WHERE deleted = 0
    if (excludeId != null) {
        wrapper.ne(BankCard::getId, excludeId);
    }
    if (this.count(wrapper) > 0) {
        log.warn("银行卡账号重复 accountNumber={}, excludeId={}", accountNumber, excludeId);
        throw new BusinessException("该银行账号已存在，无法重复提交");
    }
}
```

```java
// BankCardServiceImpl.java — 业务键软删走 remove() 不用 lambdaUpdate().set(getDeleted,1)
@Override
public Boolean deleteBankCard(String accountNumber) {
    boolean ok = this.remove(new LambdaQueryWrapper<BankCard>()
            .eq(BankCard::getAccountNumber, accountNumber));   // MP 自动转 UPDATE ... SET deleted = 1
    if (!ok) {
        log.warn("银行卡删除未生效 accountNumber={}", accountNumber);
    }
    return ok;
}
```

#### 错误模式识别（评审必扫）

| 反例 | 错误本质 | 推荐走法 |
|---|---|---|
| XML `<select>` 删 `WHERE deleted = 0` | 以为 MP 自动加，实际不加 | 保留手写条件 |
| Component Service 保留 `.eq(getDeleted, 0)` | MP 自动加是冗余 | 删除 |
| Component Service 写 `lambdaUpdate().set(getDeleted, 1).eq(...).update()` | MP 不自动 .set(getDeleted, 1)，这是手工软删逆了 | 走 `this.remove(LambdaQueryWrapper)` |
| XML `<update>` 软删不写 `SET deleted = 1` | XML 需手写 | 加 `SET deleted = 1` |
| **agent sweep 时一刀切** | 看到一条规则推广到所有场景 | 看表上对应行，不要推广 |

#### 检测脚本（提交前必跑）

```bash
# 1. 验证 XML 中删除条件都在
for xml in bi-cashier-web/src/main/resources/mapper/*.xml; do
    grep -L "deleted = 0" "$xml" && echo "⚠️ $xml 未含 WHERE deleted = 0，检查是否纯业务表"
done

# 2. Component 层残留 lambdaUpdate + set(getDeleted, 1) — 应0 命中
grep -rEn "lambdaUpdate\(\)" bi-cashier-component/src/main/java/ -A 4 --include="*.java" \
  | grep -E "\.set\([A-Za-z]+::getDeleted,\s*1\)" \
  && echo "⚠️ 发现 lambdaUpdate 手工软删违规" || echo "✅ 无违规"

# 3. Component 层残留 .eq(getDeleted, 0) — 应0 命中
grep -rEn "\.eq\([A-Za-z]+::getDeleted,\s*0\)" bi-cashier-component/src/main/java/ --include="*.java" \
  && echo "⚠️ 发现冗余 eq(getDeleted, 0)" || echo "✅ 无冗余"
```

#### 关联规则

- SKILL.md §15（PO 继承 BaseEntity，@TableLogic 自动行为）— 本案例是 §15 补充与推广。反例。
- SKILL.md §15 表后补充的「⚠️ MP Lambda vs XML 手动 SQL」警示 — 本案例是这个警示的根源。
- `references/data-model-sql.md §1.2` 软删除约定 — 需补充 MP 与 XML 分类条款。
- `references/code-review-checklist.md §3` — 加检查项「XML 手写 SQL 不许删 WHERE deleted = 0」。


### 18. 数据级唯一性：Component 层抛业务异常，Manage 层仅调用（V20260915 错例）

> 来源：`BankCardServiceImpl.isAccountNumberExists` + `BankCardManageServiceImpl` 重构（2026-09-15）。原写法 Component 返回 `Boolean`、Manage 判后 `throw`，违反 `references/concerns-separation.md §4`「数据级唯一性由 Component 层抛业务异常」。

#### oboJava 明确说过的 3 条规则

| # | 文档 | 原文 / 措辞 | 含义 |
|---|---|---|---|
| 1 | `references/data-model-sql.md §8「表设计常见示例」` | 「`cashier_bank_card` 的 `account_number` 只有 `idx_account_number`（普通索引），**没有 UNIQUE 约束**。唯一性靠 `BankCardManageServiceImpl` 调用 `isAccountNumberExists(accountNumber, excludeId)` 做应用层判重。」 | DB 不约束业务唯一性，靠应用层判重 |
| 2 | `references/concerns-separation.md §4「业务规则放置位置」` | 「**数据级唯一性**（业务要求唯一但 DB 不约束） | **Component 层抛业务异常** | `if (countByStoreCode(code, excludeUniqueValue) > 0) throw new BusinessException("编码已存在")`」 | 判重逻辑在 Component，且 Component 抛异常 |
| 3 | `references/mybatis-vs-xml.md §1 决策表` | 「**带可选 `excludeId` 的唯一性统计** | **MP Lambda `this.count(LambdaQueryWrapper)`** \| 1-2 个等值/不等值条件 + 可选 excludeId → `wrapper.eq(业务键).ne(ExcludedId)` 链式即可」 | 单表非分页统计走 Component Service 层 MP Lambda，不在 Mapper 接口里声明 `countByXxx` |

#### 错误路径（BankCard 原状）

```java
// BankCardServiceImpl.java — 原写法：返 Boolean + 走 XML countByAccountNumber（违反两条规则）
//   错 1：走 XML（单表非分页应走 MP）
//   错 2：返 Boolean + Manage 抛（应 Component 抛）
@Override
public Boolean isAccountNumberExists(String accountNumber, Long excludeId) {
    return baseMapper.countByAccountNumber(accountNumber, excludeId) > 0;
}

// BankCardManageServiceImpl.java — Manage 层判后 throw
public String addBankCard(BankCardSaveDTO dto) {
    if (bankCardService.isAccountNumberExists(dto.getAccountNumber(), null)) {
        log.warn("银行卡新增账号重复 accountNumber={}", dto.getAccountNumber());
        throw new BusinessException("该银行账号已存在，无法重复提交");
    }
    // ... 业务逻辑
}

public Boolean updateBankCard(BankCardSaveDTO dto) {
    if (dto.getId() == null) {
        throw new BusinessException("修改银行卡时记录ID不能为空");
    }
    if (bankCardService.isAccountNumberExists(dto.getAccountNumber(), dto.getId())) {
        log.warn("银行卡更新账号重复 accountNumber={}, id={}", dto.getAccountNumber(), dto.getId());
        throw new BusinessException("该银行账号已存在，无法重复提交");
    }
    // ... 业务逻辑
}
```

**3 个问题**：
1. **职责错位**：Component 返 boolean，Manage 抛异常 → 判重与报错不在同一层，错位其他调用方重写「判 + 抛」样板代码
2. **日志重复**：两处 `log.warn` + 两处 `throw` 是同样文案，重复定义
3. **API 表面误导**：`isAccountNumberExists` 返 Boolean 谎调者误以为该方法**不**抛异常，调用者必须包 try-catch 或判后手动抛

#### 修复路径（Component 层抛、Manage 层只调用）

```java
// BankCardServiceImpl.java — void + 内部 throw + log.warn + 走 MP Lambda
@Override
public void validateAccountNumberUnique(String accountNumber, Long excludeId) {
    LambdaQueryWrapper<BankCard> wrapper = new LambdaQueryWrapper<BankCard>()
            .eq(BankCard::getAccountNumber, accountNumber);   // @TableLogic 自动加 WHERE deleted = 0
    if (excludeId != null) {
        wrapper.ne(BankCard::getId, excludeId);
    }
    if (this.count(wrapper) > 0) {
        log.warn("银行卡账号重复 accountNumber={}, excludeId={}", accountNumber, excludeId);
        throw new BusinessException("该银行账号已存在，无法重复提交");
    }
}

// BankCardManageServiceImpl.java — Manage 简化
public String addBankCard(BankCardSaveDTO dto) {
    // 账号唯一性由 Component 层抛异常，Manage 不再判
    bankCardService.validateAccountNumberUnique(dto.getAccountNumber(), null);
    BankCard bankCard = BeanCopyUtils.copy(dto, BankCard::new);
    // ... 业务逻辑
}

public Boolean updateBankCard(BankCardSaveDTO dto) {
    if (dto.getId() == null) {
        throw new BusinessException("修改银行卡时记录ID不能为空");
    }
    // 账号唯一性由 Component 层抛异常（更新时排除自身 ID），Manage 不再判
    bankCardService.validateAccountNumberUnique(dto.getAccountNumber(), dto.getId());
    BankCard bankCard = BeanCopyUtils.copy(dto, BankCard::new);
    // ... 业务逻辑
}
```

#### 命名规范

| 层级 | 推荐方法名 | 含义 |
|---|---|---|
| Component Service（**抛异常，推荐**） | `validateXxxUnique(业务键, excludeId)` | void，内部 `this.count(LambdaQueryWrapper.eq(业务键).ne(id, excludeId))` + `log.warn` + `throw` |
| Component Service（**返 boolean**，特例） | `isXxxExists(业务键, excludeId)` | 仅当外部业务需要区分「有 vs 无」时返 boolean，否则一律走 `validateXxxUnique` |
| **Mapper XML `countByXxx`** | **不存在** | 单表非分页走 Component Service MP Lambda，不在 Mapper 接口/XML 声明 `countByXxx` |
| Controller | `/isXxxExists` | 仅当业务上需在外部“预问存在性”时才暴露（参考 `architecture-layers.md §5 路由表`） |

**项目里默认走 `validateXxxUnique`**，不返 Boolean——避「仅查询不报错」的误用。

#### 反面案例（× N）—— 重复「判 + 抛」样板代码

```java
// ❌ 每个调用方都复制这 4 行 + 走 XML countByAccountNumber（双重反模式）
if (bankCardService.isAccountNumberExists(accountNumber, excludeId)) {
    log.warn("重复 ...");
    throw new BusinessException("该银行账号已存在，无法重复提交");
}

// ✅ 唯一调用 + 走 MP Lambda（单表非分页不在 Mapper 声明）
bankCardService.validateAccountNumberUnique(accountNumber, excludeId);
```

#### 关联规则

- `references/concerns-separation.md §4 业务规则放置位置` — 原始依据，本案例是该规则的落地版
- `references/data-model-sql.md §8 表设计常见示例` — 列个「`account_number` 需应用层判重」的背景
- `references/mybatis-vs-xml.md §1 决策表` — 单表非分页统计走 MP Lambda 的总则（**不在 Mapper 接口/XML 声明 `countByXxx`**）
- `references/code-review-checklist.md` — 加检查项「唯一性判重返 void + throw，不返 Boolean」「Mapper 接口不声明 `countByXxx` 单表非分页方法」
- SKILL.md §15 警示 + §17 错例 — 本次双错例同月同任务，防「只改一处不审全局」


