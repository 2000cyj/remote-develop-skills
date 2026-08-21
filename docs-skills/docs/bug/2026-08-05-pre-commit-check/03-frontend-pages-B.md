# 03 · 前端页面（company / store）改动审查报告

**审查日期**：2026-08-05
**审查范围**：
- `src/pages/company/`（index.vue / apis / config / addOrEdit/add.vue / addOrEdit/editOrCheck.vue）
- `src/pages/store/`（index.vue / apis / config / enum / addOrEdit/addOrEdit.vue）
**审查性质**：只读，无业务代码修改
**结论摘要**：发现 1 个 🔴 高、3 个 🟡 中、2 个 🟢 低共 6 个独立问题。其中 store 模块未发现高/中等优先级的真实缺陷，主要集中在 company 模块。

---

## 🔴 高优先级

### B-01 【company 列表页「法人」筛选下拉会显示所有出纳员工，而非仅法人】

- **文件**：`src/pages/company/apis/index.ts:78-80`
- **问题描述**：该文件第 72-76 行的 JSDoc 注释明确写"复用 listCashierEmployees 并按 is_legal_person 过滤"，但函数体却只调用了 `listCashierEmployeesApi({})`（无任何过滤参数）。对比 `src/pages/company/addOrEdit/apis/index.ts:83-85`，同一函数在 addOrEdit 模块里正确传入了 `{ is_legal_person: "1" }`，说明这里漏写了过滤。
- **影响路径**：
  1. `src/pages/company/index.vue:13` 引入 `listAllLegalPersonApi`
  2. `src/pages/company/index.vue:102-114` 的 `loadLegalPersonOptions` 调用它
  3. 返回值赋给 `legalPersonOptions`，供搜索项"法人"下拉使用（config/index.ts:48-58）
- **触发场景**：在列表页打开"法人"筛选下拉，会看到全部出纳员工（包括股东、非法人），而不是仅"is_legal_person='1'"的人员，导致筛选结果出错。
- **修复建议**：把 79 行改为
  ```ts
  return listCashierEmployeesApi({ is_legal_person: "1" })
  ```
  与 addOrEdit 模块的对齐。

---

## 🟡 中优先级

### B-02 【company/editOrCheck.vue 提交股东占股比例时 ratio 未转 string，与 add.vue 不一致】

- **文件**：`src/pages/company/addOrEdit/editOrCheck.vue:958-962`
- **问题描述**：`add.vue:989-993` 在 buildSavePayload 里对 ratio 做了 `s.ratio != null ? String(s.ratio) : undefined`，但 `editOrCheck.vue:958-962` 的等价代码只写了 `ratio: s.ratio`，number 直接进入 `ShareholderItem`（type.ts:131 定义为 `ratio?: string`）。`as ShareholderItem[]` 只是把 TS 错误吞掉，运行时仍提交 number。
- **触发场景**：编辑保存公司，股东占股比例（如 66.66）作为 number 提交，后端 `CompanySaveRequest.ShareholderItem.ratio` 为 BigDecimal（期望 String）。后端 Spring 反序列化 number → BigDecimal 可能成功（隐式），但精度/类型与新增路径不一致，未来加 strict 类型校验会被拒绝。
- **修复建议**：与 add.vue 对齐：
  ```ts
  ratio: s.ratio != null ? String(s.ratio) : undefined
  ```
  并去掉冗余 `as ShareholderItem[]` 类型断言。

### B-03 【company add.vue 用 String、editOrCheck.vue 用 Number 转换 registeredCapital/paidAmount/remainingAmount，提交同一字段类型不一致】

- **文件**：
  - `src/pages/company/addOrEdit/add.vue:1042-1047`
  - `src/pages/company/addOrEdit/editOrCheck.vue:1012-1017`
- **问题描述**：同一字段，add 路径用 `String(...)` 转换后提交 string，edit 路径用 `Number(...)` 转换后提交 number。`ShareholderItem` 字段类型（type.ts:64-71）声明 `registeredCapital?: string | number` 虽然同时兼容，但同一字段在两个页面出现"提交形态不一样"，是不一致的状态机。
- **触发场景**：
  - 新增保存：表单 number → String → 提交 string
  - 编辑保存：详情 string → Number → 提交 number
  - 后端若严格按 String 处理，第二条路径会报错或被自动转换
- **修复建议**：统一为 String（与类型定义中后端 BigDecimal 对齐更安全），或者按后端 entity 实际类型决定。同时修两处。

