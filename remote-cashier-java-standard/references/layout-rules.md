# layout-rules — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

### 1. 类文件布局（自上而下）

```
package ...
import com.obo.*     ┐
import 第三方        ├─ 三组 import（项目 → 第三方 → JDK），组内字典序
import JDK / javax   ┘
                    [空行]
/** 类 Javadoc */
@Api / @RestController / @RequestMapping / @Slf4j   ← 类注解
public class Xxx {
    private static final ...  ← 静态常量
    @Resource
    private XxxService xxxService;  ← 注入字段
                          [空行]
    public 公共方法（前 → 后）
    private helper 方法（按被调用顺序）
}
```

### 2. import 分组

| 顺序 | 内容 |
|------|------|
| 第 1 组 | `com.obo.*` 项目包 |
| 第 2 组 | 第三方（MyBatis-Plus / Spring / Apache / Swagger / Lombok 等） |
| 第 3 组 | `java.*` / `javax.*` / `lombok.*` / `org.springframework.*` |

每组**字典序**排列，组间**空一行**。

### 3. 类注解顺序（自上而下）

1. `@Api`（Swagger）
2. `@RestController` / `@Service` / `@Component` / `@Configuration`（容器）
3. `@RequestMapping` / `@Transactional`（框架行为）
4. `@Slf4j`（横切日志）
5. 类级 `@Validated` 等其它

方法注解顺序：`@Override` → `@Transactional` → `@ApiOperation` → `@PostMapping` / `@GetMapping`。

> **注意**：`BankCardManageServiceImpl` 中 `addBankCard`/`updateBankCard`/`deleteBankCard` 现有代码将 `@Transactional` 写在 `@Override` 之前，属于存量偏差。新代码必须遵守 `@Override` 在最前的顺序。

### 4. 字段顺序

```
private static final 业务常量       ← 静态常量（按业务相关性）
@Resource
private IBankCardService bankCardService;   ← @Resource 注入（按字母序）
private Long localCacheSize;                  ← 实例字段（按业务相关性）
```

### 5. 方法顺序

1. 公共构造方法（少见，多数用 `@Component` 注入）
2. 公共业务方法（按 Controller 调用顺序 / 业务流顺序）
3. `public @Override`（接口实现，靠近被重写的接口）
4. 公共工具/查询方法
5. 私有 helper（按被调用顺序倒序，写在文件底部）

### 6. 方法体内部规范

- **Guard clauses**：参数校验放方法**最前**，失败立即抛异常早返回
- **Early return**：嵌套 if-else 转 if + return；控制流深度 ≤ 3
- **阶段化注释**：方法体超 80 行时，按 `// 1. xxx // 2. xxx` 标注阶段，阶段间空一行
- **lambdaQuery 链式**：使用 `this.lambdaQuery()` / `this.lambdaUpdate()`，**禁止 `new QueryWrapper<>()` / `new LambdaQueryWrapper<>`**

### 7. 私有 helper 命名

| 命名 | 用途 |
|------|------|
| `validateXxx` | 业务校验 |
| `toXxx` / `fromXxx` | DTO / PO / VO 互转 |
| `buildXxx` / `mergeXxx` | 数据加工 |
| `fileChange` / `maskXxx` / `notifyXxx` | 副作用（跨模块副作用） |

私有 helper 放在类**底部**。

### 8. 错误处理与判空

- **错误处理**：业务异常一律 `throw new BusinessException("中文提示")`，**禁止吞异常**、**禁止 `e.printStackTrace()`**、**禁止 `catch (X) {}`**
- **提示语必须大白话（硬性）**：`BusinessException` 的提示文案是前端直接展示给用户的，**禁止**程序员腔（"不能为空" / "请刷新页面重试" / "刷新失败" 等），**禁止**暴露内部术语（`uniqueValue` / `taskId` / `CAS` / `bi-file` / `Flowable` / `Redis` 等中间件名）。业务键定位只放在 `log.warn` / `log.info` 中。详见 `references/coding-quality.md` §3.2。
- **判空**：集合用 `CollUtils.isEmpty(x)` / `CollUtils.isNotEmpty(x)`；字符串用 `StringUtils.isBlank(x)` / `StringUtils.isNotBlank(x)`；包装类型运算前必须判空
- **空集合返回**：用 `Collections.emptyList()` / `Collections.emptyMap()`，**禁止 `new ArrayList<>()`** 作为返回值

### 9. 分页 `PageResult` 必须声明泛型（V20260914 新增）

分页返回值 `com.obo.core.common.entity.result.PageResult` 是泛型类 `PageResult<T>`，`T` 表示 `records` 字段的元素类型。**禁止**写裸 `PageResult`（raw type）。

