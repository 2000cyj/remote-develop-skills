# 代码模式与自检清单

本文件是 `remote-button-permission` 的代码落地示例。SKILL.md Workflow 第 3~6 步按需使用。

## 基本按钮 v-if

```vue
<script setup lang="ts">
import { checkPermission } from "@/common/utils/permission"
</script>

<template>
  <!-- 顶部新增 -->
  <el-button v-if="checkPermission('xxxInsert')" type="primary" :icon="Plus" @click="handleAdd">
    新增
  </el-button>

  <!-- 行操作 -->
  <el-button v-if="checkPermission('xxxCheck')" link type="primary" :icon="View" @click="handleView(row)">
    查看
  </el-button>
  <el-button v-if="checkPermission('xxxChange')" link type="primary" :icon="Edit" @click="handleEdit(row)">
    编辑
  </el-button>
  <el-button v-if="checkPermission('xxxDelete')" link type="danger" :icon="Delete" @click="handleDelete(row)">
    删除
  </el-button>
</template>
```

## el-dropdown 空菜单兜底

`el-dropdown-item` 各自加 `v-if` 后，若用户没有任何一项权限，下拉触发器（"⋯"）还在但菜单是空的——**这是 bug**。必须加计算属性隐藏整个触发器：

```ts
// 节点操作权限：任一可用时才展示「更多」菜单
const hasNodeAction = computed(
  () => checkPermission("xxxInsert") || checkPermission("xxxDelete")
)
```

```vue
<el-dropdown v-if="hasNodeAction" trigger="click" @command="...">
  <el-button link :icon="MoreFilled" @click.stop />
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item v-if="checkPermission('xxxInsert')" command="addChild" :icon="Plus">
        新增子节点
      </el-dropdown-item>
      <el-dropdown-item v-if="checkPermission('xxxDelete')" command="delete" :icon="Delete" divided>
        <span style="color: #f56c6c;">删除节点</span>
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

> 行内独立按钮（如 `PageVxeTable` 的 `#customAction` slot）各自 `v-if` 即可；但「操作列」本身需按下述隐藏。

## 列表页操作列按行权限隐藏

`PageVxeTable` 的「操作」列由 `getTableColumns()` 固定返回。行内按钮各自 `v-if` 后，若查看/编辑/删除**全无权限**，操作列会变成一列空单元格——**这是 bug**，必须让操作列按行权限条件渲染。

**config 层**：`getTableColumns` 加可选参数，操作列条件 push：

```ts
export function getTableColumns(options?: { showAction?: boolean }): VxeGridPropTypes.Columns<XxxEntity> {
  const columns: VxeGridPropTypes.Columns<XxxEntity> = [
    /* 非操作列... */
  ]
  if (options?.showAction !== false) {
    columns.push({
      title: "操作",
      width: 220,
      fixed: "right",
      slots: { default: "customAction" }
    })
  }
  return columns
}
```

**index.vue 层**：用计算属性聚合行权限，驱动 `showAction`：

```ts
// 行操作权限：查看/编辑/删除任一可用时才展示「操作」列
const hasRowAction = computed(
  () =>
    checkPermission("xxxCheck")
    || checkPermission("xxxChange")
    || checkPermission("xxxDelete")
)
const tableColumns = computed(() => getTableColumns({ showAction: hasRowAction.value }))
```

## 多板块分级查看权限（company 范式）

**列表页（下拉入口）**

- 下拉项用计算属性过滤渲染——不要 `v-for` 与 `v-if` 同元素（Vue 3 中 `v-if` 优先级更高，取不到循环变量 `t`）：

```ts
const visibleViewTabs = computed(() => VIEW_TABS.filter(t => checkPermission(t.perm)))
const hasCheckAny = computed(() => visibleViewTabs.value.length > 0)
```

- 下拉触发器 `v-if="hasCheckAny"`（任一板块可看才显示）。
- 操作列隐藏条件：`hasCheckAny || Change || Delete`（查看部分取「任一板块命中」）。

**编辑 / 详情页（tab 页签）**

- 每个 `el-tab-pane` 加 `v-if="checkPermission(COMPANY_TAB_PERM.<key>)"`：无权限的板块**整页签隐藏**。
- `activeTab` 兜底：默认 / 当前 tab 被隐藏时回退到第一个可见 tab：

```ts
const visibleTabs = computed(() =>
  (Object.keys(COMPANY_TAB_PERM) as CompanyViewTab[]).filter(k => checkPermission(COMPANY_TAB_PERM[k]))
)
watch(
  visibleTabs,
  (tabs) => {
    if (tabs.length && !tabs.includes(activeTab.value as CompanyViewTab)) {
      activeTab.value = tabs[0]
    }
  },
  { immediate: true }
)
```

## ESLint 注意

- 项目 `style/operator-linebreak`：多行 `||` / `&&` 必须放在**行首**，不能放行尾。
- `import/consistent-type-specifier-style` 禁止内联 `type`：类型用单独的 `import type { X }`；perfectionist 还要求 `type` import 排在 `value` import 前。
- 改完跑一次 `eslint --fix` 自动排序最稳。

## 自检清单

- [ ] 权限码前缀已与后端菜单核对一致
- [ ] 所有业务按钮已加 `v-if="checkPermission(...)"`
- [ ] 下拉菜单在「所有项均无权限」时触发器已隐藏
- [ ] 列表页操作列在「查看/编辑/删除全无权限」时已隐藏（config `showAction` + `hasRowAction`）
- [ ] 非业务按钮（搜索 / 取消 / 分页）未被错误鉴权
- [ ] `checkPermission` 已显式 import
- [ ] 无 ESLint unused 告警（计算属性被模板使用）
