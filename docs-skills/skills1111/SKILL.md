---
name: "bi-cashier-java-standard"
description: "OBO BI 出纳模块 Java 开发规范。适用于 bi-cashier 模块的新增功能、代码审查、DTO/VO/PO 字段调整、Mapper SQL 编写。"
---

# bi-cashier Java 开发规范

本模块继承 OBO BI Java 开发规范，针对出纳模块的特性做了补充说明。

## 核心规范

### 分层命名

| 层级 | 模块 | 命名规则 |
|------|------|---------|
| Web | bi-cashier-web | XxxController.java |
| Service 聚合层 | bi-cashier-service | IXxxManageService.java / XxxManageServiceImpl.java |
| Component 层 | bi-cashier-component | IXxxService.java / XxxServiceImpl.java |
| Mapper | bi-cashier-component | XxxMapper.java + XxxMapper.xml |
| PO | bi-cashier-component | Xxx.java |
| DTO/VO | bi-cashier-api | XxxDTO.java / XxxVO.java |

### 职责边界一览

| 层 | 允许 | 禁止 |
|----|------|------|
| Web / Controller | 调用 ManageService；包装 `Result.success`；类 Javadoc；Swagger 注解（`@Api` / `@ApiOperation`，中文）；入参基本校验 | 集合转换、循环赋值、批量查询、写业务逻辑、`import` Mapper |
| Service 聚合（`-service`） | 编排业务、跨 Component 调用、跨服务 Feign、事务（`@Transactional(rollbackFor = Exception.class)`）、阶段化日志、复合 DTO 编排、`ICommonManageService` / `FieldPermissionService` 调用 | 直接调用 Mapper、`new LambdaQueryWrapper<>()` / `new QueryWrapper<>()`、手写 SQL |
| Component（`-component`） | 单表 CRUD（`this.lambdaQuery()` / `this.lambdaUpdate()` 链式）、Mapper XML 编写、Helper / Convert / TypeHandler / 内部 enum / constant | 跨业务编排（除非抽为 `@Component` Helper）、调用其它业务 Service 或跨服务 Feign |
| API（`-api`） | 定义 DTO / VO / 枚举 / Feign Client；少量公共 convert | 任何业务逻辑、`@Service`、Mapper 调用 |

**调用方向是唯一的**：`Controller → ManageService → Component → Mapper`。任意反向或越级调用视为违规。

### 关键规则

1. **Service 聚合层** 接口以 `Manage` 后缀命名，**禁止** `Manage` 后缀出现在 Component 层。
2. **Component 层** 继承 MyBatis-Plus `ServiceImpl`，**禁止**含 `Manage` 后缀。
3. **Web 层** 只能调用 Service 聚合层，禁止越级调用 Component。
4. **DTO/VO** 字段使用驼峰命名（数据库列名下划线由 `@TableField("snake_case")` 显式映射）。
5. **分页返回**：`Result<PageResult<XxxVO>>`（不能是裸 `Result<PageResult>`）。
6. **Controller** 必须标注 `@Api`、`@ApiOperation`（中文）。
7. **Mapper XML** 必须与 Mapper 接口同名共存（无自定义 SQL 时也建占位 XML）。

### 代码生成范围

| 模块 | 内容 |
|------|------|
| bi-cashier-api | DTO、VO（手动管理）、Feign Client |
| bi-cashier-component | PO、Mapper、Service（IXxxService）、ServiceImpl（继承 ServiceImpl） |
| bi-cashier-service | ManageService（IXxxManageService）、ManageServiceImpl |
| bi-cashier-web | Controller、Mapper.xml |

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

## 代码规范

> 完整规则在 `references/code-structure.md` 与 `references/coding-quality.md`。本节是最关键的 8 条速查。

### 1. 类文件布局（自上而下）

```
package ...
import com.obo.*     ┐
import 第三方        ├─ 三组 import（项目 → 第三方 → JDK），组内字典序
import JDK / javax   ┘
                    [空行]
/** 类 Javadoc */
@Api / @RestController / @RequestMapping / @Slf4j   ← 类注解
public class Xxx {
    private static final ...  ← 静态常量
    @Resource
    private XxxService xxxService;  ← 注入字段
                          [空行]
    public 公共方法（前 → 后）
    private helper 方法（按被调用顺序）
}
```

### 2. import 分组

| 顺序 | 内容 |
|------|------|
| 第 1 组 | `com.obo.*` 项目包 |
| 第 2 组 | 第三方（MyBatis-Plus / Spring / Apache / Swagger / Lombok 等） |
| 第 3 组 | `java.*` / `javax.*` / `lombok.*` / `org.springframework.*` |

每组**字典序**排列，组间**空一行**。

### 3. 类注解顺序（自上而下）

1. `@Api`（Swagger）
2. `@RestController` / `@Service` / `@Component` / `@Configuration`（容器）
3. `@RequestMapping` / `@Transactional`（框架行为）
4. `@Slf4j`（横切日志）
5. 类级 `@Validated` 等其它

方法注解顺序：`@Override` → `@Transactional` → `@ApiOperation` → `@PostMapping` / `@GetMapping`。

> **注意**：`BankCardManageServiceImpl` 中 `addBankCard`/`updateBankCard`/`deleteBankCard` 现有代码将 `@Transactional` 写在 `@Override` 之前，属于存量偏差。新代码必须遵守 `@Override` 在最前的顺序。

### 4. 字段顺序

```
private static final 业务常量       ← 静态常量（按业务相关性）
@Resource
private IBankCardService bankCardService;   ← @Resource 注入（按字母序）
private Long localCacheSize;                  ← 实例字段（按业务相关性）
```

### 5. 方法顺序

1. 公共构造方法（少见，多数用 `@Component` 注入）
2. 公共业务方法（按 Controller 调用顺序 / 业务流顺序）
3. `public @Override`（接口实现，靠近被重写的接口）
4. 公共工具/查询方法
5. 私有 helper（按被调用顺序倒序，写在文件底部）

### 6. 方法体内部规范

- **Guard clauses**：参数校验放方法**最前**，失败立即抛异常早返回
- **Early return**：嵌套 if-else 转 if + return；控制流深度 ≤ 3
- **阶段化注释**：方法体超 80 行时，按 `// 1. xxx // 2. xxx` 标注阶段，阶段间空一行
- **lambdaQuery 链式**：使用 `this.lambdaQuery()` / `this.lambdaUpdate()`，**禁止 `new QueryWrapper<>()` / `new LambdaQueryWrapper<>`**

### 7. 私有 helper 命名

