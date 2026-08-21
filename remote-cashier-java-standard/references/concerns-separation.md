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

---

## 业务-数据归属精确规则（Component vs Service 聚合层，按行级）

本章明确**两类 Service** 之间的边界：哪些 Service 文件放哪一层、按行级允许什么 / 禁止什么。

### 1. 物理位置决定层

| Service 类型 | Service 接口路径 | Service Impl 路径 |
|------|------|------|
| **Component Service**（数据访问层）| `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/IXxxService.java` | `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/impl/XxxServiceImpl.java` |
| **Service 聚合层**（业务编排） | `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/IXxxManageService.java` | `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/XxxManageServiceImpl.java` |
| **Helper / Convert / Strategy** | `bi-cashier-component/src/main/.../helper/convert/` 或 `bi-cashier-service/src/main/.../utils/` | （同前） |

### 2. Component Service 行级模板（数据访问）

```java
package com.obo.bi.cashier.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.obo.bi.cashier.po.Xxx;
import com.obo.bi.cashier.mapper.XxxMapper;

public interface IXxxService extends IService<Xxx> {
    // 数据访问方法：纯 CRUD
    Xxx getById(Long id);
    List<Xxx> listByCompanyUniqueValue(String companyUniqueValue);
}

package com.obo.bi.cashier.service.impl;

@Slf4j
@Service
public class XxxServiceImpl
        extends ServiceImpl<XxxMapper, Xxx>                          // 行 N：必须 extends ServiceImpl
        implements IXxxService {

    @Override
    public Xxx getById(Long id) {
        if (id == null) return null;                                 // 判空 → 直接返回 null
        return baseMapper.selectById(id);                            // 调 Mapper
    }

    @Override
    public List<Xxx> listByCompanyUniqueValue(String companyUniqueValue) {
        if (StringUtils.isBlank(companyUniqueValue)) {
            return Collections.emptyList();                          // 空集合
        }
        return this.lambdaQuery()                                    // 链式查询
                .eq(Xxx::getCompanyUniqueValue, companyUniqueValue)
                .eq(Xxx::getDeleted, 0)
                .list();
    }
}
```

### 3. Component Service 禁止的事（按行级）

| 行级位置 | 禁止内容 |
|---------|----------|
| **类级 Javadoc** | 不写"业务逻辑" / "状态机" / "事务编排" |
| **类注解** | 不加 `@Transactional` |
| **@Override 公共方法体** | 不抛 `throw new BusinessException` |
| **@Override 公共方法体** | 不调 Feign Client |
| **@Override 方法体** | 不写 `@Resource` 注入其他 Component Service |
| **@Override 方法体** | 不写 `@Resource` 注入 Helper 业务层 |
| **@Override 方法体** | 不写 `@Resource` 注入 Feign / 数据字典 Provider |
| **私有方法** | 不含业务校验（`if (xxx) throw ...`） |
| **@Override 方法体** | 不直接调 `this.lambdaQuery()` 拼复杂业务聚合 |

### 4. Service 聚合层行级模板（业务编排）

```java
package com.obo.bi.cashier.service;

import com.obo.bi.cashier.dto.XxxSaveDTO;
import com.obo.bi.cashier.po.Xxx;
import com.obo.bi.cashier.service.IXxxManageService;
import com.obo.bi.cashier.service.IXxxService;                // 注入 Component Service
import com.obo.bi.cashier.helper.CashierManageHelper;
import com.obo.bi.gateway.service.IFileManageClient;            // 注入 Feign Client

public interface IXxxManageService {
    /** 业务编排入口：先校验后编排 */
    Boolean saveXxx(XxxSaveDTO dto);
}

package com.obo.bi.cashier.service.impl;

@Slf4j
@Service
public class XxxManageServiceImpl implements IXxxManageService {

    @Resource
    private IXxxService xxxService;                                // 注入 Component Service

    @Resource
    private CashierManageHelper cashierManageHelper;               // 注入 Helper

    @Resource
    private IFileManageClient fileClient;                         // 注入 Feign Client

    @Override
    public Boolean saveXxx(XxxSaveDTO dto) {
        if (StringUtils.isBlank(dto.getXxx())) {                   // 业务校验（直接判空）
            throw new BusinessException("xxx 不能为空");
        }
        return xxxService.saveXxx(dto);                            // 调 Component Service
    }
}
```

### 5. Service 聚合层禁止的事（按行级）

| 行级位置 | 禁止内容 |
|---------|----------|
| **类声明** | 不写 `extends ServiceImpl<...>`（这是 Component 层的事） |
| **类级 Javadoc** | 不写"数据访问" / "CRUD" |
| **类字段** | 不使用 `baseMapper`（baseMapper 是 Component 私有） |
| **@Override 方法体** | 不直接写 `this.lambdaQuery()` / `this.lambdaUpdate()` |
| **@Override 方法体** | 不写 SQL 字符串 |
| **@Override 方法体** | 不调 `baseMapper.xxx()` 直接 Mapper |
| **@Override 方法** | 不写单纯的 `pageXxx()` / `getById()` 这种 CRUD |

### 6. Service 接口命名的硬规则

