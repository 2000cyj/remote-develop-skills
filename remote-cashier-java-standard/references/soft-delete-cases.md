# soft-delete-cases — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

### 15. PO 继承 BaseEntity 时，deleted 字段由 `@TableLogic` 自动处理（V20260914 新增）

> 来源：`OperatingScopeServiceImpl` 重构（2026-09-14）。原文件 4 处 `.eq(OperatingScope::getDeleted, 0)` + 1 处 `if (scope.getDeleted() == 1)` 死代码，全部删除。BaseEntity 已配 `@TableLogic(value="0", delval="1")`，MP 自动追加 `WHERE deleted = 0` 与 `UPDATE ... SET deleted = 1`。

#### 反面案例（5 处冗余 / 死代码）

```java
// ❌ 1. lambdaQuery 显式 .eq(getDeleted, 0)
List<OperatingScope> list = this.lambdaQuery()
        .eq(OperatingScope::getDeleted, 0)            // 冗余：MP 自动加 WHERE deleted = 0
        .orderByAsc(OperatingScope::getLevel)
        .list();

// ❌ 2. selectById 后判 getDeleted==1
OperatingScope scope = baseMapper.selectById(id);
if (scope == null || scope.getDeleted() == 1) {       // 死代码：selectById 已自动过滤
    return null;
}

// ❌ 3. 业务键软删除手写 lambdaUpdate().set(getDeleted, 1)（必须走 remove）
this.lambdaUpdate()
        .set(OperatingScope::getDeleted, 1)
        .eq(OperatingScope::getUniqueValue, uniqueValue)
        .update();                                    // 走 remove 即可，MP 自动 .set(deleted, 1)

// ❌ 4. 主键软删除手写 lambdaUpdate（必须走 removeById / deleteById）
this.lambdaUpdate()
        .set(OperatingScope::getDeleted, 1)
        .eq(OperatingScope::getId, id)
        .update();                                    // 走 removeById 即可

// ❌ 5. deleteById 后跟 lambdaUpdate().set(getDeleted, 1)（重复声明）
baseMapper.deleteById(id);
this.lambdaUpdate().set(OperatingScope::getDeleted, 1)
        .eq(OperatingScope::getId, id).update();
```

#### @TableLogic 自动行为一览（重要：项目里**不存在**需要显式 `set(getDeleted, 1)` 的场景）

| MP 调用 | @TableLogic 自动行为 | 是否需额外写 `.set(getDeleted, 1)` |
|---|---|---|
| `baseMapper.selectById(id)` | 追加 `WHERE deleted = 0`，不返软删记录 | ❌ |
| `lambdaQuery().list() / .one() / .page()` | 同上 | ❌ |
| `baseMapper.selectList(wrapper)` | 同上 | ❌ |
| XML `<select>` | ❌ 不自动加，需手写 `WHERE deleted = 0` | — |
| **`baseMapper.deleteById(id)`** | **转 `UPDATE ... SET deleted = 1 WHERE id = ?`** | ❌ 一律走这条 |
| **`this.removeById(id)`** | 同上 | ❌ 一律走这条 |
| **`this.remove(wrapper)`（含业务键）** | **转 `UPDATE ... SET deleted = 1 WHERE <wrapper conditions>`** | ❌ 一律走这条 |
| `this.lambdaUpdate().eq(业务键).update()` | ❌ 这是普通 UPDATE，MP 不加 deleted 条件 | **❌ 一律禁止走 lambdaUpdate 软删** |
| XML `<update>` | ❌ 不自动加，需手写 `SET deleted = 1` | — |

#### ⚠️ MP Lambda vs XML 手动 SQL：两条规则**方向相反**，极容易误删（V20260915 红线）

上表 MP 调用和 XML 调用对 `deleted = 0` 的处理**完全相反**——MP 自动加（手写就是冗余），XML 不自动加（手写是必需）。下面这条提示仅作为警示加粗，避免 agent / 评审时一刀切删除全部 `deleted = 0`：

> **XML 手写 SQL 中的 `WHERE deleted = 0` 是必需的，不是死代码。** 只有 MP Lambda 链式调用（`lambdaQuery` / `lambdaUpdate` / `baseMapper.xxx`）自动加，XML `<select>` / `<update>` 不走 MP 拦截器，必须**保留手写条件**。

**误删后果**：XML 查询返回软删记录 → 前端拿到已删除数据；XML 删除变硬删 → 软删机制失效。

**审查硬指标**（提交前必跑）：

