# layer-rules — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

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
