# 文件附件联合写入规范

本规范以 `BankCardManageServiceImpl.addBankCard` / `updateBankCard` 为基准，覆盖「业务实体 + 文件到期记录 + 标签库 + bi-file 远程文件」四步联合写入模式。新增含附件的业务模块时，按本文档对照实现。

## 1. 四步写入顺序

新增或更新含附件的业务实体时，**必须**在同一个 `@Transactional(rollbackFor = Exception.class)` 方法内按以下顺序执行：

```
① saveBankCardFileTags(dto, isAdd)
   → 写 cashier_file_expiry_record（差异更新）
   → applyMatchedRuleOnAdd（按标签匹配规则，自动填充提醒配置）

② saveBankCardCustomTags(dto)
   → 写 cashier_file_tag_library（去重，供下次选择）

③ fileChange(dto)
   → cashierManageHelper.fileChange(uniqueValue, fieldFileMap)
   → 查现有 bi-file 文件 → 对比差异 → 删废弃 → 批量新增/更新

④ bankCardService.addBankCard / updateBankCard
   → 写 cashier_bank_card 主表（MP BaseMapper.insert 或 lambdaUpdate）
```

**为什么 fileChange 先于主表写入**：bi-file 是远程调用，不参与 Spring 本地事务。若先写主表再调 bi-file 失败，主表已落库但附件缺失；反之 bi-file 失败时本地事务可感知异常并回滚主表，避免「主表入库但附件空缺」的中间状态。

## 2. 新增 vs 更新的差异策略

### 新增（`isAdd=true`）

```java
// BankCardManageServiceImpl.java:277-289
if (bankCardService.isAccountNumberExists(dto.getAccountNumber(), null)) {
    throw new BusinessException("该银行账号已存在，无法重复提交");
}
BankCard bankCard = BeanCopyUtils.copy(dto, BankCard::new);
String str = bankCardService.addBankCard(bankCard);
saveBankCardFileTags(dto, true);   // 直接批量插入，不查旧记录
saveBankCardCustomTags(dto);
fileChange(dto);
```

- `saveBankCardFileTags(dto, true)` 内部：直接构建 `toInsert` 列表，不查旧记录，所有文件调用 `applyMatchedRuleOnAdd` 匹配规则后批量 `saveBatch`。

### 更新（`isAdd=false`）

```java
// BankCardManageServiceImpl.java:291-321
saveBankCardFileTags(dto, false);  // diff 更新：改保留配置，删废弃，增新文件
saveBankCardCustomTags(dto);
fileChange(dto);
boolean success = bankCardService.updateBankCard(bankCard);
if (success) {
    // 同步更新店铺冗余字段 bank_card_number
    List<Store> boundStores = storeService.listByBankCardId(bankCard.getId());
    for (Store store : boundStores) {
        store.setBankCardNumber(bankCard.getAccountNumber());
        storeService.updateStore(store);
    }
}
```

`saveBankCardFileTags(dto, false)` 内部 diff 流程：

```
1. listByUniqueValue(null, accountNumber)  // sourceModule=null：一次查全部来源模块
2. 按 unName 建 dbMap<unName, FileExpiryRecord>
3. 遍历 DTO 三类文件：
   - unName 在 dbMap 中 → updateById（保留原 reminderDays 等配置），从 dbMap 移除
   - unName 不在 dbMap 中 → 新文件，applyMatchedRuleOnAdd 匹配规则，加入 toInsert
4. dbMap 剩余项 → removeByIds（前端已删除的文件）
5. toInsert 非空 → saveBatch
```

**查旧记录必须传 `sourceModule=null`**：传具体模块只查一类，会漏掉模块变更场景。

## 3. 文件 skuCode 规则

```java
// SourceModuleEnum 定义 skuCodePrefix（完整 skuCode = prefix + accountNumber）
SourceModuleEnum.BANK_CARD_ACCOUNT_QUERY_FILES  → prefix = "accountQueryFiles"
SourceModuleEnum.BANK_CARD_OPENING_FILES        → prefix = "openingFiles"
SourceModuleEnum.BANK_CARD_CANCEL_RECEIPT_FILES → prefix = "cancelReceiptFiles"
```

同一套 skuCode 规则在写入（fileChange）、导出（loadFileLinkTextBySkuCodes）、详情回显（queryFileUploadRecordMap）三处均使用，**不可自造前缀**。

## 4. bi-file 远程调用边界

