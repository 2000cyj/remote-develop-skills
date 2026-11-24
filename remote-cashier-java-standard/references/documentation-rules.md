# documentation-rules — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

## 代码规范

> 完整规则在 `references/code-structure.md` 与 `references/coding-quality.md`。本节是最关键的 8 条速查。

### 0. 接口（interface）注释规范

interface 内的方法、常量、字段变量**必须带有 Javadoc 注释**，不允许只写签名不写注释。注释要写清**业务语义**（做什么、为什么、入参/出参约束），不能用空壳 `/** xxx */` 蒙混过关。

**适用范围**：本规范覆盖 `bi-cashier-api`、`bi-cashier-component`、`bi-cashier-service`、`bi-cashier-web` 内所有 Java interface，包括但不限于：

- Service 接口（`IXxxManageService` / `IXxxService`）
- Feign Client 接口（`*Client.java`，位于 `bi-cashier-api`）
- DTO/VO 字段、`enum` 常量
- 自定义 SPI / 回调接口

**强制要求**：

| 元素 | 必须带注释 | 注释要求 |
|------|----------|---------|
| interface 方法（含 default / static） | ✅ | 业务语义 + 入参约束 + 返回值含义 + 异常场景；若有 Feign 语义需注明调用方、超时、重试策略 |
| interface 常量（`String XXX = "..."` / 枚举值） | ✅ | 含义、合法取值、引用方 |
| interface 字段变量（极少使用，必须配 Javadoc） | ✅ | 含义、单位、合法范围 |
| interface 自身 | ✅ | 接口目的、归属模块、典型实现或调用方 |

**正例**：

```java
/**
 * 银行卡管理服务：聚合银行卡主档与关联附件的增删改查。
 *
 * @author cashier-team
 * @since 2024-01-01
 */
public interface IBankCardManageService {

    /**
     * 新增银行卡主档并级联写入文件到期记录与标签库。
     *
     * @param req 新增请求（含主档字段 + 附件 ID 列表 + 标签名列表），主档字段非空
     * @return 新增成功后的业务唯一流水号 uniqueValue
     * @throws BusinessException 当银行账号重复或附件缺失时抛出
     */
    String addBankCard(AddBankCardDTO req);

    /**
     * 银行账号字段名前缀：DB 列 `bank_account_no` 在 DTO 中的驼峰名。
     */
    String BANK_ACCOUNT_NO_FIELD = "bankAccountNo";
}
```

**反例（禁止）**：

```java
// ❌ 方法无注释
String addBankCard(AddBankCardDTO req);

// ❌ 常量无注释
String BANK_ACCOUNT_NO_FIELD = "bankAccountNo";

// ❌ 空壳 Javadoc
/** 新增银行卡 */
String addBankCard(AddBankCardDTO req);
```

> 历史存量代码可豁免，但新代码、改动行（包含新增 / 修改的方法、常量）必须遵守本节。

### 0.1 实现类（`Impl`）`@Override` 方法禁止加方法 Javadoc（V20260916 新增）

> 来源：`StoreAuditOnboardingApplicationServiceImpl` / `CompanyServiceImpl` / `StoreServiceImpl` 3 个 Impl 类重构（2026-09-16）。原文件 21 个 `@Override` 方法上写了 `/** {@inheritDoc} */` 或自带 Javadoc，属于冗余——接口已经写完整 Javadoc，Impl 重复写一遍不增加任何信息，反而带来隐患。

#### 协议

| 位置 | 是否加 Javadoc | 说什么 |
|------|--------------|------|
| 接口方法（`IXxxService.java` / `IXxxManageService.java` 内） | **必须**加 | 业务语义 + 入参/出参约束 + 异常场景（参见 §0） |
| 实现类 `@Override` 方法（`XxxServiceImpl.java` 内） | **禁止加** | 在 `@Override` 上一行不允许出现 `/** ... */` |
| 实现类自定义 helper 方法（`private` / `static`） | **必须加** | 业务规则、why（helper 是闭包的、只在这调用，Javadoc 看不见 Implementation 上下文说明 + 固化本类业务要求） |

