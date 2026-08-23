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

---

## Controller 模式规范（来自 BankCard/Seal/Store 三 Controller 实测）

本节对照 3 个真实 Controller 提炼——按这些**实际写法**写新 Controller，不用猜测。

### 1. 路由前缀

全部 Controller 用统一业务前缀：

```
@RequestMapping("/cashier/{module}")
```

其中 `{module}` 为业务单数：bankCard、seal、store、company、operatingScope 等。**小写驼峰**，**单数**。

### 2. HTTP 方法选择：全部 POST

Controller 接口**一律用 `@PostMapping`**——即使分页查询、单字段查询也不例外：

```java
@ApiOperation("分页查询银行卡")
@PostMapping("/pageBankCard")
public Result<PageResult> pageBankCard(@RequestBody BankCardPageDTO dto) {
    return Result.success(bankCardManageService.pageBankCard(dto));
}
```

| 场景 | 用 POST 的原因 |
|------|---------------|
| 列表分页 | 入参复杂（条件多）→ `@RequestBody`；POST 不在 URL 暴露查询条件 |
| 详情（按 uniqueValue） | 仍用 POST + `@RequestParam`；统一无 GET 的接口风格 |
| 新增/更新 | 必有 `@RequestBody` |
| 删除 | 仍用 POST + `@RequestParam("uniqueValue")`；POST 不暴露资源路径 |
| 列表/下拉 | 用 `@PostMapping("/listAllXxx")` |
| 导出 | `@PostMapping("/exportXxx")` → 返回 fileId，不直接给二进制 |

> **反例**：`@GetMapping("/xxx")` 不要出现在业务接口。
> 例外：文件下载接口可以用 `Content-Type: application/octet-stream` GET（不在本规则范围）。

### 3. 入参方式

三种入参模式严格分工：

| 场景 | 注解 | 例子 |
|------|------|------|
| DTO 复合入参（多字段） | `@RequestBody XxxDTO dto` | `@RequestBody BankCardPageDTO dto` |
| 单字段（业务唯一键） | `@RequestParam("accountNumber") String accountNumber` | **必须带参数名** |
| 可选字段 | `@RequestParam(value = "x", required = false) String x` | 显式 `required = false` |

```java
// 必传：@RequestParam("accountNumber") — 必须带引号参数名
public Result<BankCardVO> queryByAccountNumber(
        @RequestParam("accountNumber") String accountNumber) { ... }

// 可选：@RequestParam(value = "uniqueValue", required = false) 
public Result<List<BankCardListVO>> listAllBankCard(
        @RequestParam(value = "uniqueValue", required = false) String uniqueValue) { ... }
```

> **禁止**：`@RequestParam(required = false)` 但字符串缺 `value`（IDE 警告且不规范）。

### 4. 返回包装：永远 `Result.success(...)`

| 接口类型 | 返回泛型 |
|---------|---------|
| 分页查询 | `Result<PageResult<XxxVO>>` — **必须有 VO 泛型**，不能写 `Result<PageResult>` |
| 详情 | `Result<XxxVO>` |
| 列表（非分页） | `Result<List<XxxVO>>` |
| 新增（返回业务 ID） | `Result<String>` — 业务唯一流水号 |
| 更新/删除成功 | `Result<Boolean>` —— `return Result.success(true)` |
| 异常流程 | `Result.error("中文提示")` —— **仅在业务上不可能成功的路径** 使用 |

```java
// 成功：Result.success(...)
return Result.success(manageService.xxx(dto));

// 业务不可能成功：Result.error
String accountNumber = bankCardManageService.addBankCard(dto);
return accountNumber != null
        ? Result.success(accountNumber)
        : Result.error("新增失败");
```

### 5. 方法命名（业务动词 + 业务对象）

| 业务动作 | 方法名 | 路由前缀 |
|---------|--------|---------|
| 分页查询 | `pageXxx` 或 `pageXxxAll`（复合） | `/pageXxx` |
| 详情（按 uniqueValue） | `queryXxxDetail` / `queryXxxByXxx` | `/queryXxxDetail` |
| 详情（按业务 ID） | `queryByAccountNumber`（驼峰） | `/queryByAccountNumber` |
| 新增 | `addXxx` 或 `addXxxAll`（复合入参） | `/addXxx` |
| 更新 | `updateXxx` 或 `updateXxxAll` | `/updateXxx` |
| 软删（按 uniqueValue） | `deleteXxx` | `/deleteXxx` |
| 批量行编辑 | `batchUpdateXxxField` 或 `batchUpdateXxx` | `/batchUpdateField` |
| 全量列表（含绑定/下拉） | `listAllXxx` / `listAllXxxWithBindStatus` | `/listAllXxx` |
| 导出 | `exportXxx` | `/exportXxx` |
| 按外键查（如按公司） | `listXxxByCompany` / `listXxxByCompanyUniqueValue` | `/listXxxByCompany` / `/listStoreByCompanyUniqueValue` |
| 唯一性校验 | `isXxxExists` / `isXxxUsedAsXxx` | `/isXxxExists` |