| 命名 | 用途 |
|------|------|
| `validateXxx` | 业务校验 |
| `toXxx` / `fromXxx` | DTO / PO / VO 互转 |
| `buildXxx` / `mergeXxx` | 数据加工 |
| `fileChange` / `maskXxx` / `notifyXxx` | 副作用（跨模块副作用） |

私有 helper 放在类**底部**。

### 8. 错误处理与判空

- **错误处理**：业务异常一律 `throw new BusinessException("中文提示")`，**禁止吞异常**、**禁止 `e.printStackTrace()`**、**禁止 `catch (X) {}`**
- **判空**：集合用 `CollUtils.isEmpty(x)` / `CollUtils.isNotEmpty(x)`；字符串用 `StringUtils.isBlank(x)` / `StringUtils.isNotBlank(x)`；包装类型运算前必须判空
- **空集合返回**：用 `Collections.emptyList()` / `Collections.emptyMap()`，**禁止 `new ArrayList<>()`** 作为返回值

## 目录归属规则

按类名命名前缀决定 Maven 模块位置，违规会破坏 Maven 依赖方向与 `Controller -> ManageService -> Component -> Mapper` 的调用链。

| Maven 模块 | service/ 包下允许 | service/ 包下禁止 |
|------------|---------------------|---------------------|
| bi-cashier-service | `IXxxManageService` / `IXxxManageServiceImpl`（业务编排） | `IXxxService`（无 `Manage`）/ `IXxxServiceImpl` |
| bi-cashier-component | `IXxxService` / `IXxxServiceImpl`，继承 `IService<Xxx>`（数据访问） | `IXxxManageService` / `IXxxManageServiceImpl` |

### 命名 → 模块速查

- `IXxxManageService` → `bi-cashier-service/service/`
- `IXxxManageServiceImpl` → `bi-cashier-service/service/impl/`
- `IXxxService`（不含 `Manage`） → `bi-cashier-component/service/`
- `IXxxServiceImpl`（不含 `Manage`） → `bi-cashier-component/service/impl/`

### 补充说明

- `bi-cashier-api`：放 Feign Client（`*Client.java`）与跨服务的 DTO/VO/枚举，不放 Service 类。
- Helper（`CashierManageHelper` / `CashierExportUtils`）按 `references/code-structure.md` §7.5 与本表归到对应模块。

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

## 细则导航

| 任务类型 | 参考文档 |
|---------|---------|
| 类文件内代码布局（import 分组、字段/方法顺序、guard clauses、私有 helper） | `references/code-structure.md` |
| 命名、注释、注解、错误处理、文件敏感信息、Feign | `references/coding-quality.md` |
| PO 基类、uniqueValue 生成、软删除、复合主从表、SQL 归档 | `references/data-model-sql.md` |
| 性能红线、批量查库、异步导出、敏感字段权限 | `references/performance.md` |
| 本模块字典/系统数据翻译做法（不使用 AOP 注解） | `references/translation-aop.md` |
| 类间结构（业务/数据分离、Manager 拆分、Impl 膨胀阈值、Facade 模式） | `references/concerns-separation.md` |
| 分层、Controller、Service 聚合、Component、Mapper、Helper、Convert | `references/architecture-layers.md` |
| **MP Lambda vs 手写 XML 决策、动态条件、聚合查询** | `references/mybatis-vs-xml.md` |
| **文件附件联合写入（FileExpiryRecord + bi-file + 标签库）** | `references/file-attachment-pattern.md` |

## 红线

- 严禁在 `for` 循环中调用 Component 层 / Mapper 查库，或调用其他 Service 的同步写入。
- Service 聚合层禁止直接调用 Mapper 或直接 `new LambdaQueryWrapper<>()` / `new QueryWrapper<>()`。
  - **例外**：Service 聚合层的批量字段更新（`batchUpdateBankCardField` 模式）允许在方法体内构造 `LambdaUpdateWrapper<T> wrapper = new LambdaUpdateWrapper<>()` 并调 `bankCardService.update(wrapper)`，理由是该 Wrapper 由聚合层动态组装多个 `set` 字段后传给 Component 执行，属于"参数构造"而非"绕过 Component 直接查库"。
- 物理删除数据（`remove()` / `removeById()`）对**业务主表**一律禁止，统一走软删除。
  - **例外**：`FileExpiryRecord`、`FileExpiryRule` 等纯关联/配置表可在明确业务场景下物理删除（如删除关联规则时级联清理记录），必须在方法注释中说明原因。
- 业务异常禁止吞掉，必须 `throw new BusinessException("中文提示")`；禁止 `e.printStackTrace()`。
- Controller 禁止编写业务逻辑（集合转换、循环赋值、批量查询），只允许调用 Service 并包装 `Result`。
- 禁止跨服务本地手写 Feign Client 接口，统一从 `bi-xxx-api` 引入。
- 禁止在业务表建表 SQL 中遗漏 `deleted` 字段（除非明确说明不软删）。
- 禁止将**数据访问层**（`IXxxService` / 不含 `Manage` 的 Service 类）写到 `bi-cashier-service` 模块（参见本文档"目录归属规则"）。
- 禁止用空壳 Javadoc（`/** xxx */` 一句话 + `@param xxx` 参数）蒙混过关——Javadoc 必须写出业务语义。



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

## 调用链行级模板（4 层逐行规范）

本章按 **BankCardController / BankCardManageServiceImpl / BankCardServiceImpl / BankCardMapper / BankCardMapper.xml 5 个文件** 逐行给出模板。每一行的内容、命名、注释、注解、字段类型、前后空白都有明确规范。

### 1. Controller 行级模板（对照 BankCardController.java）