```bash
# 1. 扫 Mapper XML 里是否还有 WHERE deleted = 0（不应被删）
grep -rEn "WHERE deleted = 0" bi-cashier-web/src/main/resources/mapper/ --include="*.xml"
# 预期：所有有软删表的 XML 文件均命中

# 2. 扫 Component 层 Service 是否还残留冗余 .eq(getDeleted, 0)（应清空）
grep -rEn "\.eq\([A-Za-z]+::getDeleted,\s*0\)" bi-cashier-component/src/main/java/ --include="*.java"
# 预期：0 命中

# 3. 扫 Component 层 Service 是否还残留 lambdaUpdate().set(getDeleted, 1)（应清空）
grep -rEn "lambdaUpdate\(\)\s*$" bi-cashier-component/src/main/java/ -A 3 --include="*.java" \
  | grep -E "\.set\([^,]+::getDeleted,\s*1\)"
# 预期：0 命中

# 4. 扫 Manage 层 Service 是否直接写 .set(getDeleted, 1)（应清空）
grep -rEn "set\([A-Za-z]+::getDeleted,\s*1\)" bi-cashier-service/src/main/java/ --include="*.java"
# 预期：0 命中
```

**判定标准**：

| 文件类型 | `WHERE deleted = 0` | `.eq(getDeleted, 0)` | `.set(getDeleted, 1)` |
|---|---|---|---|
| Mapper XML `<select>` | **必须保留**（手写条件） | N/A | N/A |
| Mapper XML `<update>` 软删 | **必须保留 `SET deleted = 1`**（手写条件） | N/A | N/A |
| Component Service Lambda | **禁止写**（MP 自动加） | **禁止写** | **禁止写**，一律 `delete*` / `remove*` |
| Component Service `baseMapper.deleteById(id)` | N/A | N/A | MP 自动转，**禁止手写** |
| Manage Service | N/A | **禁止**（应当调 Component 软删） | **禁止** |
| SQL 归档脚本 / 手动执行 | 按业务决定（推荐保留） | N/A | N/A |

#### 正确做法（OperatingScopeServiceImpl 修复后）

```java
@Override
public List<OperatingScope> queryOperatingScopeTree() {
    // 无 .eq(getDeleted, 0)——MP 自动加
    List<OperatingScope> list = this.lambdaQuery()
            .orderByAsc(OperatingScope::getLevel)
            .orderByAsc(OperatingScope::getSort)
            .orderByDesc(OperatingScope::getId)
            .list();
    return list == null ? Collections.emptyList() : list;
}

@Override
public OperatingScopePageVO queryOperatingScopeById(Long id) {
    // 无 .getDeleted() == 1 判断——selectById 已自动过滤
    OperatingScope scope = baseMapper.selectById(id);
    if (scope == null) {
        log.debug("经营范围详情查询未命中 id={}", id);
        return null;
    }
    OperatingScopePageVO vo = new OperatingScopePageVO();
    BeanUtils.copyProperties(scope, vo);
    return vo;
}

@Override
public Boolean deleteOperatingScope(Long id) {
    // deleteById 已被 MP 自动转 UPDATE ... SET deleted = 1
    boolean ok = baseMapper.deleteById(id) > 0;
    if (!ok) {
        log.warn("经营范围删除未生效 id={}", id);
    }
    return ok;
}
```

#### 业务键软删除一律走 `remove`（项目规范）

**禁止** `lambdaUpdate().set(Xxx::getDeleted, 1).eq(业务键).update()` 模式。项目里任何软删除都走 `delete*` / `remove*`，MP 自动加 `.set(deleted, 1)`。