#### 反面案例（21 处全部已修正）

```java
// ❌ 场景 1：`{@inheritDoc}` 占位符反模式
/**
 * {@inheritDoc}
 */
@Override
public String generateUniqueValue() {
    String date = LocalDate.now().format(DATE_FORMATTER);
    return UNIQUE_VALUE_PREFIX + IDUtils.getId(date, UNIQUE_VALUE_TYPE);
}

// ❌ 场景 2：`{@inheritDoc}` + 附加“实现说明”同样是违规（不是 Javadoc 多写就有信息量）
/**
 * {@inheritDoc}
 *
 * <p>实现要点：CAS 比较列 + 一次性 set 全部新字段 + 版本号自增 SQL；
 * 没有事务注解——单条 UPDATE 不需要事务；如调用方在同一事务内调用，
 * 由聚合层通过 {@code @Transactional(rollbackFor = Exception.class)} 包裹。</p>
 */
@Override
public int casAdvanceStatus(StoreAuditOnboardingAdvanceStatusDTO req) {
    ...
}

// ❌ 场景 4：即使声称“补充语义信息”，也走 “{@inheritDoc}” 表达习惯的就是冗余
/**
 * {@inheritDoc}
 *
 * <p>本表已有软删除字段 {@code deleted}，但调用方（仅"草稿状态"才允许删除）决定走
 * 物理删除以彻底级联清理子表，理由见 {@code StoreAuditOnboardingManageServiceImpl#delete}。</p>
 */
@Override
public int deleteByUniqueValue(String uniqueValue) {
    ...
}
```

#### 正面做法

```java
// ✅ 实现类 @Override 方法：裸签名，无任何方法 Javadoc
@Override
public String generateUniqueValue() {
    String date = LocalDate.now().format(DATE_FORMATTER);
    return UNIQUE_VALUE_PREFIX + IDUtils.getId(date, UNIQUE_VALUE_TYPE);
}

@Override
public int casAdvanceStatus(StoreAuditOnboardingAdvanceStatusDTO req) {
    ...
}

// ✅ 自定义 helper：保留 Javadoc 说明业务规则（与 @Override 方法的"裸签名"明确区分）
/**
 * V2.0.1：审核员通过时把已分配主体写入 onboarding_store 子表。
 *
 * <p>子表行已由 {@link #create(StoreAuditOnboardingCreateDTO)} /
 * {@link #update(String, StoreAuditOnboardingUpdateDTO)} 在草稿/驳回态插入（{@code company_id} 等为 NULL）。
 * 本方法按 rowNo 升序取出子表行，把传入的主体条目依次写入到前 N 行，
 * 触发「已分配主体」列表列 formatter 与详情页「店铺资料」Card 渲染。</p>
 *
 * <p>{@code companyItems} 优先（审核员勾选队列时已携带公司名），缺失时 fallback 到
 * {@code companyIds}（仅 id，无 name 时留空字符串）。MOCK 模式 id 非数字时用
 * {@code String#hashCode} 取绝对值转 Long 入库；真实模式下 id 是数字字符串直接转。</p>
 */
private void writeAssignedCompaniesToSubTable(StoreAuditOnboardingWriteAssignedContext ctx) {
    ...
}
```

#### 为何不让实现类写 `@Override` 方法 Javadoc

1. **冗余无增量**：接口已写完整 Javadoc（业务语义、入参约束、返回值、异常），Impl 重复写一遍不增加任何信息
2. **维护负担**：接口改了 Javadoc，Impl 的 Javadoc 必须同步改——双倍维护成本
3. **`{@inheritDoc}` 是反模式**：IDE 自动生成的占位符，没有任何语义价值；读者点进 Impl 看不到任何实现细节说明
4. **隐藏"为什么"在 helper**：业务约束应该在 helper 方法里（因为 helper 是私有的、只在本类里被调用），而不是 public 接口（接口只承诺契约）
5. **“代替”型表达习惯：**现有代码习惯上写 `{@inheritDoc}` 是为了跨 interface × implementation 在 javadoc 上"显得一致"——但实现类里读者需要的不是与 interface 一样的描述，而是这个实现版本的**额外信息**（调用顺序、与 helper 的依赖、潜在限制等）。这些信息要么放在代码逻辑本身（`// 1. xxx`阶段化注释），要么写在私有 helper 的 Javadoc 里，**不**应该贴在 public `@Override` 方法头上。

