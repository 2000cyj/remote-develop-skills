# 店铺上架流程 API 测试记录

## 1. 文档目的

本文记录店铺上架流程通过纯 Node.js API 脚本完成的测试项、请求步骤和预期结果。

后续每次复测都必须先创建全新的测试申请，并以创建接口返回的 `uniqueValue`、`version`、`applicationStoreId` 为本次测试变量。本文不提供可复用的业务测试数据。

## 2. 测试范围

### 2.1 已测试功能

| 编号 | 测试项 | 状态 |
| --- | --- | --- |
| T01 | 创建店铺上架草稿 | 通过 |
| T02 | 节点 1 销售发起免鉴权提交 | 通过 |
| T03 | 节点 2~8 使用候选人 chenyanjun 审批通过 | 通过 |
| T04 | 节点 8 完成后进入节点 9 的本地状态同步 | 通过 |
| T05 | 节点 9 保存数据并提交 | 通过 |
| T06 | 节点 10 保存数据并完成流程 | 通过 |
| T07 | 节点 3 回退到节点 1 | 通过 |
| T08 | 回退到节点 1 后编辑并重新提交 | 通过 |
| T09 | 节点 3 回退节点 1，节点 1 重新通过后从头全流程通过 | 通过 |
| T10 | 节点 3 回退节点 1，节点 1 重新通过后返回指定节点 2 | 通过 |
| T11 | 节点 6 回退节点 1，节点 1 重新通过后返回指定节点 5 | 通过 |

### 2.2 尚未覆盖

| 编号 | 未测试项 |
| --- | --- |
| U01 | 使用不在节点 2~8 候选列表中的用户审批 |
| U02 | 使用不同普通用户验证节点 1、9、10 的任意用户免鉴权 |
| U03 | 节点 2~8 回退到其他各个前置节点的组合 |
| U04 | 节点 9/10 只保存草稿、不提交 |
| U05 | 节点 9/10 子账号列表保存 |
| U06 | 重复请求、相同幂等键、并发提交 |
| U07 | 回退后修改店铺明细、附件和准备资料的完整编辑场景 |
| U08 | 节点 9/10 数据校验失败、建店失败和 Flowable 异常场景 |

## 3. 测试环境

### 3.1 服务

| 服务 | 端口说明 |
| --- | --- |
| bi-cashier | 配置范围 `20334~20344`，每次启动随机端口；复测前必须读取当前监听端口 |
| bi-flowable | 配置范围 `20292~20300`，每次启动随机端口；复测前必须读取当前监听端口 |

复测时以当前服务实际监听端口为准，以下仅为变量格式：

```text
bi-cashier: http://localhost:<当前端口>
bi-flowable: http://localhost:<当前端口>
username: chenyanjun
userId: 410958
```

配置位置：

```text
D:/OB/bi-FOB/bi-cashier/bi-cashier-web/src/main/resources/bootstrap.yml
D:/OB/bi-FOB/bi-flowables/bi-flowable-web/src/main/resources/bootstrap.yml
```

### 3.2 测试脚本

```text
D:/OB/ob_web/packages/micro/cashier/scripts/onboarding-flow.mjs
```

脚本支持动作：

```text
inspect
create
update
submit
approve
reject
save-node
```

### 3.3 端口读取

PowerShell：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 20334 -and $_.LocalPort -le 20344 } |
  Select-Object LocalPort, OwningProcess

Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 20292 -and $_.LocalPort -le 20300 } |
  Select-Object LocalPort, OwningProcess
```

不要固定使用历史端口。服务重启后必须重新读取端口。

## 4. 通用命令格式

以下命令均在目录执行：

```text
D:/OB/ob_web/packages/micro/cashier
```

设置本次端口变量，仅用于 PowerShell 当前窗口：

```powershell
$cashier = "http://localhost:<当前bi-cashier端口>"
$flowable = "http://localhost:<当前bi-flowable端口>"
$user = "chenyanjun"
$userId = "410958"
```

查询申请状态：

```powershell
node scripts/onboarding-flow.mjs inspect `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue>
```

所有 API 调用都应带：

```text
--base-url
--flowable-base-url
--username chenyanjun
--user-id 410958
--unique-value <当前申请uniqueValue>
```

## 4.1 调用账号

