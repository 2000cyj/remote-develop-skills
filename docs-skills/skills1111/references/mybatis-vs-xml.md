# MyBatis-Plus Lambda vs 手写 XML 使用规范

本规范以 `BankCardServiceImpl` / `FileExpiryRecordServiceImpl` / `BankCardMapper.xml` / `FileExpiryRuleMapper.xml` 的实际写法为基准。与 `data-model-sql.md §6` 配合使用，本文聚焦**选择决策**，`data-model-sql.md` 聚焦**XML 语法规范**。

## 1. 选择决策表

| 场景 | 选择 | 理由 |
|------|------|------|
| 等值查询（1-4 个条件） | MP Lambda | 链式 1-5 行，无需 XML |
| 软删除（`set deleted=1`） | MP Lambda | 固定 `lambdaUpdate().set(...).eq(...).update()` |
| 批量 `IN` 查询 | MP Lambda | `.in(Xxx::getField, list)` 链式即可 |
| 按 uniqueValue 全量下拉 | MP Lambda | 1个条件 + `orderByDesc` |
| 批量 INSERT/UPDATE/DELETE | MP `saveBatch` / `updateBatchById` / `removeByIds` | BaseMapper 已生成，无需手写 |
| **5+ 个动态可选条件的分页查询** | **手写 XML** | `<if>` 组合，Lambda 嵌套过深 |
| **带可选 `excludeId` 的唯一性统计** | **手写 XML** | `<if test="excludeId != null">` 条件分支 |
| **MySQL 专有函数**（`FIND_IN_SET`、`GROUP_CONCAT`） | **手写 XML** | Lambda 无法表达 |
| **`GROUP BY + COUNT` 聚合（需下沉到 Component）** | `QueryWrapper.select + listMaps` | Lambda 无 `groupBy` 链式；结果由 Component 封装后返回，聚合层不可见 `listMaps` |
| **跨表 JOIN** | **手写 XML** | Lambda 无法跨表 |
| **NOT IN 排除已选项**（结合分页+多条件） | **手写 XML** | 与其他动态条件合并，XML 更清晰 |

**禁止用 `@Select("...")` 注解 SQL 替代 XML**——统一放 XML 文件，便于集中管理和 DBA 审查。

## 2. MP Lambda 写法示例

以下代码来自 `BankCardServiceImpl.java` 和 `FileExpiryRecordServiceImpl.java`，是允许在 Component 层使用的标准写法。

```java
// 精确查询已选账号（3 个条件 + 排序）——BankCardServiceImpl.java:55-59
List<BankCard> list = this.lambdaQuery()
        .in(BankCard::getAccountNumber, accountNumbers)
        .eq(BankCard::getDeleted, 0)
        .orderByDesc(BankCard::getCreateTime)
        .list();

// 按账号查单条——BankCardServiceImpl.java:65-67
return this.lambdaQuery()
        .eq(BankCard::getAccountNumber, accountNumber)
        .one();

// 按条件整实体 Update——BankCardServiceImpl.java:79-82
return this.lambdaUpdate()
        .eq(BankCard::getAccountNumber, bankCard.getAccountNumber())
        .update(bankCard);

// 软删除——BankCardServiceImpl.java:86-90
return this.lambdaUpdate()
        .set(BankCard::getDeleted, 1)
        .eq(BankCard::getAccountNumber, accountNumber)
        .update();

// 带可选条件（条件为 null 时自动跳过）——FileExpiryRecordServiceImpl.java:69-73
return this.lambdaQuery()
        .eq(FileExpiryRecord::getSourceUniqueValue, uniqueValue)
        .eq(sourceModule != null,
            FileExpiryRecord::getSourceModule,
            sourceModule == null ? null : sourceModule.getValue())
        .list();
```

**三参数 `.eq(condition, column, value)`**：`condition=true` 才加入条件，`condition=false` 忽略——这是 MP 动态条件的正确写法，不要用 `if` 分支拼 Wrapper。

## 3. 手写 XML 写法示例

