---
name: remote-cashier-java-standard
description: Use when 修改、审查或新建 bi-cashier-api/bi-cashier-component/bi-cashier-service/bi-cashier-web 的 Java 后端代码及关联 Mapper XML、SQL，或用户明确要求「使用 oboJava 规范」「按 oboJava 规范修改」「按 oboJava 规范审查」。先读本入口，再按任务读取 references 对应章节，不要求加载全部细则。仅适用于 bi-cashier-* 模块组，不要用于 bi-file/bi-user 等其他 BI/OBO 模块。
---

# bi-cashier 模块 Java 开发规范

## Workflow

1. 确认目标属于四个 `bi-cashier-*` Maven 模块之一；包名相似不代表适用。跨模块任务只对 cashier 部分应用本规范。仅有触发短语而没有具体任务时，先澄清。
2. 读取本入口的核心规则，根据下方导航加载本次涉及的细则；不要一次读取整个 references 目录，也不要把全部参考文件拼成一个大文件。
3. 同时加载 `remote-idea-mcp-usage` 的入口，了解当前 IDEA MCP 能力和环境；路径从当前可用技能清单获取，不猜安装位置。
4. 按调用链修改接口、实现、调用方、DTO/VO/XML；仅做任务范围内的变更。
5. 自查实际改动，完成可执行的编译验证。报告命令、退出码、覆盖范围及未验证项；环境不可用时如实说明，不把静态检查当作编译通过。

## 核心规则（每次适用）

### 分层与模块

| 模块 | 内容与边界 |
|---|---|
| `bi-cashier-web` | Controller：入参校验、调用 ManageService、包装 Result；不写集合转换、批量查询或业务逻辑 |
| `bi-cashier-service` | `IXxxManageService` / `XxxManageServiceImpl`：业务编排、跨 Component/Feign、事务；不直接调用 Mapper 或写查询 Wrapper/SQL |
| `bi-cashier-component` | `IXxxService` / `XxxServiceImpl` 继承 MP ServiceImpl；PO、Mapper 与同名 XML、数据访问；禁止 Manage 命名或跨业务编排 |
| `bi-cashier-api` | DTO、VO、枚举、Feign Client；无业务实现、Mapper 或持久层注解 |

调用方向：`Controller → ManageService → Component → Mapper`，不得越级或反向调用。已有细则中的旧“代码生成范围”表若与此冲突，以此表和 `architecture-layers.md` 为准，Mapper XML 属于 Component。

### 契约、参数与返回值

- Controller ≥2 个独立业务入参收进 DTO；Service/Component/helper ≥3 个形参必须 DTO 化。只有全部为固定 RPC 传输字段且不超过3个时可记录例外；CAS、状态推进、复合写入不算 RPC 例外。
- 审查或调整调用链必须统计接口、实现和调用方中的 ≥3 参数方法，报告处理结果，不能因历史代码或刚下沉而跳过。
- 聚合/上下文 DTO 必须在 api 中作为独立顶级类，禁止嵌入 Service/Interface/Impl。
- 承载数据的上下文/聚合/统计对象禁止写成 Impl 内部类（`private static final class`），必须是 api 模块顶级 DTO/VO；细则见 code-structure §7.1。
- `PageResult<T>`、`Result<PageResult<T>>` 必须带泛型；PO→VO 转换后重新包装 records，禁止伪泛型。
- 无返回载荷的写接口返回 `Result<Boolean>` / `Result.success(Boolean.TRUE)`；查询校验布尔接口返回真实结果，业务对象接口正常返回对象。
- Controller 返回 VO，不泄露 PO；Page/List/Detail 按业务视图独立命名。DTO 校验边界变更需同步相关前端 FormRules、maxlength。
- 同名字段 ≥3 条用 `BeanCopyUtils.copy/copyList`；例外字段在源中存在时用 `copyIgnore` 排除后单独赋值，不能因此改为全手写 set。

### 持久层与分页

