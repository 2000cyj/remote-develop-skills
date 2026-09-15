# 代码评审清单

本规范从 `SKILL.md` 拆出：提交前逐项自查，配合 `coding-quality.md` 与 `architecture-layers.md` 使用。


---

## 代码评审清单

PR 评审按层次分别检查。每个 checklist 都对应 skills 文档的章节。

### 1. Controller 评审

- [ ] `@Api(tags = "中文")` Swagger 分类
- [ ] `@RequestMapping("/cashier/{module}")` 业务前缀
- [ ] 所有方法 `@PostMapping`（不用 GET / PathVariable）
- [ ] 入参：`@RequestBody` 对 DTO / `@RequestParam("name")` 对单字段
- [ ] 返回：`Result.success(...)` 包装
- [ ] 分页接口：`Result<PageResult<XxxVO>>`（**必须带 VO 泛型**）
- [ ] 类 Javadoc 用 `<ul><li>` 列接口清单
- [ ] 注入：`@Resource private IManageService`（接口，不用 Impl）
- [ ] 方法体不超过 5 行（一行转发）
- [ ] 路径前缀：`/cashier/{module}`（不 `/api/...`）

### 2. Service 聚合评审

- [ ] `implements IXxxManageService`（接口）
- [ ] 类注解 `@Slf4j` + `@Service`
- [ ] `@Resource` 数量 ≤ 6（超出按 Facade 拆分）
- [ ] `@Resource` 字段集中放在类名下、方法声明之前；多个 `@Resource` 按字段名字母序排列（实战重构案例 §8）
- [ ] 公共方法有 `@Override` + 完整 Javadoc
- [ ] 业务前置校验（`if (x == null) throw new BusinessException(...)`）
- [ ] 阶段化注释（方法体 > 80 行时必须）
- [ ] 复杂方法加 `@Transactional(rollbackFor = Exception.class)`
- [ ] **DTO↔PO 同名字段 ≥ 3 条必须用 `BeanCopyUtils.copy` / `copyIgnore`**（例外字段在源对象里 → `copyIgnore` 排除；不在 → `copy` + 手写）；不能因"有派生字段就退出 copy、剩下全手写"（详见 SKILL.md §9 + `architecture-layers.md` §15.4）
- [ ] 不 `new LambdaQueryWrapper<>()` / `new QueryWrapper<>()`
- [ ] 不 `extends ServiceImpl`（这是 Component 层）
- [ ] 不跨层依赖（不 import Component Impl）

### 3. Component Service 评审