```
行 1:   package com.obo.bi.cashier.controller;
行 2:   (空行)
行 3-10: import com.obo.bi.cashier.dto.* ; import com.obo.bi.cashier.service.* ;
         import com.obo.bi.cashier.vo.* ; import com.obo.core.common.entity.result.* ;
         import io.swagger.annotations.* ; import org.springframework.web.bind.annotation.* ;
         (3 组：项目 → 第三方 → JDK，每组字典序，组间空行)
行 11: import org.springframework.web.bind.annotation.RestController;  (聚合到 1 个 import)
行 12: (空行)
行 13: import javax.annotation.Resource;  (JDK 注解)
行 14: import java.util.List;
行 15: (空行)
行 16-33: 类 Javadoc /** ... */ 用 <ul><li> 列接口清单；句末注释"对齐前端 Xxx 模块"
行 34: (空行)
行 35: @Api(tags = "出纳-银行卡管理")           ← 1. Swagger 分类
行 36: @RestController                              ← 2. 容器注解
行 37: @RequestMapping("/cashier/bankCard")        ← 3. 框架路由
行 38: public class BankCardController {           ← 4. 类声明
行 39: (空行)
行 40:     @Resource
行 41:     private IBankCardManageService bankCardManageService;
行 42: (空行)
行 43:     @ApiOperation("分页查询银行卡")
行 44:     @PostMapping("/pageBankCard")
行 45:     public Result<PageResult> pageBankCard(@RequestBody BankCardPageDTO dto) {
行 46:         return Result.success(bankCardManageService.pageBankCard(dto));
行 47:     }
行 48: (空行)
行 49:     @ApiOperation("银行卡信息导出")
行 50:     @PostMapping("/exportBankCard")
行 51:     public Result<String> exportBankCard(@RequestBody BankCardPageDTO dto) {
行 52:         return Result.success(bankCardManageService.exportBankCard(dto));
行 53:     }
行 54: (空行)
行 55:     ... 其它 6 个方法，按 page → export → query → add → update → delete → listAll → batchUpdate 顺序
行 86: ...
行 87: }                                                ← 类结束
```

**关键行级规则**：
- 行 1: 小写驼峰包路径，单行
- 行 3-13: import **3 组**（项目 → 第三方 → JDK），每组**字典序**
- 行 16-33: 类 Javadoc `<ul><li>` 列表**接口清单**，每个 1 行
- 行 35-37: 只能有 `@Api` + `@RestController` + `@RequestMapping` 三个类级注解，按此顺序
- 行 41: 字段类型是 `IXxxManageService` **接口**（不是 Impl），变量名小写驼峰
- 行 45: 1 行方法体 `return Result.success(manageService.xxx(dto))`
- 行 47-48: 公共方法之间**空 1 行**
- 行 87: 类结束 `}` 前空 1 行

### 2. ManageService 行级模板（对照 BankCardManageServiceImpl.java 552 行）

```
行 1:   package com.obo.bi.cashier.service.impl;
行 2:   (空行)
行 3-50: import（3 组），按字典序：
         - cn.hutool.core.collection.CollUtil
         - com.alibaba.fastjson.JSONObject
         - com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper
         - com.obo.bi.cashier.helper.CashierManageHelper
         - com.obo.bi.cashier.dto.*
         - com.obo.bi.cashier.enums.SourceModuleEnum
         - com.obo.bi.cashier.po.*
         - com.obo.bi.cashier.service.I*ManageService / I*Service
         - com.obo.bi.cashier.utils.CashierExportUtils
         - com.obo.bi.cashier.constant.DictTypeConstants
         - com.obo.bi.cashier.vo.*
         - com.obo.bi.file.api.FileManageClient
         - com.obo.core.common.*
         - com.obo.bi.core.excel.export.ExcelExportService
         - lombok.extern.slf4j.Slf4j
         - org.springframework.beans.BeanUtils
         - org.springframework.stereotype.Service
         - org.springframework.transaction.annotation.Transactional
         - javax.annotation.Resource
         - java.time.LocalDate / LocalDateTime / format.DateTimeFormatter
         - java.util.* (ArrayList, Collections, HashMap, HashSet, List, Map, Objects, Set, function.Function, stream.Collectors)
行 51: (空行)
行 52-57: 类 Javadoc /** ... */
行 58: (空行)
行 59: @Slf4j
行 60: @Service
行 61: public class BankCardManageServiceImpl implements IBankCardManageService {
行 62: (空行)
行 63-103: @Resource 字段区（按 Service → Feign → Helper → Provider 顺序）
         @Resource
         private IBankCardService bankCardService;                       ← 1. 业务 Component Service
         @Resource
         private FileManageClient fileClient;                              ← 2. Feign Client
         @Resource
         private CashierManageHelper cashierManageHelper;                 ← 3. Helper
         @Resource
         private ICompanyBankCardService companyBankCardService;          ← 4. 跨 Component Service
         @Resource
         private IStoreService storeService;
         @Resource
         private IFileExpiryRecordService fileExpiryRecordService;
         @Resource
         private IFileExpiryRuleManageService fileExpiryRuleManageService;
         @Resource
         private IFileTagLibraryService fileTagLibraryService;
         @Resource
         private ExcelExportService excelExportService;
         @Resource
         private DataDictionaryProvider dataDictionaryProvider;
行 104: (空行)
行 105:    @Override
行 106:    public PageResult pageBankCard(BankCardPageDTO dto) {
行 107:        return bankCardService.pageBankCard(dto);                  ← 1 行转发
行 108:    }
行 109: (空行)
行 110:    /**
行 111:     * 导出银行卡信息到 Excel（异步生成并上传下载中心）。
行 112:     *
行 113:     * @param dto 查询条件（与列表页一致）
行 114:     * @return 下载中心文件ID（file_id）
行 115:     */
行 116:    @Override
行 117:    public String exportBankCard(BankCardPageDTO dto) {
行 118:        log.info("银行卡信息导出[开始]");                            ← 阶段开始日志
行 119:        // 1. 创建下载中心记录                                       ← 阶段化注释
行 120:        String userName = BaseContext.getUserName();
行 121:        String fileName = CashierExportUtils.buildExportFileName("银行卡信息");
行 122:        String fileId = CashierExportUtils.createDownloadRecord(fileClient, userName, fileName);
行 123:        // 2. 复用列表查询拉取当前筛选下全部数据
行 124:        BankCardPageDTO queryDTO = dto == null ? new BankCardPageDTO() : dto;
行 125:        queryDTO.setPageNum(1);
行 126:        queryDTO.setPageSize(CashierExportUtils.EXPORT_PAGE_SIZE);
行 127:        PageResult pageResult = bankCardService.pageBankCard(queryDTO);
行 128:        // ... 后续阶段
行 129:        return fileId;
行 130:    }
行 131: (空行)
行 132-274: 其它公共方法（queryBankCardById、addBankCard、updateBankCard、deleteBankCard、listAllBankCardWithBindStatus、batchUpdateBankCardField）
行 275-520: 私有 helper 方法（按被调用顺序倒序）
```

