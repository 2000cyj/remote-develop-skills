# Quick Reference（一页查表）

**适用场景**：日常查表用，不必读完整 SKILL.md。

## 7 项固定目录（必须齐全）

```
src/pages/<业务模块>/
├── index.vue          ← 列表页
├── addOrEdit/         ← 新增/修改/详情
├── apis/              ← 接口
├── components/        ← 组件（即使空也要保留）
├── config/              ← 列表配置
├── enum/              ← 字典/枚举
└── utils/             ← 工具（含 confirm.ts）
```

> 缺任意一项 = **规范违规**——即使为空也要 mkdir + .gitkeep。

## addOrEdit 内文件形态

| 形态 | 文件结构 | 适用 |
|---|---|---|
| 三合一 | `addOrEdit/{addOrEdit.vue 或 index.vue}` | 三模式逻辑相近 |
| 三独立 | `addOrEdit/{add.vue, edit.vue, detail.vue}` | 逻辑差异大 |
| 某两在一起 | `addOrEdit/{addOrEdit.vue, detail.vue}` 等 | 折中 |

## 归属决策（高频）

| 文件类型 | 归属 | 示例 |
|---|---|---|
| 业务主接口 | 外层 `apis/` | `pageOnboardingApi` / `createOnboardingApi` |
| 跨页面接口 | 外层 `apis/` | `deleteOnboardingApi` |
| 辅助下拉接口 | 内层 `addOrEdit/apis/` | `listAvailableCompanysApi` |
| 业务主类型 | 外层 `apis/type.ts` | `AuditApplicationListVO` |
| 辅助下拉类型 | 内层 `addOrEdit/apis/type.ts` | `AssignableCompany` |
| 业务块共用组件 | 外层 `components/` | `SubAccountManager`（store 模块） |
| 仅 addOrEdit 用组件 | 内层 `addOrEdit/components/` | `SubAccountEditor` |
| 列表配置 | 外层 `config/` | `getSearchFormItems` |
| 字典枚举 | 外层 `enum/` | `AUDIT_STATUS` |
| 状态映射 util | 外层 `utils/` | `getStatusTagType` |
| 二次确认 | 外层 `utils/confirm.ts` | 一行转发 confirmDelete |
| 页面级 utility | 内层 `addOrEdit/utils/` | `createOperationIdStore` |

## 弹窗无壳模式契约

```ts
// ✅ 正确
defineExpose({ submit: () => Promise<boolean> })

// ❌ 违规：组件内含 el-dialog
<el-dialog>...</el-dialog>
```

## 命令

```bash
# 补外层空目录
mkdir -p src/pages/<业务模块>/components
touch src/pages/<业务模块>/components/.gitkeep

# 补 utils/confirm.ts
cat > src/pages/<业务模块>/utils/confirm.ts << 'EOF'
import { confirmDelete } from "@/common/utils/confirmDelete"
export { confirmDelete }
EOF
```

## 验证

```bash
# 7 项固定目录检查
ls src/pages/<业务模块>/

# ESLint
npx eslint src/pages/<业务模块> --ext .vue,.ts

# 重复审查
cat references/02-audit-page-compliance.md
```

## 输出格式（所有目标）

- 列出新建/改动的目录树
- 标注每个 apis/components/config/enum/utils 是外层还是内层
- 说明 addOrEdit 文件形态
- 区分三类结论（必须整改/建议优化/无需修改）

## 反模式（速记）

- ❌ 缺 7 项任意一项
- ❌ 列表页和 addOrEdit 共用 index.vue
- ❌ 把仅 addOrEdit 用的放外层
- ❌ 弹窗组件含 el-dialog
- ❌ 弹窗组件未暴露 submit()
- ❌ 工具用 try/catch + ElMessageBox.confirm（应改 confirmDelete）
- ❌ 建议优化项下发为必须整改
- ❌ import 同一路径多次（应合并）