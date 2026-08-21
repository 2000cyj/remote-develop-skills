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

---

## 注释规范

注释是给**读代码的人**看的，不是给编译器看的。所有注释**必须用中文**。

### 1. 类级别 Javadoc

**所有外部类必须有 `/** ... */` 形式的类级 Javadoc**（含 Service 接口 / Impl / Controller / Convert / Helper / Enum / 静态常量类）。

- 第一段：一句话说明类的核心职责
- 第二段起：用 `<p>` 标签详细描述**业务背景、约束、与其它模块的关系**

反例：

```java
/**
 * 出纳审核服务
 */                                                // 太简略
public class XxxManageService { }
```

正例：

```java
/**
 * 出纳审核流程节点处理标识解析器。
 *
 * <p>仅将受支持的流程类型映射为固定处理标识，不执行节点完成后的业务副作用。</p>
 *
 * <p>作为 bi-flowable 工作流的服务端常量映射，调用方传入 {@code flowType} 字符串，
 * 解析器返回对应的 handler 名；不识别时返回 {@code null}，由调用方决定兜底策略。</p>
 *
 * <p>线程安全：{@code handlerNames} 在构造完成后不可变（{@link Collections#unmodifiableMap}），
 * 实例本身无状态，可在容器中作为单例使用。</p>
 */
@Component
public class CashierAuditNodeHandlerResolver { }
```

### 2. 方法级别 Javadoc

**所有 `public` 方法都必须有 Javadoc**（含 Service 接口方法和 Impl 类方法）。

- 简短说明方法用途
- `@param` 参数：说明**参数语义与取值约束**，不写"参数"二字废话
- `@return` 返回值：说明返回的语义、特殊值（null / 空集合）的意义
- `@throws BusinessException`：当方法会主动抛业务异常时列出

反例：

```java
/**
 * 查询子账号
 * @param dto 请求参数
 * @return 返回结果
 */
List<SubAccountVO> list(String dto);
```

正例：

```java
/**
 * 查询店铺下的子账号。
 *
 * <p>密码字段已掩码（{@code ******}）；未传版本时由实现层使用当前记录版本。
 * 删除成功后尝试记录审计信息。</p>
 *
 * @param storeUniqueValue 店铺业务唯一标识；为空时返回空列表
 * @return 子账号列表；密码字段已掩码
 */
List<SubAccountVO> list(String storeUniqueValue);
```

### 3. 行内 / 方法内注释

- **写业务含义、关键原因、不易看懂的逻辑**，不写"赋值"类废话。
- 阶段化注释（方法体超过 80 行必加）：

```java
@Override
public Boolean updateCompanyAll(CompanySaveRequestDTO request) {
    // 1. 前置校验
    validateCompany(request);
    // 2. 主表更新
    companyService.updateCompany(toCompany(request));
    // 3. 物理清空子表 + 重建
    companyShareholderService.deleteByCompanyUniqueValue(...);
    // 4. 文件 SKU 拼接与附件变更
    cashierManageHelper.fileChange(...);
    return true;
}
```

### 4. 类级 / 方法级注释的位置

- 注释在声明**上一行**（不夹在中间）
- 例外：类级 Javadoc 在 `public class` 上方
- 行内注释 `//` 加半角空格 + 业务化描述（不写"赋值给 xxx"）

---

## 异常处理完整规约

### 1. 业务异常类

```java
import com.obo.core.common.exceptionHandle.BusinessException;

throw new BusinessException("印章名称已存在");
throw new BusinessException("账号 " + accountNumber + " 已存在");
```

**注意**：
- 类路径：`com.obo.core.common.exceptionHandle.BusinessException`
- message 必须中文
- 必须说明**业务原因**，让用户能懂

### 2. 异常位置（按 skills §职责边界一览）

