---
name: "remote-java-standard"
description: Use when 新建或审查 BI/OBO Java 后端代码、调整 DTO/VO/PO 字段、编写 Mapper SQL、分层调用违反规范、Service 聚合层与 Component 层职责混淆、跨服务 Feign 调用边界不清晰。
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

## 细则导航

| 任务类型 | 参考文档 |
|---------|---------|
| 类文件内代码布局（import 分组、字段/方法顺序、guard clauses、私有 helper）、**DTO/VO 设计规范** | `references/code-structure.md` |
| 命名、**注释规范**、注解、**异常处理完整规约**、**日志格式细化**、**安全性规约**、**错误码/错误信息规范**、**Feign 客户端使用规约** | `references/coding-quality.md` |
| PO 基类、uniqueValue 生成、软删除、复合主从表、SQL 归档、**PO 字段映射规约** | `references/data-model-sql.md` |
| 性能红线、批量查库、异步导出、敏感字段权限 | `references/performance.md` |
| 本模块字典/系统数据翻译做法（不使用 AOP 注解） | `references/translation-aop.md` |
| 类间结构（业务/数据分离、Manager 拆分、Impl 膨胀阈值、Facade 模式）、**业务-数据归属精确规则** | `references/concerns-separation.md` |
| 分层、**Controller 模式规范**、Service 聚合、Component、Mapper、Helper、Convert、**调用链规范** | `references/architecture-layers.md` |
| **MP Lambda vs 手写 XML 决策、动态条件、聚合查询** | `references/mybatis-vs-xml.md` |
| **文件附件联合写入（FileExpiryRecord + bi-file + 标签库）** | `references/file-attachment-pattern.md` |
| **调用链 4 层逐行模板** | `references/call-chain-templates.md` |
| **代码评审清单（提交前逐项自查）** | `references/code-review-checklist.md` |

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