#### 审查硬指标

```bash
# 1. 扫所有 Impl 文件 @Override 方法上方是否还有 /** ... */ 紧邻（违规）
grep -rEn "@Override" bi-cashier-{component,service}/src/main/java/com/obo/bi/cashier/**/impl/*.java \
  | while IFS=: read -r file line _; do
      # 查看 @Override 上面两行是否为 */ 或 /**
      if sed -n "$((line-1))p" "$file" | grep -qE "^\s*\*\*/\s*$"; then
        echo "$file:$line @Override 上方有 */ 紧邻（违规）"
      fi
      if sed -n "$((line-2))p" "$file" | grep -qE "^\s*/\*\*"; then
        echo "$file:$line @Override 上方有 /** 紧邻（违规）"
      fi
    done

# 2. 扫 {@inheritDoc} 残留（最常见的反模式）
grep -rn "{@inheritDoc}" bi-cashier-{component,service}/src/main/java/ --include="*.java"

# 3. 自定义 helper 必须有 Javadoc（配套必查项）
grep -nE "^    private\s+(static\s+)?[\w<>,\[\]?\s]+\s+\w+\s*\(" bi-cashier-{component,service}/src/main/java/com/obo/bi/cashier/**/impl/*.java \
  | while IFS=: read -r file line match; do
      # 检查上方是否紧邻 Javadoc（*/ 在 line-1 或 /** 在 line-2）
      if ! sed -n "$((line-1))p" "$file" | grep -qE "^\s*\*\*/\s*$" && \
         ! sed -n "$((line-2))p" "$file" | grep -qE "^\s*/\*\*"; then
        echo "$file:$line private helper 无 Javadoc（违规）"
      fi
    done
```

#### 判定为违规

- `@Override` 方法上方紧邻 `/** ... */`（`*/` 与 `@Override` 之间 ≤ 2 行且中间无其他代码） → 违规
- `@Override` 方法上方出现 `{@inheritDoc}`（无论是否有附加说明） → 违规
- private helper 方法无 Javadoc → 违规（与本规则配套）

#### 例外

类级别 Javadoc（类名上方）保留——类 Javadoc 描述整个类的职责，不属于"方法头注释"。

### 0.2 Controller public 方法不加方法 Javadoc（V20261009 新增）

> 来源：`StoreAuditOffboardingController` 重构（2026-10-09）。原文件 14 个 public 方法上方都写了一行 `/** 中文描述 */`，与同行的 `@ApiOperation("中文描述")` 完全重复，属冗余维护。

#### 协议

| 位置 | 是否加 Javadoc | 说什么 |
|------|--------------|------|
| Controller public 方法（`XxxController.java` 内） | **禁止加** | 裸签名 + `@ApiOperation` 描述中文业务语义，**双层注释是冗余** |
| Controller 私 helper（`private` / `static`） | **必须加** | 与 §0.1「实现类 helper」一致——helper 是闭包的、只在本类调，Javadoc 固化业务要求 |
| Controller 类级别 | **必须加** | 整个 Controller 职责（与 §0 interface 类级别规则一致）|

#### 反面案例（14 处之一，全部已修正）

```java
// ❌ Controller public 方法上方冗余 Javadoc
/**
 * 分页查询注销申请列表。
 */
@ApiOperation("分页查询注销申请列表")
@RequestMapping("/page")
public Result<PageResult<StoreAuditOffboardingListItemVO>> page(@RequestBody @Validated StoreAuditOffboardingPageDTO dto) {
    return Result.success(offboardingManageService.page(dto));
}
```

#### 正面做法（修复后）