### B-04 【company/index.vue searchFormItems 是 computed，但内部修改了返回对象的 options 字段】

- **文件**：`src/pages/company/index.vue:85-93`
- **问题描述**：
  ```ts
  const searchFormItems = computed(() => {
    const items = getSearchFormItems(legalPersonOptions.value)
    const detailItem = items.find(i => i.prop === "companyAttributionDetails")
    if (detailItem) {
      detailItem.options = getAttributionDetailOptions(searchForm.companyAttributionType)
    }
    return items
  })
  ```
  computed 内修改了 `items[i].options`（in-place mutation），违反 Vue 3 computed "纯函数"约定。每次 `searchForm.companyAttributionType` / `legalPersonOptions` 变更整个 items 会被重建 + mutate，第二次切换国内外时由于新数组所以不会污染旧值，但写法不规范，未来若 share 库对 items 做引用缓存会出现状态错乱。
- **触发场景**：仅代码风格/可维护性问题，不影响当前运行，但相邻人员维护易踩坑。
- **修复建议**：把 detail 项单独抽成一个 computed 作为 `FormItemConfig` 列表的某一项，或在 `getSearchFormItems` 内接受外部 options 注入，避免 mutate。

---

## 🟢 低优先级

### B-05 【store/addOrEdit/addOrEdit.vue handleSubmit 未对 companyId/operatorId/bankCardId 缺失防御】

- **文件**：`src/pages/store/addOrEdit/addOrEdit.vue:485-516`
- **问题描述**：表单项虽然有 `required` 校验，但 `companyId: formData.companyId as number`（line 488）、`operatorId: Number(formData.operatorId)`（line 494）等处仍然强转；万一未来关闭校验规则或后端异常跳过校验，运行时会出现 companyId=undefined/NaN 提交。
- **触发场景**：低概率，但缺少防护。如要稳健可以加 `if (!formData.companyId) { ElMessage.error(...); return }` 防御。
- **修复建议**：校验通过后保留断言，或在失败分支抛错即可，priority 低。

### B-06 【company/addOrEdit.vue 中 nextStep 校验失败提示过弱，goToStep 又主动跳回当前步】

- **文件**：`src/pages/company/addOrEdit/add.vue:896-914`、`918-942`
- **问题描述**：`nextStep` 校验失败只给了顶部 `ElMessage.warning("请检查当前步骤的必填字段")` 并停留在原 step；`goToStep` 反而把 `currentStep.value = i` 跳到出错步骤。这意味着点 stepper 跳到第 6 步，如果第 3 步校验不过，会被甩回第 3 步，用户可能搞不清楚"我点到第 6 步怎么回到第 3 步"。
- **触发场景**：用户跨越多个 step 跳转。
- **修复建议**：在 ElMessage.warning 文本里说明"已跳回第 N 步"，或加 scrollToField。优先级低，因为不影响功能。

---

## 已在代码中留意但确认无问题的项

为避免误报，下列点逐一看过，确认无 bug，仅作为说明记录：

1. `company/apis/index.ts` 中 `deleteCompanyApi` / `updateStoreQualificationApi` 使用 `params:`（form-data）而非 `data:`：因为都只有 2 个以内的查询字段，符合 "<3 参数 form-data" 的规范。
2. `store/apis/index.ts` 中所有列表/批量 API 用 `data:` JSON body，分页/筛选/批量更新字段 4 个起步，符合 ">=3 参数 JSON body"。
3. `company/listAllLegalPersonApi`（外层，BUG 中已修）与 addOrEdit 同名函数并存：两处实现独立，但名字一致是预期（注释说明）。
4. `capitalFormatInput` 组件在 `src/pages/company/addOrEdit/components/CapitalFormatInput.vue` 存在，已确认。
5. 商标编辑/新增弹窗 `#brand` 插槽：触发 `fetchBrandOptions(params, brandId)` 用 brandId 当 selectedBrandName，与后端约定一致。
6. `CompanyStoreItem` 与 `Store` 在 `/cashier/store/listStoreByCompanyUniqueValue` 接口的返回类型不一致：使用方各自按需映射，运行时类型互不影响。
7. `store/index.vue` 第 261-263 行 `watch(() => searchForm.companyId, (v) => { if (v == null) selectedCompanyUv.value = undefined })`：复位清理 OK，没有泄漏。
8. `company/index.vue` 第 117-133 行 `useListPage` 用法、`formatParams` 字段重映射：与 useListPage 的契约匹配。
9. `editOrCheck.vue` 第 118-130 行 `visibleTabs` + 兜底 watch：tab 权限降级回退逻辑正确。
10. `store/addOrEdit/addOrEdit.vue` 第 309-321 行 `watch companyUniqueValue → companyId + categories`：联动逻辑正确，但 categories 一旦公司变化会清空，旧 categories 不会保留——是预期行为。
11. `company/add.vue` 股东表 `<template :ref="(el) => { ... }">` 写法是 Vue 3 函数式 ref 的常见模式，el 每次重渲会重置；股东数量增/删时 idx 可能错位，但 `shareholderSelectRefs` 仅用于编辑回显后一次性 refresh 新增第一页，所以 idx 不必稳态——逻辑不影响。
12. `add.vue` handleSave 成功后只是弹"新增成功"，未 pushRoute 回列表——保留在表单页可用，符合"再录一条"的产品场景。
13. `company/index.vue` 第 95-100 行 `watch(() => searchForm.companyAttributionType, () => { searchForm.companyAttributionDetails = undefined })` 与模板 `@change="formData.companyAttributionDetail = ''"`（editOrCheck.vue:1404）风格统一，功能无 bug。
14. `add.vue` hasStoreQualificationValue / hasTrademarkValue / isSubscriptionValue 三个 computed 都把 boolean ↔ "1"/"0" 互换，写法一致。

