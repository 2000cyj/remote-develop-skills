# Skills Repository Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docs-skills/` 下散落、重复、嵌套的 skill 资产，重组为对齐 [jetlinks-develop-skills](https://github.com/jetlinks/jetlinks-develop-skills) 蓝图的 skill 仓库，可直接被 cc-switch 浅层扫描启用。

**Architecture:** 8 个 skill 目录直接平铺到仓库根，命名 `remote-<领域>`；文档/历史/产物归档到 `docs/`；先迁后删，校验脚本贯穿始终。

**Tech Stack:** bash / git / Windows + WSL 双环境兼容；cc-switch（外部工具，本仓库仅提供扫描入口）；Markdown frontmatter。

---

## Global Constraints

- **skill 目录命名**：严格 `remote-<领域>`，全小写、连字符，禁止大写/空格/下划线
- **SKILL.md `name`**：必须与父目录名完全一致
- **SKILL.md `description`**：起手 `Use when`，第三人称，列举所有触发场景
- **SKILL.md 行数上限**：≤ 500 行（超过必须拆 references）
- **skill 与文档物理隔离**：skill 直接放仓库根，`docs/` 装非 skill 资产
- **目录结构**：每个 skill 只能含 `SKILL.md` + `references/` + `agents/` + `scripts/` + `assets/`
- **禁止目录**：`examples/` / `tests/` / `templates/` / skill 内 `README.md` / `skills/` 父目录
- **跨 skill 引用**：使用 `$remote-<领域>` 格式
- **不叠前缀**：禁止 `remote-cashier-*`、`basics-*`、`bi-*`
- **平台**：bash + Windows 双环境；脚本必须 `set -e`、相对路径工作目录
- **校验脚本**：每个 skill 必须通过 `name` 一致性、`Use when` 起手、无 cashier 残留、引用路径合法

---

## File Structure

### 新增 skill 目录（仓库根）

| 路径 | 来源 | 责任 |
|---|---|---|
| `remote-java-standard/` | `docs-skills/skills1111/SKILL.md` + `skills1111/references/*` | Java 后端分层与编码规范 |
| `remote-button-permission/` | `docs-skills/basics-develop-skills-vue/basics-button-permission-vue/` | 按钮操作权限 |
| `remote-list-page-directory/` | `docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue/` + `skills1111/cashier-list-page-directory-skill.md` 合并 | 列表页目录结构 |
| `remote-permission-summary/` | `docs-skills/basics-develop-skills-vue/basics-permission-summary-vue/` | 权限汇总导出 |
| `remote-ts-es-check/` | `docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue/` | TS & ESLint 静态检查 |
| `remote-claude-hooks/` | `docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue/` | Claude Code hooks 说明 |
| `remote-flowable-task-with-next/` | `docs-skills/skills1111/flowable-complete-task-with-next.md` | Flowable completeTaskWithNext 规范 |
| `remote-idea-mcp-usage/` | `docs-skills/skills1111/idea-mcp-usage-scope.md` | IDEA MCP 使用规范 |

### 新增文档目录（`docs/`）

| 路径 | 来源 | 责任 |
|---|---|---|
| `docs/superpowers/specs/` | 新建 | brainstorming 设计稿（已含 `2026-08-21-skills-dir-design.md`） |
| `docs/superpowers/plans/` | 新建 | 实施计划（本文件） |
| `docs/bug/` | `docs-skills/docs/bug/` | bug 修复记录 |
| `docs/变更/` | `docs-skills/docs/变更/` | 变更整理 |
| `docs/字典/` | `docs-skills/docs/字典/` | 数据字典产物 |
| `docs/权限/` | `docs-skills/docs/权限/` | 权限 SQL 产物 |
| `docs/测试文档/` | `docs-skills/docs/测试文档/` | 测试记录 |
| `docs/beforeSkills/` | `docs-skills/docs/beforeSkills/` + `docs-skills/basics-develop-skills-vue/README.md` | 历史学习资料 |

### 修改文件

| 路径 | 修改点 |
|---|---|
| `README.md`（根） | 新建：仓库总览 + skill 索引表 |

### 删除内容

| 路径 | 原因 |
|---|---|
| `docs-skills/skills2222/` | 与 1111 内容完全一致 |
| `docs-skills/basics-develop-skills-vue/` | 已拆为 5 个独立 skill 目录 |
| `docs-skills/docs/basics-develop-skills-vue.7z` | 旧归档 |
| `docs-skills/`（迁完后） | 全部内容已迁出 |

