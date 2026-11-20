# method-contracts — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

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
13. **方法简化（提交前必查）**：除"未使用代码"外，新增 / 修改 Service 与 Component Service 实现类时，对私有 helper 做一轮反例扫。一判断一抛异常 → 内联调用点；一判断一返回 → 内联三元；取列表第一个 / 拼接字符串 → 删除 + 调用方内联；≥3 形参 wrapper → 封 DTO；一调用一方法 wrapper（仅调 1 次 Component Service）→ 删除 + 调用方直接调 Component Service；0 调用 dead method → 直接删。合规 helper（业务规则解析 / 反射 / 搜索工具 / 链式调用）必须保留（详见 `references/code-structure.md` §8.6 + §8.7 + SKILL.md §20）。**§8.7 补充 5 类反例**（StoreAuthorizationManageServiceImpl 案例）：BeanCopy 1 行 wrapper → 调用方改 `BeanCopyUtils.copy(src, XxxVO::new)`；DTO→DTO 字段 1:1 复制 → 同样改 `BeanCopyUtils.copy`；函数名撒谎的字典翻译 stub → 函数 + setXxx 调用一起删；纯 filter 1 调用方 wrapper → filter 提到 for 外、逻辑下沉；ID 生成 1 调用方 wrapper → 内联 2 行。

**抽方法的黄金原则**（写之前先看这条）：

- **不要为只使用一次的方法抽 helper**，除非那个方法真的特别长（≥ 30 行）或特别绕（嵌套 / 多状态机分支）
- 抽 helper 的合法动机只有 2 个：① 同一段逻辑出现 ≥ 2 处（消除重复）② 主方法 ≥ 80 行需要拆解可读性
- 一次性 / 顺序性强 / 不会再用 → 不要硬抽，保留主流程扁平写法（详见 `references/code-structure.md` §8 表格 + §8.7）

4.9. **PO 业务字段必须显式标注 `@TableField`（强约束）**：
   - **硬约束**：`bi-cashier-component/.../po/Xxx.java` 的**业务字段**（除 `id` 之外的所有本表专属列）**必须**显式标注 `@TableField("snake_case_column_name")`，与 DB 列名 1:1 锁定；**禁止**依赖 MyBatis-Plus 默认的「驼峰 → 下划线」隐式转换。
   - **理由**：
     1. **显式映射抗漂移**：DB 列重命名（加 `_archive` 后缀 / 拼写修正）时，显式 `@TableField` 会让 MP 启动期反射失败立刻报错，**不会**让接口静默返回 `null` 或 `0`；依赖隐式规则的代码会在运行时「字段对不上、值是默认值」才发现。
     2. **项目惯例 100% 显式**：`BankCard` / `Company` / `StoreEntryPlatformField` / `OperatingScope` 等 30+ PO 全部显式标注 `@TableField("xxx")`；只有 `StoreEntryPlatform`（主表）三个业务字段漏标，是**不一致**而非「风格选择」。
     3. **grep 审查需要**：显式 `@TableField` 让审查可一行 grep 验证「列名与 DB 一致」；隐式规则无法在 commit 前拦截漂移。
     4. **继承字段不算**：BaseEntity 已经为 `createUser / updateUser / createTime / updateTime / deleted / tenantId` 显式标注，子类不要重写（详见 §4.5）；本节只约束**本表专属业务列**。
   - **正例**：
     ```java
     @Data
     @TableName("cashier_bank_card")
     public class BankCard extends BaseEntity implements Serializable {
         @TableId(type = IdType.AUTO)
         private Long id;                                          // 主键：@TableId 标注

         @TableField("account_number")                            // 业务字段：@TableField 显式列名
         private String accountNumber;

         @TableField("bank_name")
         private String bankName;
         // createUser / updateUser 等继承自 BaseEntity，不重写
     }
     ```
   - **反例**（本项目 `StoreEntryPlatform` 初版踩坑 · 2026-10-10）：
     ```java
     // ❌ 业务字段漏标 @TableField，依赖 MP 默认驼峰 → 下划线
     @Data
     @TableName("cashier_store_entry_platform")
     public class StoreEntryPlatform extends BaseEntity implements Serializable {
         @TableId(type = IdType.AUTO)
         private Long id;

         private String platformName;      // ❌ 缺 @TableField("platform_name")
         private String platformCode;      // ❌ 缺 @TableField("platform_code")
         private String configRemark;      // ❌ 缺 @TableField("config_remark")
     }
     ```
   - **审查硬指标**（写完 PO 必跑）：
     ```bash
     # 找出 bi-cashier-component 下业务字段未标注 @TableField 的 PO
     # 规则：PO 字段除 @TableId 的 id / 继承自 BaseEntity 的字段外，其余私有字段前一行必须含 @TableField
     # 简化检查：扫描所有 bi-cashier-component/.../po/*.java，列出每个 PO 的「业务字段」行，再 grep 上一行是否有 @TableField
     for f in D:/OB/bi-FOB/bi-cashier/bi-cashier-component/src/main/java/com/obo/bi/cashier/po/*.java; do
       echo "=== $f ==="
       grep -nE "private\s+\w+\s+\w+\s*;" "$f" \
         | grep -vE "private (Long|String|Integer|LocalDate|LocalDateTime|BigDecimal) (id|createUser|updateUser|createTime|updateTime|deleted|tenantId)\s*;"
     done
     # 上述命令输出每个 PO 的业务字段行号；逐一检查这些行号前一行是否含 @TableField；未含即违规
     ```
   - **交叉引用**：`SKILL.md` §4.1（MP 注解作用域，只允许在 PO 出现）、§4.5（继承 BaseEntity 与审计字段显式标注）；`references/data-model-sql.md` §6（BaseEntity 继承字段清单）。

### 代码生成范围

| 模块 | 内容 |
|------|------|
| bi-cashier-api | DTO、VO（手动管理）、Feign Client |
| bi-cashier-component | PO、Mapper、Service（IXxxService）、ServiceImpl（继承 ServiceImpl） |
| bi-cashier-service | ManageService（IXxxManageService）、ManageServiceImpl |
| bi-cashier-web | Controller、Mapper.xml |

