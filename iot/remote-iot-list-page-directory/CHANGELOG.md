# CHANGELOG

事故记录只放这里。**SKILL.md 与 references/ 只保留当前有效规则**，不再复盘。

## 2026-10-20 —— 从 remote-cashier-list-page-directory 派生 IoT 前端版（v1）

本 skill 由 `remote-cashier-list-page-directory`（cashier 微应用前端版）复制改造而来，**只保留前端代码写法**。

### 裁掉的内容（有意为之，不要在 IoT 版里加回来）

| 裁掉项 | 原位置 | 原因 |
|---|---|---|
| **CSS 原子类相关规则** | `02-audit-page-compliance.md` 检查 10（顶栏原子类容器 class 提取成 `PAGE_HEADER_CLASSES`）、`04-shared-vs-private.md` 模式 5（顶栏 header 配置 → config/）、`file-responsibilities.md` 里 `addOrEdit/config/` 的「顶栏 UI 资源」职责 | iot-web 的样式写法按 `iot-web/STYLE_GUIDE.md`（UnoCSS 原子类），本 skill 不管样式类名的抽取与复用 |
| **share 包组件复用** | `12-prefer-share-package-components.md`（整份删除）、`02-audit-page-compliance.md` 检查 14、`07-quick-reference.md` 的目标 12 行与第 8 条提醒、`SKILL.md` 硬约束第 8 条 | iot-web 没有 share 包，组件来源只有 `iot-web/src/components/` |
| **主子应用（qiankun）父子体系** | 各文件里的「主应用 / 微应用 / `@/common/*` 公共层」表述 | iot-web 是独立前端工程，没有父子系统；`@/common/*` 一律映射为 iot-web 自己的公共层（`src/utils/` / `src/api/` / `src/components/`） |
| **后端相关联动** | `06-product-boundary.md` 末尾与 `remote-cashier-java-standard` 的关系段、`11-must-use-remote-ts-es-check.md` 里「改了 Java 后端代码」一行 | 本 skill 只管前端；后端走 `remote-iot-java` |

### 改造点

- 目录根从 `src/pages/` 改为 `src/views/`（iot-web 的页面根）。
- 项目路径从 `D:/OB/ob_web/packages/micro/cashier` 改为 `C:/Users/20614/orca/simple-iot/iot-web`。
- 组件写法示例从 share 的 `ListPageLayout` / `PageVxeTable` / `DynamicForm` / `renderDialog` 换成 iot-web 的 `useTable` / `IotTable` / `el-form` / `el-dialog`。
- `SKILL.md` 增加「适用范围（只管前端代码写法）」表 + 「iot-web 现状对照」表。

### 保留的规范（与源 skill 一致，仍是现行规则）

1. **逐文件 read 审查，不用 grep**（事故 1）。
2. **声明种类 → 归属目录** 表为唯一真源，命名不影响归属（事故 1、5）。
3. **computed 纯数据抽 config，值当参数传，禁止传 `Ref` / `Reactive` 容器**（事故 2）。
4. **建枚举前先查公共层**（事故 3）。
5. **禁转发别名 const / alias import**，模板直接用导出原名（事故 7）。
6. **搬动任何字面量值前 `git show HEAD:<file>` 拿原值**，不一致就停并问 user（数据搬运事故）。
7. **reference 编号唯一**，playbook 统一用 90/ 编号（事故 6）。

---

## 维护流程（必读）

改这个 skill 时：

1. **先改真源**。规范正文只写在对应 `references/NN-*.md` 里；`SKILL.md` 和 `07-quick-reference.md` 只放**链接**，不复制正文。
2. **改完跑自检**：`bash scripts/check-duplication.sh`（查重复编号 + 查入口文件膨胀 + 查 02 残留命令 + 查断链）。
3. **commit + push**，然后在消费端 worktree 里 `git pull`，让 `.pi/git/.../remote-develop-skills/` 副本跟上。
4. **新事故写这里**，不要往 SKILL.md 追加复盘段——那会把速查表挤出行窗口。
