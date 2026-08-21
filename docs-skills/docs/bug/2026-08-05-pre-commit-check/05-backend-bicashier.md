# 后端 bi-cashier 服务只读审查报告

**审查日期**：2026-08-05
**审查对象**：`D:\OB\bi-FOB\bi-cashier`（Spring Boot 2.7 + MyBatis，老项目，不派 spring-boot-engineer）
**审查范围**：与前端 cashier 微应用接口对齐的 7 个业务模块（bankCard / company / employee / seal / store / fileExpiration / operatingScope）+ 新增的 Export / BatchUpdate 链路
**审查方式**：只读，不修改任何业务代码；未运行 mvn/gradle 编译
**改动基线**：`dev-chenyanjun-one` 分支相对 `dev` 的未提交变更（含 43 个文件，+661/-189 行）

---

## 严重程度说明

- 🔴 高：会导致数据安全漏洞、功能不正确、数据丢失、生产事故；上线前必须修复
- 🟡 中：会导致边界场景报错、性能恶化、可维护性差；建议修复
- 🟢 低：命名/一致性/可维护性小问题；可后续清理

---

## 🔴 高优先级

### 🔴 BUG-01：公司数据权限被硬编码"临时放行"，任何登录用户都能查到全部空部门公司

**`file:line`**：
- `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CompanyManageServiceImpl.java:167-169`
- `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/impl/CompanyServiceImpl.java:91-97, 176-182, 304-307, 311-314`

**问题描述**：

代码里 4 处带 `// TODO 临时` 的注释，配合硬编码 SQL 片段，把"数据权限校验"整段绕过，永远 OR 一个固定条件：

```java
// TODO 临时：无条件包含部门为空的数据（后续还原，删除此行即可恢复原逻辑）
dto.setQueryNullDepartment(true);
...
// TODO 临时：注释掉守卫以放行部门为空的数据（后续还原，取消注释即可恢复原逻辑）
// if (currentEmployeeId == null
//     && CollUtil.isEmpty(shareholderUniqueValues)
//     && CollUtil.isEmpty(cashierDepartmentPermissions)) {
//     return Collections.emptyList();
// }
...
.and(w -> {
    boolean any = false;
    // TODO 临时：无条件包含部门为空的数据（后续还原，删除此 if 块即可恢复原逻辑）
    w.apply("(department_id_list IS NULL OR department_id_list = '')");
    any = true;
    if (currentEmployeeId != null) { ... }
    if (CollUtil.isNotEmpty(shareholderUniqueValues)) { ... }
    if (CollUtil.isNotEmpty(cashierDepartmentPermissions)) { ... }
})
```

`pageCompany` / `pageRule` / `listUniqueValuesByPermissionIds` / `queryExactCompanyByUniqueValues` 这 4 处入口都受影响。
最终 SQL 永远是：`... AND (department_id_list IS NULL OR department_id_list = '' OR <user dept matches> OR <legal person match> OR <shareholder match>)`。

**触发场景**：

任意一名登录的出纳用户（哪怕没有任何数据权限 / 不是法人 / 不是股东 / 没分配部门）调：
- `POST /cashier/company/pageCompany`
- `POST /cashier/fileExpiry/pageConfigured`（内部走 `listUniqueValuesByPermissionIds`）
- `POST /cashier/seal/pageSeal`（间接经 `listUniqueValuesByPermissionIds`）

只要目标公司 `department_id_list IS NULL OR = ''`（这是大量新公司、未做归档配置的公司），就会被本次 SQL 全部捞出来。导出接口 `exportCompany` 同理。

**修复建议**：

1. 上线前必须把 4 处 `TODO 临时` 全部还原：恢复 `if(currentEmployeeId == null && ...)` 守卫，删除 `dto.setQueryNullDepartment(true)` 强制赋值，删除裸 `apply("(department_id_list IS NULL OR department_id_list = '')")`。
2. 推荐方案：保留"放行空部门"的合法需求，做成独立的 `Boolean allowEmptyDepartment` 配置开关，由调用方显式传，而不是无脑并入数据权限 OR 链。
3. QA 验证：用无任何权限的账号调用 `pageCompany`，确认返回 `total=0`，否则不能上线。

---

### 🔴 BUG-02：删除经营范围时，子节点未校验被公司引用，存在数据/外键一致性风险

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/OperatingScopeManageServiceImpl.java:131-142, 154-162`

**问题描述**：

```java
@Transactional(rollbackFor = Exception.class)
public Boolean deleteOperatingScope(Long id) {
    // 1. 仅校验当前节点是否被公司引用
    List<CompanyBusinessScope> boundList = companyBusinessScopeService.lambdaQuery()
            .eq(CompanyBusinessScope::getBusinessScopeId, id)
            .eq(CompanyBusinessScope::getDeleted, 0)
            .list();
    if (!boundList.isEmpty()) {
        throw new BusinessException("该经营类型已被使用，不可删除");
    }
    // 2. 直接调用递归删除子节点，未校验子节点是否被引用
    deleteWithChildren(id);
    return true;
}

private void deleteWithChildren(Long parentId) {
    operatingScopeService.deleteOperatingScope(parentId);  // 逻辑删除（BaseEntity @TableLogic）
    List<Long> childrenIds = operatingScopeService.queryChildrenIds(parentId);
    if (!CollectionUtils.isEmpty(childrenIds)) {
        for (Long childId : childrenIds) {
            deleteWithChildren(childId);  // 递归删除每个子节点，未校验子节点是否被引用
        }
    }
}
```

**触发场景**：

父节点 A 是新建的、未被任何公司引用，但有 3 个子节点 A1/A2/A3，**其中 A2 已被某公司引用**。
- 用户调用 `deleteOperatingScope(A)`。
- 第 133 行的校验只看了 A 本身：A 未引用 → 放行。
- `deleteWithChildren(A)` 递归删除 A1/A2/A3，**未校验子节点引用情况**。
- A2 被逻辑删除后，`cashier_company_business_scope` 表中 `businessScopeId=A2` 的记录依然指向一个 `deleted=1` 的经营范围（A2 自身逻辑删除），但 `cashier_company_business_scope.deleted` 是 0，公司详情页查询时**仍会把这条记录返回**，而指向的目标却 `deleted=1`，等于把公司的经营范围删了一半。

**修复建议**：

把"引用检查"放在 `deleteWithChildren` 里递归进行：

```java
private void deleteWithChildren(Long parentId) {
    // 先校验本节点
    List<CompanyBusinessScope> bound = companyBusinessScopeService.lambdaQuery()
            .eq(CompanyBusinessScope::getBusinessScopeId, parentId)
            .eq(CompanyBusinessScope::getDeleted, 0)
            .list();
    if (!bound.isEmpty()) {
        throw new BusinessException("该经营类型（包含子节点）已被使用，不可删除");
    }
    operatingScopeService.deleteOperatingScope(parentId);
    List<Long> childrenIds = operatingScopeService.queryChildrenIds(parentId);
    for (Long childId : childrenIds) {
        deleteWithChildren(childId);
    }
}
```

或者改成：删除前先全树扫描（用栈/BFS），把"被引用的子节点 ID 集合"算出来，如果有交集直接拒绝。

---

### 🔴 BUG-03：员工导出身份证号权限校验缺失，与公司/店铺导出行为不一致

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/EmployeeManageServiceImpl.java:397-453`

**问题描述**：

```java
@Override
public String exportCashierEmployee(EmployeePageDTO dto) {
    ...
    // 4. 组装导出行
    for (EmployeeVO vo : employeeList) {
        ...
        // 身份证号：敏感字段，按权限脱敏
        row.setIdentityCardNumber(resolveEmployeeIdCard(vo));
        ...
    }
    excelExportService.exportExcel(...);
}

private String resolveEmployeeIdCard(EmployeeVO vo) {
    String plain = vo.getIdentityCardNumber();
    if (CashierExportUtils.hasSensitivePermission() && StringUtils.isNotEmpty(plain)) {
        return plain;   // ★ ThreadLocal 没被 set，永远 false
    }
    ...
}
```

对比 `CompanyManageServiceImpl.exportCompany` 和 `StoreManageServiceImpl.exportStore`：

```java
try {
    boolean hasStoreFieldPerm = fieldPermissionService.hasAnyFieldPermission(TwoLevelEnum.DPGL);
    CashierExportUtils.setSensitivePermission(hasStoreFieldPerm);  // ★ 公司/店铺都做了 set
    excelExportService.exportExcel(...);
} finally {
    CashierExportUtils.clearSensitivePermission();
}
```

**`exportCashierEmployee` 完全漏了 `CashierExportUtils.setSensitivePermission(...)` 包裹**，`ThreadLocal` 默认是 `null`，`hasSensitivePermission()` 永远返回 `false`。
结果：
- 有 `EMP_ID_CARD` 字段权限的运营/HR 主管导出员工表 → 拿到的身份证号全是脱敏的，不符合需求
- 同时 catch/finally 不存在，ThreadLocal 未被清理