- [ ] `extends ServiceImpl<XxxMapper, T>` 必须（用 import 引入 `com.baomidou.mybatisplus.extension.service.impl.ServiceImpl`，禁止 `extends com.baomidou...` 全限定名）
- [ ] **PO↔VO 同名字段 ≥ 3 条必须用 `BeanCopyUtils.copy` / `copyIgnore`**（如 PageResult 的 records 批量转换 `copyList`）；原则同 §2（详见 SKILL.md §9）
- [ ] `implements IXxxService` extends `IService<T>`
- [ ] **不抛 BusinessException**（业务异常）
- [ ] **不写 @Transactional** 处理跨表（仅单表）
- [ ] 复杂合并逻辑可在此（聚合前置等）
- [ ] 调 Mapper 用 `baseMapper.xxx()`（不是 `@Autowired XxxMapper`）
- [ ] 空集合返 `Collections.emptyList()`（不 `new ArrayList<>()`）
- [ ] **分页 `PageResult` 必须带泛型**（如 `PageResult<OperatingScope>`），禁止裸 `PageResult`；菱形式 `new PageResult<>(...)` 优先（详见 SKILL.md §9）
- [ ] **类加 `@Slf4j`**，CRUD 方法失败（`baseMapper.insert/update/deleteById` 返回 false）必须 `log.warn`/`log.error` 记录业务键；SELECT 按 ID 未命中分 null / 软删两种情况分别 `log.debug` / `log.warn`（详见 SKILL.md §10）
- [ ] **不重检 DTO 默认值与校验注解（信任契约）**：DTO 字段 `= defaultVal` 默认值 + `@Min/@Max/@NotBlank` 等校验由 Controller `@Validated` 阶段处理；Component 层不写 `dto.getXxx() == null ? defaultVal : ...` 或 `Math.max(MIN, dto.getXxx())` 等重复防御；同样不写 `records == null ? Collections.emptyList() : records`（PageHelper contract 保证非 null）、不写 `list == null ? new ArrayList<>() : list`（MP `lambdaQuery().list()` 返空 `ArrayList` 不返 null）、不写 `count == null ? 0L : count`（PageHelper `getTotal()` 返 `long` 基本类型）（详见 SKILL.md §14）
- [ ] **不显式 `.eq(Xxx::getDeleted, 0)`**（PO 继承 BaseEntity 时由 `@TableLogic` 自动加 `WHERE deleted = 0`；写出来是冗余），详见 SKILL.md §15
- [ ] **任何 `lambdaUpdate().set(Xxx::getDeleted, 1)` 模式都禁止**：软删除一律走 `delete*` / `remove*`（`removeById(id)` / `deleteById(id)` / `remove(lambdaQuery().eq(业务键))`），MP 自动 `.set(deleted, 1)`，详见 SKILL.md §15
- [ ] **`selectById(...)` 后不写 `if (po.getDeleted() == 1) return null;`**（MP 已自动过滤软删记录，该分支是死代码）
- [ ] **类 extends 写法**：`extends ServiceImpl<XxxMapper, T>` 必须通过 `import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;` 引入，禁止在 `extends` 后写全限定类名

### 4. Mapper 评审

- [ ] `extends BaseMapper<T>` 必须
- [ ] `@Param("xxx")` 显式命名多参数
- [ ] 方法有 Javadoc（用途、`@param`、`@return`）
- [ ] 不暴露 Service 业务方法（只暴露数据访问）

### 5. Mapper XML 评审

- [ ] `namespace` = Mapper 接口全限定名
- [ ] 列名一律 `snake_case AS camelCase`
- [ ] `WHERE deleted = 0` 软删除
- [ ] 字符串 `<if>`：`!= null and != ''`
- [ ] 集合 `<if>`：`!= null and size() > 0`
- [ ] `<foreach>` IN 查询
- [ ] `>=` `<=` 用 `&gt;=` `&lt;=` 转义
- [ ] 模糊 `LIKE CONCAT('%', #{x}, '%')`
- [ ] 占位 XML 必须存在（即使无自定义 SQL）

### 6. PO 评审

- [ ] 继承 `BaseEntity`
- [ ] `@TableName("cashier_xxx")` snake_case
- [ ] `@ApiModel("中文")`
- [ ] `@TableId(type = IdType.AUTO)` 主键
- [ ] 字段 `@TableField("snake_case")` 显式
- [ ] 字段 `@ApiModelProperty("中文")`
- [ ] 日期字段同时 `@DateTimeFormat` + `@JsonFormat`
- [ ] 不重复声明 BaseEntity 字段
- [ ] 金额用 `BigDecimal`、日期用 `LocalDate`

### 7. DTO/VO 评审