**复合主从表**用 `addXxxAll` / `updateXxxAll` —— `All` 后缀表示"主表+子表+附件一起"。

### 6. 路由路径命名

路由 = 方法名小驼峰：

```
pageBankCard()      → @PostMapping("/pageBankCard")
addBankCard()       → @PostMapping("/addBankCard")
listAllBankCard()   → `@PostMapping("/listAllBankCard")
listStoreByCompanyUniqueValue() → `/listStoreByCompanyUniqueValue`
batchUpdateField()  → `/batchUpdateField`（业务动词通用化）
```

### 7. 注入字段规范

```java
@Resource                                  // JSR-250 注入，不用 @Autowired
private IBankCardManageService bankCardManageService;   // 接口类型，小写驼峰
```

| 字段名 | 例子 |
|--------|------|
| 类型 | `IXxxManageService`（**接口**，不是 Impl） |
| 变量名 | `xxxManageService`，全部小写驼峰 |

### 8. 类级 Javadoc（必备）

每个 Controller 必须有详细类级 Javadoc：用 `<ul><li>` 枚举接口清单：

```java
/**
 * 出纳-印章管理
 * <p>
 * 接口列表（N 个，对齐前端 Seal 模块实际使用）：
 * <ul>
 *   <li>pageSeal            - 列表分页（名称模糊 + 公司/类型多选）</li>
 *   <li>querySealDetail     - 详情（回显表单）</li>
 *   ...
 * </ul>
 * </p>
 */
@Api(tags = "出纳-印章管理")
@RestController
@RequestMapping("/cashier/seal")
public class SealController { ... }
```

### 9. 类注解顺序（自上而下，固定）

```java
@Api(tags = "出纳-XXX管理")      // 1. Swagger 分类
@RestController                 // 2. 容器注解
@RequestMapping(...)            // 3. 框架注解
public class XxxController { ... }
```

**禁止顺序**：`@RestController` 在 `@Api` 之前 → Swagger 文档分组错。

### 10. 方法注解顺序

```java
@ApiOperation("方法中文描述")       // 1. Swagger 描述
@PostMapping("/xxx")            // 2. 路由
public Result<XxxVO> xxx(...) { ... }    // 3. 方法签名
```

> 禁止 `@PostMapping` 在 `@ApiOperation` 之前。

### 11. 业务转发（一行原则）

Controller **不写业务逻辑**——绝大部分方法 1 行：

```java
public Result<PageResult> pageBankCard(@RequestBody BankCardPageDTO dto) {
    return Result.success(bankCardManageService.pageBankCard(dto));
}
```

复杂 Controller 才允许 2-3 行处理（如 fallback 分支、参数默认值）：

```java
public Result<String> addBankCard(@RequestBody BankCardSaveDTO dto) {
    String accountNumber = bankCardManageService.addBankCard(dto);
    return accountNumber != null
            ? Result.success(accountNumber)
            : Result.error("新增失败");
}
```

### 12. @ApiOperation 文案规范

`@ApiOperation("...")` 文案要求：

- **中文**（`description` 默认值）
- 动词 + 业务对象，如 `分页查询银行卡`、`新增印章`
- 复杂方法补充**括号说明参数语义**：`列表批量行编辑，按账号 account_number 列表定位`
- 对齐前端模块名：可加 `（对齐前端 createSeal）` 帮助追溯

### 13. 完整 Controller 模板

```java
package com.obo.bi.cashier.controller;

import com.obo.bi.cashier.dto.XxxPageDTO;
import com.obo.bi.cashier.dto.XxxSaveDTO;
import com.obo.bi.cashier.service.IXxxManageService;
import com.obo.bi.cashier.vo.XxxDetailVO;
import com.obo.bi.cashier.vo.XxxListVO;
import com.obo.core.common.entity.result.PageResult;
import com.obo.core.common.entity.result.Result;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import java.util.List;

/**
 * 出纳-XXX管理
 * <p>接口列表（N 个，对齐前端 Xxx 模块实际使用）：</p>
 * <ul>
 *   <li>pageXxx       - 列表分页</li>
 *   <li>queryXxxDetail - 详情</li>
 *   <li>addXxx        - 新增</li>
 *   <li>updateXxx     - 更新</li>
 *   <li>deleteXxx     - 删除（按 uniqueValue 软删）</li>
 * </ul>
 */
@Api(tags = "出纳-XXX管理")
@RestController
@RequestMapping("/cashier/xxx")
public class XxxController {

    @Resource
    private IXxxManageService xxxManageService;

    @ApiOperation("分页查询XXX")
    @PostMapping("/pageXxx")
    public Result<PageResult<XxxListVO>> pageXxx(@RequestBody XxxPageDTO dto) {
        return Result.success(xxxManageService.pageXxx(dto));
    }

