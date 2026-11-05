---
name: remote-iot-java
description: Use when 在 simple-iot 项目的 Java 后端（iot-server / iot-common / iot-driver / driver-sdk）新增或修改 .java 代码、新增协议解码器或规则节点、新增调整实体与数据库表、排查设备上报链路或规则引擎执行问题；或 prompt 中出现 simple-iot、tb_ 表名、ProtocolDecoder、RuleNodeExecutor、DeviceTransport、init.sql 等锚点。不要用于 bi-cashier 等其他 Java 项目 —— 那属于 remote-cashier-java-standard。
---

# simple-iot Java 后端开发规范

本 skill 约束 **simple-iot**（自托管轻量 IoT 平台，Java 25 + Spring Boot 4 单体 + Vue 3 控制台）Java 后端的代码落位、schema 同步与文档纪律。核心目标是**避免"代码能跑但新装部署跑不起来"**这类断层。

Use references/architecture.md when 需要知道模块边界、三个扩展 SPI、数据上报链路，或判断新代码该落在哪个包。
Use references/schema-sync.md when 新增 / 修改实体类与数据库表、编写迁移 SQL、或需要校验 schema 与实体类是否一致。
Use references/code-conventions.md when 编写或评审 .java 代码：分层、命名、Javadoc、Jackson 序列化、异常与枚举约定。
Use references/bulk-edit.md when 批量补 Javadoc、全仓重命名类 / 枚举 / 方法、批量替换 import、统一字段命名，或合并两个同义类 —— 含脚本化改码的四个坑与强制自检。
Use references/pitfalls.md when 排查 IoT 平台的具体故障，或在提交前做一次自检。

## Workflow

1. **定位落位**：先按 `references/architecture.md` 的"落位决策表"确定新代码放哪个模块 / 包，不要凭直觉新建目录。
2. **写代码**：遵循 `references/code-conventions.md`；类级 Javadoc 一律 `描述 + @author dingyunwei`。
3. **同步 schema**：只要动了实体类或表结构，必须按 `references/schema-sync.md` 的流程回灌 `doc/sql/init.sql` + 写 `doc/sql/migrations/` 迁移。
4. **跑校验**：改完实体或 SQL 后必须跑两条命令，全绿才继续：

   ```bash
   python scripts/verify_schema.py   # 表/列 与 @TableName 实体类一一对应
   python scripts/verify_sql.py      # 括号配平 / 幂等性 / 引用完整性 / INSERT 列存在
   ```

5. **过一遍坑表**：提交前对照 `references/pitfalls.md` 逐条自查。
6. **同步文档**：新增协议 / 驱动 / 规则节点要同步 `README.md` 功能表与 `CHANGELOG.md` `[Unreleased]`。

## Required Constraints

- **JDK 25 / Spring Boot 4**：本项目**不是** bi-cashier 的 Boot2.7 / JDK8 技术栈，禁止套用 `remote-cashier-java-standard` 的规范与依赖版本。
- **实体改动必须回灌 `init.sql`**：`doc/sql/init.sql` 是新装部署唯一执行的 schema（`docker-compose.yml` 只把它挂到 `/docker-entrypoint-initdb.d`），**不会**自动执行 `migrations/`。只写迁移不回灌 = 新环境缺表。
- **`init.sql` 必须可重复执行**：建表用 `CREATE TABLE IF NOT EXISTS`，索引用 `CREATE INDEX IF NOT EXISTS`，`ALTER TABLE ADD COLUMN` 用 `ADD COLUMN IF NOT EXISTS`。
- **列名以实体类为准**：MyBatis-Plus 按 `@TableField(value=...)` 生成 SQL，表里列名对不上就是运行期 `column does not exist`。改列名要同步改建表语句、字段注释、种子 INSERT 三处。
- **`ProtocolDecoder` / `RuleNodeExecutor` / `DeviceTransport` 是扩展 SPI**：实现它们的新类要放在对应模块，且 `ProtocolDecoder` 与 `RuleNodeExecutor` 是**运行时按接口查找**的，注册方式见 `references/architecture.md`。
- **禁止 `last_value(*)`**：InfluxDB v3 的 `last_value()` 返回**写入顺序**而非时间最新的值，最新值查询必须保持逐属性 `ORDER BY time DESC LIMIT 1`。
- **许可证统一 Apache 2.0**：`LICENSE` / `README` / `CONTRIBUTING` / `ROADMAP` / 文档站页脚 / `OpenApiConfig` 六处必须一致，**不要**写 MIT。
- **不提交本地产物**：`.codegraph/`、`__pycache__/`、`node_modules/`、`dist/`、`.env`、`.codex/` 一律 gitignore；`AGENTS.md` / `CLAUDE.md` 是本地 AI 规则文件（已 gitignore），**公开文档不要链接它们**（会 404）。
- **不要顺手改用户的未提交改动**：工作区里出现非本任务产生的修改时，先说明再决定。**用显式 `git add <path>`，不要 `git add -A`** —— 用户常在同一 workspace 并行编辑，`-A` 会把对方未完成的改动一起扫进暂存区。
- **提交前确认索引与工作区一致**：`git mv` / 重命名类改动后，`git status --porcelain` 会显示 `RM`（已暂存重命名 + 工作区还有改动）。此时直接 commit 会提交出"文件名与类名不一致"的坏代码，必须先 `git add -A <目标路径>`。
- **批量改码必须先小样本验证**：脚本先在 2-3 个文件上跑，确认 diff 正确再全量；全量出错就整体回滚重做，不要逐个手补。改完跑 `references/bulk-edit.md` 的 5 项结构自检。

## Response Shape

每次按本 skill 改完 Java 后，回报：

- 落位说明：新代码放在哪个模块 / 包，理由（对应哪个 SPI 或分层职责）。
- schema 同步情况：是否改了实体 / 表；`init.sql` 与 `migrations/` 各改了什么；`verify_schema.py` / `verify_sql.py` 的运行结果。
- 文档同步情况：`README.md` / `CHANGELOG.md` 是否需要改、改了什么；`.planning/` 下是否有需要同步的旧名。
- 自检结论：`references/pitfalls.md` 中与本次相关的条目是否命中；批量改码时附结构自检结果。
