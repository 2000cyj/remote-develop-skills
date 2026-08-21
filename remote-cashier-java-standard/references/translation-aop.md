# 翻译（AOP 注解 vs. 显式实现）

本规范澄清 bi-cashier 模块**当前实际使用**的翻译做法，以及与"翻译注解 AOP"写法的边界。

## 1. 现状

经过对 BankCard / Seal / Store 三个 Controller 及其 VO 的扫描：

| 注解 | 当前用法 | 是否使用 |
|------|---------|---------|
| `@DictTrans` | 字段标注，运行时翻译字典 label | **未使用** |
| `@SysDataTrans` | 字段标注，翻译用户/部门/岗位 | **未使用** |
| `@DictTransIn` | 入参字典 code → name | **未使用** |
| `@SysUserSearchIn` | 入参接收 name/nick 翻译为 user_id | **未使用** |

- 任何 Controller / VO / 入参 DTO 字段都不要补这些注解——它们在本模块没有对应的 AOP 切面。
- 翻译逻辑统一交给 Service 聚合层显式实现，或由前端字典渲染。

## 2. 出纳模块的翻译做法

### 2.1 业务对象关联翻译（公司名 / 部门名 / 银行名）

例如：`SealListVO.companyName`、`StoreListVO.companyName` 等来自其它表的字段。

实现模式：

```java
// 1. 收集当前页所有 companyUniqueValue（去重 + 过滤空白）
List<String> companyUniqueValues = pageResult.getRecords().stream()
        .map(Seal::getCompanyUniqueValue)
        .filter(StringUtils::isNotBlank)
        .distinct()
        .collect(Collectors.toList());

// 2. 一次批量查公司
Map<String, Company> companyMap = companyService.listByUniqueValues(companyUniqueValues)
        .stream()
        .collect(Collectors.toMap(Company::getUniqueValue, Function.identity()));

// 3. 在转换时按 uniqueValue 取名
list.forEach(vo -> {
    Company c = companyMap.get(vo.getCompanyUniqueValue());
    vo.setCompanyName(c == null ? "" : c.getCompanyName());
});
```

要点：

- **一次**批量查所需关联数据，**不要** 在循环里逐条查；
- `Map<uniqueValue, Xxx>` 是常用缓存结构；
- 取不到关联时返回 `""` 或 `null`，不要抛业务异常。

### 2.2 字典字段（业务编码 → 中文 label）

字段值是枚举字符串（如 `seal_type=official`、`shop_status=normal`、`tax_agreement_status=verified`），由前端通过字典渲染中文。

后端处理：

- 仅在**导出**场景翻译，使用 `CashierExportUtils.translate(...)`：

```java
Map<String, Map<String, String>> dictLabelMap = CashierExportUtils.loadDictLabelMap(
        dataDictionaryProvider, List.of(
                DictTypeConstants.SEAL_TYPE,
                DictTypeConstants.SHOP_STATUS,
                DictTypeConstants.TAX_AGREEMENT_STATUS));

String sealTypeName = CashierExportUtils.translate(dictLabelMap,
        DictTypeConstants.SEAL_TYPE, seal.getSealType()); // 找不到回退原值
```

- 字典 type 常量集中在 `bi-cashier-component/src/main/java/com/obo/bi/cashier/constant/DictTypeConstants.java`。
- 找不到对应字典项时**回退原始编码**，保证导出不会因字典缺失而失败。

### 2.3 枚举常量回退字符串

字段值字符串枚举集中在 `bi-cashier-component/enums/` 或 `bi-cashier-api/enums/`，例如：

```java
@Getter
public enum SourceModuleEnum {
    COMPANY_FILE_LIST("公司管理-公司文件列表", "company_file_list", "companyFile"),
    ...
    ;
    @Getter private final String msg;
    @Getter private final String value;
    @Getter private final String skuCodePrefix;
}
```

- 数据库存储 `value`（蛇形常量），前端展示用 `msg`（中文）。
- 字段 `ApiModelProperty` 注解里要列出所有可能的取值，例如 `"印章类型：official-公章,finance-财务章,..."`，便于前端生成字典。

## 3. VO 字段规范

### 3.1 联合主表字段

- 详情 VO（如 `SealVO`）：基础字段从 PO 直接复制，外键字段用业务唯一流水号（`companyUniqueValue`）+ 关联字段（`companyName`，运行时批量翻译）并存。
- 列表 VO（如 `SealListVO`）：与详情 VO 类似，仅含列表展示需要的字段。

### 3.2 嵌套结构

复合 VO 内部使用 `public static class` 嵌套：

```java
@Data
@ApiModel("店铺详情VO")
public class StoreDetailVO {
    @ApiModelProperty("变更信息列表")
    private List<ChangeInfoItem> changeInfoList;

    @Data
    @ApiModel("店铺变更信息")
    public static class ChangeInfoItem {
        @ApiModelProperty("变更信息ID")
        private Long id;
        ...
    }
}
```

- Convert 类（`StoreConvert.toDetailVO(Store, List<StoreChangeInfo>)`）负责把 PO + 子表 List 转成嵌套 VO。
- Controller / Service 之间只传递 VO，PO 不外泄。

### 3.3 时间字段

- `LocalDate` 与 `LocalDateTime` 同时加 `@DateTimeFormat` + `@JsonFormat`：
  - `yyyy-MM-dd` 用于日期；
  - `yyyy-MM-dd HH:mm:ss` 用于日期时间。

### 3.4 不写翻译注解

不要在 VO 上写 `@DictTrans` / `@SysDataTrans`：

- 没有 AOP 切面，对运行无影响，但会让读代码的人误以为翻译生效。
- 字段名 + 字典渲染在前端完成；导出场景通过 Service 聚合层显式翻译。

## 4. 边界规则

- 业务 Service **不允许**手写 `for (vo : list) { vo.setStatusName(...); }` 这种循环翻译。
- 必须走批量查（公司名）或批量字典加载（导出场景）。
- Mapper XML 的关联查询 `JOIN` 不算"手写翻译循环"，但要保持字段语义清晰。
- 翻译完成后封装返回，不要把翻译逻辑留在 Controller 层。

## 5. 后续如果接入 AOP 翻译注解

未来如果项目层级引入统一的 `@DictTrans` / `@SysDataTrans` 切面，本模块可按以下顺序迁移：

1. 在 VO 字段上加 `@DictTrans(DictTypeConstants.SEAL_TYPE)`；
2. 移除 Service 聚合层对应字段的批量翻译调用；
3. 保留导出场景的 `CashierExportUtils.translate(...)`，因为导出 PO → Excel 不是 Spring Bean 路径；
4. 同步更新本规范。

但**当前**不要预设这些注解的存在，避免误导。
