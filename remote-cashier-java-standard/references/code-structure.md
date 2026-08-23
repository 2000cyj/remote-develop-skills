# 代码结构规范

本规范聚焦"类文件内"的组织方式——包、import、字段、构造、方法、嵌套类的相对位置和书写惯例。
与 `architecture-layers.md`（包间结构 / 模块边界）和 `coding-quality.md`（命名 / 注解 / 日志）配合使用。

## 1. 类文件整体布局

一个 Java 文件的内部顺序，**自上而下**固定如下：

```
package ...

// 1. 项目内 import（按模块归集、按字典序）
import com.obo.bi.cashier.dto.XxxDTO;
import com.obo.bi.cashier.service.IXxxManageService;
import com.obo.bi.cashier.vo.XxxVO;
import com.obo.core.common.entity.result.PageResult;

// 2. 第三方 import（按字典序）
import com.baomidou.mybatisplus.extension.service.IService;
import io.swagger.annotations.ApiModel;

// 3. JDK / javax / 标准库 import（按字典序）
import javax.annotation.Resource;
import lombok.Data;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

// 4. 空一行

// 5. 类 Javadoc（中文）
/**
 * ...
 */

// 6. 类注解（@Api / @RestController / @RequestMapping / @Slf4j / @Service / @Data ...）

// 7. class 声明

// 8. 静态常量（private static final）

// 9. 实例字段（@Resource 注入在最前）

// 10. 静态方法

// 11. 构造方法

// 12. 公共方法（入口方法在前，helper 私有方法在后）

// 13. 嵌套类（public static class，最后）

// 14. 私有方法（按被调用顺序或字母序）
```

## 2. import 分组与排序

- **三组**：`com.obo.*`（项目内）→ 第三方（如 `com.baomidou.*`、`io.swagger.*`）→ JDK / `javax.*` / `lombok.*` / Spring。
- 每组内部按包路径字典序。
- 组与组之间用一个空行隔开。
- 不使用 `import xxx.*`；不写"重复包路径 + 短名"的混合，导入即用短名。
- 不要写无信息量的 `package-info.java`，除非真有包级 Javadoc 需要（参考 `bi-cashier-api/src/main/java/com/obo/bi/cashier/api/package-info.java` 这种已有场景）。

## 3. 注解位置

- 注解贴在声明**上一行**，不要夹在注解与声明之间。
- 类级注解按"显示/框架/容器/Swagger/数据/事务"的次序排：

```java
@Api(tags = "出纳-印章管理")
@RestController
@RequestMapping("/cashier/seal")
@Slf4j
public class SealController { ... }
```

- 字段注解顺序：`@ApiModelProperty`（Swagger）→ `@TableField`（MyBatis-Plus）→ `@DateTimeFormat`（入参）→ `@JsonFormat`（出参）→ `@NotBlank` / `@Size`（校验）。
- 方法注解：`@Override` → `@Transactional` → `@ApiOperation` → `@PostMapping` / `@GetMapping`。

## 4. 字段顺序

类内字段按以下顺序，**用空行分组**：

```java
public class XxxManageServiceImpl {

    // 1. 静态常量（private static final）
    private static final String SKU_PREFIX = "sealOriginalFiles";

    // 2. 注入字段（@Resource / @Autowired）
    @Resource
    private ISealService sealService;

    // 3. 业务字段（仅 PO / DTO 才有；Service / Controller 跳过本节）
}
```

- 同一组内按字母序或按已有顺序，不要为"看起来更整齐"而重排。
- 注入字段组合并放在类顶部；业务字段按业务重要性从主到次排序（参考 `BankCard.java`、`Store.java`）。

## 5. 方法顺序

类内方法的书写顺序遵循"**入口在前、内部在后**"：

```java
public class BankCardManageServiceImpl {

    // 1. 入口方法（按 @PostMapping / 业务流顺序，Controller 中按接口清单顺序）
    @Override
    public PageResult pageBankCard(BankCardPageDTO dto) { ... }

    @Override
    public String addBankCard(BankCardSaveDTO dto) { ... }

    // 2. override 收尾 / 重写 Object 方法（极少）

    // 3. 私有 helper（按被调用顺序靠后归集，便于阅读主流程）
    private void saveBankCardCustomTags(BankCardSaveDTO dto) { ... }
    private void saveTagsForModule(...) { ... }
}
```