本测试使用的是请求头模拟登录上下文，不在脚本中保存密码：

| 参数 | 测试值 | 用途 |
| --- | --- | --- |
| `username` | `chenyanjun` | 业务操作用户名、Flowable 候选用户匹配值 |
| `userId` | `410958` | 出纳服务请求头中的登录用户 ID |
| `client-source` | 空字符串 | 本地直连时可为空 |
| `Authorization` | 不填写 | 本地服务未要求 token 时不填写；如果环境开启 token，使用 `--token` 传入 |

脚本会把这些值转换成请求头：

```http
Requestid: <每次请求自动生成的UUID>
username: chenyanjun
userId: 410958
client-source:
Content-Type: application/json
Authorization: Bearer <仅在传入--token时发送>
```

注意：

1. `username` 不是昵称，必须填写登录账号，例如 `chenyanjun`。
2. 节点 2~8 的 BPMN 候选人配置使用账号匹配，因此 `username` 必须和候选用户值一致。
3. `userId` 是请求头的用户 ID，不要把 `410958` 填到 `username`。
4. 本文不记录密码、token 或其他敏感凭证。

## 4.2 API 调用方式

测试脚本使用 Node.js 18+ 内置 `fetch`，直接请求两个本地服务，不使用浏览器、不点击页面、不经过主应用 UI。

### 方式 A：直连服务，推荐

```text
bi-cashier 业务 API: http://localhost:<cashierPort>
bi-flowable 查询 API: http://localhost:<flowablePort>
```

直连时不加 `/api` 前缀：

```text
http://localhost:<cashierPort>/cashier/store/audit/onboarding/...
http://localhost:<flowablePort>/flowable/bpmn/process-instances/...
```

脚本命令必须同时传：

```text
--base-url http://localhost:<cashierPort>
--flowable-base-url http://localhost:<flowablePort>
```

### 方式 B：通过前端代理

如果不直连服务，而是通过 cashier 前端开发代理调用：

```text
--base-url http://localhost:<cashierProxyPort>
--api-prefix /api
--flowable-base-url http://localhost:<cashierProxyPort>
--flowable-api-prefix /api
```

本地后端直连测试优先使用方式 A，避免代理端口、代理规则和主应用状态影响测试结果。

## 4.3 API 总览

| 脚本动作 | HTTP 方法 | 服务 | API 路径 | 用途 |
| --- | --- | --- | --- | --- |
| `create` | POST | bi-cashier | `/cashier/store/audit/onboarding/create` | 创建草稿 |
| `inspect` 详情 | POST | bi-cashier | `/cashier/store/audit/onboarding/{uniqueValue}/detail` | 查询本地状态和申请明细 |
| `inspect` 任务 | POST | bi-flowable | `/flowable/bpmn/process-instances/tasks?businessKey={uniqueValue}` | 查询当前 Flowable 任务 |
| `inspect` 日志 | POST | bi-flowable | `/flowable/bpmn/process-instances/audit-logs?businessKey={uniqueValue}` | 查询审批日志 |
| `update` | POST | bi-cashier | `/cashier/store/audit/onboarding/{uniqueValue}/update` | 回退到节点 1后修改申请 |
| `submit` | POST | bi-cashier | `/cashier/store/audit/onboarding/{uniqueValue}/submit` | 节点 1提交/重提 |
| `approve` | POST | bi-cashier | `/cashier/store/audit/onboarding/{uniqueValue}/approve` | 节点 2~8通过 |
| `reject` | POST | bi-cashier | `/cashier/store/audit/onboarding/{uniqueValue}/reject` | 回退到前置节点 |
| `save-node` | POST | bi-cashier | `/cashier/store/audit/onboarding/{uniqueValue}/nodes/{nodeCode}` | 节点 9/10保存并提交 |

所有成功响应的外层格式为：

```json
{
  "code": 0,
  "success": true,
  "message": "成功",
  "data": {}
}
```

`code` 不为 `0` 或 HTTP 状态码不是 2xx 时，脚本会直接报错并停止。

