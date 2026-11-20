# po-identity — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

4.5. **PO 必须 `extends BaseEntity`，禁止手写审计字段（强约束）**：
   - **硬约束**：`bi-cashier-component/.../po/Xxx.java` **必须** `extends com.obo.core.common.model.BaseEntity implements Serializable`，由父类提供 `id` / `createUser` / `updateUser` / `createTime` / `updateTime` / `deleted` / `tenantId` 及其对应的 `@TableId` / `@TableField` / `@TableLogic` 注解与自动填策略。
   - **禁止在 PO 中重新声明 BaseEntity 已有的字段**：`@TableField("create_user")` / `@TableField("create_time")` / `@TableField("update_user")` / `@TableField("update_time")` / `@TableField("deleted")` / `@TableField("tenant_id")` 一律不写在 PO 里；手写 `private Long id;` 也属违规（BankCard / Store 模式是「重写 `@TableId`」+ 「保留类型声明」二选一，推荐后者，不重写）。
   - **禁止 Service 手动填审计字段**：`po.setCreateUser(currentUser)` / `po.setUpdateUser(...)` / `po.setUpdateTime(LocalDateTime.now())` 一律删除；由 BaseEntity 自带的 `@TableField(fill = FieldFill.INSERT / INSERT_UPDATE)` + 全局 `MetaObjectHandler` 自动填。如果 Service 中出现这些 set 调用，说明误用了旧式手动填口径，必删。
   - **理由**：手写审计字段会导致 (1) 字段声明在父类与子类各写一份，维护期改一处忘另一处必出字段漂移；(2) 与项目惯例 100% 不一致——`BankCard` / `Store` / `StoreChangeInfo` / `AccountChangeDetails` / `OperatingScope` 全部继承 BaseEntity；(3) `get_file_problems` 0 error 只能查编译级问题，看不出「惯例级 drift」，不在 self-check 覆盖范围内。
   - **审查硬指标（写完 PO 必跑）**：
     ```bash
     # 1. 找出 bi-cashier-component 下没继承 BaseEntity 的 PO
     grep -L "extends BaseEntity" D:/OB/bi-FOB/bi-cashier/bi-cashier-component/src/main/java/com/obo/bi/cashier/po/*.java
     # 命中（输出文件名）→ 违规
     # 2. 扫当前 PO 是否重声明 BaseEntity 字段
     grep -E "@TableField\(\"(create_user|create_time|update_user|update_time|deleted|tenant_id)\"\)" <本任务新建/修改的 PO>
     # 命中 → 违规
     # 3. 扫 Manage / ServiceImpl 是否手 set 审计字段
     grep -E "set(CreateUser|UpdateUser|UpdateTime|CreateTime)\(" D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/<XxxManageServiceImpl>.java
     # 命中（除日志形参外）→ 违规
     ```
   - **正例**：
     ```java
     // ✅ bi-cashier-component/po/BankCard.java
     @Data
     @TableName("cashier_bank_card")
     public class BankCard extends BaseEntity implements Serializable {
         @TableId(type = IdType.AUTO)
         private Long id;   // 重新声明仅为保留类型信息；注解继承父类
         private String uniqueValue;
         // ...业务列；不要写 createUser / createTime 等
     }

     // ✅ ManageImpl 写法
     po.setPlatformName(dto.getPlatformName().trim());
     po.setPlatformCode(dto.getPlatformCode().trim());
     po.setConfigRemark(dto.getConfigRemark());
     storeEntryPlatformService.save(po);   // createUser/updateUser 由 BaseEntity auto-fill 写入
     ```
   - **反例（本次 storeEntryPlatform 初版踩坑）**：
     ```java
     // ❌ PO 重复声明
     public class StoreEntryPlatform implements Serializable {
         @TableField("create_user") private String createUser;
         @TableField("update_user") private String updateUser;
         @TableField("create_time") private LocalDateTime createTime;
         @TableField("update_time") private LocalDateTime updateTime;
         @TableField("deleted")     private Integer deleted;
         // ...
     }
     // ❌ Service 手 set 审计
     po.setCreateUser(currentUser);
     po.setUpdateUser(currentUser);
     existed.setUpdateTime(LocalDateTime.now());
     ```
   - **交叉引用**：`references/data-model-sql.md` §6（BaseEntity 继承字段清单） + §9（反例 ❌ 重复声明 BaseEntity 字段）。两者在 SKILL.md 与 references 双侧都有，缺一不可——SKILL.md 给出「写前必看」的强约束，references 给出「字段列表」的实现细节。
