# Schema 与实体类同步

## 为什么要同步

`docker-compose.yml` 把 `./doc/sql` 挂到 `/docker-entrypoint-initdb.d`，但 PostgreSQL **只执行该目录下的顶层文件**——也就是 `init.sql`。`migrations/` 是子目录，**不会自动跑**。

所以：

- **新装部署** → 只跑 `doc/sql/init.sql`
- **存量升级** → 手动按文件名顺序跑 `doc/sql/migrations/*.sql`

结论：**只写迁移不回灌 `init.sql`，新环境必然缺表。** 本项目曾因此在 2026-07 之后积累 16 张表未回灌，导致仪表板 / OTA / Modbus / Webhook / 设备影子 / 审计 / 分组 / IM 推送 / OPC UA 等功能在新环境全部报错。

## 标准流程（动了实体或表就必须走）

1. **改实体**：新增 / 修改 `iot-server/entity/Xxx.java`
   - 表名 `@TableName("tb_xxx")`，主键 `@TableId(value = "id", type = IdType.AUTO)`
   - 时间戳继承 `BaseEntity`（`create_time` / `update_time`，`FieldFill` 自动填充）
   - 列名用 `@TableField(value = "snake_case")` 显式声明

2. **写迁移**：新增 `doc/sql/migrations/YYYYMMDD_NNN_description.sql`
   - 命名 `日期_序号_描述.sql`，序号解决同一天多个迁移的排序
   - 用 `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
   - 同步写 `COMMENT ON TABLE` 与 `COMMENT ON COLUMN`
   - 更新 `doc/sql/migrations/README.md` 的索引表（**不要**只写文件不更新索引）

3. **回灌 `init.sql`**：把迁移里的 DDL 追加进 `doc/sql/init.sql`，并在文件内注明来源迁移文件名

4. **补种子数据**：改了列名要同步改建表语句、`COMMENT ON COLUMN`、以及**所有引用该列的 `INSERT` 语句**（列清单 + 值都要改，删一列要同时删第 N 个值）

5. **跑校验**：

   ```bash
   python scripts/verify_schema.py   # 表/列 与 @TableName 实体类一一对应
   python scripts/verify_sql.py      # 括号配平 / 幂等性 / 引用完整性 / INSERT 列存在
   ```

   两个脚本都是零依赖 Python，直接进 CI。

6. **改实体映射时**：`@TableField(value = "\"name\"")` 这种带转义引号的写法会让脚本解析失真，**新代码不要这么写**，直接 `"name"`。

## `verify_schema.py` 检查什么

- 实体 `@TableName` 集合 vs SQL `CREATE TABLE` 集合，双向比对（谁多谁少都报）
- 列名逐表比对：实体有表无 / 表有实体无
- 解析陷阱已处理：嵌套静态类字段（如 `RuleChain.RuleNode` 的 `x`/`y`）不算表列；`static` 常量不算；`extends BaseEntity` 才补 `create_time`/`update_time`

## `verify_sql.py` 检查什么

- 括号配平、语句可切分
- 幂等性：`CREATE TABLE` 有 `IF NOT EXISTS` 或前置 `DROP`；`CREATE INDEX` 有 `IF NOT EXISTS`；`ALTER TABLE ADD COLUMN` 有 `IF NOT EXISTS`
- 引用完整性：索引 / 约束 / 外键指向的表必须存在
- 每张表有主键
- **`INSERT` 语句的列名必须存在于建表语句** —— 这一项能抓出"删了列但忘了改种子数据"

## 增量迁移的坑

- **`ALTER TABLE ... ADD COLUMN` 在 PG 里没有 `IF NOT EXISTS`**，必须写成 `ADD COLUMN IF NOT EXISTS`，否则重复执行直接报错。
- **新增非空列带默认值**：给已有表加 `NOT NULL` 列必须给 `DEFAULT`，否则存量行迁移失败。
- **表已存在时的列漂移**：线上库可能同时存在旧列名和新列名（如 `parentid` 与 `parent_id`），迁移只加不减；`init.sql` 面向新装，只保留实体映射的那一列。

## 实体 ↔ 表 的常见漂移

| 现象 | 后果 | 修法 |
|---|---|---|
| 表里列名是 `parentid`，实体映射 `parent_id` | 运行期 `column does not exist` | 改建表语句 + 注释 + 种子 INSERT |
| 表里多一列实体没有（如 `status`） | 插入时走默认值，无害但属死列 | 确认无引用后删列 + 改种子 INSERT |
| 实体多一列表没有 | 运行期 `column does not exist` | 表补列 或 删实体字段 |
| 实体缺 `@TableId` 而表有 `id` 主键 | MP 建模不完整，按主键查询会出问题 | 实体补 `@TableId(value = "id", type = IdType.AUTO)` |
