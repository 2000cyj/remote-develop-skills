# refactoring-basics — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

## 实战重构案例（V20260907）

> 本节是 bi-cashier 实际完成的若干轮重构沉淀下来的"判断口径"。每条都对应至少 1 次"可改可不改"的取舍，给出**明确倾向**+**例外**。新 PR 评审遇到同类场景时可直接引用。

### 1. 二级模块编码（`twoLevelId`）走 `TwoLevelEnum`，禁止字面量硬编码

**4 个 `*Audit*ManageServiceImpl` 原先各自 `private static final String TWO_LEVEL_ID_CWSH = "CWSH";`**——4 份重复硬编码，且与 `bi-factory` 的 `TwoLevelEnum.CWSH`（value="cwsh"）撞名。

**统一做法**：
- `bi-core/.../enums/TwoLevelEnum` 加 4 个出纳流程枚举项（`DPSJLC` / `DPXJLC` / `DPBGLC` / `DPYCZTLC`）
- 4 个 Impl 用 `import static com.obo.core.common.enums.TwoLevelEnum.DPBGLC;` 后写 `submitReq.setTwoLevelId(DPBGLC.getValue())`
- 删除 4 份私有常量

**反面**：DTO 上加 `private String twoLevelId = "CWSH"` 默认值。看似省事，但驳回/退回/异常等非默认场景会被静默覆盖，且会埋"远端 enum 改 code 字符串"的未来不一致雷。

### 2. Flowable outcome 走远端 `FlowableOutcomeEnum.APPROVE.getCode()`，禁止本地"业务字符串"常量

**4 个 Impl 原先 `private static final String OUTCOME_PASS = "PASS"` / `"同意"`**——其中 Change/Abnormal 的 `"PASS"` **不匹配远端 `FlowableOutcomeEnum` 任何 code**（远端合法值是"同意/通过/驳回/拒绝/不通过/rejected/撤回/退回"），是隐藏 bug。

**统一做法**：
- `import static com.obo.bi.flowable.enums.FlowableOutcomeEnum.APPROVE;`
- 全部 `setOutcome(APPROVE.getCode())`
- 删除本地 4 份 `OUTCOME_PASS` 常量

**例外**：skill `error-handling.md:7` 明确"outcome 必传"。**不能**因为"远端有默认行为"就省略 setOutcome——通过路径下省略会导致 `flow_outcome` 流程变量丢失，下游变量门会失效。

### 3. 节点号走 `XxxNodeEnum.getNodeNo()`，禁止 `private static final int NODE_NO_xxx`

**`StoreAuditOnboardingManageServiceImpl` 原先 `NODE_NO_PLATFORM_ONBOARDING = 9` / `NODE_NO_STORE_BUILD_CONFIRM = 10`**——12 处使用，与 `StoreAuditOnboardingNodeEnum.PLATFORM_ONBOARDING.getNodeNo()` 重复定义节点号。

**统一做法**：
- 删除 2 个 `int` 私有常量
- 12 处 `==` 改为 `StoreAuditOnboardingNodeEnum.PLATFORM_ONBOARDING.getNodeNo()` / `.STORE_BUILD_CONFIRM.getNodeNo()`

**理由**：`getNodeNo()` 是 enum 单例的 final 方法，**JIT 内联 0 开销**；换来"流程加节点 11 时只改 enum 一处"的强保证。

### 4. DTO 反射写入（`applyFields`）的字段白名单**可去**，但要明确风险

**`StoreAuditOnboardingManageServiceImpl` 原先 `PLATFORM_ONBOARDING_FIELDS` / `STORE_BUILD_CONFIRM_FIELDS` 两个 Set**——作为反射写入前的"白名单护栏"。

**两种处理**：
- **A（保留）**：补 Javadoc 说明"为什么是白名单"。理由：白名单是反射的安全护栏，缺失会让 DTO 里任意字段（含 `id` / `uniqueValue` / `deleted`）被改。
- **B（去白名单 + 保留反射）**：`applyFields` 删 `allowedFields` 形参，找不到字段 `log.warn + continue`，`validateNodeDataItems` 同步删白名单循环。**接受"业务表任意字段可被 DTO 改写"的风险**。
- **C（去白名单 + 去反射）**：重写 `applyFields` 为 `BeanUtils.copyProperties` + 强类型 DTO。**工程量大，不在本次范围**。