- 不要把"对控制流可读"的小函数碎拆成多个 helper；
- 只在"两处及以上重复 / 显著降低复杂度 / 隔离副作用"的情况下提取 private helper。

## 6. 方法内部结构

### 6.1 阶段化注释

在方法体中，用 `// 1. xxx // 2. xxx // 3. xxx` 标记阶段，阶段之间用空行分隔。
**不要** 在一行内塞入校验 + 查库 + 转换 + 写入。
参考 `BankCardManageServiceImpl.exportBankCard` 的"1. 创建下载中心记录 / 2. 复用列表查询 / 3. 数据加工 / 4. 异步导出"分段。

### 6.2 Guard Clauses（前置校验）

```java
public Boolean deleteBankCard(String accountNumber) {
    if (StringUtils.isBlank(accountNumber)) {
        throw new BusinessException("账号不能为空");
    }
    // 主流程
}
```

- 校验放在方法体最前面，校验失败一律 `throw new BusinessException("中文提示")`；
- 不要 `if (xxx == null) { return null; }` 静默吞掉；
- 不要 `if (xxx == null) xxx = ...` 在方法中段补充默认值。

### 6.3 早返回（Early Return）

```java
// 推荐
if (CollUtil.isEmpty(list)) {
    return Collections.emptyList();
}
return list.stream().map(...).collect(Collectors.toList());

// 不推荐：嵌套 if-else 让控制流变深
if (CollUtil.isNotEmpty(list)) {
    return list.stream()
        .map(...)
        .collect(Collectors.toList());
} else {
    return Collections.emptyList();
}
```

### 6.4 控制流深度

- 单方法 `if/else/for/while` 总嵌套深度不超过 **3 层**；
- 超过时抽取 private helper 或策略模式（参考 `CashierManageHelper.fileChange`）。

### 6.5 空行与分隔

- 阶段之间 1 个空行；
- 阶段内联紧密的语句可连写；
- 不要为了"整齐"加无关空行（增加阅读负担）。

## 7. 嵌套类

- 内部静态类作为"复合结构的子项"使用，例如：
  - `StoreSaveRequestDTO.ChangeInfoItem`：DTO 的子项
  - `StoreDetailVO.ChangeInfoItem`：VO 的子项
- 嵌套类一律 `public static class`，写在所在外层类的**最后**（参考 SKILL.md §2.2 中的子项布局）。
- 不要超过 **2 层嵌套**（外层 → 嵌套静态类 → 不再嵌套）；如需更深，改成顶层类放在同包。

## 8. 私有 helper 与重构

| 信号 | 推荐做法 |
|------|---------|
| 同段逻辑出现 ≥2 处 | 提取为 `private` helper（不要 `public static`） |
| 一次性 / 顺序性强 / 不会再用 | 不要硬抽；保留主流程扁平写法 |
| 改了几次名还没想清楚 | 继续用主流程里的临时变量，别抽 |
| 跨多个类需要的能力 | 提到 `helper/` 包做 `@Component` |

### 8.5 未使用代码剔除（提交前必查）

每次新增 / 修改 Service 与 Component 都要过一遍诊断中的"未使用"项；规则按"真无引用才剔，告警不等于死代码"。

**真未使用 → 必剔**：

| 类别 | 检测方法 | 处置 |
|------|---------|------|
| 接口方法 0 调用方 | `Grep "interfaceMethodName\("` 全工程 | 接口 + 实现同步删（如 `add()` / `update()` / `deleteByUniqueValue()` / `queryByUniqueValue()` 4 个死方法） |
| 私有 helper 0 调用方 | 同上 | 直接删 |
| 私有 helper 仅被"另一未使用 helper"内部调用 | 形成死链 | 两个一起删（如 `findAuthorizedTask` + `containsHandler`） |
| private 形参内部从不引用 | `findField` / 阅读方法体确认 | 删形参 + 调用方传入的实参 |
| 未使用的 `import xxx;` | IDE `get_file_problems(errorsOnly=true)` | 删整行 |