**行级规则**：
- 行 1: `service.impl` 包路径（不是 `service`）
- 行 3-50: import 数量较多，**按 Service → Mapper → Po → Dto → Vo → Enum → Util → Constant → Helper → Feign → core → lombok → spring → javax → java 三组** 严格分层
- 行 59-60: 类注解 `@Slf4j` + `@Service`（**没有** `@Api` 和 `@RequestMapping`——这些是 Controller 的）
- 行 63-103: `@Resource` 字段区，**10 个**（违反 §6 阈值 6，是反例，需要拆分）
- 行 105-108: 简单方法 1 行转发
- 行 110-115: 复杂方法必须有完整 Javadoc（5 行 /** */）
- 行 117-130: 复杂方法必须 `@Override` 在 public 之前
- 行 118: `log.info("[开始]xxx")` 阶段开始
- 行 119: `// 1. xxx` 阶段化注释
- 行 122: 业务逻辑方法调用（CashierExportUtils.createDownloadRecord）
- 行 124: null 检查（dto == null ... 兜底）
- 行 127: 跨 Component 调用（bankCardService.pageBankCard）

### 3. Component Service 行级模板（对照 BankCardServiceImpl.java 118 行）

```
行 1:   package com.obo.bi.cashier.service.impl;
行 2:   (空行)
行 3-11: import（3 组，比 ManageService 少很多）
         - com.baomidou.mybatisplus.core.metadata.IPage
         - com.baomidou.mybatisplus.extension.plugins.pagination.Page
         - com.obo.bi.cashier.dto.BankCardPageDTO
         - com.obo.bi.cashier.mapper.BankCardMapper
         - com.obo.bi.cashier.po.BankCard
         - com.obo.bi.cashier.service.IBankCardService
         - com.obo.core.common.entity.result.PageResult
         - com.obo.core.common.utils.CollUtils
         - org.springframework.stereotype.Service
行 12: (空行)
行 13-16: import java.util.*（Collection、Collections、List、stream.Collectors）
行 17: (空行)
行 18-20: 类 Javadoc /** 银行卡服务实现类 */
行 21: (空行)
行 22: @Service
行 23: public class BankCardServiceImpl
行 24:         extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl<BankCardMapper, BankCard>
行 25:         implements IBankCardService {
行 26: (空行)
行 27:     @Override
行 28:     public PageResult pageBankCard(BankCardPageDTO dto) {
行 29:         Page<BankCard> page = new Page<>(dto.getPageNum(), dto.getPageSize());   ← 构造 MyBatis-Plus Page
行 30:         IPage<BankCard> result = baseMapper.pageBankCard(page, dto);             ← 调 Mapper XML
行 31:         List<BankCard> records = result.getRecords();
行 32: (空行)
行 33-44: 业务逻辑（已选项前置）写在 Component 内部
行 45:         return new PageResult(result.getTotal(), records);                     ← 包装 PageResult
行 46:     }
行 47: (空行)
行 48:     /**
行 49:      * 按账号集合精确查询银行卡（仅过滤逻辑删除），供"已选项前置"使用
行 50:      */
行 51:     private List<BankCard> listByAccountNumbers(List<String> accountNumbers) {
行 52:         if (CollUtils.isEmpty(accountNumbers)) {
行 53:             return Collections.emptyList();
行 54:         }
行 55:         List<BankCard> list = this.lambdaQuery()
行 56:                 .in(BankCard::getAccountNumber, accountNumbers)
行 57:                 .eq(BankCard::getDeleted, 0)
行 58:                 .orderByDesc(BankCard::getCreateTime)
行 59:                 .list();
行 60:         return list == null ? Collections.emptyList() : list;
行 61:     }
行 62: (空行)
行 63-118: 其它方法（queryBankCardById / addBankCard / updateBankCard / deleteBankCard / isAccountNumberExists / listAllBankCard / listByBankCardIds）
```

**行级规则**：
- 行 1: 与 ManageService 同包
- 行 3-11: import 数量少（**6-9 个**），主要是 MP + 项目 DTO/PO/Mapper
- 行 22: 唯一类级注解 `@Service`（**没有** `@Slf4j`——Component 通常不写日志，或用 lombok 字段方式）
- 行 23-25: **必须 `extends ServiceImpl<XxxMapper, T>`** 写在独立行（行长限制）
- 行 28-46: 公共方法必须有 `@Override` 然后方法体
- 行 29: `Page<T>` 构造（`new Page<>(页码, 页大小)`）
- 行 30: **`baseMapper.xxx(...)`** 调 Mapper（不是 `mapper.xxx()`）
- 行 31: `result.getRecords()` 拿列表
- 行 33-44: 业务逻辑（**简单**：合并、过滤、组装）写在 Component
- 行 45: `new PageResult(total, records)` 包装返回值
- 行 51-60: 私有 helper 用 `this.lambdaQuery()` 链式
- 行 55-59: `this.lambdaQuery().in(...).eq(...).orderByDesc(...).list()`
- 行 60: null 兜底 `Collections.emptyList()`

### 4. Mapper 接口行级模板（对照 BankCardMapper.java）

```
行 1:   package com.obo.bi.cashier.mapper;
行 2:   (空行)
行 3-10: import
         - com.baomidou.mybatisplus.core.mapper.BaseMapper
         - com.baomidou.mybatisplus.core.metadata.IPage
         - com.baomidou.mybatisplus.extension.plugins.pagination.Page
         - com.obo.bi.cashier.dto.BankCardPageDTO
         - com.obo.bi.cashier.po.BankCard
         - org.apache.ibatis.annotations.Param
行 11: (空行)
行 12: import java.util.List;
行 13: (空行)
行 14-17: 类 Javadoc /** 银行卡Mapper接口 */
行 18: (空行)
行 19: @Mapper                                                          ← MyBatis 注解，可选
行 20: public interface BankCardMapper extends BaseMapper<BankCard> {
行 21: (空行)
行 22:     /**
行 23:      * 分页查询银行卡
行 24:      *
行 25:      * @param page 分页对象
行 26:      * @param dto 查询条件
行 27:      * @return 分页结果
行 28:      */
行 29:     IPage<BankCard> pageBankCard(Page<BankCard> page, @Param("dto") BankCardPageDTO dto);
行 30: (空行)
行 31:     /**
行 32:      * 根据账号统计数量
行 33:      *
行 34:      * @param accountNumber 账号
行 35:      * @param excludeId 排除的ID
行 36:      * @return 数量
行 37:      */
行 38:     int countByAccountNumber(@Param("accountNumber") String accountNumber, @Param("excludeId") Long excludeId);
行 39: }
```

**行级规则**：
- 行 1: `mapper` 包路径（不是 `service`）
- 行 19: `@Mapper` 注解（**可选**，但写更明确）
- 行 20: **`extends BaseMapper<PO>`** 必写
- 行 22-29: 公共方法必须有 Javadoc（7 行 /** */）
- 行 29: 多参数时**所有参数都用 `@Param("xxx")`** 命名
- 行 29: 返回类型为 MP 的 `IPage<PO>`（不是 `PageResult`）
- 行 38: 简单方法也带 Javadoc