**评审倾向**：项目方拍板 B 则按 B 执行；**绝不**因为"用得不多"就误删白名单后又未改反射实现。

### 5. 业务限制常量 `MIN_xxx` / `MAX_xxx` 按"是否仅日志"判断去留

**Change 文件 `MIN_STORE_CHANGE_ITEM_COUNT` / `MAX_STORE_CHANGE_ITEM_COUNT`，Abnormal 同样两份**。

**判断口径**：
- **仅写日志**（无业务校验）→ **删，改字面量**。Change 的 `MIN_STORE_CHANGE_ITEM_COUNT` 是这种情况（`1` 是行业常识），删除后 2 处 log 直接写 `1`。
- **有业务校验** + **log** + **错误消息拼接** 三种职责 → **保留为私有常量 OR 抽到公共常量类**。Abnormal 的 `MAX_ABNORMAL_STORE_COUNT` 是这种情况（6 处使用，2 处校验 / 2 处 log / 2 处错误消息）。
- **纯字面量 vs 命名常量**取舍：业务团队能接受"未来改阈值要在 N 处同步"→ 字面量；否则保留或抽公共。

**执行经验**：用"占位符→字面量"两段式避免冲突——先把 `OLD_NAME` 改成 `OLD_NAME_PLACEHOLDER`（`replace_all` 一把全改），再 `replace_all` 把占位符全替换成字面量，保证 N 处同步。

### 6. 不要顺手写"不存在的常量"

**教训**：本人在执行"删 MIN_STORE_CHANGE_ITEM_COUNT"步骤时，**手滑**写出 `private static final String OUTCOME_PASS_VALUE = "同意";`——这是上一轮已删的"用 APPROVE.getCode() 替代"的旧实现。`OUTCOME_PASS_VALUE` 是个**凭空编造**的常量名。

**防御**：
- 删除常量前，先用 `grep -rn "常量名" --include="*.java"` 确认 0 引用
- 写常量前，先用 `grep -rn "常量名" --include="*.java"` 确认**真的没人叫这个名字**
- Edit 工具的"old_string / new_string"比对能挡住一部分，但**手滑的"虚构旧名"挡不住**

### 7. 禁止"简单数据筛选赋值"wrapper helper（V20260907 强化）

**反面案例**（`AccountAuditRecorderImpl` 原状）：

```java
private Map<String, StoreAuditOnboardingStore> buildStoreOnboardingStoreMap(List<StoreAuditOnboardingStore> stores) {
    if (stores == null) { return new HashMap<>(); }
    return stores.stream()
            .filter(s -> s != null && StringUtils.isNotBlank(s.getStoreUniqueValue()))
            .collect(Collectors.toMap(StoreAuditOnboardingStore::getStoreUniqueValue, s -> s, (a, b) -> a));
}
```

- **4 个几乎一样的 helper**（`buildStoreOnboarding/Offboarding/Change/AbnormalStoreMap`），仅泛型不同
- 每个仅被**1 个调用方**使用（`recordStoreXxx`）
- 纯数据筛选 + `Collectors.toMap` 包装，**无任何业务逻辑**

**判定为反模式**：skill §13.6 已列"一调用一方法 wrapper → 删"。**简单数据 wrapper 不构成"独立业务单元"**——拆出来反而：
- 增加阅读跳数（点进 helper 才能看到在做什么）
- 4 个 helper 的**重复结构**会随业务演进漂移（哪天需要过滤条件了，4 处可能要分别改）
- 行数虚增但实质信息量=0

**正确做法**：直接在 record 方法体内写 stream 三元式：

