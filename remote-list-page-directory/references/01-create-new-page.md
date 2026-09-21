# 目标 1：建新页面（从 0 到 1）

**适用场景**：用户要从 0 到 1 搭一个全新业务模块目录。读这一份就够。

> 底层知识：`references/directory-structure.md`（目录树原文）+ `references/file-responsibilities.md`（文件职责原文）。本目标文档是它们的**执行步骤版**。

## 步骤 1：建 7 项固定目录骨架

```bash
mkdir -p src/pages/<业务模块>/{addOrEdit,apis,components,config,enum,utils}
touch src/pages/<业务模块>/{index.vue,addOrEdit/.gitkeep,components/.gitkeep}
```

> **注意**：7 项固定目录名**即使为空也要保留**。`addOrEdit/` 和外层 `components/` 在初期为空时也要 `.gitkeep` 占位。

## 步骤 2：决定 addOrEdit 内文件形态

按 `mode` 由路由派生（`/xxx/insert` / `change` / `check`），或按文件区分（`add.vue` / `edit.vue` / `detail.vue`）。三种合法形态：

| 形态 | 文件结构 | 适用场景 |
|---|---|---|
| **三合一** | `addOrEdit/index.vue`（一个文件按 `mode` 区分） | 新增/修改/详情逻辑相近，避免重复 |
| **三个独立** | `addOrEdit/{add.vue, edit.vue, detail.vue}` | 三模式逻辑差异大 |
| **某两在一起** | `addOrEdit/{addOrEdit.vue, detail.vue}` 等任意组合 | 折中方案（最常见：add+edit 合并，detail 独立） |

## 步骤 3：决定 apis/components/config/enum/utils 归属

**这是最高频的判断点**，详细流程见 `references/04-shared-vs-private.md`。

简版决策树：

```
某个文件/组件/工具/接口
  │
  ├─ 被本业务块（列表页 + addOrEdit）多页面共用？
  │    └─ 是 → 放外层（共业务块）
  │
  └─ 仅当前页面（addOrEdit 或其内某文件）用？
       └─ 是 → 放当前目录内（独立内层）
```

## 步骤 4：填文件职责（参考 file-responsibilities.md）

| 目录 | 职责速记 |
|---|---|
| `index.vue` | `useListPage` + `PageVxeTable`；按 `uniqueValue` 定位 |
| `addOrEdit/*.vue` | `mode` 由路由派生；`DynamicForm` 分区块 |
| `apis/index.ts` | **业务主接口**放外层，**辅助下拉接口**按场景放外层或内层 |
| `apis/type.ts` | 对齐后端 DTO/VO；列表/详情共用 VO |
| `config/index.ts` | `getSearchFormItems` + `getTableColumns` 工厂 |
| `enum/index.ts` | 字典枚举 + 本地固定值兜底 |
| `utils/index.ts` | 状态 → el-tag 映射（`getXxxStatusTagType`）；纯函数 |
| `utils/confirm.ts` | 一行转发 `@/common/utils/confirmDelete` |
| `components/*.vue` | 弹窗无壳模式 + `renderDialog` + 暴露 `submit()` |

## 步骤 5：递归嵌套判断

如果新增/修改/详情页内还有嵌套表单页，**继续往里穿插一层 `addOrEdit`**，每层结构一致。详见 `references/05-nested-addoredit.md`。

## 输出格式

参见 SKILL.md 主入口 "Response Shape" 节。

## 反模式（不要做）

- ❌ 列表页和 addOrEdit 共用同一个 `index.vue`
- ❌ 把仅 addOrEdit 用的组件放外层 `components/`（除非有跨页面共用的明确证据）
- ❌ 7 项固定目录缺 1 项（即使是空目录也要保留）
- ❌ 用 `import/no-duplicates` 拆不开时硬塞同路径多 import（应当合并 import）
- ❌ 弹窗组件内部塞 `el-dialog`（应是弹窗无壳模式）