#### 反例（裸 PageResult）

```java
// 接口
PageResult pageOperatingScope(OperatingScopePageDTO dto);

// 实现（运行时实际返回 PageResult<OperatingScope>，但签名是 raw）
public PageResult pageOperatingScope(OperatingScopePageDTO dto) {
    Page<OperatingScope> page = new Page<>(dto.getPageNum(), dto.getPageSize());
    IPage<OperatingScope> result = this.lambdaQuery()...page(page);
    return new PageResult(result.getTotal(), result.getRecords()); // 编译器认为是 raw
}
```

#### 正例（带泛型）

```java
// 接口
PageResult<OperatingScope> pageOperatingScope(OperatingScopePageDTO dto);

// 实现（签名与 new 表达式类型一致）
public PageResult<OperatingScope> pageOperatingScope(OperatingScopePageDTO dto) {
    ...
    return new PageResult<>(result.getTotal(), result.getRecords()); // 菱形式更好，也可写 new PageResult<OperatingScope>(...)
}
```

#### 规则

1. **接口 / 实现 / 调用方声明必须一致**：上层接口 `PageResult<T>`，下层实现也必须是 `PageResult<T>`（不能上层 `PageResult<OperatingScopeVO>` 而下层返回 `PageResult<OperatingScope>` —— 类型擦除不会报错但运行期 ClassCastException）
2. **T 由 `records` 实际元素类型决定**：Component 层一般返回 PO（`PageResult<OperatingScope>`），ManageService 层如要做 PO→VO 转换，需在 ManageService 内 `BeanCopyUtils.copyList(records, OperatingScopeVO::new)` 再包成 `PageResult<OperatingScopeVO>`
3. **`Controller` `Result<PageResult<T>>` 同样必须带 T**：`Result<PageResult>` 也算 raw，等同违规
4. **菱形式 `new PageResult<>(...)` 优先**：与 Java 7+ 惯例一致；不必写 `new PageResult<OperatingScope>(...)`
5. **注意链式调用中的伪泛型**：上层接口写 `PageResult<OperatingScopeVO>` 但实现直接 `return component.pageXxx(dto)`，若 Component 返回的是 `PageResult<OperatingScope>` 实际是伪泛型 —— 必须显式转换 records 后再包一层

## 目录归属规则

按类名命名前缀决定 Maven 模块位置，违规会破坏 Maven 依赖方向与 `Controller -> ManageService -> Component -> Mapper` 的调用链。

| Maven 模块 | service/ 包下允许 | service/ 包下禁止 |
|------------|---------------------|---------------------|
| bi-cashier-service | `IXxxManageService` / `IXxxManageServiceImpl`（业务编排） | `IXxxService`（无 `Manage`）/ `IXxxServiceImpl` |
| bi-cashier-component | `IXxxService` / `IXxxServiceImpl`，继承 `IService<Xxx>`（数据访问） | `IXxxManageService` / `IXxxManageServiceImpl` |

### 命名 → 模块速查

- `IXxxManageService` → `bi-cashier-service/service/`
- `IXxxManageServiceImpl` → `bi-cashier-service/service/impl/`
- `IXxxService`（不含 `Manage`） → `bi-cashier-component/service/`
- `IXxxServiceImpl`（不含 `Manage`） → `bi-cashier-component/service/impl/`

### 补充说明

- `bi-cashier-api`：放 Feign Client（`*Client.java`）与跨服务的 DTO/VO/枚举，不放 Service 类。
- Helper（`CashierManageHelper` / `CashierExportUtils`）按 `references/code-structure.md` §7.5 与本表归到对应模块。

## 细则导航