### 5. Mapper XML 行级模板（对照 BankCardMapper.xml）

```
行 1:   <?xml version="1.0" encoding="UTF-8"?>
行 2:   <!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
行 3:   <mapper namespace="com.obo.bi.cashier.mapper.BankCardMapper">
行 4:   (空行)
行 5:       <select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">     ← 必须含列名别名
行 6:           SELECT id AS id, account_number AS accountNumber, account_name AS accountName,
行 7:                  bank_code AS bankCode, bank_name AS bankName, branch_name AS branchName,
行 8:                  bank_type AS bankType, open_date AS openDate, ...
行 9:           FROM cashier_bank_card
行 10:          WHERE deleted = 0                                                       ← 软删除必备
行 11:          <if test="dto.accountName != null and dto.accountName != ''">             ← 字符串 null+空
行 12:              AND account_name LIKE CONCAT('%', #{dto.accountName}, '%')           ← 模糊
行 13:          </if>
行 14:          <if test="dto.bankCodes != null and dto.bankCodes.size() > 0">           ← 集合 null+size
行 15:              AND bank_code IN
行 16:              <foreach collection="dto.bankCodes" item="code" open="(" separator="," close=")">
行 17:                  #{code}
行 18:              </foreach>
行 19:          </if>
行 20:          <if test="dto.openDateStart != null">
行 21:              AND open_date &gt;= #{dto.openDateStart}                              ← 大于等于转义
行 22:          </if>
行 23:          <if test="dto.openDateEnd != null">
行 24:              AND open_date &lt;= #{dto.openDateEnd}                                ← 小于等于转义
行 25:          </if>
行 26:          ORDER BY create_time DESC
行 27:      </select>
行 28:  (空行)
行 29:      <select id="countByAccountNumber" resultType="java.lang.Integer">
行 30:          SELECT COUNT(*) FROM cashier_bank_card
行 31:          WHERE deleted = 0 AND account_number = #{accountNumber}
行 32:          <if test="excludeId != null">
行 33:              AND id != #{excludeId}
行 34:          </if>
行 35:      </select>
行 36:  (空行)
行 37:  </mapper>
```

**行级规则**：
- 行 1: XML 声明必带
- 行 2: DOCTYPE 必带
- 行 3: `namespace` 必须等于 Mapper 接口全限定类名（**完全一致**）
- 行 5: `<select id="pageBankCard">` id 与 Mapper 接口方法名**完全一致**
- 行 5-8: **所有列名必须起别名** `snake_case AS camelCase`（保证与 PO 字段对应）
- 行 9: FROM 表名用 `cashier_{entity}` 命名规则（如 `cashier_bank_card`）
- 行 10: `WHERE deleted = 0` 软删除必备
- 行 11-13: 字符串字段判空 `!= null and != ''`、模糊用 `LIKE CONCAT('%', #{x}, '%')`
- 行 14-19: 集合字段判空 `!= null and size() > 0`、IN 用 `<foreach collection="..." item="x" open="(" separator="," close=")">`
- 行 21, 24: 大于等于 `&gt;=`、小于等于 `&lt;=` 必须 XML 转义
- 行 26: 排序 `ORDER BY create_time DESC`（按业务字段，不是数据库 id）
- 行 29: `resultType="java.lang.Integer"`（基础类型用全限定名）
- 行 37: 闭合 `</mapper>` 前空 1 行

### 6. 4 层接口契约速查表（按照以上行级模板）

| 层 | 文件名 | 命名 | 行级关键标识 |
|---|--------|------|-------------|
| Controller | `XxxController.java` | `XxxController` | `@Api` + `@RestController` + `@RequestMapping("/cashier/{module}")` |
| Service 聚合 | `IXxxManageService` 接口 | `IXxxManageService` | 在 `service/` 包 |
| Service 聚合 Impl | `XxxManageServiceImpl.java` | `XxxManageServiceImpl` | `implements IBankCardManageService`，`@Slf4j` + `@Service` |
| Component Service | `IXxxService` 接口 | `IXxxService` | `extends IService<T>` |
| Component Service Impl | `XxxServiceImpl.java` | `XxxServiceImpl` | `extends ServiceImpl<XxxMapper, T>` + `implements IBankCardService` |
| Mapper | `XxxMapper.java` | `XxxMapper` | `extends BaseMapper<T>` + `@Param` 显式 |
| Mapper XML | `XxxMapper.xml` | `XxxMapper.xml` | namespace = 接口全限定名 + 列名 AS 别名 |

### 7. 4 层命名精确规则

| 层 | 类名 | 实现名 | 接口名 | 路径 |
|---|------|--------|--------|------|
| Controller | `XxxController` | — | — | `controller/` |
| Service 聚合 | `XxxManageServiceImpl` | `IXxxManageService` | `service/impl/`、`service/` |
| Component Service | `XxxServiceImpl` | `IXxxService` | `service/impl/`、`service/` |
| Mapper | — | `IXxxMapper` | `mapper/` |
| Mapper XML | — | `XxxMapper.xml` | `resources/mapper/` |
| PO | `Xxx` | — | `po/` |
| DTO | `XxxDTO` | — | `dto/` |
| VO | `XxxVO` / `XxxListVO` / `XxxDetailVO` | — | `vo/` |
| Enum | `XxxEnum` | — | `enums/` 或 `enums/` |

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

## DTO/VO 设计规范

### 1. DTO 命名

| 类型 | 命名 | 例 |
|------|------|-----|
| 分页查询 | `XxxPageDTO` | `BankCardPageDTO` |
| 通用保存 | `XxxSaveDTO` | `BankCardSaveDTO` |
| 复合保存（含子表） | `XxxSaveRequestDTO` | `StoreSaveRequestDTO` |
| 批量更新字段 | `XxxBatchUpdateFieldDTO` | `BankCardBatchUpdateFieldDTO` |
| 详情查询 | `XxxDetailRequestDTO` | （少见） |

### 2. PageDTO 字段规约

```java
@Data
@ApiModel("银行卡分页查询DTO")
public class BankCardPageDTO {
    @ApiModelProperty("页码")
    private Integer pageNum = 1;
    @ApiModelProperty("每页数量")
    private Integer pageSize = 10;
    @ApiModelProperty("账户名称（模糊查询）")
    private String accountName;
    @ApiModelProperty("账号列表（已选项）")
    private List<String> selectedAccountNumbers;
    @ApiModelProperty("开户行编码列表")
    private List<String> bankCodes;
    @ApiModelProperty("开户日期开始")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate openDateStart;
    @ApiModelProperty("开户日期结束")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate openDateEnd;
}
```

