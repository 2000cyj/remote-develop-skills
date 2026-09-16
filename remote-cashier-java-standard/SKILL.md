---
name: remote-cashier-java-standard
description: Use when 在 bi-cashier-api、bi-cashier-component、bi-cashier-service 或 bi-cashier-web 中新建、修改或审查 Java 后端代码及关联 Mapper XML/SQL，包括 DTO/VO/PO、分层调用、Service 与 Component 职责、Feign 和数据访问规范；或 prompt 中出现显式触发短语「使用 oboJava 规范」「按 oboJava 规范修改」「按 oboJava 规范审查」中的任意一个、并伴随对 bi-cashier-* 模块 Java 后端代码的修改/审查/重构描述。不要用于其他 BI/OBO 模块。
---

# bi-cashier 模块 Java 开发规范

本模块继承 OBO BI Java 开发规范，针对出纳模块的特性做了补充说明。本 skill 只约束 `bi-cashier` 模块组，不是通用 BI/OBO Java 规范。

## 适用范围

仅在目标属于以下 Maven 模块之一时使用本 skill：

- `bi-cashier-api`、`bi-cashier-component`、`bi-cashier-service` 或 `bi-cashier-web`。

模块归属是唯一判断维度。包名 `com.obo.bi.cashier` 只是模块内的进一步验证条件，不能脱离模块单独触发；包名一致但所在 Maven 模块不是上述四个之一的，本规范不适用。
同时适用于与上述模块 Java 实现直接关联的 Mapper XML、`bi-cashier` SQL 和代码评审。

不得把本规范套用到 `bi-file`、`bi-user` 或其他 BI/OBO Java 模块，即使它们采用相似分层或命名、包名相近或复用本规范的辅助类。跨模块任务只对其中明确属于 `bi-cashier` 模块组的文件使用本规范；无法从 Maven 模块确认归属时，不要推断适用。

### 显式触发短语（用户约定触发器）

为了让团队成员在不方便显式说仓库名时也能稳定触发本 skill，约定以下三类显式触发短语（出现任意一个即视为命中本 skill 的触发条件，无需再额外指定 `bi-cashier-*` 仓库名）：

- `使用 oboJava 规范`
- `按 oboJava 规范修改`
- `按 oboJava 规范审查`

命中后，紧随其后的 prompt 仍需描述具体的 Java 后端开发/审查/重构任务（如"帮我改 XX Service" / "review XX 的 Mapper XML" / "新建一个 XX DTO" 等）。仅触发短语而无具体任务描述时，应向用户反问澄清，不要默认加载本 skill。

> 该约定来自团队内部对"如何稳定触发 cashier Java 规范"的讨论记录，目的是降低误报（不强制要求每次都说仓库名）+ 提高稳定性（即使 prompt 中省略仓库名也能命中）。仓库归属本身的硬约束（只覆盖 `bi-cashier-*` 四个模块）保持不变。

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
| Component（`-component`） | 单表 CRUD（`this.lambdaQuery()` / `this.lambdaUpdate()` 链式）、Mapper XML 编写、Helper / Convert / TypeHandler / 内部 enum / constant；PO 上允许标注 `@TableName` / `@TableId` / `@TableField` | 跨业务编排（除非抽为 `@Component` Helper）、调用其它业务 Service 或跨服务 Feign |
| API（`-api`） | 定义 DTO / VO / 枚举 / Feign Client；少量公共 convert | 任何业务逻辑、`@Service`、Mapper 调用；DTO/VO 上使用 `@TableName` / `@TableId` / `@TableField`（见规则 4.1） |

**调用方向是唯一的**：`Controller → ManageService → Component → Mapper`。任意反向或越级调用视为违规。

### 关键规则

1. **Service 聚合层** 接口以 `Manage` 后缀命名，**禁止** `Manage` 后缀出现在 Component 层。
2. **Component 层** 继承 MyBatis-Plus `ServiceImpl`，**禁止**含 `Manage` 后缀。
3. **Web 层** 只能调用 Service 聚合层，禁止越级调用 Component。
4. **DTO/VO** 字段使用驼峰命名。`@TableField` / `@TableName` / `@TableId` 仅允许标注在 PO 上，DTO / VO / Req / Resp 一律禁止（见规则 4.1）。
4.1. **MyBatis-Plus 注解作用域（强约束）**：`@TableField`、`@TableName`、`@TableId`（含 `IdType`）**只允许标注在 `bi-cashier-component/.../po/Xxx.java`（即 PO 数据库实体）**。DTO / VO / Req / Resp / Form / 任何非 PO 类一律禁止使用上述三个注解及其内部 value / exist / select / fill / typeHandler 等属性。原因：DTO/VO 是视图契约，不应承担持久层元数据；XML 已用 `column AS camelCase` 显式做列别名映射，运行时完全无依赖。
   - **审查硬指标**：扫描 `bi-cashier-api/**/*.java` 与 `bi-cashier-service/**/*.java` 中是否出现 `@TableField` / `@TableName` / `@TableId` 三个 import 路径（`com.baomidou.mybatisplus.annotation.*`），命中即违规；扫描 `bi-cashier-web/**/*.java` 的 VO / DTO，同上。Component 层的非 PO 类（如内部 DTO、Convert 入参 VO）也按此约束。
   - **常见违规反例**：`XxxDTO` 加 `@TableField("snake_case")` 想"补全映射"、`XxxVO` 加 `@TableField` 写别名——均视为冗余且违规，删除即可。
   - **正例**：`com.obo.bi.cashier.po.Store`（PO）上保留 `@TableName("cashier_store")` / `@TableId(value="id", type=IdType.ASSIGN_ID)`；`com.obo.bi.cashier.vo.StorePageVO`（VO）只保留 `@ApiModelProperty` / `@DateTimeFormat` / `@JsonFormat`，**不得**出现 `@TableField`。
4.2. **测试脚本作用域（强约束）**：`src/test` 目录**只允许存在于 `bi-cashier-web` 模块**。`bi-cashier-api`、`bi-cashier-component`、`bi-cashier-service` 三个模块**不得**新建或保留任何 `src/test` 目录及其下任何文件（Java / 资源 / 配置文件均算）。
   - **历史存量清理**：`bi-cashier-service/src/test` 下历史测试已清空（27 个 `*Test.java` 全删）；`bi-cashier-component/src/test` 与 `bi-cashier-api/src/test` 同样需保持无此目录。
   - **审查硬指标**：跑 `ls bi-cashier-{api,component,service}/src/test 2>/dev/null` 三次均应无输出；任一命中即违规。
4.3. **测试内容范围**：即使是 `bi-cashier-web` 的测试脚本，也**只允许写 Controller 公开方法**的测试。Service / Component / Mapper / PO / Helper / Convert / Util 等任何非 Controller 类的测试**不得**写在 web 模块的 test 目录下。
   - **理由**：Controller 是分层架构中**唯一**对外的稳定契约（与前端联调界面）；Service / Component 等内部实现变动频繁，写测试锁住内部细节反而拖累演进。Controller 端的 MockMvc + Mockito 单测足以覆盖入参校验、权限拦截、Service 调用映射、异常翻译这些稳定面。
   - **正确放法**：
     - `XxxController` 的方法行为（含硬拒绝、参数校验、MockMvc 路径）→ 放 `bi-cashier-web/src/test/.../controller/XxxControllerXxxTest.java` ✅
     - `XxxManageServiceImpl` 的业务方法 → **不写**测试脚本（依赖人工/接口联调验证），如确需行为回归，改在 Controller 层通过 MockMvc 间接触达 ❌
     - `XxxMapper` / `XxxMapper.xml` 的 SQL 约束 → **不写**测试脚本（违反"只测 Controller"），需要时由 CodeGraph / 人工评审核查 SQL XML。
   - **正例**：`bi-cashier-web/src/test/.../controller/EmployeeControllerHardRejectTest.java`、`.../controller/EmployeeControllerRelatedUserEndpointsTest.java`。
   - **反例**（即使放 web 模块下也违规）：
     - `bi-cashier-web/src/test/.../service/impl/XxxServiceImplTest.java` ❌
     - `bi-cashier-web/src/test/.../mapper/XxxMapperXmlTest.java` ❌（如 `CompanyMapperXmlTest.java` 当前即违规，应删除并改在 Mapper XML 评审中人工核查）
     - `bi-cashier-web/src/test/.../util/XxxUtilsTest.java` ❌
   - **审查硬指标**：列出 `bi-cashier-web/src/test/**/*Test.java`，其包路径前缀只能出现 `controller.`；出现 `service.` / `mapper.` / `util.` / `convert.` / `po.` 等任何非 controller 子包即违规。

