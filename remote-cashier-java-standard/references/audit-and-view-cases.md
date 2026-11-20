# audit-and-view-cases — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

### 15.1 PO 继承 BaseEntity 时，createTime / updateTime / createUser / updateUser 由 `@TableField(fill=...)` + `MyMetaObjectHandler` 自动填充（V20261009 新增）

> 来源：店铺注销 V2.0.2 重构，扫 53 个 bi-cashier 后端文件发现 15 处 `setCreateTime` / `setUpdateTime` / `setCreateUser` / `setUpdateUser` 手动调用，全是冗余且有多源不一致风险。

#### 机制

`com.obo.core.common.model.BaseEntity` 在 4 个审计字段上都加了 `@TableField(fill = ...)`：

| 字段 | 注解 | 自动时机 |
|------|------|----------|
| `createTime` | `FieldFill.INSERT` | 插入时 |
| `createUser` | `FieldFill.INSERT` | 插入时 |
| `updateTime` | `FieldFill.INSERT_UPDATE` | 插入 + 更新时 |
| `updateUser` | `FieldFill.INSERT_UPDATE` | 插入 + 更新时 |

`bi-cashier-web/.../MyMetaObjectHandler`（`@Component implements MetaObjectHandler`）已注册到 Spring 容器，MP 在 `baseMapper.insert / updateById / update` 调用时自动触发 `insertFill` / `updateFill`，从 `BaseContext.getUserName()` 取当前用户 + `LocalDateTime.now()` 取当前时间。

#### 反面案例（bi-cashier 实际代码 2026-10）

```java
// ❌ StoreAuditOffboardingApplicationServiceImpl.insertApplication
public int insertApplication(StoreAuditOffboardingApplication application) {
    if (application == null) return 0;
    LocalDateTime now = LocalDateTime.now();
    String operator = SecurityContextHolder.getUserName();   // ← 源 1
    if (application.getCreateTime() == null) application.setCreateTime(now);    // §15.1
    if (application.getUpdateTime() == null) application.setUpdateTime(now);    // §15.1
    if (application.getCreateUser() == null) application.setCreateUser(operator); // §15.1
    if (application.getUpdateUser() == null) application.setUpdateUser(operator); // §15.1
    if (application.getVersion() == null) application.setVersion(0);
    if (application.getDeleted() == null) application.setDeleted(0);
    return baseMapper.insert(application);
    // ↓ 此处 MyMetaObjectHandler.insertFill 再次写 createTime/createUser/updateTime/updateUser
    //   - 值同 → no-op
    //   - 值不同（SecurityContextHolder vs BaseContext 源不一致） → 静默覆盖手动值
}

// ❌ StoreAuditOffboardingStoreServiceImpl.batchUpdateOffboardingDate
record.setUpdateTime(LocalDateTime.now());   // §15.1
record.setUpdateUser(operatorId);            // §15.1
return baseMapper.update(record, ...);
// ↓ updateFill 再次写 updateTime/updateUser
```

#### 危害（不止冗余）

1. **冗余代码**：MyMetaObjectHandler 已填，set 是 4-5 行死代码
2. **多源不一致风险**：`SecurityContextHolder.getUserName()` vs `BaseContext.getUserName()` —— 多数场景一致，但跨线程 / Feign / 异步任务里不一定
3. **静默覆盖**：`MetaObjectHandler.setFieldValByName` 在新值与已存在值不同时**直接覆盖**手动值，坏数据**安静地**被覆盖
4. **测试不可见**：单测 mock 掉 baseMapper 不会跑 MyMetaObjectHandler，看不出 bug

#### 唯一允许手动 setXxx 的场景

| 场景 | 示例 | 说明 |
|------|------|------|
| 透传历史 createTime 到快照 PO | `snap.setCreateTime(vo.getCreateTime())` | 拷贝原值，不该被自动填覆盖 |
| 回填历史数据 | 脚本 / 迁移 | 显式指定时间和操作人 |
| 跨服务迁移 | 同步过来的记录保留原值 | 同步场景 |

