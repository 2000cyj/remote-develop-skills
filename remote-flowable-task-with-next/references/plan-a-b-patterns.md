<!--
This file is split out from remote-flowable-task-with-next/SKILL.md (§18 – §28).
It is not a standalone skill: it has no frontmatter. It is a referenced sub-doc
loaded only when the SKILL.md description triggers plan-A / plan-B / dev-template
/ decision-conclusion concerns.
-->

## 18. 前端方案 A / 方案 B

项目中的“方案 A / 方案 B”专门描述前端 `FlowableOperationButton` 的使用方式，不等同于后端的 `completeTask` 和 `completeTaskWithNext`。

### 18.1 方案 A：组件默认完成 Flowable 任务

方案 A 不传 `customOperation`：

```vue
<FlowableOperationButton
  v-if="mode === 'audit'"
  :business-key="recordId || ''"
  :form-data="formData"
  @success="loadDetail"
/>
```

组件内部会执行：

```js
if (this.customOperation && typeof this.customOperation === "function") {
  res = await this.customOperation(taskType, payload)
} else {
  res = await this.$apis.flowable.completeTask(payload)
}
```

因此方案 A 的前端调用链是：

```text
FlowableOperationButton
    -> 查询当前任务
    -> 组装 TaskCompleteReqVO 参数
    -> POST /api/flowable/bpmn/tasks/complete
    -> 刷新页面
```

方案 A 默认请求结构：

```json
{
  "taskId": "task-001",
  "outcome": "同意",
  "userId": "zhangsan",
  "comment": "审批通过",
  "variables": {
    "业务流程变量": "变量值"
  }
}
```

退回时还会增加：

```json
{
  "targetActivityId": "前置节点ID",
  "returnDirectly": true,
  "returnToActivityId": "指定返回节点ID"
}
```

方案 A 适用于：

- 业务只需要完成 Flowable 任务；
- Flowable 完成后不需要业务服务更新本地单据；
- 流程变量已经足够驱动后续流程；
- 或者 Flowable 的监听器、服务任务、回调已经负责业务状态同步；
- 页面只需要在 `success` 后重新查询详情。

方案 A 的典型页面：

```text
src/views/demo/flowable.vue
micro/personnel/src/pages/regularizationManagement/probationAssessment/addOrEdit/index.vue
src/views/Personnel/leaveManagement/resignationForm/addOrEdit.vue
src/views/Personnel/leaveManagement/releaseOrder/addOrEdit.vue
```

这些页面的共同特点是没有传 `customOperation`，默认调用通用 Flowable 完成接口。

### 18.2 方案 A 的后端链路

方案 A 对应的后端通常是：

```text
前端 /api/flowable/bpmn/tasks/complete
    -> Flowable Controller
    -> FlowableServiceImpl.completeTask
    -> 查询任务
    -> 校验处理人
    -> 写入 variables
    -> 按 outcome 执行通过、退回、驳回
    -> 返回 TaskCompleteResultVO
```

Flowable 服务核心入口：

```java
public TaskCompleteResultVO completeTask(String taskId, TaskCompleteDTO req)
```

这个方法会直接处理 Flowable 任务，但它本身不会自动知道每一个业务模块的本地表结构，也不会自动完成所有业务状态回写。

因此，采用方案 A 前必须确认：

1. 业务服务是否不需要额外保存审批状态。
2. 流程监听器是否负责业务状态回写。
3. `variables` 是否包含流程网关所需的全部字段。
4. 驳回和退回是否可以直接使用 `targetActivityId`，而不是业务节点编号。
5. 是否需要 `version`、`idempotencyKey`、`operationId` 等业务幂等参数。
6. Flowable 完成成功后，业务数据库是否会自动更新。

如果其中任意一项无法确认，不应直接采用方案 A。

### 18.3 方案 B：组件提供审批 UI，业务回调负责提交

方案 B 传入 `customOperation`：

```vue
<FlowableOperationButton
  v-if="isAudit"
  :business-key="formData.unique_code || ''"
  :form-data="formData"
  :custom-operation="handleCompleteTask"
  @success="handleFlowableSuccess"
/>
```

组件仍然负责：