4.4. **禁止聚合 / 上下文 DTO 内嵌在 Service / Interface / Impl 中（强约束）**：
   - **禁止场景**：`bi-cashier-{component,service,web}` 任意文件（Service 接口、ServiceImpl、Helper、Convert、Recorder、Feign Client 实现等）**不得**在文件内用 `@Data @Builder @NoArgsConstructor @AllArgsConstructor class XxxContext / XxxReq / XxxResp / XxxDTO / XxxVO` 定义聚合 DTO。
   - **正确做法**：所有聚合 / 上下文 DTO **必须**作为独立顶级 `public class` 写在 `bi-cashier-api/src/main/java/com/obo/bi/cashier/dto/{audit,onboarding,...}/XxxContext.java` 等独立 `.java` 文件里。
   - **反面案例**：
     ```java
     // ❌ 接口内嵌 Context（违反 §4.4）
     public interface AccountAuditRecorder {
         void recordStoreOnboarding(StoreAuditOnboardingAuditContext context);
         @Data class StoreAuditOnboardingAuditContext { ... }
     }
     // ❌ Impl 类内嵌 Req（违反 §4.4）
     @Service
     public class AccountAuditRecorderImpl {
         private AccountChangeDetails buildEditDetail(BuildEditDetailReq req) { ... }
         @Data private static class BuildEditDetailReq { ... }
     }
     ```
   - **正确做法**：
     ```java
     // ✅ bi-cashier-api/dto/audit/StoreAuditOnboardingAuditContext.java
     @Data @Builder @NoArgsConstructor @AllArgsConstructor
     public class StoreAuditOnboardingAuditContext { ... }

     // ✅ 接口引用顶级 DTO（不再内嵌定义）
     public interface AccountAuditRecorder {
         void recordStoreOnboarding(StoreAuditOnboardingAuditContext context);
     }
     ```
   - **理由**：内嵌 DTO 阻碍跨模块 / 跨包复用（`private static class` 外部不可见）；DTO 是契约层，必须放 `bi-cashier-api` 与 Feign Client / VO 对齐。
   - **审查硬指标**：
     - `grep -rEn "@lombok\.(Data|Builder).*\b(class|@?public class)\s+(XxxContext|XxxReq|XxxResp|XxxDTO|XxxVO)\b" bi-cashier-{component,service,web}/src/main/java/`
     - 命中且**不在** `bi-cashier-api/.../dto/Xxx.java` 文件内 → 违规
     - Service 接口（如 `XxxRecorder.java` / `IXxxService.java`）内 `@lombok.Data class XxxContext` 100% 违规
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
9. **同名字段对象赋值用 BeanCopyUtils**：两个对象 / 集合互转，**同名字段 ≥ 3 条**时必须使用 `com.obo.core.common.utils.BeanCopyUtils.copy(src, Xxx::new)` / `BeanCopyUtils.copyList(src, Xxx::new)` / `BeanCopyUtils.copyIgnore(src, Xxx::new, "field1", "field2")`，禁止 20 行手动 `setX`。**混合场景**（同名字段 ≥ 3 条但存在例外字段）：首选 `copyIgnore` 排除例外字段（避免源对象脏数据覆写），剩余字段自动复制；例外字段（DTO/PO 都不含的派生字段、`null` 兜底字段、跨表外键字段）才手动 setX。**禁止**“看见例外字段就退出 copy、剩下全手写”的过激反应（详见 `references/architecture-layers.md` §15.4）。
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

### 9. 分页 `PageResult` 必须声明泛型（V20260914 新增）

分页返回值 `com.obo.core.common.entity.result.PageResult` 是泛型类 `PageResult<T>`，`T` 表示 `records` 字段的元素类型。**禁止**写裸 `PageResult`（raw type）。

#### 反例（裸 PageResult）

```java
// 接口
PageResult pageOperatingScope(OperatingScopePageDTO dto);

// 实现（运行时实际返回 PageResult<OperatingScope>，但签名是 raw）
public PageResult pageOperatingScope(OperatingScopePageDTO dto) {
    Page<OperatingScope> page = new Page<>(dto.getPageNum(), dto.getPageSize());
    IPage<OperatingScope> result = this.lambdaQuery()...page(page);
    return new PageResult(result.getTotal(), result.getRecords()); // 编译器认为是 raw
}
```

#### 正例（带泛型）

```java
// 接口
PageResult<OperatingScope> pageOperatingScope(OperatingScopePageDTO dto);

// 实现（签名与 new 表达式类型一致）
public PageResult<OperatingScope> pageOperatingScope(OperatingScopePageDTO dto) {
    ...
    return new PageResult<>(result.getTotal(), result.getRecords()); // 菱形式更好，也可写 new PageResult<OperatingScope>(...)
}
```

#### 规则

1. **接口 / 实现 / 调用方声明必须一致**：上层接口 `PageResult<T>`，下层实现也必须是 `PageResult<T>`（不能上层 `PageResult<OperatingScopeVO>` 而下层返回 `PageResult<OperatingScope>` —— 类型擦除不会报错但运行期 ClassCastException）
2. **T 由 `records` 实际元素类型决定**：Component 层一般返回 PO（`PageResult<OperatingScope>`），ManageService 层如要做 PO→VO 转换，需在 ManageService 内 `BeanCopyUtils.copyList(records, OperatingScopeVO::new)` 再包成 `PageResult<OperatingScopeVO>`
3. **`Controller` `Result<PageResult<T>>` 同样必须带 T**：`Result<PageResult>` 也算 raw，等同违规
4. **菱形式 `new PageResult<>(...)` 优先**：与 Java 7+ 惯例一致；不必写 `new PageResult<OperatingScope>(...)`
5. **注意链式调用中的伪泛型**：上层接口写 `PageResult<OperatingScopeVO>` 但实现直接 `return component.pageXxx(dto)`，若 Component 返回的是 `PageResult<OperatingScope>` 实际是伪泛型 —— 必须显式转换 records 后再包一层

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
| 类文件内代码布局（import 分组、字段/方法顺序、guard clauses、私有 helper）、**DTO/VO 设计规范**、**DTO/VO 字段 Javadoc 句末不带句号 + 字段间空行 + 类体首尾空行（V20260912 新增）** | `references/code-structure.md` |
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
- **禁止聚合 / 上下文 DTO 内嵌在 Service / Interface / Impl 中**——见 §4.4，所有 `XxxContext` / `XxxReq` 必须放 `bi-cashier-api/dto/` 作为顶级 `public class`。
- **禁止 DTO/VO 字段 Javadoc 句末带句号、字段间无空行、类体首尾缺空行**——见 `references/code-structure.md` §6.2 / §6.3（V20260912 新增）；DTO/VO 字段 Javadoc 末尾不加 `。`，每个字段声明后空一行，类 `{` 后与 `}` 前各空一行。

## 实战重构案例（V20260907）

> 本节是 bi-cashier 实际完成的若干轮重构沉淀下来的"判断口径"。每条都对应至少 1 次"可改可不改"的取舍，给出**明确倾向**+**例外**。新 PR 评审遇到同类场景时可直接引用。

### 1. 二级模块编码（`twoLevelId`）走 `TwoLevelEnum`，禁止字面量硬编码

**4 个 `*Audit*ManageServiceImpl` 原先各自 `private static final String TWO_LEVEL_ID_CWSH = "CWSH";`**——4 份重复硬编码，且与 `bi-factory` 的 `TwoLevelEnum.CWSH`（value="cwsh"）撞名。

**统一做法**：
- `bi-core/.../enums/TwoLevelEnum` 加 4 个出纳流程枚举项（`DPSJLC` / `DPXJLC` / `DPBGLC` / `DPYCZTLC`）
- 4 个 Impl 用 `import static com.obo.core.common.enums.TwoLevelEnum.DPBGLC;` 后写 `submitReq.setTwoLevelId(DPBGLC.getValue())`
- 删除 4 份私有常量

**反面**：DTO 上加 `private String twoLevelId = "CWSH"` 默认值。看似省事，但驳回/退回/异常等非默认场景会被静默覆盖，且会埋"远端 enum 改 code 字符串"的未来不一致雷。

### 2. Flowable outcome 走远端 `FlowableOutcomeEnum.APPROVE.getCode()`，禁止本地"业务字符串"常量

**4 个 Impl 原先 `private static final String OUTCOME_PASS = "PASS"` / `"同意"`**——其中 Change/Abnormal 的 `"PASS"` **不匹配远端 `FlowableOutcomeEnum` 任何 code**（远端合法值是"同意/通过/驳回/拒绝/不通过/rejected/撤回/退回"），是隐藏 bug。

**统一做法**：
- `import static com.obo.bi.flowable.enums.FlowableOutcomeEnum.APPROVE;`
- 全部 `setOutcome(APPROVE.getCode())`
- 删除本地 4 份 `OUTCOME_PASS` 常量

**例外**：skill `error-handling.md:7` 明确"outcome 必传"。**不能**因为"远端有默认行为"就省略 setOutcome——通过路径下省略会导致 `flow_outcome` 流程变量丢失，下游变量门会失效。

### 3. 节点号走 `XxxNodeEnum.getNodeNo()`，禁止 `private static final int NODE_NO_xxx`

**`StoreAuditOnboardingManageServiceImpl` 原先 `NODE_NO_PLATFORM_ONBOARDING = 9` / `NODE_NO_STORE_BUILD_CONFIRM = 10`**——12 处使用，与 `StoreAuditOnboardingNodeEnum.PLATFORM_ONBOARDING.getNodeNo()` 重复定义节点号。

**统一做法**：
- 删除 2 个 `int` 私有常量
- 12 处 `==` 改为 `StoreAuditOnboardingNodeEnum.PLATFORM_ONBOARDING.getNodeNo()` / `.STORE_BUILD_CONFIRM.getNodeNo()`

**理由**：`getNodeNo()` 是 enum 单例的 final 方法，**JIT 内联 0 开销**；换来"流程加节点 11 时只改 enum 一处"的强保证。

### 4. DTO 反射写入（`applyFields`）的字段白名单**可去**，但要明确风险

**`StoreAuditOnboardingManageServiceImpl` 原先 `PLATFORM_ONBOARDING_FIELDS` / `STORE_BUILD_CONFIRM_FIELDS` 两个 Set**——作为反射写入前的"白名单护栏"。

**两种处理**：
- **A（保留）**：补 Javadoc 说明"为什么是白名单"。理由：白名单是反射的安全护栏，缺失会让 DTO 里任意字段（含 `id` / `uniqueValue` / `deleted`）被改。
- **B（去白名单 + 保留反射）**：`applyFields` 删 `allowedFields` 形参，找不到字段 `log.warn + continue`，`validateNodeDataItems` 同步删白名单循环。**接受"业务表任意字段可被 DTO 改写"的风险**。
- **C（去白名单 + 去反射）**：重写 `applyFields` 为 `BeanUtils.copyProperties` + 强类型 DTO。**工程量大，不在本次范围**。

**评审倾向**：项目方拍板 B 则按 B 执行；**绝不**因为"用得不多"就误删白名单后又未改反射实现。

### 5. 业务限制常量 `MIN_xxx` / `MAX_xxx` 按"是否仅日志"判断去留

**Change 文件 `MIN_STORE_CHANGE_ITEM_COUNT` / `MAX_STORE_CHANGE_ITEM_COUNT`，Abnormal 同样两份**。

**判断口径**：
- **仅写日志**（无业务校验）→ **删，改字面量**。Change 的 `MIN_STORE_CHANGE_ITEM_COUNT` 是这种情况（`1` 是行业常识），删除后 2 处 log 直接写 `1`。
- **有业务校验** + **log** + **错误消息拼接** 三种职责 → **保留为私有常量 OR 抽到公共常量类**。Abnormal 的 `MAX_ABNORMAL_STORE_COUNT` 是这种情况（6 处使用，2 处校验 / 2 处 log / 2 处错误消息）。
- **纯字面量 vs 命名常量**取舍：业务团队能接受"未来改阈值要在 N 处同步"→ 字面量；否则保留或抽公共。