**触发场景**：运营主管调 `POST /cashier/employee/exportCashierEmployee`，按字段权限他应该拿到明文身份证号用于核对；现在全是 `110101********1234` 形式，业务无法继续。

**修复建议**：

```java
@Override
public String exportCashierEmployee(EmployeePageDTO dto) {
    ...
    try {
        boolean hasEmpFieldPerm = fieldPermissionService.hasAnyFieldPermission(TwoLevelEnum.YGXX);
        CashierExportUtils.setSensitivePermission(hasEmpFieldPerm);
        excelExportService.exportExcel(fileId, fileName, userName, Collections.singletonList(exportData));
    } finally {
        CashierExportUtils.clearSensitivePermission();
    }
    return fileId;
}
```

并把 `EXP_PAGE_SIZE` 调用的逻辑挪出 try（与公司/店铺导出保持一致）。
注意确认 `TwoLevelEnum` 中"员工管理"枚举值是否存在，如不存在需要新增或在 `FieldPermissionServiceImpl.isModuleField` 加上对应映射。

---

### 🔴 BUG-04：`addBankCard` 缺 `@Transactional`，三段写入无法回滚，存量数据污染风险

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:271-285`

**问题描述**：

```java
@Override
public String addBankCard(BankCardSaveDTO dto) {
    if (bankCardService.isAccountNumberExists(dto.getAccountNumber(), null)) {
        throw new BusinessException("该银行账号已存在，无法重复提交");
    }
    BankCard bankCard = BeanCopyUtils.copy(dto, BankCard::new);
    String str = bankCardService.addBankCard(bankCard);     // 写入 ①
    // 保存文件-标签关联（写入文件到期记录表）
    saveBankCardFileTags(dto, true);                         // 写入 ②
    // 自定义标签入库（按文件模块保存到标签库，下次可选）
    saveBankCardCustomTags(dto);                             // 写入 ③
    // 保存文件（bi-file 服务）
    fileChange(dto);                                         // 写入 ④（Feign）
    return str;
}
```

对比 `updateBankCard` 第 287 行有 `@Transactional(rollbackFor = Exception.class)`、`deleteBankCard` 第 471 行有、`batchUpdateBankCardField` 第 516 行有。
**唯独 `addBankCard` 缺注解。**

**触发场景**：

1. 银行卡主表写入成功 → `saveBankCardFileTags` 在 `addBankCardFileTags` 中执行 `fileExpiryRecordService.listByUniqueValue(null, accountNumber)` 抛 NPE / DB 异常 → 主表已落库，`file_expiry_record` 没写入，留下脏数据。
2. `addBankCardFileTags` 全部成功，但 `fileTagLibraryService.saveCustomTags` 远程调用超时 → 主表 + `file_expiry_record` 已落库，标签库没写入，导致下次下拉选择器看不到用户刚打的自定义标签。
3. 走到 `fileChange(dto)` 时 bi-file 抛出 → 整条 `cashier_bank_card` 和文件-标签关联虽落库，但 bi-file 中没有对应文件记录，详情页查不到文件。

**修复建议**：

```java
@Transactional(rollbackFor = Exception.class)
@Override
public String addBankCard(BankCardSaveDTO dto) { ... }
```

注意 `fileChange` 内部会通过 Feign 远程调 bi-file（不在事务内），bi-file 与本地 DB 的最终一致性可能存在窗口期，但起码本地 DB 那段要保证原子。

---

### 🔴 BUG-05：删除银行卡不清理 `file_expiry_record`，留下悬空引用

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:471-493`

**问题描述**：

```java
@Transactional(rollbackFor = Exception.class)
@Override
public Boolean deleteBankCard(String accountNumber) {
    if (StringUtils.isBlank(accountNumber)) {
        throw new BusinessException("账号不能为空");
    }
    BankCard bankCard = bankCardService.queryBankCardById(accountNumber);
    if (bankCard == null) {
        throw new BusinessException("数据不存在请刷新页面");
    }
    List<Long> companyBoundBankCardIds = companyBankCardService.listBoundBankCardIds(null);
    if (companyBoundBankCardIds.contains(bankCard.getId())) {
        throw new BusinessException("该银行卡已被使用，不可删除");
    }
    List<Store> boundStores = storeService.listByBankCardId(bankCard.getId());
    if (!boundStores.isEmpty()) {
        throw new BusinessException("该银行卡已被使用，不可删除");
    }
    return bankCardService.deleteBankCard(accountNumber);   // 只软删主表
}
```

没有同步清理 `cashier_file_expiry_record` 中 `source_module` 属于该银行卡的所有记录（账户查询单/开户资料/销户回执三类）。
更严重的是：检查"是否被店铺引用"只看 `boundStores` 是否为空，但 `store.bank_card_id` 与 `store.deleted=1` 之外的软删除记录也未排除。`storeService.listByBankCardId(bankCard.getId())` 来自 `StoreServiceImpl.listByBankCardId`，已含 `eq(Store::getDeleted, 0)`，OK；但若店铺先被删除后又被强制恢复，bank_card 已被删的会失败——这不是 bug，只是个隐藏陷阱。

**触发场景**：

1. 运营误删了一张已上传"销户回执"等文件的银行卡 → 主表 `deleted=1`，但 `cashier_file_expiry_record.source_unique_value` 仍指向该账号。
2. 后续的"已设文件"列表查询（`pageConfigured`）靠 `cashier_file_expiry_record LEFT JOIN cashier_bank_card ON account_number` 查 sourceName：
   ```sql
   LEFT JOIN cashier_bank_card bc ON main.source_unique_value = bc.account_number AND bc.deleted = 0
   ```
   `bc.deleted = 0` 过滤 → `sourceName` 取 `s.store_name`/`c.company_name` 的 COALESCE，最终回退到未知值，不会 NPE，但**记录会以"未识别来源"出现在"文件到期"列表**，且用户找不到实体去删它（实际可调 `cancelExpiration(unName)`，但发现路径很别扭）。

**修复建议**：

```java
@Transactional(rollbackFor = Exception.class)
@Override
public Boolean deleteBankCard(String accountNumber) {
    ...
    boolean ok = bankCardService.deleteBankCard(accountNumber);
    // 同步逻辑删除该账号三类文件到期记录
    Arrays.asList(
        SourceModuleEnum.BANK_CARD_ACCOUNT_QUERY_FILES,
        SourceModuleEnum.BANK_CARD_OPENING_FILES,
        SourceModuleEnum.BANK_CARD_CANCEL_RECEIPT_FILES
    ).forEach(module -> fileExpiryRecordService.deleteByUniqueValueAndModule(accountNumber, module));
    return ok;
}
```

需在 `IFileExpiryRecordService` 新增 `deleteByUniqueValueAndModule(uniqueValue, sourceModule)` 方法，先按 `source_unique_value` + `source_module` 双键删除，避免误删其他模块同名记录。

---

## 🟡 中优先级

### 🟡 BUG-06：`FileExpiryRecordServiceImpl.listByUniqueValue` 调用方传 `null` 时等同不过滤，多次扫全表

**`file:line`**：`bi-cashier-component/src/main/java/com/obo/bi/cashier/service/impl/FileExpiryRecordServiceImpl.java:65-73`

**问题描述**：

```java
@Override
public List<FileExpiryRecord> listByUniqueValue(SourceModuleEnum sourceModule, String uniqueValue) {
    if (uniqueValue == null || uniqueValue.isEmpty()) {
        return Collections.emptyList();
    }
    return this.lambdaQuery()
            .eq(FileExpiryRecord::getSourceUniqueValue, uniqueValue)
            // ★ sourceModule == null → false → 该过滤条件整体被跳过 → 等价 SELECT * WHERE source_unique_value = ?
            .eq(sourceModule != null, FileExpiryRecord::getSourceModule, sourceModule == null ? null : sourceModule.getValue())
            .list();
}
```

`BankCardManageServiceImpl.saveBankCardFileTags` 在 `isAdd=false` 路径下调它：

```java
List<FileExpiryRecord> dbRecords = fileExpiryRecordService.listByUniqueValue(null, accountNumber);
dbMap = dbRecords.stream()
        .filter(r -> r.getUnName() != null)
        .collect(Collectors.toMap(FileExpiryRecord::getUnName, Function.identity(), (a, b) -> a));
```

由于 `dbMap` 用 `unName` 做 key，**三类（账户查询单/开户资料/销户回执）共享前缀**，可能冲突！
举例：账户查询单 `unName=foo123` 和开户资料 `unName=foo123`（同一批上传，文件名 hash 撞了），`Collectors.toMap(key, val, (a,b) -> a)` 会拿先出现的丢弃后出现的，导致后续 `dbMap.remove(unName)` 在 `addBankCardFileTags` 里漏删。

