---
name: remote-flowable-task-with-next
description: Use when 通过 BiFlowableClient.completeTaskWithNext 完成 Flowable 待办、查询下一节点信息、处理审批结果与幂等、调整或排查 completeTaskWithNext 调用链。
---

- Use references/complete-task-with-next-contract.md when 涉及调用链、入参、返回值、幂等
- Use references/error-handling.md when 涉及错误码、异常处理
- Use references/plan-a-b-patterns.md when 涉及方案 A/B 选择、开发模板、测试检查清单、决策结论

# Flowable `completeTaskWithNext` 使用规范

## 1. 文档目的

本文档说明 `BiFlowableClient.completeTaskWithNext` 的功能、后端调用链、请求参数、前端业务接口包装方式、幂等要求和返回值使用方式。

适用场景：业务审批完成当前 Flowable 待办后，需要立即获得下一流程节点、下一节点处理人以及流程是否结束的信息。

后端接口定义：

```java
@PostMapping("/flowable/bpmn/tasks/complete-with-next")
Result<List<TaskCompleteWithNextVO>> completeTaskWithNext(
        @RequestBody TaskCompleteDTO req);
```

源码位置：

```text
D:/OB/bi-FOB/bi-flowables/bi-flowable-api/
src/main/java/com/obo/bi/flowable/api/BiFlowableClient.java
```

## 2. 功能说明

`completeTaskWithNext` 用于完成 Flowable 当前待办任务，并在完成后查询和返回下一活动任务信息。

它主要完成以下工作：

1. 根据 `taskId` 查询当前 Flowable 任务。
2. 校验当前用户是否有权限处理该任务。
3. 写入审批结果、审批意见和流程变量。
4. 按 `outcome` 执行通过、退回或驳回逻辑。
5. 完成当前用户任务。
6. 查询流程产生的全部下一活动任务。
7. 返回下一节点、下一节点处理人、节点状态和流程结束标识。
8. 在传入 `operationId` 和 `twoLevelId` 时，执行受保护的幂等处理。

它不是具体业务审批接口，不负责直接保存业务单据、更新业务状态、保存附件或发送业务通知。这些工作由调用它的业务服务完成。

## 3. 与普通完成接口的区别

普通接口：

```http
POST /flowable/bpmn/tasks/complete
```

`completeTask` 主要完成当前任务并返回基础完成结果。

`completeTaskWithNext` 除了完成当前任务，还会查询并返回：

- 当前刚完成的任务信息；
- 下一任务 ID；
- 下一节点定义键和名称；
- 下一节点处理人；
- 下一节点状态和 Documentation；
- 流程是否结束。

因此，业务服务可以使用一次调用完成“审批 + 下一节点同步”，不需要再单独查询流程当前任务。

## Workflow

涉及调用链、接口地址、入参、返回值、幂等规范与 `variables` 规范时，阅读首读指引 → `references/complete-task-with-next-contract.md`。

涉及错误码、参数错误、字段混淆、事务边界时，阅读首读指引 → `references/error-handling.md`。

## 10. 退回参数规则

### 10.1 退回指定节点

```json
{
  "operationId": "MODULE-BUSINESS-001-RETURN-001",
  "twoLevelId": "MODULE_AUDIT",
  "taskId": "task-003",
  "outcome": "退回",
  "comment": "请补充资料",
  "targetActivityId": "FIRST_AUDIT_NODE",
  "targetActivityName": "初审"
}
```

`targetActivityId` 必须是当前流程允许回退的节点。可以先调用：

```http
POST /api/flowable/bpmn/process-instances/returnable-nodes
```

查询可回退节点。

### 10.2 自动跳回源节点

```json
{
  "operationId": "MODULE-BUSINESS-001-RETURN-002",
  "twoLevelId": "MODULE_AUDIT",
  "taskId": "task-003",
  "outcome": "退回",
  "returnDirectly": true,
  "comment": "退回源节点"
}
```

不要同时传递互相冲突的 `returnDirectly`、`targetActivityId` 和 `returnToActivityId`，除非对应业务服务明确规定了优先级。

## 11. 返回值规范

返回类型：

```java
Result<List<TaskCompleteWithNextVO>>
```

返回示例：

