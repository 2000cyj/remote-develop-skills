# 入驻流程详情附件区移除设计

## 目标

移除入驻流程详情页中没有新增或编辑入口、始终为空的附件展示区，避免显示“附件 / 暂无附件”的无效内容。

## 范围

仅修改 `src/pages/storeAuditGrounding/addOrEdit/detail.vue`：

- 删除“附件”标题及其附件展示组件区块。
- 删除仅由该区块使用的附件数据、组件和类型引用。

不修改新增、编辑、详情 API、DTO、后端、数据库、其他审核流程页面或路由。

## 验证

在 `tests/storeAuditGrounding/contracts.test.ts` 添加源级断言，确认入驻流程详情页不再导入或渲染附件展示组件。执行定向 Vitest 测试与 cashier 生产构建。
