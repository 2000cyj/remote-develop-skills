# 权限机制与权限码命名

本文件是 `basics-button-permission-vue` 的机制背景与命名规范。先读它，再执行 SKILL.md 的 Workflow。

## 权限机制

1. 主应用经 qiankun 把 `buttonPermissions: string[]`（字符串数组）透传给子应用。
2. `micro/cashier/src/main.ts` 调用 `setButtonPermissions(buttonPermissions)` 存入模块级变量。
3. 页面里调用 `checkPermission('权限码')` 判断命中，命中则按钮显示。

权限码是**后端菜单配置下发**的字符串，前端只做 `includes` 匹配。**写错一个字母按钮就永远不显示。**

### 工具函数：`@/common/utils/permission`

```ts
// 单个权限码
checkPermission("yhkglInsert"): boolean
// 任一命中即 true（重载）
checkPermission(["yhkglInsert", "yhkglChange"]): boolean
// 设置 / 读取（仅 main.ts 初始化时用）
setButtonPermissions(list): void
getButtonPermissions(): string[]
```

> `checkPermission` **不是自动导入**，页面需显式 `import`。

## 权限码命名规范

格式：`{模块前缀}{操作后缀}`

### 操作后缀（固定 4 种）

| 后缀 | 含义 | 适用按钮 |
|---|---|---|
| `Insert` | 新增 | 新增 / 新建 / 新增子节点 / 弹窗创建 |
| `Check` | 查看 | 查看 / 详情（跳只读页或打开只读弹窗） |
| `Change` | 编辑 | 编辑 / 保存 / 修改 / 弹窗更新 |
| `Delete` | 删除 | 删除 / 批量删除 |

### 模块前缀 = 路由路径

前缀取页面路由 path（拼音首字母缩写）。**有路由用路由，没路由的新页面必须先向后端确认菜单码再写。**

### 现有模块前缀映射

| 模块目录 | 模块前缀 | 路由 path | 权限码示例 |
|---|---|---|---|
| bankCard（银行卡管理） | `yhkgl` | `/yhkgl` | `yhkglInsert` / `yhkglCheck` / `yhkglChange` / `yhkglDelete` |
| employee（员工信息） | `ryxx` | `/ryxx` | `ryxxInsert` / `ryxxCheck` / `ryxxChange` / `ryxxDelete` |
| company（公司管理） | `gsgl` | `/gsgl` | `gsglInsert` / `gsglCheck` / `gsglChange` / `gsglDelete` |
| seal（印章管理） | `yzgl` | `/yzgl` | `yzglInsert` / `yzglCheck` / `yzglChange` / `yzglDelete` |
| store（店铺管理） | `dpgl` | `/dpgl` | `dpglInsert` / `dpglCheck` / `dpglChange` / `dpglDelete` |
| businessScope（经营范围管理） | `jyfwgl` | （待定） | `jyfwglInsert` / `jyfwglChange` / `jyfwglDelete` |

> ⚠️ `two_level_id`（如 bankCard=yhgl、employee=yggl、businessScope=qtdgl）是**字典菜单分组**，与按钮权限码**不是一回事**，切勿混用。按钮权限码以上表为准。

## 多板块分级查看权限命名（company 范式）

一个页面内含多个板块 / tab，需要按板块细分查看权限时：

- 命名：`{前缀}Check{板块}`，如 `gsglCheckBasic` / `gsglCheckCapital` / ... / `gsglCheckFiles`；原整下拉共用的单个 `gsglCheck` 弃用。
- 板块映射在「列表页下拉」与「编辑页 tab」两处共用，集中放共享文件（company 放 `utils/companyEventBus.ts`，复用既有 `CompanyViewTab` 类型）。