**告警 ≠ 未使用 → 保留**：

| 告警 | 看似冗余的真实原因 |
|------|------|
| 形参 `variables` 始终为 `null` | Feign 客户端契约预留（后续真要传流程变量） |
| 形参 `twoLevelId` 始终为 `TWO_LEVEL_ID_CWSH` 常量 | 当前业务只一个二级别；预留支持多模块（如 `TWO_LEVEL_ID_CGGL`） |
| 形参 `uniqueValue` 在 RPC wrapper 里未用 | 帮助上层调用语义对齐，被 helper 一层转给底层，**helper 自己的形参可删**，但底层"流程要传"的位置不能删 |
| 集合变量 `tasks == null` 始终为 false | `RemoteResultUtils.unwrap()` 已保证非 null，业务冗余 guard 是 idempotency 安全网 |
| `completeResult = null` 初始值"冗余" | lambda 闭包捕获需要 final 形参 / 重新赋值可能 |
| `.replace("A", "A")` 同值替换 | 业务约束占位符，未来新增"销售财务_改版"以备 |
| switch 增强 / try-with-resources / 长方法拆解 | 风格建议，**不动**（避免越界做无关重构） |

**操作顺序**：

1. `Grep` 反查每个标识符的所有引用面
2. 真 0 引用 → 同步删：接口 + 实现 + 调用方；编译校验
3. 形参被删但调用方仍传 → 调用方同步删对应实参（IDE 会标红没传够 / 类型不匹配）
4. 用 `get_file_problems(errorsOnly=true)` 而非 `build_project`（IDEA MCP 全量编译会超时，按单文件 errors 检查已足够）

**反面案例**（2026-08 已整改）：

`OnboardingManageServiceImpl` 与 `IOnboardingApplicationService` 早期有 4 个未使用接口方法（`add()` / `update()` / `deleteByUniqueValue()` / `queryByUniqueValue()`），3 个未使用私有 helper（`returnToNode` 6 参重载、`findAuthorizedTask`、`containsHandler`），1 个未使用的 `import java.util.Objects;`，2 个 `completeTask` / `completeOpenTask` 的未引用形参 `uniqueValue`。本次整改共**清理 4 接口方法 + 3 helper + 1 import + 2 形参**，调用方同步调整。

参考 `coding-quality.md §9 DRY 与可读性` 中的细则。

### 8.6 方法简化（"一判断 / 一调用 / 0 调用" 反例）

提交前除 §8.5 "未使用" 外，还应专门扫一轮**方法简化**反例。新增 / 修改 Service 与 Component Service 实现类必查；三类处置：

**反例三类 + 处置**：

| 反例类型 | 表现 | 判定方法 | 处置 |
|----------|------|---------|------|
| **一判断一抛异常** | `assertCurrentHandler(X)` / `validateFooIsBlank(x)` 等 "检查 + 抛" 单用途 helper | 调用方 1 处 + 方法体只有 `if (xxx) throw new BusinessException(...)` | **内联到调用点** |
| **一判断一返回** | `normalizePageNum` / `normalizePageSize` 等 "判 + 返回默认值" | 调用方 1 处 + 方法体 ≤ 3 行 | **内联为三元表达式** |
| **取列表第一个 / 拼接字符串** | `firstTask(List)` / `firstTaskName(List)` 等 1-3 行"小工具" | 调用方 ≤ 2 处 + 方法体 1-3 行 | **删除 + 内联**（用 `CollectionUtils.isEmpty(x) ? null : x.get(0)`） |
| **wrapper（≥3 形参私有 helper）** | `completeTask(op, two, task, out, comment, vars)` 这种 6 形参 RPC 拼接 helper | 形参 ≥ 3（含 RPC 字段）/ 全部字段为调用方已知 | **封 DTO** + `private xxx(Req req)` + 内部走 `SecurityContextHolder` |
| **wrapper（一调用一方法 = 1 行）** | `private void deleteStores(String s) { storeService.deleteByApplicationUniqueValue(s); }` 单行调 Component Service | Component Service 已有同名方法 + helper 仅 1 行 | **删除 helper + 调用方直接调 Component Service** |
| **死方法 0 调用** | `static boolean isOpenAuditNode(...)` 整段 0 引用 | `Grep "isOpenAuditNode\("` | **直接删** |

