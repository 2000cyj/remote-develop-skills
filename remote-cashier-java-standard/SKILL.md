---
name: remote-cashier-java-standard
description: Use when 在 bi-cashier-api、bi-cashier-component、bi-cashier-service 或 bi-cashier-web 中新建、修改或审查 Java 后端代码及关联 Mapper XML/SQL，包括 DTO/VO/PO、分层调用、Service 与 Component 职责、Feign 和数据访问规范；不要用于其他 BI/OBO 模块。
---

# bi-cashier 模块 Java 开发规范

本模块继承 OBO BI Java 开发规范，针对出纳模块的特性做了补充说明。本 skill 只约束 `bi-cashier` 模块组，不是通用 BI/OBO Java 规范。

## 适用范围

仅在目标属于以下 Maven 模块之一时使用本 skill：

- `bi-cashier-api`、`bi-cashier-component`、`bi-cashier-service` 或 `bi-cashier-web`。

模块归属是唯一判断维度。包名 `com.obo.bi.cashier` 只是模块内的进一步验证条件，不能脱离模块单独触发；包名一致但所在 Maven 模块不是上述四个之一的，本规范不适用。
同时适用于与上述模块 Java 实现直接关联的 Mapper XML、`bi-cashier` SQL 和代码评审。

不得把本规范套用到 `bi-file`、`bi-user` 或其他 BI/OBO Java 模块，即使它们采用相似分层或命名、包名相近或复用本规范的辅助类。跨模块任务只对其中明确属于 `bi-cashier` 模块组的文件使用本规范；无法从 Maven 模块确认归属时，不要推断适用。

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
6. **Controller** 必须标注 `@Api`、`@ApiOperation`（中文）。**禁止**标注 `@BusLogs`——切面已废弃（`BusLogAop.java` 全注释，无生效切面），加注解会给读者错误的"必须添加"预期（详见 `references/architecture-layers.md` §1.2）。
7. **API 入参对象化**：≥ 2 个独立变量的 Controller 入参**必须**收进一个 DTO 用 `@RequestBody` 收，禁止 `@RequestParam` 与 `@RequestBody` 混用同一个业务键（`uniqueValue` / `nodeCode`），也禁止业务键塞进 URL 路径段（`@PathVariable`）。`@RequestParam` 仅服务于"单变量且不会再扩"接口（详见 `references/architecture-layers.md` §15）。
8. **Service / Helper 入参对象化**：Service 聚合层、Component Service、私有 helper 等**任意方法**形参 ≥ 3 个时，必须封装 DTO / Req 收参，禁止多形参并列。常见例外：固定 2-3 个 RPC 字段（`operationId / taskId / outcome`）的内部 helper 可保留为形参（详见 `references/architecture-layers.md` §15.3）。
   - **新增（V20260827）**：方法形参 ≥ 3 个**必须**用对象封装（同原 §8 规则）。
     - 反例：`completeNode8(application, items, operatorId)` ❌（3 形参并列）
     - 正例：`completeNode8(CompleteNodeContext context)` ✅
   - **Controller 端唯一例外**：URL 路径段 `@PathVariable("uniqueValue") String uniqueValue` + `@RequestBody DTO dto` 视为合规，详见 §7。
8.1. **多参数扫描是必做检查项**：审查或修改 Controller 调用链时，必须对 `ManageService`、Component Service、接口、实现类、私有 helper 及本次新建/下沉/复制的方法逐一统计形参数量，并在结论中列出所有 ≥ 3 参数的方法及处理结果。不得因为方法是历史代码、已存在、刚从其它实现复制，或“当前调用只有一次”而跳过检查。
   - `casAdvance`、`advanceStatus`、`completeNode`、`updateAndSubmit` 等业务编排、CAS 更新、状态推进、复合写入方法默认按业务参数处理，**不属于**“固定 RPC 字段”例外；12 个参数等明显超限方法必须判定为违规。
   - 只有方法全部参数确实是固定 RPC 传输字段，且数量不超过 3 个时，才可记录为例外；必须在报告中写明例外依据，不能只写“内部 helper”。
   - A1 架构下沉、重命名或复制方法后，必须重新执行本条扫描；下沉不等于合规，原方法不合规时必须同步 DTO 化。
   - **合规报告门槛**：未提供参数统计表，或未明确覆盖接口声明、实现类和全部调用方时，不得输出“调用链符合规范”或“无需整改”。
9. **同名字段对象赋值用 BeanCopyUtils**：两个对象 / 集合互转，**同名字段 ≥ 3 条**时必须使用 `com.obo.core.common.utils.BeanCopyUtils.copy(src, Xxx::new)` 或 `BeanCopyUtils.copyList(src, Xxx::new)`，禁止 20 行手动 `setX`。**仅** DTO / PO 都不含的派生字段、`null` 兜底字段、跨表外键字段允许手动补写（详见 `references/architecture-layers.md` §15.4）。
10. **关键位置日志**：业务校验失败、CAS 冲突、远端 RPC 调用返回 null、字段反射写入数、子资源创建数等关键位置必须打 `log.warn` / `log.info`，输出业务键（`uniqueValue` / `nodeCode` / `taskId` / `idempotencyKey`）。Controller 不打日志（一行转发），日志责任在 Service 聚合层（详见 `references/architecture-layers.md` §15.5）。
11. **Mapper XML** 必须与 Mapper 接口同名共存（无自定义 SQL 时也建占位 XML）。
12. **提交前剔除未使用代码**：新增 / 修改 Service 与 Component 时，真 0 引用的接口方法、私有 helper、未引用形参、未使用 import 必须随本次改动同步删掉（接口 + 实现 + 调用方一起动）。"诊断告警"（形参恒为 null / switch 升级 / 重复代码段）**不等于死代码**，是 Feign 契约 / 业务约束 / 风格建议，**保留**（详见 `references/code-structure.md` §8.5）。
13. **方法简化（提交前必查）**：除"未使用代码"外，新增 / 修改 Service 与 Component Service 实现类时，对私有 helper 做一轮反例扫：一判断一抛异常 → 内联调用点；一判断一返回 → 内联三元；取列表第一个 / 拼接字符串 → 删除 + 调用方内联；≥3 形参 wrapper → 封 DTO；一调用一方法 wrapper（仅调 1 次 Component Service）→ 删除 + 调用方直接调 Component Service；0 调用 dead method → 直接删。合规 helper（业务规则解析 / 反射 / 搜索工具 / 链式调用）必须保留（详见 `references/code-structure.md` §8.6）。

