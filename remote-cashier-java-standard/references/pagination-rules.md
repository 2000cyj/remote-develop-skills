# pagination-rules — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

4.8. **分页强约束：XML 写法 + PageHelper（项目惯例，双锁）**：
   - **本节范围**：只约束**分页查询**（接口返回 `Result<PageResult<XxxVO>>`）。非分页查询（EXISTS / IN / 单值校验 / 详情查询 / 列表但不分页）不本节范围，遵 §4.7 PO 边界与 §4.1 注解作用域。
   - **一句话总结（两锁双锁，不要跨）**：
     1. **分页全部使用 XML 写法**。即在 `bi-cashier-web/src/main/resources/mapper/XxxMapper.xml` 里写 `<select id="pageXxx" resultType="...vo.XxxVO">` 自定义 SQL；Mapper Java 接口只签名 `List<XxxVO> pageXxx(@Param("dto") XxxPageDTO dto)`。**禁止**用 MyBatis-Plus 框架方法（`lambdaQuery().page(...)` / `selectPage(IPage)` / `IService.page()`）写业务分页。
     2. **分页都使用 PageHelper**。即在 Service 实现类入口 `PageHelper.startPage(pageNum, pageSize)`，Mapper 返回 `List<XxxVO>`，强转 `(Page<XxxVO>) records).getTotal()` 读 total。**禁止**用 MyBatis-Plus `Page<T>` / `IPage<T>` / `PaginationInnerInterceptor` 拼分页上下文。
   - **现状**：bi-cashier 项目里 `CompanyServiceImpl` / `OperatingScopeServiceImpl` / `StoreAuditOnboardingApplication` 三个为代表的主流分页都是 **XML 写 + PageHelper 分页** 模式。
   - **硬约束 3 枪**（bi-cashier 业务代码一律遵守）：
     - **Mapper 接口签名**：`List<XxxVO> pageXxx(@Param("dto") XxxPageDTO dto)` —— **不**带 `IPage<XxxVO>` / `Page<XxxVO>` 参数；不接 `selectPage(IPage)`。
     - **Service 实现**：入口调 `PageHelper.startPage(pageNum, pageSize)`；Mapper 返回 `List<XxxVO>`，强转 `(Page<XxxVO>) records).getTotal()` 读 total；与 `OperatingScopeServiceImpl.pageOperatingScope` 严格同型。**不**调 `lambdaQuery().page(...)` / `selectPage(IPage)` / `IService.page()`。
     - **XML**：单条 `<select>` **不**写 `LIMIT`（PageHelper 拦截器自动追加）。翻 `CompanyMapper.xml` / `OperatingScopeMapper.xml` 为准。SQL 只负责业务条件拼接，LIMIT/OFFSET 完全是 PageHelper 的事。
   - **理由**：
     1. **一致性**：bi-cashier 主流业务都是 XML 写 + PageHelper 模式（`CompanyServiceImpl` / `OperatingScopeServiceImpl` 明确该模式），由 `CompanyServiceImpl` 的注释看是为了避开 `JSqlParser 4.x` 的 `BinaryExpression.toString` 栈溢出——MP `LambdaQueryWrapper` 拼接的深嵌套 AST 会触发该 bug，PageHelper 的纯 SQL 拼接是闪避路径。
     2. **Mapper 接口更轻**：`List<XxxVO> pageXxx(@Param("dto") XxxPageDTO dto)` 比 `IPage<XxxVO> pageXxx(Page<XxxVO> page, DTO dto)` 少一个上下文参数，调用方不需自己组装 Page。
     3. **XML 不需手写 LIMIT**：避免手写 `LIMIT #{pageSize} OFFSET #{offset}` 出现拼写错 / 上下文参数忘了传。
     4. **XML 写让 SQL 集中可查**：所有分页 SQL 在一个 mapper xml 里，跨人接手不需在 Java / XML 两处跳。MP `LambdaQueryWrapper` 拼接让分页条件散在 Java 代码里，不便于 DBA 调优。
   - **审查硬指标**：
     ```bash
     # 1. Mapper 自定义分页方法是否接入 MP IPage / Page
     grep -rEn 'IPage<.*>\s+page[A-Z]|Page<.*>\s+page[A-Z]\b' bi-cashier-component/src/main/java/com/obo/bi/cashier/mapper/
     # 命中 → 违规（应该用 List<XxxVO> pageXxx(DTO dto)）
     # 2. Service 中是否还在 new Page<>
     grep -rEn 'new Page<.*>\(' bi-cashier-component bi-cashier-service -i --include='*.java'
     # 命中 → 违规（应该用 PageHelper.startPage）
     # 3. Service 中是否还用 MP 框架分页方法
     grep -rEn '\.page\s*\(|\.selectPage\s*\(|iservice.page\(' bi-cashier-{component,service}/src/main/java/com/obo/bi/cashier/ --include='*.java'
     # 命中 → 违规（必须 PageHelper.startPage）
     # 4. XML 中自定义 select 是否有 LIMIT
     grep -rEn 'LIMIT\s+#{.*page|offset' bi-cashier-web/src/main/resources/mapper/*.xml
     # 命中 → 违规（PageHelper 模式不该出现手动 LIMIT 拼接）
     ```
   - **正例**（本项目现有 3 套都同型）：
     ```java
     // Mapper 接口
     public interface OperatingScopeMapper extends BaseMapper<OperatingScope> {
         List<OperatingScopePageVO> pageOperatingScope(@Param("dto") OperatingScopePageDTO dto);
     }

     // Service 实现
     @Override
     public PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto) {
         PageHelper.startPage(dto.getPageNum(), dto.getPageSize());
         List<OperatingScopePageVO> records = baseMapper.pageOperatingScope(dto);
         long total = ((Page<OperatingScopePageVO>) records).getTotal();
         return new PageResult<>(total, records);
     }
     ```
     ```xml
     <!-- XML 不带 LIMIT -->
     <select id="pageOperatingScope" resultType="com.obo.bi.cashier.vo.OperatingScopePageVO">
         SELECT id, code, name, ...
         FROM cashier_operating_scope
         WHERE deleted = 0
         <if test="dto.xxx != null and dto.xxx != ''">...</if>
     </select>
     ```
   - **反例**：
     ```java
     // ❌ Mapper 接入 MP IPage
     public interface XxxMapper extends BaseMapper<XxxPO> {
         IPage<XxxVO> pageXxx(Page<XxxVO> page, @Param("dto") XxxPageDTO dto);
     }

     // ❌ Service 用 new Page<>
     Page<XxxVO> page = new Page<>(dto.getPageNum(), dto.getPageSize());
     IPage<XxxVO> result = baseMapper.pageXxx(page, dto);

     // ❌ Service 用 MP 框架分页（违反「分页都使用 PageHelper」）
     IPage<XxxPO> mp = this.lambdaQuery().page(new Page<>(dto.getPageNum(), dto.getPageSize()));
     // 或 baseMapper.selectPage(new Page<>(...), wrapper);

     // ❌ Service 误用 IService.page()
     IPage<XxxPO> mp = this.page(new Page<>(dto.getPageNum(), dto.getPageSize()));
     ```
     ```xml
     <!-- ❌ XML 手写 LIMIT，会被 PageHelper 双重加 LIMIT 报错 -->
     <select id="pageXxx" resultType="com.obo.bi.cashier.vo.XxxVO">
         SELECT ... FROM xxx
         LIMIT #{page.pageSize} OFFSET #{page.offset}
     </select>
     ```
   - **补充：什么场景可以使用 JOIN**（本节明确边界，不是一刀切禁 JOIN）：
     - **EXISTS 短路**：`SELECT EXISTS(SELECT 1 FROM a INNER JOIN b ON ... WHERE ...)`。例：`StoreAuditOnboardingStoreMapper.existsByStoreCodeExcludingApplication`。**只问有 / 无，MySQL 优化器短路评估**，不存在行数膨胀问题。
     - **IN 子查询**：`WHERE x IN (SELECT ... FROM other_table WHERE ...)`。例：`IStoreAuditOnboardingApplicationService.countByPlatformCode` 里 `FIND_IN_SET({0}, platform_list)` 类似语义。**只传 uniqueValue 不传完整子表行**，避免双层资源消耗。
     - **详情查询**（不分页）里的 1:1 关联：`order LEFT JOIN user ON order.user_id = user.id` 取用户名/手机号。**一对一不膨胀**，可以 JOIN。例：`OperatingScopeDetailVO` 取父类名。
     - **列表不分页**（List 但没 LIMIT 也不是分页接口）的 1:1 关联：同上。
     - **跨表写**（UPDATE / DELETE 走子查询）：`UPDATE a SET ... WHERE id IN (SELECT ... FROM b WHERE ...)`。例：业务上的批量状态同步。
     - **以上场景的 Mapper 接口返回值**：依然遵 §4.7（XML 自定义 SQL 返回 VO / DTO，不用 PO 接收）。
   - **什么场景严禁 JOIN**（本节核心范围）：
     - **分页接口里父表 LEFT JOIN 一对多子表**：1 主 × 8 子 = 8 倍膨胀，破坏 `LIMIT N = N 个父记录` 的契约。
     - **分页接口里 GROUP_CONCAT 折叠子表**：折叠后 LIMIT 拿到的总行数 / 子表拼接后的总字节不可预期，DBA 调优无依据。
     - **本项目反例样本**（`StoreEntryPlatform` 调研记录 · 2026-10-10）：如果 `pageStoreEntryPlatform` 改成 `LEFT JOIN cashier_store_entry_platform_field ON ...` 再 `LIMIT 10`，前端拿到的是 10 条 JOIN 行（= 1.25 个 platformCode），分页契约破；需要嵌套子查询或 GROUP_CONCAT 修补，复杂度骤增且仍然比「先分页后批量查子表」慢。**因此本项目分页 + 一对多一律走 batch-fetch 模式**。
   - **本项目实踩样板**（`StoreEntryPlatform` 调研记录 · 2026-10-10）：初次实现 `StoreEntryPlatformServiceImpl.pageStoreEntryPlatform` 误用了 MP `Page<T>` + `IPage<VO>`，与项目惯例（PageHelper）不一致；后调整为 `List<VO> pageXxx(DTO)` + `PageHelper.startPage`，与 `OperatingScopeServiceImpl` 同型。后续新增分页接口默认按 PageHelper 模式实现，不要踩这个坑。
   - **batch-fetch 第二步实踩坑（V20261010 新增，NPE 血泪）**：batch-fetch 子表查询的「中间结果 VO」**必须**放在顶层（`bi-cashier-api/.../vo/XxxFlatVO.java`），**禁止**用 Mapper 接口内部类 + `resultType="...Mapper$InnerClass"`。后者在部分 MyBatis / Spring AOP 组合下反射识别不到内部类 setter，返回的 `List` 每个位置都是 `null` 元素，stream `Collectors.groupingBy` 取 `r.getX()` 触发 `NullPointerException`。
     - **反例**（已修复）：
       ```java
       // Mapper.java
       public interface StoreAuditOnboardingApplicationMapper {
           List<AssignedCompanyFlatRow> listAssignedCompanyByApplicationUniqueValues(...);
           class AssignedCompanyFlatRow { private String applicationUniqueValue; ... }
       }
       <!-- Mapper.xml -->
       <select id="listAssignedCompanyByApplicationUniqueValues"
               resultType="com.obo.bi.cashier.mapper.StoreAuditOnboardingApplicationMapper$AssignedCompanyFlatRow">
       ```
     - **正例**：
       ```java
       // bi-cashier-api/.../vo/AssignedCompanyFlatVO.java（顶层类 + @Data Lombok）
       @Data public class AssignedCompanyFlatVO { private String applicationUniqueValue; ... }
       ```
       ```java
       // Mapper.java
       List<AssignedCompanyFlatVO> listAssignedCompanyByApplicationUniqueValues(...);
       ```
       ```xml
       <!-- Mapper.xml -->
       <select id="listAssignedCompanyByApplicationUniqueValues"
               resultType="com.obo.bi.cashier.vo.AssignedCompanyFlatVO">
       ```
     - **修复成本**：1 个新顶层 VO + 改 Mapper 引用 + 改 XML resultType + 改 ServiceImpl import。**业务行为不变**。
     - **防御性兜底**：即使按正例做，stream 仍需 `filter(r -> r != null && r.getX() != null)` 防止未来某次数据异常（DB null 行 / 事务中间态）。
   - **batch-fetch 第二步实踩坑 2（V20261010 追加，resultMap 强制要求）**：上条「顶层 VO」还不够 —— 即便 VO 是顶层类 + `@Data` Lombok，MyBatis 的 `resultType` 自动反射 setter 在某些场景下（Spring AOP 代理类加载顺序 / 类型擦除 / 项目中间件）仍可能识别不到 setter，返回的 `List` 每个位置都是 `null` 元素，stream 拿到 `r` 后 NPE。
     - **强制要求**：batch-fetch 中间结果**必须**用显式 `<resultMap>` 替代 `resultType`。`resultMap` 明确列名 → property 映射，绕开 MyBatis 自动反射的不确定性。
     - **反例**（已修复）：
       ```xml
       <select id="listAssignedCompanyByApplicationUniqueValues"
               resultType="com.obo.bi.cashier.vo.AssignedCompanyFlatVO">
       ```
     - **正例**（已修复）：
       ```xml
       <resultMap id="AssignedCompanyFlatMap" type="com.obo.bi.cashier.vo.AssignedCompanyFlatVO">
           <result column="application_unique_value" property="applicationUniqueValue" />
           <result column="company_id"                property="companyId" />
           <result column="company_name"              property="companyName" />
       </resultMap>
       <select id="listAssignedCompanyByApplicationUniqueValues" resultMap="AssignedCompanyFlatMap">
       ```
   - **batch-fetch 实踩坑 3（V20261010 追加，聚合层编排 vs Component 单表）**：batch-fetch 不是 Component Service 自己的货。Component Service 只负责「单表 CRUD」，跨表编排（多 mapper 查询 + Java 端 group by 合并）**必须**在聚合层（Manage Service）进行。
     - **双重原因**：
       1. **架构原则**（本项目分层要求）：Component Service 禁止业务编排、跨 Component 调用，聚合层才是编排点。
       2. **PageHelper 5.x ThreadLocal 残留**（技术原因）：若 Component Service 内连续调 2 个 mapper，PageHelper ThreadLocal 会在 `Page query` 完成后残留（仅在调用方 `((Page<T>) list).getTotal()` 后才清），导致第二个 mapper 被偷偷加上 `LIMIT N + ORDER BY`，子表查不全。
     - **反例**（已修复）：Component Service 提供 `pageByConditionWithCompany(...)`，内部连续调 `mapper.pageByCondition` + `mapper.listAssignedCompanyByApplicationUniqueValues` + Java 端 group by。
     - **正例**（已修复）：
       ```
       聚合层（StoreAuditOnboardingManageServiceImpl.page）
         ├── PageHelper.startPage(1, 20)                                       ← PageHelper 作用域入口
         ├── auditApplicationService.pageByCondition(...)                       ← Component 单表 1
         │     └── mapper.pageByCondition                              ← PageHelper 拦截，加 LIMIT
         ├── ((Page<...>) list).getTotal()                                ← 【关键】消费 total，清 ThreadLocal
         ├── auditApplicationService.listAssignedCompanyByApplicationUniqueValues(...)    ← Component 单表 2
         │     └── mapper.listAssignedCompanyByApplicationUniqueValues  ← PageHelper 已清，无 LIMIT
         └── Java 端 group by 注入 assignedCompanies
       ```
     - **Component Service 接口拆分**：
       ```java
       public interface IStoreAuditOnboardingApplicationService {
           /** 主表分页（调用方需先用 PageHelper.startPage）*/
           List<StoreAuditOnboardingListItemVO> pageByCondition(StoreAuditOnboardingPageDTO dto, String currentUser);
           /** 子表批量（不走 PageHelper）*/
           List<AssignedCompanyFlatVO> listAssignedCompanyByApplicationUniqueValues(List<String> applicationUniqueValues);
       }
       ```
     - **不需手动 PageHelper.clearPage()**：`((Page<T>) list).getTotal()` 是 PageHelper 5.x 的标准清理点（聚合层必调），第二次 mapper 查询时 ThreadLocal 已被清。
   - **交叉引用**：`SKILL.md` §4.7（PO 边界三件套中『XML 返回类型』与本节同被 PageHelper 模式影响）；§5（分页返回 `Result<PageResult<XxxVO>>`）。