    @ApiOperation("查询XXX详情")
    @PostMapping("/queryXxxDetail")
    public Result<XxxDetailVO> queryXxxDetail(@RequestParam("uniqueValue") String uniqueValue) {
        return Result.success(xxxManageService.queryXxxDetail(uniqueValue));
    }

    @ApiOperation("新增XXX")
    @PostMapping("/addXxx")
    public Result<String> addXxx(@RequestBody XxxSaveDTO dto) {
        return Result.success(xxxManageService.addXxx(dto));
    }

    @ApiOperation("更新XXX")
    @PostMapping("/updateXxx")
    public Result<Boolean> updateXxx(@RequestBody XxxSaveDTO dto) {
        xxxManageService.updateXxx(dto);
        return Result.success(true);
    }

    @ApiOperation("删除XXX（按 uniqueValue 软删）")
    @PostMapping("/deleteXxx")
    public Result<Boolean> deleteXxx(@RequestParam("uniqueValue") String uniqueValue) {
        xxxManageService.deleteXxx(uniqueValue);
        return Result.success(true);
    }
}
```

### 14. 反例清单

- `Result<PageResult>`（裸 PageResult）→ 必须 `Result<PageResult<XxxVO>>`
- `@Autowired` → 必须 `@Resource`
- `IxxxService` 注入 → 必须注入 `IXxxManageService`（聚合层接口）
- `@RequestParam(required = false)` 不带 `value=` → 必须带 `value="x"`
- `@PostMapping` 写在 `@ApiOperation` 之前 → 顺序反了
- `getBankCard/{id}` 用 `@GetMapping` + `@PathVariable` → 业务接口必须 POST + `@RequestParam`
- 路由前缀 `/api/...`（其它业务前缀）→ 必须 `/cashier/...`
- 方法体超过 5 行 → 业务逻辑在 Controller 了，应该下沉到 ManageService
- `@RequestMapping("/xxx")` 用非业务前缀 → 必须 `/cashier/{module}`
- `/{uniqueValue}/xxx` 业务键塞路径段 → 必须拍扁成静态路径
- `query + body` 混用同一个业务键（`@RequestParam("unique_value")` + `@RequestBody DTO`） → 入参必须对象化，`uniqueValue` 合进 DTO
- `≥2 个独立变量` 走 `@RequestParam` 拆参 → 必须合进 DTO 用 `@RequestBody`
- 单变量接口（仅 `uniqueValue` / `employeeId`）强行新建 `XxxDetailQueryDTO`（1 字段）→ 浪费，走 `@RequestParam` 即可
- `Service / Helper` 形参 ≥ 3 个却用并列参数列表 → 必须封 DTO（§15.3）
- DTO ↔ PO 同名字段 ≥ 3 条仍手写 `setX` → 必须 `BeanCopyUtils.copy`（§15.4）
- 业务校验失败 / CAS 冲突 / 远端 RPC 返回 null / 反射写入完成等关键位置不打日志 → 必须补 `log.warn` / `log.info` 输出业务键（§15.5）
- `Controller` 写日志 → 责任在 Service 聚合层
- `catch (e) { e.printStackTrace(); }` 吞错 → 必须 `log.warn` + `throw new BusinessException`

### 15. API 入参对象化（≥2 变量入参必须 DTO；不要 query + body 混用）

**总规则**：业务接口入参的"独立变量" ≥ 2 个时，**必须**收进一个 DTO 用 `@RequestBody` 接住，**禁止** `@RequestParam` 与 `@RequestBody` 同时出现，也禁止业务标识塞进 URL 路径段（`@PathVariable`）。`@RequestParam` 仅服务于"单变量且不会再扩"接口（如唯一详情查、唯一软删）。

```java
// ✅ 正确（≥2 变量）—全部进 DTO
@PostMapping("/updateOnboarding")
public Result<OnboardingSaveVO> update(@RequestBody OnboardingUpdateDTO dto) {
    return Result.success(onboardingManageService.update(dto.getUniqueValue(), dto));
}

// ✅ 正确（单变量）—可以用 @RequestParam
@PostMapping("/queryCashierOnboardingDetail")
public Result<OnboardingDetailVO> detail(
        @RequestParam("unique_value") String uniqueValue) { ... }

// ❌ 错误：query + body 混用（重复表达同一个业务键）
@PostMapping("/{uniqueValue}/update")
public Result<OnboardingSaveVO> update(
        @PathVariable("uniqueValue") String uniqueValue,
        @RequestBody OnboardingUpdateDTO dto) { ... }

// ❌ 错误：把"对 uniqueValue 的操作"硬拆成两个入参
@PostMapping("/updateOnboarding")
public Result<OnboardingSaveVO> update(
        @RequestParam("unique_value") String uniqueValue,
        @RequestBody OnboardingUpdateDTO dto) { ... }