#### INSERT 路径额外注意：DB DEFAULT + MP FieldStrategy 兜底（V20261009 补）

> 第 2 轮整改发现：原 §15.1 规则只覆盖 createTime/updateTime/createUser/updateUser（4 个 BaseEntity 审计字段），但**INSERT 路径**还有两类**同源冗余**：
>
> - `application.setDeleted(0)` —— `deleted` 在 BaseEntity 配 `@TableLogic(value="0", delval="1")`，但 @TableLogic **只影响 SELECT / DELETE，不影响 INSERT**。INSERT 时若 `deleted` 字段为 null，MP 默认 `FieldStrategy.NOT_NULL` 会**跳过该字段**不写进 SQL；DB 列有 `NOT NULL DEFAULT 0`，自动兜底。手动 `setDeleted(0)` 死代码。
> - `application.setVersion(0)` —— 同理。`version` 配 `@TableField("version")`（不是 `@Version`，与乐观锁注解无关），null 时 MP 跳过，DB `DEFAULT 0` 兜底。
>
> 错误兜底原因：开发者**误以为**这些字段在 INSERT 路径下也需要手动设默认，实际有 2 层兜底（MP 策略 + DB DEFAULT）。

```java
// ❌ 错误枖底（实测 2026-10 项目代码）
public int insertApplication(StoreAuditOffboardingApplication application) {
    if (application == null) return 0;
    // ↓ 以下 4 块全是冗余
    if (application.getCreateTime() == null) application.setCreateTime(now);    // §15.1
    if (application.getUpdateTime() == null) application.setUpdateTime(now);    // §15.1
    if (application.getCreateUser() == null) application.setCreateUser(...);   // §15.1
    if (application.getUpdateUser() == null) application.setUpdateUser(...);   // §15.1
    if (application.getVersion() == null) application.setVersion(0);            // §15.1 补
    if (application.getDeleted() == null) application.setDeleted(0);            // §15.1 补
    return baseMapper.insert(application);
}

// ✅ 正确：仅保留必要的业务字段
public int insertApplication(StoreAuditOffboardingApplication application) {
    if (application == null) return 0;
    // version / deleted 由 DB DEFAULT 0 + MP FieldStrategy.NOT_NULL 兜底
    // createTime/createUser/updateTime/updateUser 由 MyMetaObjectHandler 自动填
    return baseMapper.insert(application);
}
```

**INSERT 路径仍允许手动 setXxx 的场景**：

| 场景 | 字段 | 原因 |
|------|------|------|
| 透传历史 createTime 到快照 | `createTime` | 同上 |
| 显式指定 version 初值非 0 | `version` | 业务需要从中间版本开始（如迁移数据） |
| 显式指定 deleted 初值非 0 | `deleted` | 极少见（逆向同步历史软删记录） |

#### 正确做法

```java
// ✅ 删掉 4 行 setXxx，直接 insert
public int insertApplication(StoreAuditOffboardingApplication application) {
    if (application == null) return 0;
    // 业务字段由调用方填
    // createTime / createUser / updateTime / updateUser 由 MyMetaObjectHandler 自动填
    if (application.getVersion() == null) application.setVersion(0);
    if (application.getDeleted() == null) application.setDeleted(0);
    return baseMapper.insert(application);
}

// ✅ 删掉 2 行 setXxx，直接 update
public int updateApplicationById(StoreAuditOffboardingApplication application) {
    if (application == null || application.getId() == null) return 0;
    // updateTime / updateUser 由 MyMetaObjectHandler 自动填
    return baseMapper.updateById(application);
}
```

#### 审查硬指标

```bash
# 1) 扫 Component / Service Impl / Completion Impl 中手动 set BaseEntity 审计字段
grep -rEn "\.(setCreateTime|setUpdateTime|setCreateUser|setUpdateUser)\(" \
  bi-cashier-{component,service}/src/main/java/ --include="*.java"
# 预期：0 命中（除非带"// §15.1 例外：..."注释说明业务理由）

# 2) 扫 INSERT 路径手动 setDeleted(0) / setVersion(0)（第 2 轮补）
# 只在 insert / create / insertApplication / batchInsert 等方法体内才算违规
grep -rEn "\.(setDeleted|setVersion)\(\s*0\s*\)" \
  bi-cashier-{component,service}/src/main/java/ --include="*.java"
# 预期：0 命中（除非带 §15.1 例外注释）
```