---

## 无问题清单（确认已阅读 & 已审的无 bug 文件）

### company 模块
- `src/pages/company/index.vue`（已读，已审；唯一发现 B-01 影响面源头 + B-04）
- `src/pages/company/apis/index.ts`（已读，已审；发现 B-01）
- `src/pages/company/apis/type.ts`（已读，已审；类型字段与 CompanyPageResult/CompanySearchForm 一致）
- `src/pages/company/config/index.ts`（已读，已审；搜索项工厂与表格列对齐后端字段）
- `src/pages/company/addOrEdit/add.vue`（已读，已审；发现 B-03 锚点）
- `src/pages/company/addOrEdit/editOrCheck.vue`（已读，已审；发现 B-02、B-03、B-06）
- `src/pages/company/addOrEdit/apis/index.ts`（已读，已审；与外层签名不冲突）

### store 模块
- `src/pages/store/index.vue`（已读，已审；权限、批量编辑、本地缓存关联主体 uv 闭环、watch 重置均无 bug）
- `src/pages/store/apis/index.ts`（已读，已审；7 个 controller 接口 + 3 个下拉辅助接口全部正确）
- `src/pages/store/apis/type.ts`（已读，已审；Store/StorePageQuery/StoreSavePayload 等 DTO 与后端声明对齐，含 `StoreFileUploadItem` / `ChangeInfo` / `BusinessScopeItem` 等）
- `src/pages/store/config/index.ts`（已读，已审；搜索项工厂与表格列对齐字典与字段）
- `src/pages/store/enum/index.ts`（已读，已审；6 个枚举全部对应 DictionaryKey 常量已在 dictionary.ts 中存在 —— 经 grep 验证：CASHIER_PLATFORM_OPTIONS/CASHIER_SHOP_STATUS_OPTIONS/CASHIER_GUARANTEE_RETURN_STATUS_OPTIONS/CASHIER_GUARANTEE_THRESHOLD/CASHIER_CAN_CLOSE_STORE_OPTIONS 全部已定义；且都已在 addOrEdit.vue 中使用：CASHIER_BELONGS_DEPARTMENT（line 36）、CASHIER_PLATFORM_OPTIONS（line 40）、CASHIER_SHOP_STATUS_OPTIONS（line 41）、CASHIER_GUARANTEE_RETURN_STATUS_OPTIONS（line 38）、CASHIER_GUARANTEE_THRESHOLD（line 39）。`CASHIER_CAN_CLOSE_STORE_OPTIONS` 由 `store/config/index.ts:31` 列表筛选项消费。整体结构完整，无孤立导出）
- `src/pages/store/addOrEdit/addOrEdit.vue`（已读，已审；详情回显 → 远程搜索刷新 → 提交联动链路正常；仅发现 B-05）

---

## 总结

| 模块 | 🔴 | 🟡 | 🟢 | 合计 |
|------|----|----|----|------|
| company | 1 | 3 | 1 | 5 |
| store  | 0 | 0 | 1 | 1 |
| **总计** | **1** | **3** | **2** | **6** |

**首要修复项**：B-01（列表页法人筛选下拉不传过滤参数）—— 影响数据正确性，建议 commit 前修。