- PO 继承 `BaseEntity implements Serializable`；不重复声明审计字段，不手动填 create/update 审计字段。业务字段显式 `@TableField`，DTO/VO/Req/Resp 禁用 MP 持久层注解。
- 优先用业务唯一值定位和关联；MP 内部 `removeById/updateById` 等主键操作可用 id。
- PO 仅在数据访问边界内使用；XML 返回类型、继承边界、MP 泛型按 `po-boundaries.md` 执行。
- 分页使用 XML + PageHelper，`startPage` 紧邻查询；详细 SQL 写法和链路见 `pagination-rules.md`。
- MP 查询自动过滤软删，不重复 `.eq(getDeleted, 0)`；软删走 `remove*/delete*`，不用 lambdaUpdate 手动 setDeleted。手写 XML 必须保留 `deleted = 0`，XML 更新软删需显式 SET。
- INSERT 不手动 `setDeleted(0)/setVersion(0)`；审计自动填充的业务例外必须有理由。业务主表禁止物理删除；纯关联/配置表例外须说明。
- 单表非分页统计走 Component `count`，不用新增 Mapper countByXxx；数据级唯一性由 Component 校验并抛异常，Manage 不重复判重。
- 信任已生效的 DTO 默认值/校验和 PageHelper/MP 返回契约，不加无意义重复防御。

### 代码质量与测试

- 接口方法、常量、字段变量必须有业务语义 Javadoc；Impl 的 `@Override` 方法不加方法 Javadoc（含 inheritDoc）。Controller public 方法用中文 Swagger 注解，不加方法 Javadoc；类和自定义 helper 保留必要 Javadoc。
- Javadoc 必须与真实签名一致：改签名（≥3 参 DTO 化 / 删参 / 合并参）必须在同一 commit 内同步 `@param`（名称逐字一致，失效项删除）；一个方法上方只保留一个 Javadoc 块，描述必须与方法实际行为一致；提交前自查 `stale=0 missing=0 orphan=0`，细则见 documentation-rules §0.4。
- DTO/VO 字段 Javadoc 末尾不加句号，字段间与类体首尾留空行；Resource 注入集中在类顶部按字段名字母序，且**注入字段不加 Javadoc**（细则见 documentation-rules §0.5）。
- 业务失败抛 `BusinessException`，提示语面向用户，不暴露内部术语；关键业务键放日志。CRUD 失败、CAS 冲突、RPC 异常等不得静默处理。Controller 不承担业务日志。
- 禁止循环查库/同步跨 Service 写入、吞异常、printStackTrace；跨服务复用已有 API Feign Client。Controller 禁用已废弃 `@BusLogs`。
- 清理真正零引用方法/import/形参；不误删契约参数。一次调用的简单 wrapper 优先内联，保留真实复杂逻辑或复用 helper，详见 code-structure §8。
- 单点调用 + 无业务语义的薄壳 helper（try/catch 包一次调用、纯字符串归一化、纯字典取值）一律内联到调用点，不单独声明方法，详见 code-structure §8.6。
- 测试仅放 `bi-cashier-web/src/test`，仅针对 Controller 公开方法；api/component/service 不建 src/test。

## 按需细则导航

以下路径均相对本技能目录。**只读与任务相关的文件**；若工具仍提示单次读取超限，按标题定位并分段读取或检索，不反复全量重试。