```java
Map<String, StoreAuditOnboardingStore> storeMap = context.getStores() == null
        ? new HashMap<>()
        : context.getStores().stream()
                .filter(s -> s != null && StringUtils.isNotBlank(s.getStoreUniqueValue()))
                .collect(Collectors.toMap(StoreAuditOnboardingStore::getStoreUniqueValue, s -> s, (a, b) -> a));
```

**保留 helper 的判断标准**（**3 条全满足**才保留）：

1. ✅ helper 内部有**真实业务逻辑**（不是单纯 filter / map / collect）
2. ✅ helper 被**至少 2 个调用方**使用
3. ✅ helper 的语义**无法用 1-3 行业务代码内联替代**（如复杂查询构造、递归搜索、链式组装）

**反面**（满足任一条件即应内联）：
- ❌ 纯数据流转换（filter / map / collect / 兜底赋值）
- ❌ 单调用方
- ❌ 业务规则能用 if / 三元 / 链式调表达

**典型违规清单**（PR评审可直接扫）：

```bash
# 找 4 个候选 helper 类型的违规private 方法
grep -nE "private\s+(Map<String|List<|void)\s+\w+\(" impl/*.java | grep -v "Override"
```

常见违规命名：`buildXxxMap` / `buildXxxList` / `applyXxxDefaults` / `initXxxContext` / `convertXxxMap`


### 8. `@Resource` 注入字段按字段名字母序统一放到类名下（V20260914）

> 来源：`OperatingScopeManageServiceImpl` 重构（2026-09-14）。原文件把第二个 `@Resource` 字段插在 `updateOperatingScope` 和 `deleteOperatingScope` 两个方法之间，违反 §4「字段顺序」。

**反面案例**：

```java
@Service
public class OperatingScopeManageServiceImpl implements IOperatingScopeManageService {

    @Resource
    private IOperatingScopeService operatingScopeService;

    @Override
    public PageResult pageOperatingScope(OperatingScopePageDTO dto) { ... }

    // ... 若干 public 方法 ...

    @Resource
    private ICompanyBusinessScopeService companyBusinessScopeService;   // ❌ 散落在方法间

    @Transactional(rollbackFor = Exception.class)
    @Override
    public Boolean deleteOperatingScope(Long id) {
        // 这里才用到 companyBusinessScopeService
    }
}
```

**判定为反模式**：违反 §4「字段顺序」——`@Resource` 注入字段必须**集中放在类名下、方法声明之前**，且多个 `@Resource` 之间按**字段名**（不是类型名）字母序排列。

**正确做法**：

```java
@Service
public class OperatingScopeManageServiceImpl implements IOperatingScopeManageService {

    @Resource
    private ICompanyBusinessScopeService companyBusinessScopeService;   // c 字母序在前

    @Resource
    private IOperatingScopeService operatingScopeService;

    @Override
    public PageResult pageOperatingScope(OperatingScopePageDTO dto) { ... }
}
```

**理由**：
1. 字段集中声明使 Service 依赖的 Component 一目了然
2. 字母序避免「我先写的 `@Resource` 在前面、后写的反而在后」的散乱
3. PR 评审可用一行命令验证：`grep -n "@Resource" <file>.java` 应集中在类体顶部 1-2 行内

**典型违规扫描**：

```bash
# @Resource 字段应该只出现在类体顶部，不应散落在 public 方法之间
awk '/@Resource/{found=NR; next} /^[[:space:]]*(public|@Override)/ && found && NR > found + 2 {print FILENAME":"NR": @Resource 散落到方法间"}' <file>.java
```

判定：所有 `@Resource` 行号必须小于该类第一个 `@Override` 或 `public` 方法的行号。


### 9. 分页 PageResult 泛型链路对齐：Controller → Manage → Component（V20260914）

> 来源：`OperatingScopeController` / `IOperatingScopeManageService` / `OperatingScopeManageServiceImpl` / `IOperatingScopeService` / `OperatingScopeServiceImpl` 五层分页链路类型对齐（2026-09-14）。

#### 原链路（3 处不一致，全靠类型擦除骗编译）