**违规处置**：扫到 → 删所有 setXxx（createTime/updateTime/createUser/updateUser/deleted/version 6 字段）→ 留下 `return baseMapper.insert(entity)` 即可。

#### 关联规则

- `SKILL.md` §15 — `deleted` 由 `@TableLogic` 自动；本节是同思路扩展到 create/update 字段
- `references/code-review-checklist.md §3` — Component Service 评审加「禁止手动 setCreateTime/setUpdateTime/setCreateUser/setUpdateUser」检查项
- `references/architecture-layers.md §3.3` — 同
- `MyMetaObjectHandler.java` (`bi-cashier-web/.../config/interceptor/`) — 注册点，删了会导致全模块审计字段为 null


### 16. VO 按业务视图命名（Page / List / Detail 各自独立），不复用同类型（V20260914）

> 来源：`OperatingScopeServiceImpl.queryOperatingScopeById` 与 `OperatingScopeManageServiceImpl.listAllOperatingScope` 在上轮「OperatingScopeVO 重命名为 OperatingScopePageVO」后继续复用 `OperatingScopePageVO`，造成"分页 VO 被详情/列表场景借用"的语义错位（V20260914）。

#### 判定为反模式的 4 个特征

1. **类名后缀与返回场景语义不符**：方法名是 `queryXxxById` / `listAllXxx` 但返回 `XxxPageVO` — 读者看到类型签名就要在心里做一次"为什么 Page 的类名用在详情/列表上"的翻译，CodeGraph 跳转、`List<OperatingScopeVO>` 索引导航全部失效
2. **前端 Swagger 模型错位**：`@ApiModel("经营范围VO")` + 类名 `OperatingScopePageVO` 同时出现，前端 codegen 生成的 TS 类型名带 "Page" 后缀，但实际接口是详情/列表 — 类型名误导前端
3. **未来字段集漂移埋雷**：当前三个 VO 字段一致只是历史巧合；Detail 未来可能加 `parentName` / List 可能砍 `industryCategory` 时，复用同类型会让一处改动污染全部端点
4. **违反 `code-review-checklist.md §7` 命名约定**：清单明列 `XxxVO` / `XxxListVO` / `XxxDetailVO` / `XxxPageVO` 作为合法后缀，强制按视图选其一，不允许"通用 VO" 跨多端点复用

#### 反面案例（OperatingScope 上轮重构后状态）

```java
// Service 接口——三个方法共用一个 VO 类型
PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto);     // ✅ 语义正确
OperatingScopePageVO queryOperatingScopeById(Long id);                                // ❌ 详情借用了分页 VO
List<OperatingScopePageVO> listAllOperatingScope();                                   // ❌ 列表借用了分页 VO

// Controller——同样是 PageVO
public Result<PageResult<OperatingScopePageVO>> pageOperatingScope(...) { ... }
public Result<OperatingScopePageVO> queryOperatingScopeById(...) { ... }              // ❌
public Result<List<OperatingScopePageVO>> listAllOperatingScope() { ... }             // ❌
```

类 Javadoc 里写"虽然类名带 Page 后缀，但所有方法共用此类型"——本身就是反模式自白。

#### 正面做法（OperatingScope 修复后）

按 `code-review-checklist.md §7` 命名约定，每个业务视图独立 VO：

```java
// bi-cashier-api/vo/OperatingScopePageVO.java
@ApiModel("经营范围分页VO")
public class OperatingScopePageVO { ... }

// bi-cashier-api/vo/OperatingScopeListVO.java
@ApiModel("经营范围列表VO")
public class OperatingScopeListVO { ... }

// bi-cashier-api/vo/OperatingScopeDetailVO.java
@ApiModel("经营范围详情VO")
public class OperatingScopeDetailVO { ... }
```