```java
// ✅ Controller public 方法：裸签名 + @ApiOperation，无方法 Javadoc
@ApiOperation("分页查询注销申请列表")
@RequestMapping("/page")
public Result<PageResult<StoreAuditOffboardingListItemVO>> page(@RequestBody @Validated StoreAuditOffboardingPageDTO dto) {
    return Result.success(offboardingManageService.page(dto));
}
```

#### 为何不让 Controller public 方法写 Javadoc

1. **冗余无增量**：紧邻的 `@ApiOperation("中文")` 已经是中文业务语义描述，再写 `/** 中文 */` 完全是同样信息复制一遍
2. **维护双倍成本**：改业务语义时要同步改两处（Javadoc + @ApiOperation），但这两个字段没有 `IDE` 跳转关联（一个是方法头注释，一个是 Swagger 注解），改了一边忘了另一边经常发生
3. **Controller 是 1 行转发层**：按 §7「Controller 禁止编写业务逻辑」，Controller 方法体只有 `return Result.success(offboardingManageService.xxx(dto))` 一行——**没有业务逻辑可描述**，Javadoc 即使写也是抄方法名（如 `/** 分页查询 */` 配 `page()`），是纯空壳注释
4. **业务语义源头在 ManageService 接口**：真实业务语义、入参/出参约束、异常场景应在 `IXxxManageService` 接口 Javadoc（§0）里写。Controller 只是 URL→DTO 路由+转发的薄壳，**不**承载业务语义
5. **@ApiOperation 已经是 Controller 的「接口契约」**：Swagger 注解生成 API 文档（前端、测试、联调 都看这里），天然是 Controller 层的「业务语义输出」，与 @RestController 语义一致

#### 与 §0 / §0.1 的关系

| 位置 | 规则 | 出处 |
|------|------|------|
| interface 方法 | **必须**加 Javadoc | §0 |
| Impl `@Override` 方法 | **禁止**加 Javadoc | §0.1（V20260916）|
| Controller public 方法 | **禁止**加 Javadoc | §0.2（本节，V20261009）|
| 私 helper（Impl / Controller 内） | **必须**加 Javadoc | §0.1 + 本节 |
| 类级别 Javadoc | **必须**加 | §0 |

#### 审查硬指标

```bash
# 1. 扫所有 Controller public 方法上方是否还有 /** ... */ 紧邻（违规）
grep -rEn "@RequestMapping\|@PostMapping\|@GetMapping\|@PutMapping\|@DeleteMapping" \
  bi-cashier-web/src/main/java/com/obo/bi/cashier/**/controller/*.java \
  | while IFS=: read -r file line _; do
      # @RequestMapping 上一行是 */，或上上一行是 /**（无其他代码）→ 违规
      if sed -n "$((line-1))p" "$file" | grep -qE "^\s*\*\*/\s*$"; then
        # 排除类级别 Javadoc：上一个 @RequestMapping/@RestController 之前是不是类级 /** ?
        if ! sed -n "$((line-2))p" "$file" | grep -qE "^\s*public\s+class\s+"; then
          echo "$file:$line public 方法上方有 Javadoc 结束符（违规）"
        fi
      fi
      if sed -n "$((line-2))p" "$file" | grep -qE "^\s*/\*\*"; then
        if ! sed -n "$((line-3))p" "$file" | grep -qE "^\s*public\s+class\s+"; then
          echo "$file:$line public 方法上方有 Javadoc 起始符（违规）"
        fi
      fi
    done

# 2. 配套检查：Controller 私 helper 必须有 Javadoc
grep -nE "^    private\s+(static\s+)?[\w<>,\[\]?\s]+\s+\w+\s*\(" \
  bi-cashier-web/src/main/java/com/obo/bi/cashier/**/controller/*.java \
  | while IFS=: read -r file line match; do
      if ! sed -n "$((line-1))p" "$file" | grep -qE "^\s*\*\*/\s*$" && \
         ! sed -n "$((line-2))p" "$file" | grep -qE "^\s*/\*\*"; then
        echo "$file:$line Controller private helper 无 Javadoc（违规）"
      fi
    done
```

#### 判定为违规

