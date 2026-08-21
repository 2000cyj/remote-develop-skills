# 店铺下架流程 Orca 真实测试记录

## 1. 文档目的

本文记录店铺下架流程通过 Orca 内置浏览器完成真实登录、申请查询和审批操作的测试项、操作步骤、验证条件和异常处理方法。

后续复测必须创建或使用一条**全新的测试申请**，以实际页面显示的申请编号和 URL 中的 `uniqueValue` 作为本次测试变量。本文第 11 节中的历史申请仅用于说明本次已验证结果，不能作为下一次测试输入。

本文不通过数据库修改状态，不伪造审批请求，不跳过真实 Flowable 任务。

## 2. 测试范围

### 2.1 已测试功能

| 编号 | 测试项 | 状态 |
| --- | --- | --- |
| T01 | 登录后查询指定店铺下架申请 | 通过 |
| T02 | 销售发起提交后进入资料组意见 | 通过 |
| T03 | 资料组意见审批通过并进入运营部意见 | 通过 |
| T04 | 运营部意见审批通过并进入费用财务意见 | 通过 |
| T05 | 费用财务意见审批通过并进入发票财务意见 | 通过 |
| T06 | 发票财务意见审批通过并进入数据部意见 | 通过 |
| T07 | 数据部意见审批通过并进入销售财务意见 | 通过 |
| T08 | 销售财务意见审批通过并进入出纳意见 | 通过 |
| T09 | 出纳意见审批通过并结束 Flowable 流程 | 通过 |
| T10 | 节点 8 完成后本地业务状态同步为已完成 | 通过 |
| T11 | 审核记录完整包含节点 1~8 | 通过 |
| T12 | 最终页面不显示审批按钮且显示流程已结束 | 通过 |

### 2.2 已知历史异常

| 编号 | 场景 | 结论 |
| --- | --- | --- |
| H01 | Flowable 已完成出纳意见，业务表仍停留在数据部意见 | 已定位并修复后端状态同步逻辑 |
| H02 | 历史异常申请刷新后自动补写完成状态 | 不支持；旧流程不会重新进入 `approve()`，必须用新申请验证 |
| H03 | 刷新时登录会话失效 | 页面跳转登录页，重新登录后继续 |

### 2.3 尚未覆盖

| 编号 | 未测试项 |
| --- | --- |
| U01 | 不同审批用户的候选人权限组合 |
| U02 | 退回到销售发起后编辑并重新提交的完整 Orca 复测 |
| U03 | 节点 3~8 退回到各个前置节点的全部组合 |
| U04 | 重复点击、重复请求、相同幂等键和并发审批 |
| U05 | 多店铺明细的完整下架完成副作用 |
| U06 | 附件上传、删除和审批后审计记录验证 |
| U07 | 节点审批失败、Flowable 服务异常和网络超时场景 |
| U08 | 不同角色登录后从待办列表执行审批 |

## 3. 测试环境

### 3.1 服务

| 服务 | 端口说明 |
| --- | --- |
| 前端 cashier micro | `http://localhost:8080` |
| bi-cashier | 配置范围 `20334~20344`，每次启动随机端口 |
| bi-cashier management | 固定端口 `20345` |

配置文件：

```text
D:/OB/bi-FOB/bi-cashier/bi-cashier-web/src/main/resources/bootstrap.yml
```

配置内容：

```yaml
server:
  port: ${random.int[20334,20344]}
management:
  server:
    port: 20345
```

复测时以实际监听端口为准，不要使用历史端口。

### 3.2 测试账号

| 参数 | 说明 |
| --- | --- |
| 登录方式 | 通过主应用登录页面登录 |
| 测试用户 | 使用当前登录用户；本次为 `chenyanjun` |
| 浏览器 | Orca 内置浏览器 |
| 前端代理 | `/api` |

本文不记录密码、token 或其他敏感凭证。

### 3.3 端口读取

