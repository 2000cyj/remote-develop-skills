# 编码约定

## 分层与命名

| 层 | 命名 | 说明 |
|---|---|---|
| 实体 | `Device` / `Alarm` / `OpcUaConfig` | `tb_` 前缀表名，`@TableName` 显式声明 |
| Service | `XxxService` + `XxxServiceImpl` | 接口 / 实现分离；简单 CRUD 继承 MyBatis-Plus `ServiceImpl` |
| Controller | `XxxController` | `controller/iot/`（业务）与 `controller/system/`（系统管理） |
| Mapper | `XxxMapper` + `resources/mapper/XxxMapper.xml` | 复杂查询写 XML，简单用 lambda |
| 查询对象 | `XxxPageQuery` / `XxxAddQuery` / `XxxUpdateQuery` | 放 `model/query/` |
| 返回对象 | `XxxVo` / `XxxPageVo` | 放 `model/vo/` |
| 规则节点 | `XxxNode` | 放 `rule/node/`，实现 `RuleNodeExecutor` |
| 协议解码器 | `XxxProtocolDecoder` | 放 `iot/proto/impl/` 或 `iot/proto/defaul/` |

## 统一响应

```java
BaseResult<T>       // code / msg / data；success 已由响应码推导，不再单独存字段
PageResult<T>       // code / msg / data / total / current / size，实现 Iterable<T>
```

- 成功：`BaseResult.success(data)` / `BaseResult.success(msg, data)`
- 失败：`BaseResult.fail(ErrorCode.X, "提示")` —— **优先用 `ErrorCode` 枚举**，不要自己写数字
- 分页：`PageResult.of(records, total, current, size)`
- Controller 返回 `BaseResult<T>`，不要直接返回裸对象

## 异常与错误码

- 业务异常一律 `BusinessException`，携带 `ErrorCode`
- `ErrorCode` 是唯一错误码来源：客户端段 400-429、服务端段 500-502、自定义段 900+
- 全局兜底由 `GlobalExceptionHandler` 处理，Service 里**不要**自己 try-catch 包装成 `Result`

## 实体约定

```java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_xxx")
public class Xxx extends BaseEntity {
    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    @TableField(value = "snake_case")
    private String someField;
}
```

- 继承 `BaseEntity` 才有 `create_time` / `update_time`（自动填充）
- 枚举字段用 `@EnumValue` + `@JsonValue`（见 `DriverTypeEnum`），复合枚举处理器在 `application.yml` 里配
- JSON / JSONB 字段用 `typeHandler = JacksonTypeHandler.class`（见 `ModelProperty.enums`）

## Jackson 序列化

- 全局兜底：`MicaConfig` 里 `mapper.setDefaultPropertyInclusion(JsonInclude.Include.NON_NULL)`
  → 嵌套 POJO 与 Map 的 null 值会被省略
- `BaseResult` 类上的 `@JsonInclude(NON_NULL)` **只作用于它自己的属性**（让 `data` 为 null 时整个字段消失），**不递归进泛型 T**
- **集合元素里的 null 仍会输出**（`["x",null]`），content inclusion 不作用于集合元素
- 需要某个 DTO 自己控制时，在该类上加 `@JsonInclude`，而不是改 `BaseResult`

## Javadoc

类级注释统一格式：

```java
/**
 * 一句话描述
 *
 * @author dingyunwei
 */
```

- 全项目 324/456 个 Java 文件带 `@author dingyunwei`，**新增类沿用**
- 枚举 / 接口 / 工具类同样要写描述（不要只留 `@author`）
- 方法级注释：写清**做什么**（`@param` 只说参数是什么）

## 规则节点

```java
public class XxxNode implements RuleNodeExecutor {
    @Override public RuleNodeType getNodeType() { return RuleNodeType.XXX; }

    @Override
    public NodeResult execute(RuleContext context, NodeConfig config) {
        return NodeResult.ok();          // 或 ok(data) / ok(msg) / fail(msg) / of(boolean)
    }
}
```

- **新增节点必须同时在 `RuleNodeType` 枚举加值**，否则 `RuleChainEngine` 的 `executorMap` 注册不上
- `NodeResult.connectionType` 决定走哪条出边：`Success` / `Failure` / `True` / `False`
- `RuleContext` 提供 `getTraces()` / `getAllProperties()` / `getEnrichedData()`，可用于调试与后续节点
- 节点抛异常会被引擎捕获并写入失败轨迹，**不要**在节点里吞异常

## 协议解码器

```java
public class XxxProtocolDecoder implements ProtocolDecoder {
    @Override public String protocolKey() { return "xxx"; }

    @Override
    public DecodeResult decode(DeviceRequest request, TslModel tslModel) { ... }

    @Override
    public EncoderResult encode(EncoderMessage message, TslModel tslModel) { ... }

    @Override
    public void responseError(DeviceConnection connection, ProtocolException e) { ... }
}
```

- `protocolKey()` 必须唯一，且与产品表 `proto_key` 一致
- `decode()` 抛 `ProtocolException` 表示协议错误；`responseError()` 负责回写错误信息
- **`responseError()` 要判空 `DeviceConnection`** —— Webhook / HTTP 推送场景没有 connection，直接用会 NPE

## 驱动

- 实现 `DeviceTransport`（`iot-server` 版本，含 `reload()` / `addDriver()` / `removeDriver()`）
- 设备号解析另实现 `DeviceKeyParser`，在 `DeviceKeyParserLoader` 注册
- 拉取型协议（Modbus / OPC UA）用 `ScheduledExecutorService` 轮询，构造 `DeviceRequest` 调 `dataProcessor.messageUp()`
- **驱动实现里不要打 INFO 级全量报文**（MQTT `onMessage` 打完整 topic + payload 会造成日志洪水 + 设备密钥泄露）

## 日志

- 用 Lombok `@Slf4j`
- 关键上下文进日志（deviceKey / protoKey / identifier / reason）
- **不要**用 `log.info` 打每条设备上报的完整报文；用 debug 级别
- 生产环境 `application.yml` 默认关 SQL 日志（`NoLoggingImpl`），dev profile 才开
