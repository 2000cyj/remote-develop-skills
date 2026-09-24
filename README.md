# Remote Develop Skills

BI/OBO 团队远程开发技能集合，每个 skill 一个目录、独立的 `SKILL.md` 入口。

## 启用方式

| 渠道 | 操作 |
|------|------|
| **cc-switch** | 仓库根目录为扫描入口，同步启用需要的 skill |
| **Codex** | `Use $skill-installer to install skill from <url>` |
| **手动** | 把 skill 目录复制到 `~/.codex/skills/` |

## Skill 索引

> 命名约定：`remote-<领域>`，目录名 = `SKILL.md` `name:` 字段。仓库根下 `remote-*/` 才是已发布 skill；`deprecated/` 与 `incubating/` 内的 skill 见各自 README。

### 后端规范

| Skill | 范围 |
|-------|------|
| `$remote-cashier-java-standard` | bi-cashier-* 模块 Java 后端分层与编码规范（DTO/VO/PO、Service/Component 职责、Mapper XML、BeanCopyUtils、Feign 等） |

### 前端规范

| Skill | 范围 |
|-------|------|
| `$remote-list-page-directory` | `src/pages/` 下页面/业务模块目录结构（7 项固定目录 + oboweb 触发） |
| `$remote-ts-es-check` | 前端任务内 ESLint / vue-tsc 范围检查与常见 TS 形态修复 |

### 工作流

| Skill | 范围 |
|-------|------|
| `$remote-flowable-task-with-next` | `BiFlowableClient.completeTaskWithNext` 调用链、幂等、下一节点信息 |
| `$remote-commit-git` | conventional commits 拆批提交 + 多仓库推送 |

### 工具链

| Skill | 范围 |
|-------|------|
| `$remote-idea-mcp-usage` | IDEA MCP 入口、build/lint/run/data source 权限（dev 可写，其余只读） |
| `$remote-orca-cli` | Orca 运行时：orca 命令、worktree / terminal 起停、内置浏览器 |
| `$remote-orca-agent-communication` | Orca 跨 Agent terminal 消息通信 |
| `$remote-write-scope` | Agent 写操作作用域：写前校验 hook + `.pi/write-allowlist.json` |

### LongMemory 工具

| Skill | 范围 |
|-------|------|
| `$remote-longmemory-find` | 按 ID 精确查找 LongMemory 记忆（含短 hex → 完整 UUID 解析） |
| `$remote-longmemory-search` | LongMemory 语义搜索（按 Agent 范围 `apps/<agent>` 隔离 + `score >= 0.6` 客户端过滤） |
| `$remote-longmemory-tour` | LongMemory 全景浏览（按 sector 分组） |

### 仓库元

| Skill | 范围 |
|-------|------|
| `$remote-develop-skills-repo` | 本仓库内新增、修改、发布 `remote-*` skill 的元规范（frontmatter、references、README 同步路径） |

## 目录约定

每个 skill 一个目录，直接放仓库根。子目录（按需）：

- `references/` — 按目标/形态分档的深度参考（不是必备）
- `agents/` — Codex `openai.yaml`
- `scripts/` — 自检/同步脚本
- `assets/` — 模板、示例文件

### 弃用目录 `deprecated/`

不再维护、仅作历史归档的 skill 放进此目录。规则：

- 完整目录搬入（原 `remote-<name>/` 不拆散），目录名保持 `remote-<name>`
- `SKILL.md` 顶部加弃用说明并指向替代 skill
- 不被 cc-switch / Codex installer 同步分发

### 孵化目录 `incubating/`

正在开发、尚未发布的 skill 放进此目录。规则：

- 完整目录存放（原 `remote-<name>/` 不拆散），目录名保持 `remote-<name>`
- `SKILL.md` frontmatter 加 `status:` 字段（`draft` / `wip` / `review` / `ready`）
- 毕业后整目录挪到根并在 Skill 索引加条目；放弃则挪到 `deprecated/`

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
  [ -f "$d/SKILL.md" ] || { echo "MISSING $d/SKILL.md"; continue; }
  name=$(grep -E "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//;s/"//g')
  [ "$name" = "${d%/}" ] || echo "MISMATCH $d vs $name"
  desc=$(awk -F'description: *' '/^description:/{print $2; exit}' "$d/SKILL.md")
  echo "$desc" | grep -q "^Use when" || echo "BAD DESC $d"
done
```