**内联示例（"一判断一返回"）**：

```java
// ❌ 反例：单行 + 单调用方
private int normalizePageNum(Integer pageNum) {
    return pageNum == null || pageNum < 1 ? 1 : pageNum;
}
// 调用方：int pageNum = normalizePageNum(dto.getPageNum());

// ✅ 正例：内联三元
int pageNum = dto.getPageNum() == null || dto.getPageNum() < 1 ? 1 : dto.getPageNum();
```

**"取列表第一个" 内联示例**：

```java
// ❌ 反例：3 行 helper
private TaskItemSnapshotDTO firstTask(List<TaskItemSnapshotDTO> tasks) {
    return tasks == null || tasks.isEmpty() ? null : tasks.get(0);
}

// ✅ 正例：调用方内联
TaskItemSnapshotDTO returnedTask = CollectionUtils.isEmpty(returnedTasks) ? null : returnedTasks.get(0);
```

**wrapper 内联示例（≥3 形参 → DTO）**：

```java
// ❌ 反例：6 形参私有 helper + 两个 wrapper 实现完全一样
private CompleteTaskResultDTO completeTask(String operationId, String twoLevelId,
                                           String taskId, String outcome, String comment,
                                           Map<String, Object> variables) { ... }
private CompleteTaskResultDTO completeOpenTask(...) { ... }  // 与 completeTask 实现完全一致
private CompleteTaskResultDTO completeTaskInternal(..., String userId) { ... }  // 把 userId 硬塞

// ✅ 正例：DTO 单形参 + 内部 SecurityContextHolder 取 userId
@Data
public class CompleteFlowableTaskReq {
    private String operationId, twoLevelId, taskId, outcome, comment;
    private Map<String, Object> variables;
}

private CompleteTaskResultDTO doCompleteTask(CompleteFlowableTaskReq req) {
    // 内部 SecurityContextHolder.getUserName() 取 userId，不再走形参
    ...
}

// 调用方 4 处：构造 req + setX + 调 doCompleteTask(req)
```

**wrapper 一调用一方法**：

```java
// ❌ 反例：单行 wrapper（仅调一次 Component Service）
private void deleteStores(String u) { onboardingStoreService.deleteByApplicationUniqueValue(u); }
private void deleteGroundings(String u) { onboardingGroundingService.deleteByApplicationUniqueValue(u); }
private void deleteFiles(String u) { onboardingFileRelService.deleteByApplicationUniqueValue(u); }

// ✅ 正例：调用方直接调 Component Service
onboardingStoreService.deleteByApplicationUniqueValue(uniqueValue);
onboardingGroundingService.deleteByApplicationUniqueValue(uniqueValue);
onboardingFileRelService.deleteByApplicationUniqueValue(uniqueValue);
```

**不该简化的（合规 helper）**：

- `validateForSubmit(...)`（§7 `validateXxx` 一档，多判断聚合）
- `containsAssignee(...)` / `resolveNodeByTaskName(...)`（多判断聚合或业务规则解析）
- `applyListCapabilities(...)`（能力映射 19 行）
- `assigneesOf(...)`（真有拼接逻辑，非单纯 wrapper）
- `applyFields / findField / convertIfNeeded`（反射三件套，互相调用）
- `findOpenAuditTask / findTaskById`（3 处真搜任务工具）
- `sameReturnableNode / sameNodeLabel / normalizeNodeLabel`（环节名归一链式调用）

判定信号：方法体 ≤ 5 行 + 调用方 ≤ 2 处 + 没有"业务规则解析"语义 → 反例可简化；方法体 ≥ 5 行 / 多判断聚合 / 反射 / 搜索类工具 → 保留。