```

**判定标准（写新接口时按这个问自己）**：

| 场景 | 入参形态 | 取舍 |
|------|---------|------|
| 单变量（仅 `uniqueValue`、`employeeId` 这类唯一键） | `@RequestParam("xxx_id") String xxxId` | ✅ 单变量可以保留 query，路径拍扁 |
| 单变量 + DTO 不存在或纯复 1 字段 | 新建 `XxxDetailQueryDTO`（1 字段） | ❌ 不必建，复 1 字段直接走 query 即可 |
| ≥ 2 变量（含"唯一键 + 业务字段"或"两个业务键"） | 全部 `@RequestBody`，DTO 内含 `uniqueValue` 字段 | ✅ 唯一选择 |
| 路径段里出现 `uniqueValue` / `businessKey` / `nodeCode` | 一律搬到 query 或 DTO | ❌ 任何路径段都不允许 |

**反面典型（2026-08，三次返工沉淀）**：`OnboardingController` 的最早实现是 `/cashier/store/audit/onboarding/{uniqueValue}/detail|update|submit|approve|reject|nodes/{nodeCode}|delete` 7 个路径段表达"按 uniqueValue 操作"，后改为 query 携带 `unique_value=&node_code=`，最终形态：**`unique_value` 收进 DTO 内 `@RequestBody`**，只有 detail / delete 这两个单变量接口才保留 `@RequestParam`。最终 URL 全部拍扁：

| 最终路径 | 入参 |
|---------|------|
| `POST /cashier/store/audit/onboarding/pageOnboarding` | `@RequestBody OnboardingPageDTO` |
| `POST /cashier/store/audit/onboarding/createOnboarding` | `@RequestBody OnboardingCreateDTO` |
| `POST /cashier/store/audit/onboarding/queryCashierOnboardingDetail` | `@RequestParam("unique_value") String uniqueValue`（单变量） |
| `POST /cashier/store/audit/onboarding/updateOnboarding` | `@RequestBody OnboardingUpdateDTO`（含 `uniqueValue`） |
| `POST /cashier/store/audit/onboarding/submitCashierOnboarding` | `@RequestBody OnboardingSubmitDTO`（含 `uniqueValue`） |
| `POST /cashier/store/audit/onboarding/approveCashierOnboarding` | `@RequestBody OnboardingApproveDTO`（含 `uniqueValue`） |
| `POST /cashier/store/audit/onboarding/rejectCashierOnboarding` | `@RequestBody OnboardingRejectDTO`（含 `uniqueValue`） |
| `POST /cashier/store/audit/onboarding/saveCashierOnboardingNodeData` | `@RequestBody OnboardingNodeDataSaveDTO`（含 `uniqueValue` + `nodeCode`） |
| `POST /cashier/store/audit/onboarding/deleteCashierOnboarding` | `@RequestParam("unique_value") String uniqueValue`（单变量） |

**为什么不允许 `query` + `body` 混用，也不允许业务标识进 URL 路径段**：

1. **同语义单形态**：同一个业务键（`uniqueValue`），要么走 query、要么走 body body 字段，**不要两种形态并存**——避免前端怕显式（`params: { unique_value }`）、混用改 path 时漏改的隐患。
2. **入参对象化**：≥ 2 变量时走 DTO，新增字段不影响接口签名；只改 DTO 内部即可，不再撞接口契约、Swagger 文档、Feign Client 三处。
3. **路径段污染**：路径里的业务键会污染反向代理 / CDN / API 网关缓存键，让"按 uniqueValue 操作"在缓存层无法复用。
4. **审计 / `@PreAuthorize`**：统一 `@RequestBody` 后，操作日志、权限校验、Flowable 任务关联都从同一个 DTO 取值，没有"路径里的 `uniqueValue` vs body 里的 `uniqueValue` 是否一致"的二次校验。
5. **复盘教训**：先拍成 query、再拍扁成 body（中间状态）——两次返工比一次返工更费时；新写接口直接判定"≥2 变量 → 走 DTO"，避免来回改。

**对前端 & Feign Client 的影响**：

- 前端 `apis/index.ts`：从 `params: { unique_value }` 改成 `data: { ...data, uniqueValue }`（DTO 原生字段名驼峰）；request 工具支持的 `data` / `params` 形态都在（参考 `src/pages/employee/apis/index.ts`）。
- 同步脚本（`scripts/onboarding-flow.mjs`）：把 `request(path, "POST", { unique_value })` 改为 `request(path, "POST", { uniqueValue, ...body })`，删掉 `onboardingParams()` 这种过渡 helper。
- Feign Client 的 `@RequestBody` 入参定义不要回退到 `@PathVariable` / `@RequestParam` 上，否则上游调用方和 `@RequestBody` 入参又有两份签名。

**Service 实现层的入参**：仍然保留 `(String uniqueValue, DTO dto)`（双变量）——这样 Controller 用 `dto.getUniqueValue()` 取出来传入，与"业务键 + 业务载荷"的语义一致；不要为了避免双形参，把 DTO 的 `uniqueValue` 字段删掉。

### 15.3 Service / Helper 入参对象化（≥3 形参必须封 DTO）

**规则**：Service 聚合层、Component Service、私有 helper 等**任意方法**形参 ≥ 3 个时，必须封装 DTO / Req 收参。`com.obo.bi.cashier.flowable.dto.*` 已经定义好 `CompleteTaskResultDTO` / `StartProcessResultDTO` / `TaskItemSnapshotDTO` 等快照类，沿用即可。

```java
// ✅ 正确：返回快照 / RPC DTO 封装
private StartProcessResultDTO startProcess(String uniqueValue, String initiator, Map<String, Object> variables) { ... }

