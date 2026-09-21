# 目标 5：递归嵌套 addOrEdit

**适用场景**：表单页内还有嵌套表单页（例：列表页选主体 → 弹出"主体详情"→ "主体详情"内还能编辑某个字段——这就有 2 层 addOrEdit）。

## 何时需要嵌套

**触发条件**：业务上"表单页里有另一个表单页"——通常是：
- 列表选 → 详情查看 → 详情内有可编辑字段 → 弹"子表单"
- 主表 + 明细表，明细行可单独编辑

**反例**（不要嵌套）：
- 单层 addOrEdit 即可完成
- 没有"在表单页里又打开表单"的真实场景

## 嵌套结构

每层 `addOrEdit` 与外层**结构一致**——7 项可重复：

```
src/pages/<业务模块>/                  ← 第 0 层（业务模块）
└── addOrEdit/                         ← 第 1 层 addOrEdit
    ├── index.vue | add.vue | detail.vue
    └── addOrEdit/                     ← 第 2 层 addOrEdit（嵌套）
        ├── <子表单>.vue
        ├── apis/                      ← 子表单独立接口
        ├── components/                ← 子表单独立组件
        ├── config/                    ← 子表单独立配置
        ├── enum/                      ← 子表单独立枚举
        └── utils/                     ← 子表单独立 utility
```

## 嵌套 addOrEdit 内的归属判断

**仍然走 `references/04-shared-vs-private.md` 决策树**，但"业务块"范围缩窄到**当前嵌套 addOrEdit**：

```
第 2 层 addOrEdit 内的某文件 X
  │
  ├─ 被第 2 层 addOrEdit 多文件共用？
  │
  ├─ 被第 1 层 addOrEdit 共用？
  │    └─ 是 → 提到第 1 层（addOrEdit 内层）
  │
  └─ 仅第 2 层单文件用？
       └─ 是 → 放第 2 层 addOrEdit 自己的当前目录
```

**注意**：第 2 层的 `apis/` `components/` `config/` `enum/` `utils/` 与第 1 层同名但**目录隔离**——不会冲突。

## 嵌套深度

**深度建议 ≤ 2 层**。3 层及以上意味着业务过深，需要重新设计信息架构。

## 嵌套的路由

每层 addOrEdit 需要独立路由：
- 第 1 层：`/xxx/insert` / `/xxx/change` / `/xxx/check`
- 第 2 层：`/xxx/{insert|change|check}/child/{insert|change|check}`

或通过路由嵌套父子关系实现（参考 vue-router nested routes）。

## 实战案例

StoreAuditOnboarding 当前**无嵌套**——`addOrEdit/` 下没有 `addOrEdit/` 子目录。如未来业务有"详情页内嵌店铺编辑"，可按本规则嵌套。

## 反模式（不要做）

- ❌ 嵌套超过 2 层（业务过深信号）
- ❌ 把第 2 层 addOrEdit 的文件混在第 1 层（破坏隔离）
- ❌ 第 2 层 addOrEdit 的 apis 暴露给第 1 层（破坏封装）
- ❌ 用"嵌套 addOrEdit"实现"详情页弹 Modal"的弹窗场景——这种场景用 `components/` + renderDialog 弹窗无壳模式（见 file-responsibilities.md）