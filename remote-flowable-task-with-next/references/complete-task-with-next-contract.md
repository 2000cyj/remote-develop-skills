## 4. 调用链

推荐的业务调用链如下：

```text
前端业务审批请求
    -> 业务服务校验业务单据和操作权限
    -> 组装 TaskCompleteDTO
    -> BiFlowableClient.completeTaskWithNext
    -> FlowableServiceImpl.completeTaskWithNext
    -> completeTask
    -> 查询下一活动任务
    -> 返回下一节点快照
    -> 业务服务更新单据和推送待办
```

后端通用转换工具：

```java
TaskCompleteDTO request =
        FlowableUtils.convertRequestVO(flow, businessData);

Result<List<TaskCompleteWithNextVO>> result =
        biFlowableClient.completeTaskWithNext(request);
```

`FlowableUtils.convertRequestVO` 会：

- 校验 `taskId` 非空；
- 将业务对象字段合并到 `variables`；
- 在 `userId` 为空时使用当前登录用户填充。

## 5. 原始接口地址和请求格式

网关暴露的前端地址通常为：

```http
POST /api/flowable/bpmn/tasks/complete-with-next
Content-Type: application/json
```

原始 Flowable 接口的请求体不包含业务接口包装字段，直接传 `TaskCompleteDTO`：

```json
{
  "operationId": "NEW-MODULE-20260817-000001",
  "twoLevelId": "NEW_MODULE_AUDIT",
  "taskId": "flowable-task-id",
  "outcome": "同意",
  "userId": "current_username",
  "comment": "审批通过",
  "variables": {
    "businessKey": "BUSINESS-001",
    "auditResult": "PASS"
  }
}
```

注意：业务审批接口的请求体通常是包装结构，不能把包装结构直接发送给原始 Flowable 接口。两种格式见第 9 节。

## 6. 请求参数规范

后端 DTO 为 `TaskCompleteDTO`：

```java
private String operation_id;
private String two_level_id;
private String taskId;
private String outcome;
private String if_price;
private Map<String, Object> variables;
private Boolean returnDirectly;
private String targetActivityId;
private String targetActivityName;
private String returnToActivityId;
private String returnToActivityName;
private String userId;
private String comment;
private String variableDataType;
```

| 字段 | 要求 | 说明 |
| --- | --- | --- |
| `operationId` | 新业务必传 | 业务侧生成的唯一幂等操作号。同一次重试必须复用。后端也兼容 `operation_id`。 |
| `twoLevelId` | 新业务必传 | 业务调用点对应的二级模块 ID。后端也兼容 `two_level_id`。 |
| `taskId` | 必传 | Flowable 当前待办任务 ID，不是业务单据号，也不是 `businessKey`。 |
| `outcome` | 必传 | 审批结果，例如 `同意`、`退回`、`驳回`。具体业务可能有额外转换。 |
| `comment` | 按业务要求 | 审批意见、备注或驳回原因。 |
| `userId` | 推荐传 | 当前操作人用户名。业务服务封装调用时可自动补当前用户。 |
| `if_price` | 按流程要求 | 是否需要报价：`1` 是，`0` 否。 |
| `variables` | 按流程要求 | 写入当前流程实例的扩展变量。 |
| `returnDirectly` | 退回场景使用 | 是否处理完成后自动跳回源节点。 |
| `returnToActivityId` | 指定退回节点时使用 | 指定退回节点 ID。 |
| `returnToActivityName` | 可选 | 指定退回节点名称。 |
| `targetActivityId` | 任意跳转或退回时使用 | 目标节点 ID。 |
| `targetActivityName` | 可选 | 目标节点名称。 |
| `variableDataType` | 特殊场景使用 | 按指定全限定类名过滤流程变量，普通调用不传。 |

后端使用 Jackson 注解支持以下两种幂等字段命名：

```json
{
  "operationId": "OP-001",
  "twoLevelId": "MODULE-001"
}
```

或：

```json
{
  "operation_id": "OP-001",
  "two_level_id": "MODULE-001"
}
```

前端推荐使用驼峰命名：`operationId`、`twoLevelId`。

## 7. 审批结果规范

当前后端和业务模块中实际出现的结果值包括：

| 值 | 含义 | 说明 |
| --- | --- | --- |
| `同意` | 通过 | 财务审核、订单报销等业务常用。 |
| `通过` | 通过 | 部分历史模块和前端类型使用。 |
| `退回` | 退回 | 将流程退回到历史节点或指定目标节点。 |
| `驳回` | 驳回 | 具体表现由业务服务和流程配置决定。 |
| `不通过` | 不通过 | 财务审核业务内部使用。 |

新业务直接调用原始 Flowable 接口时，建议约定：

```text
通过：同意
退回：退回
驳回：驳回
```

但如果调用的是业务审批接口，必须以该业务服务的约定为准。例如财务审核后端会将前端的 `驳回` 转为 `不通过` 后再调用 Flowable。

## 8. 幂等规范

### 8.1 受保护调用

新业务必须传：

```json
{
  "operationId": "MODULE-BUSINESS-001-APPROVE-001",
  "twoLevelId": "MODULE_AUDIT",
  "taskId": "task-001",
  "outcome": "同意"
}
```

后端会：

1. 校验 `taskId`、`operationId`、`twoLevelId`。
2. 根据规范化请求生成请求哈希。
3. 预占 `operationId` 和 `taskId`。
4. 执行 Flowable 任务。
5. 保存完成结果快照。
6. 相同 `operationId` 重试时返回已保存结果，避免重复办理。

### 8.2 重试规则

| 场景 | 处理规则 |
| --- | --- |
| 首次审批 | 生成新的 `operationId`。 |
| 网络超时后重试 | 使用原来的 `operationId`、`taskId` 和完整请求参数。 |
| 同一 `operationId` 更换 `taskId` | 后端拒绝。 |
| 同一 `operationId` 修改审批参数 | 后端拒绝。 |
| 同一 `taskId` 使用不同 `operationId` 重复提交 | 后端拒绝。 |
| 前端重复点击 | 前端按钮防重复，后端通过幂等字段兜底。 |

不要在每次重试时重新生成 `operationId`。

### 8.3 历史未保护调用

不传 `operationId` 时，后端仍兼容历史调用，但会记录未受保护调用日志并直接执行任务。新业务不应继续采用这种方式。

## 9. `variables` 规范

`variables` 会写入当前流程实例：

```java
runtimeService.setVariables(processInstanceId, req.getVariables());
```

示例：

```json
{
  "operationId": "CWBSH-20260817-000001",
  "twoLevelId": "CWBSH",
  "taskId": "task-001",
  "outcome": "同意",
  "comment": "审核通过",
  "variables": {
    "if_price": "0",
    "auditResult": "PASS",
    "cashierRemark": "无需报价"
  }
}
```

建议：

- 只传流程网关、服务任务或后续回调需要的字段；
- 业务详情数据放在业务接口自己的业务字段中；
- 不要无意义地把完整业务对象重复塞入 `variables`；
- 如果调用后端业务服务，先确认业务服务是否已经通过 `FlowableUtils.convertRequestVO` 自动合并业务对象。