| 层 | 抛什么 | 业务校验 |
|---|--------|---------|
| Controller | `Result.error("中文提示")` | 由 Result 包装 |
| Service 聚合 | `throw new BusinessException("中文")` | 业务异常 |
| Component | **不抛业务异常** | 只抛系统异常 |
| Mapper | 不抛 | 让 MyBatis 抛 |

### 3. 业务异常信息模板（按场景）

| 场景 | 模板 | 例 |
|------|------|-----|
| 字段为空 | `xxx 不能为空` | `"印章名称不能为空"` |
| 字段重复 | `xxx 已存在` | `"账号已存在"` |
| 字段不存在 | `xxx 不存在` | `"记录不存在"` |
| 数据不存在 | `数据不存在，请刷新页面` | — |
| 操作失败 | `xxx失败` | `"删除失败"` |
| 状态错误 | `xxx 已 YYY，不能 ZZZ` | `"印章已停用，不能编辑"` |
| 数据被引用 | `xxx 已被 YYY 引用，不能 ZZZ` | `"银行卡已被公司引用，不能删除"` |
| 长度校验 | `xxx 长度不能超过 N` | `"印章名称长度不能超过 100"` |
| 格式校验 | `xxx 格式不合法` | `"手机号格式不合法"` |
| 业务不匹配 | `xxx 不匹配` | `"新旧密码不匹配"` |
| 远程调用失败 | `远程调用失败：xxx` | `"远程调用失败：未授权"` |

### 4. Controller 错误返回

```java
// 1. 业务上不可能成功
return Result.error("新增失败");

// 2. 业务异常由全局异常处理转为 Result
// （throw new BusinessException 在 Service 抛，由 ControllerAdvice 统一处理）
```

### 5. 全局异常处理

`@RestControllerAdvice` / `@ControllerAdvice` 统一捕获：

```java
@ExceptionHandler(BusinessException.class)
public Result<Void> handleBusinessException(BusinessException e) {
    log.warn("业务异常：{}", e.getMessage());
    return Result.error(e.getMessage());
}

@ExceptionHandler(Exception.class)
public Result<Void> handleException(Exception e) {
    log.error("系统异常", e);
    return Result.error("系统异常，请联系管理员");
}
```

### 6. 异常传播（Feign 调用）

```java
// 1. 手写校验
Result<DataDTO> result = remoteClient.queryData(...);
if (result == null || !ResultEnum.SUCCESS.getCode().equals(result.getCode())) {
    throw new BusinessException("远程调用失败：" + result.getMessage());
}
DataDTO data = result.getData();

// 2. 用 RemoteResultUtils（推荐）
DataDTO data = RemoteResultUtils.checkAndGetData(result);
// 内部已校验，结果失败时抛 BusinessException
```

### 7. 业务异常 vs 系统异常

| 类型 | 类 | 用途 | HTTP |
|------|-----|------|------|
| 业务异常 | `BusinessException` | 数据校验、业务规则、状态校验 | 200 + 业务 code |
| 系统异常 | `RuntimeException` / `IllegalArgumentException` | 框架错误 | 200 + 错误 code |
| 远程异常 | `FeignException` / `RemoteException` | 远程调用失败 | 200 + 错误 code |

### 8. 反例

- ❌ `e.printStackTrace()` 代替日志
- ❌ `catch (Exception e) {}` 吞掉异常
- ❌ `throw new RuntimeException("xxx 错误")`（用 BusinessException）
- ❌ 异常 message 含敏感数据（密码、手机号）
- ❌ 异常信息含技术堆栈（暴露 SQL / 类名）
- ❌ Component 层抛 BusinessException
- ❌ 一律 HTTP 500（业务异常应 4xx + 业务 code）
- ❌ 异常 message 用英文/拼音

---

## 日志格式细化

### 1. 4 层日志差异化

| 层 | 日志频率 | 关键日志点 |
|---|---------|---------|
| Controller | 不写 | 业务逻辑不在 Controller |
| Service 聚合 | 高 | 阶段开始 / 阶段完成 / 关键字段 |
| Component | 中 | 业务逻辑（合并、过滤） |
| Mapper | 不写 | 让 MyBatis + 框架层日志 |

