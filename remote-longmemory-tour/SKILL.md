---
name: remote-longmemory-tour
description: 浏览 LongMemory 中所有存储的记忆,按 sector 分组(semantic / episodic / procedural / emotional / reflective)。当用户问"都存了哪些"、"看看库里有什么"、"审计一下记忆"或准备做迁移/重构前盘点时使用。
---

# LongMemory 全景浏览

展示 LongMemory 库里的所有记忆,按 sector 分组。

## 适用场景

- 用户问"都存了哪些记忆" / "看看 LongMemory 都有啥" / "审计一下"
- 准备做项目迁移前,先盘点一下历史知识
- 重构 / 整理前的清单核对
- 用户说 "tour" / "show all" / "list memories"

## 工具

调用 `mcp__longmemory__openmemory_list`。

## 工具参数(对齐 longmemory 真实 schema)

| 参数 | 类型 | 必填 | 默认 | 范围 | 说明 |
|---|---|---|---|---|---|
| `limit` | int | ❌ | **10** | **1-50** | 返回数量(最大 50) |
| `sector` | enum | ❌ | — | 见下 | **只显示某个 sector**(服务端过滤) |
| `user_id` | string | 运行时必填 | `apps/<当前 Agent 目录名>` | — | 按 Agent 目录隔离记忆 |

**sector 合法值**:`episodic` / `semantic` / `procedural` / `emotional` / `reflective`

## 必须执行的范围过滤

与 `packages/agent-script/longmemory-recall.ts` 对齐：从当前工作目录识别 Agent 范围，并在每一次 `openmemory_list` 调用中传入 `user_id: "apps/<agent>"`。无法识别时请用户确认目标 Agent；不得省略 `user_id` 后浏览全局记忆。

`openmemory_list` 返回的是库存条目，不提供 recall query 的相似度 `score`，因此不能伪造 `score >= 0.6` 过滤。用户明确要求“重要记忆”时，使用服务端支持的 `min_salience`；否则保留当前 Agent 范围内的全部条目。

⚠️ **关键限制**:`limit` 最大 **50**。`list` 不支持 offset；按 sector 分批只能降低遗漏风险，若某个 sector 自身超过 50 条，不能声称已完整列出。

## 执行步骤

### Step 1: 决定是否过滤 sector

**用户指定 sector**(如"看 semantic 类的" / "列出所有 procedural"):

→ 直接调 list，传入 `sector: "<name>"` 和当前 Agent 的 `user_id`

**用户没指定**:

→ 走 Step 2(全 sector 概览)

### Step 2: 全 sector 概览(默认)

longmemory list 不支持分页,最多 50 条。

**如果库 ≤ 50 条**:调一次 list(`limit: 50, user_id: "apps/<agent>"`),客户端按 sector 重新分组显示。

**如果库 > 50 条**(用户问"都有啥"但有 >50 条):

1. 告诉用户:"库里超过 50 条,需要按 sector 分批看。"
2. 调 5 次 list（每个 sector 各一次，均传入 `limit: 50, user_id: "apps/<agent>"`），合并显示；若任一 sector 达到 50 条，明确说明该 sector 可能未完整列出
3. 或建议用户用 `longmemory-search` 按关键词缩小范围

### Step 3: 调用 list

调用 `mcp__longmemory__openmemory_list`:

- `limit`: 50(最大)
- `sector`: 可选,过滤单个 sector
- `user_id`: 当前 Agent 的 `apps/<agent>` 范围
- `min_salience`: 仅在用户要求重要度阈值时传入

工具返回 `content[0]` 是人读文本(`1. [semantic] salience=... id=... \n<content>`),`content[1]` 是完整 JSON。

### Step 4: 输出(全 sector 概览模式)

```
## LongMemory 全景(共 <N> 条)

### semantic (<N1> 条)
- <content 摘要 60 字> [lm:<id 前 8 位>]
- ...

### episodic (<N2> 条)
- ...

### procedural (<N3> 条)
- ...

### emotional (<N4> 条)
- ...

### reflective (<N5> 条)
- ...
```

按 sector 条数从大到小排序。

### Step 4: 输出(单 sector 模式)

```
## LongMemory / <sector> (<N> 条)

- <content 摘要 60 字> [lm:<id 前 8 位>]
- ...
```

## 不做的事

- 不修改 / 删除任何记忆
- 不展开完整 content(只摘要,要看完整用 `longmemory-find`)
- 不调 `openmemory_query`(只 `openmemory_list`)

## 错误处理

- 库为空 → "LongMemory 库里还没有任何记忆。"
- tool 失败 → "LongMemory 暂时连不上,无法浏览。"
- limit 超过 50 → 告诉用户:"单次最多 50 条,我按 sector 分批拉。"