# 架构分层规范

本规范以 bi-cashier 实际代码为准。各层职责、产物、调用关系如下。

## 1. Web 层（`bi-cashier-web`）

### 1.1 职责

- 仅暴露 HTTP 接口（Controller）和应用启动 / 切面 / 拦截器 / 配置。
- 只能依赖 Service 聚合层（`IxxManageService`），不允许直接注入 Component Service 或 Mapper。
- 不允许在 Controller 里写集合转换、循环赋值、批量查询、字典拼装等业务逻辑，只做"参数透传 + `Result` 包装 + 异常由全局异常处理器统一捕获"。

### 1.2 Controller 类级别注解

```java
@Api(tags = "出纳-印章管理")           // Swagger 分类中文
@RestController
@RequestMapping("/cashier/seal")      // 业务前缀统一 /cashier/{module}
public class SealController { ... }
```

- 现状：**`@BusLogs` 已被废弃**（`BusLogAop.java` 全注释，无切面生效）。在新代码上**不要**补加 `@BusLogs` 注解，避免给读者错误的"必须添加"预期。
- 类 Javadoc 中列出接口清单：`接口名 - 中文说明`，使用 `<ul><li>...` 包裹（参考 `SealController.java`、`StoreController.java`）。

### 1.3 Controller 方法级别注解

- HTTP 注解：`@PostMapping("/pageXxx")`、`@GetMapping` 等。
- Swagger：`@ApiOperation("中文接口说明")`。
- 入参：
  - 复杂入参（DTO）用 `@RequestBody XxxDTO dto`。
  - 单字段用 `@RequestParam("name") String name`，**参数名必须写在注解里**。
  - 可选参数：`@RequestParam(value = "name", required = false) String name`。
- 返回值：
  - 通用：`Result.success(...)`。
  - 列表分页：`Result<PageResult<XxxVO>>`（必须带泛型）。
  - 单条详情：`Result<XxxVO>` 或 `Result<XxxDetailVO>`。
  - 操作成功（无返回体）：`Result.success(true)`。
- 操作失败，由 Service 层抛 `BusinessException` 后由全局异常处理器统一包装，Controller 不写 `try/catch`。

### 1.4 Mapper XML 位置

- 全部位于 `bi-cashier-web/src/main/resources/mapper/XxxMapper.xml`。
- 即使当前没有自定义 SQL，**也要建占位 XML**（参考 `StoreChangeInfoMapper.xml`：仅含 `namespace` 注释），保留扩展点。
- XML 的 `namespace` 必须指向 Mapper 全限定类名（`com.obo.bi.cashier.mapper.XxxMapper`）。
- 列名必须起别名（`account_number AS accountNumber`），保证与 PO 驼峰字段对齐。

### 1.5 不允许的写法

```java
// 错误：在 Controller 里循环查库
for (String id : ids) {
    list.add(sealService.queryById(id));
}

// 错误：Controller 写 if-else 处理返回值
if (dto.getBankType() == null) {
    return Result.error("类型不能为空");
}
service.add(dto);
return Result.success();
```

正确做法：把所有业务校验与编排放到 Service 聚合层。

## 2. Service 聚合层（`bi-cashier-service`）

### 2.1 职责

- 核心业务编排：跨 Component Service 调用、跨服务 Feign 调用、事务控制、阶段化日志、校验、文件变更、Excel 导出。
- 接口命名：`IXxxManageService`，含 `Manage`。
- 实现命名：`XxxManageServiceImpl`。
- 接口每个方法必须有 Javadoc（`@param` / `@return` / 业务背景）。

### 2.2 类级别注解

```java
@Slf4j
@Service
public class BankCardManageServiceImpl implements IBankCardManageService { ... }
```

### 2.3 依赖注入规则

```java
@Resource
private IBankCardService bankCardService;       // Component Service，小写驼峰变量名

@Resource
private ICommonManageService commonManageService;  // 其它 Manage Service

@Resource
private CashierManageHelper cashierManageHelper;   // Helper

@Resource
private FileManageClient fileClient;               // Feign Client
```

- 注入一律用 `javax.annotation.Resource`，不用 `@Autowired`。
- 变量名小写驼峰。
- 注入顺序：Component → 其它 Manage → Helper → Feign Client → Provider。

### 2.4 事务与异常

- 仅在需要多步写入（主表 + 子表 + 文件）的方法上加 `@Transactional(rollbackFor = Exception.class)`。
- 单步 Component 调用不必加事务注解。
- 业务校验失败：`throw new BusinessException("中文友好提示")`。
- 远程调用失败：用 `RemoteResultUtils.checkAndGetData(result)` 解包，或自实现 `checkRemoteSuccess(...)` 抛 `BusinessException`。

### 2.5 关键公共接口