**触发场景**：

跨模块同名 unName 的极小概率事件 + 触发后无明显 bug 现象（数据看起来正常），但"修改银行卡"会留下"应该删除但实际未删除"的过期记录；下次查询时 `queryBankCardById` 走 `toFileList` 按 `unName` 取带标签/期间记录，拿到 1 条但其实有 2 条，列表只展示一份。

**修复建议**：

1. `BankCardManageServiceImpl.addBankCardFileTags` 的 `dbMap` 拼接时改用 `Collectors.toMap(unName, rec, (a,b) -> a, HashMap::new)` + 显式按 `(sourceModule, unName)` 做复合 key（`sourceModule::getValue + "|" + unName`）。
2. 或者在 `IFileExpiryRecordService` 新增 `listByUniqueValueAndModule` 方法，强制带 source_module 查询，让 `saveBankCardFileTags` 三次分别调用而不是用同一 dbMap。

---

### 🟡 BUG-07：`FileExpiryRecordServiceImpl.listByUniqueValue` 第三方参数签名歧义：传 null 即"查所有模块"

**`file:line`**：同上 + `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CompanyManageServiceImpl.java:690`、`StoreManageServiceImpl.java:362`

**问题描述**：

```java
// CompanyManageServiceImpl.deleteCompany
companyShareholderService.deleteByUniqueValue(uniqueValue);
companyBankCardService.deleteByUniqueValue(uniqueValue);
companyBusinessScopeService.deleteByUniqueValue(uniqueValue);
companyTaxVerificationService.deleteByUniqueValue(uniqueValue);
fileExpiryRecordService.deleteByUniqueValue(uniqueValue);   // 删的是"全部 sourceModule"
```

签名是 `Boolean deleteByUniqueValue(String uniqueValue)`，无 sourceModule 参数。删除公司/店铺时，会把 `cashier_file_expiry_record` 中所有 sourceModule 下 sourceUniqueValue 等于该 uniqueValue 的记录一并删，包括：
- `COMPANY_FILE_LIST`
- `COMPANY_TRADEMARK_FILE_LIST`
- `STORE_SPECIAL_CATEGORY_QUALIFICATION_CERTIFICATE`（理论上不会撞 store uniqueValue，但理论上不防）
- 银行卡三类（理论上不会撞，但理论上不防）

如果将来引入"同名 uniqueValue" 业务（注意：当前格式是 `CG-/ST-` + ID 区分，所以同表不会撞；但跨表仍可能撞），将来某次重构把 uniqueValue 改通用格式就崩了。

**触发场景**：

- 当前不会立即触发，但属于"将来重构炸弹"。
- 另一个连带担忧：`saveFilePeriodsFromMergedList` 第 478 行 `fileExpiryRecordService.deleteByUniqueValue(storeUniqueValue)` 也是无 module 过滤，会把该 store 关联的所有 `SOURCE_MODULE` 全部删。当前 `deleteStore` 中已经只删 SPEC 模块的，但同方法中 `saveFilePeriodsFromMergedList(isAdd=false)` 里又调了一次全删；两边行为需要厘清。

**修复建议**：

1. 统一把方法签名改成 `deleteByUniqueValueAndModule(uniqueValue, sourceModule)`，强制调用方指定 sourceModule。
2. `CompanyManageServiceImpl.deleteCompany` 中按需调用 `COMPANY_FILE_LIST` 和 `COMPANY_TRADEMARK_FILE_LIST` 两次。
3. `StoreManageServiceImpl` 的 `saveFilePeriodsFromMergedList(isAdd=false)` 也要带上 `STORE_SPECIAL_CATEGORY_QUALIFICATION_CERTIFICATE` 参数。

---

### 🟡 BUG-08：`BankCardManageServiceImpl.exportBankCard` 三类文件下载链接已被前端列表展示过，复查是"敏感链接"误泄露

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:135-180`

**问题描述**：

```java
List<String> skuCodeList = new ArrayList<>();
for (BankCard card : bankCardList) {
    if (card == null || StringUtils.isEmpty(card.getAccountNumber())) {
        continue;
    }
    skuCodeList.add(accountQueryPrefix + card.getAccountNumber());
    skuCodeList.add(openingPrefix + card.getAccountNumber());
    skuCodeList.add(cancelReceiptPrefix + card.getAccountNumber());
}
Map<String, String> fileLinkMap = CashierExportUtils.loadFileLinkTextBySkuCodes(fileClient, skuCodeList);
```

`loadFileLinkTextBySkuCodes` 走 `fileClient.queryFileUploadRecordBySkuCodeList`，返回纯 `http_path` 字符串。

**问题**：

1. 文件元数据 `http_path` 是不是"敏感"取决于产品策略；如果文件是销户回执（含账号、身份证号等），导出后无加密落到下载中心，敏感信息外泄。
2. 当前没有走 `CashierExportUtils.setSensitivePermission(...)` 包裹，`hasSensitivePermission` 默认 false，但导出文件链接的逻辑又**不通过** `password()` / `idCard()` 等脱敏路径——直接透传。原本"权限不足→脱敏"的语义在导出 Excel 中不适用（文件 url 无法脱敏），但代码没在导出前后写敏感标记，QA 验证时会糊涂。
3. 公司导出导出的"文件标签列" `file_<tag>` 用 `fileUrl`，见 `CompanyManageServiceImpl.exportCompany:606-609`，同样问题：标签对应的 URL 是否需要受字段权限控制？目前答案是：URL 体现在文件元数据上就出去了。

**修复建议**：

- 与产品明确"列表展示"、"详情展示"、"导出"三场景对敏感链接（身份证正反面、销户回执、账户查询单）是否走同一套脱敏/打码/水印。
- 至少先把 `exportBankCard` 和 `exportCompany` 在循环 `loadFileLinkTextBySkuCodes` 前后用 try-finally 包 `setSensitivePermission/clearSensitivePermission`，对齐导出骨架。
- 若产品决定"导出含水印明文 URL"，建议在 `excelExportService.exportExcel` 里加水印配置。

---

### 🟡 BUG-09：`CompanyManageServiceImpl.saveCompanyFileTags` 在 `isAdd=true` 但 `dbMap == null` 处 NPE 风险

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CompanyManageServiceImpl.java:1041-1100`

**问题描述**：

```java
private void saveCompanyFileTags(CompanySaveRequestDTO dto, boolean isAdd) {
    if (dto == null || CollUtil.isEmpty(dto.getCompanyFileList())) {
        return;
    }
    List<FileExpiryRecord> toInsert = new ArrayList<>();
    Map<String, FileExpiryRecord> dbMap = null;
    if (!isAdd) {   // 仅当 isAdd=false 才建 Map
        List<FileExpiryRecord> dbRecords = fileExpiryRecordService.listByUniqueValue(...);
        dbMap = ...;
    }
    for (FileUploadRecordList fileItem : dto.getCompanyFileList()) {
        ...
        if (!isAdd && dbMap.containsKey(unName)) {   // ★ isAdd=true 时 dbMap == null，此分支永不命中，OK
            ...
        } else {
            ...
        }
    }
    if (!isAdd && !dbMap.isEmpty()) {        // isAdd=true 时 dbMap=null，不会 NPE，但 isAdd=false 时若 null 处理过也 OK
        fileExpiryRecordService.removeByIds(dbMap.values());
    }
    ...
}
```

抽看后没看到真正的 NPE。但有一个**真实问题**：
- `CompanyManageServiceImpl.addCompanyAll` 第 886 行调 `saveCompanyFileTags(request, true);`
- 而 `addCompanyAll` 流程里 step 1 是 `companyService.addCompany(company)`（写主表） → step 3 才 `fileChange(request)` → step 4 才 `saveCompanyFileTags(request, true)`。
- 如果 `saveCompanyFileTags` 走到 `applyMatchedRuleOnAdd` 时匹配了规则，`matchedRule.getValidityDays()` 加到 `expiryDate` 上（见 `FileExpiryRuleManageServiceImpl.applyMatchedRuleOnAdd:280`），但此时 `rec.getExpiryDate()` 还是从入参 `fileItem.getExpiryDate()` 拿的日期，**叠加后被 `saveBatch` 写库时已经改过了**。即"以新文件入参 expiryDate + rule.validityDays"写——业务侧可能期望的是"以生效日期为锚点向后推 validityDays 天"，目前的实现把原 expiryDate 给 cover 掉了。

**触发场景**：

运营配置了一条"营业执照"规则，validityDays = 90。新上传了"营业执照"文件，前端传 expiryDate=2026-09-01。匹配规则后写入 `2026-09-01 + 90 = 2026-11-30`。原 expireDate 失真，违背"运营人员在表单填什么就存什么"的预期。