- 查询当前任务；
- 判断当前登录人是否为处理人；
- 展示审批意见输入框；
- 展示通过、不通过、退回按钮；
- 查询可退回节点；
- 生成 `taskId`、`outcome`、`comment` 等通用流程参数；
- 控制 loading；
- 在回调成功后触发 `success`。

但是组件不会默认调用 `/api/flowable/bpmn/tasks/complete`，而是调用页面传入的：

```ts
customOperation(taskType, payload)
```

方案 B 的前端调用链是：

```text
FlowableOperationButton
    -> 查询当前任务
    -> 生成通用审批 payload
    -> customOperation(taskType, payload)
    -> 业务 API
    -> 业务服务
    -> bi-flowable
    -> 本地业务状态同步
    -> success 回调刷新页面
```

通用页面回调模板：

```ts
async function handleCompleteTask(
  taskType: "approve" | "reject" | "return",
  payload: FlowableCompletePayload
) {
  const outcome = taskType === "approve"
    ? "同意"
    : taskType === "reject"
      ? "驳回"
      : "退回"

  return businessApprovalApi({
    businessKey: businessKey.value,
    flowableCompleteDTO: {
      ...payload,
      outcome
    },
    businessData: buildBusinessData()
  })
}
```

### 18.4 方案 B 的后端链路

方案 B 后端不是固定只有一种链路，必须按业务服务实际代码判断。

#### B1：业务服务调用 `completeTask`

```text
前端 customOperation
    -> 业务审批 API
    -> 业务服务校验业务参数
    -> FlowableService.completeTask
    -> bi-flowable 内部完成任务
    -> 业务服务更新本地业务表
    -> 返回业务审批结果
```

这种模式仍然可以使用方案 B，但后端拿到的通常是基础完成结果。

典型适用场景：

- 业务服务自己能根据当前节点计算下一节点；
- 或者业务服务只需要完成任务，不依赖 `TaskCompleteWithNextVO`；
- 或者 Flowable 完成后的业务回写逻辑已经在业务服务内实现。

#### B2：业务服务调用 `completeTaskWithNext`

```text
前端 customOperation
    -> 业务审批 API
    -> 业务服务校验业务参数
    -> FlowableUtils.convertRequestVO
    -> BiFlowableClient.completeTaskWithNext
    -> FlowableServiceImpl.completeTaskWithNext
    -> 完成任务并查询下一节点
    -> 业务服务使用 nextAssignees / nextDocumentation
    -> 更新本地业务表
    -> 返回业务审批结果
```

这是需要同步本地节点、当前处理人和流程结束状态时的推荐模式。

后端典型代码：

```java
TaskCompleteDTO request =
        FlowableUtils.convertRequestVO(flow, businessData);

Result<List<TaskCompleteWithNextVO>> result =
        biFlowableClient.completeTaskWithNext(request);

TaskCompleteWithNextVO next = result.getData().get(0);
businessEntity.setCurrentHandler(next.getNextAssignees());
businessEntity.setCurrentFlowNode(next.getNextDocumentation());
businessEntity.setCompleted(next.getProcessEnded());
```

## 19. 方案 A / B 的真实业务示例

### 19.1 方案 A：试用期考核页面

文件：

```text
micro/personnel/src/pages/regularizationManagement/
probationAssessment/addOrEdit/index.vue
```

使用：

```vue
<FlowableOperationButton
  v-if="mode === 'audit'"
  :business-key="recordId || ''"
  :form-data="formData"
  @success="loadDetail"
/>
```

特征：

- 没有 `customOperation`；
- 组件默认调用通用 Flowable 完成接口；
- 成功后调用 `loadDetail` 刷新详情；
- 页面本身没有在按钮回调中包装业务审批 API。

该模式只能说明该页面使用了通用 Flowable 完成能力，不能自动证明它使用了 `completeTaskWithNext`。

### 19.2 方案 A：流程 Demo

文件：

```text
src/views/demo/flowable.vue
```

使用：

```vue
<FlowableOperationButton
  :businessKey="formData.businessKey"
  :formData="formData"
  @success="getProcessViews"
/>
```

这个页面用于展示流程启动、流程图和通用任务操作，适合验证公共组件，不适合直接当作复杂业务审批参考。

### 19.3 方案 B：财务审核

文件：