| Service 类型 | 接口名 | 路径 |
|------|------|------|
| 数据访问 | `IXxxService`（**不含 Manage**） | `bi-cashier-component/.../service/` |
| 业务编排 | `IXxxManageService`（**必须含 Manage**） | `bi-cashier-service/.../service/` |

**反例**：
- `IXxxService` 在 `bi-cashier-service` —— 立即搬移到 `bi-cashier-component`
- `IXxxManageService` 在 `bi-cashier-component` —— 立即搬移到 `bi-cashier-service`
- `IXxxService` 名字里有 `Service` 但接口内只做 CRUD —— 放 Component
- `IXxxService` 名字里有 `Service` 但接口内有业务校验或事务 —— 名字错，应该叫 `IXxxManageService` 放 Service 聚合层

### 7. Service Impl 命名的硬规则

| Service 类型 | Impl 名 | 路径 |
|------|------|------|
| 数据访问 | `XxxServiceImpl extends ServiceImpl<XxxMapper, T>` | `bi-cashier-component/.../service/impl/` |
| 业务编排 | `XxxManageServiceImpl implements IXxxManageService` | `bi-cashier-service/.../service/impl/` |

**反例**：
- `XxxServiceImpl` 出现在 `bi-cashier-service`（应放 Component）
- `XxxManageServiceImpl` 出现在 `bi-cashier-component`（应放 Service 聚合层）
- `XxxServiceImpl` 不含 `extends ServiceImpl`（漏掉）
- `XxxServiceImpl` 不含 `implements IXxxService`（漏掉）

### 8. 已迁移的实际例子（这轮工作）

| 旧位置 | 新位置 | 触发原因 |
|------|------|------|
| `bi-cashier-service/.../service/IAuditFileRelationService.java` | `bi-cashier-component/.../service/IAuditFileRelationService.java` | 缺 Manage 后缀 → 改放 Component |
| `bi-cashier-service/.../service/ISubAccountAuditService.java` | `bi-cashier-component/.../service/ISubAccountAuditService.java` | 同上 |
| `bi-cashier-service/.../service/ISubAccountService.java` | `bi-cashier-component/.../service/ISubAccountService.java` | 同上 |
| `bi-cashier-service/.../service/impl/AuditFileRelationServiceImpl.java` | `bi-cashier-component/.../service/impl/AuditFileRelationServiceImpl.java` | 跟随接口 |
| `bi-cashier-service/.../service/impl/SubAccountAuditServiceImpl.java` | `bi-cashier-component/.../service/impl/SubAccountAuditServiceImpl.java` | 同上 |
| `bi-cashier-service/.../service/impl/SubAccountServiceImpl.java` | `bi-cashier-component/.../service/impl/SubAccountServiceImpl.java` | 同上 |

### 9. Component Service 业务校验的红线

即使 Component Service 的方法中有"业务校验"（如 `assertRelationComplete`），仍**应在 Component 层**：

```java
// ✅ 允许：Component Service 内部字段完整性校验
@Override
public void save(List<AuditFileRel> relations) {
    for (AuditFileRel relation : relations) {
        assertRelationComplete(relation);                            // 字段完整性（数据约束）
        assertNoSensitiveKeyword(relation);                          // 字段关键字（数据约束）
    }
    baseMapper.insert(...);
}

// ❌ 禁止：Component Service 业务校验（应放 Service 聚合层）
if (!"admin".equals(getRole())) {
    throw new BusinessException("无权操作");                           // 业务校验 = Service 聚合层的事
}
```

**判断准则**：
- "字段 X 不能为空"、"URL 不能含 password" → Component Service（数据约束）
- "用户没权限"、"状态已取消不能编辑"、"业务规则 A 不满足" → Service 聚合层（业务校验）

### 10. 跨层调用规则

```
Service 聚合层 → Component Service          ✅ 允许
Service 聚合层 → Mapper（baseMapper.xxx）   ❌ 禁止（必须通过 Component Service）
Component Service → Mapper（baseMapper.xxx）   ✅ 允许
Component Service → Service 聚合层           ❌ 禁止（反向依赖）
Component Service → 其他 Component Service    ❌ 禁止（横向依赖）
Service 聚合层 → Feign Client                 ✅ 允许
Component Service → Feign Client             ❌ 禁止（数据层不跨服务）
```

### 11. 反例清单（按行级）

- ❌ Component Service 接口 `extends Service` 而不是 `IService<T>`
- ❌ Component Service Impl 没 `extends ServiceImpl<XxxMapper, T>`
- ❌ Service 聚合层 Impl `extends ServiceImpl`（侵入 Component 层）
- ❌ Service 聚合层 Impl 直接调 `baseMapper.xxx()`
- ❌ Service 聚合层 Impl 写 `this.lambdaQuery()` 链式
- ❌ Service 聚合层 Impl 写 SQL 字符串
- ❌ Component Service 抛 `throw new BusinessException("业务错误")`
- ❌ Component Service 加 `@Transactional` 处理跨表写入
- ❌ Component Service 注入 Feign Client 或数据字典 Provider
- ❌ Service 聚合层 Impl 不依赖 Component Service 直接调 Mapper
- ❌ 文件名 `IXxxService` 出现在 `bi-cashier-service` 模块
- ❌ 文件名 `IXxxManageService` 出现在 `bi-cashier-component` 模块
