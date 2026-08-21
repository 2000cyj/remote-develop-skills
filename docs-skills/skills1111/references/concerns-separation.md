# 关注点分离规范（业务 vs 数据 vs Impl 拆分）

本规范覆盖**业务子域拆分**、**业务与数据分离**、**派生 Manager 拆分模式**三类规则。配合 `architecture-layers.md`、`code-structure.md`、`coding-quality.md` 使用。

## 1. 核心原则

业务编排与数据访问是两类不同的关注点：

- **数据访问层（Component 层）**：只关心"数据长什么样、怎么存、怎么取"。
  - 不关心：业务规则、外部依赖、跨表语义。
  - 命名：动词 + 领域词，如 `selectByRuleUniqueValue` / `countByRuleUniqueValues`。

- **业务编排层（Service 聚合层）**：关心"业务规则是什么、如何跨模块协同"。
  - 不关心：SQL 长什么样、表结构细节。
  - 命名：业务动词 + 业务对象，如 `pageBankCard` / `exportBankCard` / `batchUpdateBankCardField`。

两者**不允许在同一方法体里混编**——下沉数据访问到 Component，业务规则留在 Service 聚合层。

## 2. Impl 文件膨胀阈值

任何 `ManageServiceImpl` 超过以下任一标准即应**计划拆分**：

| 维度 | 阈值 | 说明 |
|------|------|------|
| 行数 | > 600 行 | 物理体积过载 |
| 公共方法数 | > 15 个 | 职责过宽 |
| 私有方法数 | > 25 个 | 辅助逻辑蔓延 |
| `@Resource` 注入依赖数 | > 6 个 | 协作者过多 |

> 拆分前**先列计划再执行**，一次性不超过 50%。拆分后**接口签名不变**，调用方零迁移。

## 3. 派生 Manager 拆分模式

当 Impl 超阈值时，按业务子域拆出 `sub-Manager`。常见 3 种模式：

### 3.1 Facade-Manager 模式（推荐）

- 原 `IXxxManageService` 对外保持不变，由 `XxxManageServiceImpl` 作为门面委托给各 sub-Manager。
- sub-Manager 例：`ICompanyShareholderManageService`、`ICompanyTaxVerificationManageService`、`ICompanyBankCardManageService` 等。
- 适用：现有 Controller 调用不变，子职责大幅膨胀（如 `CompanyManageServiceImpl`）。

```java
@Service
public class CompanyManageServiceImpl implements ICompanyManageService {
    @Resource private ICompanyShareholderManageService shareholderManageService;
    @Resource private ICompanyTaxVerificationManageService taxVerificationManageService;

    @Override
    public CompanyDetailVO queryCompanyDetail(String uniqueValue) {
        // 调用 sub-Manager 聚合结果
        CompanyDetailVO vo = ...;
        vo.setShareholders(shareholderManageService.listByCompany(uniqueValue));
        return vo;
    }
}
```

要点：

- `IXxxManageService` 接口方法签名不变，调用方零迁移。
- sub-Manager 实现类直接继承 `ServiceImpl` 或 `@Service` + Component 依赖。
- sub-Manager 之间不互相调用（避免横向耦合）。

### 3.2 sub-Manager 单独被 Controller 直接调用

- Controller 不通过 facade，直接注入 sub-Manager。
- 适用：菜单按业务子域分页签（如：股东 tab、经营范围 tab 分开）。

```java
@RestController
@RequestMapping("/cashier/company")
public class CompanyController {
    @Resource private ICompanyManageService companyManageService;
    @Resource private ICompanyShareholderManageService shareholderManageService;
    @Resource private ICompanyTaxVerificationManageService taxVerificationManageService;
    // ... 直接调用不同 sub-Manager
}
```

### 3.3 sub-Service 横向通信（不推荐）

- sub-Manager 之间互相调用。
- 风险：循环依赖、调试困难。
- **禁止**采用本模式，除非业务强约束无法避免。

### 3.4 拆分决策 checklist

判断用哪种模式前，先回答：

1. **现有 Controller 调用**是否会因为拆分而被迫改？
   - 是 → 3.1 Facade-Manager
   - 否 → 看 2.
2. **新拆出的 sub-Manager** 在 Controller 上是独立的一级菜单/页面？
   - 是 → 3.2 直接注入
   - 否 → 3.1 Facade-Manager
3. **sub-Manager** 是否会需要访问其它 sub-Manager？
   - 是 → 重构业务规则，把共同依赖下沉到 Component
   - 否 → 3.1 / 3.2 任选


## 4. 业务规则放置位置

| 规则类型 | 放置位置 | 示例 |
|----------|---------|------|
| **入参合法性校验**（必填/长度/格式） | DTO 上 `@NotBlank` / `@Size`；Controller 调用 Service 前最少量校验 | `@NotBlank(message = "印章名称不能为空")` |
| **业务前置校验**（跨表存在性、唯一性、关联性） | Service 聚合层方法入口前置 | `if (bankCardService.queryBankCardById(...) == null) throw new BusinessException(...)` |
| **业务状态机校验**（状态合法转换、权限校验） | Service 聚合层入口或 helper | `if (audit.status == AuditStatus.CANCELLED) throw new BusinessException("已取消不能修改")` |
| **数据级唯一性**（业务要求唯一但 DB 不约束） | Component 层抛业务异常 | `if (countByStoreCode(code, excludeUniqueValue) > 0) throw new BusinessException("编码已存在")` |
| **跨服务 / 跨系统的业务协同** | Service 聚合层编排（调用多个 Component 或 Feign Client） | 提交审批前同时检查子公司存在性 |