**执行经验**：用"占位符→字面量"两段式避免冲突——先把 `OLD_NAME` 改成 `OLD_NAME_PLACEHOLDER`（`replace_all` 一把全改），再 `replace_all` 把占位符全替换成字面量，保证 N 处同步。

### 6. 不要顺手写"不存在的常量"

**教训**：本人在执行"删 MIN_STORE_CHANGE_ITEM_COUNT"步骤时，**手滑**写出 `private static final String OUTCOME_PASS_VALUE = "同意";`——这是上一轮已删的"用 APPROVE.getCode() 替代"的旧实现。`OUTCOME_PASS_VALUE` 是个**凭空编造**的常量名。

**防御**：
- 删除常量前，先用 `grep -rn "常量名" --include="*.java"` 确认 0 引用
- 写常量前，先用 `grep -rn "常量名" --include="*.java"` 确认**真的没人叫这个名字**
- Edit 工具的"old_string / new_string"比对能挡住一部分，但**手滑的"虚构旧名"挡不住**

### 7. 禁止"简单数据筛选赋值"wrapper helper（V20260907 强化）

**反面案例**（`AccountAuditRecorderImpl` 原状）：

```java
private Map<String, StoreAuditOnboardingStore> buildStoreOnboardingStoreMap(List<StoreAuditOnboardingStore> stores) {
    if (stores == null) { return new HashMap<>(); }
    return stores.stream()
            .filter(s -> s != null && StringUtils.isNotBlank(s.getStoreUniqueValue()))
            .collect(Collectors.toMap(StoreAuditOnboardingStore::getStoreUniqueValue, s -> s, (a, b) -> a));
}
```

- **4 个几乎一样的 helper**（`buildStoreOnboarding/Offboarding/Change/AbnormalStoreMap`），仅泛型不同
- 每个仅被**1 个调用方**使用（`recordStoreXxx`）
- 纯数据筛选 + `Collectors.toMap` 包装，**无任何业务逻辑**

**判定为反模式**：skill §13.6 已列"一调用一方法 wrapper → 删"。**简单数据 wrapper 不构成"独立业务单元"**——拆出来反而：
- 增加阅读跳数（点进 helper 才能看到在做什么）
- 4 个 helper 的**重复结构**会随业务演进漂移（哪天需要过滤条件了，4 处可能要分别改）
- 行数虚增但实质信息量=0

**正确做法**：直接在 record 方法体内写 stream 三元式：

```java
Map<String, StoreAuditOnboardingStore> storeMap = context.getStores() == null
        ? new HashMap<>()
        : context.getStores().stream()
                .filter(s -> s != null && StringUtils.isNotBlank(s.getStoreUniqueValue()))
                .collect(Collectors.toMap(StoreAuditOnboardingStore::getStoreUniqueValue, s -> s, (a, b) -> a));
```

**保留 helper 的判断标准**（**3 条全满足**才保留）：

1. ✅ helper 内部有**真实业务逻辑**（不是单纯 filter / map / collect）
2. ✅ helper 被**至少 2 个调用方**使用
3. ✅ helper 的语义**无法用 1-3 行业务代码内联替代**（如复杂查询构造、递归搜索、链式组装）

**反面**（满足任一条件即应内联）：
- ❌ 纯数据流转换（filter / map / collect / 兜底赋值）
- ❌ 单调用方
- ❌ 业务规则能用 if / 三元 / 链式调表达

**典型违规清单**（PR评审可直接扫）：

```bash
# 找 4 个候选 helper 类型的违规private 方法
grep -nE "private\s+(Map<String|List<|void)\s+\w+\(" impl/*.java | grep -v "Override"
```

常见违规命名：`buildXxxMap` / `buildXxxList` / `applyXxxDefaults` / `initXxxContext` / `convertXxxMap`


### 8. `@Resource` 注入字段按字段名字母序统一放到类名下（V20260914）

> 来源：`OperatingScopeManageServiceImpl` 重构（2026-09-14）。原文件把第二个 `@Resource` 字段插在 `updateOperatingScope` 和 `deleteOperatingScope` 两个方法之间，违反 §4「字段顺序」。

**反面案例**：

```java
@Service
public class OperatingScopeManageServiceImpl implements IOperatingScopeManageService {

    @Resource
    private IOperatingScopeService operatingScopeService;

    @Override
    public PageResult pageOperatingScope(OperatingScopePageDTO dto) { ... }

    // ... 若干 public 方法 ...

    @Resource
    private ICompanyBusinessScopeService companyBusinessScopeService;   // ❌ 散落在方法间

    @Transactional(rollbackFor = Exception.class)
    @Override
    public Boolean deleteOperatingScope(Long id) {
        // 这里才用到 companyBusinessScopeService
    }
}
```

**判定为反模式**：违反 §4「字段顺序」——`@Resource` 注入字段必须**集中放在类名下、方法声明之前**，且多个 `@Resource` 之间按**字段名**（不是类型名）字母序排列。

**正确做法**：

```java
@Service
public class OperatingScopeManageServiceImpl implements IOperatingScopeManageService {

    @Resource
    private ICompanyBusinessScopeService companyBusinessScopeService;   // c 字母序在前

    @Resource
    private IOperatingScopeService operatingScopeService;

    @Override
    public PageResult pageOperatingScope(OperatingScopePageDTO dto) { ... }
}
```

**理由**：
1. 字段集中声明使 Service 依赖的 Component 一目了然
2. 字母序避免「我先写的 `@Resource` 在前面、后写的反而在后」的散乱
3. PR 评审可用一行命令验证：`grep -n "@Resource" <file>.java` 应集中在类体顶部 1-2 行内

**典型违规扫描**：

```bash
# @Resource 字段应该只出现在类体顶部，不应散落在 public 方法之间
awk '/@Resource/{found=NR; next} /^[[:space:]]*(public|@Override)/ && found && NR > found + 2 {print FILENAME":"NR": @Resource 散落到方法间"}' <file>.java
```

判定：所有 `@Resource` 行号必须小于该类第一个 `@Override` 或 `public` 方法的行号。


### 9. 分页 PageResult 泛型链路对齐：Controller → Manage → Component（V20260914）

> 来源：`OperatingScopeController` / `IOperatingScopeManageService` / `OperatingScopeManageServiceImpl` / `IOperatingScopeService` / `OperatingScopeServiceImpl` 五层分页链路类型对齐（2026-09-14）。

#### 原链路（3 处不一致，全靠类型擦除骗编译）

| 层 | 文件:行 | 原签名 | 问题 |
|---|---|---|---|
| Controller | `OperatingScopeController.java:46` | `Result<PageResult>` | raw PageResult；PO 全部字段（含 `deleted` / `parent_id` 表字段）泄漏到前端 |
| Manage 接口 | `IOperatingScopeManageService.java:23` | `PageResult<OperatingScope>` | PO 透出 Manage 层；与 Controller 拼不起来 |
| Manage 实现 | `OperatingScopeManageServiceImpl.java:48` | `PageResult<OperatingScopeVO>` | **伪泛型**——签名说 VO，records 实际是 PO（Component 返的），靠 `@SuppressWarnings` 或类型擦除编译过，运行期 `vo.getXxx()` 会 ClassCastException |
| Component 接口 | `IOperatingScopeService.java:22` | `PageResult` | raw PageResult |
| Component 实现 | `OperatingScopeServiceImpl.java:26` | `PageResult` | raw PageResult |

**伪泛型最阴险**：编译通过、所有 IDE 跳转正常、单元测试 mock 也 ok，唯一炸的场景是下游真正调用 `records.get(0).getName()` 才在运行期崩，且单元测试用 mock 不打 records 时根本发现不了。

#### 修复后链路（5 层类型一致 + 显式 PO→VO 转换点）

| 层 | 签名 | 转换点 |
|---|---|---|
| Controller | `Result<PageResult<OperatingScopeVO>>` | 仅委托 |
| Manage 接口 | `PageResult<OperatingScopeVO>` | — |
| Manage 实现 | `PageResult<OperatingScopeVO>` | **显式 `BeanCopyUtils.copyList(records, OperatingScopeVO::new)`** |
| Component 接口 | `PageResult<OperatingScope>` | — |
| Component 实现 | `PageResult<OperatingScope>` | 仅返回 PO records |

#### 关键代码：Manage 实现层的转换样板

```java
@Override
public PageResult<OperatingScopeVO> pageOperatingScope(OperatingScopePageDTO dto) {
    PageResult<OperatingScope> pageResult = operatingScopeService.pageOperatingScope(dto);
    if (CollectionUtils.isEmpty(pageResult.getRecords())) {
        return new PageResult<>(pageResult.getTotal() == null ? 0L : pageResult.getTotal(),
                                 Collections.emptyList());
    }
    List<OperatingScopeVO> records = BeanCopyUtils.copyList(pageResult.getRecords(), OperatingScopeVO::new);
    return new PageResult<>(pageResult.getTotal(), records);
}
```

#### 判定为反模式的 4 个特征

1. **接口/实现任一层是 raw `PageResult`**——编译器不会报，但 `getRecords()` 返回 raw `List`，下游遍历全靠强转
2. **上层接口声明 `PageResult<VO>` 但实现直接 `return component.pageXxx(dto)`**——伪泛型，重灾区
3. **Controller `Result<PageResult>` 没带泛型**——前端拿到响应时 `records` 字段类型是 `Object[]`，TS 端也拿不到元素类型提示
4. **PO 字段出现在 Controller 响应中**（如 `deleted` / `parent_id` / `create_by` 等表字段）——VO/PO 分层失效

#### 推荐扫描命令

```bash
# 扫 raw PageResult（无泛型参数的 PageResult 出现位置）
grep -rn "PageResult\b" --include="*.java" bi-cashier/ \
  | grep -vE "PageResult<[^>]+>" \
  | grep -vE "^[^:]+:[0-9]+:[[:space:]]*\*"     # 排除 Javadoc
  | grep -vE "^[^:]+:[0-9]+:[[:space:]]*//"     # 排除单行注释

# 扫伪泛型：Manage 实现里直接 return component.pageXxx 没用 copyList
grep -rn "return [a-zA-Z]*Service.page\|return component.page\|return [a-zA-Z]*ManageService.page" \
  --include="*ManageServiceImpl.java" bi-cashier/
```