### 2. 阶段日志模板

```java
log.info("银行卡信息导出[开始]");                              // 阶段开始
log.info("银行卡信息导出[完成]，fileId={}，size={}", fileId, size);  // 阶段完成 + 关键结果
```

格式：
- `[开始]` / `[完成]` / `[失败]` 标记阶段
- `{}` 占位符传关键字段（不拼字符串）
- 单行不超过 200 字符

### 3. 占位符 vs 字符串拼接

```java
// ✅ 占位符（推荐，性能更好）
log.info("user {} login at {}", userId, timestamp);

// ❌ 字符串拼接（性能问题 + 锁竞争）
log.info("user " + userId + " login at " + timestamp);
```

**原因**：字符串拼接会先拼接为完整字符串再传给 logger，开销大；占位符只有日志会真正输出时才进行拼接。

### 4. 异常日志

```java
try {
    ...
} catch (Exception e) {
    log.error("导出银行卡失败，fileId={}", fileId, e);  // 末尾传异常对象
}
```

**规则**：
- 占位符消息 + **末尾**传异常对象
- **不要**用 `e.getMessage()` 拼字符串（会丢失堆栈）
- 异常信息用 `error` 级别，业务事件用 `info` / `warn`

### 5. 阶段化注释 + 日志配合

```java
public Boolean updateCompanyAll(CompanySaveRequestDTO request) {
    log.info("更新公司[开始]，uniqueValue={}", request.getUniqueValue());
    // 1. 前置校验
    log.info("步骤 1：前置校验");
    validateCompany(request);
    // 2. 主表更新
    log.info("步骤 2：主表更新");
    companyService.updateCompany(toCompany(request));
    // 3. 清空子表 + 重建
    log.info("步骤 3：清空子表，开始重建");
    companyShareholderService.deleteByCompanyUniqueValue(...);
    // 4. 文件 SKU 拼接
    log.info("步骤 4：处理附件");
    cashierManageHelper.fileChange(...);
    log.info("更新公司[完成]，uniqueValue={}", request.getUniqueValue());
    return true;
}
```

### 6. 敏感字段脱敏

```java
// ❌ 直接打印
log.info("user login: phone={}", user.getPhone());

// ✅ 脱敏
log.info("user login: phone={}", maskPhone(user.getPhone()));
```

**敏感字段清单**：
- 手机号 → `138****5678`
- 身份证 → `420********1234`
- 银行卡号 → `6228 **** **** 1234`（保留前 4 后 4）
- 密码 → `******`
- 税号 → 完整显示（业务必需）
- CVV → 不打印

### 7. 业务日志 vs 框架日志

| 用途 | 方式 | 例子 |
|------|------|------|
| 业务日志 | `@Slf4j` + `log.info` | 阶段、关键字段 |
| 框架日志 | `LoggerFactory.getLogger(...)` | MyBatis / Spring 内部 |
| API 审计 | `@BusLogs(descrip = "...")` | 接口文档/审计（如用） |

### 8. 日志级别

- `ERROR`：系统异常、需要立即处理
- `WARN`：业务异常、可预期的失败（如数据校验失败）
- `INFO`：业务关键事件、阶段开始/完成
- `DEBUG`：详细信息（生产默认级别）
- `TRACE`：最详细（一般不开）

### 9. 反例

- ❌ `log.info("xxx");` 无关键字段
- ❌ `log.info("xxx " + variable);` 字符串拼接
- ❌ `log.error("xxx 失败");` 丢失异常对象
- ❌ 大量循环日志（性能问题）
- ❌ 敏感字段未脱敏
- ❌ 业务异常用 `error`（应该 `warn`）

---

## 安全性规约

性能红线在 `references/performance.md`，安全性红线在本节。

### 1. SQL 注入防范