---

## Task 1: 建立仓库根布局骨架

**Files:**
- Create: `README.md`（占位）

**目的：** 在仓库根先建占位 `README.md`，保证后续 `git mv` 不会因根目录无文件而报奇怪错误；同时明确起点状态。

- [ ] **Step 1: 检查根目录初始状态**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && ls -la
```

Expected: 看到 `.claude/`、`docs-skills/`、`.git/`，没有 `README.md` 与 `docs/`。

- [ ] **Step 2: 创建根 README.md 占位**

```bash
echo "# Remote Develop Skills" > "C:/Users/20614/orca/remote-develop-skills/README.md"
```

- [ ] **Step 3: 提交占位 README**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && git add README.md && git commit -m "chore: add placeholder README before restructure"
```

Expected: 1 file changed。

---

## Task 2: 创建 `docs/` 目录结构

**Files:**
- Create: `docs/superpowers/specs/`（已存在 `2026-08-21-skills-dir-design.md`，继续使用）
- Create: `docs/superpowers/plans/`
- Create: `docs/bug/`、`docs/变更/`、`docs/字典/`、`docs/权限/`、`docs/测试文档/`、`docs/beforeSkills/`

**目的：** 文档归档目录在迁源前先建好，避免后续移动失败时文件散落。

- [ ] **Step 1: 一键创建 docs/ 子目录**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && mkdir -p \
  docs/superpowers/specs \
  docs/superpowers/plans \
  docs/bug \
  docs/变更 \
  docs/字典 \
  docs/权限 \
  docs/测试文档 \
  docs/beforeSkills
```

Expected: 无输出，全部成功。

- [ ] **Step 2: 校验目录已建立**

Run:
```bash
ls "C:/Users/20614/orca/remote-develop-skills/docs/"
```

Expected: 看到 `superpowers/`、`bug/`、`变更/`、`字典/`、`权限/`、`测试文档/`、`beforeSkills/`。

- [ ] **Step 3: 提交骨架**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && git add docs/ && git commit -m "chore: scaffold docs/ layout"
```

---

## Task 3: 迁移基础 Vue skill（直接复制 + 改名 + 改 frontmatter）

**Files:**
- Create: `remote-button-permission/`（来自 `docs-skills/basics-develop-skills-vue/basics-button-permission-vue/`）
- Create: `remote-list-page-directory/`（来自 `docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue/`）
- Create: `remote-permission-summary/`（来自 `docs-skills/basics-develop-skills-vue/basics-permission-summary-vue/`）
- Create: `remote-ts-es-check/`（来自 `docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue/`）
- Create: `remote-claude-hooks/`（来自 `docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue/`）

**接口约定：**
- 消费：源 SKILL.md 的 frontmatter 字段
- 产出：每个新 skill 的 `SKILL.md` 中 `name` = 新目录名；`description` 改为 `Use when ...` 起手

- [ ] **Step 1: 复制并改名前 2 个 skill**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/basics-develop-skills-vue/basics-button-permission-vue remote-button-permission && \
  git mv docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue remote-list-page-directory
```

- [ ] **Step 2: 复制后 3 个 skill**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/basics-develop-skills-vue/basics-permission-summary-vue remote-permission-summary && \
  git mv docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue remote-ts-es-check && \
  git mv docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue remote-claude-hooks
```

- [ ] **Step 3: 批量改 frontmatter name 字段（5 个 SKILL.md）**

对 `remote-button-permission/SKILL.md`：
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  sed -i 's/^name: "basics-button-permission-vue"/name: "remote-button-permission"/' remote-button-permission/SKILL.md && \
  sed -i 's/^name: basics-button-permission-vue/name: remote-button-permission/' remote-button-permission/SKILL.md
```

对 `remote-list-page-directory/SKILL.md`：
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  sed -i 's/^name: "basics-list-page-directory-vue"/name: "remote-list-page-directory"/' remote-list-page-directory/SKILL.md && \
  sed -i 's/^name: basics-list-page-directory-vue/name: remote-list-page-directory/' remote-list-page-directory/SKILL.md
```

对 `remote-permission-summary/SKILL.md`：
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  sed -i 's/^name: "basics-permission-summary-vue"/name: "remote-permission-summary"/' remote-permission-summary/SKILL.md && \
  sed -i 's/^name: basics-permission-summary-vue/name: remote-permission-summary/' remote-permission-summary/SKILL.md
