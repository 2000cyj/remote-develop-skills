# 已知坑与自检表

本清单来自对 simple-iot 代码库的实际排查与验证，**每条都给出定位与判据**。改代码前扫一遍，提交前再扫一遍。

## P0 — 会让新环境直接跑不起来

### 1. `init.sql` 未回灌迁移

- **现象**：新装部署后仪表板 / OTA / Modbus / Webhook / 设备影子 / 审计 / 分组标签 / IM 推送 / OPC UA 等接口报 relation does not exist
- **根因**：`init.sql` 自 2026-07 后没跟着迁移更新，缺 16 张表
- **判据**：`python scripts/verify_schema.py` 报"实体引用但 SQL 缺失"
- **修法**：见 `schema-sync.md`

### 2. 列名与实体映射漂移

- **现象**：运行期 `column does not exist`
- **实例**：实体 `Device` 映射 `parent_id`（网关-子设备拓扑），表里却是旧的 `parentid`
- **判据**：`verify_schema.py` 的列级比对
- **注意**：改列名要同步改建表语句、`COMMENT ON COLUMN`、**所有引用该列的 INSERT**（列清单和值都要改）

### 3. `init.sql` 不可重复执行

- **现象**：第二次跑 `init.sql` 在 `tb_rule_chain` 处报 already exists
- **根因**：追加段的建表语句没加 `IF NOT EXISTS`
- **判据**：`verify_sql.py` 的幂等性检查
- **修法**：`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`

### 4. 种子 INSERT 引用了已删除的列

- **现象**：删了表里的列却忘了改 `INSERT` → 脚本运行期报错
- **判据**：`verify_sql.py` 的 "INSERT 列存在性" 检查

## P1 — 逻辑 / 性能陷阱

### 5. InfluxDB v3 的 `last_value()` 返回写入顺序

- **错法**：把逐属性 `ORDER BY time DESC LIMIT 1` 换成单次 `last_value(*)`
- **真相**：v3 的 `last_value()` 返回**写入顺序**而非**时间最新**，会拿到旧值
- **约束**：最新值查询保持逐属性查；真要优化走 Caffeine 短 TTL 缓存，**不要**回退 `last_value(*)`
- **来源**：仓库 `doc/WORK_PLAN.md` 1.2 的实测记录（注：该文件已从仓库移除，结论保留在此）

### 6. `DeviceTransport` 双份定义（同包名跨模块）

- `iot-common/iot-core` 与 `iot-server` 各有一个 `com.github.dingdaoyi.core.driver.DeviceTransport`
- server 版多出 `reload()` / `addDriver()` / `removeDriver()`，在 classpath 上遮蔽 common 版
- 现有 TCP / MQTT / HTTP 三个传输实现的是 **server 版**
- **后果**：从 common 侧实现驱动会拿到缺方法的接口
- **约束**：新驱动一律实现 **iot-server** 那份；不要在 common 侧再复制一份

### 7. `HttpDeviceTransport` 是空壳

- `start()` / `stop()` 只翻转 boolean，无逻辑；真正的 HTTP 接收走 `HttpDriverController`
- `DeviceTransportManager` 会把它记为"驱动已启动"，产生虚假状态

### 8. OPC UA 是轮询不是订阅，且连接不复用

- `OpcUaPollingService` 用 `scheduleAtFixedRate` + 逐节点 `readValue`（N 节点 N 次往返）
- **`poll()` 内部每次都 `createClient()` 新建 `OpcUaClient`**
- 需要长连时应把 client 提到轮询外缓存复用

### 9. `driver-sdk` 不在构建里

- 根 `pom.xml` 的 `<modules>` 只有 `iot-server` / `iot-common` / `iot-driver`
- `driver-sdk/` **不是**真 Maven archetype（缺 `archetype-metadata.xml` / `archetype-resources`）
- 改它不影响主构建；`mvn verify` 不编译它

### 10. `PushLog` 类实体缺 `@TableId`

- 表 `tb_push_log` 有 `id SERIAL PRIMARY KEY`，实体却没有 `@TableId` 字段
- 当前只做 insert + 条件查询所以没爆，按主键查询就会出问题
- **约束**：新增实体一律带 `@TableId(value = "id", type = IdType.AUTO)`

### 11. GraalVM 脚本协议全权限执行

- `ScriptProtocolDecoder` 用 `allowAllAccess(true)`，脚本拿到完整系统权限
- 脚本来自数据库字段（`Protocol.scriptContent`），谁能改协议谁就能执行任意代码
- 加固方向：受限权限 / 脚本白名单 / 执行超时

## P2 — 文档 / 配置一致性

### 12. 许可证声明散落多处

- `LICENSE` 是 **Apache 2.0**，但历史上 `ROADMAP.md` / 文档站页脚（`docs/.vitepress/config.mjs`）/ `OpenApiConfig.java` 写过 **MIT**
- **约束**：六处一起改，别只改一处

### 13. 公开文档链接了被 gitignore 的文件

- `AGENTS.md` / `CLAUDE.md` 是本地 AI 协作规则，已在 `.gitignore` 里
- `README.md` / `README.zh-CN.md` / `CONTRIBUTING.md` 曾链接它们 → 公开仓库点开 404
- **约束**：对外文档只链接**已入库**的文件

### 14. 已下线的依赖仍在教人使用

- `dwyl-ui` 早已从 `iot-web/package.json` 移除、代码零引用
- 但 `iot-web/STYLE_GUIDE.md` 整节在教用 `<DwTable>` / `<dw-select>` / `import { dwHooks } from 'dwyl-ui'`
- **约束**：删依赖必须同步改 `STYLE_GUIDE.md`，否则贡献者照着写就报错

### 15. 过期数字散落在文档里

- 测试数量、规则节点数量、表数量、成熟度百分比各文档各写一份，天然会漂移
- 实测基线（2026-11）：**45 个测试文件 / 167 个 `@Test` 用例 / 15 种规则节点 / 35 张表**
- **约束**：改了这几个数字后，全仓库搜一遍再提交

### 16. 文档里指向不存在的文件

- `ROADMAP.md` 曾链接 `UI-DESIGN.md`（该文件不存在）
- **约束**：改文档后跑一次链接可达性检查（解析 markdown 链接 + `os.path.exists`）

### 17. 根目录混入内部工作文档

- 一次性审查报告、Sprint 排期这类内部产物放在根目录，会让外部用户误读成"待修问题清单"
- **约束**：根目录只留对外文档（README / CHANGELOG / CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / ROADMAP）；内部产物挪走或删掉

## 提交前自检清单

- [ ] `python scripts/verify_schema.py` 全绿
- [ ] `python scripts/verify_sql.py` 全绿
- [ ] 动了实体 → `init.sql` 与 `migrations/` 都已同步
- [ ] 许可证六处一致（Apache 2.0）
- [ ] 新增对外链接的目标文件**已入库**且存在
- [ ] 测试数 / 规则节点数 / 表数等数字已同步
- [ ] 没有把用户未提交的改动一起 `git add`
- [ ] 没有把 `.codegraph/` `__pycache__/` `node_modules/` `dist/` 提交进去
