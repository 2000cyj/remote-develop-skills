# 目标 4：判断 apis/components/config/enum/utils 归属（最高频）

**适用场景**：每次新建/重构都要判断某个文件/接口/组件/工具该放外层还是内层。本文档是**最高频的目标**，单独抽出。

> 底层规则："共用放外层，独立放当前"。本文档是它的**决策流程版**。

## 决策树（强记）

```
某文件 X（API / component / util / interface / config）
  │
  ├─ grep 全部调用方：
  │    - 是否被本业务块多页面共用？（列表页 + addOrEdit）
  │    - 是否被业务块外部其他模块共用？（如被 AccountChangeDetails 等）
  │
  ├─ 共用 → 放外层（业务块共用）
  │
  └─ 仅当前目录内单文件/少数文件用 → 放当前目录（独立内层）
```

## 场景化判定表

| 文件类型 | 判定要点 | 归属决策 |
|---|---|---|
| **业务主接口**（如 `pageOnboardingApi` / `createOnboardingApi` / `approveOnboardingApi`） | 列表页或 addOrEdit 多处用 | **外层** `apis/` |
| **辅助下拉接口**（如 `listAvailableCompanysApi`） | 仅 addOrEdit/detail.vue 用 | **内层** `addOrEdit/apis/` |
| **跨页面接口**（如 `deleteOnboardingApi` 被列表页 + detail.vue 都用） | 跨页面 | **外层** `apis/` |
| **业务主类型**（如 `AuditApplicationListVO` / `OnboardingItem`） | 列表/详情共用 VO | **外层** `apis/type.ts` |
| **辅助下拉类型**（如 `AssignableCompany` / `FileTagKeyValue`） | 仅辅助下拉 API 用 | **内层** `addOrEdit/apis/type.ts` |
| **业务块共用组件**（如 store/components 的 `SubAccountManager`——store 模块多页面共用） | 业务块共用 | **外层** `components/` |
| **仅当前页面用**（如 SubAccountEditor 只被 detail.vue / fill.vue 用） | addOrEdit 内单用 | **内层** `addOrEdit/components/` |
| **列表配置**（`getSearchFormItems` + `getTableColumns`） | 列表页用 | **外层** `config/` |
| **字典/枚举**（如 `AUDIT_STATUS` / `ONBOARDING_PLATFORMS`） | 业务块共用 | **外层** `enum/` |
| **跨模块共用字典**（如 `ONBOARDING_PLATFORMS` 被 AccountChangeDetails 引用） | 跨模块共用证据 → 提升优先级 | **外层** `enum/` |
| **业务归一化函数**（如 `normalizeOnboardingDetail`） | 列表页 + addOrEdit 通用 | **外层** `utils/` |
| **状态 → el-tag 映射**（如 `getStatusTagType`） | 列表页 + addOrEdit 通用 | **外层** `utils/` |
| **页面级 flow utility**（如 `createOperationIdStore`） | 仅 detail.vue 用 | **内层** `addOrEdit/utils/` |
| **二次确认**（`utils/confirm.ts`） | 每个模块都需要 | **外层** `utils/confirm.ts` |

## 实操步骤（推荐）

### 步骤 1：grep 全仓调用方

```bash
# 例：判断某 API 函数归属
grep -rln "\b<函数名>\b" src/pages/<业务模块>/ --include="*.vue" --include="*.ts" | grep -v "apis/index.ts"
```

### 步骤 2：分类

- 0 处调用 → 死代码 → 删（不要"先放着"）
- 1 处调用（仅声明）→ 死代码
- 仅 addOrEdit 内某文件用 → **内层**
- 列表页 + addOrEdit 都有用 → **外层**
- 被其他业务模块引用 → **外层**

### 步骤 3：判 attribute（type / interface）

如果文件 X 是 type/interface，看被哪些文件 import：
- 与 X 关联的 API 在哪 → type 也跟去
- 列表/详情共用的 VO → 外层 type.ts
- 仅辅助下拉 API 用的 type → 内层 type.ts

## 实战案例（StoreAuditOnboarding）

| 文件 | 调用方 | 归属 |
|---|---|---|
| `pageOnboardingApi` | 外层 index.vue | **外层** `apis/` |
| `deleteOnboardingApi` | 外层 index.vue + addOrEdit/detail.vue | **外层** `apis/`（跨页面） |
| `queryOnboardingDetailApi` | addOrEdit 内 3 个 .vue | **外层** `apis/`（业务主接口） |
| `createOnboardingApi` / `updateOnboardingApi` / `submitOnboardingApi` | 仅 addOrEdit/index.vue | **外层** `apis/`（业务主接口） |
| `approveOnboardingApi` / `rejectOnboardingApi` | 仅 addOrEdit/detail.vue | **外层** `apis/`（业务主接口） |
| `fillAndCompleteOnboardingApi` | 仅 addOrEdit/fill.vue | **外层** `apis/`（业务主接口） |
| **`listAvailableCompaniesApi`** | **仅** addOrEdit/detail.vue | **内层** `addOrEdit/apis/` |
| **`listDistinctTagsByCompanyIdsApi`** | **仅** addOrEdit/detail.vue | **内层** `addOrEdit/apis/` |
| `AssignableCompany` / `FileTagOption` 等 5 个 interface | 仅 listAvailableCompaniesApi 等 2 个 API | **内层** `addOrEdit/apis/type.ts` |
| `SubAccountEditor` | 仅 addOrEdit/detail.vue + fill.vue | **内层** `addOrEdit/components/` |
| `createOperationIdStore`（前 detail-flow.ts） | 仅 addOrEdit/detail.vue | **内层** `addOrEdit/utils/` |

## 判定口诀

> **主接口外层放，辅助下拉内层放。跨页面必外层，单页面必内层。**

## 反模式（不要做）

- ❌ "先放着外层以后再挪"——首次就该正确
- ❌ "反正只有 1 个调用方"—— 单调用方也是内层判定依据
- ❌ "目录名冲突所以放外层"—— 不要为了回避冲突打乱归属
- ❌ 把"建议共用"误判为"已共用"—— 必须有 grep 证据

## 何时回退判定

如果用户给的产品需求/技术约束明确要求放特定位置（如"这个工具未来要跨模块用，先放外层"），以**用户要求**为准，但需要在 Javadoc 注明"未来提升至 share 包的计划"。