```java
// CashierManageHelper.fileChange 内部（bi-cashier-component/helper/）
// 1. 批量查现有文件
fileClient.queryFileUploadRecordMap(queryDTO);
// 2. 对比保留 ID，计算需删除文件
fileClient.deleteFileUploadRecordByFtpPathList(toDelete);
// 3. 新文件设置 skuCode 后批量更新
fileClient.updateFileUploadRecordBatch(toAddOrUpdate);
```

**事务边界注意**：
- bi-file 是跨服务 Feign 调用，**不参与** Spring 本地事务
- 本地事务回滚不会撤销已成功的 bi-file 操作（无补偿机制）
- 写新业务模块时，fileChange 失败场景必须允许前端重试（操作需幂等）

## 5. 规则匹配（applyMatchedRuleOnAdd）

```java
// FileExpiryRuleManageServiceImpl.java:261-285
// 触发条件：tagNameList 非空 AND record.effectiveTime 非空
// 未填生效日期时跳过自动计算，走人工补录路径
if (record.getEffectiveTime() == null) { return; }

FileExpiryRule matchedRule = matchRule(matchTags);  // 查 DB + 内存二次匹配
if (matchedRule != null) {
    record.setRuleUniqueValue(matchedRule.getUniqueValue());
    record.setReminderDays(matchedRule.getReminderDays());
    // 若规则有 validityDays：expiryDate = effectiveTime + validityDays（覆盖人工填写）
    if (matchedRule.getValidityDays() != null) {
        record.setExpiryDate(record.getEffectiveTime().plusDays(matchedRule.getValidityDays()));
    }
}
```

规则查询通过手写 XML `FIND_IN_SET(#{tag}, match_tags)` 实现（见 `FileExpiryRuleMapper.xml:23-35`），属于 MySQL 专有函数场景，必须用 XML。

## 6. 详情回显链路（queryBankCardById）

```
1. 按 sourceModule 分桶查三类 FileExpiryRecord（listByUniqueValue 带具体 module）
   → 按 unName 建 Map<unName, FileExpiryRecord>

2. 一次性查 bi-file（三个 skuCode 批量传入）
   → fileClient.queryFileUploadRecordMap([3 个 skuCode])
   → 返回 Map<skuCodePrefix, List<FileUploadRecordVO>>

3. toFileList 合并：
   → FileUploadRecordVO → FileUploadRecord（BeanUtils.copyProperties）
   → 按 vo.un_name 从 FileExpiryRecord 取 tagNameList / effectiveTime / expiryDate
```

**容错**：bi-file 返回 null 或失败时，VO 不设置文件列表（空字段），不抛异常。

## 7. 可复用的工具入口

| 功能 | 调用方式 |
|------|---------|
| 异步导出（创建下载记录） | `CashierExportUtils.createDownloadRecord(fileClient, userName, fileName)` |
| 批量查文件下载链接 | `CashierExportUtils.loadFileLinkTextBySkuCodes(fileClient, skuCodeList)` |
| 文件增删改（bi-file） | `cashierManageHelper.fileChange(uniqueValue, fieldFileMap)` |
| 文件到期记录读写 | `IFileExpiryRecordService.listByUniqueValue / saveBatch / updateById / removeByIds` |
| 标签库入库 | `IFileTagLibraryService.saveCustomTags(tagNameList, module)` |
| 规则匹配 | `IFileExpiryRuleManageService.applyMatchedRuleOnAdd(rec, tagNameList)` |

## 8. 禁止清单

- ❌ 循环调用 `fileClient.queryXxx`（单条）——必须批量，一次性传 skuCode 列表
- ❌ 更新时先 `deleteByUniqueValue` 再全量重建 FileExpiryRecord——应用 diff 策略保留 `reminderDays` 等配置
- ❌ `saveBankCardFileTags` 更新模式传具体 `sourceModule` 查旧记录——必须传 `null` 查全部模块
- ❌ fileChange 调用放在主表写入之后——bi-file 失败无法触发本地事务回滚主表
- ❌ `applyMatchedRuleOnAdd` 在 `effectiveTime=null` 时覆盖 `expiryDate`——违反业务约束

## 9. 细则导航

| 需求 | 参考文档 |
|------|---------|
| `@Transactional` 位置与事务边界规则 | `architecture-layers.md §2.4` |
| 循环查库 / 批量写入性能红线 | `performance.md §1–§3` |
| Feign 调用 Result 校验、跨服务事务说明 | `SKILL.md §Feign 客户端使用规约` |
| MP Lambda vs 手写 XML 的选择 | `mybatis-vs-xml.md` |