```json
{
  "code": 200,
  "success": true,
  "message": "操作成功",
  "data": [
    {
      "processInstanceId": "process-001",
      "completed": true,
      "currentTaskId": "task-001",
      "current_task_definition_key": "CWSP",
      "currentTaskName": "财务审核",
      "currentAssignee": "zhangsan",
      "currentStatus": "同意",
      "documentation": "CWSH",
      "nextTaskId": "task-002",
      "next_task_definition_key": "CWCK",
      "nextTaskName": "出纳审核",
      "nextAssignees": "lisi",
      "nextStatus": "待审核",
      "nextDocumentation": "CWCK",
      "processEnded": false
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `processInstanceId` | 流程实例 ID。 |
| `completed` | 当前任务是否完成。 |
| `currentTaskId` | 刚刚完成的任务 ID。 |
| `current_task_definition_key` | 当前任务定义键。 |
| `currentTaskName` | 当前任务名称。 |
| `currentAssignee` | 当前任务处理人。 |
| `currentStatus` | 当前审批状态。 |
| `documentation` | 当前节点 Documentation 配置。 |
| `nextTaskId` | 下一任务 ID，无下一任务时为空。 |
| `next_task_definition_key` | 下一节点定义键。 |
| `nextTaskName` | 下一节点名称。 |
| `nextAssignees` | 下一节点处理人，多个处理人用逗号拼接。 |
| `nextStatus` | 下一节点状态。 |
| `nextDocumentation` | 下一节点 Documentation 配置。 |
| `processEnded` | 流程是否已经结束。 |

如果流程已结束，通常表现为：

```json
{
  "processEnded": true,
  "nextTaskId": null,
  "nextAssignees": "",
  "nextDocumentation": ""
}
```

### 11.1 为什么返回数组

任务完成后可能产生多个下一任务，例如会签、并行审批、多实例任务或并行网关。因此返回类型是列表，而不是单个对象。

Java 调用方应遍历列表：

```java
for (TaskCompleteWithNextVO item : result.getData()) {
    // 处理每个下一节点
}
```

只有在业务明确保证单节点时，才取第一项。

前端示例：

```ts
const next = response.data?.[0]