| 层 | 文件:行 | 原签名 | 问题 |
|---|---|---|---|
| Controller | `OperatingScopeController.java:46` | `Result<PageResult>` | raw PageResult；PO 全部字段（含 `deleted` / `parent_id` 表字段）泄漏到前端 |
| Manage 接口 | `IOperatingScopeManageService.java:23` | `PageResult<OperatingScope>` | PO 透出 Manage 层；与 Controller 拼不起来 |
| Manage 实现 | `OperatingScopeManageServiceImpl.java:48` | `PageResult<OperatingScopeVO>` | **伪泛型**——签名说 VO，records 实际是 PO（Component 返的），靠 `@SuppressWarnings` 或类型擦除编译过，运行期 `vo.getXxx()` 会 ClassCastException |
| Component 接口 | `IOperatingScopeService.java:22` | `PageResult` | raw PageResult |
| Component 实现 | `OperatingScopeServiceImpl.java:26` | `PageResult` | raw PageResult |

**伪泛型最阴险**：编译通过、所有 IDE 跳转正常、单元测试 mock 也 ok，唯一炸的场景是下游真正调用 `records.get(0).getName()` 才在运行期崩，且单元测试用 mock 不打 records 时根本发现不了。

#### 修复后链路（5 层类型一致 + 显式 PO→VO 转换点）

| 层 | 签名 | 转换点 |
|---|---|---|
| Controller | `Result<PageResult<OperatingScopeVO>>` | 仅委托 |
| Manage 接口 | `PageResult<OperatingScopeVO>` | — |
| Manage 实现 | `PageResult<OperatingScopeVO>` | **显式 `BeanCopyUtils.copyList(records, OperatingScopeVO::new)`** |
| Component 接口 | `PageResult<OperatingScope>` | — |
| Component 实现 | `PageResult<OperatingScope>` | 仅返回 PO records |

#### 关键代码：Manage 实现层的转换样板

```java
@Override
public PageResult<OperatingScopeVO> pageOperatingScope(OperatingScopePageDTO dto) {
    PageResult<OperatingScope> pageResult = operatingScopeService.pageOperatingScope(dto);
    if (CollectionUtils.isEmpty(pageResult.getRecords())) {
        return new PageResult<>(pageResult.getTotal() == null ? 0L : pageResult.getTotal(),
                                 Collections.emptyList());
    }
    List<OperatingScopeVO> records = BeanCopyUtils.copyList(pageResult.getRecords(), OperatingScopeVO::new);
    return new PageResult<>(pageResult.getTotal(), records);
}
```

#### 判定为反模式的 4 个特征

1. **接口/实现任一层是 raw `PageResult`**——编译器不会报，但 `getRecords()` 返回 raw `List`，下游遍历全靠强转
2. **上层接口声明 `PageResult<VO>` 但实现直接 `return component.pageXxx(dto)`**——伪泛型，重灾区
3. **Controller `Result<PageResult>` 没带泛型**——前端拿到响应时 `records` 字段类型是 `Object[]`，TS 端也拿不到元素类型提示
4. **PO 字段出现在 Controller 响应中**（如 `deleted` / `parent_id` / `create_by` 等表字段）——VO/PO 分层失效

#### 推荐扫描命令

```bash
# 扫 raw PageResult（无泛型参数的 PageResult 出现位置）
grep -rn "PageResult\b" --include="*.java" bi-cashier/ \
  | grep -vE "PageResult<[^>]+>" \
  | grep -vE "^[^:]+:[0-9]+:[[:space:]]*\*"     # 排除 Javadoc
  | grep -vE "^[^:]+:[0-9]+:[[:space:]]*//"     # 排除单行注释

# 扫伪泛型：Manage 实现里直接 return component.pageXxx 没用 copyList
grep -rn "return [a-zA-Z]*Service.page\|return component.page\|return [a-zA-Z]*ManageService.page" \
  --include="*ManageServiceImpl.java" bi-cashier/
```

#### 关联规则

- SKILL.md §9（分页 PageResult 必须声明泛型）——本案例是该规则的落地版
- `code-review-checklist.md` §3 + §8 检查项