| 任务类型 | 参考文档 |
|---------|---------|
| 类文件内代码布局（import 分组、字段/方法顺序、guard clauses、私有 helper）、**DTO/VO 设计规范**、**DTO/VO 字段 Javadoc 句末不带句号 + 字段间空行 + 类体首尾空行（V20260912 新增）** | `references/code-structure.md` |
| 命名、**注释规范（覆盖 interface 方法 / 常量 / 字段 Javadoc）**、注解、**异常处理完整规约**、**日志格式细化**、**安全性规约**、**错误码/错误信息规范**、**Feign 客户端使用规约** | `references/coding-quality.md` |
| PO 基类、uniqueValue 生成、软删除、复合主从表、SQL 归档、**PO 字段映射规约** | `references/data-model-sql.md` |
| 性能红线、批量查库、异步导出、敏感字段权限 | `references/performance.md` |
| 本模块字典/系统数据翻译做法（不使用 AOP 注解） | `references/translation-aop.md` |
| 类间结构（业务/数据分离、Manager 拆分、Impl 膨胀阈值、Facade 模式）、**业务-数据归属精确规则** | `references/concerns-separation.md` |
| 分层、**Controller 模式规范**、Service 聚合、Component、Mapper、Helper、Convert、**调用链规范** | `references/architecture-layers.md` |
| **Interface 注释规范完整版**（方法/常量/字段变量 Javadoc、Feign Client、DTO/VO 字段） | `references/coding-quality.md`（"注释规范"章节） |
| **实现类（Impl）`@Override` 方法不加方法 Javadoc**（V20260916 新增：接口必带 / Impl @Override 必不带 / 自定义 helper 必带） | 本文件 `§0.1` + 实战重构案例 `#19` |
| **Controller public 方法不加方法 Javadoc**（V20261009 新增：@ApiOperation 已是中文语义，Javadoc 是双层冗余；Controller 是 1 行转发层，无业务逻辑可描述）| 本文件 `§0.2` |
| **MP Lambda vs 手写 XML 决策、动态条件、聚合查询** | `references/mybatis-vs-xml.md` |
| **文件附件联合写入（FileExpiryRecord + bi-file + 标签库）** | `references/file-attachment-pattern.md` |
| **调用链 4 层逐行模板** | `references/call-chain-templates.md` |
| **代码评审清单（提交前逐项自查）** | `references/code-review-checklist.md` |

## 红线

- 严禁在 `for` 循环中调用 Component 层 / Mapper 查库，或调用其他 Service 的同步写入。
- Service 聚合层禁止直接调用 Mapper 或直接 `new LambdaQueryWrapper<>()` / `new QueryWrapper<>()`。
  - **例外**：Service 聚合层的批量字段更新（`batchUpdateBankCardField` 模式）允许在方法体内构造 `LambdaUpdateWrapper<T> wrapper = new LambdaUpdateWrapper<>()` 并调 `bankCardService.update(wrapper)`，理由是该 Wrapper 由聚合层动态组装多个 `set` 字段后传给 Component 执行，属于"参数构造"而非"绕过 Component 直接查库"。
- 物理删除数据（`remove()` / `removeById()`）对**业务主表**一律禁止，统一走软删除。
  - **例外**：`FileExpiryRecord`、`FileExpiryRule` 等纯关联/配置表可在明确业务场景下物理删除（如删除关联规则时级联清理记录），必须在方法注释中说明原因。
- 业务异常禁止吞掉，必须 `throw new BusinessException("中文提示")`；禁止 `e.printStackTrace()`。
- Controller 禁止编写业务逻辑（集合转换、循环赋值、批量查询），只允许调用 Service 并包装 `Result`。
- **禁止 Controller public 方法上加方法 Javadoc**（V20261009 新增）——`@ApiOperation("中文")` 已经是中文业务语义描述，再写 `/** 中文 */` 是双层冗余；Controller 是 1 行转发层，业务语义源头在 `IXxxManageService` 接口 Javadoc（§0）。详见本文档 `§0.2` + 红线。
- 禁止跨服务本地手写 Feign Client 接口，统一从 `bi-xxx-api` 引入。
- 禁止在业务表建表 SQL 中遗漏 `deleted` 字段（除非明确说明不软删）。
- 禁止将**数据访问层**（`IXxxService` / 不含 `Manage` 的 Service 类）写到 `bi-cashier-service` 模块（参见本文档"目录归属规则"）。
- 禁止用空壳 Javadoc（`/** xxx */` 一句话 + `@param xxx` 参数）蒙混过关——Javadoc 必须写出业务语义。
- **禁止 interface 内方法、常量、字段变量无注释**——必须按本文档"代码规范 §0 接口注释规范"逐项加 Javadoc；新增 / 改动行不允许出现无注释的方法签名或常量定义。
- **禁止聚合 / 上下文 DTO 内嵌在 Service / Interface / Impl 中**——见 §4.4，所有 `XxxContext` / `XxxReq` 必须放 `bi-cashier-api/dto/` 作为顶级 `public class`。
- **禁止 DTO/VO 字段 Javadoc 句末带句号、字段间无空行、类体首尾缺空行**——见 `references/code-structure.md` §6.2 / §6.3（V20260912 新增）；DTO/VO 字段 Javadoc 末尾不加 `。`，每个字段声明后空一行，类 `{` 后与 `}` 前各空一行。
- **禁止实现类（Impl）`@Override` 方法上加方法 Javadoc**——见本文档代码规范 §0.1（V20260916 新增）；接口方法必带 Javadoc（参见 §0），但 `@Override` 方法在实现类中重复书写（含 `/** {@inheritDoc} */`、附加"实现要点"等）属于冗余维护，**禁止**加。自定义 helper 方法（private / static）不在本限制范围内——helper 必须保留 Javadoc。