- Controller public 方法上方紧邻 `/** ... */`（`*/` 与方法签名之间 ≤ 2 行且中间无其他代码） → 违规
- 即使是 1 行 `/** 一句话 */`（如 `/** 分页查询。 */`）也是违规——`@ApiOperation` 已表达

#### 例外

1. **类级别 Javadoc 保留**——类 Javadoc 描述整个 Controller 职责（与 §0 一致）
2. **有实际业务约束的方法**（如带 `if-throw` 的硬拒绝逻辑）→ 不用 Javadoc，**用 `//` 阶段化注释**（按 §6）——Controller 通常不该有业务逻辑，例外场景下用普通行注释而非 Javadoc
3. **Controller 私 helper**（私有方法做 DTO→DTO 转换、字段映射）→ 必须有 Javadoc（与 §0.1 helper 规则一致）

### 0.3 Controller 返回值规范：无返回值的写接口必须 `Result.success(Boolean.TRUE)`，禁止裸 `Result.success()`（V20261010 新增）

**协议**：

- 删除 / 提交 / 审核 / 启停 / 状态变更 / 触发一次副作用后无业务载荷的写接口 → 返回类型 `Result<Boolean>`，方法体末尾 **必须** `return Result.success(Boolean.TRUE);`
- **禁止** `return Result.success();`（即 `Result<Void>` / 裸 `Result`），即使后端 Service 不返回数据

#### 反面案例

```java
// ❌ 删/改/状态变更写接口返回 Void / 裸 Result
@ApiOperation("删除平台手机号")
@PostMapping("/deleteStoreEntryPlatformPhone")
public Result<Void> deleteStoreEntryPlatformPhone(@RequestParam("phone") String phone) {
    manageService.deleteStoreEntryPlatformPhone(phone);
    return Result.success();            // data = null → 前端 if (ok) 进不去
}
```

#### 正面做法

```java
// ✅ 统一 Result<Boolean> + Result.success(Boolean.TRUE)
@ApiOperation("删除平台手机号")
@PostMapping("/deleteStoreEntryPlatformPhone")
public Result<Boolean> deleteStoreEntryPlatformPhone(@RequestParam("phone") String phone) {
    manageService.deleteStoreEntryPlatformPhone(phone);
    return Result.success(Boolean.TRUE);
}
```

#### 为何强制 `Boolean.TRUE`

1. **前端 `requestData<boolean>` 业务约定**。HTTP 层在 `code !== 0` 时已经 `reject`+`ElMessage`，剩下 resolve 出来的就是写入成功的载荷。前端默认写法：

   ```ts
   const ok = await deleteXxxApi(...)
   if (ok) {                                // ✅ Boolean.TRUE → 进得去
     ElMessage.success("删除成功")
     void getList()                         // 列表页必须刷新
   }
   ```

   后端返回 `data: null` 时 `if (ok)` 永远 falsy → 列表不刷新、提示不弹 → 误以为操作失败。

2. **项目惯例**：所有「按业务键软删 / 状态变更 / 写后无载荷」接口都返回 `Result<Boolean>` 并 `Result.success(Boolean.TRUE)`（参见 `StoreEntryPlatformController.deleteStoreEntryPlatform` / `BankCardController.deleteBankCard` / `CompanyController.deleteCompany` / `SealController.deleteSeal`）。

#### 适用范围

| 场景 | 返回类型 | 写入 |
|---|---|---|
| 按业务键软删 / 硬删（无后续业务对象返回）| `Result<Boolean>` | `Result.success(Boolean.TRUE)` |
| 启停 / 启用 / 禁用 / 状态机迁移 | `Result<Boolean>` | `Result.success(Boolean.TRUE)` |
| 提交 / 审核 / 撤回前 | `Result<Boolean>` | `Result.success(Boolean.TRUE)` |
| 触发定时器 / 触发通知 / 触发 MQ 等副作用 | `Result<Boolean>` | `Result.success(Boolean.TRUE)` |
| 详情 / 分页 / 拿业务对象 | `Result<XxxVO>` / `Result<PageResult<XxxVO>>` | `Result.success(vo)` / `Result.success(pageResult)` |
| 校验存在性（`isXxxExists`）| `Result<Boolean>` | `Result.success(exists)`（**注意**：这里是真实布尔，**不是** `Boolean.TRUE`）|