### 10. Component 层 CRUD 失败必须写关键日志，不能静默返 false（V20260914）

> 来源：`OperatingScopeServiceImpl` 重构（2026-09-14）。原文件 3 个 CRUD 方法都是
> `return baseMapper.xxx() > 0;` 静默返 false，SELECT 按 ID 也静默返 null。

#### 反面案例（静默失败、无现场）

```java
@Service
public class OperatingScopeServiceImpl extends ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService {

    @Override
    public Boolean addOperatingScope(OperatingScope operatingScope) {
        return baseMapper.insert(operatingScope) > 0;          // ❌ 失败原因丢
    }

    @Override
    public Boolean updateOperatingScope(OperatingScope operatingScope) {
        return baseMapper.updateById(operatingScope) > 0;      // ❌ 上游直接转发 false 给前端
    }

    @Override
    public Boolean deleteOperatingScope(Long id) {
        return baseMapper.deleteById(id) > 0;                  // ❌ 同上
    }

    @Override
    public OperatingScopeVO queryOperatingScopeById(Long id) {
        OperatingScope scope = baseMapper.selectById(id);
        if (scope == null || scope.getDeleted() == 1) {        // ❌ null vs 软删 不分；且 getDeleted==1 是死代码（selectById 已被 @TableLogic 自动过滤）
            return null;
        }
        ...
    }
}
```

#### 三类问题与上游连锁后果

| Component 层问题 | Manage 层后果 | 前端后果 |
|---|---|---|
| `add` 返回 false | 上游抛 `BusinessException("新增经营范围失败")` | 用户看到“新增失败”；SRE 看不到为什么失败（约束冲突？重复键？连接超时？）|
| `update` 返回 false | 上游 `return operatingScopeService.updateOperatingScope(scope)` 直接转发 | **前端拿到 false 当成功**，用户不知道修改未生效 |
| `delete` 返回 false | 上游 `return operatingScopeService.removeByIds(scopeIds)` 直接转发 | 同上，列表看上去删了但实际还在 |
| `queryById` 返 null 不分场景 | Manage 层 `queryOperatingScopeById` 也返 null，调用方不知道是“id 不存在”还是“被软删” | 404 与 403 混淆，审计难度大（注：PO 继承 BaseEntity 后，selectById 已被 `@TableLogic` 自动过滤 deleted=1，`scope.getDeleted()==1` 分支是死代码，仅保留 null 与非 null 的区分） |

#### 正确做法：日志级别按场景选

```java
@Slf4j
@Service
public class OperatingScopeServiceImpl extends ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService {

    @Override
    public Boolean addOperatingScope(OperatingScope operatingScope) {
        boolean ok = baseMapper.insert(operatingScope) > 0;
        if (!ok) {
            // ERROR：上游会抛异常，用户级失败
            log.error("经营范围新增失败 name={}, parentId={}",
                    operatingScope.getName(), operatingScope.getParentId());
        }
        return ok;
    }

    @Override
    public Boolean updateOperatingScope(OperatingScope operatingScope) {
        boolean ok = baseMapper.updateById(operatingScope) > 0;
        if (!ok) {
            // WARN：可能是 id 不存在（伪 update），需要日志以便排查“修改未生效”
            log.warn("经营范围更新未生效 id={}, name={}",
                    operatingScope.getId(), operatingScope.getName());
        }
        return ok;
    }

    @Override
    public Boolean deleteOperatingScope(Long id) {
        boolean ok = baseMapper.deleteById(id) > 0;
        if (!ok) {
            log.warn("经营范围删除未生效 id={}", id);
        }
        return ok;
    }

    @Override
    public OperatingScopeVO queryOperatingScopeById(Long id) {
        OperatingScope scope = baseMapper.selectById(id);
        if (scope == null) {
            // DEBUG：404 正常场景，不污染生产日志
            // selectById 已被 BaseEntity.@TableLogic 自动过滤 deleted=1，不会返回软删记录，无需再判 getDeleted
            log.debug("经营范围详情查询未命中 id={}", id);
            return null;
        }
        ...
    }
}
```