## 4.4 脚本文件清单

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `scripts/onboarding-flow.mjs` | Node.js 执行脚本 | 统一封装创建、查询、提交、审批、回退、节点 9/10 保存 |
| `scripts/onboarding-node9.example.json` | JSON 请求模板 | 节点 9字段示例；复测时必须替换真实 `applicationStoreId` |
| `scripts/onboarding-node10.example.json` | JSON 请求模板 | 节点 10字段示例；复测时必须替换真实 `applicationStoreId` 和测试账号 |
| `scripts/onboarding-create-test.json` | JSON 示例 | 普通成功链路创建参数示例；不得直接复用店铺唯一值 |
| `scripts/onboarding-reject-test.json` | JSON 示例 | 回退后编辑重提参数示例；不得直接复用店铺唯一值 |

文档中的 `<create.json>`、`<update.json>`、`<node9.json>`、`<node10.json>` 表示本次复测临时准备的 JSON 文件，不是固定文件名要求。每次测试应复制模板并生成新的业务唯一值。

## 4.5 脚本如何自动组装请求

`onboarding-flow.mjs` 的设计是“每个动作先读当前状态，再调用一次业务 API”：

1. `inspect`：调用出纳详情、Flowable 当前任务、Flowable 审批日志并汇总输出。
2. `create`：读取 `--body-file`，自动补一个新的 `idempotencyKey`，调用创建接口。
3. `update`：先读详情，自动使用详情中的 `version`，再合并更新 JSON调用更新接口。
4. `submit`：先读详情和任务，自动选择销售发起任务，使用当前 `version/taskId`调用提交接口。
5. `approve`：先读详情和任务，自动选择当前任务，使用当前 `version/taskId`调用审批接口。
6. `reject`：先读详情和任务，自动选择当前任务，组装目标节点和可选指定返回 activity ID。
7. `save-node`：先读详情和任务，自动补当前 `version/taskId/applicationStoreId`，调用节点 9/10保存接口。

脚本不会自动循环通过所有节点，也不会自动猜测下一步。每个节点都应单独调用并检查输出，防止在状态不一致时继续误操作。

## 4.6 脚本公共参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--base-url` | 是 | bi-cashier 地址，例如 `http://localhost:20335` |
| `--flowable-base-url` | 是 | bi-flowable 地址，例如 `http://localhost:20294` |
| `--username` | 是 | 登录账号；本测试为 `chenyanjun` |
| `--user-id` | 是 | 用户 ID；本测试为 `410958` |
| `--unique-value` | 除 create 外是 | 当前新申请返回的业务唯一值 |
| `--body-file` | create/update/save-node 是 | JSON 请求体文件 |
| `--version` | 建议填写 | 当前本地详情中的乐观锁版本 |
| `--task-id` | 可选 | 任务查询结果不明确时手动指定 taskId |
| `--comment` | 建议填写 | 审批或回退备注 |
| `--token` | 按环境 | 环境要求 Bearer token 时填写 |
| `--api-prefix` | 代理调用时 | 通过前端代理时填写 `/api` |
| `--flowable-api-prefix` | 代理调用时 | 通过代理访问 Flowable 时填写 `/api` |

## 5. 节点和 BPMN activity ID

| 节点号 | 业务节点 | Flowable 任务名称 | BPMN activity ID |
| --- | --- | --- | --- |
| 1 | 销售发起 | 销售发起 | `sid-EF12E43E-1060-4A6D-ACAD-30C364ACB1D1` |
| 2 | 资料组审核 | 资料组 | `sid-6206C986-FAD8-487F-9E30-F7090AA69BCE` |
| 3 | 运营审核 | 运营部 | `sid-DE20F8F1-3CED-420E-8939-33754C9CFE55` |
| 4 | 费用财务审核 | 费用财务 | `sid-79D42DC9-090D-46B4-9949-177DC109BA50` |
| 5 | 发票财务审核 | 发票财务 | `sid-D44ACC1B-9E4A-4428-997C-259F7DFA08E5` |
| 6 | 数据审核 | 数据部 | `sid-2045935C-542A-4BDB-9063-620BB0B19CFF` |
| 7 | 销售财务审核 | 销售财务 | `sid-02E28619-E3D8-45E0-A932-42A079CA5075` |
| 8 | 出纳审核 | 出纳 | `sid-484C4565-8B0D-4614-AAAD-9EA62C9ABE81` |
| 9 | 平台入驻 | 平台入驻跟进 | `sid-3FB7B4B9-61ED-48B5-9034-15108127A2F9` |
| 10 | 店铺搭建确认 | 店铺搭建确认 | `sid-BB402F08-3434-4057-9A85-48F39A4D4F72` |