**禁止**：

- 在 Component 层抛入参校验的业务异常
- 在 Service 聚合层写 SQL 拼装或 `lambdaQuery` 链式


## 5. 数据访问语义化下沉

要让 Component 接口方法**贴着业务问题**，不是 CRUD 翻译。

### 5.1 反例

在 Service 聚合层里写：

```java
// 业务层陷入 SQL 拼装
List<Map<String, Object>> rows = this.lambdaQuery()
        .select("rule_unique_value AS ruleUniqueValue", "COUNT(1) AS cnt")
        .in(FileExpiryRecord::getRuleUniqueValue, ruleUniqueValues)
        .groupBy("rule_unique_value")
        .listMaps();
Map<String, Integer> result = new HashMap<>();
for (Map<String, Object> row : rows) {
    Object key = row.get("ruleUniqueValue");
    Object cnt = row.get("cnt");
    result.put(key.toString(), ((Number) cnt).intValue());
}
return result;
```

### 5.2 正例

下沉到 Component 暴露业务方法：

```java
// Component 接口
public interface IFileExpiryRecordService extends IService<FileExpiryRecord> {
    Map<String, Integer> countGroupedByRuleUniqueValues(List<String> ruleUniqueValues);
}

// Component 实现
@Override
public Map<String, Integer> countGroupedByRuleUniqueValues(List<String> ruleUniqueValues) {
    if (CollUtil.isEmpty(ruleUniqueValues)) {
        return Collections.emptyMap();
    }
    return this.lambdaQuery()
            .select("rule_unique_value AS ruleUniqueValue", "COUNT(1) AS cnt")
            .in(FileExpiryRecord::getRuleUniqueValue, ruleUniqueValues)
            .groupBy("rule_unique_value")
            .listMaps()
            .stream()
            .collect(Collectors.toMap(
                    r -> (String) r.get("ruleUniqueValue"),
                    r -> ((Number) r.get("cnt")).intValue()));
}
```

```java
// Service 聚合层只剩一行
return fileExpiryRecordService.countGroupedByRuleUniqueValues(ruleUniqueValues);
```

### 5.3 要点

- Component 接口方法名是**业务意图**而不是 SQL 翻译。
- Service 聚合层不应出现 `select("xxx AS xxx")`、`groupBy("xxx")`、`listMaps()` 这种字符串调用。
- 复杂 lambda 链式调用下沉到 Component 默认方法或私有方法。
- 对外暴露的类型应是 `Map<K, V>` / 业务 VO，而不是 `List<Map<String, Object>>` 这样的"裸 SQL 结构"。
- Component 默认方法是 Java 8+ 接口能力（`default` 关键字），无需额外类。


## 6. 业务编排层的代码组织

当 `ManageServiceImpl` 方法体超过 80 行时，建议：

### 6.1 阶段化注释

```java
@Override
@Transactional(rollbackFor = Exception.class)
public Boolean updateCompanyAll(CompanySaveRequestDTO request) {
    // 1. 前置校验
    validateCompany(request);
    // 2. 主表更新
    companyService.updateCompany(toCompany(request));
    // 3. 物理清空子表 + 重建
    companyShareholderService.deleteByCompanyUniqueValue(request.getUniqueValue());
    request.getShareholderList().forEach(item -> {
        companyShareholderService.save(toShareholder(request.getUniqueValue(), item));
    });
    // 4. 文件 SKU 拼接与附件变更
    cashierManageHelper.fileChange(request.getUniqueValue(), fieldFileMap);
    // 5. 文件标签写入
    saveCompanyCustomTags(request);
    return true;
}
```

阶段之间空一行；每个阶段 ≤ 15 行；总方法体 ≤ 80 行。

### 6.2 私有 helper 命名

- `validateXxx` — 业务校验
- `toXxx` — DTO/PO/VO 互转
- `buildXxx` / `mergeXxx` — 数据加工
- `fileChange` / `maskXxx` / `notifyXxx` — 副作用（跨模块副作用）

放在类底部（参考 `code-structure.md §5` 方法顺序）。

## 7. 反模式红线

| 反模式 | 违反条款 | 后果 |
|--------|---------|------|
| 在 `ManageServiceImpl` 里写 SQL、`lambdaQuery` 拼业务 | §5、§1 | 业务与数据混杂，单元测试困难 |
| 在 `ComponentImpl` 里 throw `BusinessException`、`@Transactional`、权限判断 | §4、§1 | 业务下渗，越权调用 Component |
| 把所有"用得到的"helper 都集中在 `CashierManageHelper` | §3 | 违反"职责就近"原则 |
| Controller 直接 import Component 类 | `SKILL.md` §职责边界 | 越级调用 |
| Impl 文件超过阈值（§2）不拆 | §2 | 维护成本指数级上升 |
| `lambdaQuery()` 在 Service 聚合层同时拼 select + groupBy + listMaps | §5 | 数据访问下沉不彻底 |

## 8. 小结

业务与数据的关注点分离最终落到 3 个动作：

1. **数据访问下沉**到 Component 层暴露业务方法（不暴露 lambda 拼装）
2. **业务编排**集中在 Service 聚合层，超阈值时拆 sub-Manager
3. **业务规则**按类型分层放置：DTO 注解 → Service 入口前置 → 状态机校验 → 数据级唯一性下沉到 Component

只要这 3 个动作到位，目录结构和代码结构会自然清晰，无需靠 IDE "Find Usages" 链式追溯。