- [ ] `@Data` + `@ApiModel("中文")`
- [ ] 字段 `@ApiModelProperty("中文")`
- [ ] 命名：`XxxDTO` / `XxxPageDTO` / `XxxSaveRequestDTO` / `XxxVO` / `XxxListVO` / `XxxDetailVO`
- [ ] 复合 DTO 嵌套 `public static class XxxItem`
- [ ] 校验注解 + 中文 message（`@NotBlank` / `@NotNull` / `@Min` / `@Size` + `message="中文"`）
- [ ] 不持有 Service 依赖
- [ ] 列表字段用 `List<Xxx>`（不带 `s` / `List` 后缀）
- [ ] **自引用 VO（TreeVO）禁止裸 `@Data`**：`@Data` 含 `@ToString + @EqualsAndHashCode` 会递归到 children 触发 StackOverflowError；必须用 `@Data + @ToString(exclude = "children") + @EqualsAndHashCode(exclude = "children")`（详见 SKILL.md §12）
- [ ] **List / listAllXxx 返回类型必须是 VO 不是 PO**：PO 字段（`deleted` / `create_user` / `update_user` 等底表字段）不外露；Service 接口、Manage 实现、Controller 三层同步改（详见 SKILL.md §12）
- [ ] **DTO 边界（`@Size` / `@Min` 等）必须同步到前端 FormRules**：同一 DTO 在前端可能对应弹窗 / 内联编辑 / Drawer / 表单查询多个表单，必须共享一份 `FormRules`（在 `utils/validation.ts`）且与后端边界值逐字段对齐；`@Size(max=100)` 不能前端写 `max:50` 也不能写 `max:200`（详见 SKILL.md §13）
- [ ] **VO 按业务视图独立命名（`Page` / `List` / `Detail`），禁止跨场景复用同类型**：`queryXxxById` 返回 `XxxDetailVO`、`listAllXxx` 返回 `XxxListVO` 或 `List<XxxListVO>`、`pageXxx` 返回 `PageResult<XxxPageVO>`；不允许详情/列表场景借用 `XxxPageVO`，也不允许「通用 `XxxVO`」跨多端点复用；字段集暂一致时直接复制字段不抽 BaseVO 抽象（继承会让 Swagger codegen 生成父类字段、且未来修改父类污染全部子类）（详见 SKILL.md §16）

### 8. 通用规范

- [ ] 注释全部中文
- [ ] SLF4J 用 `@Slf4j` 不用 `LoggerFactory`
- [ ] 判空用 `CollUtils` / `StringUtils` 不用 `size() > 0`
- [ ] 空集合返 `Collections.emptyList()`
- [ ] 异常用 `throw new BusinessException("中文")`
- [ ] 不用 `e.printStackTrace()` 不用 `catch (Exception) {}`
- [ ] 敏感字段脱敏（手机号、密码）
- [ ] 物理删除禁止（统一软删除）
- [ ] 不在外层模块跨层依赖（参见 §目录归属规则）
- [ ] **分页返回值类型链一致**：接口 `PageResult<T>` ↔ 实现 `PageResult<T>` ↔ Controller `Result<PageResult<T>>`，禁止上层写 `PageResult<VO>` 实际下层返 `PageResult<PO>` 的伪泛型（详见 SKILL.md §9）

### 9. 自检 quick 命令

```bash
# 物理删除检查
grep -r "removeById\|deleteById\|removeByIds" bi-cashier-service bi-cashier-web

# new QueryWrapper 反例
grep -r "new QueryWrapper\|new LambdaQueryWrapper" bi-cashier-service bi-cashier-web

# e.printStackTrace 反例
grep -r "e.printStackTrace" bi-cashier-service bi-cashier-component bi-cashier-api

# @Autowired 反例
grep -r "@Autowired" bi-cashier-service bi-cashier-component bi-cashier-web

# 缺 @ApiModel
for f in $(find bi-cashier-api/src/main/java -name "*.java" -path "*/dto/*"); do
  if ! grep -q "@ApiModel" $f; then echo "MISS: $f"; fi
done

# 显式 .eq(getDeleted, 0) 反例（BaseEntity.@TableLogic 自动加）
grep -rEn "::getDeleted\s*,\s*0\)" bi-cashier-{component,service}/src/main/java/

# lambdaUpdate().set(getDeleted, 1) 反例（一律走 remove，MP 自动 .set(deleted, 1)）
grep -rEnA1 "lambdaUpdate\(\)" bi-cashier-{component,service}/src/main/java/ | grep -E "set\(.*::getDeleted\s*,\s*1\)"

# selectById 后多余 getDeleted==1 判断反例
grep -rEn "\.getDeleted\(\)\s*==\s*1" bi-cashier-{component,service}/src/main/java/

# extends 全限定 ServiceImpl 反例（必须 import 后用短名）
grep -rEn "extends\s+com\.baomidou\.mybatisplus\.extension\.service\.impl\.ServiceImpl" bi-cashier-{component,service}/src/main/java/
```