#### 日志级别决策表

| 场景 | 级别 | 理由 |
|---|---|---|
| INSERT 返 false | `log.error` | 上游一定会转抛 `BusinessException`，用户级失败 |
| UPDATE 返 false | `log.warn` | 可能“伪 update”（id 不存在）也可能是 DB 错误，需要现场但不一定严重 |
| DELETE 返 false | `log.warn` | 同 UPDATE |
| SELECT by ID 未命中（null） | `log.debug` | 404 正常场景，生产日志不污染 |
| SELECT by ID 命中软删记录 | `log.warn` | 审计场景，可能是 stale id 或越权访问 |
| SELECT by ID 返 null 但调用方预期不为 null | `log.warn` | 需调用方主动检查并 log |
| `lambdaQuery().list()` 返 null | 转 `Collections.emptyList()` 并 **不**记日志 | §8 规定空集合返 `emptyList()` |
| `lambdaQuery().page()` 返 null（异常） | `log.error` + 重新抛 | MyBatis-Plus 一般不返 null，真返了是异常 |

#### 关联规则

- SKILL.md §10（关键业务事件日志）——原规则偏 Manage 层，本案例补齐 Component 层覆盖
- `code-review-checklist.md` §3 检查项（加了 Component 层日志条目）
- SKILL.md §8（空集合返 `Collections.emptyList()`）—— `listAllOperatingScope` 不能 log.error


### 11. BeanCopyUtils 混合场景：`copyIgnore` 排除例外字段（V20260914）

> 来源：`OperatingScopeManageServiceImpl` 重构（2026-09-14）。`addOperatingScope` 有 6 个同名字段 + 2 个例外字段（`parentId` null 兜底、`level` 派生计算）。前一轮 sweep **漏了 BeanCopyUtils 优化**——看到例外字段就停手、剩下 6 个同名字段全手写。

#### 原代码（错误：“看到例外就退出 copy”）

```java
@Override
public Boolean addOperatingScope(OperatingScopeSaveDTO dto) {
    OperatingScope scope = new OperatingScope();
    scope.setParentId(dto.getParentId() == null ? 0L : dto.getParentId());  // 例外1：null 兜底
    if (dto.getParentId() == null) {
        scope.setLevel(1);                                                   // 例外2：派生
    } else {
        OperatingScopeVO parent = operatingScopeService.queryOperatingScopeById(dto.getParentId());
        scope.setLevel(parent != null ? parent.getLevel() + 1 : 1);
    }
    scope.setName(dto.getName());                       // 同名字段 × 5 手写
    scope.setRemark(dto.getRemark());
    scope.setBusinessScopeDescription(dto.getBusinessScopeDescription());
    scope.setSort(dto.getSort());
    scope.setIndustryCategory(dto.getIndustryCategory());
    boolean ok = operatingScopeService.addOperatingScope(scope);
    if (!ok) {
        throw new BusinessException("新增经营范围失败，请稍后重试");
    }
    return true;
}

@Override
public Boolean updateOperatingScope(OperatingScopeSaveDTO dto) {
    if (dto.getId() == null) {
        throw new BusinessException("更新经营范围失败：经营类型ID不能为空");
    }
    OperatingScope scope = new OperatingScope();
    scope.setId(dto.getId());                          // 同名字段 × 6 手写
    scope.setName(dto.getName());
    scope.setRemark(dto.getRemark());
    scope.setBusinessScopeDescription(dto.getBusinessScopeDescription());
    scope.setSort(dto.getSort());
    scope.setIndustryCategory(dto.getIndustryCategory());
    return operatingScopeService.updateOperatingScope(scope);
}
```

#### 判定流程（现在加在 §9 + §15.4）

1. 数同名字段：6 个（`id` / `name` / `remark` / `businessScopeDescription` / `sort` / `industryCategory`）→ ≥ 3，必须 BeanCopy
2. 例外字段是否在源 DTO 里同时存在？
   - `level` **在 DTO 和 PO 里都有**（DTO 里定义了但前端不应传）→ **`copyIgnore("level")` 排除**
   - `parentId` 在两边都有但是**语义不同**（DTO=null 表“顶级”，PO=0 表“顶级”）→ 手写 setX 覆写