#### 关联规则

- SKILL.md §9（分页 PageResult 必须声明泛型）——本案例是该规则的落地版
- `code-review-checklist.md` §3 + §8 检查项


### 10. Component 层 CRUD 失败必须写关键日志，不能静默返 false（V20260914）

> 来源：`OperatingScopeServiceImpl` 重构（2026-09-14）。原文件 3 个 CRUD 方法都是
> `return baseMapper.xxx() > 0;` 静默返 false，SELECT 按 ID 也静默返 null。

#### 反面案例（静默失败、无现场）

```java
@Service
public class OperatingScopeServiceImpl extends ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService {

    @Override
    public Boolean addOperatingScope(OperatingScope operatingScope) {
        return baseMapper.insert(operatingScope) > 0;          // ❌ 失败原因丢
    }

    @Override
    public Boolean updateOperatingScope(OperatingScope operatingScope) {
        return baseMapper.updateById(operatingScope) > 0;      // ❌ 上游直接转发 false 给前端
    }

    @Override
    public Boolean deleteOperatingScope(Long id) {
        return baseMapper.deleteById(id) > 0;                  // ❌ 同上
    }

    @Override
    public OperatingScopeVO queryOperatingScopeById(Long id) {
        OperatingScope scope = baseMapper.selectById(id);
        if (scope == null || scope.getDeleted() == 1) {        // ❌ null vs 软删 不分；且 getDeleted==1 是死代码（selectById 已被 @TableLogic 自动过滤）
            return null;
        }
        ...
    }
}
```

#### 三类问题与上游连锁后果

| Component 层问题 | Manage 层后果 | 前端后果 |
|---|---|---|
| `add` 返回 false | 上游抛 `BusinessException("新增经营范围失败")` | 用户看到“新增失败”；SRE 看不到为什么失败（约束冲突？重复键？连接超时？）|
| `update` 返回 false | 上游 `return operatingScopeService.updateOperatingScope(scope)` 直接转发 | **前端拿到 false 当成功**，用户不知道修改未生效 |
| `delete` 返回 false | 上游 `return operatingScopeService.removeByIds(scopeIds)` 直接转发 | 同上，列表看上去删了但实际还在 |
| `queryById` 返 null 不分场景 | Manage 层 `queryOperatingScopeById` 也返 null，调用方不知道是“id 不存在”还是“被软删” | 404 与 403 混淆，审计难度大（注：PO 继承 BaseEntity 后，selectById 已被 `@TableLogic` 自动过滤 deleted=1，`scope.getDeleted()==1` 分支是死代码，仅保留 null 与非 null 的区分） |

#### 正确做法：日志级别按场景选

```java
@Slf4j
@Service
public class OperatingScopeServiceImpl extends ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService {

    @Override
    public Boolean addOperatingScope(OperatingScope operatingScope) {
        boolean ok = baseMapper.insert(operatingScope) > 0;
        if (!ok) {
            // ERROR：上游会抛异常，用户级失败
            log.error("经营范围新增失败 name={}, parentId={}",
                    operatingScope.getName(), operatingScope.getParentId());
        }
        return ok;
    }

    @Override
    public Boolean updateOperatingScope(OperatingScope operatingScope) {
        boolean ok = baseMapper.updateById(operatingScope) > 0;
        if (!ok) {
            // WARN：可能是 id 不存在（伪 update），需要日志以便排查“修改未生效”
            log.warn("经营范围更新未生效 id={}, name={}",
                    operatingScope.getId(), operatingScope.getName());
        }
        return ok;
    }

    @Override
    public Boolean deleteOperatingScope(Long id) {
        boolean ok = baseMapper.deleteById(id) > 0;
        if (!ok) {
            log.warn("经营范围删除未生效 id={}", id);
        }
        return ok;
    }

    @Override
    public OperatingScopeVO queryOperatingScopeById(Long id) {
        OperatingScope scope = baseMapper.selectById(id);
        if (scope == null) {
            // DEBUG：404 正常场景，不污染生产日志
            // selectById 已被 BaseEntity.@TableLogic 自动过滤 deleted=1，不会返回软删记录，无需再判 getDeleted
            log.debug("经营范围详情查询未命中 id={}", id);
            return null;
        }
        ...
    }
}
```

#### 日志级别决策表

| 场景 | 级别 | 理由 |
|---|---|---|
| INSERT 返 false | `log.error` | 上游一定会转抛 `BusinessException`，用户级失败 |
| UPDATE 返 false | `log.warn` | 可能“伪 update”（id 不存在）也可能是 DB 错误，需要现场但不一定严重 |
| DELETE 返 false | `log.warn` | 同 UPDATE |
| SELECT by ID 未命中（null） | `log.debug` | 404 正常场景，生产日志不污染 |
| SELECT by ID 命中软删记录 | `log.warn` | 审计场景，可能是 stale id 或越权访问 |
| SELECT by ID 返 null 但调用方预期不为 null | `log.warn` | 需调用方主动检查并 log |
| `lambdaQuery().list()` 返 null | 转 `Collections.emptyList()` 并 **不**记日志 | §8 规定空集合返 `emptyList()` |
| `lambdaQuery().page()` 返 null（异常） | `log.error` + 重新抛 | MyBatis-Plus 一般不返 null，真返了是异常 |

#### 关联规则

- SKILL.md §10（关键业务事件日志）——原规则偏 Manage 层，本案例补齐 Component 层覆盖
- `code-review-checklist.md` §3 检查项（加了 Component 层日志条目）
- SKILL.md §8（空集合返 `Collections.emptyList()`）—— `listAllOperatingScope` 不能 log.error


### 11. BeanCopyUtils 混合场景：`copyIgnore` 排除例外字段（V20260914）

> 来源：`OperatingScopeManageServiceImpl` 重构（2026-09-14）。`addOperatingScope` 有 6 个同名字段 + 2 个例外字段（`parentId` null 兜底、`level` 派生计算）。前一轮 sweep **漏了 BeanCopyUtils 优化**——看到例外字段就停手、剩下 6 个同名字段全手写。

#### 原代码（错误：“看到例外就退出 copy”）

```java
@Override
public Boolean addOperatingScope(OperatingScopeSaveDTO dto) {
    OperatingScope scope = new OperatingScope();
    scope.setParentId(dto.getParentId() == null ? 0L : dto.getParentId());  // 例外1：null 兜底
    if (dto.getParentId() == null) {
        scope.setLevel(1);                                                   // 例外2：派生
    } else {
        OperatingScopeVO parent = operatingScopeService.queryOperatingScopeById(dto.getParentId());
        scope.setLevel(parent != null ? parent.getLevel() + 1 : 1);
    }
    scope.setName(dto.getName());                       // 同名字段 × 5 手写
    scope.setRemark(dto.getRemark());
    scope.setBusinessScopeDescription(dto.getBusinessScopeDescription());
    scope.setSort(dto.getSort());
    scope.setIndustryCategory(dto.getIndustryCategory());
    boolean ok = operatingScopeService.addOperatingScope(scope);
    if (!ok) {
        throw new BusinessException("新增经营范围失败，请稍后重试");
    }
    return true;
}

@Override
public Boolean updateOperatingScope(OperatingScopeSaveDTO dto) {
    if (dto.getId() == null) {
        throw new BusinessException("更新经营范围失败：经营类型ID不能为空");
    }
    OperatingScope scope = new OperatingScope();
    scope.setId(dto.getId());                          // 同名字段 × 6 手写
    scope.setName(dto.getName());
    scope.setRemark(dto.getRemark());
    scope.setBusinessScopeDescription(dto.getBusinessScopeDescription());
    scope.setSort(dto.getSort());
    scope.setIndustryCategory(dto.getIndustryCategory());
    return operatingScopeService.updateOperatingScope(scope);
}
```

#### 判定流程（现在加在 §9 + §15.4）

1. 数同名字段：6 个（`id` / `name` / `remark` / `businessScopeDescription` / `sort` / `industryCategory`）→ ≥ 3，必须 BeanCopy
2. 例外字段是否在源 DTO 里同时存在？
   - `level` **在 DTO 和 PO 里都有**（DTO 里定义了但前端不应传）→ **`copyIgnore("level")` 排除**
   - `parentId` 在两边都有但是**语义不同**（DTO=null 表“顶级”，PO=0 表“顶级”）→ 手写 setX 覆写
3. 选择 `copyIgnore` 路径：例例字段不能信，后端重算或赋默认

#### 优化后代码

```java
@Override
public Boolean addOperatingScope(OperatingScopeSaveDTO dto) {
    // copyIgnore("level")：DTO.level 不能信，后端根据 parent 重新计算
    OperatingScope scope = BeanCopyUtils.copyIgnore(dto, OperatingScope::new, "level");
    scope.setParentId(dto.getParentId() == null ? 0L : dto.getParentId());
    if (dto.getParentId() == null) {
        scope.setLevel(1);
    } else {
        OperatingScopeVO parent = operatingScopeService.queryOperatingScopeById(dto.getParentId());
        scope.setLevel(parent != null ? parent.getLevel() + 1 : 1);
    }
    boolean ok = operatingScopeService.addOperatingScope(scope);
    if (!ok) {
        throw new BusinessException("新增经营范围失败，请稍后重试");
    }
    return true;
}

@Override
public Boolean updateOperatingScope(OperatingScopeSaveDTO dto) {
    if (dto.getId() == null) {
        throw new BusinessException("更新经营范围失败：经营类型ID不能为空");
    }
    // DTO 无需排除的例外字段，直接 copy
    OperatingScope scope = BeanCopyUtils.copy(dto, OperatingScope::new);
    return operatingScopeService.updateOperatingScope(scope);
}
```

#### 三类场景决策表

