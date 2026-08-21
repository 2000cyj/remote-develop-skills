# 入驻流程申请部门选择设计

## 背景与目标

`/child/cashier/dpsjlc/insert` 当前将“申请部门”作为自由文本输入，但申请单的 `applyDepartment` 数据库字段语义是字符串部门 ID。创建流程还会忽略前端值，改为从当前登录员工资料派生部门。

本次将申请部门改为部门字典下拉，并使创建与更新均持久化前端提交的字符串部门 ID。对外请求字段统一为 `departmentId`；服务层将它映射至现有实体和数据库字段 `applyDepartment`。后端仅允许提交当前用户拥有管理权限的部门 ID，避免跨部门伪造。

## 范围

纳入范围：

- cashier 前端入驻流程申请页的申请部门选择、校验与测试。
- `bi-cashier` 入驻流程创建和更新 DTO、服务逻辑及测试。

明确排除：

- 数据库迁移：`onboarding_application.apply_department` 已是 `VARCHAR(64)`。
- 修改其他审核流程的部门派生行为。
- 改变现有路由、权限码、接口 URL 或 HTTP 方法。
- 新增或修改 `applyDepartmentName` 快照字段。

## 前端设计

### 数据来源与模型

申请页继续使用 `form.departmentId: string`。选项来源为 `CASHIER_BELONGS_DEPARTMENT.options`，每个选项的 `value` 为字符串 `one_id`，`label` 为部门中文名称。

在 `src/pages/storeAuditGrounding/addOrEdit/index.vue` 中：

- 导入 `CASHIER_BELONGS_DEPARTMENT`。
- 将 `formItems` 的 `departmentId` 从 `input` 改为 `select`。
- 配置 `placeholder: "请选择申请部门"`、`options: CASHIER_BELONGS_DEPARTMENT.options`、`filterable: true`、`span: 12`。
- 保持 `form.departmentId` 为字符串；详情返回的 `applyDepartment` 字符串 ID 加载到该字段以直接回显。
- 将必填校验改为 `trigger: "change"`，提示改为“请选择申请部门”。

`buildOnboardingSavePayload()` 将 `form.departmentId` 放入 `AuditApplicationSaveDTO.departmentId`；不再向创建/更新请求发送 `applyDepartment`。

### 用户结果

用户在新增或编辑页从中文部门名称中选择一个部门。提交请求携带所选字符串 ID，例如 `"D001"`；页面不再接受自由输入的部门名称或任意文本。

## 后端设计

### API 契约

在以下 DTO 中增加同名字段：

```java
private String departmentId;
```

- `bi-cashier-api/.../dto/OnboardingCreateDTO.java`
- `bi-cashier-api/.../dto/OnboardingUpdateDTO.java`

字段名为 `departmentId`，JSON 类型为字符串部门 ID。服务层将 `dto.getDepartmentId()` 映射至实体 `OnboardingApplication.applyDepartment`。无需修改 Controller URL、方法或服务接口签名。

### 创建数据流

`OnboardingManageServiceImpl.create(OnboardingCreateDTO dto)`：

1. 校验 `dto.getDepartmentId()` 非空白。
2. 查询当前用户在 `TwoLevelEnum.DPGL` 下可管理的部门 ID 集合。
3. 若该集合不包含请求部门 ID，拒绝请求。
4. 将 `dto.getDepartmentId()` 赋给 `OnboardingApplication.applyDepartment`。
5. 不再调用 `commonManageService.getCurrentCashierDepartment()` 作为创建申请部门来源。

### 更新数据流

`OnboardingManageServiceImpl.update(String uniqueValue, OnboardingUpdateDTO dto)` 在既有可编辑状态、版本与申请单权限校验之后：

1. 校验 `dto.getDepartmentId()` 非空白。
2. 校验该字符串 ID 位于当前用户的 `DPGL` 部门管理权限集合。
3. 将该值写入 `application.setApplyDepartment(dto.getDepartmentId())`，再执行现有实体更新。

实体 `OnboardingApplication`、Mapper 接口、Mapper XML 和数据库字段均已支持 `applyDepartment`，不作改动。

### 安全与错误处理

前端下拉是体验控制，不视作授权边界。后端每次创建或更新均以当前会话的可管理部门 ID 集合校验请求值。空白值与未授权部门均走项目现有业务异常机制；不回退到当前员工所属部门，也不静默替换请求值。

## 测试与验收

### 前端

在 `tests/storeAuditGrounding/contracts.test.ts` 添加源级回归断言：

- 申请部门表单项为 `select`。
- 选项使用 `CASHIER_BELONGS_DEPARTMENT.options`。
- 表单仍提交字符串 `applyDepartment`，例如 `"D001"`。

执行：

```bash
pnpm test tests/storeAuditGrounding/contracts.test.ts
pnpm build
```

### 后端

增加覆盖创建和更新服务逻辑的测试：

- 创建会写入前端提供且有权限的字符串部门 ID。
- 更新会替换为前端提供且有权限的字符串部门 ID。
- 创建与更新均拒绝空白部门 ID。
- 创建与更新均拒绝当前用户无管理权限的部门 ID。
- 创建不再调用 `getCurrentCashierDepartment()`。
- 既有乐观锁、状态与申请单权限控制保持有效。

后端验证使用 IntelliJ 编译/测试运行配置；该仓库的 CLI 编译存在 Lombok 与 SkyWalking 依赖环境限制。

## 成功标准

1. 前端“申请部门”只允许从 `CASHIER_BELONGS_DEPARTMENT` 选择，提交值为字符串部门 ID。
2. 后端创建和更新均以该字符串 ID 为准并持久化。
3. 后端拒绝空白和无管理权限的部门 ID。
4. 前端定向 Vitest 测试与生产构建通过；后端目标测试和 IntelliJ 编译通过。
