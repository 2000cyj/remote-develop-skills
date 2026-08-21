# 实体与数据库规范

本规范基于 bi-cashier 模块 BankCard / Seal / Store 等业务的实际 PO、Mapper、SQL 写法整理。

## 1. 基础实体与逻辑删除

### 1.1 实体基类

- 当前 bi-cashier 业务 PO 统一继承 `com.obo.core.common.model.BaseEntity`：
  - `BankCard` / `Seal` / `Store` / `StoreChangeInfo` / `Company` / `Employee` 等。
- 历史文档里提到的 `BaseTenantNonDeletedEntity` / `BaseTenantEntity` **与现状不符**，不要在新代码中按这两个基类写。

### 1.2 软删除约定

- 出纳模块一律软删除，**禁止** `remove()` / `removeById()` / `deleteById()` 物理删除。
- PO 与表必须有 `deleted` 列（`tinyint`，`0` = 正常，`1` = 已删除）。
- 软删除标准写法：

```java
return this.lambdaUpdate()
        .eq(Seal::getUniqueValue, uniqueValue)
        .set(Seal::getDeleted, 1)
        .update();
```

- 查询 / 列表统一加 `.eq(Xxx::getDeleted, 0)` 过滤：

```java
List<Seal> list = this.lambdaQuery()
        .eq(Seal::getDeleted, 0)
        ...
```

- Service 聚合层做"级联删除"也走软删除（参考 `deleteStore(uniqueValue)` 同时清空子表）。

## 2. 业务流水号 uniqueValue

### 2.1 必须使用 uniqueValue

- 除数据库自增主键 `id` 外，业务表必须生成并存储 `unique_value`（数据库列名）。
- Java 字段：`@TableField("unique_value") private String uniqueValue;`。
- 表之间的外键关联**推荐**使用 `unique_value`，例如 `Store.companyUniqueValue` 而非 `Store.companyId`（数据权限跨服务时按 uniqueValue 传）。

### 2.2 ID 生成规则

```java
private static final String SEAL_UNIQUE_VALUE_PREFIX = "YZ-";
private static final String SEAL_TYPE = "seal";

private String generateSealUniqueValue() {
    String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
    return SEAL_UNIQUE_VALUE_PREFIX + IDUtils.getId(date, SEAL_TYPE);
}
```

- 调用：`IDUtils.getId(dateStr, typeStr)`。
  - `dateStr` 格式 `yyyyMMdd`（注意：不是 YMDHm，与旧文档不一致）。
  - `typeStr` 是业务名（`"seal"`、`"store"` 等）。
- 前缀约定：
  - 印章：`YZ-`
  - 店铺：`ST-`
- 完整值形如 `YZ-20260625-001`、`ST-20260625-001`。

### 2.3 唯一性约束

- 表上必须建唯一索引 `UNIQUE KEY uk_unique_value (unique_value)`（参考既有 DDL）。

## 3. 主从表（Master-Detail）

店铺是当前唯一显式主从表（Store 主表 + StoreChangeInfo 子表）。

### 3.1 设计原则

- 主表与子表都必须独立持久化（父子各自 `id`、`unique_value` 或主表子键）。
- 子表外键用 `store_unique_value`，**不要**用 `store_id`。
- 子表要有独立的 `change_date`、`change_remark` 等业务字段。
- 一对多关系通过子表 `store_unique_value` 反查。

### 3.2 复合更新（按 uniqueValue 重置子表）

Service 聚合层写入策略：

```java
@Transactional(rollbackFor = Exception.class)
public void updateStoreAll(StoreSaveRequestDTO request) {
    // 1. 更新主表
    storeService.updateStore(toStore(request));

    // 2. 物理清空子表（清空后重建，避免 id 复用导致脏数据）
    storeChangeInfoService.deleteByStoreUniqueValue(uniqueValue);

    // 3. 重建子表
    if (CollUtil.isNotEmpty(request.getChangeInfoList())) {
        request.getChangeInfoList().forEach(item -> {
            storeChangeInfoService.save(toChangeInfo(uniqueValue, item));
        });
    }
}
```

- 这是按 `unique_value` 全量重建子表的实现，配合"先删后插"保证数据一致。
- Controller 命名 `addStoreAll` / `updateStoreAll`：后缀 `All` 表示主+子一起操作。

## 4. 字段命名

- 表列：`snake_case`（`account_number`、`open_date`、`tax_agreement_status`）。
- Java 字段：`camelCase`（`accountNumber`），通过 `@TableField("account_number")` 显式映射。
- 含义清晰的字段名优先，避免过度缩写：`monthlyLimit`、`taxAgreementStatus` 比 `ml`、`tstat` 更可读。