回退到节点 1、返回指定节点 2 或节点 5 时，使用上表中的 activity ID，不使用中文节点名称替代。

## 6. 测试项 T01：创建草稿

### 6.1 目的

验证创建接口能写入主申请、店铺明细和节点准备资料，并返回节点 1 草稿状态。

### 6.2 请求

准备 JSON：

```json
{
  "departmentId": "121",
  "platform": "JD",
  "priority": "MEDIUM",
  "applyDate": "2026-08-19",
  "remark": "API flow test",
  "items": [
    {
      "rowNo": 1,
      "storeUniqueValue": "<本次唯一店铺值>",
      "storeCode": "<本次唯一店铺编码>",
      "storeName": "API流程测试店铺",
      "platform": "JD",
      "sourceCompanyUniqueValue": "<本次唯一主体值>",
      "sourceCompanyName": "API流程测试主体",
      "reason": "店铺上架流程验证",
      "remark": "test data"
    }
  ],
  "preparations": [
    {
      "rowNo": 1,
      "platformRuleReadDate": "2026-08-19",
      "materialCollectDate": "2026-08-19",
      "hasLicense": true,
      "hasIdCard": true,
      "hasIndustryPermit": false,
      "hasTrademark": false,
      "hasBrandAuth": false,
      "hasOtherMaterials": false,
      "materialAuditStatus": "OTHER",
      "prepResponsibleName": "chenyanjun",
      "prepRemark": "API流程测试"
    }
  ],
  "attachments": []
}
```

执行：

```powershell
node scripts/onboarding-flow.mjs create `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --body-file <create.json>
```

预期：

```text
status=DRAFT
version=0
currentNodeNo=1
currentNodeCode=SALES_INITIATE
processInstanceId=null
```

### 6.3 创建请求字段说明

| 字段 | 类型 | 必填/建议 | 说明 |
| --- | --- | --- | --- |
| `departmentId` | string | 必填 | 申请部门 ID；测试可使用当前测试环境可用部门值，本文示例为 `121` |
| `platform` | string | 必填 | 平台编码；示例为 `JD` |
| `priority` | string | 建议 | `HIGH`、`MEDIUM` 或 `LOW` |
| `applyDate` | string | 建议 | `yyyy-MM-dd` |
| `remark` | string | 可选 | 申请备注 |
| `items` | array | 必填 | 店铺明细；至少一行 |
| `items[].rowNo` | number | 建议 | 行号，从 `1` 开始 |
| `items[].storeUniqueValue` | string | 必填 | 本次新建的店铺唯一值，不能复用历史值 |
| `items[].storeCode` | string | 必填 | 本次新建的店铺编码，不能复用历史值 |
| `items[].storeName` | string | 必填 | 店铺名称 |
| `items[].sourceCompanyUniqueValue` | string | 建议 | 本次测试主体唯一值 |
| `items[].sourceCompanyName` | string | 建议 | 测试主体名称 |
| `items[].reason` | string | 建议 | 上架原因 |
| `items[].remark` | string | 可选 | 明细备注 |
| `preparations` | array | 建议 | 与 `items[].rowNo` 对应的准备资料 |
| `preparations[].rowNo` | number | 建议 | 对应店铺明细行号 |
| `preparations[].hasLicense` | boolean | 建议 | 是否有营业执照 |
| `preparations[].hasIdCard` | boolean | 建议 | 是否有身份证 |
| `preparations[].materialAuditStatus` | string | 建议 | 资料审核状态示例 `OTHER` |
| `attachments` | array | 可选 | 没有附件时传空数组 |

创建成功后必须保存命令输出中的以下值到本次测试记录：

```text
data.uniqueValue
data.requestNo
data.version
```

然后调用 `inspect` 获取真实店铺明细 ID：

```text
state.applicationStoreIds[0]
```

后续节点 9/10 的 `applicationStoreId` 必须使用这个值。

## 7. 测试项 T02：节点 1 销售发起提交

### 7.1 目的

验证节点 1 不依赖固定候选用户，任意登录用户可通过销售发起提交。

### 7.2 请求

```powershell
node scripts/onboarding-flow.mjs submit `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue> `
  --version 0 `
  --comment "节点1提交"
```

