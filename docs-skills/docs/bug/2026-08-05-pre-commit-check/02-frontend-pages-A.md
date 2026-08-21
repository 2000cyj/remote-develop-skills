# 提交前自检 · 前端页面（bankCard / employee / seal）

> 审查时间：2026-08-05
> 审查范围：bankCard / employee / seal 三个模块的 12 个文件（仅读检查，未修改任何业务代码）
> 审查方法：通读全部目标文件 + 调用链回溯（codegraph）

---

## 严重程度图例
- 🔴 **高**：直接导致功能不可用或数据错误，必须修
- 🟡 **中**：行为偏差 / 类型不安全 / 隐性 bug，建议修
- 🟢 **低**：可读性 / 死代码 / 优化建议

---

# 🔴 高严重度

## BUG-1 · employee 详情回显把整个 `EmployeeFileQuery` 误当作 `Employee` 复制到表单

**文件**：`src/pages/employee/addOrEdit/addOrEdit.vue:247-262`
**关联类型**：`src/pages/employee/apis/type.ts:69-81`（`EmployeeFileQuery`）

**问题描述**
`queryEmployeeByIdApi` 返回的是 `ApiEnvelope<EmployeeFileQuery>`（注释见 `apis/index.ts:24-27`：主体数据在 `res.data.employeeFileHead`）。但 `reloadDetail` 直接：

```ts
const d = res.data                       // d 是 EmployeeFileQuery
Object.assign(formData, d)               // ❌ 把 EmployeeFileQuery 的字段塞进表单
```

`EmployeeFileQuery` 的字段是 `employeeFileHead / employeeFileBodyList / employeeFileContractList / employeeFileCertificateList / idPhotoFrontFileList / idPhotoBackFileList / idPhotoHandheldFileList`。**真正的员工字段（moniker / phoneNumber / identityCardNumber / cashierDepartment / departmentNature / bindBiAccount 等）位于 `d.employeeFileHead`**，从未被读取。

**触发场景**
进入「编辑」或「查看」任意人员 → 表单 9 个核心字段全部为空（除 3 个证件照因 EmployeeFileQuery 顶层有冗余字段，恰好正确）。用户以为数据丢了一刷新就还原失败；编辑保存时把空值提交回后端，相当于「清空员工档案」。

**对比正确写法**：同目录下 `store/addOrEdit/addOrEdit.vue`、`company/addOrEdit/editOrCheck.vue`、`bankCard/addOrEdit/addOrEdit.vue:426-455` 都是显式 `formData.xxx = d.xxx || ""` 映射。

**修复建议**
```ts
async function reloadDetail(cardId: number) {
  const res = await queryEmployeeByIdApi({ employee_id: cardId })
  if (res.code !== 0) return
  const head = res.data?.employeeFileHead
  if (!head) return
  formData.id = head.id
  formData.employeeId = head.employeeId
  formData.bindBiAccount = head.bindBiAccount || ""
  formData.moniker = head.moniker || ""
  formData.cashierDepartment = head.cashierDepartment || ""
  formData.cashierDepartmentName = head.cashierDepartmentName || ""
  formData.departmentNature = head.departmentNature || ""
  formData.identityCardNumber = head.identityCardNumber || ""
  formData.phoneNumber = head.phoneNumber || ""
  formData.identityAddress = head.identityAddress || ""
  formData.presentAddress = head.presentAddress || ""
  formData.isLegalPerson = toBool(head.isLegalPerson)
  formData.isShareholder = toBool(head.isShareholder)
  formData.isPublicRelations = toBool(head.isPublicRelations)
  formData.isBlacklist = toBool(head.isBlacklist)
  idPhotoFrontFileList.value = (head.idPhotoFrontFileList as unknown as FileItemProps[]) || []
  idPhotoBackFileList.value = (head.idPhotoBackFileList as unknown as FileItemProps[]) || []
  idPhotoHandheldFileList.value = (head.idPhotoHandheldFileList as unknown as FileItemProps[]) || []
}
```

---

# 🟡 中严重度

## BUG-2 · bankCard 新增成功提示无后端响应校验

