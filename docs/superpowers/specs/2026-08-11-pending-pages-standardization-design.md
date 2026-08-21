# 当前未提交页面规范化设计

## 1. 背景与目标

本次只处理 cashier 工作区当前未提交改动涉及的页面和组件，使其符合本项目已有的页面目录、Vue 3/TypeScript、自动导入、图标、权限和共享组件约定。目标是改善目录边界与可维护性，同时保持既有业务行为、API 语义和权限码不变。

## 2. 范围边界

纳入范围：

- `src/pages/store/**` 中当前未提交改动涉及的文件
- `src/pages/companyOffboarding/**`
- `src/pages/shopOnboarding/**`
- `src/pages/subAccountChangeLog/**`
- 当前新增的审核组件及其直接引用
- 上述文件直接关联的路由、类型、配置和启动脚本

明确排除：

- `src/layouts/**`、`src/pages/login/**`、`src/pages/error/**`、`src/pages/redirect/**`、`src/pages/dashboard/**`
- 与本次未提交改动无直接关系的历史模块
- 后端、数据库和 SQL
- Git commit、push 及其他发布操作

## 3. 目录设计

### 3.1 开户/销户页面

`companyOffboarding` 与 `shopOnboarding` 均保留 `index.vue` 作为列表入口，将新增、编辑、详情统一收拢到 `addOrEdit/`。详情文件移动后同步检查路由组件引用，但不改变路由 name、业务路径和权限码。

目标结构：

```text
<module>/
├── index.vue
├── addOrEdit/
│   ├── index.vue
│   └── detail.vue
├── apis/
├── components/
├── config/
├── enum/
└── utils/
```

### 3.2 store

仅由 `store/addOrEdit` 使用的 `ChangeInfoModal.vue`、`SubAccountEditor.vue` 下沉到 `store/addOrEdit/components/`。保持外部 props/emits 和业务时序；仅在现有调用链明确由共享弹窗管理生命周期时，移除内部 `el-dialog`，避免改变弹窗关闭和提交行为。

### 3.3 子账户变更记录

`subAccountChangeLog/index.vue` 只保留列表查询、筛选、分页和打开详情动作。详情展示从列表页内联逻辑拆到 `addOrEdit/detail.vue`，通过明确 props 接收列表已有数据；只有确认存在独立详情接口时才新增 API。

### 3.4 审核组件

按实际引用范围决定归属：仅一个业务模块使用的组件放入该模块 `components/`；多个目标模块共同使用的组件放入 `src/common/components/`。不保留无法体现边界的 `src/components/Audit*.vue` 散落结构。迁移后同步更新所有 import。

## 4. 代码规范调整

仅处理本次范围内的文件：

- 删除项目已配置自动导入的 Vue/Vue Router 手动导入。
- 删除图标组件 import，配置对象使用全局注册的 PascalCase 图标字符串。
- 将跨层级或页面私有类型放到当前模块合理的 `apis/type.ts`、`enum/` 或 `components/` 边界内。
- 保持现有权限码原样，只使用权限判断，不生成或改写后端菜单码。
- 保持 API 请求方法、响应 envelope、字段名和参数位置，不进行无依据的接口重命名。

## 5. 数据流与错误处理

页面列表、表单、详情沿用现有 API 和共享请求层。目录迁移不引入新的状态管理层。详情优先复用已有列表数据，避免重复请求；异步请求继续沿用现有 loading、消息提示和关闭逻辑。对弹窗提交结果保持现有 `boolean`/Promise 语义，不以结构重构改变成功或失败分支。

## 6. 验证方案

1. 结构验证：检查文件移动后的 import、路由、动态组件引用和菜单地址影响。
2. 定向 ESLint：只检查实际变更的 Vue/TS 文件，区分本次问题与全量非源码基线错误。
3. TypeScript 检查：记录共享包声明缺失等环境阻塞，不将阻塞误报为改动通过。
4. 构建：执行 cashier 构建并记录结果。
5. 测试：执行项目测试命令；当前无匹配测试文件时如实记录失败原因。
6. 工作区保护：保留原有未提交改动，不覆盖无关文件，不执行 commit/push。

## 7. 完成标准

- 当前范围内目录结构符合项目约定，路由和 import 无断链。
- 当前范围内不再存在重复的 Vue/Vue Router 自动导入或显式图标组件导入。
- 业务 API、权限码和用户流程保持不变。
- 定向静态检查与构建结果可解释；测试结果如实报告。
- 最终报告列出实际修改文件、验证命令、成功项和阻塞项。