if (next?.processEnded) {
  // 流程已结束
} else {
  // 使用 next.nextTaskId、next.nextAssignees、next.nextDocumentation
  // 更新业务页面或刷新待办
}
```

## 12. `ob_web` 业务接口包装方式

`D:/OB/ob_web` 当前没有发现直接调用 `/api/flowable/bpmn/tasks/complete-with-next` 的统一前端 API。前端主要调用各业务审批接口，由业务服务内部调用 `completeTaskWithNext`。

### 12.1 财务审核

前端 API：

```text
micro/basicInfo/src/pages/reimbursement/
reimbursementManagement/addOrEdit/apis/index.ts
```

接口：

```http
POST /api/basics/financialAudit/passBasFinancialAudit
POST /api/basics/financialAudit/noPassBasFinancialAudit
```

请求结构：

```json
{
  "unique_code": "CW-20260817-001",
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "同意",
    "comment": "审核通过",
    "userId": "zhangsan",
    "variables": {
      "if_price": "0"
    }
  }
}
```

后端财务审核服务会将流程参数转换为 `TaskCompleteDTO`，然后调用 `completeTaskWithNext`，再使用返回的下一节点信息更新财务单据和推送待办。

注意：当前前端类型中部分位置使用 `flowableCompleteParams`，但实际提交代码使用 `flowableCompleteDTO`。新代码应以实际后端 DTO 和现有提交代码为准，统一使用 `flowableCompleteDTO`。

### 12.2 订单报销审核

接口：

```http
POST /api/basics/orderReimbursement/passBasOrderReimbursement
POST /api/basics/orderReimbursement/noPassBasOrderReimbursement
```

请求结构：

```json
{
  "unique_code": "BX-20260817-001",
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "同意",
    "comment": "审核通过",
    "variables": {
      "if_price": "1"
    }
  }
}
```

### 12.3 条码申请审核

接口：

```http
POST /api/basics/barcodeApplication/updateBarcodeAndFlowable
```

请求结构：

```json
{
  "addDto": {
    "bankAccount": {
      "unique_id": "BM-20260817-001",
      "department": "D001",
      "total_quantity": 10,
      "create_user": "zhangsan"
    },
    "if_process_barcode": false,
    "bankAccountDetailsList": [
      {
        "unique_id": "DETAIL-001",
        "factory": "F001",
        "quantity": 10,
        "dial_up_section": "A",
        "barcodeList": []
      }
    ]
  },
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "通过",
    "comment": "审核通过"
  }
}
```

后端会在完成流程后使用 `nextDocumentation` 和 `nextAssignees` 更新条码申请单的节点和当前处理人。

### 12.4 纸箱测试流程审核

接口：

```http
POST /api/basics/cartonTestFlow/auditCartonTestFlowBatch
```

请求结构：

```json
[
  {
    "cartonTestFlow": {
      "unique_id": "CT-20260817-001",
      "product_code": "P001"
    },
    "flowableCompleteDTO": {
      "taskId": "task-001",
      "outcome": "通过",
      "comment": "测试通过"
    }
  }
]
```

## 13. 获取 `taskId`

`taskId` 是 Flowable 当前任务 ID，不是业务单据号。

通常先按业务单据号查询当前任务：

```http
POST /api/flowable/bpmn/process-instances/tasks
```

参数：

```json
{
  "businessKey": "业务单据号"
}
```

从返回的当前任务中取：

```json
{
  "taskId": "真实 Flowable 任务 ID",
  "assignee": "当前处理人"
}
```

提交前建议确认：

- `taskId` 仍然存在；
- 当前登录用户是任务处理人；
- 当前业务单据状态仍为审批中；
- 没有其他操作已经完成同一个任务。

## 14. 推荐请求示例

### 14.1 通过

```json
{
  "operationId": "NEW-MODULE-BUSINESS-001-APPROVE-001",
  "twoLevelId": "NEW_MODULE_AUDIT",
  "taskId": "flowable-task-id",
  "outcome": "同意",
  "userId": "current_username",
  "comment": "审批通过",
  "variables": {
    "auditResult": "PASS"
  }
}
```

### 14.2 退回

```json
{
  "operationId": "NEW-MODULE-BUSINESS-001-RETURN-001",
  "twoLevelId": "NEW_MODULE_AUDIT",
  "taskId": "flowable-task-id",
  "outcome": "退回",
  "userId": "current_username",
  "comment": "请补充资料",
  "targetActivityId": "FIRST_AUDIT_NODE",
  "targetActivityName": "初审"
}
```

### 14.3 驳回

```json
{
  "operationId": "NEW-MODULE-BUSINESS-001-REJECT-001",
  "twoLevelId": "NEW_MODULE_AUDIT",
  "taskId": "flowable-task-id",
  "outcome": "驳回",
  "userId": "current_username",
  "comment": "审批不通过",
  "variables": {
    "rejectReason": "资料不完整"
  }
}
```

## 15. 前端类型建议

当前 `ob_web` 多个流程类型尚未声明新增的幂等字段。新业务建议定义：

```ts
export interface FlowableCompleteDTO {
  operationId: string
  twoLevelId: string
  taskId: string
  outcome: string
  comment?: string
  userId?: string
  if_price?: string
  variables?: Record<string, unknown>
  returnDirectly?: boolean
  returnToActivityId?: string
  returnToActivityName?: string
  targetActivityId?: string
  targetActivityName?: string
}
```

如果业务接口需要包装业务单据：

```ts
export interface ApprovalParams {
  unique_code: string
  flowableCompleteDTO: FlowableCompleteDTO
}
```

建议统一使用 `flowableCompleteDTO`，不要同时使用 `flowableCompleteParams` 和 `flowableCompleteDTO` 两种字段名。

## 17. 最终规范

新业务直接使用原始接口时，统一采用：

```json
{
  "operationId": "模块标识-业务单据号-操作序号或UUID",
  "twoLevelId": "明确的二级模块ID",
  "taskId": "Flowable任务ID",
  "outcome": "同意|退回|驳回",
  "userId": "当前登录用户名",
  "comment": "审批意见",
  "variables": {},
  "returnDirectly": false,
  "targetActivityId": "退回时才传"
}
```

必须遵守：

1. `taskId` 必传。
2. 新业务必须传 `operationId` 和 `twoLevelId`。
3. 同一次重试必须复用同一个 `operationId`。
4. 通过使用 `同意`，退回使用 `退回`，驳回使用 `驳回`，除非业务服务明确规定其他值。
5. 业务字段放在 `variables`，但不要重复传完整业务对象。
6. 调用业务审批接口时，使用业务接口规定的包装结构，例如 `unique_code + flowableCompleteDTO`。
7. 不要把 `businessKey` 当作 `taskId`。
8. 读取返回数组，使用 `processEnded` 判断流程是否结束，使用 `nextTaskId`、`nextAssignees` 和 `nextDocumentation` 更新下一节点信息。