**反面案例**（2026-08 已整改）：

`OnboardingManageServiceImpl` 早期有 8 个反例 helper：

- `assertCurrentHandler`（一判断+throw，1 处调用 → 内联到 `update()`）
- `firstTask` / `firstTaskName`（取列表第一个，1 处调用 → 删除 + 调用方内联）
- `normalizePageNum` / `normalizePageSize`（一判断+默认，1 处调用 → 内联三元）
- `isOpenAuditNode`（static boolean，0 调用 → 直接删）
- `deleteStores` / `deleteGroundings` / `deleteFiles`（wrapper 一调用一方法，2/2/1 处调用 → 删除 + 调用方直接调 Component Service）
- `completeTask` / `completeOpenTask` / `completeTaskInternal`（两个 wrapper + 一底层，3 个 6/7 形参 → 合并为 `doCompleteTask(CompleteFlowableTaskReq)` 一个 DTO 形参）

本次整改共**清理 8 个反例 helper**，合并 3 个 RPC wrapper 为 1 个，所有调用方同步调整。

---

## 9. 常用固定结构模板

### 9.1 Controller 方法

```java
@ApiOperation("分页查询印章")
@PostMapping("/pageSeal")
public Result<PageResult<SealListVO>> pageSeal(@RequestBody SealPageDTO dto) {
    return Result.success(sealManageService.pageSeal(dto));
}
```

### 9.2 Service 聚合层方法（含事务）

```java
@Override
@Transactional(rollbackFor = Exception.class)
public Boolean updateSeal(String uniqueValue) {
    // 1. 前置校验
    if (StringUtils.isBlank(uniqueValue)) {
        throw new BusinessException("印章业务唯一流水号不能为空");
    }
    // 2. 主流程
    Seal exist = sealService.querySealByUniqueValue(uniqueValue);
    if (exist == null) {
        throw new BusinessException("印章不存在");
    }
    return sealService.updateSeal(...);
}
```

### 9.3 Component Service 软删除

```java
@Override
public Boolean deleteXxx(String uniqueValue) {
    if (StringUtils.isBlank(uniqueValue)) {
        return false;
    }
    return this.lambdaUpdate()
            .eq(Xxx::getUniqueValue, uniqueValue)
            .set(Xxx::getDeleted, 1)
            .update();
}
```

### 9.4 枚举

```java
@Getter
public enum XxxEnum {
    A("a-中文", "a"),
    B("b-中文", "b"),
    ;

    @Getter private final String msg;
    @Getter private final String value;

    XxxEnum(String msg, String value) {
        this.msg = msg;
        this.value = value;
    }
}
```

### 9.5 Convert

```java
public final class XxxConvert {
    private XxxConvert() {}
    public static XxxVO toVO(Xxx source) {
        if (source == null) return null;
        XxxVO vo = new XxxVO();
        BeanUtils.copyProperties(source, vo);
        return vo;
    }
}
```

### 9.6 Utility（聚合层）

```java
public final class XxxUtils {
    private XxxUtils() {}
    public static String formatXxx(Xxx input) {
        return input == null ? "" : input.toString();
    }
}
```

---

## DTO/VO 设计规范

### 1. DTO 命名

| 类型 | 命名 | 例 |
|------|------|-----|
| 分页查询 | `XxxPageDTO` | `BankCardPageDTO` |
| 通用保存 | `XxxSaveDTO` | `BankCardSaveDTO` |
| 复合保存（含子表） | `XxxSaveRequestDTO` | `StoreSaveRequestDTO` |
| 批量更新字段 | `XxxBatchUpdateFieldDTO` | `BankCardBatchUpdateFieldDTO` |
| 详情查询 | `XxxDetailRequestDTO` | （少见） |

### 2. PageDTO 字段规约

