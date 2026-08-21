# 产出物格式与固定模板

本文件是 `remote-permission-summary` 的产出物格式说明。SKILL.md Workflow 第 2~5 步按需使用。

## 产出物（目标目录/docs/权限/ 下，共 3 个）

| 文件 | 来源 |
|---|---|
| `权限模板.sql` | **固定内容**，所有目录逐字一致（见下文） |
| `package.json` | 扫描目录里的 `checkPermission` 调用，按模块结构化整理 |
| `权限.sql` | 由「模板格式 + package.json」生成的 INSERT 脚本 |

## 固定模板内容（权限模板.sql，逐字一致，勿改）

```sql
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwgl', '经营范围管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwglInsert', '经营范围管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwglChange', '经营范围管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwglDelete', '经营范围管理 - 删除', 0, 1);
```

模板揭示的格式约定：

- 表/列：`bi_sys.sys_menu_permission (two_level_id, menu_id, menu_name, if_public_view, tenant_id)`
- **模块行**：`two_level_id = menu_id = 前缀`，`menu_name = 模块中文名`
- **权限行**：`two_level_id = 前缀`，`menu_id = 权限码`，`menu_name = "模块名 - 动词"`
- `if_public_view=0`、`tenant_id=1`
- Change 类 `menu_name` 用 **「修改」**（不是「编辑」）

## 语义提取字段

| 字段 | 取法 |
|---|---|
| `module` | 页面目录名（变量名，如 `bankCard`） |
| `prefix` | 码公共前缀（如 `yhkgl`）= 路由 path 去斜杠 |
| `moduleName` | 模块中文名，取自页面 `@Description` / `defineOptions` / 路由 title |
| `buttonName` | 按钮文案，取自 `<el-button>` 文本 |
| `operation` | 新增/查看/编辑/删除/特殊（码后缀 + 按钮语义判断） |
| `location` | UI 位置（列表页顶部/行操作/编辑页 tab…） |
| `description` | 一句话说明 |

拿不准的 prefix / 模块名不要猜，写进模块 `_meta.note` 标注「需后端核对」。

## package.json 结构

模块名作变量名 → 下挂非数组对象，每个 key=权限码，value=权限详情对象：

```json
{
  "_meta": {
    "说明": "...",
    "生成范围": "<目标目录> 下所有 checkPermission 调用点",
    "操作类型说明": "新增=Insert / 查看=Check / 编辑=Change / 删除=Delete / 特殊=...",
    "权限码总数": N,
    "模块数": M,
    "配套规范": "remote-button-permission/SKILL.md",
    "权限机制": "主应用经 qiankun 透传 buttonPermissions[]，子应用 setButtonPermissions 存储，页面用 checkPermission('码') 匹配"
  },
  "<module>": {
    "_meta": { "moduleName": "...", "routePath": "/xxx", "prefix": "xxx", "page": "...", "note?": "..." },
    "<权限码>": { "buttonName": "...", "permissionCode": "...", "operation": "...", "location": "...", "description": "..." }
  }
}
```

## 动词映射

新增→新增、查看→查看、**编辑→修改**、删除→删除；`查看 · 板块`→`查看（板块名）`；特殊码定制文案（如 `ryxxIdCard`→`查看身份证完整号`）。
