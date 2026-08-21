# 编码质量规范

本规范聚焦于 bi-cashier 模块日常编码的代码级细节，以实际代码写法为准。

## 1. 命名

### 1.1 类名 / 方法名 / 变量名

- 类名以大写字母开头；
- VO 类必须以大写 `VO` 结尾；DTO 类必须以大写 `DTO` 结尾；Enum 以 `Enum` 结尾（参考 `CashierSensitiveFieldEnum` / `SourceModuleEnum`）。
- 方法名、变量名、参数名小写驼峰。
- 即使数据库字段是蛇形，Java 字段也要保持驼峰。

### 1.2 字段命名

- PO / DTO / VO 字段统一**驼峰**，例如：

```java
@ApiModelProperty("账号")
@TableField("account_number")
private String accountNumber;
```

- **不存在** "DTO/VO 字段使用下划线命名" 的写法。
- 数据库表列名通过 `@TableField("snake_case")` 显式映射。
- 集合字段不加 `s` 也可，但同模块内风格保持一致：

```java
private List<String> bankCodes;
private List<String> bankTypes;
private List<String> taxAgreementStatuses;
```

### 1.3 业务前缀与命名空间

- 接口路径：`/cashier/{module}/...`，已存在的 `{module}`：`bankCard`、`seal`、`store`。
- 业务唯一流水号前缀（uniqueValue）：印章 `YZ-`、店铺 `ST-`、其他参考既有实现。
- 自定义 SKU 前缀（文件）写在 `SourceModuleEnum.skuCodePrefix`，与 DTO 字段名一致：

```java
BANK_CARD_ACCOUNT_QUERY_FILES("银行卡管理-账户信息查询单",
        "bank_card_account_query_files",
        "accountQueryFiles"),
```

完整 skuCode = `skuCodePrefix + uniqueValue`。

## 2. 注解与 Swagger

### 2.1 PO / DTO / VO 通用注解

```java
@Data
@TableName("cashier_bank_card")
@ApiModel("银行卡实体类")
public class BankCard extends BaseEntity implements Serializable {

    @ApiModelProperty("主键ID")
    @TableId(type = IdType.AUTO)
    private Long id;

    @ApiModelProperty("账号")
    @TableField("account_number")
    private String accountNumber;
    ...
}
```

- 必有：`@Data`、`@TableName`、`@ApiModel("中文类说明")`、每个字段 `@ApiModelProperty("中文字段说明")`。
- 主键：`@TableId(type = IdType.AUTO)` + `private Long id;`。
- 日期：`LocalDate` 字段同时加 `@DateTimeFormat(pattern = "yyyy-MM-dd")` + `@JsonFormat(pattern = "yyyy-MM-dd")`。
- 日期时间：`LocalDateTime` 同时加 `yyyy-MM-dd HH:mm:ss`。

### 2.2 Controller

- 类级别：`@Api(tags = "中文分类")` + `@RestController` + `@RequestMapping("/cashier/xxx")`。
- 方法级别：`@ApiOperation("中文说明")` + HTTP 注解。
- **当前不强制** `@BusLogs`——`BusLogAop.java` 已被全注释，新 Controller 不要补这个注解。

### 2.3 入参校验

优先在 Service 聚合层做语义校验（如业务判重、关联存在性）；基本字段校验在 DTO 上用：

```java
@NotBlank(message = "印章名称不能为空")
@Size(max = 100, message = "印章名称长度不能超过 100")
private String sealName;
```

- `message` 必须中文。

## 3. 错误处理与统一返回

- Controller 用 `Result.success(...)`；失败由 Service 抛 `BusinessException`：

```java
throw new BusinessException("账号不能为空");
throw new BusinessException("印章业务唯一流水号不能为空");
```

- 业务校验失败统一抛业务异常，不要吞异常、不要 `e.printStackTrace()`。
- Feign 远程返回 `Result<T>`：

```java
Result<Map<String, List<FileUploadRecordVO>>> result = fileClient.queryFileUploadRecordMap(queryDTO);
Map<String, List<FileUploadRecordVO>> data = RemoteResultUtils.checkAndGetData(result);
```

或自实现：

```java
if (result == null || !Boolean.TRUE.equals(result.getSuccess())) {
    throw new BusinessException("查询现有附件失败：" + ...);
}
```

## 4. 日志与注释

### 4.1 日志规范

- 用 `@Slf4j`（`log.info` / `log.warn` / `log.error`）。
- 关键业务方法入口 `log.info("[开始]业务名")`；阶段切换前 `log.info("当前步骤...")`；结束 `log.info("[完成]...")`；异常 `log.error("失败原因", e)`。
- 异常必须参数化：

```java
log.error("反序列化店铺经营类目失败, json: {}", json, e);
```

### 4.2 Javadoc 规范

- 所有对外类（Controller / Service 接口与实现 / Feign Client 接口 / Mapper 接口）、所有外部可见方法、所有 helper 方法必须有 Javadoc（用途、`@param`、`@return`）。
- `@Override` 方法可以省略 `@param` / `@return`，但建议保留业务背景说明。
- 内部 VO / DTO 静态类同样写 Javadoc（参考 `StoreSaveRequestDTO.ChangeInfoItem`）。
- Javadoc 用中文：