```text
micro/basicInfo/src/pages/reimbursement/
reimbursementManagement/addOrEdit/index.vue
```

前端：

```vue
<FlowableOperationButton
  v-if="isAudit"
  :business-key="formData.unique_code || ''"
  :form-data="formData"
  :custom-operation="handleCompleteTask"
  @taskName="handleTaskName"
/>
```

页面回调调用：

```text
passBasFinancialAudit
noPassBasFinancialAudit
```

请求包装：

```json
{
  "unique_code": "CW-001",
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "同意",
    "comment": "审批通过"
  }
}
```

后端财务服务会：

1. 查询财务审核单据。
2. 校验单据是否处于审批中。
3. 按业务规则转换 `outcome`。
4. 通过 `FlowableUtils.convertRequestVO` 合并业务变量。
5. 调用 `BiFlowableClient.completeTaskWithNext`。
6. 使用下一节点信息更新财务单据。
7. 更新当前审批人和流程节点。
8. 推送后续审批待办。

这属于方案 B + 后端 `completeTaskWithNext`。

### 19.4 方案 B：订单报销

文件：

```text
micro/basicInfo/src/pages/expressManagement/
orderAuditModule/addOrEdit/index.vue
```

前端：

```vue
<FlowableOperationButton
  v-if="isAudit && !isNonReimbursement"
  :business-key="formData.unique_code || ''"
  :form-data="formData"
  :custom-operation="handleCompleteTask"
/>
```

业务接口：

```text
passBasOrderReimbursement
noPassBasOrderReimbursement
```

前端负责把组件 payload 包进：

```json
{
  "unique_code": "BX-001",
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "同意",
    "comment": "审核通过"
  }
}
```

后端负责订单报销状态和 Flowable 任务的一致性。

### 19.5 方案 B：条码申请

文件：

```text
micro/basicInfo/src/pages/labelManage/
addOrEdit/applyFor/edit.vue
```

页面回调除了流程参数，还会提交条码业务数据：

```json
{
  "addDto": {
    "bankAccount": {},
    "bankAccountDetailsList": [],
    "if_process_barcode": true
  },
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "通过",
    "comment": "审核通过"
  }
}
```

后端先校验条码，再调用 Flowable；如果条码校验失败，流程不应继续完成。

这说明方案 B 适合“审批动作和业务数据必须在一次业务提交中完成”的场景。

### 19.6 方案 B：纸箱测试单审和批审

文件：

```text
micro/basicInfo/src/pages/carton/audit/index.vue
micro/basicInfo/src/pages/carton/batchAudit/index.vue
```

单审和批审都使用 `customOperation`。

批审回调模式：

```text
校验每一行数据
    -> 必要时先保存业务数据
    -> 按行组装 flowableCompleteDTO
    -> 调用 auditCartonTestFlowBatch
    -> 后端逐条完成 Flowable 和更新业务状态
```

这类场景不能使用方案 A，因为方案 A 只知道一个 Flowable 任务，不知道批量业务数据和逐行校验规则。

### 19.7 方案 B：社保增员

文件：

```text
micro/personnel/src/pages/regularizationManagement/
socialInsuranceEnrollmentForm/addOrEdit/addOrEdit.vue
```

使用：

```vue
<FlowableOperationButton
  v-if="mode === 'audit'"
  :business-key="recordId || ''"
  :form-data="formData"
  :custom-operation="handleCompleteTask"
  @success="loadDetail"
/>
```

回调同时提交：

```json
{
  "flowableCompleteDTO": {
    "taskId": "task-001",
    "outcome": "通过",
    "comment": "审核通过"
  },
  "perSocialSecurityAdd": {
    "uniqueValue": "SB-001",
    "state": "1"
  }
}
```

这是典型的业务审批包装模式。

## 20. 方案 A / B 与 `completeTaskWithNext` 的关系

必须把两个维度分开：

### 维度一：前端按钮模式

| 前端模式 | 判断方式 |
| --- | --- |
| 方案 A | `FlowableOperationButton` 不传 `customOperation`。 |
| 方案 B | `FlowableOperationButton` 传 `customOperation`。 |

### 维度二：后端 Flowable 完成方式

