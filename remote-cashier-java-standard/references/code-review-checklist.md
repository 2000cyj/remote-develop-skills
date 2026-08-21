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
- [ ] 公共方法有 `@Override` + 完整 Javadoc
- [ ] 业务前置校验（`if (x == null) throw new BusinessException(...)`）
- [ ] 阶段化注释（方法体 > 80 行时必须）
- [ ] 复杂方法加 `@Transactional(rollbackFor = Exception.class)`
- [ ] 不 `new LambdaQueryWrapper<>()` / `new QueryWrapper<>()`
- [ ] 不 `extends ServiceImpl`（这是 Component 层）
- [ ] 不跨层依赖（不 import Component Impl）

### 3. Component Service 评审

- [ ] `extends ServiceImpl<XxxMapper, T>` 必须
- [ ] `implements IXxxService` extends `IService<T>`
- [ ] **不抛 BusinessException**（业务异常）
- [ ] **不写 @Transactional** 处理跨表（仅单表）
- [ ] 复杂合并逻辑可在此（聚合前置等）
- [ ] 调 Mapper 用 `baseMapper.xxx()`（不是 `@Autowired XxxMapper`）
- [ ] 空集合返 `Collections.emptyList()`（不 `new ArrayList<>()`）

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
- [ ] 校验注解 + 中文 message
- [ ] 不持有 Service 依赖
- [ ] 列表字段用 `List<Xxx>`（不带 `s` / `List` 后缀）

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
```