```java
// ✅ 按业务键软删除
return this.remove(
        this.lambdaQuery().eq(Xxx::getUniqueValue, uniqueValue)
);

// ✅ 多条件软删除
return this.remove(
        this.lambdaQuery()
                .eq(Xxx::getAccountNumber, accountNumber)
                .eq(Xxx::getBankCode, bankCode)
);

#### ⚠️ MP 3.5.3+ 已知 bug：`IService.remove(Wrapper)` 会触发 OGNL 异常（V20261010 新增例外）

**问题**：`this.remove(this.lambdaQuery().eq(业务键, ...))` 抛：

```
org.mybatis.spring.MyBatisSystemException: nested exception is
org.apache.ibatis.builder.BuilderException: Error evaluating expression
'ew.sqlSegment != null and ew.sqlSegment != ''''
Cause: org.apache.ibatis.ognl.OgnlException: sqlSegment
Cause: com.baomidou.mybatisplus.core.exceptions.MybatisPlusException:
can not use this method for "getSqlSegment"
```

**根因**：MP 3.5.3+ 把 `AbstractChainWrapper.getSqlSegment()` 锁死（OGNL / 外部都禁止调）。`IService.remove(Wrapper)` 内部生成的 update SQL 模板里有：

```xml
<bind name="_ew_BC" value="ew.sqlSegment != null and ew.sqlSegment != ''" />
```

这个 `<bind>` 走 OGNL 触发 `getSqlSegment()` → 抛 `can not use this method for "getSqlSegment"`。**关键**：异常路径**只**经 `IService.remove(Wrapper)`，**不**经 `BaseMapper.delete(Wrapper)`（后者 XML 是简单 `<delete>`，没有 `<bind>`，不触发 OGNL）。

**修复**：从 `this.remove(wrapper)` 改走 `baseMapper.delete(wrapper)`。这是项目惯例「禁止 `new LambdaQueryWrapper<>`」规则的**唯一**合法破例场景。

```java
// ❌ 报错（MP 3.5.3+ 上 IService.remove 内部模板带 <bind> 触发 OGNL）
return this.remove(this.lambdaQuery().eq(StoreEntryPlatform::getPlatformCode, code));

// ✅ 绕开 IService.remove 内部模板，直接走 BaseMapper.delete(Wrapper) 的简单 XML
return baseMapper.delete(
        new LambdaQueryWrapper<StoreEntryPlatform>()
                .eq(StoreEntryPlatform::getPlatformCode, code)
) > 0;
```

**判定要点**（提交前必查）：

| 调用方式 | MP 3.5.3 行为 |
|---|---|
| `this.remove(this.lambdaQuery().eq(业务键))` | ❌ 抛 OGNL 异常 |
| `this.removeById(id)` | ✅ 走 `BaseMapper.deleteById`，**不**触发 |
| `baseMapper.deleteById(id)` | ✅ 同上 |
| `baseMapper.delete(new LambdaQueryWrapper<>().eq(业务键))` | ✅ 走 `BaseMapper.delete(Wrapper)` 简单 `<delete>` |
| `this.remove(new QueryWrapper<>().eq(业务键))` | ❌ 同 `this.remove(lambdaQuery)`，一样报错 |

**前提**：业务唯一键上没有 NULL 字段约束、唯一索引（库表唯一索引由 `BaseMapper.delete` 透传到 SQL，与 wrapper 行为等价）。

**为什么 `new LambdaQueryWrapper<>()` 这里允许**：常规场景下 `this.lambdaQuery()` 链式更安全（无需 import 类型）；但 `this.remove()` 不能传链式 wrapper，必须构造一个独立 wrapper 实例传给 `baseMapper.delete()`。本例外仅限此场景。
```

#### 类 extends ServiceImpl 写法规范

```java
// ❌ 全限定类名写在 extends 后（拼写错误多、IDE 跳转失效）
public class OperatingScopeServiceImpl
        extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService { ... }

// ✅ 必须 import ServiceImpl，extends 用短名
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;

public class OperatingScopeServiceImpl
        extends ServiceImpl<OperatingScopeMapper, OperatingScope>
        implements IOperatingScopeService { ... }
```

**例外**：与本模块某个业务类同名（如自定义 `XxxServiceImpl` 在 `com.obo.bi.cashier.service.impl` 内已有同名类，**完全限定名**避免歧义）。其它场景一律 import。

#### 判定为反模式的 5 个特征

1. **`lambdaQuery().list() / .one()` 后多余 `.eq(getDeleted, 0)`**——MP 自动加，重复声明
2. **`selectById(...)` 后多余 `if (po.getDeleted() == 1)`**——selectById 已过滤软删，分支永远不进
3. **任何 `lambdaUpdate().set(Xxx::getDeleted, 1).update()`**（主键/业务键/多条件都不行）——一律走 `remove*` / `delete*`
4. **`deleteById(...)` 后跟 `lambdaUpdate().set(getDeleted, 1)`**——MP 自动转软删，重复声明
5. **`extends com.baomidou.mybatisplus.extension.service.impl.ServiceImpl` 全限定名**——必须 import 后用短名

#### 审查硬指标

```bash
# 1) 扫"lambdaQuery 显式 .eq(getDeleted, 0)"
grep -rEn "::getDeleted\s*,\s*0\)" bi-cashier-{component,service}/src/main/java/

# 2) 扫"selectById 后多余判 getDeleted==1"
grep -rEn "\.getDeleted\(\)\s*==\s*1" bi-cashier-{component,service}/src/main/java/

# 3) 扫"任何 lambdaUpdate().set(getDeleted, 1) 反例（一律禁止）"
grep -rEnA1 "lambdaUpdate\(\)" bi-cashier-{component,service}/src/main/java/ \
  | grep -E "set\(.*::getDeleted\s*,\s*1\)"

# 4) 扫"extends 全限定 ServiceImpl"
grep -rEn "extends\s+com\.baomidou\.mybatisplus\.extension\.service\.impl\.ServiceImpl" \
  bi-cashier-{component,service}/src/main/java/
```

#### 关联规则

- SKILL.md §10（Component 层日志）— 本案例是该规则与 MP 自动行为交叉后的修订版
- `references/data-model-sql.md §1.2` 软删除约定 — 已同步改为「全部走 delete* / remove*，MP 自动 .set(deleted, 1)」
- `references/mybatis-vs-xml.md §2.1` 新增章节 — 列出 5 类反例与扫描命令
- `references/architecture-layers.md §3.3 + §4` — 删 `.eq(getDeleted, 0)`，改 `extends` 为 import
- `references/code-structure.md §9.3` — 重写为 remove 模式
- `references/code-review-checklist.md §3` — Component Service 评审新增检查项


