# 调用链行级模板

本规范从 `SKILL.md` 拆出，配合 `architecture-layers.md` 使用：给出 Controller → ManageService → Component Service → Mapper 四层的逐行写法模板。


---

## 调用链行级模板（4 层逐行规范）

本章按 **BankCardController / BankCardManageServiceImpl / BankCardServiceImpl / BankCardMapper / BankCardMapper.xml 5 个文件** 逐行给出模板。每一行的内容、命名、注释、注解、字段类型、前后空白都有明确规范。

### 1. Controller 行级模板（对照 BankCardController.java）

```
行 1:   package com.obo.bi.cashier.controller;
行 2:   (空行)
行 3-10: import com.obo.bi.cashier.dto.* ; import com.obo.bi.cashier.service.* ;
         import com.obo.bi.cashier.vo.* ; import com.obo.core.common.entity.result.* ;
         import io.swagger.annotations.* ; import org.springframework.web.bind.annotation.* ;
         (3 组：项目 → 第三方 → JDK，每组字典序，组间空行)
行 11: import org.springframework.web.bind.annotation.RestController;  (聚合到 1 个 import)
行 12: (空行)
行 13: import javax.annotation.Resource;  (JDK 注解)
行 14: import java.util.List;
行 15: (空行)
行 16-33: 类 Javadoc /** ... */ 用 <ul><li> 列接口清单；句末注释"对齐前端 Xxx 模块"
行 34: (空行)
行 35: @Api(tags = "出纳-银行卡管理")           ← 1. Swagger 分类
行 36: @RestController                              ← 2. 容器注解
行 37: @RequestMapping("/cashier/bankCard")        ← 3. 框架路由
行 38: public class BankCardController {           ← 4. 类声明
行 39: (空行)
行 40:     @Resource
行 41:     private IBankCardManageService bankCardManageService;
行 42: (空行)
行 43:     @ApiOperation("分页查询银行卡")
行 44:     @PostMapping("/pageBankCard")
行 45:     public Result<PageResult> pageBankCard(@RequestBody BankCardPageDTO dto) {
行 46:         return Result.success(bankCardManageService.pageBankCard(dto));
行 47:     }
行 48: (空行)
行 49:     @ApiOperation("银行卡信息导出")
行 50:     @PostMapping("/exportBankCard")
行 51:     public Result<String> exportBankCard(@RequestBody BankCardPageDTO dto) {
行 52:         return Result.success(bankCardManageService.exportBankCard(dto));
行 53:     }
行 54: (空行)
行 55:     ... 其它 6 个方法，按 page → export → query → add → update → delete → listAll → batchUpdate 顺序
行 86: ...
行 87: }                                                ← 类结束
```

**关键行级规则**：
- 行 1: 小写驼峰包路径，单行
- 行 3-13: import **3 组**（项目 → 第三方 → JDK），每组**字典序**
- 行 16-33: 类 Javadoc `<ul><li>` 列表**接口清单**，每个 1 行
- 行 35-37: 只能有 `@Api` + `@RestController` + `@RequestMapping` 三个类级注解，按此顺序
- 行 41: 字段类型是 `IXxxManageService` **接口**（不是 Impl），变量名小写驼峰
- 行 45: 1 行方法体 `return Result.success(manageService.xxx(dto))`
- 行 47-48: 公共方法之间**空 1 行**
- 行 87: 类结束 `}` 前空 1 行

### 2. ManageService 行级模板（对照 BankCardManageServiceImpl.java 552 行）

