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

参考 `coding-quality.md §9 DRY 与可读性` 中的细则。

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