| 后端模式 | 判断方式 |
| --- | --- |
| 普通完成 | 业务服务调用 `completeTask` 或直接调用 `/flowable/bpmn/tasks/complete`。 |
| 完成并返回下一节点 | 业务服务调用 `BiFlowableClient.completeTaskWithNext`。 |

因此可能出现四种组合：

| 组合 | 前端 | 后端 | 适用场景 |
| --- | --- | --- | --- |
| A1 | 方案 A | `completeTask` | 简单流程操作，无复杂业务回写。 |
| A2 | 方案 A | `completeTaskWithNext` | 需要公共组件直接调用一个已封装的下一节点接口，但当前共享组件默认并未这样做。 |
| B1 | 方案 B | `completeTask` | 业务接口需要保存本地业务数据，但不依赖下一节点快照。 |
| B2 | 方案 B | `completeTaskWithNext` | 推荐的复杂审批业务模式，审批后要同步下一节点和处理人。 |

当前 `FlowableOperationButton` 默认实现实际是 A1：

```text
前端方案 A
    -> /api/flowable/bpmn/tasks/complete
    -> FlowableService.completeTask
```

财务审核、订单报销、条码申请、纸箱测试、社保增员等正式业务多数是 B1 或 B2，不能仅根据按钮组件名称判断后端使用了哪个 Flowable 方法。

## 21. 如何选择方案

### 21.1 优先选择方案 A 的条件

必须同时满足以下条件：

- 不需要业务审批 API 包装；
- 不需要提交额外业务数据；
- 不需要 `version` 乐观锁；
- 不需要业务侧 `idempotencyKey`；
- Flowable 监听器或流程变量能够完成业务状态同步；
- 通用的 `outcome` 和退回参数符合该流程；
- 任务完成后不依赖业务服务返回下一节点快照；
- 业务方接受组件默认调用 `/api/flowable/bpmn/tasks/complete`。

推荐模板：

```vue
<FlowableOperationButton
  v-if="isAudit"
  :business-key="businessKey"
  :form-data="formData"
  @success="loadDetail"
/>
```

### 21.2 优先选择方案 B 的条件

满足以下任意一项，就应选择方案 B：

- 审批时必须保存业务表单数据；
- 审批时需要校验业务字段；
- 审批时需要处理附件、条码、明细或金额；
- 本地业务表需要同步状态；
- 本地业务表需要同步当前节点和处理人；
- 后端要求 `version`、`idempotencyKey` 或 `operationId`；
- 驳回目标是业务节点编号而不是 Flowable activity ID；
- 通过、驳回、退回使用不同业务接口；
- 流程完成后需要推送待办或发送通知；
- 后端业务服务会调用 `completeTaskWithNext`。

推荐模板：

```vue
<FlowableOperationButton
  v-if="isAudit"
  :business-key="businessKey"
  :form-data="formData"
  :custom-operation="handleCompleteTask"
  @success="loadDetail"
/>
```

## 22. 方案 B 的完整开发模板

### 22.1 前端流程类型

建议每个业务模块声明自己的流程参数类型，不要直接大量使用 `any`：

```ts
export interface FlowableCompletePayload {
  taskId: string
  outcome: string
  userId?: string
  comment: string
  variables?: Record<string, unknown>
  targetActivityId?: string
  targetActivityName?: string
  returnDirectly?: boolean
  returnToActivityId?: string
  returnToActivityName?: string
}
```

如果后端已接入受保护 Flowable 操作，业务前端或业务 API 类型还应增加：

```ts
export interface ProtectedFlowableCompletePayload extends FlowableCompletePayload {
  operationId?: string
  twoLevelId?: string
}
```

### 22.2 页面组件

```vue
<FlowableOperationButton
  v-if="isAudit && businessKey"
  :business-key="businessKey"
  :form-data="formData"
  :custom-operation="handleCompleteTask"
  @success="handleFlowableSuccess"
/>
```

### 22.3 页面回调

```ts
async function handleCompleteTask(
  taskType: "approve" | "reject" | "return",
  payload: FlowableCompletePayload
) {
  if (!businessKey.value) return false

  if (taskType === "approve") {
    await validateBeforeApprove()
  }

  const outcome = taskType === "approve"
    ? "同意"
    : taskType === "reject"
      ? "驳回"
      : "退回"

  const result = await auditBusinessApi({
    businessKey: businessKey.value,
    flowableCompleteDTO: {
      ...payload,
      outcome
    },
    businessData: buildBusinessSubmitData()
  })

  return result.code === 0
}

async function handleFlowableSuccess() {
  await loadDetail()
}
```