预期：

```text
status=IN_PROGRESS
currentNodeNo=2
currentNodeCode=MATERIAL_GROUP_REVIEW
```

同时通过 `inspect` 验证 Flowable 当前任务名称为“资料组”。

注意：历史运行中曾出现 Flowable 已完成节点 1但返回结果缺少下一节点字段的情况。此时先执行 `inspect`，如果当前任务已经是“资料组”，不要重复办理节点 1；使用相同版本再次调用 `submit` 仅用于让出纳服务按当前任务同步本地状态。

### 7.3 提交请求字段

脚本最终发送的业务请求体为：

```json
{
  "version": 0,
  "idempotencyKey": "<脚本自动生成UUID>",
  "taskId": "<脚本从Flowable任务读取>",
  "comment": "节点1提交"
}
```

节点 1是开放节点，脚本仍然发送 `username/userId` 请求头用于建立登录上下文，但不依赖 BPMN 候选人配置。

## 8. 测试项 T03：节点 2~8 审批通过

### 8.1 目的

验证节点 2~8 的候选人权限、任务完成和本地节点推进。

### 8.2 通用步骤

每个节点都执行：

1. `inspect` 读取本地 `version` 和 Flowable `taskId`。
2. 确认当前任务名称与预期节点一致。
3. 调用 `approve`，传入当前版本。
4. 检查响应中的下一节点、版本和处理人。

### 8.3 节点审批命令

```powershell
node scripts/onboarding-flow.mjs approve `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue> `
  --version <当前version> `
  --comment "节点2通过"
```

节点 3~8只替换版本和备注：

```text
节点3通过
节点4通过
节点5通过
节点6通过
节点7通过
节点8通过
```

预期节点顺序：

```text
2 资料组
3 运营部
4 费用财务
5 发票财务
6 数据部
7 销售财务
8 出纳
9 平台入驻跟进
```

节点 2~8 的 Flowable 任务候选人应包含：

```text
chenyanjun
chenyanjun1
```

### 8.4 审批请求字段

脚本最终发送的业务请求体为：

```json
{
  "version": "<inspect返回的当前version>",
  "idempotencyKey": "<脚本自动生成UUID>",
  "taskId": "<inspect返回的当前任务id>",
  "comment": "节点N通过"
}
```

节点 2~8必须使用当前任务的 `taskId` 和当前详情的 `version`。不要手写历史 taskId，不要跨节点复用 version。

## 9. 测试项 T04：节点 8 → 节点 9 状态同步

### 9.1 目的

验证节点 8 完成后，即使 Flowable 完成响应缺少下一节点字段，也能通过当前活跃任务识别节点 9并同步本地状态。

### 9.2 检查方式

节点 8审批返回异常或本地未推进时，立即执行：

```powershell
node scripts/onboarding-flow.mjs inspect `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue>
```

若结果为：

```text
本地 currentNodeNo=8
Flowable 当前任务=平台入驻跟进
```

不要重复审批节点 8。重启加载最新出纳服务后，调用节点 9保存接口，节点 8→9 对账逻辑会先同步本地状态。

## 10. 测试项 T05：节点 9 保存并提交

### 10.1 请求文件

```json
{
  "items": [
    {
      "applicationStoreId": <真实applicationStoreId>,
      "fields": {
        "platformSubmitDate": "2026-08-19",
        "platformAuditProgress": "IN_PROGRESS",
        "platformAuditResult": "IN_PROGRESS",
        "depositStatus": "PENDING"
      }
    }
  ]
}
```

真实 `applicationStoreId` 必须从详情或创建数据返回值读取，不能使用 `0`。

节点 9完整请求体还会由脚本自动补充：

```json
{
  "version": "<当前version>",
  "idempotencyKey": "<脚本自动生成UUID>",
  "saveMode": "SAVE_AND_SUBMIT",
  "taskId": "<当前节点9任务id>",
  "items": [
    {
      "applicationStoreId": "<inspect得到的真实店铺ID>",
      "fields": {
        "platformSubmitDate": "yyyy-MM-dd",
        "platformAuditProgress": "IN_PROGRESS",
        "platformAuditResult": "IN_PROGRESS",
        "depositStatus": "PENDING"
      }
    }
  ]
}
```