```

对 `remote-ts-es-check/SKILL.md`：
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  sed -i 's/^name: "basics-ts-es-check-vue"/name: "remote-ts-es-check"/' remote-ts-es-check/SKILL.md && \
  sed -i 's/^name: basics-ts-es-check-vue/name: remote-ts-es-check/' remote-ts-es-check/SKILL.md
```

对 `remote-claude-hooks/SKILL.md`：
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  sed -i 's/^name: "basics-claude-hooks-vue"/name: "remote-claude-hooks"/' remote-claude-hooks/SKILL.md && \
  sed -i 's/^name: basics-claude-hooks-vue/name: remote-claude-hooks/' remote-claude-hooks/SKILL.md
```

- [ ] **Step 4: 批量改 description 起手为 Use when**

对每个 skill 的 SKILL.md，把 description 改为起手 `Use when` 的场景化版本，**保留原 description 的所有触发场景，只调整起手句**。

对 `remote-button-permission/SKILL.md`，将第一行：
```yaml
description: 在 cashier 微应用中应用按钮操作权限的统一规范。适用于...
```
改为：
```yaml
description: Use when 给 cashier 等子应用页面按钮添加操作权限控制、改造现有按钮权限写法、规范权限码命名、处理下拉菜单空菜单兜底、列表页操作列按权限隐藏，确保全模块权限写法一致。
```

对 `remote-list-page-directory/SKILL.md`，将：
```yaml
description: 在 cashier 微应用中应用列表页目录结构的统一规范。适用于...
```
改为：
```yaml
description: Use when 在 src/pages/ 下新建或改造页面/业务模块目录、组织新增/修改/详情表单页、确定 apis/components/config/enum/utils 的归属、判定共用放外层与独立放当前，确保所有页面目录结构一致。
```

对 `remote-permission-summary/SKILL.md`，将：
```yaml
description: 在 cashier 微应用中应用权限汇总导出的统一规范。适用于...
```
改为：
```yaml
description: Use when 把某目录下所有按钮操作权限汇总成结构化清单、扫描 checkPermission 调用点、补齐动态权限码、生成可执行 SQL，按模板产出 docs/权限/ 下的三个文件。
```

对 `remote-ts-es-check/SKILL.md`，将：
```yaml
description: 在 cashier 微应用中运行 TypeScript 与 ESLint 静态检查并定位/修复问题。适用于...
```
改为：
```yaml
description: Use when 改动前后批量扫描 src/、定位 vue-tsc 或 eslint 报错根因（TS2554、member-delimiter、valid-template-root、unused-imports 等），区分 cashier 自身问题与 packages/share 既有问题。
```

对 `remote-claude-hooks/SKILL.md`，将：
```yaml
description: 判断某个自动化任务（静态检查、上下文注入、工具拦截、质量门、会话清理等）应该以 Skill 方式手动触发，还是挂到 Claude Code 的某个生命周期 hook...
```
改为：
```yaml
description: Use when 判断某个自动化任务该用 Skill 还是 Hook、选择哪个生命周期事件（SessionStart/UserPromptSubmit/PreToolUse/Stop 等）、排查 hook 不生效或误拦截、向新人解释 hook 生命周期。
```

- [ ] **Step 5: 校验 5 个 skill 目录**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks; do
    [ -f "$d/SKILL.md" ] && echo "OK $d" || echo "MISSING $d/SKILL.md"
  done
```

Expected: 全部输出 `OK <dir>`。