### 22.4 业务 API

```ts
export function auditBusinessApi(data: {
  businessKey: string
  flowableCompleteDTO: FlowableCompletePayload
  businessData: BusinessSubmitData
}) {
  return request<ApiResponse<AuditResult>>({
    url: "/api/cashier/business/audit",
    method: "post",
    data
  })
}
```

### 22.5 后端业务服务

后端业务服务应按以下顺序处理：

```text
1. 校验业务单据存在。
2. 校验当前业务状态允许审批。
3. 校验 taskId 非空。
4. 校验当前用户属于 Flowable 任务处理人。
5. 校验 version 或业务幂等参数。
6. 校验审批业务字段。
7. 组装 FlowableCompleteDTO / TaskCompleteDTO。
8. 调用 completeTask 或 completeTaskWithNext。
9. 读取 Flowable 完成结果。
10. 在本地事务中更新业务状态、节点和处理人。
11. 必要时推送下一节点待办。
12. 返回业务结果。
```

使用 `completeTaskWithNext` 时：

```java
TaskCompleteDTO request =
        FlowableUtils.convertRequestVO(flow, businessData);

List<TaskCompleteWithNextVO> nextList =
        FlowableUtils.completeTaskWithNext(biFlowableClient, flow, businessData);
```

业务服务不要在前端直接拼接下一节点处理人作为可信数据，下一节点信息必须以 Flowable 返回结果为准。

## 23. 方案 B 中的参数映射

### 23.1 通用审批结果映射

```ts
const outcomeMap = {
  approve: "同意",
  reject: "驳回",
  return: "退回"
} as const
```

但业务服务可以按模块转换：

```text
前端 reject
    -> 业务接口 outcome=驳回
    -> 财务服务转换为 不通过
    -> Flowable
```

所以前端不应擅自把所有模块的结果值统一成同一个字符串，必须查看对应后端业务服务。

### 23.2 业务单据号与 Flowable 任务号

组件使用：

```text
business-key：用于查询当前 Flowable 任务
taskId：由组件查询后自动放入审批 payload
```

不要把以下字段混用：

```text
businessKey != taskId
businessKey != processInstanceId
businessKey != operationId
```

### 23.3 退回目标映射

组件退回 payload：

```json
{
  "targetActivityId": "BPMN_NODE_ID"
}
```

业务 API 可能要求：

```json
{
  "targetNodeNo": 3
}
```

这时必须由页面或后端完成明确映射，不能直接把 `targetActivityId` 强制转换成数字。

推荐优先级：

1. 让后端业务接口直接接收 `targetActivityId`，由后端转换；
2. 如果后端必须接收 `targetNodeNo`，前端维护稳定的节点映射表；
3. 映射不稳定时，继续使用业务专用退回弹窗，不强行套通用退回 UI。

## 24. 幂等和重复提交

方案 A 的公共组件当前不会自动生成后端新规范要求的 `operationId`、`twoLevelId`。如果业务后端已接入受保护调用，不能只依赖方案 A 默认 payload。

方案 B 中建议由业务回调或业务 API 生成并传递：

```json
{
  "operationId": "MODULE-BUSINESS-APPROVE-UUID",
  "twoLevelId": "MODULE_AUDIT",
  "taskId": "task-001",
  "outcome": "同意"
}
```

同一次网络重试必须复用相同的 `operationId`。不要在 HTTP 重试时重新生成操作号。

业务模块如果已有自己的幂等字段，例如：

```text
idempotencyKey
```

需要明确它与 Flowable 的 `operationId` 是否是一一对应关系：

```text
业务 idempotencyKey
    -> 业务服务生成或接收
    -> 固化本次审批请求
    -> 映射为 Flowable operationId
    -> completeTaskWithNext
```

## 25. 方案 B 的返回值处理

`customOperation` 返回成功后，组件只根据：

```js
res && res.code === 0
```

来判断是否成功。

因此业务回调必须返回统一响应结构：