// ✅ 正确：私有 helper 3 形参，封装为 Req
record CompleteTaskReq(String operationId, String taskId, String outcome, String comment, ...) { }
private CompleteTaskResultDTO completeTask(CompleteTaskReq req) { ... }

// ❌ 反例：私有 helper 4-7 个并列形参
private CompleteTaskResultDTO completeTaskInternal(String operationId, String twoLevelId,
        String taskId, String outcome, String comment,
        Map<String, Object> variables, String userId) { ... }
```

**例外**（私有 RPC 拼接 helper，保留 3-4 形参 OK）：

- `completeTaskInternal(operationId, taskId, outcome, comment)`：核心 RPC 字段集合，调用方全部固定本模块常量（`TWO_LEVEL_ID_CWSH`），新增字段概率低。这是底层 RPC 拼接 helper，不算业务方法，**允许**继续走形参列表。
- 形参数量 ≤ 3 且语义相关、可一眼读懂的 helper。

不允许把"5+ 形参的复杂业务方法"伪装成"helper"绕过规则——业务方法必须用 DTO。

### 15.4 同名字段对象赋值用 BeanCopyUtils

**规则**：两个对象（DTO ↔ PO、PO ↔ VO、DTO ↔ VO）或两个集合互转，**同名字段 ≥ 3 条**时必须使用 `com.obo.core.common.utils.BeanCopyUtils.copy(src, Xxx::new)` / `BeanCopyUtils.copyList(src, Xxx::new)`，禁止手写 5+ 行 `setX` 块。

```java
// ✅ 正确：批量赋值 + 兜底
OnboardingStore store = BeanCopyUtils.copy(row, OnboardingStore::new);
store.setApplicationId(application.getId());                 // PO 独有 / 跨表外键
store.setApplicationUniqueValue(application.getUniqueValue());// PO 独有 / 跨表外键
store.setRowNo(row.getRowNo() != null ? row.getRowNo() : rowNo++); // 默认值兜底
store.setRowVersion(0);                                     // 默认值兜底

// ✅ 正确：集合整体转换
List<OnboardingListItemVO> list = BeanCopyUtils.copyList(records, OnboardingListItemVO::new);

// ❌ 错误：20+ 行手动 setX（同名字段全部重复）
OnboardingStore store = new OnboardingStore();
store.setApplicationId(application.getId());
store.setApplicationUniqueValue(application.getUniqueValue());
store.setRowNo(...);
store.setStoreUniqueValue(...);
store.setStoreCode(...);   // 10+ 个 set 全部与 row 对应字段同名
store.setStoreName(...);
// ... 18 行 ...
```

**字段少的场景**：同名字段 ≤ 2 条的手写 setX 仍允许（不值得为兜底字段再引入 copy）。

**字段名错位的解决方案**：不要因为 DTO 与 PO 字段名"略有差异"就拒绝 BeanCopyUtils——先 copy，再对**字段名不一致的少数字段**手动 set：

```java
// 字段名对齐：DTO.platform → PO.platform（一致字段全拷贝）
// 字段名错位：DTO.accountName → PO.bankAccountName（不一致字段手动补）
bankCard = BeanCopyUtils.copy(dto, BankCard::new);
bankCard.setBankAccountName(dto.getAccountName());
bankCard.setBankCode(dto.getBankCode());   // 不一致的也手动补
```

**反面典型（2026-08，已重构）**：`OnboardingManageServiceImpl` 早期 `create()` / `update()` 内对 `OnboardingStore` 做了 20 行 `setX`；`savePreparations()` 内对 `OnboardingGrounding` 做了 15 行 `setX`。整改后用 `BeanCopyUtils.copy(row, OnboardingStore::new)` / `BeanCopyUtils.copy(preparation, OnboardingGrounding::new)`，每个循环体由 20+ 行降到 7 行。

### 15.5 关键位置日志补全

**规则**：Service 聚合层在以下"业务关键位置"必须打日志，输出业务键便于问题定位。Controller 不打日志（一行转发）。

| 场景 | 日志级别 | 输出字段 |
|------|----------|---------|
| 业务开始（`page` / `create` / `update` / 流程编排开始） | `log.info` | `uniqueValue` / `applicantId` / `operator` / `itemCount` / `saveMode` |
| CAS 冲突（乐观锁失败） | `log.warn` | `uniqueValue` / `operator` / `expectedVersion` / `fromNodeNo` / `idempotencyKey` |
| 业务校验失败（拼装到 throw 前） | `log.warn` | `uniqueValue` / `storeCode` / `taskId` / 不通过原因 |
| 远端 RPC 调用前 | `log.info` | `operationId` / `taskId` / `targetActivityId` / `userId` |
| 远端 RPC 返回 null | `log.warn` | `uniqueValue` / `taskId` / `operator` / `idempotencyKey` |
| 字段反射 / 子资源写入数 | `log.info` | `uniqueValue` / `applicationStoreId` / `fieldCount` / `subAccountCreated` |
| 业务结束 | `log.info` | `uniqueValue` / `fromNodeNo` / `toNodeNo` / `newStatus` / `handler` |

```java
// ✅ 正确：在关键 throw 之前先 warn 留痕（业务可重放错误码与入参）
if (flowResult == null) {
    log.warn("上架申请驳回-远端返回空：uniqueValue={}, taskId={}, targetActivityId={}, operator={}, idempotencyKey={}",
            uniqueValue, taskId, targetActivityId,
            SecurityContextHolder.getUserName(), dto.getIdempotencyKey());
    throw new BusinessException("驳回处理失败，请稍后重试");
}

