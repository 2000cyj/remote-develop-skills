# 架构与代码落位

## 模块结构

```
simple-iot/
├── iot-server/                    # 业务主体（Spring Boot 4 单体）
│   ├── controller/iot|system/     # REST 接口
│   ├── service/ + service/impl/   # 业务层
│   ├── mapper/ + resources/mapper/*.xml
│   ├── entity/                    # MyBatis-Plus 实体（@TableName 映射 tb_ 表）
│   ├── model/DTO|query|vo|enu|exception|valid/
│   ├── driver/                    # 设备接入驱动（tcp / mqtt / http / modbus / opcua）
│   ├── iot/                       # 数据处理（iot/impl、iot/influx、iot/proto）
│   ├── rule/                      # 规则引擎（RuleChainEngine + node/）
│   ├── config/                    # 配置（base / iot / satoken / openapi）
│   └── utils/
├── iot-common/
│   ├── iot-core/                  # 基础类：BaseEntity / BaseResult / PageResult /
│   │                              #   ErrorCode / ServiceException /
│   │                              #   DeviceTransport / DeviceKeyParser / DeviceProvider
│   └── iot-protocol-core/         # 协议契约：ProtocolDecoder / DecodeResult /
│                                  #   DeviceRequest / TSL 物模型
├── iot-driver/system-driver/      # 系统级设备号解析器（AEP / GB）
├── driver-sdk/                    # 驱动 SDK 示例（⚠️ 未接入根 pom <modules>）
├── iot-web/                       # Vue 3 控制台（独立 pnpm 项目）
└── doc/sql/                       # init.sql + migrations/
```

技术栈：Java 25 · Spring Boot 4.0.2 · MyBatis-Plus 3.5.15 · Sa-Token 1.44 · Knife4j 4.5 ·
mica-mqtt 2.5 · InfluxDB 3 · PostgreSQL 16 · RustFS(S3) · GraalVM Polyglot（多语言脚本协议）。

**注意**：`driver-sdk/` 目前**不在**根 `pom.xml` 的 `<modules>` 里，`mvn verify` 不会编译它；它也**不是**真正的 Maven archetype（缺 `META-INF/maven/archetype-metadata.xml`），外部开发者无法 `mvn archetype:generate`。改动它不会影响主构建。

## 三个扩展 SPI

| SPI | 所在模块 | 职责 | 注册方式 |
|---|---|---|---|
| `ProtocolDecoder` | `iot-protocol-core` `com.github.dingdaoyi.proto.inter` | 协议编解码：`decode()` 原始字节 → `DecodeResult`；`encode()` 下行指令 → `EncoderResult` | `ProtocolFactory.DECODERS`（静态 Map），由 4 种 `ProtocolInitialize` 装载 |
| `RuleNodeExecutor` | `iot-server` `com.github.dingdaoyi.rule` | 规则节点：`execute(RuleContext, NodeConfig)` → `NodeResult` | Spring 容器扫描，`RuleChainEngine.init()` 按 `getNodeType()` 收进 `executorMap` |
| `DeviceTransport` | `iot-core` `com.github.dingdaoyi.core.driver` | 驱动生命周期：`start()` / `stop()` / `isRunning()` / `getType()` / `getName()` | `DeviceTransportManager` 在 `ApplicationReadyEvent` 时遍历容器内所有实现并启动 |
| `DeviceKeyParser` | `iot-core` `com.github.dingdaoyi.core.driver` | 从驱动上报的原始字节里解析设备编号 | `DeviceKeyParserLoader` 按驱动名查找；`iot-driver/system-driver` 提供 AEP / GB 实现 |

### 协议初始化的 4 种实现

`ProtoType` 枚举 → `initClass()` 决定用哪个 `ProtocolInitialize`：

| 实现 | 场景 |
|---|---|
| `SystemProtocolInitialize` | 系统内置协议，按 `handlerClass` 从 classpath 加载 Spring Bean |
| `JavaProtocolInitialize` | 外部 JAR 协议包，自定义 ClassLoader 加载 |
| `ScriptProtocolInitialize` | 脚本协议，GraalVM 多语言（JavaScript / Groovy / Lua / Python） |
| `DefaultProtocolDecoder` | 默认 JSON 协议，按 `ProtoMessageType` 策略分派 |