| 场景 | copy | copyIgnore | 手写 setX |
|---|---|---|---|
| **纯同名**（无例外字段）| ✅ | — | — |
| **例外字段仅目标对象有**（如外键）| ✅ + 手写补例外字段 | — | — |
| **例外字段源/目标都有**（如脏数据源 DTO.level）| — | ✅ 排除例外字段 | 手写补例外字段 |
| **同名字段 ≤ 2** | — | — | ✅ 全部手写即可 |

#### 漏判的反模式（五个“看到例外就退出 copy”）

1. **「有派生字段 → 全手写」**——没回头数非派生同名字段
2. **「拷贝后覆盖」**代替 copyIgnore——可读性差 + 隐藏脏数据灬写
3. **「DTO.id 边为空 → 退出 copy」**——BeanCopy 会复制 null，MyBatis-Plus 插入时 id 为 null 自动走 IdType.AUTO，这不是问题
4. **「DTO 含业务字段 → 不信任何字段」**——DTO 含全部 6 个同名字段是常态，只有少量例外字段才需排除
5. **「字段名略不同 → 不敢用 BeanCopy」**——已补充字段名错位场景的解决方案（§15.4）

#### 关联规则

- SKILL.md §9（同名 BeanCopyUtils 规则）——措辞已强化为“混合场景首选 copyIgnore”
- `references/architecture-layers.md` §15.4——补充「例外字段在源对象里」子节 + 判定流程
- `references/code-review-checklist.md` §2 + §3——加了 BeanCopyUtils 检查项

---

## 补充：oboJava 自我迭代规则（V20260914 meta-check）

本 session 连续出现 3 次“oboJava 漏了 X → 修 → 再漏”循环（Component 日志 / PageResult 链路 / BeanCopyUtils copyIgnore）。为防重复发生，以后 oboJava **每次代码改动后必须自动检查 3 件事**：

1. **这个改法是不是某条 §X 的实例化？是的话 §X 措辞、worked example、检查项是不是都要补？**
2. **这个改法是不是 §X 未覆盖的新变体？是的话 §X 需不需要拆分出子节或加新案例？**
3. **`code-review-checklist.md` 是不是要加一条检查项？**——评审清单是防漏最后一道闸。

**默认动作**：新发现必须沉淀到 skill 源（SKILL.md / architecture-layers.md / code-review-checklist.md）。不再以“可选追加”处理。


### 12. DTO/VO/PO 链路全面遵循 oboJava 规范：OperatingScope 案例（V20260914）

> 来源：`OperatingScopeController` / `IOperatingScopeManageService` / `OperatingScopeManageServiceImpl` / `OperatingScopeServiceImpl` / `IOperatingScopeService` 配套的 DTO/VO/PO 全部过一遍 skill 规范（2026-09-14）。原文件 8 处违规（3 处 PO 泄漏 + 1 处自引用栈溢出 + 4 处规约细节）。

#### 违规清单（8 处）

| # | 文件 | 违规 | 规则引用 |
|---|---|---|---|
| 1 | `OperatingScopeController.listAllOperatingScope` | 返回 `List<OperatingScope>`（PO 泄漏）| §10 + §7 |
| 2 | `IOperatingScopeManageService.listAllOperatingScope` | 返回 `List<OperatingScope>`（PO 泄漏）| §7 |
| 3 | `OperatingScopeManageServiceImpl.listAllOperatingScope` | 返回 `List<OperatingScope>`（PO 泄漏）| §7 |
| 4 | `OperatingScopeTreeVO` | 裸 `@Data` + 自引用 `List<TreeVO> children` → toString/equals/hashCode 栈溢出 | §7 + 隐藏 bug |
| 5 | `OperatingScopeSaveDTO` | 无校验注解（`@NotBlank` / `@Min` / `@Size` + 中文 message）| §7 |
| 6 | `OperatingScopeController` 3 个 `@RequestBody` 方法 | 缺 `@Validated`（Bean Validation 不生效）| §7 |
| 7 | `OperatingScopePageDTO` / `OperatingScopeSaveDTO` / `OperatingScopeVO` / `OperatingScopeTreeVO` | 缺类 Javadoc | §0（应推广到 DTO/VO/PO）|
| 8 | `OperatingScopeVO.industryCategory` / `OperatingScope.industryCategory` | `@ApiModelProperty` 描述不一致（“字符串类型” vs “支持多选ID逗号分隔”）| §7 + §6 |

#### 1. PO 不能暴露在 Service 接口 / Manage 实现 / Controller 返回（3 处必须同步改）

**反面案例**（PO 底表字段泄漏到前端）：

```java
// Controller
public Result<List<OperatingScope>> listAllOperatingScope() {
    return Result.success(operatingScopeManageService.listAllOperatingScope());
}

// Manage Service 接口
List<OperatingScope> listAllOperatingScope();

// Manage Service 实现
@Override
public List<OperatingScope> listAllOperatingScope() {
    return operatingScopeService.listAllOperatingScope();
}
```

**为什么是硬违规**：
- 前端响应 JSON 会拿到 `deleted` / `create_user` / `update_user` / `create_time` / `update_time`（BaseEntity 字段）
- 软删状态泄漏（前端可能根据 `deleted` 猜业务规则）
- 接口契约与 PO 架构耦合——PO 加字段（`update_by` / 业务状态）直接污染前端

**修复**（三层同步改）：

```java
// 1. Service 接口
List<OperatingScopeVO> listAllOperatingScope();

// 2. Manage 实现（空集合走 §8 + 转换走 §9）
@Override
public List<OperatingScopeVO> listAllOperatingScope() {
    List<OperatingScope> list = operatingScopeService.listAllOperatingScope();
    if (CollectionUtils.isEmpty(list)) {
        return Collections.emptyList();
    }
    return BeanCopyUtils.copyList(list, OperatingScopeVO::new);
}

// 3. Controller
public Result<List<OperatingScopeVO>> listAllOperatingScope() {
    return Result.success(operatingScopeManageService.listAllOperatingScope());
}
```

#### 2. TreeVO 自引用 + @Data → StackOverflowError（隐藏 bug）

**反模式**：

```java
@Data
@ApiModel("经营范围树形VO")
public class OperatingScopeTreeVO {
    @ApiModelProperty("子节点")
    private List<OperatingScopeTreeVO> children;   // 自引用
}
```

**为什么会炸**：`@Data` = `@Getter + @Setter + @ToString + @EqualsAndHashCode + @RequiredArgsConstructor`。
`@ToString` 递归打印 children 列表里的每个子节点的 children 列表……一旦树超过 5 层就堆栈溢出。
`@EqualsAndHashCode` 同样递归。

**修复**（子节点排除递归）：

```java
@Data
@ToString(exclude = "children")
@EqualsAndHashCode(exclude = "children")
@ApiModel("经营范围树形VO")
public class OperatingScopeTreeVO {
    @ApiModelProperty("子节点")
    private List<OperatingScopeTreeVO> children;
}
```

**判定标准**：VO 含 `List<XxxVO>` 字段且 `XxxVO` 是同类型（本类 / 父类 / 常见递归类型）→ 必须 exclude 该字段。

#### 3. DTO 校验注解 + Controller @Validated

**SaveDTO 校验**：

```java
@Data
@ApiModel("经营范围保存DTO")
public class OperatingScopeSaveDTO {
    @NotBlank(message = "名称不能为空")
    @Size(max = 100, message = "名称长度不能超过100")
    private String name;

    @Min(value = 0, message = "排序不能小于0")
    private Integer sort;

    @Size(max = 500, message = "备注长度不能超过500")
    private String remark;
    ...
}
```

**Controller 开启校验**：

```java
// 原（不生效）
public Result<Boolean> addOperatingScope(@RequestBody OperatingScopeSaveDTO dto) { ... }

// 修（项目用 @Validated 不是 @Valid，参考 EmployeeController）
public Result<Boolean> addOperatingScope(@RequestBody @Validated OperatingScopeSaveDTO dto) { ... }
```

> 注：skill §7 原文写 `@Valid`，bi-cashier 实际用 Spring 的 `@Validated`（能启用方法级校验），两者效果对 `@RequestBody` 一致。

#### 4. 字段描述一致性（PO ↔ VO）

PO 写完整定义，VO 复制时**只可精简、不能加错**。

```java
// PO：包含完整业务描述
@ApiModelProperty("所属行业字典（支持多选ID逗号分隔）")

// VO：同样描述（不能简化为“字符串类型”——丢信息）
@ApiModelProperty("所属行业字典（支持多选ID逗号分隔）")
```

#### 5. 类 Javadoc（DTO/VO/PO 推广）

DTO/VO/PO 原本项目习惯不加类 Javadoc，但 §0 明确“**接口契约**”型需要 Javadoc。考虑 Controller / Service / Mapper / Component 实现都是“服务”类，而 DTO/VO/PO 是“**数据契约**”类，建议加：

```java
/**
 * 经营范围详情 VO。
 *
 * <p>对外暴露的经营范围完整信息，包含审计字段（创建/更新时间），但不包含
 * 持久层敏感字段（如 deleted / create_user / update_user）。</p>
 */
```

不强制（未加进 code-review-checklist），但 Controller 传参 / 跨服务 Feign 接收参数时类 Javadoc 能帮助理解。

#### 关联规则

- SKILL.md §7 + §10（PO 不可泄漏）
- `code-review-checklist.md` §7（加了 2 条新检查项）
- §11 BeanCopyUtils copyList 模式（本案例 `BeanCopyUtils.copyList(list, OperatingScopeVO::new)` 复用 §11 决策表）


### 13. DTO 边界跨端同步：后端 `@Validated` ↔ 前端 `FormRules`（V20260914）

> 来源：`OperatingScopeSaveDTO` 后端加了 `@Validated` 校验后，前端 `businessScope` 页面两处表单（`BusinessScopeModal.vue` 弹窗 + `index.vue` 内联编辑）未同步对齐，发现 5 处不一致（V20260914）。

#### 违规清单（5 处）

| # | 位置 | 前端原值 | 后端边界 | 问题 |
|---|---|---|---|---|
| 1 | `BusinessScopeModal.vue` formRules | `max: 50`（name）| `@Size(max=100)` | 前端过严，用户输 60 字符会被前端拒，后端其实允许 |
| 2 | `BusinessScopeModal.vue` formItems | `maxlength: 50`（name）| `@Size(max=100)` | 同上，浏览器原生限制错 |
| 3 | `BusinessScopeModal.vue` formItems | `maxlength: 200`（description）| `@Size(max=500)`（remark）| 前端过严 |
| 4 | `BusinessScopeModal.vue` formItems | 无 maxlength（businessScope）| `@Size(max=1000)` | **完全未限制**，可粘贴任意长文本 |
| 5 | `index.vue` scopeText | 无 maxlength | `@Size(max=1000)` | 同上 |