```xml
<!-- BankCardMapper.xml：8+ 动态条件分页，使用 NOT IN 排除已选项 -->
<select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">
    SELECT id AS id, account_number AS accountNumber, ...
    FROM cashier_bank_card
    WHERE deleted = 0
    <if test="dto.accountName != null and dto.accountName != ''">
        AND account_name LIKE CONCAT('%', #{dto.accountName}, '%')
    </if>
    <if test="dto.bankCodes != null and dto.bankCodes.size() > 0">
        AND bank_code IN
        <foreach collection="dto.bankCodes" item="code" open="(" separator="," close=")">
            #{code}
        </foreach>
    </if>
    <if test="dto.openDateStart != null">
        AND open_date &gt;= #{dto.openDateStart}
    </if>
    <if test="dto.selectedAccountNumbers != null and dto.selectedAccountNumbers.size() > 0">
        AND account_number NOT IN
        <foreach collection="dto.selectedAccountNumbers" item="accountNo" open="(" separator="," close=")">
            #{accountNo}
        </foreach>
    </if>
    ORDER BY create_time DESC
</select>

<!-- BankCardMapper.xml：带可选 excludeId 的唯一性统计 -->
<select id="countByAccountNumber" resultType="java.lang.Integer">
    SELECT COUNT(*) FROM cashier_bank_card
    WHERE deleted = 0 AND account_number = #{accountNumber}
    <if test="excludeId != null">
        AND id != #{excludeId}
    </if>
</select>

<!-- FileExpiryRuleMapper.xml：FIND_IN_SET 标签匹配——MySQL 专有函数必须用 XML -->
<select id="selectByMatchTags" resultType="com.obo.bi.cashier.po.FileExpiryRule">
    SELECT * FROM cashier_file_expiry_rule
    WHERE enabled = true AND deleted = 0
      AND match_tags IS NOT NULL
      AND FIND_IN_SET(#{tag}, match_tags) > 0
    ORDER BY priority DESC
</select>
```

XML 语法详细规范（列别名、`<if>` 判空、`<foreach>` 参数、XML 实体转义）见 `data-model-sql.md §6`。

## 4. 聚合查询的特殊写法

当需要 `GROUP BY + COUNT` 时，在 Component 层用 `QueryWrapper + listMaps`，不用 `new LambdaQueryWrapper`：

```java
// FileExpiryRecordServiceImpl.java:174-187 — 按规则 uniqueValue 分组统计
QueryWrapper<FileExpiryRecord> wrapper = new QueryWrapper<>();
wrapper.select("rule_unique_value AS ruleUniqueValue", "COUNT(1) AS cnt")
        .in("rule_unique_value", ruleUniqueValues)
        .groupBy("rule_unique_value");
List<Map<String, Object>> rows = this.listMaps(wrapper);
// 转换为业务类型后返回，Service 聚合层只看到 Map<String, Integer>
```

`listMaps`、`QueryWrapper`、`select("...")`这类字符串是**数据访问细节**，必须封装在 Component 方法内，对 Service 聚合层不可见。

## 5. TypeHandler 场景例外

当字段有自定义 TypeHandler 时（如 `List<String>` 字段映射到 `VARCHAR`），必须用 `update(entity, Wrapper)` 而不是 `lambdaUpdate().set(SFunction, List)`：

```java
// FileExpiryRecordServiceImpl.java:129-146
// 原因：lambdaUpdate().set(SFunction, List) 路径不携带列上下文，TypeHandler 被绕开
FileExpiryRecord patch = new FileExpiryRecord();
patch.setReminderDays(reminderDays);   // List<String> 字段
this.update(patch,
        new LambdaUpdateWrapper<FileExpiryRecord>()
                .eq(FileExpiryRecord::getRuleUniqueValue, ruleUniqueValue));
```

## 6. Mapper 接口签名规约

```java
// 分页：Page 参数在前，DTO 必须 @Param("dto")
IPage<BankCard> pageBankCard(Page<BankCard> page, @Param("dto") BankCardPageDTO dto);

// 多参数：所有参数必须显式 @Param
int countByAccountNumber(@Param("accountNumber") String accountNumber,
                         @Param("excludeId") Long excludeId);
```

## 7. 禁止清单

- ❌ Service 聚合层写 `this.lambdaQuery()` / `this.lambdaUpdate()`（下沉到 Component）
- ❌ Service 聚合层写 `new QueryWrapper<>()` / `new LambdaQueryWrapper<>()`（下沉到 Component，封装为业务方法）
- ❌ XML 中 `${value}` 传用户输入——一律 `#{value}`（防 SQL 注入）
- ❌ `@Select("...")` 注解 SQL——统一写 XML 文件
- ❌ 手写 INSERT / UPDATE XML 替代 MP BaseMapper
- ❌ 在 XML `<if>` 里用 `>` 或 `<` 未转义——必须用 `&gt;` / `&lt;`

## 8. 细则导航

| 需求 | 参考文档 |
|------|---------|
| XML 列别名、`<if>`、`<foreach>` 语法 | `data-model-sql.md §6` |
| Mapper 接口 Javadoc 规范 | `architecture-layers.md §4` |
| Service 聚合层禁止写 Lambda | `concerns-separation.md §5` |
| 数据权限 XML 子句（`<choose>` / `1=0` 兜底） | `performance.md §5` |