**修复建议**：

在 `FileExpiryRuleManageServiceImpl.applyMatchedRuleOnAdd` 里：

```java
Integer validityDays = matchedRule.getValidityDays();
if (validityDays != null && record.getEffectiveTime() != null) {
    // 改以 effectiveTime 为锚点
    record.setExpiryDate(record.getEffectiveTime().plusDays(validityDays));
} else if (validityDays != null) {
    record.setExpiryDate(record.getExpiryDate() == null
        ? LocalDate.now().plusDays(validityDays)
        : record.getExpiryDate().plusDays(validityDays));
}
```

或者与产品对一下"`expiryDate` 是合同到期日，`validityDays` 是规则的有效期"，看哪个优先。

---

### 🟡 BUG-10：`EmployeeManageServiceImpl.exportCashierEmployee` 漏 `setSensitivePermission/clearSensitivePermission`，与公司/店铺导出骨架不一致

**（与 BUG-03 重复）** ——  已在 BUG-03 单独列出。

---

### 🟡 BUG-11：`EmployeeManageServiceImpl.fillCompanyCounts` 远程调用失败时整体行为

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/EmployeeManageServiceImpl.java:512-544`

**问题描述**：

```java
private void fillCompanyCounts(List<EmployeeVO> voList) {
    ...
    // 2. 批量查询法人公司数量
    Map<Long, Long> legalPersonCountMap = companyService.countByLegalPersonIds(employeeIds);
    // 3. 批量查询股东公司数量
    Map<Long, Long> shareholderCountMap = companyShareholderService.countByShareholderIds(employeeIds);
    ...
}
```

`fillCompanyCounts` 只在内存中处理返回 map。当 `companyService.countByLegalPersonIds` 内部失败时，`countByLegalPersonIds` 是直接抛还是返回空 map？去看一下：它在 `CompanyServiceImpl.countByLegalPersonIds` 用 `Collectors.counting()` groupBy，是纯 SQL 聚合查询。

**潜在隐患**：

1. `fillCompanyCounts` 在 `pageCashierEmployee`、`queryCashierEmployeeDetail`、`listAllCashierEmployee`、`listCashierEmployees` 4 处都被调用。每次都是一次额外的 `IN` + `GROUP BY`。前端 4 个入口在某些操作下都跑，对 MySQL 是 ok 的；但对无任何关联公司的人员，每次都会 round trip 一次。
2. 若 `companyService.countByLegalPersonIds` 抛异常，**没有 try-catch**，会回传到 controller 层 → 整个人员列表接口失败；不应如此致命。

**修复建议**：

```java
private void fillCompanyCounts(List<EmployeeVO> voList) {
    if (CollUtil.isEmpty(voList)) return;
    List<Long> employeeIds = voList.stream()...;
    if (employeeIds.isEmpty()) return;
    Map<Long, Long> legalPersonCountMap = Collections.emptyMap();
    Map<Long, Long> shareholderCountMap = Collections.emptyMap();
    try {
        legalPersonCountMap = companyService.countByLegalPersonIds(employeeIds);
    } catch (Exception e) {
        log.warn("批量查询法人公司数量失败, employeeIds={}", employeeIds.size(), e);
    }
    try {
        shareholderCountMap = companyShareholderService.countByShareholderIds(employeeIds);
    } catch (Exception e) {
        log.warn("批量查询股东公司数量失败, employeeIds={}", employeeIds.size(), e);
    }
    ...
}
```

容错，单接口失败不影响主列表返回。

---

### 🟡 BUG-12：`StoreManageServiceImpl.addStoreAll` 第 280 行 `isStoreCodeExists` 二次校验冗余

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/StoreManageServiceImpl.java:278-304`

**问题描述**：

```java
@Transactional(rollbackFor = Exception.class)
public String addStoreAll(StoreSaveRequestDTO request) {
    if (storeService.isStoreCodeExists(request.getStoreCode(), null)) {  // 校验 ①
        throw new BusinessException("店铺编码已存在无法添加");
    }
    validateStore(request, null);  // 校验 ②（含同样 isStoreCodeExists 检查）
    ...
}
```

`validateStore` 内第 709 行：

```java
if (storeService.isStoreCodeExists(request.getStoreCode(), excludeUniqueValue)) {
    throw new BusinessException("店铺编码已存在，请使用其他编码");
}
```

两次 `countByStoreCode` 查询，重复一次 DB round trip。
更严重的是，**两次校验之间没有事务隔离保证**，理论上极端竞态：
- 线程 A 调 `addStoreAll` → 通过 ① → 进入 `validateStore` → 通过 ② → 还没 insert
- 线程 B 调 `addStoreAll` 同 storeCode → 通过 ① → 进入 `validateStore` → 通过 ② → 还没 insert
- A insert → B insert → UNIQUE KEY 异常（非 null 唯一索引报错）

`cashier_store.store_code` 没看到 unique key。从 `StoreMapper.xml.countByStoreCode` 看到的是普通 count，没有 unique 检测兜底。所以**没有 DB 兜底，仅靠业务层两次 count 校验**，存在竞态。事务隔离级别默认 RR，单条语句 OK；但两个事务都 SELECT count(*) 后各自 INSERT，可以并发通过。

**修复建议**：

1. 删掉 `addStoreAll` 第 280-282 行的校验，让 `validateStore` 统一做。
2. 数据库加 `UNIQUE KEY uk_store_code (store_code, deleted)`（MySQL 8.0 唯一索引允许 deleted 列以支持"软删除+唯一"）。
3. 在 `validateStore` 抛异常文案调到 `addStoreAll` 那块（"店铺编码已存在无法添加"）保持一致。

---

### 🟡 BUG-13：`BankCardManageServiceImpl.batchUpdateBankCardField` 空列表导致 IN () 报错

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:517-545`

**问题描述**：

```java
public Boolean batchUpdateBankCardField(BankCardBatchUpdateFieldDTO dto) {
    List<String> accountNumbers = dto.getAccountNumbers();
    if (CollUtil.isEmpty(accountNumbers) || accountNumbers.stream().anyMatch(StringUtils::isBlank)) {
        throw new BusinessException("银行账号列表不能为空");
    }
    LambdaUpdateWrapper<BankCard> wrapper = new LambdaUpdateWrapper<>();
    wrapper.in(BankCard::getAccountNumber, accountNumbers);
    int fieldCount = 0;
    if (dto.getBankType() != null) {
        wrapper.set(BankCard::getBankType, dto.getBankType());
        fieldCount++;
    }
    ...
    if (fieldCount == 0) {
        throw new BusinessException("至少传入一个待更新字段");
    }
    return bankCardService.update(wrapper);
}
```

逻辑上"空列表"已被前面 `isEmpty` 挡掉。但：

1. Controller 是 `Required=false` 默认 → Spring 反序列化时如果前端传 `accountNumbers: [""]`，每个元素都是空串，`anyMatch(isBlank)` 能挡；但传 `accountNumbers: ["a", ""]`，`isEmpty` 不过、`anyMatch(isBlank)` 过 → 正常抛异常 → OK。
2. 但若前端**完全没传 `accountNumbers` 字段**（即 `null`），`wrapper.in(BankCard::getAccountNumber, null)` 是 MyBatis Plus 的"in null"，实际生成 SQL `WHERE account_number IN (NULL)` 永远空匹配。OK，不报错。
3. **真实问题**：当列表中**全部都是同一账号**，且账号不存在 → IN 命中 0 行 → `bankCardService.update(wrapper)` 返回 `false`（MyBatis Plus update 返回受影响行数），前端按 boolean 拿到的就是 false，提示"更新失败"，但实际是"无目标"，应给"匹配 0 条"。

**触发场景**：

前端批量选择 10 条记录，账号拼成 list 提交，后端校验：10 个都不存在 → 返回 false → 前端弹"更新失败"。

**修复建议**：

1. 在 `wrapper.set(...)` 之前先 SELECT COUNT(*) 用相同 accountNumbers 过滤，0 行时 throw "无匹配银行卡账号"。
2. 或者直接返回更新行数（`int`，而非 `Boolean`），前端根据 `==0` 给出"无匹配"。

```java
int rows = bankCardService.getBaseMapper().selectCount(
    new LambdaQueryWrapper<BankCard>()
        .in(BankCard::getAccountNumber, accountNumbers)
        .eq(BankCard::getDeleted, 0));
if (rows == 0) {
    throw new BusinessException("未匹配到任何银行卡账号");
}
...
return bankCardService.update(wrapper);
```

---

### 🟡 BUG-14：`CommonManageServiceImpl.getCurrentCashierDepartment` 等 3 个远程调用无重试/降级，NPE 会冒到前端

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CommonManageServiceImpl.java:36-96`