Use `references/layer-rules.md` when 需要分层职责、MP 注解作用域、测试范围、顶级 DTO 的完整规则（原核心 §1–4.4）。
Use `references/po-identity.md` when 修改 PO 继承、审计字段或业务唯一值（原核心 §4.5–4.6）。
Use `references/po-boundaries.md` when 审查 XML 返回类型、PO 继承边界或 MP 泛型三件套（原核心 §4.7）。
Use `references/pagination-rules.md` when 新增或修改分页、PageHelper 与 Mapper XML（原核心 §4.8）。
Use `references/method-contracts.md` when 修改参数对象化、BeanCopy、日志、helper 或 PO 显式字段映射（原核心 §5–13、§4.9）。
Use `references/documentation-rules.md` when 修改接口/Impl/Controller 注释及无载荷写接口（原代码规范 §0–0.5）。
Use `references/layout-rules.md` when 需要文件布局、注解顺序、泛型、模块归属与完整红线（原代码规范 §1–9）。
Use `references/code-structure.md` when 修改类结构、DTO/VO 格式、helper 或未使用代码。
Use `references/coding-quality.md` when 修改命名、异常文案、日志、安全规则或 Feign 契约。
Use `references/architecture-layers.md` when 需要 Controller/Manage/Component/Mapper 完整架构规则；按所需标题分段读取。
Use `references/concerns-separation.md` when 拆分业务/数据职责、Manager、Facade 或过大实现类。
Use `references/data-model-sql.md` when 修改表结构、PO、uniqueValue、软删或 SQL 归档。
Use `references/mybatis-vs-xml.md` when 决定 MP/XML 用法或修改动态 SQL、聚合查询。
Use `references/performance.md` when 涉及批量查询、导出、性能或敏感字段。
Use `references/translation-aop.md` when 修改字典/系统数据翻译。
Use `references/file-attachment-pattern.md` when 修改 FileExpiryRecord、bi-file 与标签库联合写入。
Use `references/call-chain-templates.md` when 新建四层调用链。
Use `references/code-review-checklist.md` when 评审或提交前自查；只核查适用项。

## 编译验证与优先级

Use `references/maven-build.md` when 通过 IDEA MCP 执行真实 Maven 构建、确认 Java/Maven 路径或排查 Lombok（原 §22）。示例机器路径不是当前机器事实，执行前确认实际环境。
Use `references/code-compile-verification.md` when 选择验证覆盖范围、解读诊断或输出验证报告；其中历史 fallback 不覆盖本入口的工具优先级。
Use `references/compile-history.md` when 排查旧的 fire-and-forget、增量索引、javac/mtime 误判事故（原 §21，仅历史参考，不默认加载）。

- 修改结束后优先通过 IDEA MCP `execute_terminal_command` 执行真实 Maven 验证；四模块集成构建模板见 maven-build。
- `build_project` 投递成功、`get_file_problems` 零告警、静态扫描或 class 时间戳，单独都不能证明完整构建通过。
- 不在缺依赖的 Bash/context-mode 沙箱中拼 javac/classpath 冒充项目构建；历史 §21 的沙箱脚本由后来的 §22 与本入口覆盖。
- 本轮未修改代码时不重复要求编译；环境/工具不可用时报告阻塞及未验证范围，不捏造通过，也不要求文件写入权限快照。

## 旧章节导航与案例（按需，不自动加载）

旧文档中的 `SKILL.md §X` 引用可能来自“核心规则”“代码规范”或“实战案例”不同编号体系，按主题定位；编号歧义时以标题为准。

Use `references/refactoring-basics.md` when 查实战案例 §1–11：业务枚举、反射赋值风险、常量、helper、注入排序、分页泛型、CRUD 日志、BeanCopy。
Use `references/dto-contract-cases.md` when 查实战案例 §12–14：DTO/VO/PO 链路、前后端校验同步和契约信任。
Use `references/soft-delete-cases.md` when 查实战案例 §15：MP 自动软删与手写 XML 的差异。
Use `references/audit-and-view-cases.md` when 查实战案例 §15.1、§16：审计自动填充、INSERT 默认值和视图命名。
Use `references/data-access-cases.md` when 查实战案例 §17–18：BankCard 软删整改和数据级唯一性。
Use `references/helper-and-comment-cases.md` when 查实战案例 §19–23：Impl 注释、一次调用 wrapper 反模式、Javadoc 与签名脱节、内部类当 DTO 用反模式、单点调用薄壳 helper 内联。

上述拆出文件保留原文细则和案例；不要因其引用了旧 SKILL.md 章节而重新加载所有文件。后续新增规则写入对应主题文件，入口仅保留核心约束与导航。

## Response Shape

- 修改范围和涉及层级；≥3 参数方法的统计与处理（涉及调用链时）。
- 实际验证手段、命令、退出码与覆盖模块；明确列出未验证项。
- 不把本次未读取、未检查或未运行的内容写成已通过。