### 10.2 执行

```powershell
node scripts/onboarding-flow.mjs save-node `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue> `
  --node-code PLATFORM_ONBOARDING `
  --body-file <node9.json>
```

预期：

```text
status=IN_BUILDING
currentNodeNo=10
currentNodeCode=STORE_BUILD_CONFIRM
```

节点 9属于开放节点，不依赖 `chenyanjun` 候选权限。

## 11. 测试项 T06：节点 10 保存并完成

### 11.1 请求文件

```json
{
  "items": [
    {
      "applicationStoreId": <真实applicationStoreId>,
      "fields": {
        "baseInfoSetupDate": "2026-08-19",
        "trialOpsResult": "通过",
        "consumerProtection": "已开通"
      },
      "mainAccount": {
        "account": "<测试主账号>",
        "password": "<测试主账号密码>"
      },
      "subAccounts": []
    }
  ]
}
```

### 11.2 执行

```powershell
node scripts/onboarding-flow.mjs save-node `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue> `
  --node-code STORE_BUILD_CONFIRM `
  --body-file <node10.json>
```

预期：

```text
status=COMPLETED
currentNodeNo=10
processEnded=true
Flowable当前任务=[]
```

节点 10属于开放节点，不依赖 `chenyanjun` 候选权限。

节点 10完整请求体还会由脚本自动补充：

```json
{
  "version": "<当前version>",
  "idempotencyKey": "<脚本自动生成UUID>",
  "saveMode": "SAVE_AND_SUBMIT",
  "taskId": "<当前节点10任务id>",
  "items": [
    {
      "applicationStoreId": "<inspect得到的真实店铺ID>",
      "fields": {
        "baseInfoSetupDate": "yyyy-MM-dd",
        "trialOpsResult": "通过",
        "consumerProtection": "已开通"
      },
      "mainAccount": {
        "account": "<测试主账号>",
        "password": "<测试主账号密码>"
      },
      "subAccounts": []
    }
  ]
}
```

## 12. 测试项 T07/T08：节点 3 回退到节点 1并重新提交

### 12.1 路径

```text
节点1提交 → 节点2通过 → 节点3回退节点1
→ 节点1编辑/重新提交 → 节点2继续
```

### 12.2 回退命令

```powershell
node scripts/onboarding-flow.mjs reject `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue> `
  --version <节点3当前version> `
  --target-node-no 1 `
  --comment "节点3退回节点1"
```

预期：

```text
status=REJECTED
currentNodeNo=1
currentNodeCode=SALES_INITIATE
```

回退后通过 `update` 修改数据：

```powershell
node scripts/onboarding-flow.mjs update `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <uniqueValue> `
  --body-file <update.json>
```

再使用当前版本调用 `submit`，预期重新进入节点 2。

## 13. 测试项 T09：回退节点 1后从头全通过

### 13.1 测试路径

```text
节点1通过
节点2通过
节点3回退节点1
节点1重新提交
节点2重新通过
节点3通过
节点4通过
节点5通过
节点6通过
节点7通过
节点8通过
节点9提交
节点10提交
```

### 13.2 预期结果

```text
status=COMPLETED
currentNodeNo=10
version=按本次实际操作次数递增
processEnded=true
Flowable当前任务=[]
```

审批日志确认包含：

```text
运营部 → 退回至销售发起
销售发起 → 重新提交
资料组 → 重提后通过
```

## 14. 测试项 T10：回退节点 1后返回指定节点 2

### 14.1 回退命令

```powershell
node scripts/onboarding-flow.mjs reject `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <场景T10新建申请返回的uniqueValue> `
  --version 2 `
  --target-node-no 1 `
  --return-directly false `
  --return-to-activity-id sid-6206C986-FAD8-487F-9E30-F7090AA69BCE `
  --comment "节点3退回节点1并指定返回节点2"
```

### 14.2 预期结果

节点 1重新提交后，Flowable 当前任务为“资料组”，本地同步后：

```text
status=IN_PROGRESS
currentNodeNo=2
currentNodeCode=MATERIAL_GROUP_REVIEW
```

继续通过节点 2~8 后，预期状态为：

```text
status=PENDING_PLATFORM
currentNodeNo=9
version=按本次实际操作次数递增
processEnded=false
```