PowerShell：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 20334 -and $_.LocalPort -le 20345 } |
  Select-Object LocalPort,OwningProcess |
  Sort-Object LocalPort
```

输出中随机端口是业务端口，`20345` 是管理端口。后端重启后必须重新读取。

## 4. Orca 通用操作规范

### 4.1 Orca 状态

```powershell
orca status --json
orca tab list --json
```

确认当前页面：

```powershell
orca eval --expression "JSON.stringify({url:location.href,body:document.body.innerText.slice(0,4000)})" --json
```

### 4.2 操作循环

所有页面操作必须遵循：

```text
snapshot -> 操作 -> wait networkidle -> 重新读取页面
```

页面导航、刷新和异步更新后，旧的 `@eN` 引用可能失效。推荐使用按按钮文字查找的 `orca eval` 脚本；如果使用 snapshot 引用，操作后必须重新 snapshot。

等待页面请求：

```powershell
orca wait --load networkidle --json
```

### 4.3 登录会话

如果页面 URL 变为：

```text
http://localhost:8080/login
```

说明登录会话已失效。重新登录后，不要重复提交已经成功的审批，先重新查询申请详情确认当前节点。

## 5. API 和页面边界

本测试文档使用 Orca 页面操作，不直接调用业务 API。页面请求由前端自动完成：

| 页面动作 | 主要请求 |
| --- | --- |
| 打开详情 | `/api/cashier/store/audit/offboarding/{uniqueValue}/detail` |
| 查询当前任务 | `/api/flowable/bpmn/process-instances/tasks?businessKey={uniqueValue}` |
| 查询审核记录 | `/api/flowable/bpmn/process-instances/audit-logs?businessKey={uniqueValue}` |
| 审批通过 | `/api/cashier/store/audit/offboarding/{uniqueValue}/approve` |
| 页面刷新 | 重新查询详情、任务和审核记录 |

如果需要调试接口，应优先通过页面行为触发请求，不要在 Orca 中手动构造未经授权的请求。浏览器页面中的 `fetch` 直接调用可能缺少主应用认证头并返回 `401`，这不代表页面自身请求失败。

## 6. 审批节点和预期流转

| 节点号 | 页面节点 | 期望动作 | 下一节点 |
| --- | --- | --- | --- |
| 1 | 销售发起 | 新建并提交申请 | 资料组意见 |
| 2 | 资料组意见 | 通过 | 运营部意见 |
| 3 | 运营部意见 | 通过 | 费用财务意见 |
| 4 | 费用财务意见 | 通过 | 发票财务意见 |
| 5 | 发票财务意见 | 通过 | 数据部意见 |
| 6 | 数据部意见 | 通过 | 销售财务意见 |
| 7 | 销售财务意见 | 通过 | 出纳意见 |
| 8 | 出纳意见 | 通过并结束流程 | 流程已结束 |

正常完成后的业务详情必须为：

```text
状态：已完成
当前节点：流程已结束
```

## 7. 测试项 T01：查询新申请

### 7.1 目的

验证登录会话有效，并能通过申请编号定位本次新建的测试申请。

### 7.2 前置条件

- 已登录主应用。
- 已创建一条新的店铺下架申请。
- 已记录申请编号。
- 申请不是历史已完成申请，也不是其他测试正在使用的申请。

### 7.3 操作

在列表页执行以下脚本，将 `<申请编号>` 替换为本次新申请编号：

```powershell
orca eval --expression "(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.placeholder==='申请编号');if(!i)return 'not-found';i.value='<申请编号>';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return 'filled'})()" --json
orca eval --expression "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='查询');if(!b)return 'not-found';b.click();return 'clicked'})()" --json
orca wait --load networkidle --json
```

点击结果中的查看按钮：

```powershell
orca eval --expression "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='查看');if(!b)return 'not-found';b.click();return 'clicked'})()" --json
orca wait --load networkidle --json
```

### 7.4 预期结果

详情页包含：

```text
申请编号：本次申请编号
状态：审核中
当前节点：资料组意见
```

若当前节点不是资料组意见，停止连续审批，记录实际节点后再决定下一步。

## 8. 测试项 T02：节点 2~7 审批通过

### 8.1 目的

验证节点 2~7 的真实任务通过、节点推进、审核日志写入和页面状态刷新。

### 8.2 通用通过脚本

在详情页执行：

```powershell
orca eval --expression "(()=>{const i=[...document.querySelectorAll('input,textarea')].find(x=>x.placeholder==='请输入审批意见');if(i){i.value='节点通过';i.dispatchEvent(new Event('input',{bubbles:true}));}const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='通过');if(!b)return 'not-found';b.click();return 'clicked'})()" --json
orca wait --load networkidle --json
orca eval --expression "JSON.stringify({node:document.body.innerText.match(/当前节点：[^\\n]+/)?.[0],status:document.body.innerText.match(/状态\\s*\\n[^\\n]+/)?.[0],success:document.body.innerText.includes('操作成功'),failed:document.body.innerText.includes('请求失败'),tail:document.body.innerText.slice(-500)})" --json
```

### 8.3 单节点检查

每次只能通过当前页面显示的一个节点。每次操作后必须确认：

1. 页面出现 `操作成功`。
2. 当前节点移动到预期下一节点。
3. 审核记录新增一条“通过”记录。
4. 页面没有 `请求失败`。
5. 未发生登录跳转。

### 8.4 节点推进记录

| 当前节点 | 操作备注 | 预期下一节点 | 实际结果 | 是否正常 |
| --- | --- | --- | --- | --- |
| 资料组意见 | 节点通过 | 运营部意见 |  |  |
| 运营部意见 | 节点通过 | 费用财务意见 |  |  |
| 费用财务意见 | 节点通过 | 发票财务意见 |  |  |
| 发票财务意见 | 节点通过 | 数据部意见 |  |  |
| 数据部意见 | 节点通过 | 销售财务意见 |  |  |
| 销售财务意见 | 节点通过 | 出纳意见 |  |  |

不要连续快速点击多个节点。必须等待上一请求完成后再读取当前节点。

## 9. 测试项 T03：节点 8 完成流程

### 9.1 目的

验证最后节点完成时，Flowable 结束状态能够正确同步到本地业务申请。

### 9.2 前置条件

详情页必须显示：

```text
当前节点：出纳意见
状态：审核中
```

### 9.3 操作

最后节点使用明确备注：

```text
节点8完成验证
```

```powershell
orca eval --expression "(()=>{const i=[...document.querySelectorAll('input,textarea')].find(x=>x.placeholder==='请输入审批意见');if(i){i.value='节点8完成验证';i.dispatchEvent(new Event('input',{bubbles:true}));}const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='通过');if(!b)return 'not-found';b.click();return 'clicked'})()" --json
orca wait --load networkidle --json
orca eval --expression "JSON.stringify({node:document.body.innerText.match(/当前节点：[^\\n]+/)?.[0],status:document.body.innerText.match(/状态\\s*\\n[^\\n]+/)?.[0],ended:document.body.innerText.includes('流程已结束'),operationSuccess:document.body.innerText.includes('操作成功'),failed:document.body.innerText.includes('请求失败'),tail:document.body.innerText.slice(-600)})" --json
```

### 9.4 预期结果

以下条件必须全部满足：

```text
node 包含：当前节点：流程已结束
status 包含：状态：已完成
ended = true
operationSuccess = true
failed = false
```

审核记录最后一条应为：

```text
出纳意见 / 通过 / 节点8完成验证
```

## 10. 测试项 T04：刷新和详情一致性

### 10.1 目的

验证页面刷新后，详情、本地状态和审核记录保持一致，不出现 Flowable 已结束但业务详情仍为审批中的情况。

### 10.2 操作

```powershell
orca eval --expression "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='刷新');if(!b)return 'not-found';b.click();return 'clicked'})()" --json
orca wait --load networkidle --json
orca eval --expression "JSON.stringify({url:location.href,node:document.body.innerText.match(/当前节点：[^\\n]+/)?.[0],status:document.body.innerText.match(/状态\\s*\\n[^\\n]+/)?.[0],ended:document.body.innerText.includes('流程已结束'),failed:document.body.innerText.includes('请求失败')})" --json
```

### 10.3 预期结果

刷新前后均应显示：

```text
状态：已完成
当前节点：流程已结束
```

页面不应再显示“通过”“不通过”“退回”等审批按钮，只保留刷新或返回列表操作。

## 11. 本次真实测试记录

本节只记录已经完成的历史测试，不作为下一次固定测试数据。

### 11.1 测试申请

```text
申请编号：OFF-20260820-362D3299
内部 uniqueValue：3db51c74e47f4245b3530e0a5aab3f8e
店铺：AL0420103阿里拼多多兰诗哲个护旗舰店
店铺状态：准备注销
下架原因：222222
```

### 11.2 节点结果

| 节点 | 结果 | 备注 |
| --- | --- | --- |
| 销售发起 | 通过 | 提交下架申请 |
| 资料组意见 | 通过 | 节点通过 |
| 运营部意见 | 通过 | 节点通过 |
| 费用财务意见 | 通过 | 节点通过 |
| 发票财务意见 | 通过 | 节点通过 |
| 数据部意见 | 通过 | 节点通过 |
| 销售财务意见 | 通过 | 节点通过 |
| 出纳意见 | 通过 | 节点8完成验证 |

### 11.3 最终结果

```text
当前节点：流程已结束
状态：已完成
操作成功
Flowable processEnded = true
```

## 12. 后端问题、修复和验证

### 12.1 历史问题

历史申请 `OFF-20260819-A4C890AB` 曾出现：

```text
Flowable 审核记录已到出纳意见
业务详情仍为审核中 / 数据部意见
```

### 12.2 根因

下架后端原来只依赖业务表 `currentNodeNo == 8` 判断最后节点。业务表节点号与 Flowable 实际节点发生错位时，节点 8完成分支不会执行。

### 12.3 修复范围

修复文件：

```text
D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/OffboardingManageServiceImpl.java
```

完成判断同时支持：

```java
fromNodeNo == 8 || flowResult.getProcessEnded() == true
```

Flowable 结束时，后端会：

- 执行下架完成副作用。
- 将业务状态写为 `COMPLETED`。
- 将当前节点固定写为节点 8。
- 写入完成时间。
- 清空当前处理人。

回归测试文件：

```text
D:/OB/bi-FOB/bi-cashier/bi-cashier-service/src/test/java/com/obo/bi/cashier/service/impl/OffboardingUpdateAndSubmitSourceContractTest.java
```

定向测试结果：

```text
6 tests completed
0 failures
```

### 12.4 历史申请限制

已经在修复前完成 Flowable 操作的历史申请不会重新进入后端 `approve()`，刷新不会自动补写业务状态。验证修复必须创建新申请并真实通过节点 8，不能直接修改数据库。

## 13. 测试结果判断标准

每个节点不能只看页面按钮点击成功，还必须检查：

1. 当前业务状态。
2. 当前节点名称。
3. 审核记录是否新增。
4. 下一节点是否正确。
5. 页面是否显示 `操作成功`。
6. 页面是否出现 `请求失败`。
7. 登录会话是否仍然有效。

最后节点必须额外确认：

1. 状态为 `已完成`。
2. 当前节点为 `流程已结束`。
3. 审核记录包含节点 1~8。
4. 最后一条记录为“出纳意见 / 通过”。
5. 页面不再显示审批按钮。
6. Flowable `processEnded=true`。

## 14. 常见问题排查

### 14.1 页面显示请求失败

先确认 URL：

```powershell
orca eval --expression "JSON.stringify({url:location.href,body:document.body.innerText.slice(-500)})" --json
```

如果 URL 是 `/login`，重新登录即可。

如果仍在详情页：

1. 确认后端是否刚刚重启。
2. 重新读取 `20334~20344` 的实际业务端口和 PID。
3. 点击刷新并等待 `networkidle`。
4. 重新读取详情、当前节点和审核记录。

### 14.2 刷新后状态仍为审批中

先确认是否使用了修复前已经完成 Flowable 的历史申请。历史申请不会自动重放审批逻辑。使用新申请重新跑节点 8，不要重复点击历史申请。

### 14.3 点击通过后节点没有移动

检查：

- 是否等待了 `networkidle`。
- 当前用户是否是当前任务处理人。
- 页面是否存在多个“通过”按钮。
- 是否继续使用了刷新前的旧元素引用。
- 页面是否出现后端具体错误提示。

重新执行 `orca snapshot --json`，或者使用按按钮文字查找的脚本。

### 14.4 Orca runtime unavailable

执行：

```powershell
orca status --json
orca tab list --json
```

如果 Orca 恢复，重新读取当前 URL 和页面内容。不要重复提交已经显示“操作成功”的节点；先确认审核记录是否已有该节点。

### 14.5 后端重启后验证旧申请

后端重启只加载新代码，不会自动修复旧申请数据。必须使用新申请验证新逻辑。

## 15. 复测报告模板

```markdown
# 店铺下架流程测试报告