```java
// ✅ 用 #{}（MyBatis 参数化）
@Select("SELECT * FROM users WHERE id = #{id}")
User findById(@Param("id") Long id);

// ❌ 用 ${}（拼接，SQL 注入风险）
@Select("SELECT * FROM users WHERE id = ${id}")
User findByIdUnsafe(@Param("id") String id);
```

**规则**：
- `#{}` 用于参数（值会转义）
- `${}` 仅用于**表名/字段名/ORDER BY** 等"标识符"场景
- **绝不**用于用户输入的值

### 2. XSS 防护

- 前端：React / Vue 框架已 escape
- 后端不再做 escape
- 富文本：用 `@SafeHtml` 注解或后端白名单过滤
- Swagger / API 文档字段值不含可执行 HTML

### 3. 越权检查（数据权限）

按 `references/performance.md` §5 数据权限：在 Service 聚合层注入 `ICommonManageService.listCurrentCashierDepartmentManagePermissionIds(...)` 过滤。

```java
Long employeeId = commonManageService.getCurrentEmployeeId();
List<String> deptIds = commonManageService.listCurrentCashierDepartmentManagePermissionIds(TwoLevelEnum.DPGL);
PageResult<StoreVO> page = storeService.pageStore(dto, departmentIds, operatorId);
```

**强制权限 SQL 子句**：
```xml
<choose>
    <when test="(departmentIds != null and departmentIds.size() > 0) or operatorId != null">
        AND (department_id IN <foreach .../> OR operator_id = #{operatorId})
    </when>
    <otherwise>AND 1 = 0</otherwise>
</choose>
```

**权限空时 `1 = 0` 拦截**（防御性，不允许无权限返回全表）。

### 4. 敏感字段加密 / 脱敏

| 字段 | 处理方式 | 例 |
|------|---------|-----|
| 密码 | 应用层加密 + DB 加密字段 | BCrypt / 自研 |
| 手机号 | `138****5678`（中间 4 位） | `maskPhone()` |
| 身份证 | `420********1234`（中间 8 位） | `maskIdCard()` |
| 银行卡号 | `6228 **** **** 1234`（前 4 后 4） | `maskBankCard()` |
| 税号 | 完整显示（业务必需） | — |
| CVV | 不打印到日志 | — |

### 5. 文件上传安全

- 文件类型白名单（仅业务所需）
- 文件大小限制（按业务）
- 文件名清洗（去除 `../` 路径穿越）
- 上传后立即异步病毒扫描（如有）

### 6. SQL 注入风险表

| 危险用法 | 安全替代 | 例子 |
|---------|---------|------|
| `${value}` | `#{value}` | 用户输入的值 |
| `LIKE '%${x}%'` | `LIKE CONCAT('%', #{x}, '%')` | 模糊查询 |
| `IN (${ids})` | `IN <foreach collection="ids" item="id">#{id}</foreach>` | 列表查询 |
| `ORDER BY ${col}` | `ORDER BY ${col}`（但白名单 `if (col in allowedSet)`） | 排序字段 |

### 7. 密码处理

```java
// ✅ 加密后存储
String hashedPassword = BCrypt.hashpw(rawPassword, BCrypt.gensalt());
user.setPassword(hashedPassword);

// ✅ 校验
boolean matches = BCrypt.checkpw(rawPassword, user.getPassword());

// ❌ 明文存储
user.setPassword(rawPassword);
```

**禁止**：
- 密码明文存储
- 密码明文日志
- 密码明文返回给前端

### 8. 反例

- ❌ 多参数方法没用 `@Param` 命名
- ❌ SQL 字符串拼接（即使"看起来安全"也不允许）
- ❌ 排序字段 / 过滤字段直接接受用户输入
- ❌ 敏感字段明文打印到日志
- ❌ 权限检查放在 Controller（应在 Service 聚合层）
- ❌ 全部角色都返回完整数据（不做数据级权限）
- ❌ 软删除字段 `WHERE deleted = 0` 漏写
- ❌ 越权检查做在 Controller（应下沉到 Service 聚合层）