#### 审查硬指标（提交前必跑）

```bash
# Controller 层裸 Result.success() / Result<Void>（除校验真误的 / 拿业务对象的外）
grep -rEn "return Result\.success\(\);|public Result<Void>"   bi-cashier-web/src/main/java/com/obo/bi/cashier/controller/   | grep -vE "isXxxExists|existsIn"
# 预期：0 命中
```

**例外**：

1. **校验类接口**（`isXxxExists` / `existsIn` / `checkXxx` 等）：返回真实布尔 `Result.success(boolean exists)`，**不**写死 `Boolean.TRUE`。
2. **返回业务对象**的接口（`Result<XxxVO>` / `Result<PageResult<XxxVO>>`）：走常规解包，不需要 `Boolean.TRUE`。

### 0.4 Javadoc 必须与真实签名一致（V20261124 新增）

> 来源：`bi-cashier-service` 的 `StoreAuditOnboardingManageServiceImpl`（2026-11-24 规范整改）。
> DTO 化 / 删参 / 合并参之后注释没跟着改 → Javadoc 与代码说两套话，review 与排障都被误导。

#### 协议

| 场景 | 要求 |
|---|---|
| 改方法签名（≥3 参 DTO 化、删除形参、合并形参） | 同一个 commit 内同步 `@param`：删失效项、补新增项、语义变了就改描述 |
| `@param` 名称 | 必须与形参**逐字**一致（含大小写）；不得保留已删除的形参名 |
| 形参有、Javadoc 缺 `@param` | 补齐（helper 强制；存量代码在被改动行范围内一并补） |
| 一个方法上方出现**两个连续** `/** ... */` 块 | 只留描述该方法的那一块，另一块删除（多半是上一轮误加 / 遗留） |
| Javadoc 描述与方法实际行为不符 | 改描述（如「校验填表输入」挂在「整条是否全空」的方法上） |
| 描述里出现已删除的方法 / 能力 | 一并删掉（如已删方法留下的孤儿注释块） |

#### 审查硬指标（提交前必跑）

```bash
# 连续两个 Javadoc 块（疑似重复 / 孤儿注释）
grep -n -A2 -E "^\s*/\*\*$" Target.java | grep -B1 -E "^[0-9]+-\s*/\*\*$"
# 预期：0 命中
```

`@param` 与签名的一致性用脚本比对（node / python 均可），三类都要查：

- `stale`：Javadoc 有、形参已不在签名里（改签名后最常见的漏改）。
- `missing`：形参有、Javadoc 缺 `@param`。
- `orphan`：Javadoc 块后面紧跟另一个 Javadoc 块。

脚本要点：

1. 提取形参名要按**括号深度**扫描，不能用贪婪正则（如 `/\(([\s\S]*)\)/`）：泛型 `<Map<String, List<X>>>` 里的逗号会误切，跨行签名要拼行后再解析。
2. 只比对 `private/public/protected/static` 方法声明；字段 Javadoc、类 Javadoc 不参与。
3. 期望值：`stale=0 missing=0 orphan=0`。

#### 案例（StoreAuditOnboardingManageServiceImpl，2026-11-24）

- 3 处重复 Javadoc 块：`historySatisfiesScope` / `historyScopeSatisfied`（旧块仍写 `@param targetPlatforms / applyDepartment`，DTO 化后已失效）+ `resolveReturnNodeHandler` 上方遗留的「已删方法」孤儿块。
- 27 处 helper 缺 `@param`（validateDemandRows / isSubmittable / requireOnboardingVersion / alignStoreRowsByDemands / findTaskById / firstNonBlank …）。
- 2 处描述错位：`isSubAccountAllBlank`（写的是「校验填表输入」）、`findTaskById`（写的是「节点 10 完成后完成流程」）。
- 修复后扫描：`stale=0 missing=0 orphan=0`，并按 §22 跑真 Maven（`mvn -o -pl bi-cashier-service -am -DskipTests compile` → BUILD SUCCESS）。

