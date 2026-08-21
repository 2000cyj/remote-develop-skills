# 前后端代码 Bug 快速分析总览

**日期**：2026-08-05  
**范围**：`packages/micro/cashier` 前端工作区 + `D:\OB\bi-FOB\bi-cashier` 后端工作区  
**性质**：只做检查，不修改业务代码  
**报告目录**：`D:\OB\ob_web\packages\micro\cashier\docs\bug\2026-08-05-pre-commit-check\`

---

## 1. 执行状态

| 序号 | 报告 | 范围 | 状态 |
|---|---|---|---|
| 01 | [`01-frontend-core.md`](./01-frontend-core.md) | scripts / router / dictionary / RemoteSearchSelect | 已完成 |
| 02 | [`02-frontend-pages-A.md`](./02-frontend-pages-A.md) | bankCard / employee / seal | 已完成 |
| 03 | [`03-frontend-pages-B.md`](./03-frontend-pages-B.md) | company / store | 已完成 |
| 04 | [`04-frontend-fileExpiration.md`](./04-frontend-fileExpiration.md) | fileExpiration / ruleManagement | 已完成 |
| 05 | [`05-backend-bicashier.md`](./05-backend-bicashier.md) | 后端 bi-cashier | 已完成 |

> 注：原后端 agent 因 429 Token Plan 用量上限失败，后端报告由主流程继续用只读方式补扫完成；未运行 `mvn` / `gradle`，未修改后端代码。

---

## 2. 严重度概览

| 范围 | 🔴 高 | 🟡 中 | 🟢 低 | 备注 |
|---|---:|---:|---:|---|
| 前端核心 / scripts | 1 | 4 | 7 | 重点是 share-dev-server 路径错误 |
| bankCard / employee / seal | 0 | 6 | 10 | 重点是 bankCard 新增成功提示校验、seal 文件清理等中风险项 |
| company / store | 0 | 3 | 2 | 重点是 company 表单提交类型一致性 |
| fileExpiration | 4 | 5 | 5 | 类型分裂、死 API、日期计算等 |
| 后端 bi-cashier | 5 | 14 | 11 | 数据权限、事务、文件记录一致性、导出敏感字段等 |
| **合计** | **10** | **32** | **35** | 人工复查建议优先看 🔴 |

---

## 3. 建议优先人工复查 / 修复的 P0 问题

### P0-1：前端 dev 模式 `/share/*` 资源路径错误

- 报告：[`01-frontend-core.md`](./01-frontend-core.md)
- 位置：`scripts/share-dev-server.mjs:18-20`
- 问题：`SHARE_DIST` 指向 `packages/micro/cashier/packages/share/dist`，实际应为 `packages/share/dist`。
- 影响：dev 模式 `/share/*` 全部 404，页面可能空白。

### P0-2：fileExpiration 规则类型前后不一致、父级 API 与后端契约不一致

- 报告：[`04-frontend-fileExpiration.md`](./04-frontend-fileExpiration.md)
- 位置：
  - `src/pages/fileExpiration/apis/type.ts:72-88`
  - `src/pages/fileExpiration/ruleManagement/apis/type.ts:19-36`
  - `src/pages/fileExpiration/apis/index.ts:91-142`
- 问题：父级用 `uniqueId` / `reminderDays: number[]`，ruleManagement / 后端实际用 `uniqueValue` / `reminderDays: string[]`；父级 6 个规则 API 是死代码且部分 URL 错。
- 影响：短期可能不触发，后续复用父级 API 时会出现接口调用失败或字段绑定错误。

### P0-4：后端公司数据权限被临时硬编码放行

- 报告：[`05-backend-bicashier.md`](./05-backend-bicashier.md)
- 位置：
  - `bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/CompanyManageServiceImpl.java:167-169`
  - `bi-cashier-component/src/main/java/com/obo/bi/cashier/service/impl/CompanyServiceImpl.java` 多处 `TODO 临时`
- 问题：强制 `dto.setQueryNullDepartment(true)`，并在权限 SQL 中无条件 OR `department_id_list IS NULL OR department_id_list = ''`。
- 影响：无权限用户也可能查到部门为空的公司，属于数据权限风险。

### P0-5：后端银行卡新增缺事务

- 报告：[`05-backend-bicashier.md`](./05-backend-bicashier.md)
- 位置：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:271-285`
- 问题：`addBankCard` 写主表、文件到期记录、自定义标签、bi-file 文件，但缺 `@Transactional`。
- 影响：中途失败会留下半成功数据。

### P0-6：后端删除银行卡不清理文件到期记录

- 报告：[`05-backend-bicashier.md`](./05-backend-bicashier.md)
- 位置：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/BankCardManageServiceImpl.java:471-493`
- 问题：只软删银行卡主表，不清理 `cashier_file_expiry_record` 中三类银行卡文件记录。
- 影响：文件到期列表会留下悬空引用，来源实体已删除但记录仍存在。

### P0-7：后端经营范围删除只校验父节点，未校验子节点引用

- 报告：[`05-backend-bicashier.md`](./05-backend-bicashier.md)
- 位置：`bi-cashier-service/src/main/java/com/obo/bi/cashier/service/impl/OperatingScopeManageServiceImpl.java:131-162`
- 问题：删除父节点时只检查父节点是否被公司引用，递归删除子节点时不检查子节点引用。
- 影响：可能把仍被公司引用的子经营范围逻辑删除，造成关联数据不一致。

---

## 4. 其他值得优先看的中风险点

1. `RemoteSearchSelect` 未在 unmount 清理 debounce timer，请求失败静默吞错。见 `01-frontend-core.md`。
2. `bankCard` 新增分支缺 `res.code` 校验，失败也弹“新增成功”。见 `02-frontend-pages-A.md`。
3. `seal` 删除原图时电子印章文件删除逻辑被注释，文件服务可能累积孤儿。见 `02-frontend-pages-A.md`。
4. `company/editOrCheck.vue` 股东 `ratio` 与注册资本等字段新增/编辑提交类型不一致。见 `03-frontend-pages-B.md`。
5. `fileExpiration/utils/getDaysRemaining` 在 UTC- 时区日期可能偏移 1 天。见 `04-frontend-fileExpiration.md`。
6. 后端 `EmployeeManageServiceImpl.exportCashierEmployee` 漏敏感字段权限 ThreadLocal 设置，导出身份证权限行为与公司/店铺不一致。见 `05-backend-bicashier.md`。
7. 后端 `PostMapping + @RequestParam` 多处与前端 JSON body 约定不一致，需结合前端 HTTP 封装确认。见 `05-backend-bicashier.md`。
8. 后端文件到期记录按 `source_unique_value` 删除 / 查询时部分方法缺 `source_module` 过滤，存在跨模块误删/误匹配隐患。见 `05-backend-bicashier.md`。

---

## 5. 人工复查建议顺序

1. **先看前端 P0**：`share-dev-server`、`employee reloadDetail`，这几项改动小、收益高。
2. **再看 fileExpiration 类型/API 收敛**：先决定规则 API 是统一放父级还是 ruleManagement 内部维护，避免两套类型继续 drift。
3. **后端先核对权限逻辑**：尤其 `CompanyManageServiceImpl` / `CompanyServiceImpl` 中 `TODO 临时` 是否允许上线。
4. **后端事务与清理一致性**：`addBankCard`、`deleteBankCard`、`deleteOperatingScope` 建议提交前修。
5. **最后处理低优先级一致性**：命名、注释、DTO 风格、导出 VO 包结构等。

---

## 6. 已确认的限制

- 本轮只做代码角度快速分析，未启动前端、未跑浏览器、未跑后端编译。
- 后端未执行 Maven / Gradle，符合本项目“bi-FOB 只能 IntelliJ 编译”的既有约束。
- 报告中的后端部分包含若干需要产品/权限策略确认的项，建议人工复查后再决定是否修复。