| 接口 | 用途 | 参考 |
|------|------|------|
| `ICommonManageService.listCurrentCashierDepartmentManagePermissionIds(TwoLevelEnum)` | 数据权限过滤 | `CommonManageServiceImpl.java` |
| `ICommonManageService.getCurrentEmployeeId()` | 取当前用户员工 ID | 同上 |
| `ICommonManageService.getCurrentCashierDepartment()` | 取当前用户所属出纳部门 | 同上 |
| `FieldPermissionService.hasFieldPermission(TwoLevelEnum, CashierSensitiveFieldEnum)` | 敏感字段明文权限 | `FieldPermissionServiceImpl.java` |

### 2.6 Helper 与 Utils

- `CashierManageHelper`（在 `bi-cashier-component`）跨 Service 聚合层复用：`@Resource` 注入后调用，处理附件增删改。
- `CashierExportUtils`（在 `bi-cashier-service/utils`）纯静态方法类，导出场景通用：
  - 下载中心记录创建 / 文件链接批量查询 / 字典翻译 / 日期与布尔格式化。
  - 调用方传入 Feign Client，本工具类不持有 Spring 上下文。

## 3. Component 层（`bi-cashier-component`）

### 3.1 职责

- 单表基础 CRUD + Mapper 封装。
- 提供 Component 内部复用的 `Helper`、`Convert`、`TypeHandler`、`enum`、`constant`。
- **禁止**包含 `Manage`。

### 3.2 命名与继承

```java
public interface IBankCardService extends IService<BankCard> { ... }

@Service
public class BankCardServiceImpl
        extends ServiceImpl<BankCardMapper, BankCard>
        implements IBankCardService { ... }
```

### 3.3 查询与更新写法（强制）

```java
// 推荐：链式调用
List<Seal> list = this.lambdaQuery()
        .eq(Seal::getDeleted, 0)
        .in(CollUtil.isNotEmpty(ids), Seal::getId, ids)
        .orderByDesc(Seal::getCreateTime)
        .list();

// 软删除
return this.lambdaUpdate()
        .eq(Seal::getUniqueValue, uniqueValue)
        .set(Seal::getDeleted, 1)
        .update();
```

**禁止** 显式 `new LambdaQueryWrapper<>()` 或 `new QueryWrapper<>()`。

> 当前代码中存在一处反例（`StoreChangeInfoServiceImpl.deleteByStoreUniqueValue` 用 `new QueryWrapper<>()`），后续优化时改回 `lambdaQuery()` / `lambdaUpdate()`。

### 3.4 空集合返回

```java
return list == null ? Collections.emptyList() : list;
```

**禁止** 返回 `new ArrayList<>()`。

### 3.5 Helper / Convert / TypeHandler

| 类型 | 包路径 | 备注 |
|------|--------|------|
| Helper | `com.obo.bi.cashier.helper` | 多个 Component Service 复用的工具，`@Component` 注入 |
| Convert | `com.obo.bi.cashier.convert` | PO/VO/DTO 静态转换，私有构造 + 静态方法 |
| TypeHandler | `com.obo.bi.cashier.handler` | MyBatis 自定义类型转换（如 `StringListTypeHandler`） |
| 枚举 | `com.obo.bi.cashier.enums` | Component 内部枚举（如 `MatchTypeEnum`） |
| Constant | `com.obo.bi.cashier.constant` | 常量类（如 `DictTypeConstants`） |

## 4. Mapper 层（`bi-cashier-component`，XML 在 `bi-cashier-web`）

- 接口位于 `com.obo.bi.cashier.mapper`。
- 每个 Mapper 继承 `BaseMapper<Xxx>`。
- 自定义方法必须写中文 Javadoc（用途、参数、返回值）。
- 仅当方法签名有自定义 SQL 时写 XML；**占位 XML**（含 `namespace` 注释）也要建。
- XML 写法约束：
  - 列名一律起别名 `snake_case AS camelCase`。
  - 模糊查询：`LIKE CONCAT(''%'', #{xxx}, ''%'')`。
  - 大于小于：`&gt;=` / `&lt;=`。
  - IN：` <foreach collection="list" item="x" open="(" separator="," close=")">#{x}</foreach>`。
  - 入参 `@Param("name")` 必须显式，避免多参数顺序错乱。

## 5. Feign 与外部 API 边界

- 所有 Feign Client 在 `bi-xxx-api` 模块统一定义（参考 `bi-personnel.api.EmployeeFileHeadClient`、`bi-system.api.SysUserDataRoleClient`、`bi-file.api.FileManageClient`）。
- 调用方在 `bi-cashier-service/pom.xml` 引入对应 `-api` 依赖。
- 禁止在调用方本地手写 Feign 接口。
- 跨服务调用结果 `Result<T>` 必须统一用 `com.obo.core.common.utils.RemoteResultUtils.checkAndGetData(result)` 解包，失败抛 `BusinessException`。
- 业务 Service **不允许**重复实现 `checkAndGetData`，除非有差异化处理逻辑（参考 `CashierManageHelper.checkRemoteSuccess`）。

## 6. Convert 与 Utility