// ✅ 正确：循环内每次子资源创建都计数
int subAccountCreated = 0;
for (SubAccount sub : items) {
    ... storeSubAccountService.addSubAccount(sa);
    subAccountCreated++;
}
log.info("上架节点 10 子账号保存完成：uniqueValue={}, storeUniqueValue={}, subAccountCreated={}",
        uniqueValue, storeUniqueValue, subAccountCreated);
```

**反面典型（2026-08，已补全）**：`OnboardingManageServiceImpl` 早期 `approve()` 远端返回 null 时只抛 `BusinessException`，无前置 `log.warn`，事后审计日志里看不到是哪个 `uniqueValue` / `taskId` 触发。`saveNodeData` 反射写入 / 子账号保存完成没有统计日志。整改后以上日志均在。

**禁止**：

- 业务校验失败用 `try { ... } catch (e) { e.printStackTrace(); }` 吞错 —— 必须 `log.warn` + `throw`。
- Controller 里写日志 —— Controller 只做"一行转发"，日志责任在 Service。
- 日志输出长度无限制（拼一大段 JSON）—— 只输出业务键：`uniqueValue` / `taskId` / `idempotencyKey` / `count`，不要把 DTO 整个打印。

---

## 调用链规范（Controller → ManageService → Component Service → Mapper）

本章对照实际调用链 BankCardController → IBankCardManageService → IBankCardService → BankCardMapper → BankCardMapper.xml 提炼。每一层职责、约束、接口契约都有明确写法。

### 1. 调用链总览

```
HTTP POST /cashier/{module}/xxx
   ↓
┌─────────────────────────────────┐
│ Controller（bi-cashier-web）    │  § 1.1 一行转发
│ - BankCardController             │
└──────────────┬──────────────────┘
               │ bankCardManageService.pageBankCard(dto)
               ↓
┌─────────────────────────────────┐
│ Service 聚合层（bi-cashier-service）│  § 1.2 业务编排
│ - IBankCardManageService         │
│ - BankCardManageServiceImpl     │
└──────────────┬──────────────────┘
               │ bankCardService.pageBankCard(dto)
               ↓
┌─────────────────────────────────┐
│ Component 层（bi-cashier-component）│  § 1.3 数据访问
│ - IBankCardService               │
│ - BankCardServiceImpl        ─┐  │
│   extends ServiceImpl          │  │
└───────────────────────────────┼──┘
                                │ baseMapper.pageBankCard(page, dto)
                                ↓
┌─────────────────────────────────┐
│ Mapper 接口（bi-cashier-component）│  § 1.4 数据库 CRUD
│ - BankCardMapper                 │
└──────────────┬──────────────────┘
               │ MyBatis 调度
               ↓
┌─────────────────────────────────┐
│ Mapper XML（bi-cashier-web resources）│  § 1.5 SQL
│ - BankCardMapper.xml             │
└─────────────────────────────────┘
```

### 2. Controller → ManageService（一行原则）

```java
@ApiOperation("分页查询银行卡")
@PostMapping("/pageBankCard")
public Result<PageResult> pageBankCard(@RequestBody BankCardPageDTO dto) {
    return Result.success(bankCardManageService.pageBankCard(dto));
}
```

**约束**：
- Controller 调的是 `IXxxManageService` 接口（**不是 Impl**）
- 1 行 `return Result.success(manageService.xxx(dto))` 是绝大多数
- 复杂 Controller 方法可以 2-3 行（处理 fallback 错误码等）
- **绝不**写业务逻辑

### 3. ManageService → Component Service（业务编排）

```java
// 简单查询：1 行转发
@Override
public PageResult pageBankCard(BankCardPageDTO dto) {
    return bankCardService.pageBankCard(dto);
}