3. 选择 `copyIgnore` 路径：例例字段不能信，后端重算或赋默认

#### 优化后代码

```java
@Override
public Boolean addOperatingScope(OperatingScopeSaveDTO dto) {
    // copyIgnore("level")：DTO.level 不能信，后端根据 parent 重新计算
    OperatingScope scope = BeanCopyUtils.copyIgnore(dto, OperatingScope::new, "level");
    scope.setParentId(dto.getParentId() == null ? 0L : dto.getParentId());
    if (dto.getParentId() == null) {
        scope.setLevel(1);
    } else {
        OperatingScopeVO parent = operatingScopeService.queryOperatingScopeById(dto.getParentId());
        scope.setLevel(parent != null ? parent.getLevel() + 1 : 1);
    }
    boolean ok = operatingScopeService.addOperatingScope(scope);
    if (!ok) {
        throw new BusinessException("新增经营范围失败，请稍后重试");
    }
    return true;
}

@Override
public Boolean updateOperatingScope(OperatingScopeSaveDTO dto) {
    if (dto.getId() == null) {
        throw new BusinessException("更新经营范围失败：经营类型ID不能为空");
    }
    // DTO 无需排除的例外字段，直接 copy
    OperatingScope scope = BeanCopyUtils.copy(dto, OperatingScope::new);
    return operatingScopeService.updateOperatingScope(scope);
}
```

#### 三类场景决策表

| 场景 | copy | copyIgnore | 手写 setX |
|---|---|---|---|
| **纯同名**（无例外字段）| ✅ | — | — |
| **例外字段仅目标对象有**（如外键）| ✅ + 手写补例外字段 | — | — |
| **例外字段源/目标都有**（如脏数据源 DTO.level）| — | ✅ 排除例外字段 | 手写补例外字段 |
| **同名字段 ≤ 2** | — | — | ✅ 全部手写即可 |

#### 漏判的反模式（五个“看到例外就退出 copy”）

1. **「有派生字段 → 全手写」**——没回头数非派生同名字段
2. **「拷贝后覆盖」**代替 copyIgnore——可读性差 + 隐藏脏数据灬写
3. **「DTO.id 边为空 → 退出 copy」**——BeanCopy 会复制 null，MyBatis-Plus 插入时 id 为 null 自动走 IdType.AUTO，这不是问题
4. **「DTO 含业务字段 → 不信任何字段」**——DTO 含全部 6 个同名字段是常态，只有少量例外字段才需排除
5. **「字段名略不同 → 不敢用 BeanCopy」**——已补充字段名错位场景的解决方案（§15.4）

#### 关联规则

- SKILL.md §9（同名 BeanCopyUtils 规则）——措辞已强化为“混合场景首选 copyIgnore”
- `references/architecture-layers.md` §15.4——补充「例外字段在源对象里」子节 + 判定流程
- `references/code-review-checklist.md` §2 + §3——加了 BeanCopyUtils 检查项

---

## 补充：oboJava 自我迭代规则（V20260914 meta-check）

本 session 连续出现 3 次“oboJava 漏了 X → 修 → 再漏”循环（Component 日志 / PageResult 链路 / BeanCopyUtils copyIgnore）。为防重复发生，以后 oboJava **每次代码改动后必须自动检查 3 件事**：

1. **这个改法是不是某条 §X 的实例化？是的话 §X 措辞、worked example、检查项是不是都要补？**
2. **这个改法是不是 §X 未覆盖的新变体？是的话 §X 需不需要拆分出子节或加新案例？**
3. **`code-review-checklist.md` 是不是要加一条检查项？**——评审清单是防漏最后一道闸。

**默认动作**：新发现必须沉淀到 skill 源（SKILL.md / architecture-layers.md / code-review-checklist.md）。不再以“可选追加”处理。