验证“节点 1重新通过后返回指定节点 2”及后续继续推进。

## 15. 测试项 T11：节点 6 回退节点 1后返回指定节点 5

### 15.1 测试路径

```text
节点1 → 节点2 → 节点3 → 节点4 → 节点5 → 节点6
节点6回退节点1
节点1重新通过并返回指定节点5
节点5通过
节点6通过
节点7通过
节点8通过
```

### 15.2 回退命令

```powershell
node scripts/onboarding-flow.mjs reject `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value <场景T11新建申请返回的uniqueValue> `
  --version 5 `
  --target-node-no 1 `
  --return-directly false `
  --return-to-activity-id sid-D44ACC1B-9E4A-4428-997C-259F7DFA08E5 `
  --comment "节点6回退节点1并指定返回节点5"
```

### 15.3 预期结果

节点 1重新提交后：

```text
status=IN_PROGRESS
currentNodeNo=5
currentNodeCode=INVOICE_FINANCE_REVIEW
version=按本次实际操作次数递增
Flowable当前任务=发票财务
```

随后节点 5~8继续通过，当前状态为：

```text
status=PENDING_PLATFORM
currentNodeNo=9
version=按本次实际操作次数递增
processEnded=false
```

验证“节点 6回退节点 1，节点 1通过后返回指定节点 5，再继续后续节点”。

## 16. 测试结果判断标准

每个测试项不能只看 HTTP 返回成功，还必须同时检查：

1. 本地申请 `status`。
2. 本地 `currentNodeNo/currentNodeCode/currentNodeName`。
3. 本地 `version` 是否按一次业务推进增加 1。
4. Flowable 当前任务名称和 taskId。
5. Flowable 当前任务候选人或办理人。
6. 审批日志的节点、结果、操作人、回退目标和备注。
7. 节点 9/10 的业务数据是否写入。
8. 完成场景必须确认 Flowable 当前任务为空且 `processEnded=true`。

## 17. 复测注意事项

### 17.1 必须使用新申请

每次复测创建申请时，应生成新的：

```text
storeUniqueValue
storeCode
sourceCompanyUniqueValue
```

不要复用本文历史执行过程中出现过的任何 `requestNo`、`uniqueValue`、`storeUniqueValue`、`storeCode`、`applicationStoreId` 或流程实例。不要直接继续操作旧的中间状态申请。

### 17.2 每一步都读取状态

不要连续盲目发送多个审批请求。每次请求后执行 `inspect`，以实际返回的 `version`、taskId 和节点名称作为下一步输入。

### 17.3 发现返回结果无效时

如果返回：

```text
上架销售发起任务完成结果无效
无法识别上架审批后的 Flowable 节点
```

先执行 `inspect`：

- 如果 Flowable 当前任务已进入下一节点，说明远端可能已完成，不要重复提交；使用当前版本执行一次同步动作。
- 如果 Flowable 当前任务仍是原节点，才继续排查，不要重复使用新的幂等键盲目重试。

### 17.4 节点 9/10 数据

节点 9和节点 10请求中的 `applicationStoreId` 必须来自当前申请详情，不能使用示例文件中的 `0`。

### 17.5 BPMN 和服务重启

- 不要为了测试修改 BPMN 文件。
- 修改 `bi-cashier` 业务代码后必须重启 `bi-cashier`。
- 修改 `bi-flowable` 后必须重启 `bi-flowable`。
- 重启后重新读取两个服务的动态端口。

## 18. 复测记录要求

每次按本文执行后，在测试报告中记录本次新建申请返回的：

```text
requestNo
uniqueValue
applicationStoreId
processInstanceId
```

这些值只属于本次测试记录，不回填到本文的固定步骤中，也不作为下一次测试输入。

## 19. 本次测试涉及的代码行为

本次验证过程中确认的业务规则：

1. 节点 1、9、10是开放节点，不依赖固定候选人。
2. 节点 2~8按 Flowable 配置的候选用户校验，当前测试用户为 `chenyanjun`。
3. 节点 9/10通过 `save-node`保存数据并提交。
4. 回退请求的 `targetNodeNo`表示本地业务目标节点。
5. `returnToActivityId`表示 Flowable 回退后重新通过时要返回的指定 BPMN activity。
6. 回退到节点 1后，节点 1重新提交可能出现 Flowable已完成但响应缺少下一节点字段的情况，必须以 `inspect`读取的当前任务为准。