// 导出（复杂编排）：阶段化注释 + 跨 Component + 跨 Feign + 跨 Helper
@Override
public String exportBankCard(BankCardPageDTO dto) {
    log.info("银行卡信息导出[开始]");
    // 1. 创建下载中心记录
    String userName = BaseContext.getUserName();
    String fileName = CashierExportUtils.buildExportFileName("银行卡信息");
    String fileId = CashierExportUtils.createDownloadRecord(fileClient, userName, fileName);
    // 2. 复用列表查询拉取当前筛选下全部数据
    BankCardPageDTO queryDTO = dto == null ? new BankCardPageDTO() : dto;
    queryDTO.setPageNum(1);
    queryDTO.setPageSize(CashierExportUtils.EXPORT_PAGE_SIZE);
    PageResult pageResult = bankCardService.pageBankCard(queryDTO);
    // 3. 转 VO、调用字典翻译、构造 Excel 数据
    List<BankCard> bankCardList = (List<BankCard>) pageResult.getRecords();
    // ... 略
    return fileId;
}
```

**约束**：
- ManageService 注入 `IXxxService`（Component Service 接口，**不是** Impl）
- 业务编排：阶段化注释（`// 1.`、`// 2.`）、方法体 ≤ 80 行
- 跨 Component 调用 OK（@Transactional 范围内安全）
- 跨 Feign 调用：`FileManageClient`、`DataDictionaryProvider` 等
- 跨 Helper 调用：`CashierManageHelper.fileChange(...)` 等
- 前置校验：业务规则校验放这里（DTO 注解校验 + 业务唯一性等）
- 业务异常 `throw new BusinessException("中文提示")`
- 日志：`@Slf4j` + `log.info("[开始]xxx")` + 阶段注释

**依赖注入数量限制**：按 skills §2 阈值，`@Resource` 注入 ≤ 6 个。`BankCardManageServiceImpl` 实际有 9 个（多 Feign + Helper）—— 这是**反例**，应拆 Facade-Manager（按 `references/concerns-separation.md` §3.1）。

### 4. Component Service → Mapper（数据访问）

```java
@Service
public class BankCardServiceImpl
        extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl<BankCardMapper, BankCard>
        implements IBankCardService {

    @Override
    public PageResult pageBankCard(BankCardPageDTO dto) {
        Page<BankCard> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<BankCard> result = baseMapper.pageBankCard(page, dto);
        List<BankCard> records = result.getRecords();
        // 业务逻辑（已选项前置）：写在 Component 内部
        if (dto.getPageNum() != null && dto.getPageNum() == 1
                && CollUtils.isNotEmpty(dto.getSelectedAccountNumbers())) {
            // ... 已选项处理
            records = exactList;
        }
        return new PageResult(result.getTotal(), records);
    }
}
```

**约束**：
- 必须 `extends ServiceImpl<XxxMapper, Xxx>`
- 调 Mapper 用 `baseMapper`（不是 `@Autowired XxxMapper mapper`）
- 业务逻辑（**简单**）：合并、组装、过滤——可以在 Component 层
- 复杂业务逻辑（事务、跨表、跨服务）必须**下沉到 ManageService**
- 业务异常不要抛（Component 不做业务校验）
- 软删除：`this.lambdaUpdate().set(Xxx::getDeleted, 1).eq(...).update()`
- 不要 `new QueryWrapper<>()` / `new LambdaQueryWrapper<>()`（必须用 `this.lambdaQuery()` / `this.lambdaUpdate()` 链式）

### 5. Mapper 接口（bi-cashier-component 包）

```java
@Mapper
public interface BankCardMapper extends BaseMapper<BankCard> {

    /**
     * 分页查询银行卡。
     *
     * @param page MyBatis-Plus 分页对象
     * @param dto 查询条件
     * @return 分页结果
     */
    IPage<BankCard> pageBankCard(Page<BankCard> page, @Param("dto") BankCardPageDTO dto);

    /**
     * 根据账号统计数量。
     *
     * @param accountNumber 账号
     * @param excludeId 排除的 ID
     * @return 数量
     */
    int countByAccountNumber(@Param("accountNumber") String accountNumber, @Param("excludeId") Long excludeId);
}
```

**约束**：
- 必须 `extends BaseMapper<Xxx>`（即便无自定义方法）
- `@Param` 必须显式（MyBatis 多参数要求）
- 方法必须有 Javadoc（用途、`@param`、`@return`）
- XML 方法顺序可以与接口方法不一致，但同名一一对应

### 6. Mapper XML（bi-cashier-web/resources/mapper）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.obo.bi.cashier.mapper.BankCardMapper">

    <select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">
        SELECT id AS id, account_number AS accountNumber, account_name AS accountName,
               bank_code AS bankCode, bank_name AS bankName, ...
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
        ...
    </select>

    <select id="countByAccountNumber" resultType="java.lang.Integer">
        SELECT COUNT(*) FROM cashier_bank_card
        WHERE deleted = 0 AND account_number = #{accountNumber}
        <if test="excludeId != null">
            AND id != #{excludeId}
        </if>
    </select>

