# 性能红线与导出规范

本规范以 bi-cashier 模块实际踩坑经验为基础，覆盖日常编码、批量查询、异步导出与权限脱敏。

## 1. 循环内查库红线

### 1.1 严禁循环查库 / 同步写入

```java
// 错误示例：循环查库
for (String accountNumber : accountNumbers) {
    BankCard card = bankCardService.queryBankCardById(accountNumber);
    list.add(card);
}

// 错误示例：循环里同步写入 Feign
for (Store store : storeList) {
    fileClient.updateFileUploadRecordBatch(filesFor(store));
}
```

### 1.2 正确做法

- 先收集 ID / 唯一值集合，再批量查：

```java
List<BankCard> cards = bankCardService.listByBankCardIds(idList);
```

- 跨服务批量数据传递：`syncDataBatch(List<Data>)`，**不要** 在外层循环里调用 `syncData(Data)`。
- 复杂关联（公司名 / 部门名 / 银行名）一次批量查，**不要** 在循环里逐条查。

## 2. 杜绝全表查询

- 禁止无条件下 `list()` / `selectList(null)`。
- 关联查询、翻译字典、构建内存映射时尤其不能全表查。
- 必须先收集 ID 集合，再 `IN` 批量查：

```java
List<Store> stores = storeService.listByUniqueValues(uniqueValueList);
```

- 字典全量缓存：导出场景用 `DataDictionaryProvider` 一次性加载相关 type 的全部条目到内存（参考 `CashierExportUtils.loadDictLabelMap(...)`），不要每行调用 `translateCode(code)`。

## 3. 批量写入

```java
// 错误
for (Xxx item : items) {
    xxxService.save(item);
}

// 正确
xxxService.saveBatch(items);
```

- 调用 `saveBatch()` / `updateBatchById()` / `removeByIds()`，参数是 `List`。
- 写完统一提交，必要时包一层 `@Transactional(rollbackFor = Exception.class)`。

## 4. 异步导出与下载中心

### 4.1 不要阻塞 HTTP 接口

导出接口（`exportBankCard` / `exportStore` 等）按以下流程：

1. `CashierExportUtils.createDownloadRecord(fileClient, userName, fileName)` 创建下载中心记录，得到 `fileId`；
2. 立即返回 `fileId` 给前端，前端用 `fileId` 轮询下载；
3. 真正导出逻辑放到异步任务里（当前实现由 ExcelExportService 内部异步），避免长事务。

### 4.2 复用列表查询 + 大分页

```java
BankCardPageDTO queryDTO = dto == null ? new BankCardPageDTO() : dto;
queryDTO.setPageNum(1);
queryDTO.setPageSize(CashierExportUtils.EXPORT_PAGE_SIZE); // 100000
```

- 通过 `EXPORT_PAGE_SIZE = 100000`（受 MyBatis Plus `MAX_LIMIT` 上限约束），单页拉全；
- 与列表接口共享过滤条件，确保导出与列表字段一致。

### 4.3 文件下载链接批量查询

- 用 skuCode 集合一次性查：

```java
Map<String, String> linkMap = CashierExportUtils.loadFileLinkTextBySkuCodes(
        fileClient, allSkuCodes);
```

- 禁止循环 `fileClient.queryFileUploadRecordBySkuCodeList(singleSkuCode)`。

### 4.4 多行单元格拼接

- 同一字段多条记录用换行拼接，例如"多条变更记录"：

```java
private static final String NEWLINE = "\n";
String joined = valueList.stream()
        .filter(StringUtils::isNotEmpty)
        .collect(Collectors.joining(NEWLINE));
```

## 5. 数据权限与 IN 列表

- 数据权限通过 `ICommonManageService.listCurrentCashierDepartmentManagePermissionIds(TwoLevelEnum)` 获取部门 ID 列表，传给 Component 层的 `pageXxx(...)` 方法。
- 在 Mapper XML 中以 `<choose>` 处理：

```xml
<choose>
    <when test="(departmentIds != null and departmentIds.size() > 0) or operatorId != null">
        AND (... department_id IN (...) OR operator_id = #{operatorId})
    </when>
    <otherwise>
        AND 1 = 0
    </otherwise>
</choose>
```

- 权限列表**为空**时强制 `1 = 0`，避免无权限用户拿到全表数据。

## 6. 翻译与编码映射

- 翻译字段（字典 / 业务编码）批量加载到 `Map<typeId, Map<code, label>>` 后再循环读取，**不要** 对每行调用远程接口。
- 字典查不到时回退原始编码（参考 `CashierExportUtils.translate(...)`），保证导出不会因字典缺失而抛异常。

## 7. 敏感字段权限与脱敏

### 7.1 判断明文权限

```java
boolean hasPwd = fieldPermissionService.hasFieldPermission(
        TwoLevelEnum.DPGL, CashierSensitiveFieldEnum.SHOP_PASSWORD);
```

- 列出文件用 `listAllBankCard` 等接口，**不要** 直接给前端未脱敏的密码。
- 导出脱敏走 `CashierExportUtils.setSensitivePermission(...) / clearSensitivePermission()`。

### 7.2 ThreadLocal 配对清理

```java
CashierExportUtils.setSensitivePermission(hasPwd);
try {
    // 导出逻辑
} finally {
    CashierExportUtils.clearSensitivePermission();
}
```

- 必须用 `try-finally` 保证清除，避免线程复用导致的内存泄漏。

### 7.3 密码字段在导出场景默认脱敏

```java
private static String maskPassword(String password) {
    if (StringUtils.isEmpty(password)) {
        return "";
    }
    return "******";
}
```

- 没有任何 `hasFieldPermission` 结果时，导出统一显示 `******`。

## 8. 性能自检清单

完成新接口后，对照检查：

- [ ] 没有循环查库 / 循环远程调用；
- [ ] 所有 ID 列表用 `IN` 批量查询；
- [ ] 全表翻译用一次性内存缓存；
- [ ] 写入走批量（`saveBatch` / `updateBatchById` / `removeByIds`）；
- [ ] 物理删除改为软删除；
- [ ] 数据权限列表为空时返回空集合（不要全表）；
- [ ] 异步导出走下载中心，不阻塞接口；
- [ ] 敏感字段权限判断 + ThreadLocal 清理。