```
行 1:   package com.obo.bi.cashier.service.impl;
行 2:   (空行)
行 3-50: import（3 组），按字典序：
         - cn.hutool.core.collection.CollUtil
         - com.alibaba.fastjson.JSONObject
         - com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper
         - com.obo.bi.cashier.helper.CashierManageHelper
         - com.obo.bi.cashier.dto.*
         - com.obo.bi.cashier.enums.SourceModuleEnum
         - com.obo.bi.cashier.po.*
         - com.obo.bi.cashier.service.I*ManageService / I*Service
         - com.obo.bi.cashier.utils.CashierExportUtils
         - com.obo.bi.cashier.constant.DictTypeConstants
         - com.obo.bi.cashier.vo.*
         - com.obo.bi.file.api.FileManageClient
         - com.obo.core.common.*
         - com.obo.bi.core.excel.export.ExcelExportService
         - lombok.extern.slf4j.Slf4j
         - org.springframework.beans.BeanUtils
         - org.springframework.stereotype.Service
         - org.springframework.transaction.annotation.Transactional
         - javax.annotation.Resource
         - java.time.LocalDate / LocalDateTime / format.DateTimeFormatter
         - java.util.* (ArrayList, Collections, HashMap, HashSet, List, Map, Objects, Set, function.Function, stream.Collectors)
行 51: (空行)
行 52-57: 类 Javadoc /** ... */
行 58: (空行)
行 59: @Slf4j
行 60: @Service
行 61: public class BankCardManageServiceImpl implements IBankCardManageService {
行 62: (空行)
行 63-103: @Resource 字段区（按 Service → Feign → Helper → Provider 顺序）
         @Resource
         private IBankCardService bankCardService;                       ← 1. 业务 Component Service
         @Resource
         private FileManageClient fileClient;                              ← 2. Feign Client
         @Resource
         private CashierManageHelper cashierManageHelper;                 ← 3. Helper
         @Resource
         private ICompanyBankCardService companyBankCardService;          ← 4. 跨 Component Service
         @Resource
         private IStoreService storeService;
         @Resource
         private IFileExpiryRecordService fileExpiryRecordService;
         @Resource
         private IFileExpiryRuleManageService fileExpiryRuleManageService;
         @Resource
         private IFileTagLibraryService fileTagLibraryService;
         @Resource
         private ExcelExportService excelExportService;
         @Resource
         private DataDictionaryProvider dataDictionaryProvider;
行 104: (空行)
行 105:    @Override
行 106:    public PageResult pageBankCard(BankCardPageDTO dto) {
行 107:        return bankCardService.pageBankCard(dto);                  ← 1 行转发
行 108:    }
行 109: (空行)
行 110:    /**
行 111:     * 导出银行卡信息到 Excel（异步生成并上传下载中心）。
行 112:     *
行 113:     * @param dto 查询条件（与列表页一致）
行 114:     * @return 下载中心文件ID（file_id）
行 115:     */
行 116:    @Override
行 117:    public String exportBankCard(BankCardPageDTO dto) {
行 118:        log.info("银行卡信息导出[开始]");                            ← 阶段开始日志
行 119:        // 1. 创建下载中心记录                                       ← 阶段化注释
行 120:        String userName = BaseContext.getUserName();
行 121:        String fileName = CashierExportUtils.buildExportFileName("银行卡信息");
行 122:        String fileId = CashierExportUtils.createDownloadRecord(fileClient, userName, fileName);
行 123:        // 2. 复用列表查询拉取当前筛选下全部数据
行 124:        BankCardPageDTO queryDTO = dto == null ? new BankCardPageDTO() : dto;
行 125:        queryDTO.setPageNum(1);
行 126:        queryDTO.setPageSize(CashierExportUtils.EXPORT_PAGE_SIZE);
行 127:        PageResult pageResult = bankCardService.pageBankCard(queryDTO);
行 128:        // ... 后续阶段
行 129:        return fileId;
行 130:    }
行 131: (空行)
行 132-274: 其它公共方法（queryBankCardById、addBankCard、updateBankCard、deleteBankCard、listAllBankCardWithBindStatus、batchUpdateBankCardField）
行 275-520: 私有 helper 方法（按被调用顺序倒序）
```

