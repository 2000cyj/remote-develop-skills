# 目标 3：重构/迁移现有页面

**适用场景**：把不合规目录改成合规。**前置条件**：先走 `references/02-audit-page-compliance.md` 输出违规清单。

> 重构是**写动作**。审查只读，重构写——两个目标严格分离。

## 重构路径（按高频到低频）

### 路径 1：恢复 7 项固定目录（最常见）

**触发**：外层缺目录（如 `components/` 被 rmdir 误删）。

```bash
mkdir -p src/pages/<业务模块>/components
touch src/pages/<业务模块>/components/.gitkeep
```

### 路径 2：挪错位的组件/工具（高频）

**触发**：仅 addOrEdit 用的内容放外层。

```bash
# 例：SubAccountEditor 只被 addOrEdit 内 2 个 .vue 用
mkdir -p src/pages/<业务模块>/addOrEdit/components
git mv src/pages/<业务模块>/components/SubAccountEditor.vue \
       src/pages/<业务模块>/addOrEdit/components/
rmdir src/pages/<业务模块>/components  # 仅当迁移后外层空且确认无业务块共用组件
# 改 import："../components/X" → "./components/X"
```

> ⚠️ **不要在迁移后立刻 rmdir 外层 components/**——除非你已经确认外层**没有任何**业务块共用组件。按 7 项固定目录，**外层 components/ 即使为空也要保留**。

### 路径 3：补 `utils/confirm.ts`

**触发**：缺二次确认转发。

```ts
// src/pages/<业务模块>/utils/confirm.ts
import { confirmDelete } from "@/common/utils/confirmDelete"
export { confirmDelete }
```

调用方改造：
```ts
// 前
import { ElMessage, ElMessageBox } from "element-plus"
await ElMessageBox.confirm("确定删除该申请吗？", "删除确认", { type: "warning" })

// 后
import { confirmDelete } from "./utils/confirm"
if (!await confirmDelete("确定删除该申请吗？")) return
```

### 路径 4：挪辅助 API 到内层

**触发**：仅 addOrEdit/detail.vue 用的辅助下拉接口（如 `listAvailableCompanysApi`）放外层。

```bash
mkdir -p src/pages/<业务模块>/addOrEdit/apis
# 把 listAvailableCompanysApi + 对应 interface 移到 addOrEdit/apis/
```

调用方 import 改造：
```ts
// 前
import { deleteOnboardingApi, listAvailableCompanysApi } from "../apis"

// 后
import { deleteOnboardingApi } from "../apis"          // 外层共用
import { listAvailableCompanysApi } from "./apis"     // 内层独立
```

### 路径 5：合并仅 addOrEdit 内用的工具到 addOrEdit/utils/

**触发**：addOrEdit 根目录有零散 utility 文件（如 `detail-flow.ts`）。

```bash
# 把 detail-flow.ts 内容挪到 addOrEdit/utils/index.ts
mkdir -p src/pages/<业务模块>/addOrEdit/utils
# 内容合并到 addOrEdit/utils/index.ts
rm src/pages/<业务模块>/addOrEdit/detail-flow.ts
# import 改："./detail-flow" → "./utils"
```

### 路径 6：弹窗无壳模式改造（进阶）

**触发**：components/*.vue 内含 `el-dialog`。

⚠️ 这是较大改动——涉及契约变更（从 `openAdd` 改为 `submit()`）。**优先征求用户确认**，而非自动执行。

## 重构原则（Ponytail rung 6：最小必要修改）

1. **不要扩大范围**：只动违规项，不顺手改其他
2. **保留向后兼容**：过渡期可保留旧文件 re-export；但最终清理时不要留 re-export 残留
3. **批量改 import**：用脚本批量替换，避免手动失误
4. **改完跑 ESLint**：每个改动完成后跑 `npx eslint src/pages/<业务模块>` 验证

## 重构验证清单

- [ ] ESLint 0 errors（warnings 可保留 HTML 格式类）
- [ ] 调用方所有 import 路径已更新
- [ ] 没有空文件残留
- [ ] 目录结构符合 7 项固定
- [ ] 重复审查（走 `references/02-audit-page-compliance.md` 验证）

## 输出格式

```
## 重构执行：[业务模块名]

### 已整改
1. [违规项] —— [改动位置] —— [改动内容]

### 跳过（如有）
1. [跳过原因] —— [建议何时再处理]

### 验证
- ESLint: 0 errors / N warnings
- 7 项固定目录: ✅ 齐全
```

## 反模式（不要做）

- ❌ 不走审查就直接动手改（违反前置条件）
- ❌ 把"建议优化"项也一并改了（应该等需求确认）
- ❌ rmdir 看似空的目录（违反 7 项固定目录名硬约束）
- ❌ 改 1 个文件但顺手改 5 个无关文件（违反最小必要修改）