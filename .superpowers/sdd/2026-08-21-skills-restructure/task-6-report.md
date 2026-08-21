# Task 6 Report: 重建 flowable skill

## 概述
执行 plan Task 6——把 `docs-skills/skills1111/flowable-complete-task-with-next.md`（1653 行）重建为标准 skill `remote-flowable-task-with-next/`。

## 各步骤实际命令 + 输出

### Step 1: 创建 skill 目录结构
```bash
mkdir -p remote-flowable-task-with-next/references
```
- 输出：`remote-flowable-task-with-next/` 和 `references/` 创建成功。

### Step 2: git mv 源文件
```bash
git mv docs-skills/skills1111/flowable-complete-task-with-next.md remote-flowable-task-with-next/SKILL.md
```
- 输出：源文件移出 `docs-skills/skills1111/`，`SKILL.md` 创建成功。
- `git status` 显示 `renamed: docs-skills/skills1111/flowable-complete-task-with-next.md -> remote-flowable-task-with-next/SKILL.md`。

### Step 3: 添加 frontmatter
在 SKILL.md 第 1 行前插入：
```yaml
---
name: remote-flowable-task-with-next
description: Use when 通过 BiFlowableClient.completeTaskWithNext 完成 Flowable 待办、查询下一节点信息、处理审批结果与幂等、调整或排查 completeTaskWithNext 调用链。
---
```
紧接其后追加 reference 指引两行：
```markdown
- Use references/complete-task-with-next-contract.md when 涉及调用链、入参、返回值、幂等
- Use references/error-handling.md when 涉及错误码、异常处理
```
两者之间空一行（与下面"# Flowable ..."首行之间留空行）。

### Step 4: 行数检查与拆分
- 初始 SKILL.md 行数（含 frontmatter）：**1658 行**（原 1653 + frontmatter 5 行）。
- 实际章节边界与 plan 不一致：源文档是 **28 个章节**（§1-§28），不是 plan 假设的 9 章节结构。
  - plan §4-7（contract）实际对应 §4-§9（call chain + address + params + result + idempotency + variables）
  - plan §8-9（error codes/exceptions）实际没有对应章节；真实"错误和注意事项"在 **§16**
- 按 plan 拆分原则（找最接近的 ## 标题作为拆边界）执行：
  - 复制 §4-§9 全部内容到 `references/complete-task-with-next-contract.md`（**211 行**）
  - 复制 §16 全部内容到 `references/error-handling.md`（**29 行**）
  - 在 SKILL.md §3 之后、§10 之前插入 **## Workflow** 段（5 行），含两个 reference 文件的首读指引
  - SKILL.md 中删除 §4-§9、§16 全部内容
- 拆分后 SKILL.md：**1423 行**

### Step 5: 校验
| 校验项 | 结果 |
|---|---|
| `name` 与目录名一致 | ✅ `remote-flowable-task-with-next` |
| `description` 起手 "Use when" | ✅ |
| SKILL.md ≤ 500 行 | ❌ **1423 行**（详见 concerns） |

### Step 6: Commit
```bash
git add remote-flowable-task-with-next/
git commit -m "feat(skills): rebuild flowable-task-with-next as standard skill"
```

## SKILL.md 最终行数

```
1423 remote-flowable-task-with-next/SKILL.md
```

## references/ 下文件清单

| 文件 | 行数 | 内容（原章节） |
|---|---|---|
| `references/complete-task-with-next-contract.md` | **211** | §4 调用链、§5 原始接口地址和请求格式、§6 请求参数规范、§7 审批结果规范、§8 幂等规范、§9 `variables` 规范 |
| `references/error-handling.md` | **29** | §16 错误和注意事项（含 16.1 常见参数错误、16.2 不要混淆的字段、16.3 事务边界） |

## 章节拆分的实际标题与边界

| plan 描述 | plan §编号 | 实际 ## 标题（拆分点） | 实际起止行 |
|---|---|---|---|
| 留在 SKILL.md | §2 功能说明 | `## 2. 功能说明` | SKILL.md 内保留 |
| 留在 SKILL.md | §3 与普通完成接口的区别 | `## 3. 与普通完成接口的区别` | SKILL.md 内保留 |
| contract | §4 调用链 | `## 4. 调用链` | contract.md line 1 |
| contract | §5 入参（plan 假设） | `## 5. 原始接口地址和请求格式` + `## 6. 请求参数规范` | contract.md lines 31-99 |
| contract | §6 返回值（plan 假设） | `## 7. 审批结果规范`（注：实际 §11 才是返回值规范） | contract.md lines 117-136 |
| contract | §7 幂等 | `## 8. 幂等规范` | contract.md lines 139-179 |
| contract | —（plan 未提及） | `## 9. variables 规范` | contract.md lines 182-211 |
| error-handling | §8 错误码、§9 异常场景 | `## 16. 错误和注意事项`（唯一含"错误"关键词的章节） | error-handling.md 全文件 |

**重要**：plan 假设源文档有 9 个章节，实际有 28 个章节。Plan 拆分规则中的 §5/§6/§7/§8/§9 与实际章节编号错位。本任务按"plan §4-7 拆 contract、plan §8-9 拆 error-handling"的精神就近选择章节边界。