外加两处 `formRules` 逻辑重复：弹窗 + 内联编辑各自定义 `name` 规则（完全相同的 2 条），后端改边界后两处都会源。

#### 为什么必须跨端同步

1. **后端边界是“最大允许”，前端必须≥后端边界**：`@Size(max=100)` 表示后端允许 0-100 字符，前端 `maxlength: 50` 是人为过严，用户输 80 字符前端拒、后端放行——体验不一致
2. **前端 maxlength 是“输入限位”、rule 是“提交校验”**：两者必须与后端对齐才能在“输入”与“提交”两个节点都报中文 message
3. **DTO 在前端多个表单复用**（弹窗 / 内联编辑 / Drawer / 查询表单），重复定义规则会漂移，必须抽公共文件

#### 正确做法：共享 `utils/validation.ts`

**`pages/businessScope/utils/validation.ts`**（新文件，与后端 DTO 边界常量一一对齐）：

```ts
import type { FormRules } from "element-plus"

// 后端 OperatingScopeSaveDTO 常量
export const BUSINESS_SCOPE_NAME_MAX = 100          // @Size(max=100)
export const BUSINESS_SCOPE_REMARK_MAX = 500         // @Size(max=500)
export const BUSINESS_SCOPE_DESCRIPTION_MAX = 1000   // @Size(max=1000)

export const businessScopeFormRules: FormRules = {
  name: [
    { required: true, message: "请输入名称", trigger: "change" },
    { max: BUSINESS_SCOPE_NAME_MAX, message: `名称不能超过 ${BUSINESS_SCOPE_NAME_MAX} 个字符`, trigger: "change" }
  ],
  description: [
    { max: BUSINESS_SCOPE_REMARK_MAX, message: `备注不能超过 ${BUSINESS_SCOPE_REMARK_MAX} 个字符`, trigger: "change" }
  ],
  businessScope: [
    { max: BUSINESS_SCOPE_DESCRIPTION_MAX, message: `经营范围描述不能超过 ${BUSINESS_SCOPE_DESCRIPTION_MAX} 个字符`, trigger: "change" }
  ]
}
```

**两处表单复用**：

```vue
<!-- BusinessScopeModal.vue -->
<script setup>
import { businessScopeFormRules, BUSINESS_SCOPE_NAME_MAX, ... } from "../utils/validation"
const formRules = businessScopeFormRules
const formItems = [
  { prop: "name", maxlength: BUSINESS_SCOPE_NAME_MAX, ... },
  { prop: "description", maxlength: BUSINESS_SCOPE_REMARK_MAX, ... },
  ...
]
</script>
```

```vue
<!-- index.vue -->
<script setup>
import { businessScopeFormRules, BUSINESS_SCOPE_NAME_MAX, ... } from "./utils/validation"
const editRules: FormRules = businessScopeFormRules
</script>

<template>
  <el-input v-model="editForm.name" :maxlength="BUSINESS_SCOPE_NAME_MAX" />
  <el-input v-model="editForm.description" :maxlength="BUSINESS_SCOPE_REMARK_MAX" />
  <el-input v-model="scopeText" :maxlength="BUSINESS_SCOPE_DESCRIPTION_MAX" />
</template>
```

#### 字段名错位（前端字段名 ≠ 后端 DTO 字段名）

`OperatingScopeSaveDTO` 后端用 `remark` / `businessScopeDescription`，前端习惯用 `description` / `businessScope`。校验文件里加注释明确映射，防止后人修改时改错。

#### `@NotBlank` vs `required: true` 语义差异（隐藏 gap）

后端 `@NotBlank` 拒绝三种值：`null` / 空字符串 `""` / **纯空白 `"   "`**。
Element Plus `required: true` 只拒绝 `null` / `undefined` / 空字符串，**纯空白字符串会通过**。

后果：用户输入 `"   "`（3 个空格）→ 前端提交校验通过 → 后端抛 `@NotBlank` 失败 → 用户看到大白话“名称不能为空”，但前端已经让 submit 走了一步，体验割裂且调用栈难追。

**修复**：抽 `requiredNotBlank` validator 工厂代替 `required: true`：

```ts
// utils/validation.ts
export function requiredNotBlank(message: string, trigger: FormItemRule["trigger"] = "change"): FormItemRule {
  return {
    required: true,
    validator: (_rule, value, callback) => {
      if (value === null || value === undefined || String(value).trim().length === 0) {
        callback(new Error(message))
      } else {
        callback()
      }
    },
    trigger
  }
}

// 使用
export const businessScopeFormRules: FormRules = {
  name: [
    requiredNotBlank("请输入名称"),   // ❌ { required: true, ... } 接受纯空白
    { max: BUSINESS_SCOPE_NAME_MAX, message: `名称不能超过 ${BUSINESS_SCOPE_NAME_MAX} 个字符`, trigger: "change" }
  ]
}
```

**检测脚本**（扫前端是否还有纯 `required: true` 用法）：

```bash
grep -rEn "\\{\\s*required:\\s*true" --include="*.vue" --include="*.ts" packages/
```

每条命中的 `required: true` 都需检查：后端该字段是否用 `@NotBlank`，是 → 改 `requiredNotBlank`；后端用 `@NotNull`（接受空串）→ 保留 `required: true`。

#### 交付检查表（5 条 checklist）

后端加 `@Validated` 后同步前端时逐条检查：

1. **边界值是否相同**：后端 `@Size(max=100)` → 前端 `max: 100`（不能 50 也不能 200）
2. **是否加到所有表单项**：同一 DTO 的弹窗 / 内联编辑 / Drawer 都要同步，不能漏
3. **是否加 `maxlength` 属性**：`maxlength` 是浏览器原生限制、`rules` 是提交前校验，两者都要
4. **是否抽公共文件**：两份以上表单必须共享 `FormRules`
5. **字段名映射是否清晰**：前端字段名 ≠ 后端字段名时必须在 validation.ts 里加注释
6. **语义是否对齐**：后端 `@NotBlank` 不能用 Element Plus 的 `required: true` 代替（`required` 接受纯空白）；必须用 `requiredNotBlank` validator 工厂

#### 关联规则

- SKILL.md §7 DTO/VO 评审 + `code-review-checklist.md` §7（加了「DTO 边界跨端同步」检查项）
- 后端 `@Validated` 启用见本 skill §7 校验注解条目 + `code-review-checklist.md` §1 Controller 评审（`@Validated`）
- §12 OperatingScope DTO/VO/PO 案例——本案例是 §12 补位案例，原 §12 仅改后端、未追前端


### 14. Component 层契约信任：DTO 默认值 + Mapper contract 不再防御（V20260914）

> 来源：`OperatingScopeServiceImpl.pageOperatingScope` 在 DTO 已有默认值 + `@Min` 校验 + PageHelper contract 保障的情况下，重复做 `dto.getPageNum() == null ? 1 : Math.max(1, ...)` 与 `records == null ? Collections.emptyList() : records` 防御，违反"信任契约"原则（V20260914）。

#### 反面案例（OperatingScopeServiceImpl.pageOperatingScope 原状）

```java
@Override
public PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto) {
    // PageHelper.startPage(...) 自动完成 count + 追加 LIMIT；SQL 本身不带 LIMIT，
    // 不走 MyBatis-Plus 分页拦截器，避免 JSqlParser 4.x 触发的 AST toString 自递归 StackOverflowError。
    int pageNum = dto.getPageNum() == null ? 1 : Math.max(1, dto.getPageNum());
    int pageSize = dto.getPageSize() == null ? 10 : Math.max(1, dto.getPageSize());
    PageHelper.startPage(pageNum, pageSize);
    List<OperatingScopePageVO> records = baseMapper.pageOperatingScope(dto);
    long total = ((Page<OperatingScopePageVO>) records).getTotal();
    return new PageResult<>(total, records == null ? Collections.emptyList() : records);
}
```

#### 三处冗余

| # | 冗余代码 | 为什么冗余 |
|---|---|---|
| 1 | `dto.getPageNum() == null ? 1 : ...` | DTO 字段已有 `private Integer pageNum = 1;` 默认值；`@Min(1)` 在 Controller `@Validated` 阶段已拒绝 `< 1`；DTO + `@Validated` 是契约层，Component 不再二次兜底 |
| 2 | `Math.max(1, dto.getPageNum())` | 同上：`@Min(1)` 保证 `pageNum >= 1`；Component 层不需要夹一道 |
| 3 | `records == null ? Collections.emptyList() : records` | PageHelper contract：`startPage` 后下一次查询结果必为 `com.github.pagehelper.Page<T>`（继承 `ArrayList`），**绝不为 null**；该分支是死代码 |

#### 判定为反模式的 3 个特征

1. **Component 层职责越界**：Component 是数据访问层，入参校验归 Controller + DTO（`@Validated`）；Component 重复校验 = 把 Controller 的活重做一遍，且**校验时机已晚**（应该在校验注解失败时抛大白话，Component 层抛则是底层异常翻译）
2. **代码膨胀但实质信息量=0**：5 行防御代码全部命中契约层已经覆盖的场景，没有任何新增保护
3. **违反"信任契约"原则**：DTO 字段默认值 + Bean Validation 是项目标准入参防御；PageHelper / MyBatis-Plus / MP BaseMapper 各自有明确的 contract，Component 层必须信任，否则每层都做"防御性兜底"，最终谁也不信谁，Diff 噪音爆炸

#### 正面做法（OperatingScopeServiceImpl.pageOperatingScope 修复后）

