# 目标 2：审查现有页面合规性

**适用场景**：检查某业务模块目录是否完全合规，输出**违规清单 + 分类结论**。

> 本目标是**只读审查**，不要擅自修改代码。所有整改动作见 `references/03-refactor-page.md`。

## 检查清单（按 7 项固定目录逐项）

### 检查 1：7 项目录是否齐全

```
src/pages/<业务模块>/
├── index.vue          ← 列表页（必须）
├── addOrEdit/         ← 新增/修改/详情（必须）
├── apis/              ← 接口（必须，目录名固定）
├── components/        ← 组件（必须，目录名固定；空目录也要保留）
├── config/              ← 列表配置（必须）
├── enum/              ← 字典/枚举（必须）
└── utils/             ← 工具（必须，含 confirm.ts）
```

**违规标志**：
- ❌ 缺 `index.vue`（列表页放错位置）
- ❌ 缺 addOrEdit（把表单页直接放外层）
- ❌ **缺任意一项固定目录**（即使空也要保留——见下方补足方法）
- ❌ 多出额外目录名（如 `constants/` `helpers/` `models/` 等不固定目录名）

**补足方法**：
```bash
mkdir -p src/pages/<业务模块>/components
touch src/pages/<业务模块>/components/.gitkeep
```

### 检查 2：列表页 vs 表单页分离

- ✅ 列表页只放 `index.vue`
- ❌ 把新增/修改/详情页放外层（必须放 `addOrEdit/` 内）

### 检查 3：addOrEdit 内文件形态

| 形态 | 文件结构 |
|---|---|
| 三合一 | `addOrEdit/{addOrEdit.vue 或 index.vue}`（一个文件按 `mode` 区分） |
| 三个独立 | `addOrEdit/{add.vue, edit.vue, detail.vue}` |
| 某两在一起 | 任意两文件（如 `addOrEdit.vue` + `detail.vue`） |

**违规标志**：
- ❌ 出现 4 个及以上独立文件（违反"某两在一起"的最简原则）—— 应评估是否可以三合一或拆三独立

### 检查 4：apis 归属判断（高频）

走 `references/04-shared-vs-private.md` 的决策树。**关键违规**：
- ❌ 业务主接口（如 `pageXxxApi` / `createXxxApi`）放进 addOrEdit 内层
- ❌ 仅 addOrEdit 用的辅助下拉接口（如 `listAvailableCompanysApi`）放外层（污染业务块共用）

### 检查 5：components/config/enum/utils 归属

同 apis，按 `references/04-shared-vs-private.md`。

**特别注意 `utils/confirm.ts`**：每个模块必须有（除非完全没有删除操作）—— 一行转发 `@/common/utils/confirmDelete`。

### 检查 6：components/*.vue 弹窗无壳模式

```ts
// ✅ 正确：内容不含 el-dialog，暴露 submit()
defineExpose({ submit })

// ❌ 违规：组件内含 el-dialog
<el-dialog>...</el-dialog>
```

### 检查 7：数据流契约（参考 file-responsibilities.md）

- 列表/详情/编辑/删除全按业务唯一流水号 `uniqueValue`，不用自增 `id`
- 列表/详情共用 VO（一个类型两用）
- 配置与视图分离：表格列/搜索项全部工厂化
- 下拉选项由 `index.vue` 异步注入（不是写死）

## 结论分类（必填）

按 `references/06-product-boundary.md` 严格区分三类：

| 结论 | 何时使用 | 是否下发 |
|---|---|---|
| **必须整改（规范违规）** | 检查清单明确判定为不合规 | ✅ 直接下发整改 |
| **建议优化（需需求确认）** | 不影响现有流程但有改进空间 | ⚠️ 等用户确认 |
| **无需修改（已符合规范）** | 当前实现合规 | ❌ 不动 |

## 输出格式（审查报告）

```
## 审查结论：[业务模块名]

### 必须整改（X 项）
1. [违规项] —— [违规位置] —— [整改建议]
2. ...

### 建议优化（Y 项，待需求确认）
1. [建议项] —— [潜在影响] —— [需确认的内容]
2. ...

### 无需修改（Z 项）
1. [合规项]
2. ...
```

## 反模式（不要做）

- ❌ 把"建议"标注为"必须整改"（混淆规范结论）
- ❌ 把产品建议（如"加个 Tab"）混入目录规范违规清单
- ❌ 审查同时擅自修改代码（本目标是只读）