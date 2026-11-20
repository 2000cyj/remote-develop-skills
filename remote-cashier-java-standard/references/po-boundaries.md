# po-boundaries — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

4.7. **PO 边界强约束（XML / 继承 / MP 泛型 三件套，强约束）**：
   本节连同「XML 返回类型 / PO 继承 / MP 泛型」三个文件典型错误一起声明，一遍免走回头路：
   - **硬约束 1：XML 自定义 SQL 返回类型严禁用 PO，必须用 VO / DTO / 其他业务类型**。
     - 仅 `<select resultType="com.obo.bi.cashier.vo.XxxVO">` 或 `<select resultType="com.obo.bi.cashier.dto.XxxDTO">` 可接受；
     - 严禁 `<resultMap type="com.obo.bi.cashier.po.Xxx">` 出现在业务查询的 XML 中（MP `BaseMapper` 的泛型是另一回事，详见硬约束 3）；
     - **XML 文件本身严禁写任何注释**：`<!-- ... -->` / Javadoc 风格块一律删除。Mapper XML 是“表 ↔ Java 类型的纯映射”，字段名 / 类型映射在 Mapper Java 接口 / Java 类上注释；XML 保留纯 SQL + resultType，其他什么都不加。
     - 换言之：反例 DTO/VO 透出 BaseEntity 的 `id / createUser / updateUser / createTime / updateTime / deleted` / `tenantId`——用 VO 接收 SQL 是防止该透出的唯一手段。
   - **硬约束 2：PO 只能被 MyBatis-Plus 特性操作**。即只在以下场景出现 PO：
     - MP `BaseMapper<T>` 泛型位置（不可避，是 MP 框架约束）
     - MP CRUD 调用：`save / saveBatch / updateById / removeById / getById / selectById / selectList / selectCount / selectPage / lambdaQuery / lambdaUpdate / remove` / `this.remove(this.lambdaQuery().eq(...))` 等
     - Service 接口 / Impl 返回值、Controller / Manage 响应——**严禁出现 PO**。
   - **硬约束 3：PO 严禁被继承**。VO / DTO / Req / Resp / Form / 任何其他业务类**严禁 `extends XxxPO`**。
     - 常见诱因："懒得写字段"——`XxxVO extends XxxPO` 会**全部继承** BaseEntity 7 个字段（`id / createUser / updateUser / createTime / updateTime / deleted / tenantId`）到 VO 上，以「顺便继承个业务主键」名义带到 API 响应。
     - 后果：①PO 修改、BaseEntity 增字段，API 响应隐式随之变（跨业务调用方隐藏依赖）；②API 响应携带 `deleted` / `createTime` 等内部字段，前端可看到实体状态；③一个 PO 同时被 DTO / VO 引用，DTO 内部重构会牵连到 API 响应。
     - 正确做法：VO/DTO 手写字段 / `@Data` Lombok 生成；同名字段 ≥ 3 条用 `BeanCopyUtils.copy(src, XxxVO::new)`（见 §9）；不同名字段手动 `setX` 补。
   - **理由**：
     1. **表与 API 是两个层**。PO 是「表的可读内存表示」，是 XML 映射的目标，**不是**前端 / 调用方能理解的“业务对象”。两者边界必须明确，XML 中用 PO 接收会糊中间。
     2. **BaseEntity 字段隐式传播**。PO 继承 BaseEntity 后携带 `id / createUser / updateUser / createTime / updateTime / deleted / tenantId` 7 个字段，其中 `deleted` / `tenantId` 属软删与多租户，不应该出现在 API 响应中。
     3. **MP 泛型位置是框架约束，不是代码风格**。`BaseMapper<XxxPO>` / `ServiceImpl<XxxMapper, XxxPO>` / `IService<XxxPO>` 这些泛型位置**不能**填 VO——MP 靠 PO 上的 `@TableField` 反射拼 SQL，这是不可避的。
     4. **「顺手继承」是「隐性耦合」**。`XxxVO extends XxxPO` 表面看起来「代码更少」，实际上是「API 契约隐式依赖数据库字段」，重构数据库的同时重构了 API。后人看到 VO 会以为是个完整 DTO，实际上是披着 VO 外衣的 PO。
   - **审查硬指标**（写完 XML + Service + VO 必跑）：
     ```bash
     # 1. 自定义 SQL 的 resultType / resultMap 不允许指向 po.*
     grep -rEn 'resultType="com\.obo\.bi\.cashier\.po\.|<resultMap[^>]*type="com\.obo\.bi\.cashier\.po\.' bi-cashier-web/src/main/resources/mapper/*.xml
     # 命中 → 违规
     # 2. 扫所有 VO / DTO 是否 extends PO
     grep -rEn '^public class Xxx(VO|DTO|Req|Resp|Form).* extends ' bi-cashier-api/src/main/java/com/obo/bi/cashier/ bi-cashier-service/src/main/java/com/obo/bi/cashier/
     # 命中且 extends 后接的是 PO（包路径含 .po.）→ 违规
     # 3. 扫 Service / Impl / Controller 响应中是否透出 PO
     grep -rEn 'Result<.*StoreEntryPlatform\b|return [a-zA-Z]+PO\b' bi-cashier-{component,service,web}/src/main/java/com/obo/bi/cashier/
     # 命中且返回的是 PO（包路径含 .po.）→ 违规
     # 4. 扫是否有人在 DTO/VO 上 .setDeleted / .setCreateTime / .setUpdateUser 等 PO 持久化字段
     grep -rEn '\.set(CreateUser|UpdateUser|CreateTime|UpdateTime|Deleted|TenantId)\(' bi-cashier-{api,service,web}/src/main/java/com/obo/bi/cashier/
     # 命中 → 违规
     ```
   - **正例**：
     ```xml
     <!-- ✅ XML 自定义 SQL 用 VO 接收，文件本身无任何注释 -->
     <select id="pageStoreEntryPlatform" resultType="com.obo.bi.cashier.vo.StoreEntryPlatformListVO">
         SELECT platform_name AS platformName, platform_code AS platformCode, ...
         FROM cashier_store_entry_platform
         WHERE deleted = 0
     </select>

     <select id="selectByPlatformCode" resultType="com.obo.bi.cashier.vo.StoreEntryPlatformListVO">
         SELECT platform_name AS platformName, platform_code AS platformCode, ...
         FROM cashier_store_entry_platform
         WHERE platform_code = #{platformCode} AND deleted = 0
     </select>
     ```
     ```java
     // ✅ PO 仅出现在 MP 框架约束位置
     public interface XxxMapper extends BaseMapper<XxxPO> { ... }                  // MP 泛型，不可避

     @Service
     public class XxxServiceImpl extends ServiceImpl<XxxMapper, XxxPO>            // MP 泛型，不可避
             implements IXxxService { ... }

     // ✅ VO / DTO 手写字段，不继承 PO
     @Data
     @ApiModel("业务返回 VO")
     public class XxxVO {                                                         // 不 extends XxxPO
         private String uniqueValue;
         private String name;
         // 不需要 createTime / deleted / id
     }

     // ✅ 同名字段 ≥ 3 条用 BeanCopyUtils
     XxxVO vo = BeanCopyUtils.copy(srcPO, XxxVO::new);
     vo.setDerivedField(...);                                                     // 派生字段手 setX
     ```
   - **反例**：
     ```xml
     <!-- ❌ XML 自定义 SQL 用 PO 接收（划重点：本项目反复出现） -->
     <resultMap id="xxxResultMap" type="com.obo.bi.cashier.po.XxxPO">
         <id property="id" column="id"/>
         <result property="createUser" column="create_user"/>
         ...
     </resultMap>

     <!-- ❌ XML 中允许写 <!-- 注释 -->：表 ↔ Java 类型的纯映射不需要解释 -->
     <!-- 任何业务上的「为什么这么写」都应该去 Mapper Java 接口 / Java 类上解释 -->

     <select id="pageXxx" resultMap="xxxResultMap">
         SELECT id, ..., create_user, ..., deleted FROM xxx
     </select>
     ```
     ```java
     // ❌ VO 继承 PO
     @Data
     public class XxxVO extends XxxPO {                                           // 顺带继承 7 个 BaseEntity 字段
         // 什么都没写，但 API 响应包含 deleted / createTime / tenantId
     }

     // ❌ DTO 继承 PO
     public class SaveXxxDTO extends XxxPO { ... }                                // 拖个尾巴。表单提交不该包含 deleted

     // ❌ Service 返回 PO
     public PageResult<XxxPO> pageXxx(...) { ... }                                // 业务响应携带数据库主键 id + deleted

     // ❌ VO 上 setCreateTime 表明 VO 拖了 PO 尾巴
     vo.setCreateTime(LocalDateTime.now());
     vo.setDeleted(0);
     ```
   - **本项目实踩样板**（`StoreEntryPlatform` 调研记录 · 2026-10-10）：Mapper XML 原本同时使用 PO 接收参数 + VO 父类两条；§4.6、§4.7 两次重构后才达成 "PO 不出 Service 边界"：
     - 修：`<resultMap type="...po.Xxx">` → `<select resultType="...vo.Xxx">`（§4.7 硬约束 1）
     - 修：`XxxVO extends XxxPO` → `XxxVO` 手写字段 + `BeanCopyUtils.copy`（§4.7 硬约束 3）
     - 写路径仍用 PO 临时持有走 MP `save` / `saveBatch`（§4.7 硬约束 2 允许场景），但 PO 仅限于 Service 内部，不进入 Controller / API 响应。
   - **交叉引用**：`SKILL.md` §4.5（PO extends BaseEntity）、§4.6（业务主键优先于 id）、§9（BeanCopyUtils 拼装）；`references/data-model-sql.md` §6.5。