## 5. 索引命名

| 索引类型 | 命名 | 用途 |
|----------|------|------|
| 业务唯一字段 | `uk_xxx` | `UNIQUE KEY uk_unique_value (unique_value)` |
| 普通查询 | `idx_xxx` | `KEY idx_company_id (company_id)` |
| 外键关联 | `idx_xxx_unique_value` | `idx_company_unique_value (company_unique_value)` |

- 一律小写、下划线分隔。
- 唯一索引必须以 `uk_` 开头，普通索引以 `idx_` 开头。

## 6. Mapper 写法

### 6.1 分页查询

```java
IPage<BankCard> result = baseMapper.pageBankCard(page, dto);
PageResult pageResult = new PageResult(result.getTotal(), result.getRecords());
```

- 入参：`Page<Xxx> page` + DTO；DTO 用 `@Param("dto")` 显式命名。
- 返回：`PageResult<Xxx>` 包装，与 Controller 的 `Result<PageResult<XxxVO>>` 对应。

### 6.2 XML 列别名

```xml
<select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">
    SELECT id AS id,
           account_number AS accountNumber,
           ...
    FROM cashier_bank_card
    WHERE deleted = 0
    ...
</select>
```

- 所有列必须起别名，避免依赖 MyBatis 自动 map 规则。
- 过滤条件 `WHERE deleted = 0` 必须存在。

### 6.3 动态条件

```xml
<if test="dto.accountName != null and dto.accountName != ''">
    AND account_name LIKE CONCAT('%', #{dto.accountName}, '%')
</if>

<if test="dto.bankTypes != null and dto.bankTypes.size() > 0">
    AND bank_type IN
    <foreach collection="dto.bankTypes" item="type" open="(" separator="," close=")">
        #{type}
    </foreach>
</if>
```

- 字符串字段判空：`!= null and != ''` 双判断。
- 集合判空：`!= null and size() > 0`。
- 时间范围：`>=` 用 `&gt;=`、`<=` 用 `&lt;=`。
- 数据权限动态条件用 `<choose>` / `<when>` / `<otherwise>`，权限为空时强制 `1 = 0` 拦截越权（参考 `StoreMapper.xml`）。

### 6.4 占位 XML

没有自定义 SQL 也要建占位 XML，保留扩展点：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.obo.bi.cashier.mapper.StoreChangeInfoMapper">
    <!--
        当前 Mapper 仅使用 MyBatis Plus BaseMapper 提供的通用 CRUD，
        本 XML 文件作为占位，便于后续扩展自定义 SQL（如批量按 store_unique_value 删除）。
    -->
</mapper>
```

## 7. SQL 脚本归档

- 所有 SQL 变更（DDL / DML）必须归档到 `bi-sql` 服务的 `docs/sql` 目录下。
- 按迭代周期（每周五）建立日期目录，例如 `2026.04.10`。
- 当前时间未到周五时，归档到上一个周五的周期目录。
- 周期目录下按业务服务划分，每个服务在同一周期目录下只能有一个 `.sql` 文件，例如：

```
docs/sql/2026.04.10/bi_cashier.sql
```

- 禁止拆分出 `bi_cashier_bank_card.sql`、`bi_cashier_seal.sql` 等多个文件。

## 8. 表设计常见示例

| 表 | 关键字段 | 索引 |
|----|----------|------|
| `cashier_bank_card` | `account_number`、`bank_code`、`tax_agreement_status`、`cancel_date` | `uk_unique_value` / `idx_account_number` |

> **注意**：`cashier_bank_card` 的 `account_number` 只有 `idx_account_number`（普通索引），**没有 UNIQUE 约束**。唯一性靠 `BankCardManageServiceImpl` 调用 `isAccountNumberExists(accountNumber, excludeId)` 做应用层判重。高并发时存在"先查不存在再同时插入"的竞态风险，新写同类业务表若业务上要求全局唯一则应加 `UNIQUE KEY uk_xxx_code (xxx_code)` 在 DDL 中。
| `cashier_seal` | `unique_value`、`seal_name`、`seal_type`、`company_unique_value` | `uk_unique_value` / `idx_company_unique_value` |
| `cashier_store` | `unique_value`、`store_code`、`company_unique_value`、`department_id` | `uk_unique_value` / `uk_store_code` / `idx_company_unique_value` |
| `cashier_store_change_info` | `store_unique_value`、`change_date` | `idx_store_unique_value` / `idx_change_date` |

注：`cashier_company`、`cashier_employee_file_*`、`cashier_file_*` 等表的具体列结构以最新 DDL 为准。

---

## PO 字段映射规约

PO 是数据访问的核心载体。本节明确字段映射、类型选择、命名规则。

### 1. PO 类结构模板

```java
package com.obo.bi.cashier.po;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.obo.core.common.model.BaseEntity;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@TableName("cashier_bank_card")
@ApiModel("银行卡实体")
public class BankCard extends BaseEntity implements Serializable {