```ts
{
  code: 0,
  message: "操作成功",
  data: {}
}
```

不要只返回：

```ts
true
```

也不要在 customOperation 内部吞掉异常后仍返回成功。

推荐：

```ts
async function handleCompleteTask(taskType: string, payload: FlowableCompletePayload) {
  const result = await auditBusinessApi(buildRequest(taskType, payload))
  return result
}
```

如果业务 API 返回的是异常结构，应转换为组件能识别的失败响应：

```ts
try {
  return await auditBusinessApi(request)
} catch (error) {
  return {
    code: -1,
    message: getErrorMessage(error)
  }
}
```

## 26. 方案 A / B 的测试检查清单

### 26.1 方案 A 检查项

- `business-key` 是否为真实业务单据号；
- 根据业务单据号是否能查到当前 Flowable 任务；
- 当前登录用户是否是任务处理人；
- 默认 `/api/flowable/bpmn/tasks/complete` 是否满足业务需要；
- 通过、驳回、退回的 `outcome` 是否被流程正确识别；
- 退回节点是否使用 Flowable activity ID；
- Flowable 完成后本地业务状态是否会自动同步；
- 是否需要 `operationId`、`twoLevelId` 或业务幂等字段；
- 页面刷新后节点和处理人是否正确。

### 26.2 方案 B 检查项

- `customOperation` 是否在三个操作中都正确处理：`approve`、`reject`、`return`；
- 通过前业务字段是否校验完整；
- 驳回和退回是否区分业务语义；
- `taskId` 是否使用组件 payload 中的真实任务 ID；
- 业务 API 是否传递必要的 `version`；
- 业务 API 是否生成或接收 `idempotencyKey`；
- 后端是否调用正确的 `completeTask` 或 `completeTaskWithNext`；
- `variables` 是否包含流程网关需要的字段；
- 业务状态是否与 Flowable 事务一致；
- `customOperation` 是否返回 `code === 0` 的统一响应；
- `@success` 是否重新加载详情、流程日志和当前处理人；
- 重复点击和网络超时重试是否不会重复办理任务。

## 27. 店铺上架流程的推荐落地方式

店铺上架页面包含：

- 申请信息；
- 店铺明细；
- 入驻筹备数据；
- 平台入驻数据；
- 店铺搭建数据；
- 当前节点数据保存；
- Flowable 审批；
- 本地状态和节点推进。

因此应使用方案 B：

```text
FlowableOperationButton
    -> customOperation
    -> approveOnboardingApi / rejectOnboardingApi
    -> OnboardingManageServiceImpl
    -> bi-flowable
    -> CAS 更新上架申请
    -> 返回业务结果
    -> @success load()
```

不能在店铺上架页面直接使用方案 A，除非后端新增完整的通用 Flowable 回调同步机制，确保以下字段都能自动更新：

```text
status
currentNodeNo
currentNodeCode
currentNodeName
currentHandlerId
currentHandlerName
currentFlowNode
lastRejectNodeNo
version
```

## 28. 审批流开发决策结论

新业务开发时按以下顺序决策：

1. 先确认审批完成后是否需要更新本地业务表。
2. 再确认是否需要提交业务表单、明细、附件或业务变量。
3. 再确认是否需要 `version`、业务幂等号或驳回业务节点号。
4. 如果都不需要，可以考虑方案 A。
5. 只要需要任一业务处理，使用方案 B。
6. 后端如果需要下一节点信息，业务服务使用 `completeTaskWithNext`。
7. 后端如果只需要完成任务基础结果，可以使用 `completeTask`。
8. 前端不要根据 `FlowableOperationButton` 的名字推断后端使用了哪个 Flowable API。
9. 以业务服务代码中的实际 `BiFlowableClient` 调用为准。
10. 完成后必须验证 Flowable 状态、本地业务状态、当前处理人和审批日志四者一致。

最终推荐规范：

```text
简单纯流程：方案 A + completeTask

复杂业务审批：方案 B + 业务审批 API + completeTaskWithNext

需要业务回写但不依赖下一节点：方案 B + 业务审批 API + completeTask

需要下一节点处理人、节点状态和流程结束信息：方案 B + 业务审批 API + completeTaskWithNext
```