- 测试日期：
- 测试人：
- 前端地址：http://localhost:8080
- bi-cashier 业务端口：
- bi-cashier 进程 PID：
- 申请编号：
- uniqueValue：
- 店铺编码：

## 节点结果

| 节点 | 结果 | 时间 | 备注 |
| --- | --- | --- | --- |
| 销售发起 |  |  |  |
| 资料组意见 |  |  |  |
| 运营部意见 |  |  |  |
| 费用财务意见 |  |  |  |
| 发票财务意见 |  |  |  |
| 数据部意见 |  |  |  |
| 销售财务意见 |  |  |  |
| 出纳意见 |  |  |  |

## 最终验收

- [ ] 状态为“已完成”
- [ ] 当前节点为“流程已结束”
- [ ] 审核记录包含节点 1~8
- [ ] 最后一条审核记录为“出纳意见 / 通过”
- [ ] 页面显示“操作成功”
- [ ] 页面没有“请求失败”
- [ ] 页面不再显示审批按钮
- [ ] Flowable `processEnded=true`
```

## 16. 从零开始执行清单

### 16.1 准备环境

```powershell
Set-Location "D:/OB/ob_web/packages/micro/cashier"

orca status --json
orca tab list --json

Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 20334 -and $_.LocalPort -le 20345 } |
  Select-Object LocalPort,OwningProcess |
  Sort-Object LocalPort
```

确认：

- 前端地址为 `http://localhost:8080`。
- Orca 页面已登录。
- bi-cashier 有实际业务端口监听。
- 不是直接继续操作历史异常申请。

### 16.2 定位新申请

1. 记录新申请编号。
2. 在列表页按申请编号查询。
3. 点击对应的查看按钮。
4. 记录详情 URL 中的 `uniqueValue`。
5. 确认当前节点后再继续。

### 16.3 执行节点 2~7

对每个节点重复：

1. 读取当前节点。
2. 填写审批意见。
3. 点击通过。
4. 等待 `networkidle`。
5. 检查操作成功、下一节点和审核记录。

### 16.4 执行节点 8

1. 确认当前节点为出纳意见。
2. 填写 `节点8完成验证`。
3. 点击通过。
4. 等待 `networkidle`。
5. 检查状态已完成、流程已结束和 `processEnded=true`。

### 16.5 形成报告

将本次新申请的申请编号、uniqueValue、业务端口、PID、各节点时间和最终页面结果填入第 15 节模板。不要把本次业务唯一值改写到本文固定步骤中。