    @ApiModelProperty("主键ID")
    @TableId(type = IdType.AUTO)
    @TableField("id")
    private Long id;

    @ApiModelProperty("账号")
    @TableField("account_number")
    private String accountNumber;
}
```

**类级注解顺序**：
- `@Data`（Lombok）
- `@TableName("cashier_xxx")`（MyBatis-Plus）
- `@ApiModel("xxx 实体")`（Swagger）

**继承**：`extends BaseEntity`（统一审计字段）+ `implements Serializable`（虽然 MP 3.x 不强制，但保留）。

### 2. 字段类型映射表

| 业务 | Java 类型 | DB 类型 | 注解 |
|------|----------|---------|------|
| 主键 | `Long` | `bigint` | `@TableId(type = IdType.AUTO)` |
| 业务唯一标识 | `String` | `varchar(64)` | `@TableField("unique_value")` |
| 名称 | `String` | `varchar(255)` | `@TableField(...)` |
| 长文本 | `String` | `text` | `@TableField(...)` |
| 金额 | `BigDecimal` | `decimal(18,4)` | `@TableField(...)` |
| 日期 | `LocalDate` | `date` | `@DateTimeFormat` + `@JsonFormat(pattern = "yyyy-MM-dd")` |
| 日期时间 | `LocalDateTime` | `datetime` | `@DateTimeFormat` + `@JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")` |
| 状态码 | `String` | `varchar(32)` | `@TableField(...)` |
| 数量 | `Integer` | `int` | `@TableField(...)` |
| 布尔 | `Boolean` | `tinyint` | `@TableField(...)` |
| 外键 ID | `Long` | `bigint` | `@TableField("xxx_id")` |

### 3. 字段命名映射

| 层面 | 命名规则 |
|------|---------|
| Java 字段 | `camelCase`（如 `accountNumber`） |
| 数据库列 | `snake_case`（如 `account_number`） |
| 关联外键 | `<entity>_id` 或 `<entity>_unique_value` |

### 4. `@TableField` 必写

即使 Java 字段名与数据库列名**完全相同**也建议写出来：

```java
@ApiModelProperty("账号")
@TableField("account_number")  // 即使 accountNumber 与 account_number 转换后相同，也显式
private String accountNumber;
```

**理由**：明确表达意图，避免后续修改字段名时遗漏更新 DB 列。

### 5. 字段必含项

每个字段必须有：

```java
@ApiModelProperty("中文注释")            // Swagger 文档
@TableField("snake_case")              // 显式映射
private Type fieldName;               // 驼峰
```

日期字段额外：

```java
@ApiModelProperty("开户日期")
@DateTimeFormat(pattern = "yyyy-MM-dd")
@JsonFormat(pattern = "yyyy-MM-dd")
@TableField("open_date")
private LocalDate openDate;
```

### 6. BaseEntity 继承字段

`extends BaseEntity` 自动获得：

- `id`（主键）
- `createUser` / `updateUser`（操作人）
- `createTime` / `updateTime`（操作时间）
- `deleted`（软删除标志，0=未删，1=已删）
- `tenantId`（多租户 ID）

**不要**在 PO 中重复声明这些字段。

### 7. 软删除字段

统一 0/1：

```java
// 默认未删
WHERE deleted = 0

// 软删除
this.lambdaUpdate().set(Xxx::getDeleted, 1).eq(Xxx::getId, id).update();
```

### 8. 表名命名

`@TableName("cashier_{entity_snake_case}")`：

| 实体 | 表名 |
|------|------|
| BankCard | `cashier_bank_card` |
| Seal | `cashier_seal` |
| Store | `cashier_store` |
| StoreChangeInfo | `cashier_store_change_info` |
| AuditApplication | `cashier_audit_application` |

**规则**：`cashier_` 前缀 + 实体名（复数 → 单数）。

### 9. 反例

- ❌ Java 字段用 snake_case（`private String account_number`）
- ❌ 字段没 `@TableField`（隐式映射易错）
- ❌ 主键用 `String` 而非 `Long`
- ❌ 金额用 `Double` 而非 `BigDecimal`
- ❌ 字段类型用 `Date` 而非 `LocalDate`
- ❌ 字段无 `@ApiModelProperty`（无 Swagger 中文文档）
- ❌ 重复声明 BaseEntity 字段（`@TableField("create_user")` 在自己 PO 里）
- ❌ 表名无 `cashier_` 前缀