**问题描述**：

3 个方法都直接转发 `Result.getData()` 而不校验 `success`：

```java
Result<String> result = employeeFileHeadClient.queryCashierDepartmentByUsername(userName);
if (result == null) {
    throw new BusinessException(...);
}
if (!ResultEnum.SUCCESS.getCode().equals(result.getCode())) {
    throw new BusinessException(...);
}
return result.getData();   // ★ result.getData() 可能为 null，前端拿到 null
```

文档说明"员工档案不存在时为 null"，但返回 null 前没有归一化：
- `listCurrentCashierDepartmentManagePermissionIds` 用 `Collections.emptyList()` 兜了；
- `getCurrentCashierDepartment` 用 null 直接抛；
- `getCurrentEmployeeId` 用 null 直接 return。

代码注释里也明说"由调用方按业务做空值校验"。但调用方在批量接口里大量使用，调一漏万：

`pageCashierEmployee` 经 `EmployeeManageServiceImpl.pageCashierEmployee` → `EmployeeFileHeadClient` 调用，并不通过 `CommonManageServiceImpl`，OK；
`pageCompany` → `CommonManageServiceImpl.getCurrentEmployeeId` → 接到 null → `cashierDepartmentPermissions` 空 → 与 BUG-01 一并跑出"无条件返回空部门公司"。

**触发场景**：

新员工刚入职，没维护 employeeFileHead 记录，调 `pageCompany`：
1. `getCurrentEmployeeId()` → null
2. `listUniqueValuesByShareholderId(null)` → emptyList
3. `listCurrentCashierDepartmentManagePermissionIds(GSGL)` → emptyList
4. 第 3 个全部为 null/empty → 因为 BUG-01，SQL 还是返回了"空部门公司"列表 → 误导。

**修复建议**：

参见 BUG-01，配合一起修：在 `pageCompany` 第 173-178 行补"如果 3 个都空且 queryNullDepartment=false，直接返回空页"。当前代码已经有这个守卫，但因为 BUG-01 强制 `setQueryNullDepartment(true)`，守卫永远失效。

---

### 🟡 BUG-15：`CompanyManageServiceImpl.batchUpdateCompanyField` `departmentIdList == null` 与 `companyStatus == null` 同为 null 的边界

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CompanyManageServiceImpl.java:706-730`

**问题描述**：

```java
public Boolean batchUpdateCompanyField(CompanyBatchUpdateFieldDTO dto) {
    List<String> uniqueValues = dto.getUniqueValues();
    if (CollUtil.isEmpty(uniqueValues) || uniqueValues.stream().anyMatch(StringUtils::isBlank)) {
        throw new BusinessException("公司业务唯一流水号列表不能为空");
    }
    ...
    if (departmentIdList == null && companyStatus == null) {
        throw new BusinessException("至少传入一个待更新字段");
    }
    if (departmentIdList != null) {
        Company patch = new Company();
        patch.setDepartmentIdList(departmentIdList);
        return companyService.update(patch,
                new LambdaUpdateWrapper<Company>().in(Company::getUniqueValue, uniqueValues));
    }
    return companyService.lambdaUpdate()
            .in(Company::getUniqueValue, uniqueValues)
            .set(Company::getCompanyStatus, companyStatus)
            .update();
}
```

注释说："`companyStatus=""` / `departmentIdList=[]` 视为清空该字段"——

1. `companyStatus=""` 调用 `set(CompanyStatus, "")` → 写入空串。OK。
2. `departmentIdList=[]`（空列表）：走 `if (departmentIdList != null)` 分支 → entity-based update → `StringListTypeHandler` 把空列表序列化为"" 写入。OK。
3. **`departmentIdList=null` 且 `companyStatus=null`**：上面守卫已拦，正常。
4. 但是 **`companyStatus=""` 且 `departmentIdList=null`**：让 `companyService.update(patch, ...)` 走 entity-based 分支但 `patch.setDepartmentIdList(null)`，这时 `company.departmentIdList = null`，`update(patch, ...)` 经 `StringListTypeHandler` 反序列化时若 handler 用 `commons-lang3` 的 split，没值 → 写入空串（OK）。但若 `patch.setDepartmentIdList(null)` 没被写入，则 `department_id_list` 列维持原值——这个分支"什么都没传"等价于"什么都不改"，**与"传了空数组==清空"的语义不一致**。

**触发场景**：

```json
POST /cashier/company/batchUpdateField
{
  "uniqueValues": ["CG-..."],
  "companyStatus": ""
}
```

期望：清空 companyStatus。但代码进 `if (departmentIdList != null) == false` 分支（因为 departmentIdList 是 null），进 `else` 分支后 `set(CompanyStatus, "")` 写入空串 → OK。
但若 JSON：
```json
{
  "uniqueValues": ["CG-..."],
  "departmentIdList": null
}
```

进 `if (departmentIdList != null) == false`（null != null == false），进 `else` 分支 → `companyService.lambdaUpdate()...set(Company::getCompanyStatus, null)` → 因为 companyStatus 是 null，`eq(... != null, SFunction, value)` 在 MP 中跳过该 set → **完全没更新**。前端期望"至少有 1 个字段要更新"，但实际上什么都不做，与 `if (fieldCount == 0) throw` 的守卫逻辑不一致——这个守卫只看局部（`if (departmentIdList == null && companyStatus == null)`），但只看"两个都 null"才抛，单 null 是悄悄走过。

**修复建议**：

1. 在 batchUpdateField 把语义统一：
   - 两个都 null → 抛 "至少传入一个待更新字段"
   - departmentIdList 是空数组 → 走 set(null)
   - companyStatus 是空串 → 走 set("")
   - 但是 **departmentIdList 是 null 而 companyStatus 非 null** 也走 else 分支时要把 companyStatus 非 null 强制检查！
2. 或者用前端契约：批量更新接口必须 `departmentIdList=null || !isEmpty`，二选一，要么 departmentIdList 要么 companyStatus。

---

### 🟡 BUG-16：`BankCardController.queryByAccountNumber` / `deleteBankCard` 等 `@RequestParam` 与 `String` 绑定，缺少 `required=false`

**`file:line`**：`bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/BankCardController.java:44-46, 70-74`

**问题描述**：

```java
@ApiOperation("根据账号查询银行卡详情")
@PostMapping("/queryByAccountNumber")
public Result<BankCardVO> queryByAccountNumber(@RequestParam("accountNumber") String accountNumber) {
    return Result.success(bankCardManageService.queryBankCardById(accountNumber));
}
```

`@PostMapping` + `@RequestParam`，按 Spring 绑定规则：

- 若前端 post body 是 `application/x-www-form-urlencoded`，参数从 form 字段取。
- 若前端 post body 是 `application/json`，`@RequestParam` **会找不到参数** → 直接抛 `MissingServletRequestParameterException`（400）。
- 当前前端代码（`src/pages/bankCard/apis/index.ts`）若用 `axios.post('/cashier/bankCard/queryByAccountNumber', { accountNumber: 'xxx' })`，axios 默认 `Content-Type: application/json` → 400 错误。

**触发场景**：

类似 `queryByAccountNumber`、`deleteBankCard`、`CompanyController.queryCompanyDetail`、`deleteCompany`、`CompanyController.updateStoreQualification(uniqueValue, hasStoreQualification)`、`StoreController.queryStoreDetail`、`deleteStore`、`listStoreByCompanyUniqueValue(companyUniqueValue)`、`SealController` 多处均有此绑定。

如果前端提交的 Content-Type 与 axios 默认设置不匹配 → 400。

**修复建议**：

1. 把这些接口改 `@RequestBody XxxDto dto { String accountNumber }`（post + JSON）。
2. 或者用 `@RequestParam(value="accountNumber", required=false)` + 手写空值校验。
3. 或者用 `@PathVariable` 把参数走 URL，例如：`/queryByAccountNumber/{accountNumber}`。

最快的兼容方案：把这些 Controller 方法签名改成"@RequestBody + JSON DTO"（约定俗成，整个项目其它接口全是 post + JSON，避免局部不一致）。

---

### 🟡 BUG-17：`CompanyManageServiceImpl.listAllCompanyWithBusinessScope` 分页未保护，全量回传到前端

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CompanyManageServiceImpl.java:799-843`

**问题描述**：

