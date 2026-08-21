---
name: remote-permission-summary
description: Use when 把某目录下所有按钮操作权限汇总成结构化清单、扫描 checkPermission 调用点、补齐动态权限码、生成可执行 SQL，按模板产出 docs/权限/ 下的三个文件。
---

# Cashier Permission Summary

Read references/template-and-formats.md first.

## Workflow

1. **扫描权限码**：grep 目标目录下所有 `checkPermission('...')` 字面量；**动态引用**（如 `checkPermission(MAP.key)`）必须读映射常量补齐，否则漏码。
2. **按模块归类 + 提取语义**：每个权限码提取 `module` / `prefix` / `moduleName` / `buttonName` / `operation` / `location` / `description`（字段取法见 references/template-and-formats.md）。
3. **建目录 + 写固定模板**：创建 `<目标>/docs/权限/`，写入固定 `权限模板.sql`（内容逐字一致，勿改）。
4. **生成 package.json**：模块名作变量名 → 下挂非数组对象，每个 key=权限码，value=权限详情对象。
5. **生成 权限.sql**：用 references/sql-script.md 的 node 脚本，按「模板格式 + package.json」产出 INSERT 脚本。

## Required Constraints

- 权限码必须与后端菜单**逐字一致**；拿不准的 prefix / 模块名写进 `_meta.note` 标「需后端核对」，不要猜。
- 生成的 SQL 是**纯 INSERT，未去重**——库中已有同 `menu_id` 会主键冲突；需要幂等就改 `INSERT ... ON DUPLICATE KEY UPDATE` 或先 `DELETE` 再插。
- **动态权限码（变量引用）grep 不到**，务必读映射常量补齐，否则 `package.json` 会漏码。
- 三个文件都放 `docs/权限/`；`权限模板.sql` **逐字固定**，不要改。
- `menu_name` 里的中文**勿含半角单引号**，避免破坏 SQL 字符串。
- **动词映射**：新增→新增、查看→查看、**编辑→修改**、删除→删除；`查看 · 板块`→`查看（板块名）`；特殊码定制文案。

## Response Shape

- 报告 3 个产出文件的路径与统计（模块数、INSERT 条数）。
- 列出需后端核对的 prefix / 模块名。
- 标注补全的动态权限码（原 grep 不到、读映射常量补齐的）。
- 若需要幂等 SQL，说明已改用 `ON DUPLICATE KEY UPDATE`。