---

## 错误码/错误信息规范

### 1. 错误码体系

```java
// 业务异常：直接中文 message
throw new BusinessException("印章名称已存在");

// 国际化（可选）：用 ErrorCode 引用 i18n
throw new BusinessException(BusinessErrorCode.SEAL_NAME_EXISTS);
```

**实际项目选择**：出纳模块是内部系统，**直接中文**即可（不必做 i18n）。

### 2. 错误信息中文模板（按场景）

| 场景 | 模板 | 例 |
|------|------|-----|
| 字段为空 | `xxx 不能为空` | `"印章名称不能为空"` |
| 字段重复 | `xxx 已存在` | `"账号已存在"` |
| 字段不存在 | `xxx 不存在` | `"记录不存在"` |
| 数据不存在 | `数据不存在，请刷新页面` | — |
| 操作失败 | `xxx失败` | `"删除失败"` |
| 状态错误 | `xxx 已 YYY，不能 ZZZ` | `"印章已停用，不能编辑"` |
| 数据被引用 | `xxx 已被 YYY 引用，不能 ZZZ` | `"银行卡已被公司引用，不能删除"` |
| 长度校验 | `xxx 长度不能超过 N` | `"印章名称长度不能超过 100"` |
| 格式校验 | `xxx 格式不合法` | `"手机号格式不合法"` |
| 业务不匹配 | `xxx 不匹配` | `"新旧密码不匹配"` |
| 远程调用失败 | `远程调用失败：xxx` | `"远程调用失败：未授权"` |

### 3. 错误信息禁忌

- ❌ 暴露技术栈信息：`SQLSyntaxErrorException: ...`
- ❌ 暴露内部路径：`/api/.../BankCardMapper.java:123`
- ❌ 暴露敏感数据：`用户密码错误：actual=xxx123`
- ❌ 含糊不清：`系统错误` / `操作失败` 没说明原因
- ❌ 错别字 / 拼音
- ❌ 含 EMOJI / 表情符号
- ❌ 含 SQL 语句 / 类名

### 4. 业务异常 vs 系统异常

| 类型 | 类 | 用途 | HTTP |
|------|-----|------|------|
| 业务异常 | `BusinessException` | 数据校验、业务规则、状态校验 | 200 + 业务 code |
| 系统异常 | `RuntimeException` / `IllegalArgumentException` | 框架错误 | 200 + 错误 code |
| 远程异常 | `FeignException` / `RemoteException` | 远程调用失败 | 200 + 错误 code |

### 5. 业务异常信息组织

```java
// 简洁——单原因
throw new BusinessException("账号已存在");

// 详细——含业务上下文
throw new BusinessException("账号 " + accountNumber + " 已存在");

// 错误信息模板：xxx（含详细值）不能/已 YYY
throw new BusinessException("账号 " + accountNumber + " 长度超过 32 位");
```

**规则**：
- 错误信息第一句**直接说明业务原因**
- 用户能看懂（不要技术术语）
- 含**关键业务值**（让用户能定位问题）

### 6. 错误信息国际化（i18n）

如需国际化：

```java
// 创建 errors.properties
error.code.seal.name.exists=印章名称已存在

// 异常类
public class BusinessException extends RuntimeException {
    private final String errorCode;
    public BusinessException(String errorCode) {
        super(MessageSource.getMessage(errorCode, null, Locale.getDefault()));
        this.errorCode = errorCode;
    }
}

// 抛出
throw new BusinessException("error.code.seal.name.exists");
```

**实际项目选择**：内部系统，**跳过 i18n**，直接中文。

### 7. 反例

- ❌ 异常 message 用英文
- ❌ 含敏感数据（密码、手机号明文）
- ❌ 含技术堆栈（暴露内部类）
- ❌ 含糊不清（"系统错误" 没说明原因）
- ❌ 错别字
- ❌ 拼音混用