```java
@Override
public PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto) {
    // PageHelper.startPage(...) 自动完成 count + 追加 LIMIT；SQL 本身不带 LIMIT，
    // 不走 MyBatis-Plus 分页拦截器，避免 JSqlParser 4.x 触发的 AST toString 自递归 StackOverflowError。
    // DTO 默认值 (pageNum=1, pageSize=10) + @Min(1) 校验已覆盖边界；PageHelper contract 保证 records 非 null。
    PageHelper.startPage(dto.getPageNum(), dto.getPageSize());
    List<OperatingScopePageVO> records = baseMapper.pageOperatingScope(dto);
    long total = ((Page<OperatingScopePageVO>) records).getTotal();
    return new PageResult<>(total, records);
}
```

5 行变 4 行（注释变 1 行），实际可执行代码从 7 行缩到 4 行，零信息丢失。

#### 五类典型反模式扫描清单

| 反模式 | 出现位置 | 为什么错 |
|---|---|---|
| `dto.getXxx() == null ? defaultVal : ...`（DTO 字段已有 `= defaultVal`）| Component / Service 任何入参处理 | DTO 默认值兜底 |
| `Math.max(MIN, dto.getXxx())` / `Math.min(MAX, dto.getXxx())`（DTO 已有 `@Min` / `@Max`）| 同上 | `@Validated` 兜底 |
| `records == null ? Collections.emptyList() : records`（PageHelper / MP `page()` 后）| Component 分页方法 | PageHelper contract 保障非 null |
| `if (list == null) list = new ArrayList<>();`（MP `lambdaQuery().list()` 后）| 同上 | MP `list()` 返空 `ArrayList`，不返 null |
| `if (count == null) count = 0L;`（PageHelper / MP `count()` / `total` 后）| 同上 | PageHelper `getTotal()` 返 `long`（基本类型）不返 null |

**审查硬指标**：
```bash
# 扫"DTO 字段已有默认值但 Component 层又兜底"的反例
grep -rEn "dto\.get\w+\(\)\s*==\s*null\s*\?" bi-cashier-{component,service}/src/main/java/

# 扫"PageHelper 后置调用还做 null 兜底"的反例
grep -rEn "(records|list|result)\s*==\s*null\s*\?" bi-cashier-{component,service}/src/main/java/

# 扫"MP lambdaQuery().list() 后又空集合兜底"的反例（合规代码直接用结果即可，§8 要求空集合走 Collections.emptyList()，但前提是判断 list 本身）
grep -rEn "list\s*==\s*null\s*\?\s*Collections\.emptyList\(\)" bi-cashier-{component,service}/src/main/java/
```

#### 关联规则

- SKILL.md §7（API 入参对象化）+ §8（Service / Helper 入参对象化）—— DTO 是契约层，Component 不重复校验
- `mybatis-vs-xml.md §1` 决策表 — PageHelper 模式详见 §1
- SKILL.md §9（分页 PageResult 泛型链路对齐）— 本案例是该规则在 Component 层的补位案例
- `code-review-checklist.md §3` Component Service 评审 — 本案例加了「Component 不重检 DTO 默认值与校验注解」检查项


### 15. PO 继承 BaseEntity 时，deleted 字段由 `@TableLogic` 自动处理（V20260914 新增）

> 来源：`OperatingScopeServiceImpl` 重构（2026-09-14）。原文件 4 处 `.eq(OperatingScope::getDeleted, 0)` + 1 处 `if (scope.getDeleted() == 1)` 死代码，全部删除。BaseEntity 已配 `@TableLogic(value="0", delval="1")`，MP 自动追加 `WHERE deleted = 0` 与 `UPDATE ... SET deleted = 1`。

#### 反面案例（5 处冗余 / 死代码）

```java
// ❌ 1. lambdaQuery 显式 .eq(getDeleted, 0)
List<OperatingScope> list = this.lambdaQuery()
        .eq(OperatingScope::getDeleted, 0)            // 冗余：MP 自动加 WHERE deleted = 0
        .orderByAsc(OperatingScope::getLevel)
        .list();

// ❌ 2. selectById 后判 getDeleted==1
OperatingScope scope = baseMapper.selectById(id);
if (scope == null || scope.getDeleted() == 1) {       // 死代码：selectById 已自动过滤
    return null;
}

// ❌ 3. 业务键软删除手写 lambdaUpdate().set(getDeleted, 1)（必须走 remove）
this.lambdaUpdate()
        .set(OperatingScope::getDeleted, 1)
        .eq(OperatingScope::getUniqueValue, uniqueValue)
        .update();                                    // 走 remove 即可，MP 自动 .set(deleted, 1)

// ❌ 4. 主键软删除手写 lambdaUpdate（必须走 removeById / deleteById）
this.lambdaUpdate()
        .set(OperatingScope::getDeleted, 1)
        .eq(OperatingScope::getId, id)
        .update();                                    // 走 removeById 即可

// ❌ 5. deleteById 后跟 lambdaUpdate().set(getDeleted, 1)（重复声明）
baseMapper.deleteById(id);
this.lambdaUpdate().set(OperatingScope::getDeleted, 1)
        .eq(OperatingScope::getId, id).update();
```

#### @TableLogic 自动行为一览（重要：项目里**不存在**需要显式 `set(getDeleted, 1)` 的场景）

| MP 调用 | @TableLogic 自动行为 | 是否需额外写 `.set(getDeleted, 1)` |
|---|---|---|
| `baseMapper.selectById(id)` | 追加 `WHERE deleted = 0`，不返软删记录 | ❌ |
| `lambdaQuery().list() / .one() / .page()` | 同上 | ❌ |
| `baseMapper.selectList(wrapper)` | 同上 | ❌ |
| XML `<select>` | ❌ 不自动加，需手写 `WHERE deleted = 0` | — |
| **`baseMapper.deleteById(id)`** | **转 `UPDATE ... SET deleted = 1 WHERE id = ?`** | ❌ 一律走这条 |
| **`this.removeById(id)`** | 同上 | ❌ 一律走这条 |
| **`this.remove(wrapper)`（含业务键）** | **转 `UPDATE ... SET deleted = 1 WHERE <wrapper conditions>`** | ❌ 一律走这条 |
| `this.lambdaUpdate().eq(业务键).update()` | ❌ 这是普通 UPDATE，MP 不加 deleted 条件 | **❌ 一律禁止走 lambdaUpdate 软删** |
| XML `<update>` | ❌ 不自动加，需手写 `SET deleted = 1` | — |

#### ⚠️ MP Lambda vs XML 手动 SQL：两条规则**方向相反**，极容易误删（V20260915 红线）

上表 MP 调用和 XML 调用对 `deleted = 0` 的处理**完全相反**——MP 自动加（手写就是冗余），XML 不自动加（手写是必需）。下面这条提示仅作为警示加粗，避免 agent / 评审时一刀切删除全部 `deleted = 0`：

> **XML 手写 SQL 中的 `WHERE deleted = 0` 是必需的，不是死代码。** 只有 MP Lambda 链式调用（`lambdaQuery` / `lambdaUpdate` / `baseMapper.xxx`）自动加，XML `<select>` / `<update>` 不走 MP 拦截器，必须**保留手写条件**。

**误删后果**：XML 查询返回软删记录 → 前端拿到已删除数据；XML 删除变硬删 → 软删机制失效。

**审查硬指标**（提交前必跑）：

```bash
# 1. 扫 Mapper XML 里是否还有 WHERE deleted = 0（不应被删）
grep -rEn "WHERE deleted = 0" bi-cashier-web/src/main/resources/mapper/ --include="*.xml"
# 预期：所有有软删表的 XML 文件均命中

# 2. 扫 Component 层 Service 是否还残留冗余 .eq(getDeleted, 0)（应清空）
grep -rEn "\.eq\([A-Za-z]+::getDeleted,\s*0\)" bi-cashier-component/src/main/java/ --include="*.java"
# 预期：0 命中

# 3. 扫 Component 层 Service 是否还残留 lambdaUpdate().set(getDeleted, 1)（应清空）
grep -rEn "lambdaUpdate\(\)\s*$" bi-cashier-component/src/main/java/ -A 3 --include="*.java" \
  | grep -E "\.set\([^,]+::getDeleted,\s*1\)"
# 预期：0 命中

# 4. 扫 Manage 层 Service 是否直接写 .set(getDeleted, 1)（应清空）
grep -rEn "set\([A-Za-z]+::getDeleted,\s*1\)" bi-cashier-service/src/main/java/ --include="*.java"
# 预期：0 命中
```

**判定标准**：

| 文件类型 | `WHERE deleted = 0` | `.eq(getDeleted, 0)` | `.set(getDeleted, 1)` |
|---|---|---|---|
| Mapper XML `<select>` | **必须保留**（手写条件） | N/A | N/A |
| Mapper XML `<update>` 软删 | **必须保留 `SET deleted = 1`**（手写条件） | N/A | N/A |
| Component Service Lambda | **禁止写**（MP 自动加） | **禁止写** | **禁止写**，一律 `delete*` / `remove*` |
| Component Service `baseMapper.deleteById(id)` | N/A | N/A | MP 自动转，**禁止手写** |
| Manage Service | N/A | **禁止**（应当调 Component 软删） | **禁止** |
| SQL 归档脚本 / 手动执行 | 按业务决定（推荐保留） | N/A | N/A |

#### 正确做法（OperatingScopeServiceImpl 修复后）

```java
@Override
public List<OperatingScope> queryOperatingScopeTree() {
    // 无 .eq(getDeleted, 0)——MP 自动加
    List<OperatingScope> list = this.lambdaQuery()
            .orderByAsc(OperatingScope::getLevel)
            .orderByAsc(OperatingScope::getSort)
            .orderByDesc(OperatingScope::getId)
            .list();
    return list == null ? Collections.emptyList() : list;
}

@Override
public OperatingScopePageVO queryOperatingScopeById(Long id) {
    // 无 .getDeleted() == 1 判断——selectById 已自动过滤
    OperatingScope scope = baseMapper.selectById(id);
    if (scope == null) {
        log.debug("经营范围详情查询未命中 id={}", id);
        return null;
    }
    OperatingScopePageVO vo = new OperatingScopePageVO();
    BeanUtils.copyProperties(scope, vo);
    return vo;
}

@Override
public Boolean deleteOperatingScope(Long id) {
    // deleteById 已被 MP 自动转 UPDATE ... SET deleted = 1
    boolean ok = baseMapper.deleteById(id) > 0;
    if (!ok) {
        log.warn("经营范围删除未生效 id={}", id);
    }
    return ok;
}
```