### 代码生成范围

| 模块 | 内容 |
|------|------|
| bi-cashier-api | DTO、VO（手动管理）、Feign Client |
| bi-cashier-component | PO、Mapper、Service（IXxxService）、ServiceImpl（继承 ServiceImpl） |
| bi-cashier-service | ManageService（IXxxManageService）、ManageServiceImpl |
| bi-cashier-web | Controller、Mapper.xml |

## 代码规范

> 完整规则在 `references/code-structure.md` 与 `references/coding-quality.md`。本节是最关键的 8 条速查。

### 0. 接口（interface）注释规范

interface 内的方法、常量、字段变量**必须带有 Javadoc 注释**，不允许只写签名不写注释。注释要写清**业务语义**（做什么、为什么、入参/出参约束），不能用空壳 `/** xxx */` 蒙混过关。

**适用范围**：本规范覆盖 `bi-cashier-api`、`bi-cashier-component`、`bi-cashier-service`、`bi-cashier-web` 内所有 Java interface，包括但不限于：

- Service 接口（`IXxxManageService` / `IXxxService`）
- Feign Client 接口（`*Client.java`，位于 `bi-cashier-api`）
- DTO/VO 字段、`enum` 常量
- 自定义 SPI / 回调接口

**强制要求**：

| 元素 | 必须带注释 | 注释要求 |
|------|----------|---------|
| interface 方法（含 default / static） | ✅ | 业务语义 + 入参约束 + 返回值含义 + 异常场景；若有 Feign 语义需注明调用方、超时、重试策略 |
| interface 常量（`String XXX = "..."` / 枚举值） | ✅ | 含义、合法取值、引用方 |
| interface 字段变量（极少使用，必须配 Javadoc） | ✅ | 含义、单位、合法范围 |
| interface 自身 | ✅ | 接口目的、归属模块、典型实现或调用方 |

**正例**：

```java
/**
 * 银行卡管理服务：聚合银行卡主档与关联附件的增删改查。
 *
 * @author cashier-team
 * @since 2024-01-01
 */
public interface IBankCardManageService {

    /**
     * 新增银行卡主档并级联写入文件到期记录与标签库。
     *
     * @param req 新增请求（含主档字段 + 附件 ID 列表 + 标签名列表），主档字段非空
     * @return 新增成功后的业务唯一流水号 uniqueValue
     * @throws BusinessException 当银行账号重复或附件缺失时抛出
     */
    String addBankCard(AddBankCardDTO req);

    /**
     * 银行账号字段名前缀：DB 列 `bank_account_no` 在 DTO 中的驼峰名。
     */
    String BANK_ACCOUNT_NO_FIELD = "bankAccountNo";
}
```

**反例（禁止）**：

```java
// ❌ 方法无注释
String addBankCard(AddBankCardDTO req);

// ❌ 常量无注释
String BANK_ACCOUNT_NO_FIELD = "bankAccountNo";

// ❌ 空壳 Javadoc
/** 新增银行卡 */
String addBankCard(AddBankCardDTO req);
```

> 历史存量代码可豁免，但新代码、改动行（包含新增 / 修改的方法、常量）必须遵守本节。

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
- **提示语必须大白话（硬性）**：`BusinessException` 的提示文案是前端直接展示给用户的，**禁止**程序员腔（"不能为空" / "请刷新页面重试" / "刷新失败" 等），**禁止**暴露内部术语（`uniqueValue` / `taskId` / `CAS` / `bi-file` / `Flowable` / `Redis` 等中间件名）。业务键定位只放在 `log.warn` / `log.info` 中。详见 `references/coding-quality.md` §3.2。
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
| 命名、**注释规范（覆盖 interface 方法 / 常量 / 字段 Javadoc）**、注解、**异常处理完整规约**、**日志格式细化**、**安全性规约**、**错误码/错误信息规范**、**Feign 客户端使用规约** | `references/coding-quality.md` |
| PO 基类、uniqueValue 生成、软删除、复合主从表、SQL 归档、**PO 字段映射规约** | `references/data-model-sql.md` |
| 性能红线、批量查库、异步导出、敏感字段权限 | `references/performance.md` |
| 本模块字典/系统数据翻译做法（不使用 AOP 注解） | `references/translation-aop.md` |
| 类间结构（业务/数据分离、Manager 拆分、Impl 膨胀阈值、Facade 模式）、**业务-数据归属精确规则** | `references/concerns-separation.md` |
| 分层、**Controller 模式规范**、Service 聚合、Component、Mapper、Helper、Convert、**调用链规范** | `references/architecture-layers.md` |
| **Interface 注释规范完整版**（方法/常量/字段变量 Javadoc、Feign Client、DTO/VO 字段） | `references/coding-quality.md`（"注释规范"章节） |
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
- **禁止 interface 内方法、常量、字段变量无注释**——必须按本文档"代码规范 §0 接口注释规范"逐项加 Javadoc；新增 / 改动行不允许出现无注释的方法签名或常量定义。