## 20. 从零开始直接执行清单

以下清单适用于成功链路和回退链路。每次执行都必须使用新建申请，不使用历史值。

### 20.1 准备环境

```powershell
Set-Location "D:/OB/ob_web/packages/micro/cashier"

# 读取当前 bi-cashier 端口，范围来自 bi-cashier-web/bootstrap.yml
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 20334 -and $_.LocalPort -le 20344 } |
  Select-Object LocalPort, OwningProcess

# 读取当前 bi-flowable 端口，范围来自 bi-flowable-web/bootstrap.yml
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 20292 -and $_.LocalPort -le 20300 } |
  Select-Object LocalPort, OwningProcess

$cashier = "http://localhost:<读取到的bi-cashier端口>"
$flowable = "http://localhost:<读取到的bi-flowable端口>"
$user = "chenyanjun"
$userId = "410958"
```

确认脚本可运行：

```powershell
node --check scripts/onboarding-flow.mjs
node scripts/onboarding-flow.mjs help
```

### 20.2 创建本次新申请

复制第 6 节 JSON，至少替换：

```text
items[0].storeUniqueValue
items[0].storeCode
items[0].sourceCompanyUniqueValue
```

建议值使用带时间戳或随机后缀的新值，例如：

```text
storeUniqueValue=api-retest-store-<yyyyMMddHHmmss>
storeCode=APIRETEST<yyyyMMddHHmmss>
sourceCompanyUniqueValue=api-retest-company-<yyyyMMddHHmmss>
```

执行创建：

```powershell
node scripts/onboarding-flow.mjs create `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --body-file <本次create.json>
```

从输出保存：

```text
$uniqueValue = data.uniqueValue
$requestNo = data.requestNo
```

PowerShell 不建议直接把 JSON 嵌套字段当变量自动传递；可以手工复制输出值，或记录到测试报告。

### 20.3 查询详情和真实店铺 ID

```powershell
node scripts/onboarding-flow.mjs inspect `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value $uniqueValue
```

从输出保存：

```text
state.version
state.applicationStoreIds[0]
```

后续命令中的 `<version>` 和 `<applicationStoreId>` 全部来自最近一次状态输出。

### 20.4 成功链路

依次执行：

```text
submit
approve 节点2
approve 节点3
approve 节点4
approve 节点5
approve 节点6
approve 节点7
approve 节点8
save-node PLATFORM_ONBOARDING
save-node STORE_BUILD_CONFIRM
```

每一步执行后都运行一次 `inspect`，确认当前节点和 version，再执行下一步。

### 20.5 回退到节点 1后从头继续

先按成功链路执行到节点 3或更后节点，然后：

```text
reject --target-node-no 1
inspect
update
submit
inspect
```

确认重新进入节点 2后，再继续 `approve` 到节点 8及 `save-node` 节点 9/10。

### 20.6 回退到节点 1后返回指定节点

回退请求必须同时传：

```text
--target-node-no 1
--return-directly false
--return-to-activity-id <目标返回节点的BPMN activity ID>
```

节点 5的示例：

```powershell
node scripts/onboarding-flow.mjs reject `
  --base-url $cashier `
  --flowable-base-url $flowable `
  --username $user `
  --user-id $userId `
  --unique-value $uniqueValue `
  --version <节点6当前version> `
  --target-node-no 1 `
  --return-directly false `
  --return-to-activity-id sid-D44ACC1B-9E4A-4428-997C-259F7DFA08E5 `
  --comment "节点6回退节点1并返回节点5"
```

随后执行：

```text
inspect
submit
inspect
```

预期节点 1重新提交后，Flowable 当前任务为节点 5“发票财务”。确认后继续通过节点 5、6、7、8。

### 20.7 每步输出必须记录

复测报告至少记录以下内容：

```text
测试项编号
本次requestNo
本次uniqueValue
applicationStoreId
调用时间
调用脚本命令
调用时version
调用时taskId
返回status
返回currentNodeNo/currentNodeCode
Flowable当前任务
审批日志新增记录
是否通过
异常信息和处理方式
```