```java
/**
 * 按公司 uniqueValue 查询关联店铺列表
 * <p>用于公司详情页"店铺信息"按钮：弹出当前公司关联的全部店铺列表 ...</p>
 */
public List<StoreListVO> listStoreByCompanyUniqueValue(String companyUniqueValue);
```

- 注释放在注解**上方**，不要夹在注解与声明之间。

## 5. 空值与判空

| 场景 | 用法 | 反例 |
|------|------|------|
| 集合判空 | `CollUtils.isEmpty(x)` / `CollUtils.isNotEmpty(x)` | `list == null \|\| list.size() > 0` |
| 字符串判空 | `StringUtils.isBlank(x)` / `StringUtils.isNotBlank(x)` | `""`.equals(str)` |
| 包装类型运算前 | 先判空给默认值 | `a + b` 在包装类型上自动拆箱 NPE |
| 空集合返回 | `Collections.emptyList()` / `Collections.emptyMap()` | `new ArrayList<>()` |
| 集合入参 | 优先 `Collection<T>` 接口，而非具体实现 | 只接受 `List<T>` 拒绝 `Set<T>` |

## 6. Feign 客户端与远程调用

- 跨服务接口在 `bi-xxx-api` 模块声明。
- Feign 调用结果统一解包：

```java
// 推荐写法
Map<String, List<FileUploadRecordVO>> data = RemoteResultUtils.checkAndGetData(result);
```

- 业务 Service 不要重复实现 `checkAndGetData`，除非有不同错误处理（参考 `CashierManageHelper.checkRemoteSuccess`，用于"文件服务失败抛业务异常"的特殊语义）。
- Feign 失败时错误信息要透传 `result.getMessage()`：

```java
throw new BusinessException("查询附件失败：" + result.getMessage());
```

## 7. 敏感字段与权限

- 敏感字段通过枚举定义在 `bi-cashier-component/src/main/java/com/obo/bi/cashier/enums/CashierSensitiveFieldEnum.java`，并配合 `TwoLevelEnum.GSGL / DPGL` 划分模块。
- Service 聚合层导出或回显前，调用 `fieldPermissionService.hasFieldPermission(...)` 判断：

```java
boolean hasPwd = fieldPermissionService.hasFieldPermission(
        TwoLevelEnum.DPGL, CashierSensitiveFieldEnum.SHOP_PASSWORD);
String display = hasPwd ? rawPassword : "******";
```

- 导出场景用 `CashierExportUtils.setSensitivePermission(...)` / `clearSensitivePermission()` 配对使用，**用 `try-finally` 保证清理**，避免线程复用导致的内存泄漏。

## 8. 文件、枚举、常量

### 8.1 枚举写法

```java
@Getter
public enum SourceModuleEnum {

    COMPANY_FILE_LIST("公司管理-公司文件列表", "company_file_list", "companyFile"),
    ...
    ;

    @Getter
    private final String msg;
    @Getter
    private final String value;
    @Getter
    private final String skuCodePrefix;

    SourceModuleEnum(String msg, String value, String skuCodePrefix) {
        this.value = value;
        this.msg = msg;
        this.skuCodePrefix = skuCodePrefix;
    }

    public static SourceModuleEnum fromValue(String value) {
        for (SourceModuleEnum e : values()) {
            if (e.value.equals(value)) {
                return e;
            }
        }
        return null;
    }
}
```

- 提供 `value`、`msg` 两个字段，附加字段（如 `skuCodePrefix`）按需扩展。
- 提供 `fromValue` / `getByValue` 方法便于按值反查。

### 8.2 常量类

- `Constant` 类（如 `DictTypeConstants`）放 `com.obo.bi.cashier.constant`，集中字符串常量。

## 9. DRY 与可读性

- 同一段通用逻辑出现 ≥2 次且字段语义固定时，提为私有 helper / 静态方法，避免"复制 + 粘贴 + 微调"。
- 一次性 / 顺序性强 / 没有跨方法复用价值的代码不要硬抽。
- 主流程保持自上而下可读；用 `// 阶段说明` 单行注释分隔大段落（参考 `BankCardManageServiceImpl`）。
- 不要把"对控制流可读"的小函数碎拆成多个 helper 调用。

## 10. 内部 DTO / VO 写法

复合 DTO/VO 用 `public static class` 嵌套（参考 `StoreSaveRequestDTO.ChangeInfoItem`、`StoreDetailVO.ChangeInfoItem`）：

```java
@Data
@ApiModel("店铺保存请求（复合）")
public class StoreSaveRequestDTO {

    @ApiModelProperty("...")
    private List<ChangeInfoItem> changeInfoList;

    @Data
    @ApiModel("变更信息项")
    public static class ChangeInfoItem {
        @ApiModelProperty("变更信息ID（修改时必传）")
        private Long id;
        ...
    }
}
```

- 嵌套静态类与外层写在同一文件中。