**行级规则**：
- 行 1: `service.impl` 包路径（不是 `service`）
- 行 3-50: import 数量较多，**按 Service → Mapper → Po → Dto → Vo → Enum → Util → Constant → Helper → Feign → core → lombok → spring → javax → java 三组** 严格分层
- 行 59-60: 类注解 `@Slf4j` + `@Service`（**没有** `@Api` 和 `@RequestMapping`——这些是 Controller 的）
- 行 63-103: `@Resource` 字段区，**10 个**（违反 §6 阈值 6，是反例，需要拆分）
- 行 105-108: 简单方法 1 行转发
- 行 110-115: 复杂方法必须有完整 Javadoc（5 行 /** */）
- 行 117-130: 复杂方法必须 `@Override` 在 public 之前
- 行 118: `log.info("[开始]xxx")` 阶段开始
- 行 119: `// 1. xxx` 阶段化注释
- 行 122: 业务逻辑方法调用（CashierExportUtils.createDownloadRecord）
- 行 124: null 检查（dto == null ... 兜底）
- 行 127: 跨 Component 调用（bankCardService.pageBankCard）

### 3. Component Service 行级模板（对照 BankCardServiceImpl.java 118 行）

```
行 1:   package com.obo.bi.cashier.service.impl;
行 2:   (空行)
行 3-11: import（3 组，比 ManageService 少很多）
         - com.baomidou.mybatisplus.core.metadata.IPage
         - com.baomidou.mybatisplus.extension.plugins.pagination.Page
         - com.obo.bi.cashier.dto.BankCardPageDTO
         - com.obo.bi.cashier.mapper.BankCardMapper
         - com.obo.bi.cashier.po.BankCard
         - com.obo.bi.cashier.service.IBankCardService
         - com.obo.core.common.entity.result.PageResult
         - com.obo.core.common.utils.CollUtils
         - org.springframework.stereotype.Service
行 12: (空行)
行 13-16: import java.util.*（Collection、Collections、List、stream.Collectors）
行 17: (空行)
行 18-20: 类 Javadoc /** 银行卡服务实现类 */
行 21: (空行)
行 22: @Service
行 23: public class BankCardServiceImpl
行 24:         extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl<BankCardMapper, BankCard>
行 25:         implements IBankCardService {
行 26: (空行)
行 27:     @Override
行 28:     public PageResult pageBankCard(BankCardPageDTO dto) {
行 29:         Page<BankCard> page = new Page<>(dto.getPageNum(), dto.getPageSize());   ← 构造 MyBatis-Plus Page
行 30:         IPage<BankCard> result = baseMapper.pageBankCard(page, dto);             ← 调 Mapper XML
行 31:         List<BankCard> records = result.getRecords();
行 32: (空行)
行 33-44: 业务逻辑（已选项前置）写在 Component 内部
行 45:         return new PageResult(result.getTotal(), records);                     ← 包装 PageResult
行 46:     }
行 47: (空行)
行 48:     /**
行 49:      * 按账号集合精确查询银行卡（仅过滤逻辑删除），供"已选项前置"使用
行 50:      */
行 51:     private List<BankCard> listByAccountNumbers(List<String> accountNumbers) {
行 52:         if (CollUtils.isEmpty(accountNumbers)) {
行 53:             return Collections.emptyList();
行 54:         }
行 55:         List<BankCard> list = this.lambdaQuery()
行 56:                 .in(BankCard::getAccountNumber, accountNumbers)
行 57:                 .eq(BankCard::getDeleted, 0)
行 58:                 .orderByDesc(BankCard::getCreateTime)
行 59:                 .list();
行 60:         return list == null ? Collections.emptyList() : list;
行 61:     }
行 62: (空行)
行 63-118: 其它方法（queryBankCardById / addBankCard / updateBankCard / deleteBankCard / isAccountNumberExists / listAllBankCard / listByBankCardIds）
```

**行级规则**：
- 行 1: 与 ManageService 同包
- 行 3-11: import 数量少（**6-9 个**），主要是 MP + 项目 DTO/PO/Mapper
- 行 22: 唯一类级注解 `@Service`（**没有** `@Slf4j`——Component 通常不写日志，或用 lombok 字段方式）
- 行 23-25: **必须 `extends ServiceImpl<XxxMapper, T>`** 写在独立行（行长限制）
- 行 28-46: 公共方法必须有 `@Override` 然后方法体
- 行 29: `Page<T>` 构造（`new Page<>(页码, 页大小)`）
- 行 30: **`baseMapper.xxx(...)`** 调 Mapper（不是 `mapper.xxx()`）
- 行 31: `result.getRecords()` 拿列表
- 行 33-44: 业务逻辑（**简单**：合并、过滤、组装）写在 Component
- 行 45: `new PageResult(total, records)` 包装返回值
- 行 51-60: 私有 helper 用 `this.lambdaQuery()` 链式
- 行 55-59: `this.lambdaQuery().in(...).eq(...).orderByDesc(...).list()`
- 行 60: null 兜底 `Collections.emptyList()`