```java
@Override
public List<CompanyBusinessScopeVO> listAllCompanyWithBusinessScope() {
    List<Company> companies = companyService.listAllCompanies();   // 全量
    if (companies.isEmpty()) {
        return Collections.emptyList();
    }
    ...
    Map<String, List<CompanyBusinessScope>> scopeMap;
    if (!uniqueValues.isEmpty()) {
        List<CompanyBusinessScope> allScopes = companyBusinessScopeService.listByUniqueValues(uniqueValues);
        scopeMap = allScopes.stream().collect(Collectors.groupingBy(CompanyBusinessScope::getUniqueValue));
    }
    ...
    return companies.stream().map(company -> {
        ...
        List<Long> collect = scopes.stream().map(CompanyBusinessScope::getBusinessScopeId).collect(Collectors.toList());
        // ★ 在 N 个公司每个循环里再触发 operatingScopeService.lambdaQuery().in(OperatingScope::getId, collect).list();
        // → N+1 查询（外层 listAllCompanies 是 1 次，每个公司经营范围查询又是 1 次）
        List<OperatingScope> list = operatingScopeService.lambdaQuery()
                .in(OperatingScope::getId, collect)
                .list();
        ...
    }).collect(Collectors.toList());
}
```

1. 公司量小（几千）时还好，公司量上万 → 一次 HTTP 返回上 MB 数据 + N 次 DB round trip。
2. 没分页、没上限。

**触发场景**：

前端 `RemoteSearchSelect` 下拉接口，下拉框一次性渲染几千条。

**修复建议**：

1. SQL 层一次性拉"公司 + 经营范围 + 经营范围详情" 三表连表查询，内存中 groupBy 重组。
2. 或者接口入参加 `keyword` / `industryCategory` 过滤，限定返回值。

---

### 🟡 BUG-18：`StoreMapper.xml.pageStore` 行 37-57 `<choose>` 注释顺序影响行为

**`file:line`**：`bi-cashier-web/src/main/resources/mapper/StoreMapper.xml:36-57`

**问题描述**：

```xml
<!-- 数据权限：当前登录用户的出纳部门权限列表 OR 当前用户是经营者；两者皆空则返回空集，避免越权全量 -->
<choose>
    <when test="(departmentIds != null and departmentIds.size() > 0) or operatorId != null">
        AND (
            <if test="departmentIds != null and departmentIds.size() > 0">
                department_id IN
                <foreach collection="departmentIds" item="deptId" open="(" separator="," close=")">
                    #{deptId}
                </foreach>
            </if>
            <if test="(departmentIds != null and departmentIds.size() > 0) and operatorId != null">
                OR
            </if>
            <if test="operatorId != null">
                operator_id = #{operatorId}
            </if>
        )
    </when>
    <otherwise>
        AND 1 = 0
    </otherwise>
</choose>
```

OK 写法，看起来没问题。但是行 70-74：

```xml
<if test="dto.departmentIdList != null and dto.departmentIdList.size() > 0">
    AND department_id IN
    <foreach collection="dto.departmentIdList" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
</if>
```

业务部门筛选 `dto.departmentIdList` 与数据权限 `departmentIds`（参数名）用同一列 `department_id`，**两个 IN 条件是 AND 还是 OR？**

看 SQL 拼接顺序：`<choose>` 在前，`<if test="dto.departmentIdList...">` 在后 → `AND ... AND ...` → 即"既在权限范围内，又匹配前端筛选"。

**潜在问题**：

1. 假设用户 A 有部门 `["01"]` 权限，前端选 `["02"]` 过滤。SQL 是：
   ```
   WHERE deleted=0 AND department_id IN ("01") AND department_id IN ("02")
   ```
   → 0 行 → 前端空。
2. 假设用户 A 有部门 `["01","02"]`，前端选 `["02"]`。SQL：`... department_id IN ("01","02") AND department_id IN ("02")` → 命中 department_id="02"。

这个行为是"交集"，意味着用户必须拥有某部门 + 前端选择了同部门，才能看到。
实际业务期望：用户在自己有权部门基础上，按"前端选择的部门"过滤——即"权内筛选"应该用 IN 嵌套 OR 或者用 IN 综合条件。

**触发场景**：

出纳用户 A 有 `["出纳部"]` 权限，前端列表页选择部门 `["财务部"]` 过滤 → 列表空。这是因为前端选择部门等于强行 AND 收窄到该部门权限交集。

**修复建议**：

把数据权限 IN + 业务筛选 IN 合并成一个 IN：
```xml
AND department_id IN (
    <foreach collection="dto.departmentIdList" item="id" open="" separator="," close="">
        #{id}
    </foreach>
)
<if test="(dto.departmentIdList == null or dto.departmentIdList.size() == 0)">
    department_id IN
    <foreach collection="departmentIds" item="deptId" open="(" separator="," close=")">
        #{deptId}
    </foreach>
</if>
```

或者逻辑改"数据权限 vs 前端筛选都满足时，前端筛选有限"——需要找产品确认 UX 意图。

---

### 🟡 BUG-19：`CashierExportUtils.SENSITIVE_PERMISSION_HOLDER` ThreadLocal 在异步导出场景不会被清理

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/utils/CashierExportUtils.java:67-84`

**问题描述**：

`SENSITIVE_PERMISSION_HOLDER` 用 `ThreadLocal` 存权限标记。当 `excelExportService.exportExcel` 是异步（创建子线程 / 提交线程池），子线程读不到父线程的 ThreadLocal。
看 `CompanyManageServiceImpl.exportCompany` 中导出是同步直接 `excelExportService.exportExcel(...)` 走的；但 `EmployeeManageServiceImpl.exportCashierEmployee` 同样同步，没有线程切换。

**真实问题**：

请确认 `excelExportService.exportExcel` 是同步还是异步。从 Service 注释"异步生成 Excel 并上传下载中心"推测它是**异步**的。那么线程切换后子线程读不到 `SENSITIVE_PERMISSION_HOLDER`。导出主线程在 dispatch 后立刻 `finally { clearSensitivePermission(); }` ——子线程读时永远 null → 一律返回 false → **导出永远是脱敏版本**。

仔细检查一下 `excelExportService.exportExcel`：需看 core 的实现（不在我们仓库里）。但根据使用方式，"createDownloadRecord"先在主线程跑（同步）拿 fileId，再"excelExportService.exportExcel" → 这个行为意味着 fileId 已经存在，Excel 内容是异步生成的。

**触发场景**：

1. 公司导出：`setSensitivePermission(true)` → 主线程 → `excelExportService.exportExcel()` 异步生成 → 子线程读 ThreadLocal = null → `hasSensitivePermission` = false → **导出全部脱敏**，包括没必要的（如 licenseNumber 等）。
2. 这与 `setSensitivePermission(true)` 的本意不符。

**修复建议**：

1. 确认 `excelExportService.exportExcel` 的实现，是同步还是异步。如果异步：
2. 把"权限判断结果"作为参数传给 `excelExportData` 的字段（或单独 `setExporterPermission(boolean)`），由异步 worker 直接读取，不再依赖 ThreadLocal。
3. 或者调用方（`XxxManageServiceImpl`）在调 `exportExcel` 之前**先把所有需要脱敏的字段预先处理好**（在内存中替换好 idCard/phone/password 的值），再 exportExcel 完全不需要走权限路径。
4. 同步实现的话，问题是 `clearSensitivePermission()` 已经被 finally 在 exportExcel 调用后立即调用，导致 exportExcel 内部读不到。观察 exportCompany 第 619-626：

```java
try {
    boolean hasCompanyFieldPerm = fieldPermissionService.hasAnyFieldPermission(TwoLevelEnum.GSGL);
    CashierExportUtils.setSensitivePermission(hasCompanyFieldPerm);
    excelExportService.exportExcel(fileId, fileName, userName, Collections.singletonList(exportData));
} finally {
    CashierExportUtils.clearSensitivePermission();
}
```

即使同步也错位了：set 在前，exportExcel 调用；如果 exportExcel 内部某一行又调 `CashierExportUtils.password()` 之类的（脱敏），ThreadLocal 应该还是 set 的；finally 是 exportExcel 返回后才 clear，没问题。
但是**异步**就出问题。

**确认需**：

先用 `mvn dependency:tree | grep core-...`（不实际跑）查 `com.obo.core.excel.export.ExcelExportService.exportExcel` 是 sync 还是 async。建议直接读 core 的 jar 源码或在测试中验证。

---

## 🟢 低优先级

### 🟢 BUG-20：`BankCardController.addBankCard` 返回值类型不一致

**`file:line`**：`bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/BankCardController.java:49-54`

**问题描述**：

```java
@ApiOperation("新增银行卡")
@PostMapping("/addBankCard")
public Result<Boolean> addBankCard(@RequestBody BankCardSaveDTO dto) {
    String accountNumber = bankCardManageService.addBankCard(dto);
    return accountNumber != null ? Result.success(accountNumber) : Result.error("新增失败");
}
```

签名是 `Result<Boolean>`，实际返回 `Result<String>`（accountNumber）或 `Result<?>`（error）。前后端字段类型不一致。前端 `apis/type.ts` 应是 `boolean`，但会拿到 `string`。Spring 泛型擦除不影响序列化，但 OpenAPI 文档生成错误。

**修复建议**：

```java
public Result<String> addBankCard(@RequestBody BankCardSaveDTO dto) {
    String accountNumber = bankCardManageService.addBankCard(dto);
    if (accountNumber == null) {
        return Result.error("新增失败");
    }
    return Result.success(accountNumber);
}
```

---

### 🟢 BUG-21：`OperatingScopeServiceImpl.addOperatingScope` 没设 `IndustryCategory` 完整性保护

**`file:line`**：`bi-cashier-component/src/main/java/com/obo/bi/cashier/service/impl/OperatingScopeServiceImpl.java:59-61`

**问题描述**：

```java
@Override
public Boolean addOperatingScope(OperatingScope operatingScope) {
    return baseMapper.insert(operatingScope) > 0;
}
```

而 `OperatingScopeManageServiceImpl.addOperatingScope` 第 90-108 行：

```java
public Boolean addOperatingScope(OperatingScopeSaveDTO dto) {
    OperatingScope scope = new OperatingScope();
    scope.setParentId(dto.getParentId() == null ? 0L : dto.getParentId());
    if (dto.getParentId() == null) {
        scope.setLevel(1);
    } else {
        OperatingScopeVO parent = operatingScopeService.queryOperatingScopeById(dto.getParentId());
        scope.setLevel(parent != null ? parent.getLevel() + 1 : 1);   // ★ parent 为 null 时 fallback 到 level=1
    }
    ...
    scope.setIndustryCategory(dto.getIndustryCategory());
    boolean ok = operatingScopeService.addOperatingScope(scope);
    ...
}
```

**问题**：

1. 当 `parentId` 不为 null 但 parent 不存在（被并发删了）→ `scope.setLevel(1)`，但实际应该报错。新增的经营范围被记成 level=1，**和现有根节点冲突**。
2. 同 `BusinessScopeDescription`、`name` 没做 trim，`"  餐饮  "` 这种带前后空格的会作为 name 入库，导致去重校验 `"餐饮"` 时不命中重复。

**修复建议**：

1. parent 为 null 时抛 `BusinessException("父节点不存在或已删除")`。
2. service 层做 `StringUtils.trim()` 标准化。

---

### 🟢 BUG-22：`IFileTagLibraryService.SOURCE_MODULE_MAP` 来源模块映射字典未注释哪些 key 才是合法值

**`file:line`**：见 `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/IFileTagLibraryService.java`

**问题描述**：

多处用 `Map.containsKey(key)` 校验入参 key。但 map 是什么内容？需要读者去看枚举或者别处定义。

`FileExpiryRecordManageServiceImpl.pageConfigured` 第 91-107 行：

```java
if (CollUtil.isEmpty(dto.getSourceModules())) {
    values = IFileTagLibraryService.SOURCE_MODULE_MAP.values().stream()...
} else {
    values = dto.getSourceModules().stream()
            .filter(key -> IFileTagLibraryService.SOURCE_MODULE_MAP.containsKey(key))
            .flatMap(key -> IFileTagLibraryService.SOURCE_MODULE_MAP.get(key).stream())
            .map(SourceModuleEnum::getValue)
            .distinct()
            .collect(Collectors.toList());
}
```

**问题**：静默丢弃非法 key，没错误日志，运维看不到"前端传了非法值"的状况。

**修复建议**：

```java
List<String> invalidKeys = dto.getSourceModules().stream()
        .filter(key -> !IFileTagLibraryService.SOURCE_MODULE_MAP.containsKey(key))
        .collect(Collectors.toList());