协议支持**热加载 / 热卸载**：`ProtocolFactory.reloadProtocol(protoKey)` / `unloadProtocol(protoKey)`，`DECODERS` 是 `static final Map`。

## 设备上报数据流

```
设备
  ↓ MQTT / TCP / HTTP / Webhook / Modbus / OPC UA
DeviceTransport（驱动层）
  ↓ 构造 DeviceRequest{deviceKey, productKey, protoKey, messageType, data, connection}
IotDataProcessor.messageUp(DeviceRequest)
  ↓
ProtocolFactory.getDecoder(protoKey)      ← 按产品绑定的 protoKey 路由
  ↓ ProtocolDecoder.decode(request, tslModel) → DecodeResult
├─→ InfluxDataProcessor.process()         ← 时序落库（属性 / 事件）
└─→ RuleChainDataProcessor.process()       ← 触发规则链
       ↓ RuleChainEngine.execute(ruleChain, context)（带子流 callStack 环检测）
         ↓ RuleNodeExecutor.execute()
           ├─→ AlarmService（四级告警 + 5 分钟抑制）
           ├─→ 推送（邮件 / 短信 / HTTP / MQTT / 钉钉 / 企微 / 飞书）
           └─→ ServiceHandler 下发设备指令（回边到驱动层）
```

下行链路：`ServiceHandler.sendMessage()` → 查产品协议是否启用 → `ProtocolDecoder.encode()` → `DeviceConnection` 写回设备。

## 落位决策表

| 要加的东西 | 放哪 | 还要改哪 |
|---|---|---|
| 新协议解码器 | `iot-server/iot/proto/impl/`（系统内）或 `iot-protocol-core`（对外契约） | `ProtoType` 枚举；外部 JAR 走 `JavaProtocolInitialize` |
| 新协议加载方式 | `iot-server/iot/proto/impl/` 新增 `ProtocolInitialize` 实现 | `ProtoType.initClass()` |
| 新规则节点 | `iot-server/rule/node/XxxNode.java` 实现 `RuleNodeExecutor` | **`RuleNodeType` 枚举必须加枚举值**（否则注册不上）；前端 `layoutRout` / 节点配置面板同步 |
| 新驱动（TCP / HTTP / 自定义） | `iot-server/driver/{type}/` 实现 `DeviceTransport` | 设备号解析另实现 `DeviceKeyParser` |
| 新设备号解析器（系统级） | `iot-driver/system-driver/` | `DriverTypeEnum.driverTypes()` 声明适用驱动类型 |
| 新实体 / 表 | `iot-server/entity/Xxx.java` + `doc/sql/init.sql` + `doc/sql/migrations/` | 见 `schema-sync.md` |
| 新 REST 接口 | `iot-server/controller/iot/XxxController.java` | 返回值统一 `BaseResult<T>`，分页用 `BaseResult<PageResult<T>>` |
| 新业务逻辑 | `iot-server/service/XxxService.java` + `service/impl/XxxServiceImpl.java` | — |
| 公共基础类 | `iot-common/iot-core/`（跨模块复用） | 注意**不要**在 `iot-server` 重复定义同名同包名的类 |

## 已知的架构债（改代码时注意）

- **`DeviceTransport` 有两份**：`iot-common/iot-core` 与 `iot-server` 各有一个 `com.github.dingdaoyi.core.driver.DeviceTransport`（**同包名跨模块**）。server 版多出 `reload()` / `addDriver()` / `removeDriver()`，且在 classpath 上遮蔽 common 版。现有三个传输实现（TCP / MQTT / HTTP）实现的是 **server 版**。从 common 侧实现驱动会拿到缺方法的接口。
- **`HttpDeviceTransport` 是空壳**：`start()` / `stop()` 只翻转 boolean 标志，无实际逻辑；真正的 HTTP 接收由 `HttpDriverController` 处理。但 `DeviceTransportManager` 会把它记为"驱动已启动"。
- **`OpcUaPollingService` 是轮询不是订阅**：用 `scheduleAtFixedRate` + 逐节点 `readValue`，且**每次轮询都新建 `OpcUaClient`**，连接不复用。
- **`DeviceTransportManager.reloadTransport()` 只能重载 Spring 容器内已注册的 Bean**，无法加载外部驱动 JAR —— 外部驱动只能走协议 JAR 路径。