调用链与类型一一对齐：

```java
// IOper / ServiceImpl
PageResult<OperatingScopePageVO> pageOperatingScope(OperatingScopePageDTO dto);
OperatingScopeDetailVO queryOperatingScopeById(Long id);
List<OperatingScope> listAllOperatingScope();                       // Component 层返 PO（§12 原则）

// IManage / ManageImpl
PageResult<OperatingScopePageVO> pageOperatingScope(...);
OperatingScopeDetailVO queryOperatingScopeById(...);
List<OperatingScopeListVO> listAllOperatingScope();                  // Manage 层 copyList 转 VO

// Controller
public Result<PageResult<OperatingScopePageVO>> pageOperatingScope(...) { ... }
public Result<OperatingScopeDetailVO> queryOperatingScopeById(...) { ... }
public Result<List<OperatingScopeListVO>> listAllOperatingScope() { ... }
```

#### 同款约定的项目内先例（参照组）

| 模块 | Page | List | Detail |
|---|---|---|---|
| Store | `StorePageVO` | `StoreListVO` | `StoreDetailVO` |
| BankCard | — | `BankCardListVO` | `BankCardVO` |
| FileExpiryRecord | — | `FileExpiryRecordListVO` | `FileExpiryRecordDetailVO` |
| FileExpiryRule | — | `FileExpiryRuleListVO` | `FileExpiryRuleVO`（基础）|
| Seal | — | `SealListVO` | `SealVO`（基础）|
| CashierRelatedUser | — | — | `CashierRelatedUserDetailVO` |
| Company | — | — | `CompanyDetailVO` |
| OperatingScope（本案例）| `OperatingScopePageVO` | `OperatingScopeListVO` | `OperatingScopeDetailVO` |

**反例模式**（一个 VO 跨场景复用）：项目内历史 `OperatingScopeVO` / `CashierRelatedUserVO` / `BankCardVO` / `FileExpiryRuleVO` 等"通用 VO"在多端点复用时也属本案例反模式范围；本案例仅先行整改 OperatingScope，其他模块是否需要拆分视业务发展而定（如 `BankCardVO` 是否需要分 `BankCardListVO` + `BankCardDetailVO`，按未来字段集漂移判断，不预先拆）。

#### 字段暂时一致的可行做法

未来 Detail 字段多于 List/Page 时（如 Detail 携带父节点详情、附件列表），三个 VO 字段集会自然分化；当前阶段字段一致**允许直接复制字段**（同 StorePageVO 与 StoreListVO 的处理），**不通过继承复用**（继承会让 Swagger codegen 生成"父类字段全在子类"的多余字段、且 BaseVO 修改会污染全部子类）。

```java
// ✅ 字段一致时直接复制（不抽 BaseVO 抽象）
// OperatingScopePageVO.java
private Long id;
private String name;
...

// OperatingScopeListVO.java
private Long id;
private String name;
...

// OperatingScopeDetailVO.java
private Long id;
private String name;
...

// ❌ 不要抽 BaseOperatingScopeVO（继承会让 Swagger codegen 在子类生成父类字段、且未来修改父类污染全部）
public abstract class BaseOperatingScopeVO {
    protected Long id;
    protected String name;
}
public class OperatingScopePageVO extends BaseOperatingScopeVO { ... }
```

#### 关联规则

- `code-review-checklist.md §7` 命名约定：`XxxDTO` / `XxxPageDTO` / `XxxSaveRequestDTO` / `XxxVO` / `XxxListVO` / `XxxDetailVO` / `XxxPageVO` — 本案例强化为「禁止跨场景复用同类型 VO」
- SKILL.md §12 — PO 不可泄漏，与本案例组合形成"PO → PageVO/ListVO/DetailVO"三方独立映射
- SKILL.md §0 接口注释规范 — VO 类自身应有 Javadoc 说明归属视图（哪个端点用、为什么不暴露 X 字段）