### 4. Mapper 接口行级模板（对照 BankCardMapper.java）

```
行 1:   package com.obo.bi.cashier.mapper;
行 2:   (空行)
行 3-10: import
         - com.baomidou.mybatisplus.core.mapper.BaseMapper
         - com.baomidou.mybatisplus.core.metadata.IPage
         - com.baomidou.mybatisplus.extension.plugins.pagination.Page
         - com.obo.bi.cashier.dto.BankCardPageDTO
         - com.obo.bi.cashier.po.BankCard
         - org.apache.ibatis.annotations.Param
行 11: (空行)
行 12: import java.util.List;
行 13: (空行)
行 14-17: 类 Javadoc /** 银行卡Mapper接口 */
行 18: (空行)
行 19: @Mapper                                                          ← MyBatis 注解，可选
行 20: public interface BankCardMapper extends BaseMapper<BankCard> {
行 21: (空行)
行 22:     /**
行 23:      * 分页查询银行卡
行 24:      *
行 25:      * @param page 分页对象
行 26:      * @param dto 查询条件
行 27:      * @return 分页结果
行 28:      */
行 29:     IPage<BankCard> pageBankCard(Page<BankCard> page, @Param("dto") BankCardPageDTO dto);
行 30: (空行)
行 31:     /**
行 32:      * 根据账号统计数量
行 33:      *
行 34:      * @param accountNumber 账号
行 35:      * @param excludeId 排除的ID
行 36:      * @return 数量
行 37:      */
行 38:     int countByAccountNumber(@Param("accountNumber") String accountNumber, @Param("excludeId") Long excludeId);
行 39: }
```

**行级规则**：
- 行 1: `mapper` 包路径（不是 `service`）
- 行 19: `@Mapper` 注解（**可选**，但写更明确）
- 行 20: **`extends BaseMapper<PO>`** 必写
- 行 22-29: 公共方法必须有 Javadoc（7 行 /** */）
- 行 29: 多参数时**所有参数都用 `@Param("xxx")`** 命名
- 行 29: 返回类型为 MP 的 `IPage<PO>`（不是 `PageResult`）
- 行 38: 简单方法也带 Javadoc

### 5. Mapper XML 行级模板（对照 BankCardMapper.xml）

```
行 1:   <?xml version="1.0" encoding="UTF-8"?>
行 2:   <!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
行 3:   <mapper namespace="com.obo.bi.cashier.mapper.BankCardMapper">
行 4:   (空行)
行 5:       <select id="pageBankCard" resultType="com.obo.bi.cashier.po.BankCard">     ← 必须含列名别名
行 6:           SELECT id AS id, account_number AS accountNumber, account_name AS accountName,
行 7:                  bank_code AS bankCode, bank_name AS bankName, branch_name AS branchName,
行 8:                  bank_type AS bankType, open_date AS openDate, ...
行 9:           FROM cashier_bank_card
行 10:          WHERE deleted = 0                                                       ← 软删除必备
行 11:          <if test="dto.accountName != null and dto.accountName != ''">             ← 字符串 null+空
行 12:              AND account_name LIKE CONCAT('%', #{dto.accountName}, '%')           ← 模糊
行 13:          </if>
行 14:          <if test="dto.bankCodes != null and dto.bankCodes.size() > 0">           ← 集合 null+size
行 15:              AND bank_code IN
行 16:              <foreach collection="dto.bankCodes" item="code" open="(" separator="," close=")">
行 17:                  #{code}
行 18:              </foreach>
行 19:          </if>
行 20:          <if test="dto.openDateStart != null">
行 21:              AND open_date &gt;= #{dto.openDateStart}                              ← 大于等于转义
行 22:          </if>
行 23:          <if test="dto.openDateEnd != null">
行 24:              AND open_date &lt;= #{dto.openDateEnd}                                ← 小于等于转义
行 25:          </if>
行 26:          ORDER BY create_time DESC
行 27:      </select>
行 28:  (空行)
行 29:      <select id="countByAccountNumber" resultType="java.lang.Integer">
行 30:          SELECT COUNT(*) FROM cashier_bank_card
行 31:          WHERE deleted = 0 AND account_number = #{accountNumber}
行 32:          <if test="excludeId != null">
行 33:              AND id != #{excludeId}
行 34:          </if>
行 35:      </select>
行 36:  (空行)
行 37:  </mapper>
```