### 6.1 Convert（`com.obo.bi.cashier.convert`）

- 静态方法类 + 私有构造。
- 简单映射 `BeanUtils.copyProperties`。
- 复杂字段（如 JSON 字符串）需要在 Convert 中显式处理（参考 `StoreConvert.serializeCategories`）。

### 6.2 Utility（`com.obo.bi.cashier.utils`）

- 仅在 Service 聚合层需要（`bi-cashier-service/utils`）。
- 静态方法 + 私有构造 + 常量。
- 不持有 Spring 上下文依赖；Feign 客户端由调用方传入（参考 `CashierExportUtils`）。

## 7. 完整目录清单（快速参考）

> 详细到每个文件的清单见 [SKILL.md §2.2](../SKILL.md)。这里只给出每层的"骨架约定"，用于新增包时参考。

### 7.1 `bi-cashier-web` 骨架

```
src/main/java/com/obo/bi/cashier
├── controller/                       # 业务 Controller（按业务模块分文件，1 文件 1 Controller）
│   └── {业务名}Controller.java
├── config/
│   ├── aop/                          # @Aspect 切面
│   ├── config/                       # Spring 配置类（@Configuration）
│   ├── generator/                    # 代码生成器
│   └── interceptor/                  # 拦截器 / MetaObjectHandler
└── job/
    └── dto/                          # Job 的入参 DTO

src/main/resources
└── mapper/                           # 每个 Mapper 接口同名 XML（无自定义 SQL 也要占位）
```

### 7.2 `bi-cashier-service` 骨架

```
src/main/java/com/obo/bi/cashier
├── service/
│   ├── I{X}ManageService.java        # Service 聚合层接口（必须含 Manage）
│   ├── I{其他}Service.java           # 非 Manage 的 Service（如 CommonManageService、FieldPermissionService）
│   └── impl/                         # 上述接口的实现
├── utils/                            # 业务静态工具（纯静态方法 + 私有构造）
├── flowable/                         # Flowable 节点解析实现（接口在 component 层）
└── strategy/                         # 策略类
```

### 7.3 `bi-cashier-component` 骨架

```
src/main/java/com/obo/bi/cashier
├── po/                               # 实体类（继承 BaseEntity，@TableName）
├── mapper/                           # Mapper 接口（extends BaseMapper，**无 XML**）
├── service/
│   ├── I{X}Service.java              # Component Service 接口（不含 Manage）
│   └── impl/                         # 上述接口的实现（extends ServiceImpl）
├── convert/                          # PO/VO/DTO 静态转换（私有构造 + 静态方法）
├── helper/                           # 跨 Component Service 复用的 Helper（@Component）
├── handler/                          # MyBatis 自定义 TypeHandler
├── enums/                            # Component 层枚举
├── constant/                         # 常量类（DictTypeConstants 等）
└── flowable/                         # Flowable 节点网关接口（实现在 service 层）
```

### 7.4 `bi-cashier-api` 骨架

```
src/main/java/com/obo/bi/cashier
├── dto/                              # 请求入参（@Data + @ApiModel）
│   ├── {业务}PageDTO.java            # 分页查询
│   ├── {业务}SaveDTO.java            # 普通保存
│   ├── {业务}SaveRequestDTO.java     # 复合入参（含内嵌静态类）
│   └── {业务}BatchUpdateFieldDTO.java # 批量行编辑
├── vo/                               # 响应回包
│   ├── {业务}VO.java                 # 详情
│   ├── {业务}ListVO.java             # 列表
│   └── {业务}DetailVO.java           # 嵌套详情（含子表 list）
├── enums/                            # API 层枚举（Audit* 等）
├── api/                              # Feign Client 接口
└── convert/                          # API 层 DTO/VO 转换（少量）
```

### 7.5 命名一致性原则

新增任何文件/包时，按以下规则确认其归属：

| 信号 | 应当归属 |
|------|---------|
| 类名含 `Controller` | `bi-cashier-web/.../controller/` |
| 接口名含 `ManageService`，且被 Controller 直接调用 | `bi-cashier-service/.../service/` |
| 接口名含 `Service`，但不含 `Manage`，被 ManageService 调用 | `bi-cashier-component/.../service/` |
| 类名含 `Mapper`，被 Component Service 通过 baseMapper 调用 | `bi-cashier-component/.../mapper/` |
| 类名含 `DTO` 或 `RequestDTO`，是入参 | `bi-cashier-api/.../dto/` |
| 类名含 `VO`、`ListVO`、`DetailVO`，是出参 | `bi-cashier-api/.../vo/` |
| 类名含 `Client`（Feign） | `bi-cashier-api/.../api/` |
| 业务静态工具（导出、字典翻译） | `bi-cashier-service/.../utils/` |
| Component 内部组件复用（Helper、Convert、TypeHandler） | `bi-cashier-component/.../{helper,convert,handler}/` |
| Mapper XML | `bi-cashier-web/src/main/resources/mapper/` |