**Page 字段标准**：
- `pageNum`（Integer，默认 1）
- `pageSize`（Integer，默认 10）
- 业务字段用 `List`（多选 IN）或 `String`（模糊）

### 3. 复合保存 DTO（嵌套结构）

```java
@Data
@ApiModel("店铺保存请求（复合）")
public class StoreSaveRequestDTO {
    @ApiModelProperty("店铺业务唯一流水号")
    private String uniqueValue;
    
    @ApiModelProperty("变更信息列表")
    private List<ChangeInfoItem> changeInfoList;
    
    @Data
    @ApiModel("变更信息项")
    public static class ChangeInfoItem {
        @ApiModelProperty("变更信息ID")
        private Long id;
        @ApiModelProperty("变更日期")
        @DateTimeFormat(pattern = "yyyy-MM-dd")
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDate changeDate;
    }
}
```

**嵌套静态类**模式（参考 `StoreSaveRequestDTO.ChangeInfoItem`）。

### 4. VO 命名

| 类型 | 命名 | 例 |
|------|------|-----|
| 详情 | `XxxVO` | `BankCardVO` |
| 列表 | `XxxListVO` | `BankCardListVO` |
| 嵌套详情 | `XxxDetailVO` | `StoreDetailVO` |
| 导出 | `XxxExportVO` | `BankCardExportVO` |

### 5. ListVO vs DetailVO 字段差异

| 字段 | ListVO | DetailVO |
|------|--------|---------|
| 主键 | 有 | 有 |
| 基础字段 | 必要字段 | 全部字段 |
| 外键关联 | 不嵌入 | 嵌入（关联名、关联状态） |
| 子表 | 不嵌入 | 嵌入 List（变更信息、附件） |
| 审计字段 | createTime / updateTime | createTime / updateTime / createUser / updateUser |
| 状态快照 | 简版 | 完整 |

### 6. DTO/VO 通用约束

- 必须 `@Data` + `@ApiModel`
- 字段必须有 `@ApiModelProperty` + 中文
- **不能**有业务逻辑（不要放 helper 方法）
- **不能**持有 Service / Component 依赖
- 日期字段同时 `@DateTimeFormat` + `@JsonFormat`
- 列表字段用 `List<Xxx>`（统一不带 `s` 后缀）

### 7. 校验注解（javax.validation）

```java
@NotBlank(message = "印章名称不能为空")
@Size(max = 100, message = "印章名称长度不能超过 100")
private String sealName;
```

| 注解 | 用途 |
|------|------|
| `@NotBlank` | 字符串非空（比 `@NotNull` + `@NotEmpty` 更严） |
| `@NotNull` | 任意对象非空 |
| `@Size` | 字符串长度 |
| `@Pattern` | 正则 |
| `@Min` / `@Max` | 数值范围 |
| `@Email` | 邮箱格式 |
| `@Valid` | 嵌套校验（触发嵌套 DTO 上的校验） |

**规则**：`message` 必须中文。

### 8. 嵌套 DTO 校验

```java
@Valid  // 触发嵌套校验
private List<ChangeInfoItem> changeInfoList;
```

### 9. 反例

- ❌ DTO 字段没 `@ApiModelProperty`
- ❌ DTO 字段命名 snake_case
- ❌ 字段不用 `List<Xxx>` 而用 `Xxxs` / `XxxList`
- ❌ 复合 DTO 把子表平铺（应该嵌套）
- ❌ VO 嵌入 Service 依赖
- ❌ 校验注解 message 是英文
- ❌ 校验注解缺失
- ❌ DTO 字段无 `@ApiModel`

## 代码评审清单

PR 评审按层次分别检查。每个 checklist 都对应 skills 文档的章节。

### 1. Controller 评审

- [ ] `@Api(tags = "中文")` Swagger 分类
- [ ] `@RequestMapping("/cashier/{module}")` 业务前缀
- [ ] 所有方法 `@PostMapping`（不用 GET / PathVariable）
- [ ] 入参：`@RequestBody` 对 DTO / `@RequestParam("name")` 对单字段
- [ ] 返回：`Result.success(...)` 包装
- [ ] 分页接口：`Result<PageResult<XxxVO>>`（**必须带 VO 泛型**）
- [ ] 类 Javadoc 用 `<ul><li>` 列接口清单
- [ ] 注入：`@Resource private IManageService`（接口，不用 Impl）
- [ ] 方法体不超过 5 行（一行转发）
- [ ] 路径前缀：`/cashier/{module}`（不 `/api/...`）

### 2. Service 聚合评审

- [ ] `implements IXxxManageService`（接口）
- [ ] 类注解 `@Slf4j` + `@Service`
- [ ] `@Resource` 数量 ≤ 6（超出按 Facade 拆分）
- [ ] 公共方法有 `@Override` + 完整 Javadoc
- [ ] 业务前置校验（`if (x == null) throw new BusinessException(...)`）
- [ ] 阶段化注释（方法体 > 80 行时必须）
- [ ] 复杂方法加 `@Transactional(rollbackFor = Exception.class)`
- [ ] 不 `new LambdaQueryWrapper<>()` / `new QueryWrapper<>()`
- [ ] 不 `extends ServiceImpl`（这是 Component 层）
- [ ] 不跨层依赖（不 import Component Impl）

### 3. Component Service 评审

- [ ] `extends ServiceImpl<XxxMapper, T>` 必须
- [ ] `implements IXxxService` extends `IService<T>`
- [ ] **不抛 BusinessException**（业务异常）
- [ ] **不写 @Transactional** 处理跨表（仅单表）
- [ ] 复杂合并逻辑可在此（聚合前置等）
- [ ] 调 Mapper 用 `baseMapper.xxx()`（不是 `@Autowired XxxMapper`）
- [ ] 空集合返 `Collections.emptyList()`（不 `new ArrayList<>()`）

### 4. Mapper 评审

- [ ] `extends BaseMapper<T>` 必须
- [ ] `@Param("xxx")` 显式命名多参数
- [ ] 方法有 Javadoc（用途、`@param`、`@return`）
- [ ] 不暴露 Service 业务方法（只暴露数据访问）

### 5. Mapper XML 评审

- [ ] `namespace` = Mapper 接口全限定名
- [ ] 列名一律 `snake_case AS camelCase`
- [ ] `WHERE deleted = 0` 软删除
- [ ] 字符串 `<if>`：`!= null and != ''`
- [ ] 集合 `<if>`：`!= null and size() > 0`
- [ ] `<foreach>` IN 查询
- [ ] `>=` `<=` 用 `&gt;=` `&lt;=` 转义
- [ ] 模糊 `LIKE CONCAT('%', #{x}, '%')`
- [ ] 占位 XML 必须存在（即使无自定义 SQL）