#### 业务键软删除一律走 `remove`（项目规范）

**禁止** `lambdaUpdate().set(Xxx::getDeleted, 1).eq(业务键).update()` 模式。项目里任何软删除都走 `delete*` / `remove*`，MP 自动加 `.set(deleted, 1)`。

```java
// ✅ 按业务键软删除
return this.remove(
        this.lambdaQuery().eq(Xxx::getUniqueValue, uniqueValue)
);

// ✅ 多条件软删除
return this.remove(
        this.lambdaQuery()
                .eq(Xxx::getAccountNumber, accountNumber)
                .eq(Xxx::getBankCode, bankCode)
);
```

#### 类 extends ServiceImpl 写法规范

```java
// ❌ 全限定类名写在 extends 后（拼写错误多、IDE 跳转失效）
public class OperatingScopeServiceImpl
        extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService { ... }

// ✅ 必须 import ServiceImpl，extends 用短名
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;

public class OperatingScopeServiceImpl
        extends ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService { ... }
```

**例外**：与本模块某个业务类同名（如自定义 `XxxServiceImpl` 在 `com.obo.bi.cashier.service.impl` 内已有同名类，**完全限定名**避免歧义）。其它场景一律 import。

#### 判定为反模式的 5 个特征

1. **`lambdaQuery().list() / .one()` 后多余 `.eq(getDeleted, 0)`**——MP 自动加，重复声明
2. **`selectById(...)` 后多余 `if (po.getDeleted() == 1)`**——selectById 已过滤软删，分支永远不进
3. **任何 `lambdaUpdate().set(Xxx::getDeleted, 1).update()`**（主键/业务键/多条件都不行）——一律走 `remove*` / `delete*`
4. **`deleteById(...)` 后跟 `lambdaUpdate().set(getDeleted, 1)`**——MP 自动转软删，重复声明
5. **`extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl` 全限定名**——必须 import 后用短名

#### 审查硬指标

```bash
# 1) 扫"lambdaQuery 显式 .eq(getDeleted, 0)"
grep -rEn "::getDeleted\s*,\s*0\)" bi-cashier-{component,service}/src/main/java/

# 2) 扫"selectById 后多余判 getDeleted==1"
grep -rEn "\.getDeleted\(\)\s*==\s*1" bi-cashier-{component,service}/src/main/java/

# 3) 扫"任何 lambdaUpdate().set(getDeleted, 1) 反例（一律禁止）"
grep -rEnA1 "lambdaUpdate\(\)" bi-cashier-{component,service}/src/main/java/ \
  | grep -E "set\(.*::getDeleted\s*,\s*1\)"

# 4) 扫"extends 全限定 ServiceImpl"
grep -rEn "extends\s+com\.baomidou\.mybatisplus\.extension\.service\.impl\.ServiceImpl" \
  bi-cashier-{component,service}/src/main/java/
```

#### 关联规则

- SKILL.md §10（Component 层日志）— 本案例是该规则与 MP 自动行为交叉后的修订版
- `references/data-model-sql.md §1.2` 软删除约定 — 已同步改为「全部走 delete* / remove*，MP 自动 .set(deleted, 1)」
- `references/mybatis-vs-xml.md §2.1` 新增章节 — 列出 5 类反例与扫描命令
- `references/architecture-layers.md §3.3 + §4` — 删 `.eq(getDeleted, 0)`，改 `extends` 为 import
- `references/code-structure.md §9.3` — 重写为 remove 模式
- `references/code-review-checklist.md §3` — Component Service 评审新增检查项


### 16. VO 按业务视图命名（Page / List / Detail 各自独立），不复用同类型（V20260914）

> 来源：`OperatingScopeServiceImpl.queryOperatingScopeById` 与 `OperatingScopeManageServiceImpl.listAllOperatingScope` 在上轮「OperatingScopeVO 重命名为 OperatingScopePageVO」后继续复用 `OperatingScopePageVO`，造成"分页 VO 被详情/列表场景借用"的语义错位（V20260914）。

#### 判定为反模式的 4 个特征

1. **类名后缀与返回场景语义不符**：方法名是 `queryXxxById` / `listAllXxx` 但返回 `XxxPageVO` — 读者看到类型签名就要在心里做一次"为什么 Page 的类名用在详情/列表上"的翻译，CodeGraph 跳转、`List<OperatingScopeVO>` 索引导航全部失效
2. **前端 Swagger 模型错位**：`@ApiModel("经营范围VO")` + 类名 `OperatingScopePageVO` 同时出现，前端 codegen 生成的 TS 类型名带 "Page" 后缀，但实际接口是详情/列表 — 类型名误导前端
3. **未来字段集漂移埋雷**：当前三个 VO 字段一致只是历史巧合；Detail 未来可能加 `parentName` / List 可能砍 `industryCategory` 时，复用同类型会让一处改动污染全部端点
4. **违反 `code-review-checklist.md §7` 命名约定**：清单明列 `XxxVO` / `XxxListVO` / `XxxDetailVO` / `XxxPageVO` 作为合法后缀，强制按视图选其一，不允许"通用 VO" 跨多端点复用

#### 反面案例（OperatingScope 上轮重构后状态）

```java
// Service 接口——三个方法共用一个 VO 类型
PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto);     // ✅ 语义正确
OperatingScopePageVO queryOperatingScopeById(Long id);                                // ❌ 详情借用了分页 VO
List<OperatingScopePageVO> listAllOperatingScope();                                   // ❌ 列表借用了分页 VO

// Controller——同样是 PageVO
public Result<PageResult<OperatingScopePageVO>> pageOperatingScope(...) { ... }
public Result<OperatingScopePageVO> queryOperatingScopeById(...) { ... }              // ❌
public Result<List<OperatingScopePageVO>> listAllOperatingScope() { ... }             // ❌
```

类 Javadoc 里写"虽然类名带 Page 后缀，但所有方法共用此类型"——本身就是反模式自白。

#### 正面做法（OperatingScope 修复后）

按 `code-review-checklist.md §7` 命名约定，每个业务视图独立 VO：

```java
// bi-cashier-api/vo/OperatingScopePageVO.java
@ApiModel("经营范围分页VO")
public class OperatingScopePageVO { ... }

// bi-cashier-api/vo/OperatingScopeListVO.java
@ApiModel("经营范围列表VO")
public class OperatingScopeListVO { ... }

// bi-cashier-api/vo/OperatingScopeDetailVO.java
@ApiModel("经营范围详情VO")
public class OperatingScopeDetailVO { ... }
```

调用链与类型一一对齐：

```java
// IOper / ServiceImpl
PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto);
OperatingScopeDetailVO queryOperatingScopeById(Long id);
List<OperatingScope> listAllOperatingScope();                       // Component 层返 PO（§12 原则）

// IManage / ManageImpl
PageResult<OperatingScopePageVO> pageOperatingScope(...);
OperatingScopeDetailVO queryOperatingScopeById(...);
List<OperatingScopeListVO> listAllOperatingScope();                  // Manage 层 copyList 转 VO

// Controller
public Result<PageResult<OperatingScopePageVO>> pageOperatingScope(...) { ... }
public Result<OperatingScopeDetailVO> queryOperatingScopeById(...) { ... }
public Result<List<OperatingScopeListVO>> listAllOperatingScope() { ... }
```

#### 同款约定的项目内先例（参照组）

| 模块 | Page | List | Detail |
|---|---|---|---|
| Store | `StorePageVO` | `StoreListVO` | `StoreDetailVO` |
| BankCard | — | `BankCardListVO` | `BankCardVO` |
| FileExpiryRecord | — | `FileExpiryRecordListVO` | `FileExpiryRecordDetailVO` |
| FileExpiryRule | — | `FileExpiryRuleListVO` | `FileExpiryRuleVO`（基础）|
| Seal | — | `SealListVO` | `SealVO`（基础）|
| CashierRelatedUser | — | — | `CashierRelatedUserDetailVO` |
| Company | — | — | `CompanyDetailVO` |
| OperatingScope（本案例）| `OperatingScopePageVO` | `OperatingScopeListVO` | `OperatingScopeDetailVO` |

**反例模式**（一个 VO 跨场景复用）：项目内历史 `OperatingScopeVO` / `CashierRelatedUserVO` / `BankCardVO` / `FileExpiryRuleVO` 等"通用 VO"在多端点复用时也属本案例反模式范围；本案例仅先行整改 OperatingScope，其他模块是否需要拆分视业务发展而定（如 `BankCardVO` 是否需要分 `BankCardListVO` + `BankCardDetailVO`，按未来字段集漂移判断，不预先拆）。

#### 字段暂时一致的可行做法

未来 Detail 字段多于 List/Page 时（如 Detail 携带父节点详情、附件列表），三个 VO 字段集会自然分化；当前阶段字段一致**允许直接复制字段**（同 StorePageVO 与 StoreListVO 的处理），**不通过继承复用**（继承会让 Swagger codegen 生成"父类字段全在子类"的多余字段、且 BaseVO 修改会污染全部子类）。

```java
// ✅ 字段一致时直接复制（不抽 BaseVO 抽象）
// OperatingScopePageVO.java
private Long id;
private String name;
...

// OperatingScopeListVO.java
private Long id;
private String name;
...

// OperatingScopeDetailVO.java
private Long id;
private String name;
...

// ❌ 不要抽 BaseOperatingScopeVO（继承会让 Swagger codegen 在子类生成父类字段、且未来修改父类污染全部）
public abstract class BaseOperatingScopeVO {
    protected Long id;
    protected String name;
}
public class OperatingScopePageVO extends BaseOperatingScopeVO { ... }
```

#### 关联规则

- `code-review-checklist.md §7` 命名约定：`XxxDTO` / `XxxPageDTO` / `XxxSaveRequestDTO` / `XxxVO` / `XxxListVO` / `XxxDetailVO` / `XxxPageVO` — 本案例强化为「禁止跨场景复用同类型 VO」
- SKILL.md §12 — PO 不可泄漏，与本案例组合形成"PO → PageVO/ListVO/DetailVO"三方独立映射
- SKILL.md §0 接口注释规范 — VO 类自身应有 Javadoc 说明归属视图（哪个端点用、为什么不暴露 X 字段）


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