4.6. **业务主键优先于数据库 id（强约束）**：
   - **硬约束**：业务调用链上（Controller、Manage、Component Service、Mapper XML / Java API、DTO/VO 字段、Manage 编排调用方）**优先使用本表「业务唯一值」** 作为定位与关联字段；**只有在没有业务唯一值**（如主表仅靠 id 区分）才退而使用 id。
   - **「业务唯一值」是什么**：PO 中具有业务语义的、**业务上识别一条记录** 的列。典型为 `uniqueValue`（全局唯一值）、`platformCode` / `dictCode`（业务码）、`nodeCode` / `taskCode`（业务节点 / 业务编号）、`code` / `bizCode`。这些列通常会打 UNIQUE 索引（SQL DDL 阶段会同时设 UNIQUE 约束）；SQL 里是否被「UNIQUE」索引不是判定门槛，**业务语义可被识别为「唯一」就是**。
   - **覆盖场景**：
     - **关联**（子表外键 / 同表自关联）：子表外键使用「业务唯一值」字段（类型对齐），不外接主表 id。例如 `cashier_store_entry_platform_field.platform_code VARCHAR(50)` 关联 `cashier_store_entry_platform.platform_code`，**不是** `platform_id BIGINT`。
     - **数据查询**（Manage / Component / Mapper）：查询条件 / 分页 SQL / detail 接口 定位一项以「业务唯一值」为主。如 `getByPlatformCode(code)`，**不是** `getById(id)`。
     - **删除**（Manage / Component）：以「业务唯一值」定位记录后处理业务逻辑，**可以**在调 `MP` 的软删接口 `removeById(entity.getId())` 中使用 id（这是 BaseEntity / `@TableLogic` 内部必须的内部动作），但在「业务上怎么找到这条记录」这一步必须以业务唯一值为输入。
   - **不覆盖场景**（可以使用 id）：
     - `MyBatis-Plus` `BaseMapper.updateById` / `removeById` / `getById` / `selectById` 内部调用 —— MP 仅按主键定位，这是 BaseEntity 行为不是业务选择。
     - 返回记录列表后仅在内存中「拼接 URL / log 中的额外上下文」补充 id（如 `<a href=".../edit/${id}">` 仅作后端路由 path 变量 / 日志索引），仍需以业务唯一值作为路由中主可识别主键。
     - **子表中间关联表**（多列联合主键）：`PO_A(主表).id + PO_B(另一表).id` 联合主键的场景。如果这些 id 本质上是联合外键（两边都是业务唯一值），仍以「业务唯一值」联合主键定义；不要拆开变为「其中一表 id」。
   - **理由**：
     1. 业务唯一值是「跨业务一致的身份」。店铺管理、店铺上架 V2、注销 / 变更 / 异常 申请单 都以 `platformCode` / `uniqueValue` 串接，不能以「主表 id」串接（id 本表唯一，与跨业务其他记录不合）。
     2. id 是数据库内部主键，可能随迁库 / 合并表 / 软删重建而变；业务唯一值是业务语义上的「这条路叫这个名字」，一辈子不变。
     3. 业务调用方看到 id 误以为是业务字段、在 DTO / URL 后面传 `?id=...`，使得代码与「人能看到、能表示出来的」业务名脱节。
     4. 子表外键用 id 会让「全表在谁」依赖主表 id，重名 / 重生记录 / 跨业务追踪 都被 id 屏蔽。
   - **DTO/VO 也遵同一个原则**：业务主键透出 id 是「同主表 / 跨业务 上竟能识别的」——坚决禁止。DTO/VO 只能以业务唯一值作为记录标识字段，id 在 API 响应中出现会被解读为「外部可调的主键」。
   - **审查硬指标**（写完 Controller + Service + XML 必跑）：
     ```bash
     # 1. Controller 层是否以 id 作为业务主键
     grep -E "@RequestParam\(\"id\"\)|@RequestBody.*\\bid\\b" bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/<XxxController>.java
     # 命中 且 本表存在业务唯一值（uniqueValue / platformCode / nodeCode / code / bizCode） → 违规
     # 2. 子表外键是否使用主表 id
     grep -E "<主表名>_id" bi-cashier-web/src/main/resources/mapper/<XxxMapper>.xml
     # 命中 且 本表存在业务唯一值 → 违规（应改为业务唯一值字段名 + 对应类型）
     # 3. DTO/VO 是否在业务字段里透出 id
     grep -nE "private (Long|Integer|String) id[ ;]" bi-cashier-api/src/main/java/com/obo/bi/cashier/<dto|vo>/<Xxx>.java
     # 命中 且本表存在业务唯一值 → 违规（删除 id 字段）
     ```
   - **正例**（`StoreEntryPlatform` 业务主键为 `platformCode`）：
     ```java
     // ✅ Controller 以 platformCode 为业务主键
     @PostMapping("/detailStoreEntryPlatform")
     public Result<...> detailStoreEntryPlatform(@RequestParam("platformCode") String platformCode) { ... }

     @PostMapping("/deleteStoreEntryPlatform")
     public Result<...> deleteStoreEntryPlatform(@RequestParam("platformCode") String platformCode) { ... }

     // ✅ Service 以 platformCode 定位
     StoreEntryPlatform po = storeEntryPlatformService.getByPlatformCode(code);

     // ✅ Mapper XML 子表外键为 platform_code
     <select id="listByPlatformCode" resultMap="...">
         SELECT ... FROM cashier_store_entry_platform_field
         WHERE deleted = 0 AND platform_code = #{platformCode}
         ORDER BY FIELD(...)
     </select>

     // ✅ DTO/VO 仅以 platformCode 作为记录标识，不透出 id
     @Data
     public class StoreEntryPlatformDetailVO {
         private String platformCode;   // 业务主键
         private String platformName;
         // 不包含 private Long id;
     }

     // ✅ MP removeById 内部可以使用 id（这是 BaseEntity 内部动作，不是业务选择）
     boolean ok = storeEntryPlatformService.removeById(po.getId());
     ```
   - **反例**（`StoreEntryPlatform` 本有 platformCode 却以 id 串接）：
     ```java
     // ❌ Controller 以 id 为业务主键
     @PostMapping("/detailStoreEntryPlatform")
     public Result<...> detailStoreEntryPlatform(@RequestParam("id") Long id) { ... }

     // ❌ 子表外键为主表 id
     CREATE TABLE cashier_store_entry_platform_field (
         platform_id BIGINT NOT NULL,   -- 应为 platform_code VARCHAR(50)
         ...
     );

     // ❌ DTO/VO 透出 id
     public class StoreEntryPlatformDetailVO {
         private Long id;                // 业务上不需要，应删除
         private String platformCode;
         ...
     }

     // ❌ Service 依靠 getById 定位
     StoreEntryPlatform po = storeEntryPlatformService.getById(dto.getId());
     ```
   - **交叉引用**：`references/data-model-sql.md` §6.5（业务主键 / 唯一值表）。SKILL.md 给出「写前必看」强约束，references 给出「实际表上的业务主键列表」与「架构决策记录」。