if (!invalidKeys.isEmpty()) {
    log.warn("文件到期筛选非法 sourceModules: {}", invalidKeys);
}
```

---

### 🟢 BUG-23：`BankCardExportVO` 等 VO 类存于 `bi-cashier-api` 模块导出，可能与 DTO 同包混淆

**`file:line`**：见 `bi-cashier-api/src/main/java/com/obo/bi/cashier/vo/*ExportVO.java`

**问题描述**：

导出 VO 类（`BankCardExportVO`、`StoreExportVO`、`EmployeeExportVO`、`CompanyExportVO`）都放在 `vo` 包，与 `BankCardVO`、`StoreVO`、`CompanyDetailVO` 等"详情 VO"混在一起。前端 `apis/type.ts` 没法快速区分"接口返回的 VO"还是"导出用的 VO"。

**修复建议**：

新建 `bi-cashier-api/src/main/java/com/obo/bi/cashier/vo/export/` 子包，专门放 ExportVO。

---

### 🟢 BUG-24：DTO 字段命名风格不一致（部分 snake_case 部分 camelCase）

**`file:line`**：多处

**问题描述**：

例如 `EmployeePageDTO.isLegalPerson`：

```java
@ApiModelProperty("是否法人：0-否，1-是")
private String isLegalPerson;
```

但前端可能期望 `isLegalPerson` 还是 `is_legal_person`？`CashierEmployeeQueryDTO` 用了 snake_case（`is_legal_person`），前端代码 `src/pages/employee/apis/type.ts` 中的定义缺检查，假定是 camelCase（同 Java DTO），需要前端同时配置 snake_case 转 camelCase 的 axios 拦截器。

**修复建议**：

1. 全栈约定 snake_case（与 bi-personnel 同步），让 Java 用 `@JsonProperty("is_legal_person")` 标注。
2. 或者约定 camelCase，bi-personnel 同步改 snake_case→camelCase。

—— 这是与 bi-personnel 服务约定问题，需要跨服务协议。

---

### 🟢 BUG-25：`BankCardController.listAllBankCard` 接口形态奇异

**`file:line`**：`bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/BankCardController.java:78-81`

**问题描述**：

```java
@ApiOperation("查询全量银行卡（含绑定状态，供下拉选择器）")
@PostMapping("/listAllBankCard")
public Result<List<BankCardListVO>> listAllBankCard(@RequestParam(value = "uniqueValue", required = false) String uniqueValue) {
    return Result.success(bankCardManageService.listAllBankCardWithBindStatus(uniqueValue));
}
```

PostMapping + @RequestParam uniqueValue 在查询绑定状态时仅作为公司参数过滤。如果前端传 companyUniqueValue，方法签名要的是 uniqueValue（参数名歧义）。

**修复建议**：

参数名 rename 为 `companyUniqueValue`：
```java
public Result<List<BankCardListVO>> listAllBankCard(
        @RequestParam(value = "companyUniqueValue", required = false) String companyUniqueValue)
```

并匹配前端 `apis/index.ts` 字段名。

---

### 🟢 BUG-26：`CompanyController.updateStoreQualification` 入参绑定方式易错

**`file:line`**：`bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/CompanyController.java:91-97`

**问题描述**：

```java
public Result<Boolean> updateStoreQualification(@RequestParam("uniqueValue") String uniqueValue,
                                                 @RequestParam("hasStoreQualification") Boolean hasStoreQualification) {
    companyManageService.updateStoreQualification(uniqueValue, hasStoreQualification);
    return Result.success(true);
}
```

Post + @RequestParam 模式下，调用方要传 form-urlencoded；前端 axios 默认 JSON，会 400。

**修复建议**：

改成 `@RequestBody HasStoreQualificationDTO dto { String uniqueValue; Boolean hasStoreQualification; }`。

---

### 🟢 BUG-27：`OperatingScopeController.queryOperatingScopeById` 入参 Long ID 在 JSON 中可能精度丢失

**`file:line`**：`bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/OperatingScopeController.java:42-46`

**问题描述**：

```java
@PostMapping("/queryOperatingScopeById")
public Result<OperatingScopeVO> queryOperatingScopeById(@RequestParam("id") Long id) {
    return Result.success(operatingScopeManageService.queryOperatingScopeById(id));
}
```

Post + RequestParam Long，详见 BUG-16。

**修复建议**：同 BUG-16。

---

### 🟢 BUG-28：`BankCardManageServiceImpl.exportBankCard` 缺 `setSensitivePermission` 包裹

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:111-183`

**问题描述**：

```java
public String exportBankCard(BankCardPageDTO dto) {
    ...
    // 6. 异步生成 Excel 并上传下载中心
    ExcelExportDataDTO exportData = ...;
    excelExportService.exportExcel(fileId, fileName, userName, Collections.singletonList(exportData));   // ★ 无 try-finally
    log.info("银行卡信息导出[完成]，fileId={}，size={}", fileId, rowList.size());
    return fileId;
}
```

对比 `exportCompany` 第 619-626 已加 `setSensitivePermission/clear` 包裹。`exportBankCard` 没加。
当前 exportBankCard 的组装逻辑（150-172 行）**没有调** `password/idCard/phone` 等脱敏函数**直接导出原始值**——银行卡导出可能根本无敏感字段（只有账号、银行名、支行、U盾编号、U盾操作员），但 U盾编号、电话可视为半敏感。

**修复建议**：

加 try-finally 包裹 `setSensitivePermission(hasBankCardFieldPerm); exportExcel(...); finally clear`,至少保持风格一致。如果产品认为银行卡导出不需要敏感字段校验，删掉其他两个导出也该不一致。

---

### 🟢 BUG-29：`CashierExportUtils.password` 等脱敏方法在 null 输入返回空串，但导出 Excel 列用了 string 类型，可能与"未传"语义混淆

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/utils/CashierExportUtils.java:178-183`

**问题描述**：

```java
public static String password(String password) {
    if (StringUtils.isEmpty(password)) {
        return "";       // 输入为空时返回 ""
    }
    return hasSensitivePermission() ? password : "******";
}
```

某列原值为 null 时输出 ""，无权限时输出 "******"。
两种 empty 含义在 Excel 中无法区分："真的没填" vs "有但被脱敏"。

**修复建议**：

看产品语义，需要"**未填值**"与"**被脱敏**"区分开时，调用方按需传"原值是否 null"标志，由脱敏函数做不同处理（如返回 `***（已脱敏）`）。

---

### 🟢 BUG-30：`BankCardManageServiceImpl.updateBankCard` 中 update 顺序与文件操作

**`file:line`**：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:287-317`

**问题描述**：

```java
public Boolean updateBankCard(BankCardSaveDTO dto) {
    ...
    saveBankCardFileTags(dto, false);     // ① diff 写文件-标签
    saveBankCardCustomTags(dto);          // ② 写自定义标签
    fileChange(dto);                      // ③ bi-file 文件增删
    boolean success = bankCardService.updateBankCard(bankCard);  // ④ 主表更新
    if (success) {
        ...
        storeService.updateStore(store);   // ⑤ 同步店铺冗余
    }
    return success;
}
```

**问题**：

1. `fileChange` 写入 bi-file 实际是新增操作（包括 `setSku_code(skuCode + uniqueValue)` 的 newFiles 处理），而主表 `bankCardService.updateBankCard(bankCard)` 是在后面。
   - 若主表 update 失败（已经是前面的事务回滚了），`fileChange` 已经在内存中生成了 `newFiles`，调用 `fileClient.updateFileUploadRecordBatch(newFiles)` 时已经打到 bi-file 服务（Feign 调用在事务外）。bi-file 上多了文件，但 bi-cashier 的主表没改 → 不一致。
2. 同步店铺冗余字段（行 308-314）放在主表更新之后，但 `storeService.updateStore` 没有同样的 `@Transactional` 边界——TransactionTemplate 已经在 `updateBankCard` 外层，这里调用自己起新事务。OK，但顺序奇怪——如果店铺更新失败，主表已成功、bi-file 已成功，店铺不同步。

**修复建议**：

1. 把主表 update 放在最前（先改 DB，再打文件服务）：
   ```java
   boolean success = bankCardService.updateBankCard(bankCard);
   if (success) {
       saveBankCardFileTags(dto, false);
       saveBankCardCustomTags(dto);
       fileChange(dto);
       // 同步店铺冗余
       ...
   }
   ```
2. 或外层调用方 `@Transactional(rollbackFor)` 把整个链路包住，确保本地 DB + 文件服务逆序控制。

---

## 🟢 低 - 一致性 / 文档

### 🟢 BUG-31：`SHARE_COMPONENTS.md` 与后端 Controller 类型不一致

**`file:line`**：文档 `D:\OB\ob_web\packages\micro\cashier\SHARE_COMPONENTS.md`

**问题描述**：

文档可能在改动后没同步明确"BankCardVO/StoreVO/CompanyVO/EmployeeVO/SealVO/StoreDetailVO/CompanyDetailVO"这些 VO 的字段（哪些会脱敏）。请人工对照一下，本审查未读该文件。

**修复建议**：

在 `apis/type.ts` 旁加 `vo-fields.md` 列出每个 VO 哪些字段会被脱敏。

---

### 🟢 BUG-32：`bi-cashier-component/handler/StringListTypeHandler.java` 不在扫描范围，未审查

**`file:line`**：存疑，未读

**修复建议**：

下次审查把 `bi-cashier-component/src/main/java/com/obo/bi/cashier/handler/StringListTypeHandler.java` 单独 Review。本审查未读。

---

## 扫描覆盖范围

| 模块 | 文件数 | 关键路径 | 状态 |
|------|--------|---------|------|
| `bi-cashier-api` | 6+ 个 DTO/VO 已读 | `dto/BankCard*`, `dto/Store*`, `dto/Company*`, `dto/EmployeePage*`, `dto/OperatingScope*`, `vo/Store*`, `vo/Company*` | ✅ |
| `bi-cashier-component` | 9+ 已读 | `mapper/*`, `service/impl/BankCard*`, `service/impl/Store*`, `service/impl/Company*`, `service/impl/OperatingScope*`, `po/Company`, `po/Store`, `po/OperatingScope`, `po/BankCard`, `po/FileExpiryRecord`, `helper/CashierManageHelper` | ✅ |
| `bi-cashier-service` | 7 个核心已读 | `service/impl/*ManageServiceImpl` | ✅ |
| `bi-cashier-web` | 7 个 Controller + 2 个 Mapper.xml | `controller/*`, `resources/mapper/*` | ✅ |
| SQL 文档 | 4 个 2026-07-28 文件 + 1 个 2026-07-23 | 增量 schema 改动 | ✅ |
| `bi-cashier-component/handler/` | 未读 | StringListTypeHandler 实现 | ⚠️ |
| `bi-cashier-service/utils/` | 部分 | CashierExportUtils 已读全文 | ✅ |

---

## 无问题清单（确认已检查、暂未发现问题）

| 模块 | 项 |
|------|----|
| BankCardController | 路径映射、`@RequestBody` 入参绑定正确 |
| CompanyController.listAllCompanyWithBusinessScope | 没有明显 NPE 风险（已 NPE 兜底） |
| BankCardMapper.xml.pageBankCard | SQL 注入：使用 `#{}`，无字符串拼接 ✅ |
| StoreMapper.xml.pageStore | SQL 注入：使用 `#{}`，IN/foreach 正确 ✅ |
| FileExpiryRecordMapper.xml.pageRecordWithRelated | SQL 注入：使用 `#{}`，IN 列表正确 ✅ |
| OperatingScopeMapper.xml | 纯 PK 查询无注入风险 ✅ |
| `BaseEntity.@TableLogic` | 已确认所有 po 走逻辑删除 ✅ |
| OperatingScopeController | 入参 `@RequestBody` 形式 OK（除 BUG-27 标出的 queryById） |
| SealController | 5 个接口标准、入参清晰、文件权限校验已落实 ✅ |
| Company PO 字段 | 与 CompanyDetailVO/CompanySaveRequestDTO 字段基本对齐 ✅ |
| Store PO 字段 | 与 StoreDetailVO/StoreSaveRequestDTO 字段基本对齐 ✅ |
| BankCardBatchUpdateFieldDTO 字段 | 与前端 cashierPageQuery 接口需要 backend sync ⚠️ 等前端联调 |
| StoreBatchUpdateFieldDTO 字段 | 与前端 cashierPageQuery 接口需要 backend sync ⚠️ 等前端联调 |
| CompanyBatchUpdateFieldDTO 字段 | departmentIdList + companyStatus 已覆盖前端场景 ✅ |
| 文件上传 bi-file 客户端 | Feign 调用模式 OK，异常时由 `checkRemoteSuccess` 抛 BusinessException ✅ |
| 前端联动：通过扫描代码层面确认 `apis/type.ts` 中的字段命名（snake/camel）需与后端 @JsonProperty 对齐，本报告无法跨项目对照 | ⚠️ 需前端 TypeScript 类型检查 |

---

## 紧急建议（上线前必修）

1. **BUG-01**：必须把 4 处 TODO 临时放行的公司数据权限还原
2. **BUG-03**：员工导出身份证号权限链路对齐
3. **BUG-04**：`addBankCard` 加 `@Transactional`
4. **BUG-05**：删除银行卡清 `file_expiry_record`
5. **BUG-19**：确认 `excelExportService.exportExcel` 同步/异步，决定 ThreadLocal 用法

---

## 报告元数据

- 报告生成：2026-08-05
- 审查者：code-reviewer（只读 agent）
- 工作区：`D:\OB\bi-FOB\bi-cashier`
- 后端基线：`dev-chenyanjun-one` 未提交变更（+661/-189 行）
- 前端基线：`D:\OB\ob_web\packages\micro\cashier` 的 `dev-chenyanjun` 分支（已含 04 份报告）
- 编译/构建：**未执行**（按 memory：bi-FOB 只能 IntelliJ 编译）