---

## Feign 客户端使用规约

Feign 跨服务调用必须遵守本节——避免越级、避免直接 `getData()` 忽略业务 code。

### 1. Client 定义位置

```java
// bi-personnel-api 模块（被调用方定义）
@FeignClient(name = "bi-personnel", path = "/personnel")
public interface EmployeeFileHeadClient {
    @PostMapping("/employees/query")
    Result<EmployeeFileHeadVO> queryByUsername(@RequestBody EmployeeFileHeadQueryDTO dto);
}
```

**规则**：
- 放在**被调用方**的 `-api` 模块（不是调用方）
- `name` = 服务名（与 Nacos / Spring Cloud 一致）
- `path` = 业务前缀（如 `/personnel`）
- Client 接口**只放数据访问方法**，不写业务逻辑

### 2. 调用方注入

```java
@Resource
private EmployeeFileHeadClient employeeFileHeadClient;
```

### 3. 调用模式

#### 模式 A：直接调用（结果简单校验）

```java
Result<EmployeeFileHeadVO> result = employeeFileHeadClient.queryByUsername(dto);
if (result == null || !ResultEnum.SUCCESS.getCode().equals(result.getCode())) {
    throw new BusinessException("远程调用失败：" + result.getMessage());
}
EmployeeFileHeadVO data = result.getData();
```

#### 模式 B：用 `RemoteResultUtils.checkAndGetData`（推荐）

```java
EmployeeFileHeadVO data = RemoteResultUtils.checkAndGetData(result);
```

**优点**：自动校验 null / success / code，结果失败时抛 BusinessException。

### 4. Result 解包约束

| 字段 | 必须 |
|------|------|
| `result == null` | 校验 |
| `result.getCode()` | 校验（与 `ResultEnum.SUCCESS.getCode()` 比） |
| `result.getSuccess()` 或 `result.getCode()` | 二选一 |
| `result.getData()` | 仅在校验通过后调用 |

**禁止**：
- ❌ 直接 `result.getData()` 忽略校验
- ❌ 假设 `result != null` 而不校验

### 5. Feign 异常处理

```java
// 业务异常（自动包装）
throw new BusinessException("调用失败：" + e.getMessage());

// 4xx / 5xx Http 错误（Feign 抛 FeignException）
// 超时：抛 RetryableException 或 ConnectException
```

### 6. Feign 调用配置

```yaml
feign:
  client:
    config:
      default:
        connectTimeout: 5000
        readTimeout: 30000
        loggerLevel: BASIC
  hystrix:
    enabled: true
```

也可以用 `@CircuitBreaker` 实现 fallback。

### 7. Feign 在调用链中的位置

```
Controller → ManageService → FeignClient → 远程 Service
                  ↓
              Result<T> → RemoteResultUtils.checkAndGetData(...) → 业务对象
```

### 8. Feign + 事务

注意 **Feign 不参与 Spring 事务**：

```java
@Transactional(rollbackFor = Exception.class)
public void doSomething() {
    // 本地数据库写入
    localService.save(...);
    // 远程调用（独立事务，不回滚）
    remoteClient.remoteOp(...);
    // 如果前面 commit 失败，远程已经执行——补偿难
}
```

**实践**：跨服务大事务用**最终一致性**（消息队列 + 补偿），不要用单机事务。

### 9. 反例

- ❌ 业务模块本地手写 Feign Client 接口（应在 `-api` 模块）
- ❌ 调用方不校验 `Result.getCode()` 直接 `getData()`
- ❌ 跨服务调用假设单机事务一致
- ❌ Feign 接口暴露 Service 内部异常（要做翻译）
- ❌ 在 bi-cashier-web 模块定义 Feign Client（应在 api）
- ❌ 业务错误信息回传 FeignException 的 raw message（会暴露类名）
- ❌ 同步调用远程服务时未设置超时（可能 5 分钟阻塞）