## 最终 git log 与 git status

### `git log --oneline | head -5`
```
<TBD after commit>
```

### `git status`（commit 前）
```
Changes to be committed:
  renamed:    docs-skills/skills1111/flowable-complete-task-with-next.md -> remote-flowable-task-with-next/SKILL.md

Changes not staged for commit:
  modified:   remote-flowable-task-with-next/SKILL.md

Untracked files:
  remote-flowable-task-with-next/references/
```

## Concerns

### 🔴 Concern 1: SKILL.md 仍为 1423 行（远超 ≤500 行目标）
**原因**：plan Task 6 Step 4 假设源文档只有 9 个章节，但实际源文档有 28 个章节。仅按 plan 拆出 §4-§9（211 行）和 §16（29 行），SKILL.md 仍有 §1-3（~58 行）+ Workflow（5 行）+ §10-15（~381 行）+ §17-28（~965 行），合计 ~1423 行。

**为何未做更多拆分**：
1. plan 明确只指定了 2 个 references 文件，未授权扩展。
2. 用户指令："如果你判断拆分会让内容破碎，也跳过并在 concern 中说明"——本次未做扩展拆分即属此情况。
3. 若需进一步缩小 SKILL.md，建议将 §18-§28（"方案 A / 方案 B"前端实现模式，约 935 行）拆为 `references/plan-a-b-patterns.md`，可让 SKILL.md 降至 ~480 行。**此拆分超出本任务 plan 范围，需 orchestrator 显式决策。**

### 🟡 Concern 2: plan 章节编号与实际错位
plan 描述中的 §5（入参）、§6（返回值）、§8（错误码）、§9（异常场景）在源文档中并不存在同名章节：
- 实际"入参"散落在 §6（请求参数规范）和 §9（variables 规范）
- 实际"返回值"在 §11（返回值规范），并非 §6/§7
- 实际"错误和注意事项"在 §16，而非 §8/§9
- 实际"幂等规范"在 §8（与 plan §7 匹配）

本任务按 plan 精神做了"最接近"的拆分选择：
- contract 文件包含 §4-§9（覆盖调用链 + 地址 + 入参 + 审批结果 + 幂等 + variables），逻辑上合理。
- error-handling 文件只包含 §16（唯一的"错误"章节）。

### 🟢 校验通过项
- ✅ name 与目录名一致
- ✅ description 起手 "Use when"
- ✅ frontmatter 完整、位置正确
- ✅ references 文件代码块（```java```、```http```、```json```）完整无截断
- ✅ 未修改原始语义，仅做章节位置调整

## 待执行
- Step 6: `git add` + commit
## Fix Round 1

**目标**：将 SKILL.md §18-§28（487 行起）拆分到 references/plan-a-b-patterns.md，使 SKILL.md 降至 ≤ 500 行。

**操作**：
- 删除 SKILL.md 第 487 行至末尾（原 1423 行 → 现 487 行）
- 删除/移动行数：937 行
- 新增 references/plan-a-b-patterns.md：944 行（含 7 行 HTML 注释说明头，无 frontmatter）
- 在 SKILL.md frontmatter 引导段追加一行：
  `Use references/plan-a-b-patterns.md when 涉及方案 A/B 选择、开发模板、测试检查清单、决策结论`

**最终行数**：

```text
  487 remote-flowable-task-with-next/SKILL.md
  944 remote-flowable-task-with-next/references/plan-a-b-patterns.md
 1431 total
```

**校验**：
- ✅ name 一致（`remote-flowable-task-with-next`）
- ✅ description 起手 `Use when`
- ✅ SKILL.md 行数 487 ≤ 500
- ✅ references/plan-a-b-patterns.md 内容完整：§18 §19 §20 §21 §22 §23 §24 §25 §26 §27 §28 全部存在，原始编号保留便于对照原文档
- ✅ 代码块（```java``` / ```http``` / ```json``` / ```vue``` / ```ts``` / ```js```）完整无截断
- ✅ 未修改原始语义
- ✅ references 文件首行为 HTML 注释（`<!--`），无 frontmatter

**git log --oneline | head -5**：

```text
e83b23a refactor(skills): split flowable plan-a/b patterns into references to meet 500-line guideline
b2431a9 feat(skills): rebuild flowable-task-with-next as standard skill
ffce3c7 chore(skills): merge duplicate list-page content, archive original
c6e9d05 feat(skills): migrate java-standard to remote-* format
9693742 feat(skills): migrate basics-develop-skills-vue children to remote-* format
```

**concerns**：
- §16 编号空缺：原 SKILL.md 中 §16 内容已迁移到 references/error-handling.md，而 §17 仍在 SKILL.md 中；本次拆分后 SKILL.md 中 §18+ 已无内容。重新编号 SKILL.md 章节风险较高（影响外部引用），故保留原编号空缺。
- references 文件 944 行 vs 预期 ~935 行：差额 9 行来自文件头部 7 行 HTML 注释 + 2 行空行分隔，可接受。