```java
@Data
@ApiModel("银行卡分页查询DTO")
public class BankCardPageDTO {
    @ApiModelProperty("页码")
    private Integer pageNum = 1;
    @ApiModelProperty("每页数量")
    private Integer pageSize = 10;
    @ApiModelProperty("账户名称（模糊查询）")
    private String accountName;
    @ApiModelProperty("账号列表（已选项）")
    private List<String> selectedAccountNumbers;
    @ApiModelProperty("开户行编码列表")
    private List<String> bankCodes;
    @ApiModelProperty("开户日期开始")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate openDateStart;
    @ApiModelProperty("开户日期结束")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate openDateEnd;
}
```

**Page 字段标准**：
- `pageNum`（Integer，默认 1）
- `pageSize`（Integer，默认 10）
- 业务字段用 `List`（多选 IN）或 `String`（模糊）

### 3. 复合保存 DTO（嵌套结构）

```java
@Data
@ApiModel("店铺保存请求（复合）")
public class StoreSaveRequestDTO {
    @ApiModelProperty("店铺业务唯一流水号")
    private String uniqueValue;
    
    @ApiModelProperty("变更信息列表")
    private List<ChangeInfoItem> changeInfoList;
    
    @Data
    @ApiModel("变更信息项")
    public static class ChangeInfoItem {
        @ApiModelProperty("变更信息ID")
        private Long id;
        @ApiModelProperty("变更日期")
        @DateTimeFormat(pattern = "yyyy-MM-dd")
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDate changeDate;
    }
}
```

**嵌套静态类**模式（参考 `StoreSaveRequestDTO.ChangeInfoItem`）。

### 4. VO 命名

| 类型 | 命名 | 例 |
|------|------|-----|
| 详情 | `XxxVO` | `BankCardVO` |
| 列表 | `XxxListVO` | `BankCardListVO` |
| 嵌套详情 | `XxxDetailVO` | `StoreDetailVO` |
| 导出 | `XxxExportVO` | `BankCardExportVO` |

### 5. ListVO vs DetailVO 字段差异

| 字段 | ListVO | DetailVO |
|------|--------|---------|
| 主键 | 有 | 有 |
| 基础字段 | 必要字段 | 全部字段 |
| 外键关联 | 不嵌入 | 嵌入（关联名、关联状态） |
| 子表 | 不嵌入 | 嵌入 List（变更信息、附件） |
| 审计字段 | createTime / updateTime | createTime / updateTime / createUser / updateUser |
| 状态快照 | 简版 | 完整 |

### 6. DTO/VO 通用约束

- 必须 `@Data` + `@ApiModel`
- 字段必须有 `@ApiModelProperty` + 中文
- **不能**有业务逻辑（不要放 helper 方法）
- **不能**持有 Service / Component 依赖
- 日期字段同时 `@DateTimeFormat` + `@JsonFormat`
- 列表字段用 `List<Xxx>`（统一不带 `s` 后缀）

### 7. 校验注解（javax.validation）

```java
@NotBlank(message = "印章名称不能为空")
@Size(max = 100, message = "印章名称长度不能超过 100")
private String sealName;
```

| 注解 | 用途 |
|------|------|
| `@NotBlank` | 字符串非空（比 `@NotNull` + `@NotEmpty` 更严） |
| `@NotNull` | 任意对象非空 |
| `@Size` | 字符串长度 |
| `@Pattern` | 正则 |
| `@Min` / `@Max` | 数值范围 |
| `@Email` | 邮箱格式 |
| `@Valid` | 嵌套校验（触发嵌套 DTO 上的校验） |

**规则**：`message` 必须中文。

### 8. 嵌套 DTO 校验

```java
@Valid  // 触发嵌套校验
private List<ChangeInfoItem> changeInfoList;
```

### 9. 反例

- ❌ DTO 字段没 `@ApiModelProperty`
- ❌ DTO 字段命名 snake_case
- ❌ 字段不用 `List<Xxx>` 而用 `Xxxs` / `XxxList`
- ❌ 复合 DTO 把子表平铺（应该嵌套）
- ❌ VO 嵌入 Service 依赖
- ❌ 校验注解 message 是英文
- ❌ 校验注解缺失
- ❌ DTO 字段无 `@ApiModel`
