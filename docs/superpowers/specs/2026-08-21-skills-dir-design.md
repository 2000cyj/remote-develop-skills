# Skills 仓库目录结构设计

> 状态：已批准（brainstorming 完成）
> 日期：2026-08-21
> 参考：[jetlinks-develop-skills](https://github.com/jetlinks/jetlinks-develop-skills)

## 1. 目标

将 `docs-skills/` 内散落、重复、嵌套的 skill 资产，平迁为一个可直接被 **cc-switch** 扫描的、目录结构对齐 jetlinks 蓝图的 skill 仓库。

成功标准：

- cc-switch 以仓库根为入口，启用即生效
- 浅层扫描工具识别全部 skill
- 每个 skill 自包含、零样板
- 仓库级说明集中在根 `README.md`
- 历史资料归档到 `docs/`，不进 cc-switch

## 2. 设计原则

- **平铺**：skill 目录直接放仓库根，不套 `skills/` 父目录
- **自包含**：每个 skill 只保留运行所需文件（SKILL.md + references/ + agents/ + scripts/ + assets/）
- **命名统一**：`remote-<项目>-<领域>`，全小写、连字符
- **场景化 frontmatter**：`name` 与目录名一致；`description` 起手 `Use when`，第三人称，列举所有触发场景
- **按需加载**：细节下沉 references，SKILL.md 只放流程与约束
- **物理隔离**：skill 与文档物理隔离（`docs/` 装非 skill 资产）

## 3. 仓库整体布局

```text
remote-develop-skills/                # 仓库根（cc-switch 扫描入口）
├── README.md                          # 仓库总览 + skill 索引表
├── .claude/                           # 本地 hook/权限（不入 cc-switch 同步范围）
│   └── settings.local.json
│
├── remote-java-standard/            # Java 后端规范
├── remote-button-permission/        # 按钮权限
├── remote-list-page-directory/      # 列表页目录结构
├── remote-permission-summary/       # 权限汇总导出
├── remote-ts-es-check/              # TS & ESLint 检查
├── remote-claude-hooks/             # Claude Code hooks 说明
├── remote-flowable-task-with-next/  # Flowable completeTaskWithNext 规范
├── remote-idea-mcp-usage/           # IDEA MCP 使用规范
│
└── docs/                              # 非 skill 资产
    ├── superpowers/
    │   ├── specs/                     # brainstorming 设计稿
    │   └── plans/                     # writing-plans 实施计划
    ├── bug/                           # bug 修复记录
    ├── 变更/                          # 变更整理
    ├── 字典/                          # 数据字典产物
    ├── 权限/                          # 权限 SQL 产物
    ├── 测试文档/                      # 测试记录
    └── beforeSkills/                  # 历史学习资料（不进 cc-switch）
```

### 3.1 路径判定规则

| 路径层级 | 用途 | cc-switch |
|---|---|---|
| 仓库根下任意 `remote-*/` | skill | ✅ 启用 |
| `docs/` | 设计/计划/历史/产物 | ❌ 排除 |
| `.claude/` | 本地 hooks | ❌ 排除 |
| 根 `README.md` | 索引与说明 | ❌（仅人类阅读） |

### 3.2 为何 docs/ 放根而不是 skills/ 下

- cc-switch 浅层扫描不会误把 `docs/specs/`、`docs/plans/` 加载为 skill
- skill 与文档物理隔离，迁移与清理都简单
- 与 jetlinks 蓝图保持一致

## 4. skill 目录内部布局

### 4.1 标准结构

```text
<skill-name>/
├── SKILL.md                       # 必填：元数据 + 核心指令
├── agents/                        # 可选：openai.yaml 子代理定义（Codex 用）
├── references/                    # 可选：按需加载的深度参考
│   └── <topic>.md
├── scripts/                       # 可选：可执行脚本
└── assets/                        # 可选：模板、schema、SQL模板等
```

### 4.2 命名规则

| 字段 | 规则 | 示例 |
|---|---|---|
| 目录名 | `remote-<领域>` | `remote-java-standard` |
| 字符集 | 小写字母 + 数字 + 连字符 | `remote-flowable-task-with-next` |
| `name` | 必须与父目录名完全一致 | `name: remote-java-standard` |
| `description` | 起手 `Use when`，第三人称，列举所有触发场景 | 见 §5 |

### 4.3 项目前缀约定

| 前缀 | 含义 |
|---|---|
| `remote-` | 项目级别前缀，所有 skill 统一带 |
| （无） | 领域名足够清晰时不叠子应用前缀 |

**为何不再叠 `cashier`**

- 本仓库不是 cashier 专属，cashier 只是众多子应用之一
- skill 描述里点名 cashier 的，可放在 `description` 字段；目录名保持领域级通用
- 示例：`remote-button-permission`（通用），其 description 写明"适用于 cashier 等子应用"

### 4.4 为何去掉 `basics-` 与 `cashier` 双前缀

- `basics-develop-skills-vue/` 整组作为"父目录"对 cc-switch 没有意义
- 子 skill 已通过 `remote-` 前缀与项目绑定，再叠 `basics-` / `cashier-` 既冗余又与 jetlinks 不一致
- 原 `basics-button-permission-vue` → `remote-button-permission`，语义不变

### 4.5 命名约束清单（硬约束）

- ❌ 不允许使用 `skills/` 作为父目录（与浅层扫描冲突）
- ❌ 不允许 skill 目录嵌套 skill 目录
- ❌ 不允许目录名出现大写、空格、下划线、点号
- ❌ 不允许 `name` 与目录名不一致
- ❌ 不允许在 skill 目录里塞仓库级说明 README（统一放根 `README.md`）

## 5. SKILL.md 规范

### 5.1 Frontmatter 必填字段

```yaml
---
name: remote-java-standard
description: Use when ...
---
```

### 5.2 `description` 写法

| 要求 | 错误示例 | 正确示例 |
|---|---|---|
| 起手 `Use when ...` | `Java 开发规范` | `Use when 新建/审查 BI 出纳模块 Java 代码、调整 DTO/VO/PO 字段、编写 Mapper SQL` |
| 第三人称 | `我帮你...` | `Use when ...` |
| 只描述触发条件 | `本 skill 会先做 A 再做 B` | 只列症状/场景 |
| 列举所有触发场景 | 漏掉「DTO 字段调整」 | 一行式长描述，覆盖全部 |

**反例（绝对不要）**

```yaml
# ❌ 描述里写工作流会被 agent 跳过正文
description: 使用时按 Workflow 章节执行，含 5 步骤

# ❌ 第一人称
description: 我帮你规范 Java 分层

# ❌ 过短，没有触发条件
description: Java 标准
```

### 5.3 正文固定结构

```text
# <Title>

Read references/xxx.md first.              # 首读引导（按需）

## Overview

## When to Use
- ✅ ...
- ❌ NOT when ...

## Workflow
1. ...
2. ...

## Required Constraints
- Do not ...
- Prefer ...
- Use references/xxx.md when <具体场景>

## Quick Reference

## Common Mistakes

## Response Shape
```

### 5.4 写法风格要点

| 原则 | 说明 |
|---|---|
| 祈使句 | `Do not ...` / `Prefer ...` / `Use ... when ...` |
| 场景化按需加载 | `Use references/xxx.md when <具体场景>` |
| 跨 skill 路由 | `$remote-button-permission` |
| 不要套娃 | SKILL.md 只放流程与约束，细节全下沉 references |
| 不要叙事化 | 不写"我们当年为什么这样做" |
| 控制长度 | SKILL.md 控制在 ≤ 500 行 |

### 5.5 SKILL.md 自检清单（发布前必过）

- [ ] `name` 与目录名一致
- [ ] `description` 起手 `Use when`，第三人称，列举所有触发场景
- [ ] 首屏有 "Read references/xxx.md first." 或等价引导
- [ ] 含 Workflow / Required Constraints / Response Shape 三段
- [ ] 硬约束用祈使句
- [ ] 跨 skill 引用用 `$skill-name`
- [ ] 行数 ≤ 500（超过则拆 references）
- [ ] 没有讲故事段落、没有 TBD、没有 TODO

## 6. references / agents / scripts / assets 规则

### 6.1 references/

```text
references/
├── <topic>.md            # 每个 reference 一个主题
```

**单 reference 内标准结构**

```text
# <Topic>

## 核心原则
## 常见落地要求
### <子主题>
## 反例与修复
```

**按需加载指引**（写在 SKILL.md）

```markdown
- Use references/architecture-layers.md when 涉及分层调用、Mapper 越级
- Use references/data-model-sql.md when 新增表、调整字段、Mapper SQL 编写
```

**约束**

- 同一主题只允许一份 reference，不允许 `<topic>.md` 与 `<topic>-v2.md` 并存
- reference 间互相引用用相对路径 `[architecture-layers.md](architecture-layers.md)`
- 不在 reference 里塞历史变更日志（变更记录归 `docs/` 或 git 提交）

### 6.2 agents/

```text
agents/
└── openai.yaml
```

```yaml
interface:
  display_name: "Remote Cashier Java Standard"
  short_description: "BI 出纳模块 Java 开发规范"
  default_prompt: |-
    <完整规则，编号列出 + 跨 skill 路由>
    - 落地完成后切 $remote-button-permission 涉及前端
    - 调整权限 SQL 切 $remote-permission-summary
```

`default_prompt` 必须把 SKILL.md 的约束完整落进 prompt。cc-switch 启用 Codex 风格时才加载 `agents/`。

### 6.3 scripts/

```text
scripts/
├── generate-sql.sh
└── ts-es-check-gate.sh
```

- 脚本自包含：开头 `set -e` / 明确工作目录
- 脚本头部注释：用途、调用方式、依赖
- 跨平台脚本用 `bash`
- 配套 SKILL.md 中必须显式说明调用方式

### 6.4 assets/

```text
assets/
├── 权限模板.sql
└── package.json.tmpl
```

仅放只读的固定模板/样例。

### 6.5 不允许的目录

- ❌ `examples/`：示例代码放进对应 `references/<topic>.md`
- ❌ `README.md`：仓库级说明统一放根 `README.md`
- ❌ `tests/`：skill 不带自测
- ❌ `templates/`：改名 `assets/`
- ❌ `__pycache__/`、`node_modules/`：运行残留

## 7. 迁移方案

### 7.1 源到目标映射

| 源 | 目标 | 操作 | 备注 |
|---|---|---|---|
| `docs-skills/basics-develop-skills-vue/basics-button-permission-vue/` | `remote-button-permission/` | 整体移动 + 改名 `basics-` → `remote-` + SKILL.md.name 同步 | 删 `cashier` 中缀 |
| `docs-skills/basics-develop-skills-vue/basics-list-page-directory-vue/` | `remote-list-page-directory/` | 同上 | 删 `cashier` 中缀 |
| `docs-skills/basics-develop-skills-vue/basics-permission-summary-vue/` | `remote-permission-summary/` | 同上 | 删 `cashier` 中缀 |
| `docs-skills/basics-develop-skills-vue/basics-ts-es-check-vue/` | `remote-ts-es-check/` | 同上 | 删 `cashier` 中缀 |
| `docs-skills/basics-develop-skills-vue/basics-claude-hooks-vue/` | `remote-claude-hooks/` | 同上 | 删 `cashier` 中缀 |
| `docs-skills/skills1111/SKILL.md`（2359 行） | `remote-java-standard/SKILL.md` | 重建 frontmatter（`name: remote-java-standard`），保留 `references/*` 9 个 md | 删 `cashier` 中缀 |
| `docs-skills/skills1111/cashier-list-page-directory-skill.md` | 并入 `remote-list-page-directory/` | 与现有 `directory-structure.md` 内容重复 | 取一份为准 |
| `docs-skills/skills1111/flowable-complete-task-with-next.md`（1653 行） | `remote-flowable-task-with-next/SKILL.md` + `references/` | 重建为标准 skill | |
| `docs-skills/skills1111/idea-mcp-usage-scope.md`（247 行） | `remote-idea-mcp-usage/SKILL.md` | 重建为标准 skill | |
| `docs-skills/skills1111/references/*`（9 个 md） | `remote-java-standard/references/` | 直接复用 | |
| `docs-skills/skills2222/`（1111 的副本） | **删除** | 与 1111 内容完全一致 | |
| `docs-skills/basics-develop-skills-vue/README.md` | `docs/beforeSkills/basics-develop-skills-vue/README.md` | 归档 | |
| `docs-skills/docs/beforeSkills/` | `docs/beforeSkills/` | 上提一层 | |
| `docs-skills/docs/superpowers/specs/` | `docs/superpowers/specs/` | 上提一层 | |
| `docs-skills/docs/superpowers/plans/` | `docs/superpowers/plans/` | 上提一层 | |
| `docs-skills/docs/bug/` | `docs/bug/` | 上提一层 | |
| `docs-skills/docs/变更/` | `docs/变更/` | 上提一层 | |
| `docs-skills/docs/字典/` | `docs/字典/` | 上提一层 | |
| `docs-skills/docs/权限/` | `docs/权限/` | 上提一层 | |
| `docs-skills/docs/测试文档/` | `docs/测试文档/` | 上提一层 | |
| `docs-skills/docs/basics-develop-skills-vue.7z` | **删除** | 旧归档 | |
| `docs-skills/`（整个目录） | **删除**（迁完后） | 全部内容已迁出 | |

### 7.2 迁移执行顺序

```
第 1 步  新建根布局目录（docs/ 与 8 个 skill 目录）
第 2 步  复制基础 Vue skill（直接迁移 + 改名）
         remote-button-permission/
         remote-list-page-directory/
         remote-permission-summary/
         remote-ts-es-check/
         remote-claude-hooks/
第 3 步  改造 Java skill（重建 frontmatter + 复制 references）
         remote-java-standard/
第 4 步  重建 Flowable 与 IDEA MCP skill
         remote-flowable-task-with-next/
         remote-idea-mcp-usage/
第 5 步  合并 cashier-list-page-directory-skill.md 与现有 directory-structure.md，取最新版本
第 6 步  迁移 docs/ 全部子目录（bug/、变更/、字典/、权限/、测试文档/、beforeSkills/、superpowers/）
第 7 步  校验：每个 skill 的 name 与目录名一致；description 起手 Use when；引用路径正确
第 8 步  删源：skills2222/、docs-skills/、docs-skills/basics-develop-skills-vue/、docs-skills/docs/basics-develop-skills-vue.7z
第 9 步  写根 README.md：仓库说明 + skill 索引表（按 category 分组）
第 10 步 用 cc-switch 真实扫描根目录，验证 8 个 skill 全部可见
```

### 7.3 校验脚本

```bash
# 每个 skill 必须满足：
# 1) 目录名 == SKILL.md 的 name
# 2) SKILL.md 含 frontmatter
# 3) description 起手 "Use when"
# 4) 引用路径不指向已删除的 docs-skills/
# 5) 名称不带 cashier 中缀（项目级通用）

for d in remote-*/; do
  case "$d" in remote-cashier-*) echo "RESIDUAL cashier $d"; continue;; esac
  [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
  name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
  [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
  desc=$(awk '/^description:/{getline; print}' "$d/SKILL.md")
  echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
done
```

## 8. 根 README.md 模板

```markdown
# Remote Develop Skills

BI/OBO 远程开发技能仓库，对齐 [jetlinks-develop-skills](https://github.com/jetlinks/jetlinks-develop-skills) 结构。

## 启用方式

- cc-switch：仓库根目录为扫描入口，同步启用需要的 skill
- Codex：`Use $skill-installer to install skill from <url>`

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

非 skill 资产在 `docs/`：specs/、plans/、bug/、变更/、字典/、权限/、测试文档/、beforeSkills/。
```

## 9. 范围声明

### 9.1 本设计包含

- skill 目录布局
- skill 命名规范
- SKILL.md / references / agents / scripts / assets 内部规范
- docs/ 物理隔离设计
- 从 `docs-skills/` 到最终布局的迁移方案
- 根 README.md 模板
- 迁移后校验脚本

### 9.2 本设计不包含

- 实际迁移执行（由 writing-plans 输出实施计划）
- skill 内容更新（除 frontmatter 改名外的语义修改）
- cc-switch 配置文件（cc-switch 自身产物，不属于本仓库）
- CI / 自动化校验（可选扩展）

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| SKILL.md 行数超过 500 行 | 提前识别（java-standard 现 2359 行），强制拆 references |
| reference 内引用旧路径 `docs-skills/...` | 迁移脚本做全局字符串替换；校验脚本检查 |
| `basics-develop-skills-vue/README.md` 误删 | 第 5 步先归档到 `docs/beforeSkills/` 再删源 |
| 合并两个 list-page skill 内容产生版本漂移 | 取最新版本；保留 `docs/beforeSkills/` 备份 |
| 根目录膨胀影响可读性 | README 索引表分组展示 |