### 6. PO 评审

- [ ] 继承 `BaseEntity`
- [ ] `@TableName("cashier_xxx")` snake_case
- [ ] `@ApiModel("中文")`
- [ ] `@TableId(type = IdType.AUTO)` 主键
- [ ] 字段 `@TableField("snake_case")` 显式
- [ ] 字段 `@ApiModelProperty("中文")`
- [ ] 日期字段同时 `@DateTimeFormat` + `@JsonFormat`
- [ ] 不重复声明 BaseEntity 字段
- [ ] 金额用 `BigDecimal`、日期用 `LocalDate`

### 7. DTO/VO 评审

- [ ] `@Data` + `@ApiModel("中文")`
- [ ] 字段 `@ApiModelProperty("中文")`
- [ ] 命名：`XxxDTO` / `XxxPageDTO` / `XxxSaveRequestDTO` / `XxxVO` / `XxxListVO` / `XxxDetailVO`
- [ ] 复合 DTO 嵌套 `public static class XxxItem`
- [ ] 校验注解 + 中文 message
- [ ] 不持有 Service 依赖
- [ ] 列表字段用 `List<Xxx>`（不带 `s` / `List` 后缀）

### 8. 通用规范

- [ ] 注释全部中文
- [ ] SLF4J 用 `@Slf4j` 不用 `LoggerFactory`
- [ ] 判空用 `CollUtils` / `StringUtils` 不用 `size() > 0`
- [ ] 空集合返 `Collections.emptyList()`
- [ ] 异常用 `throw new BusinessException("中文")`
- [ ] 不用 `e.printStackTrace()` 不用 `catch (Exception) {}`
- [ ] 敏感字段脱敏（手机号、密码）
- [ ] 物理删除禁止（统一软删除）
- [ ] 不在外层模块跨层依赖（参见 §目录归属规则）

### 9. 自检 quick 命令

```bash
# 物理删除检查
grep -r "removeById\|deleteById\|removeByIds" bi-cashier-service bi-cashier-web

# new QueryWrapper 反例
grep -r "new QueryWrapper\|new LambdaQueryWrapper" bi-cashier-service bi-cashier-web

# e.printStackTrace 反例
grep -r "e.printStackTrace" bi-cashier-service bi-cashier-component bi-cashier-api

# @Autowired 反例
grep -r "@Autowired" bi-cashier-service bi-cashier-component bi-cashier-web

# 缺 @ApiModel
for f in $(find bi-cashier-api/src/main/java -name "*.java" -path "*/dto/*"); do
  if ! grep -q "@ApiModel" $f; then echo "MISS: $f"; fi
done
```

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

## 业务-数据归属精确规则（Component vs Service 聚合层，按行级）

本章明确**两类 Service** 之间的边界：哪些 Service 文件放哪一层、按行级允许什么 / 禁止什么。

### 1. 物理位置决定层

| Service 类型 | Service 接口路径 | Service Impl 路径 |
|------|------|------|
| **Component Service**（数据访问层）| `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/IXxxService.java` | `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/impl/XxxServiceImpl.java` |
| **Service 聚合层**（业务编排） | `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/IXxxManageService.java` | `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/XxxManageServiceImpl.java` |
| **Helper / Convert / Strategy** | `bi-cashier-component/src/main/.../helper/convert/` 或 `bi-cashier-service/src/main/.../utils/` | （同前） |

### 2. Component Service 行级模板（数据访问）

```java
package com.obo.bi.cashier.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.obo.bi.cashier.po.Xxx;
import com.obo.bi.cashier.mapper.XxxMapper;

public interface IXxxService extends IService<Xxx> {
    // 数据访问方法：纯 CRUD
    Xxx getById(Long id);
    List<Xxx> listByCompanyUniqueValue(String companyUniqueValue);
}

package com.obo.bi.cashier.service.impl;

@Slf4j
@Service
public class XxxServiceImpl
        extends ServiceImpl<XxxMapper, Xxx>                          // 行 N：必须 extends ServiceImpl
        implements IXxxService {

    @Override
    public Xxx getById(Long id) {
        if (id == null) return null;                                 // 判空 → 直接返回 null
        return baseMapper.selectById(id);                            // 调 Mapper
    }

    @Override
    public List<Xxx> listByCompanyUniqueValue(String companyUniqueValue) {
        if (StringUtils.isBlank(companyUniqueValue)) {
            return Collections.emptyList();                          // 空集合
        }
        return this.lambdaQuery()                                    // 链式查询
                .eq(Xxx::getCompanyUniqueValue, companyUniqueValue)
                .eq(Xxx::getDeleted, 0)
                .list();
    }
}
```

### 3. Component Service 禁止的事（按行级）

| 行级位置 | 禁止内容 |
|---------|----------|
| **类级 Javadoc** | 不写"业务逻辑" / "状态机" / "事务编排" |
| **类注解** | 不加 `@Transactional` |
| **@Override 公共方法体** | 不抛 `throw new BusinessException` |
| **@Override 公共方法体** | 不调 Feign Client |
| **@Override 方法体** | 不写 `@Resource` 注入其他 Component Service |
| **@Override 方法体** | 不写 `@Resource` 注入 Helper 业务层 |
| **@Override 方法体** | 不写 `@Resource` 注入 Feign / 数据字典 Provider |
| **私有方法** | 不含业务校验（`if (xxx) throw ...`） |
| **@Override 方法体** | 不直接调 `this.lambdaQuery()` 拼复杂业务聚合 |

### 4. Service 聚合层行级模板（业务编排）

```java
package com.obo.bi.cashier.service;

import com.obo.bi.cashier.dto.XxxSaveDTO;
import com.obo.bi.cashier.po.Xxx;
import com.obo.bi.cashier.service.IXxxManageService;
import com.obo.bi.cashier.service.IXxxService;                // 注入 Component Service
import com.obo.bi.cashier.helper.CashierManageHelper;
import com.obo.bi.gateway.service.IFileManageClient;            // 注入 Feign Client

public interface IXxxManageService {
    /** 业务编排入口：先校验后编排 */
    Boolean saveXxx(XxxSaveDTO dto);
}

package com.obo.bi.cashier.service.impl;

@Slf4j
@Service
public class XxxManageServiceImpl implements IXxxManageService {

    @Resource
    private IXxxService xxxService;                                // 注入 Component Service

    @Resource
    private CashierManageHelper cashierManageHelper;               // 注入 Helper

    @Resource
    private IFileManageClient fileClient;                         // 注入 Feign Client

    @Override
    public Boolean saveXxx(XxxSaveDTO dto) {
        if (StringUtils.isBlank(dto.getXxx())) {                   // 业务校验（直接判空）
            throw new BusinessException("xxx 不能为空");
        }
        return xxxService.saveXxx(dto);                            // 调 Component Service
    }
}
```