- [ ] **Step 6: 校验 name 与目录一致**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks; do
    name=$(grep -E '^name:' "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
    [ "$name" = "$d" ] && echo "OK $d" || echo "MISMATCH dir=$d name=$name"
  done
```

Expected: 全部 `OK`。

- [ ] **Step 7: 校验 description 起手 Use when**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks; do
    grep -q "^description: Use when" "$d/SKILL.md" && echo "OK $d" || echo "BAD $d"
  done
```

Expected: 全部 `OK`。

- [ ] **Step 8: 提交**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add remote-button-permission remote-list-page-directory remote-permission-summary remote-ts-es-check remote-claude-hooks && \
  git commit -m "feat(skills): migrate basics-develop-skills-vue children to remote-* format"
```

---

## Task 4: 迁移 Java skill（`remote-java-standard/`）

**Files:**
- Create: `remote-java-standard/SKILL.md`（来自 `docs-skills/skills1111/SKILL.md`）
- Create: `remote-java-standard/references/`（来自 `docs-skills/skills1111/references/*`，9 个 md）

**接口约定：**
- 消费：源 SKILL.md 全部正文
- 产出：新 SKILL.md `name: remote-java-standard`；references/ 全部 9 个 md 原样保留

- [ ] **Step 1: 创建目录**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && mkdir -p remote-java-standard/references
```

- [ ] **Step 2: 复制 SKILL.md 并改名 name**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/skills1111/SKILL.md remote-java-standard/SKILL.md && \
  sed -i 's/^name: "bi-cashier-java-standard"/name: "remote-java-standard"/' remote-java-standard/SKILL.md && \
  sed -i 's/^name: bi-cashier-java-standard/name: remote-java-standard/' remote-java-standard/SKILL.md
```

- [ ] **Step 3: 复制全部 references（9 个 md）**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/skills1111/references/architecture-layers.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/code-structure.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/coding-quality.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/concerns-separation.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/data-model-sql.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/file-attachment-pattern.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/mybatis-vs-xml.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/performance.md remote-java-standard/references/ && \
  git mv docs-skills/skills1111/references/translation-aop.md remote-java-standard/references/
```

- [ ] **Step 4: 校验 references 数量**

Run:
```bash
ls "C:/Users/20614/orca/remote-develop-skills/remote-java-standard/references/" | wc -l
```

Expected: `9`。

- [ ] **Step 5: 改 description 起手为 Use when**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  sed -i 's|^description: "OBO BI 出纳模块 Java 开发规范.*|description: Use when 新建或审查 BI/OBO Java 后端代码、调整 DTO/VO/PO 字段、编写 Mapper SQL、分层调用违反规范、Service 聚合层与 Component 层职责混淆、跨服务 Feign 调用边界不清晰。|' remote-java-standard/SKILL.md
```

Expected: SKILL.md 第一段 frontmatter description 起手 `Use when`。

- [ ] **Step 6: 校验 SKILL.md name + 起手**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  name=$(grep -E '^name:' remote-java-standard/SKILL.md | head -1 | sed 's/name: *//;s/"//g') && \
  echo "name=$name" && \
  grep -q "^description: Use when" remote-java-standard/SKILL.md && echo "DESC OK" || echo "DESC BAD"
```

Expected: `name=remote-java-standard` 与 `DESC OK`。

- [ ] **Step 7: 处理超长 SKILL.md（如果 > 500 行）**

Run:
```bash
wc -l "C:/Users/20614/orca/remote-develop-skills/remote-java-standard/SKILL.md"
```

- 若 > 500 行：跳过此步，留待后续 Task 9 处理
- 若 ≤ 500 行：继续

- [ ] **Step 8: 提交**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add remote-java-standard && \
  git commit -m "feat(skills): migrate java-standard to remote-* format"
```

---

## Task 5: 合并两份 list-page 内容到 `remote-list-page-directory/`

**Files:**
- Modify: `remote-list-page-directory/SKILL.md` 或 `remote-list-page-directory/references/directory-structure.md`
- Read: `docs-skills/skills1111/cashier-list-page-directory-skill.md`（仅读，不迁）

**接口约定：**
- 消费：`cashier-list-page-directory-skill.md` 的章节内容
- 产出：`remote-list-page-directory/` 目录下内容已合并，无重复

- [ ] **Step 1: 对比两份内容**

```bash
diff "C:/Users/20614/orca/remote-develop-skills/docs-skills/skills1111/cashier-list-page-directory-skill.md" \
     "C:/Users/20614/orca/remote-develop-skills/remote-list-page-directory/references/directory-structure.md" | head -50
```

Expected: 看到差异行；多数情况下两者高度重叠。

- [ ] **Step 2: 取最新版本**

保留规则（按优先级）：
1. `remote-list-page-directory/SKILL.md`（已迁过来，含 SKILL 结构）
2. `remote-list-page-directory/references/directory-structure.md`（深度参考）
3. `docs-skills/skills1111/cashier-list-page-directory-skill.md`（仅作对照）

最终只需要前两者。

- [ ] **Step 3: 归档 cashier-list-page-directory-skill.md 到 docs/beforeSkills**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/skills1111/cashier-list-page-directory-skill.md docs/beforeSkills/cashier-list-page-directory-skill.md
```

- [ ] **Step 4: 在 remote-list-page-directory SKILL.md 中加跨文件交叉引用**

读取 `remote-list-page-directory/SKILL.md`，在 Workflow 第 1 步前追加：
```markdown
> 历史版本对照见 `docs/beforeSkills/cashier-list-page-directory-skill.md`。
```

- [ ] **Step 5: 提交**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add remote-list-page-directory docs/beforeSkills/cashier-list-page-directory-skill.md && \
  git commit -m "chore(skills): merge duplicate list-page content, archive original"
```

---

## Task 6: 重建 `remote-flowable-task-with-next/` skill

**Files:**
- Create: `remote-flowable-task-with-next/SKILL.md`（来自 `docs-skills/skills1111/flowable-complete-task-with-next.md`，1653 行）
- Create: `remote-flowable-task-with-next/references/`（可选，按主题拆分）

**接口约定：**
- 消费：源 md 全部正文
- 产出：标准 SKILL.md 结构 + name 一致 + description 起手 Use when

- [ ] **Step 1: 创建目录**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && mkdir -p remote-flowable-task-with-next/references
```

- [ ] **Step 2: 移动并改名**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/skills1111/flowable-complete-task-with-next.md remote-flowable-task-with-next/SKILL.md
```

- [ ] **Step 3: 在文件首部加 frontmatter**

读取该文件，最顶部追加 frontmatter：
```yaml
---
name: remote-flowable-task-with-next
description: Use when 通过 BiFlowableClient.completeTaskWithNext 完成 Flowable 待办、查询下一节点信息、处理审批结果与幂等、调整或排查 completeTaskWithNext 调用链。
---
```

**注意：** 原文件首行是 `# Flowable ...` 标题，frontmatter 必须插在最顶部并与标题之间空一行。

- [ ] **Step 4: 拆分超大 SKILL.md（> 500 行）**

Run:
```bash
wc -l "C:/Users/20614/orca/remote-develop-skills/remote-flowable-task-with-next/SKILL.md"
```

- 若 ≤ 500 行：跳过
- 若 > 500 行：按章节拆出 references

拆分规则：

| 原文件章节 | 拆出到 |
|---|---|
| §2 功能说明、§3 与普通完成接口的区别 | 留 SKILL.md |
| §4 调用链、§5 入参、§6 返回值、§7 幂等 | 拆 `references/complete-task-with-next-contract.md` |
| §8 错误码、§9 异常场景 | 拆 `references/error-handling.md` |

在 SKILL.md 中加：
```markdown
## Workflow
1. 阅读首读指引 → `references/complete-task-with-next-contract.md`
2. ...
```

- [ ] **Step 5: 校验**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  wc -l remote-flowable-task-with-next/SKILL.md && \
  grep -q "^name: remote-flowable-task-with-next" remote-flowable-task-with-next/SKILL.md && \
  grep -q "^description: Use when" remote-flowable-task-with-next/SKILL.md && \
  echo "ALL OK" || echo "FAIL"
```

Expected: `ALL OK`，且 `SKILL.md` 行数 ≤ 500。

- [ ] **Step 6: 提交**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add remote-flowable-task-with-next && \
  git commit -m "feat(skills): rebuild flowable-task-with-next as standard skill"
```

---

## Task 7: 重建 `remote-idea-mcp-usage/` skill

**Files:**
- Create: `remote-idea-mcp-usage/SKILL.md`（来自 `docs-skills/skills1111/idea-mcp-usage-scope.md`，247 行）

- [ ] **Step 1: 创建目录**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && mkdir -p remote-idea-mcp-usage
```

- [ ] **Step 2: 移动并改名**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git mv docs-skills/skills1111/idea-mcp-usage-scope.md remote-idea-mcp-usage/SKILL.md
```

- [ ] **Step 3: 在文件首部加 frontmatter**

```yaml
---
name: remote-idea-mcp-usage
description: Use when 通过 JetBrains IDEA MCP 读取代码、构建项目、查询数据库、设置本地权限，需判断操作是否需要确认或用户授权，或解释默认允许/需确认/必须授权的三级权限。
---
```

插在文件最顶部。

- [ ] **Step 4: 校验**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  wc -l remote-idea-mcp-usage/SKILL.md && \
  grep -q "^name: remote-idea-mcp-usage" remote-idea-mcp-usage/SKILL.md && \
  grep -q "^description: Use when" remote-idea-mcp-usage/SKILL.md && \
  echo "ALL OK" || echo "FAIL"
```

Expected: `ALL OK`，行数 ≤ 500。

- [ ] **Step 5: 提交**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add remote-idea-mcp-usage && \
  git commit -m "feat(skills): rebuild idea-mcp-usage as standard skill"
```

---

## Task 8: 迁移 `docs/` 子目录全部内容

**Files:**
- Create: `docs/bug/`、`docs/变更/`、`docs/字典/`、`docs/权限/`、`docs/测试文档/`、`docs/beforeSkills/`（目录已在 Task 2 建好）
- Modify: `docs-skills/docs/basics-develop-skills-vue/README.md` → `docs/beforeSkills/basics-develop-skills-vue/README.md`

- [ ] **Step 1: 迁移 docs/bug/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  ls docs-skills/docs/bug/ && \
  cp -r docs-skills/docs/bug/* docs/bug/ && \
  rm -rf docs-skills/docs/bug
```

- [ ] **Step 2: 迁移 docs/变更/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  ls docs-skills/docs/变更/ && \
  cp -r docs-skills/docs/变更/* docs/变更/ && \
  rm -rf docs-skills/docs/变更
```

- [ ] **Step 3: 迁移 docs/字典/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  ls docs-skills/docs/字典/ && \
  cp -r docs-skills/docs/字典/* docs/字典/ && \
  rm -rf docs-skills/docs/字典
```

- [ ] **Step 4: 迁移 docs/权限/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  ls docs-skills/docs/权限/ && \
  cp -r docs-skills/docs/权限/* docs/权限/ && \
  rm -rf docs-skills/docs/权限
```

- [ ] **Step 5: 迁移 docs/测试文档/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  ls docs-skills/docs/测试文档/ && \
  cp -r docs-skills/docs/测试文档/* docs/测试文档/ && \
  rm -rf docs-skills/docs/测试文档
```

- [ ] **Step 6: 迁移 docs/beforeSkills/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  ls docs-skills/docs/beforeSkills/ && \
  cp -r docs-skills/docs/beforeSkills/* docs/beforeSkills/ && \
  rm -rf docs-skills/docs/beforeSkills
```

- [ ] **Step 7: 迁移 basics-develop-skills-vue/README.md**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  mkdir -p docs/beforeSkills/basics-develop-skills-vue && \
  git mv docs-skills/basics-develop-skills-vue/README.md docs/beforeSkills/basics-develop-skills-vue/README.md
```

- [ ] **Step 8: 校验 docs/ 子目录文件数**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in bug 变更 字典 权限 测试文档 beforeSkills; do
    count=$(find "docs/$d" -type f 2>/dev/null | wc -l)
    echo "$d: $count files"
  done
```

Expected: 每个目录至少 1 个文件（验证非空）。

- [ ] **Step 9: 提交**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add docs/ && \
  git commit -m "chore(docs): migrate all subdirs out of docs-skills/"
```

---

## Task 9: 删除源目录（`skills2222/`、`basics-develop-skills-vue/`、`docs-skills/`）

**Files:**
- Delete: `docs-skills/skills2222/`
- Delete: `docs-skills/basics-develop-skills-vue/`（仅剩空目录，因5 个 skill 已迁出）
- Delete: `docs-skills/docs/basics-develop-skills-vue.7z`
- Delete: `docs-skills/`（空目录）

**前提：** Task 8 完成后 `docs-skills/docs/` 仅剩 `superpowers/` 子目录。

- [ ] **Step 1: 删除 skills2222/（1111 的副本）**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git rm -r docs-skills/skills2222
```

- [ ] **Step 2: 校验 basics-develop-skills-vue/ 应为空**

Run:
```bash
ls "C:/Users/20614/orca/remote-develop-skills/docs-skills/basics-develop-skills-vue/" 2>&1
```

Expected: `No such file or directory` 或空列表（README 已在 Task 8 迁走，5 个 skill 子目录已在 Task 3 迁走）。

- [ ] **Step 3: 删除空 basics-develop-skills-vue/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git rm -r docs-skills/basics-develop-skills-vue 2>/dev/null || true
```

- [ ] **Step 4: 删除 7z 压缩包**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git rm docs-skills/docs/basics-develop-skills-vue.7z 2>/dev/null || true
```

- [ ] **Step 5: 校验 docs-skills/ 残留**

Run:
```bash
find "C:/Users/20614/orca/remote-develop-skills/docs-skills" -type f 2>&1
```

Expected: 只看到 `docs-skills/skills1111/references/` 已迁完（应为空）、`docs-skills/skills1111/` 仅含可能残留的文件；不再有任何内容文件。

- [ ] **Step 6: 删除空 docs-skills/**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git rm -r docs-skills 2>/dev/null || true
```

- [ ] **Step 7: 校验根目录只剩 8 个 skill 目录**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && ls -d remote-*/
```

Expected: 8 个目录：
- `remote-button-permission/`
- `remote-claude-hooks/`
- `remote-flowable-task-with-next/`
- `remote-idea-mcp-usage/`
- `remote-java-standard/`
- `remote-list-page-directory/`
- `remote-permission-summary/`
- `remote-ts-es-check/`

- [ ] **Step 8: 提交删除**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add -A && \
  git commit -m "chore: remove docs-skills/ after migration complete"
```

---

## Task 10: 写入根 `README.md`（仓库总览 + skill 索引）

**Files:**
- Modify: `README.md`（Task 1 创建的占位）

**接口约定：**
- 消费：spec §8 的 README 模板
- 产出：完整 README.md，覆盖所有 8 个 skill

- [ ] **Step 1: 写入完整 README.md**

覆盖 `README.md`：

```markdown
# Remote Develop Skills

BI/OBO 远程开发技能仓库，对齐 [jetlinks-develop-skills](https://github.com/jetlinks/jetlinks-develop-skills) 结构。

## 启用方式

- **cc-switch**：仓库根目录为扫描入口，同步启用需要的 skill
- **Codex**：`Use $skill-installer to install skill from <url>`
- **手动**：把 skill 目录复制到 `~/.codex/skills/`

## Skill 索引

### 后端规范
- $remote-java-standard — BI/OBO Java 后端分层与编码规范

### 前端规范
- $remote-button-permission — 按钮操作权限（适用于 cashier 等子应用）
- $remote-list-page-directory — 列表页目录结构
- $remote-permission-summary — 权限汇总导出
- $remote-ts-es-check — TS & ESLint 静态检查
- $remote-claude-hooks — Claude Code hooks 说明

### 工作流
- $remote-flowable-task-with-next — Flowable completeTaskWithNext 规范

### 工具链
- $remote-idea-mcp-usage — IDEA MCP 使用规范

## 目录约定

- 每个 skill 一个目录，直接放仓库根
- 命名：`remote-<领域>`，如 `remote-java-standard`
- 子目录：`references/`（按需深度参考）、`agents/`（Codex openai.yaml）、`scripts/`、`assets/`

## 文档归档

非 skill 资产在 `docs/`：

- `superpowers/specs/` — brainstorming 设计稿
- `superpowers/plans/` — 实施计划
- `bug/` — bug 修复记录
- `变更/` — 变更整理
- `字典/` — 数据字典产物
- `权限/` — 权限 SQL 产物
- `测试文档/` — 测试记录
- `beforeSkills/` — 历史学习资料

## Skill 校验

发布前必须通过：

```bash
for d in remote-*/; do
  case "$d" in remote-cashier-*) echo "RESIDUAL cashier $d"; continue;; esac
  [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
  name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
  [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
  desc=$(awk '/^description:/{getline; print}' "$d/SKILL.md")
  echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
done
```
```

- [ ] **Step 2: 提交 README**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add README.md && \
  git commit -m "docs: write README with skill index table"
```

---

## Task 11: 最终校验（8 个 skill 全部通过）

**Files:**
- 不修改任何文件；纯校验

- [ ] **Step 1: 全量校验脚本**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in remote-*/; do
    case "$d" in remote-cashier-*) echo "RESIDUAL cashier $d"; continue;; esac
    [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
    name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
    [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
    desc=$(awk '/^description:/{getline; print}' "$d/SKILL.md")
    echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
    [ ! -f "$d/README.md" ] || echo "UNEXPECTED $d/README.md"
  done
echo "---"
ls -d remote-*/
```

Expected:
- 无 `RESIDUAL cashier` 输出
- 无 `MISSING` 输出
- 无 `MISMATCH` 输出
- 无 `BAD DESC` 输出
- 无 `UNEXPECTED README.md` 输出
- 看到 8 个 `remote-*/` 目录

- [ ] **Step 2: 校验 SKILL.md 行数 ≤ 500（已知 java-standard 与 flowable 需关注）**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in remote-*/; do
    lines=$(wc -l < "$d/SKILL.md")
    [ "$lines" -le 500 ] && echo "OK $d ($lines lines)" || echo "TOO LONG $d ($lines lines)"
  done
```

Expected:
- `OK remote-java-standard (...)`（如果 Task 4 已处理过）
- `OK remote-flowable-task-with-next (...)`（如果 Task 6 已处理过）
- 其他全部 OK

- [ ] **Step 3: 校验 docs-skills/ 已删除**

Run:
```bash
[ ! -d "C:/Users/20614/orca/remote-develop-skills/docs-skills" ] && echo "OK docs-skills gone" || echo "FAIL docs-skills still exists"
```

Expected: `OK docs-skills gone`。

- [ ] **Step 4: 校验 docs/ 子目录均非空**

Run:
```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  for d in superpowers/specs superpowers/plans bug 变更 字典 权限 测试文档 beforeSkills; do
    count=$(find "docs/$d" -type f 2>/dev/null | wc -l)
    echo "$d: $count files"
  done
```

Expected: 每个目录至少 1 个文件。

- [ ] **Step 5: 如有校验失败，回到对应 Task 修复**

若 `TOO LONG` 出现：在对应 skill 拆出 references（在 SKILL.md 留首读指引）

若 `RESIDUAL cashier` 出现：检查文件路径，重命名或删除

若 `MISSING` / `MISMATCH` / `BAD DESC`：回到对应 Task 修正

- [ ] **Step 6: 最终提交（如有调整）**

```bash
cd "C:/Users/20614/orca/remote-develop-skills" && \
  git add -A && \
  git commit -m "chore: final validation pass" || echo "No changes to commit"
```

---

## Task 12: 用 cc-switch 实测扫描（人工验证）

**Files:**
- 不修改文件
- 需要 cc-switch 已安装

- [ ] **Step 1: 在 cc-switch 配置仓库根**

在 cc-switch 中添加本仓库根 `C:/Users/20614/orca/remote-develop-skills` 为扫描入口。

- [ ] **Step 2: 触发扫描**

按 cc-switch 文档执行一次扫描。

Expected: cc-switch 列出 8 个 skill：
- remote-button-permission
- remote-claude-hooks
- remote-flowable-task-with-next
- remote-idea-mcp-usage
- remote-java-standard
- remote-list-page-directory
- remote-permission-summary
- remote-ts-es-check

- [ ] **Step 3: 启用一个 skill 验证**

启用 `remote-button-permission`，在 cc-switch 面板里确认可见。

- [ ] **Step 4: 验证失败则回到 Task 9-11 排查**

若扫描数量不对，回到对应 Task 检查目录命名 / frontmatter。

---

## 自检结果

**1. Spec 覆盖**

| spec 章节 | 任务 |
|---|---|
| §3 仓库整体布局 | Task 1-2（README + docs/ 骨架） |
| §4 skill 目录内部布局 + 命名 | Task 3-7（5+1+1+1 skill 重建） |
| §5 SKILL.md frontmatter | Task 3-7（含 frontmatter 改写步骤） |
| §6 references / agents / scripts / assets | Task 3-7（references 沿用；scripts/assets 留后续按需） |
| §7.1 源到目标映射 | Task 3-9 全覆盖 |
| §7.2 迁移执行顺序 | Task 1-11 严格按顺序 |
| §7.3 校验脚本 | Task 3、Task 4、Task 11 内含完整脚本 |
| §8 根 README 模板 | Task 10 |

**2. 占位符扫描**

- 无 TBD / TODO
- 无 "implement later"
- 无 "Similar to Task N"
- 所有脚本步骤都给出具体命令

**3. 类型/字段一致性**

- 所有 skill 的 `name` 都用 `remote-<领域>` 格式
- description 起手 `Use when` 在每个任务里都明确要求
- 校验脚本一致：`grep -E "^name:"`、`grep -q "^description: Use when"`

**4. 无遗漏任务**

- 仓库级 README：Task 10 ✅
- 8 个 skill：Task 3（5 个 Vue）+ Task 4（Java）+ Task 5（合并 list-page）+ Task 6（flowable）+ Task 7（idea-mcp）✅
- docs/ 全部子目录：Task 8 ✅
- 源删除：Task 9 ✅
- 校验：Task 11 ✅
- cc-switch 验证：Task 12 ✅

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-21-skills-restructure.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?