</mapper>
```

**关键约束**：
- `namespace` 必须指向 Mapper 接口全限定类名
- 列名一律别名 `snake_case AS camelCase`（保证与 PO 驼峰字段对应）
- `WHERE deleted = 0` 软删除必备
- `<if>` 判空：`!= null and != ''`（字符串）/ `!= null and size() > 0`（集合）
- `<foreach>` IN 查询：必须有 `collection` `item` `open` `separator` `close`
- `>=` `<=` 用 `&gt;=` `&lt;=` 转义
- 模糊查询：`LIKE CONCAT('%', #{x}, '%')`
- 返回值 `resultType`：`com.obo.bi.cashier.po.Xxx`（PO 路径）或 `java.lang.Integer`（count）

### 7. 调用链各层的接口契约

| 层 | 接口名 | 包路径 | 命名 |
|---|--------|--------|------|
| Controller | （无接口，直接 `@Resource`） | `com.obo.bi.cashier.controller` | `XxxController` |
| ManageService | `IXxxManageService` | `com.obo.bi.cashier.service` | 接口 |
| ManageService Impl | `XxxManageServiceImpl` | `com.obo.bi.cashier.service.impl` | 实现 |
| Component Service | `IXxxService` extends `IService<T>` | `com.obo.bi.cashier.service` | 接口 |
| Component Service Impl | `XxxServiceImpl` extends `ServiceImpl<M, T>` | `com.obo.bi.cashier.service.impl` | 实现 |
| Mapper | `XxxMapper` extends `BaseMapper<T>` | `com.obo.bi.cashier.mapper` | 接口 |
| Mapper XML | `XxxMapper.xml` | `resources/mapper/` | XML |

### 8. 跨层调用 — 实战速查

| 调用 | 写法 | 备注 |
|------|------|------|
| Controller 调 ManageService | `bankCardManageService.pageBankCard(dto)` | 1 行 |
| Controller 调 ManageService（带 fallback） | `Result.success(...)` / `Result.error("...")` | 复杂业务 |
| ManageService 调 Component Service | `bankCardService.pageBankCard(dto)` | 同包，直接调用 |
| ManageService 调 Feign | `fileClient.queryFileUploadRecordMap(queryDTO)` | Feign 接口 |
| Component Service 调 Mapper | `baseMapper.pageBankCard(page, dto)` | lambdaQuery / XML |
| Component Service 调自身方法 | `this.lambdaQuery()...eq(...)` | 链式 |

### 9. 异常传播

| 层 | 抛什么 | 接什么 |
|---|--------|--------|
| Controller | `Result.error("...")` | 业务返回值 |
| ManageService | `throw new BusinessException("中文提示")` | 由全局异常处理 |
| Component Service | **不抛业务异常** | 仅抛系统异常（`IllegalArgumentException`） |
| Mapper | 不抛 | 让 MyBatis 抛 `PersistenceException` |

### 10. 事务边界

| 场景 | 事务位置 | 注解 |
|------|---------|------|
| 单表 CRUD | 不需要 | 无 |
| 跨 Component 写入（主从表） | ManageService | `@Transactional(rollbackFor = Exception.class)` |
| 跨 Mapper 写入 | ManageService | `@Transactional(rollbackFor = Exception.class)` |
| Component 内多步 `lambdaUpdate` | Component Service | `@Transactional(rollbackFor = Exception.class)` |
| 跨服务（Feign + 本地） | ManageService | `@Transactional`（注意 Feign 不参与事务） |

### 11. 反例清单（针对调用链）

- Controller 调 `IXxxService`（不含 Manage）—— 越级
- Controller 调 `XxxServiceImpl`（实现）—— 越级 + 绑实现
- ManageService 调 `IXxxManageService`（同层）—— 同层依赖，应合并
- Component Service 写 `@Transactional` 处理跨表写入 —— Component 只能单表事务
- Component Service 抛 `BusinessException("...")` —— 业务逻辑混入数据层
- ManageService 直接 `lambdaQuery()` 拼 SQL —— 应下沉到 Component
- Mapper 接口与 XML 不在同一个工程模块（XML 在 web）—— 实际是对的，但确认 `namespace` 指向正确
- Mapper 接口自定义方法没对应 XML —— 编译失败
- Mapper 接口完全继承 BaseMapper 但没 XML —— 占位缺失（已修复成占位）
- 跨表 JOIN 在 Service 聚合层用 `lambdaQuery.select("xxx AS xxx").groupBy(...)` —— 应写在 XML

### 12. 调试调用链的 3 个标准问题

```
1. Controller 调谁？ → IXxxManageService（一行转发）
2. ManageService 调谁？ → 多个 IXxxService + FeignClient + Helper（业务编排）
3. Component Service 调谁？ → baseMapper.(Page<D>, DTO)（数据访问）
```

任何一层做错职责，立即红 — 按 §11 反例清单查。