### 5. Service 聚合层禁止的事（按行级）

| 行级位置 | 禁止内容 |
|---------|----------|
| **类声明** | 不写 `extends ServiceImpl<...>`（这是 Component 层的事） |
| **类级 Javadoc** | 不写"数据访问" / "CRUD" |
| **类字段** | 不使用 `baseMapper`（baseMapper 是 Component 私有） |
| **@Override 方法体** | 不直接写 `this.lambdaQuery()` / `this.lambdaUpdate()` |
| **@Override 方法体** | 不写 SQL 字符串 |
| **@Override 方法体** | 不调 `baseMapper.xxx()` 直接 Mapper |
| **@Override 方法** | 不写单纯的 `pageXxx()` / `getById()` 这种 CRUD |

### 6. Service 接口命名的硬规则

| Service 类型 | 接口名 | 路径 |
|------|------|------|
| 数据访问 | `IXxxService`（**不含 Manage**） | `bi-cashier-component/.../service/` |
| 业务编排 | `IXxxManageService`（**必须含 Manage**） | `bi-cashier-service/.../service/` |

**反例**：
- `IXxxService` 在 `bi-cashier-service` —— 立即搬移到 `bi-cashier-component`
- `IXxxManageService` 在 `bi-cashier-component` —— 立即搬移到 `bi-cashier-service`
- `IXxxService` 名字里有 `Service` 但接口内只做 CRUD —— 放 Component
- `IXxxService` 名字里有 `Service` 但接口内有业务校验或事务 —— 名字错，应该叫 `IXxxManageService` 放 Service 聚合层

### 7. Service Impl 命名的硬规则

| Service 类型 | Impl 名 | 路径 |
|------|------|------|
| 数据访问 | `XxxServiceImpl extends ServiceImpl<XxxMapper, T>` | `bi-cashier-component/.../service/impl/` |
| 业务编排 | `XxxManageServiceImpl implements IXxxManageService` | `bi-cashier-service/.../service/impl/` |

**反例**：
- `XxxServiceImpl` 出现在 `bi-cashier-service`（应放 Component）
- `XxxManageServiceImpl` 出现在 `bi-cashier-component`（应放 Service 聚合层）
- `XxxServiceImpl` 不含 `extends ServiceImpl`（漏掉）
- `XxxServiceImpl` 不含 `implements IXxxService`（漏掉）

### 8. 已迁移的实际例子（这轮工作）

| 旧位置 | 新位置 | 触发原因 |
|------|------|------|
| `bi-cashier-service/.../service/IAuditFileRelationService.java` | `bi-cashier-component/.../service/IAuditFileRelationService.java` | 缺 Manage 后缀 → 改放 Component |
| `bi-cashier-service/.../service/ISubAccountAuditService.java` | `bi-cashier-component/.../service/ISubAccountAuditService.java` | 同上 |
| `bi-cashier-service/.../service/ISubAccountService.java` | `bi-cashier-component/.../service/ISubAccountService.java` | 同上 |
| `bi-cashier-service/.../service/impl/AuditFileRelationServiceImpl.java` | `bi-cashier-component/.../service/impl/AuditFileRelationServiceImpl.java` | 跟随接口 |
| `bi-cashier-service/.../service/impl/SubAccountAuditServiceImpl.java` | `bi-cashier-component/.../service/impl/SubAccountAuditServiceImpl.java` | 同上 |
| `bi-cashier-service/.../service/impl/SubAccountServiceImpl.java` | `bi-cashier-component/.../service/impl/SubAccountServiceImpl.java` | 同上 |

### 9. Component Service 业务校验的红线

即使 Component Service 的方法中有"业务校验"（如 `assertRelationComplete`），仍**应在 Component 层**：

```java
// ✅ 允许：Component Service 内部字段完整性校验
@Override
public void save(List<AuditFileRel> relations) {
    for (AuditFileRel relation : relations) {
        assertRelationComplete(relation);                            // 字段完整性（数据约束）
        assertNoSensitiveKeyword(relation);                          // 字段关键字（数据约束）
    }
    baseMapper.insert(...);
}

// ❌ 禁止：Component Service 业务校验（应放 Service 聚合层）
if (!"admin".equals(getRole())) {
    throw new BusinessException("无权操作");                           // 业务校验 = Service 聚合层的事
}
```

**判断准则**：
- "字段 X 不能为空"、"URL 不能含 password" → Component Service（数据约束）
- "用户没权限"、"状态已取消不能编辑"、"业务规则 A 不满足" → Service 聚合层（业务校验）

### 10. 跨层调用规则

```
Service 聚合层 → Component Service          ✅ 允许
Service 聚合层 → Mapper（baseMapper.xxx）   ❌ 禁止（必须通过 Component Service）
Component Service → Mapper（baseMapper.xxx）   ✅ 允许
Component Service → Service 聚合层           ❌ 禁止（反向依赖）
Component Service → 其他 Component Service    ❌ 禁止（横向依赖）
Service 聚合层 → Feign Client                 ✅ 允许
Component Service → Feign Client             ❌ 禁止（数据层不跨服务）
```

### 11. 反例清单（按行级）

- ❌ Component Service 接口 `extends Service` 而不是 `IService<T>`
- ❌ Component Service Impl 没 `extends ServiceImpl<XxxMapper, T>`
- ❌ Service 聚合层 Impl `extends ServiceImpl`（侵入 Component 层）
- ❌ Service 聚合层 Impl 直接调 `baseMapper.xxx()`
- ❌ Service 聚合层 Impl 写 `this.lambdaQuery()` 链式
- ❌ Service 聚合层 Impl 写 SQL 字符串
- ❌ Component Service 抛 `throw new BusinessException("业务错误")`
- ❌ Component Service 加 `@Transactional` 处理跨表写入
- ❌ Component Service 注入 Feign Client 或数据字典 Provider
- ❌ Service 聚合层 Impl 不依赖 Component Service 直接调 Mapper
- ❌ 文件名 `IXxxService` 出现在 `bi-cashier-service` 模块
- ❌ 文件名 `IXxxManageService` 出现在 `bi-cashier-component` 模块