**行级规则**：
- 行 1: XML 声明必带
- 行 2: DOCTYPE 必带
- 行 3: `namespace` 必须等于 Mapper 接口全限定类名（**完全一致**）
- 行 5: `<select id="pageBankCard">` id 与 Mapper 接口方法名**完全一致**
- 行 5-8: **所有列名必须起别名** `snake_case AS camelCase`（保证与 PO 字段对应）
- 行 9: FROM 表名用 `cashier_{entity}` 命名规则（如 `cashier_bank_card`）
- 行 10: `WHERE deleted = 0` 软删除必备
- 行 11-13: 字符串字段判空 `!= null and != ''`、模糊用 `LIKE CONCAT('%', #{x}, '%')`
- 行 14-19: 集合字段判空 `!= null and size() > 0`、IN 用 `<foreach collection="..." item="x" open="(" separator="," close=")">`
- 行 21, 24: 大于等于 `&gt;=`、小于等于 `&lt;=` 必须 XML 转义
- 行 26: 排序 `ORDER BY create_time DESC`（按业务字段，不是数据库 id）
- 行 29: `resultType="java.lang.Integer"`（基础类型用全限定名）
- 行 37: 闭合 `</mapper>` 前空 1 行

### 6. 4 层接口契约速查表（按照以上行级模板）

| 层 | 文件名 | 命名 | 行级关键标识 |
|---|--------|------|-------------|
| Controller | `XxxController.java` | `XxxController` | `@Api` + `@RestController` + `@RequestMapping("/cashier/{module}")` |
| Service 聚合 | `IXxxManageService` 接口 | `IXxxManageService` | 在 `service/` 包 |
| Service 聚合 Impl | `XxxManageServiceImpl.java` | `XxxManageServiceImpl` | `implements IBankCardManageService`，`@Slf4j` + `@Service` |
| Component Service | `IXxxService` 接口 | `IXxxService` | `extends IService<T>` |
| Component Service Impl | `XxxServiceImpl.java` | `XxxServiceImpl` | `extends ServiceImpl<XxxMapper, T>` + `implements IBankCardService` |
| Mapper | `XxxMapper.java` | `XxxMapper` | `extends BaseMapper<T>` + `@Param` 显式 |
| Mapper XML | `XxxMapper.xml` | `XxxMapper.xml` | namespace = 接口全限定名 + 列名 AS 别名 |

### 7. 4 层命名精确规则

| 层 | 类名 | 实现名 | 接口名 | 路径 |
|---|------|--------|--------|------|
| Controller | `XxxController` | — | — | `controller/` |
| Service 聚合 | `XxxManageServiceImpl` | `IXxxManageService` | `service/impl/`、`service/` |
| Component Service | `XxxServiceImpl` | `IXxxService` | `service/impl/`、`service/` |
| Mapper | — | `IXxxMapper` | `mapper/` |
| Mapper XML | — | `XxxMapper.xml` | `resources/mapper/` |
| PO | `Xxx` | — | `po/` |
| DTO | `XxxDTO` | — | `dto/` |
| VO | `XxxVO` / `XxxListVO` / `XxxDetailVO` | — | `vo/` |
| Enum | `XxxEnum` | — | `enums/` 或 `enums/` |