**文件**：`src/pages/bankCard/addOrEdit/addOrEdit.vue:517-520`

**问题描述**
```ts
} else {
  await addBankCardApi(payload)
  ElMessage.success("新增成功")
}
```
对比「编辑」分支（同文件 511-516）有 `if (res.code === 0)` 校验，新增分支缺少。新增失败时仍弹「新增成功」，误导用户。

**触发场景**：账号重复 / 后端校验失败 / 网络异常 → 列表无新增行，但弹窗显示「新增成功」，用户以为已落库。

**修复建议**：参照编辑分支补 `const res = await addBankCardApi(payload); if (res.code === 0) ElMessage.success("新增成功")`；失败时由拦截器已统一弹错，silent return 即可。

---

## BUG-3 · seal 删除原图时电子印章不会从服务端清理 → 文件服务累积孤儿

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:208-227`

**问题描述**
`handleSealDelete`（`@deleted-success` 回调）原本要调 `deleteFile` 把已上传的电子印章从 `/api/file/deleteFile` 删掉，但 16 行 `try { await deleteFile(...) }` 整段被注释。注释说「前端继续清理，后端失败打 warning 让运维兜底」。**实际意味着删除原图时电子印章永远只清前端状态，服务端文件累积**。

**触发场景**
用户编辑印章 → 重新上传原图 → 旧电子印章既不会被前端引用、也不会被后端删除。日积月累在文件服务留下大量 `sealElectronicFiles/*` 孤儿文件。

**修复建议**：取消注释并跑通 `deleteFile` 流程；或在前端 watch 中明确放弃清理责任，至少打个 `console.warn` 让产品评估运维侧清理任务。

---

## BUG-4 · seal 列表删除失败时不报错且仍刷新列表

**文件**：`src/pages/seal/index.vue:135-143`

**问题描述**
```ts
const res = await deleteSealApi({ uniqueValue: row.uniqueValue })
if (res.code === 0) {
  ElMessage.success("删除成功")
}
void getList()
```
删除失败时既无 `ElMessage.error`，且 `void getList()` 必然执行（与 bankCard/index.vue:106-118 写法对比，bankCard 有 early return + error toast）。用户体验：失败时无感知，列表被刷新但行仍在。

**触发场景**：后端校验 / 软删失败 → 用户以为删除成功并继续操作。

**修复建议**：
```ts
if (res.code === 0) {
  ElMessage.success("删除成功")
  void getList()
} else {
  ElMessage.error(res.message || "删除失败")
}
```

---

## BUG-5 · bankCard 搜索表单 `isCanceled` 类型与下拉值不一致（大量 `as unknown as string` 双 cast）

**文件**：`src/pages/bankCard/index.vue:46-48`；`src/pages/bankCard/apis/type.ts:89`

**问题描述**
- `BankCardPageQuery.isCanceled: boolean`（type.ts:89）
- `BankCardSearchForm extends BankCardPageQuery` → `isCanceled: boolean | undefined`
- `cancelStatusEnum` 值为字符串：`CANCELED: "canceled"` / `ACTIVE: "active"`（`common/enum/index.ts:86-88`）
- 实际下拉 select 吐出的是 `"canceled"` / `"active"` 字符串

但代码用 6 次 `(raw.isCanceled as unknown)` + `(raw.isCanceled as unknown as string)` 双 cast 才能比较。可读性极差且类型不安全（任何调用方传 boolean 都会被错误地经过这段逻辑）。

**修复建议**：把 `BankCardSearchForm.isCanceled` 重新声明为 `string | undefined`（不要继承 `BankCardPageQuery.isCanceled`），或者在 `BankCardSearchForm` 上覆盖为 `"canceled" | "active" | undefined`。同时把 `index.vue:46-48` 改回常规字符串比较。

---

## BUG-6 · employee 表单 `watch(formData.cashierDepartment)` 写入的 `cashierDepartmentName` 永不被使用（死代码）

**文件**：`src/pages/employee/addOrEdit/addOrEdit.vue:242-245`

**问题描述**
```ts
watch(() => formData.cashierDepartment, (val) => {
  const opt = CASHIER_BELONGS_DEPARTMENT.options.find(o => String(o.value) === val)
  formData.cashierDepartmentName = opt?.label || ""
})
```
- `cashierDepartmentName` 不在 `formItems` 里、不渲染；
- `EmployeeSavePayload` 也不携带（`apis/type.ts:124-157` 缺字段）；
- 后端详情接口返回的 `cashierDepartmentName` 已在 `reloadDetail` 中回填（修复 BUG-1 后），但 watch 在编辑模式又被本字典覆盖——前后顺序未定义。

**修复建议**：删除整个 watch（与 bankCard/addOrEdit 同样不维护 `bankName` 缓存，依赖后端返回值）；或在 `EmployeeSavePayload` 加字段并保存。

---

## BUG-7 · seal 编辑回显后 watch 清空电子印章可能误清

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:261-267`

**问题描述**
```ts
watch(sealOriginalFiles, (list) => {
  if (!list?.length) {
    originalSourceFile.value = undefined
    if (formData.sealElectronicFiles?.length) formData.sealElectronicFiles = []
  }
})
```
监听 `sealOriginalFiles` 变为「空」时清掉电子印章。**问题**：UploadCropper 自带的删除按钮既会修改 v-model 触发 watch，也会 emit `@deleted-success` 走 `handleSealDelete`（同样清电子印章）。两侧清理逻辑重复，且若用户在删除原图后立即上传新文件（极端操作），watch 可能在新的「已上传电子印章」就绪前误清。

**修复建议**：保留 `handleSealDelete` 一处清理点，watch 只负责「原始文件被外部清空（例如编辑时取消选择）」的兜底；或在 watch 内加 `if (originalSourceFile.value) formData.sealElectronicFiles = []` 限定只在「有源图记忆」时才清。

---

# 🟢 低严重度

## BUG-8 · seal 新增 API `listSealByCompanyApi` 导出但全代码库 0 调用方（死代码）

**文件**：`src/pages/seal/apis/index.ts:76-88`

**问题描述**
```ts
export function listSealByCompanyApi(params: SealListByCompanyQuery) {
  return request<ApiEnvelope<Seal[]>>({
    url: `${BASE}/listSealByCompany`,
    method: "post",
    params
  })
}
```
注释说「公司详情页『印章信息』tab 使用」，但 `codegraph` 全仓搜索无 caller。当前 PR diff 中此 API 是新增的，属于「超前埋点」。

**修复建议**：要么确认下个迭代要接入（保留 + TODO），要么从 PR 中移除避免维护负担（后续 rebase 重新引入成本很低）。

---

## BUG-9 · seal 上传 URL 与路径推断 magic number 硬编码

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:144, 167-170`

**问题描述**
```ts
const FILE_UPLOAD_URL = "/api/file/pushHttpFileBatchModule"   // 硬编码 URL
// ...
const pathArr = window.location.pathname.split("/")
const arrLength = pathArr.length
const firstLevelRoute = pathArr[arrLength - (arrLength > 4 ? 2 : 1)] || ""
```
两个问题：
1. 文件上传端点硬编码，与 share 共享 Upload 组件内部的 action 不在同一来源，将来后端路径变更需双改。
2. `arrLength > 4 ? 2 : 1` magic number 没有注释说明业务含义（4 = qiankun 子应用路径段数？），后续维护者难以理解。

**修复建议**：把 `FILE_UPLOAD_URL` 提到 `common/constants` 或从 share 导入；从 `useRoute()` 拿当前路径段而不是拆 `window.location.pathname`（qiankun 路由下两者可能不一致）。

---

## BUG-10 · seal `handleSave` view 模式 `return` 但不返回列表

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:364-367`

**问题描述**
```ts
async function handleSave() {
  if (isView.value) {
    return                  // ❌ 不应该被执行（isView 时无保存按钮），且即便执行也只是 return，无 navigate
  }
```
对比 bankCard 写法：`if (isView.value) { handleBack(); return }`。当前写法在「isView 但又触发了保存」（极端，比如调试时手动调用）的边界场景下会原地卡住。

**修复建议**：保险起见补 `handleBack()`；或保留 return 但加注释说明此分支不可达。

---

## BUG-11 · seal 新增时不重拉详情且无失败提示

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:397-402`

**问题描述**
新增成功只弹消息、不返回列表也不刷新；同时 bankCard 同样位置（line 517-520）也有相同问题。新增后用户停在空表单页（且 `id / uniqueValue` 为 undefined），刷新路由会回不到这条记录。

**修复建议**：新增成功后 `getPushRoute?.()({ path: '/yzgl' })` 返回列表，让列表自动重查。

---

## BUG-12 · seal 编辑保存无 `res.code` 校验（仅显示成功消息）

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:391-402`

**问题描述**
与 BUG-2 / BUG-4 类似：`updateSealApi` 调用后只 `if (res.code === 0)` 才走「更新成功 + reloadDetail」，但 `addSealApi` 分支（line 398-402）只判断成功才弹消息、无错误反馈。失败时拦截器已弹错，但分支结构不对称。

**修复建议**：统一分支结构（两边都用 `if (res.code === 0)` 判断；编辑失败时打 error 或 silent return）。

---

## BUG-13 · seal `formData.sealType = ""` 兜底后强转可能写脏数据

**文件**：`src/pages/seal/addOrEdit/addOrEdit.vue:378`

**问题描述**
```ts
sealType: formData.sealType as SealType,
```
`FormState.sealType: SealType | ""`，若校验通过必填非空，运行时不会出现 `""`，但 TS 类型上仍可能未收敛。后端 `@NotBlank` 失败拦截器会弹错，但类型上应该用 `as SealType` 不留口子。

**修复建议**：把 `FormState.sealType` 改为 `SealType`（去掉 `| ""`），初始化为某个具体值；或新建 `validatedFormData` 类型在 handleSave 内窄化后再构造 payload。

---

## BUG-14 · bankCard formRules `singleLimit` 等四个限额只校验 `required` 但未校验 `>= 0`

**文件**：`src/pages/bankCard/addOrEdit/addOrEdit.vue:115-130`

**问题描述**
```ts
singleLimit: [
  { required: true, message: "请输入单笔限额", trigger: "blur" },
  { type: "number", message: "必须为数字" }
],
```
组件 `min: 0, precision: 2, step: 1000`（line 303-306）虽然在前端限制了最小值，但 `ElInputNumber` 在某些边界（手动键入负数会被 clamp，但 formRules 不会触发）下仍可能漏检。`dailyLimit`/`monthlyLimit`/`yearlyLimit` 同样无 min 校验。

**修复建议**：在 rules 加 `min: 0` + `message`；或加自定义 validator 校验 `value >= 0`。

---

## BUG-15 · bankCard `watch(formData.bankCode)` 时机不稳

**文件**：`src/pages/bankCard/addOrEdit/addOrEdit.vue:417-424`

**问题描述**
watch 在 script setup 时立即注册，但 `bankOptions.value = CASHIER_ACCOUNT_BANK_NAME.options`（line 460）是在 `loadInitial` 内异步赋值。若 watch 因响应式系统同步触发（例如初始 reactive 设置 `bankCode: ""`），`bankOptions.value` 还是空 `[]` —— 这次不会清空 `bankName`（默认 ""），但若后续字典加载慢，watch 不会重复触发，导致 `bankName` 永远是 `""`。

**触发场景**：进入编辑模式 → reloadDetail 设置 `formData.bankCode = "ICBC"` → 此时 `bankOptions` 已被 `loadInitial` 第一步同步设置 → watch 触发 → `find` 命中 → 写入 `bankName`。通常 OK；但**新增模式下字典加载完成晚于 watch** 时存在边界。

**修复建议**：watch 改 `watch([() => formData.bankCode, () => bankOptions], ...)` 同时监听字典；或在 `reloadDetail` 后显式重算 `formData.bankName`。

---

## BUG-16 · bankCard 列定义 `tableColumns` 重复创建（性能可忽略，但一致性建议）

**文件**：`src/pages/bankCard/config/index.ts:120-211`

**问题描述**
`getTableColumns` 内部 push 操作列时用 `options?.showAction !== false`（line 203），调用方 `index.vue:127` 传 `{ showAction: hasRowAction.value }`。当 `hasRowAction` 为 `false` 时，操作列被省略 —— 这是预期。但**无权限时如果将来要把无权限按钮的列也展示**，就要改多处。建议把 `showAction` 语义统一（默认显示、由调用方传 false 才隐藏）。

**修复建议**：保留现状即可，仅作可读性建议（注释「无操作权限时省略整列」）。

---

## BUG-17 · seal `sealOriginalFiles` 字段在列表 `Seal` 上是必填

**文件**：`src/pages/seal/apis/type.ts:59`

**问题描述**
```ts
sealOriginalFiles: FileUploadRecordVO[]   // 无 ?
```
对比 `accountQueryFiles: CashierFileUploadRecordList[]` 等是必填，但 Employee 类型中同位置字段是 `?:` 可选（type.ts:64-66）。在 seal 列表行里如果某些印章没原图（仅电子印章或仅有备注），该字段会是 undefined，与必填类型不符。

**修复建议**：改为 `sealOriginalFiles?: FileUploadRecordVO[]`；使用方需补 `|| []` 兜底（已多处写，OK）。

---

# 无问题清单（明确检查过、确认 OK）

> 以下文件 / 模式经代码阅读 + 调用链回溯，**未发现需要阻塞提交的问题**：

| 文件 | 检查要点 |
|---|---|
| `src/pages/bankCard/apis/index.ts` | 所有 7 个 API 函数签名与 `apis/type.ts` 类型完全一致；`pageBankCardApi` / `addBankCardApi` / `updateBankCardApi` / `exportBankCardApi` / `batchUpdateBankCardFieldApi` 用 `data`（参数 ≥3，走 JSON body）符合规范；`queryBankCardByIdApi` / `deleteBankCardApi` 用 `params`（参数 =1，走 query）符合规范 |
| `src/pages/bankCard/apis/type.ts` | `BankCard` / `BankCardPageQuery` / `BankCardPageResult`（`records`/`total` 与 `useListPage.ts:65-66` 读取一致）/`BankCardSavePayload` / `BankCardBatchUpdateFieldPayload` 类型完整；4 个新限额字段（singleLimit/dailyLimit/monthlyLimit/yearlyLimit）已加 |
| `src/pages/bankCard/config/index.ts` | 搜索项工厂 / 列工厂函数纯函数；列 field 与 `BankCard` 接口一致；4 个限额列格式化（千分位 2 位小数）OK |
| `src/pages/bankCard/index.vue` | `useListPage` 用法正确（`formatParams` 拆日期范围、字符串转 boolean）；`checkPermission` 调用齐全（insert/check/change/delete）；批量行编辑 `handleBatchConfirmSuccess` 取账号列表、catch 兜底、clearCheckboxRow 都对；新增 / 查看 / 编辑跳转路由与子路径一致 |
| `src/pages/bankCard/addOrEdit/addOrEdit.vue` | `mode` 推断同时支持 query 和 path 兜底；`watch(formData.bankCode)` 联动 `bankName`；3 个文件组（accountQueryFiles/openingFiles/cancelReceiptFiles）的 `AttachmentManager` / `AttachmentAddModal` / `AttachmentEditModal` 三方联动逻辑正确；`handleSave` 编辑分支有 `res.code` 校验（新增分支见 BUG-2）；文件回填按 `fileType` 过滤；水印组件挂载正常 |
| `src/pages/employee/apis/index.ts` | 7 个 API 函数签名与 `apis/type.ts` 类型一致；新增的 `exportEmployeeApi` / `removeEmployeeApi` / `listAllEmployeeApi` 全部被 `employee/index.vue` / `addOrEdit/addOrEdit.vue` 调用（无空函数）；`pageEmployeeApi` / `saveEmployeeApi` / `exportEmployeeApi` 用 `data`（≥3 参数），`queryEmployeeByIdApi` / `removeEmployeeApi` 用 `params`（1 参数）符合规范 |
| `src/pages/employee/apis/type.ts` | `Employee` / `EmployeeFileQuery` / `EmployeePageQuery` / `EmployeePageResult` / `EmployeeSavePayload` / `EmployeeSearchForm` 类型完整；`EmployeeFileQueryVO` 用 `employeeFileHead` 嵌套的设计有注释；isXxx 字段统一 `string` 后端 0/1，与前端 `toBool/toFlag` 转换对齐 |
| `src/pages/seal/apis/index.ts` | 7 个 API 函数（含新增的 `listSealByCompanyApi`）签名与 `apis/type.ts` 一致；`pageSealApi` / `addSealApi` / `updateSealApi` / `listCompanyOptionsApi` 用 `data`，`querySealDetailApi` / `deleteSealApi` / `listSealByCompanyApi` 用 `params` 符合规范 |
| `src/pages/seal/apis/type.ts` | `Seal` / `SealDetail` / `SealPageQuery` / `SealPageResult` / `SealSavePayload` 类型完整；`isEnabled: number` 0/1 与后端 Integer 对齐；`SealSaveDTO` 字段映射一致 |
| `src/pages/seal/config/index.ts` | 列 field 与 `Seal` 接口一致；3 列 slot（`sealImageCell`/`sealTypeCell`/`createTimeCell`）对应 `index.vue` 模板均存在 |
| `src/pages/seal/index.vue` | `useListPage` 用法正确；`checkPermission` 齐全；RemoteSearchSelect 关联公司筛选 + `companyUniqueValueModel` 数组↔单值适配正确；删除有 `confirmDelete` 二次确认 |
| `src/pages/seal/addOrEdit/addOrEdit.vue` | `mode` 推断支持 query + path 兜底；`watch(sealOriginalFiles)` 联动清电子印章（重复问题见 BUG-7）；`reloadDetail` 字段映射完整；`handleSealCrop` 调 `postFormData` 上传电子印章并写 `formData.sealElectronicFiles`；`fileFromSource` 用 `getProxyUrl` 跨域代理；图片裁剪流程（UploadCropper → SealCropper）连线完整 |
| `useListPage` 契约（`packages/share/composables/useListPage.ts:65-66`） | 三个模块均返回 `BankCardPageResult` / `EmployeePageResult` / `SealPageResult`（均有 `records: T[]` + `total: number`），与 useListPage 内部读取完全匹配，不会出现 `.data?.rows` 取数错误 |

---

# 修复优先级建议

| 优先级 | Bug | 预计工作量 |
|---|---|---|
| P0（必须修） | BUG-1 employee 详情回显错把 EmployeeFileQuery 当 Employee | 15 分钟 |
| P1（强烈建议） | BUG-2 bankCard 新增成功提示无后端校验 | 5 分钟 |
| P1 | BUG-3 seal 删除原图电子印章孤儿文件 | 10 分钟 |
| P1 | BUG-4 seal 删除失败不报错 | 5 分钟 |
| P2 | BUG-5 bankCard `isCanceled` 类型不一致 | 10 分钟 |
| P2 | BUG-6 employee cashierDepartmentName 死代码 | 5 分钟 |
| P2 | BUG-7 seal watch 重复清理 | 10 分钟 |
| P3 | BUG-8 ~ BUG-17 | 各 5-15 分钟 |

---

# 备注

- 本报告**未对业务代码做任何修改**，仅在末尾写报告文件（`docs/bug/2026-08-05-pre-commit-check/02-frontend-pages-A.md`）
- 若需要一次性修复 P0 + P1 共 4 个 bug，建议在当前分支（`dev-chenyanjun`）起一个新 commit，commit message 沿用既有规范：
  `TicketNo:<编号> Description:【<需求号>】出纳子应用提交前自检修复 Feature or BugFix: fix Impact Scope:出纳子应用`
- 修复 BUG-1 后建议同步回归测试：在主应用壳中进入「人员管理-编辑」流程，确认表单所有字段回填