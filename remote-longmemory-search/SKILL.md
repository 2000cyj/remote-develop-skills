---
name: remote-longmemory-search
description: 在 LongMemory 中搜索相关记忆(决策、约定、教训、过往错误)。当用户提到过去的工作、问"我们之前怎么做的"、"有没有相关经验",或者在解决复杂任务前想先看看历史知识时使用。
---

# LongMemory 搜索

快速搜索 LongMemory 中与查询相关的记忆。

## 适用场景

- 用户问"我们之前在 X 模块怎么做的"、"我之前讲过 Y 没"
- 调试时遇到重复出现的问题,想查以前怎么解决的
- 接手新模块前想了解历史决策
- 用户说"查一下" / "找找" / "我记得" / "之前"

## 工具

调用 `mcp__longmemory__openmemory_query`。

## 工具参数(全部对齐 longmemory 真实 schema)

| 参数 | 类型 | 必填 | 默认 | 范围 | 说明 |
|---|---|---|---|---|---|
| `query` | string | ✅ | — | min 1 字 | 关键词或原话 |
| `k` | int | ❌ | **5** | 1-32 | 先取回的候选数量；与 recall hook 的 `TOP_K=5` 对齐 |
| `sector` | enum | ❌ | — | 见下 | 按 sector 过滤 |
| `min_salience` | float | ❌ | — | 0-1 | 最低重要度阈值 |
| `user_id` | string | 运行时必填 | `apps/<当前 Agent 目录名>` | — | 按 Agent 目录隔离记忆 |

**sector 合法值**:`episodic` / `semantic` / `procedural` / `emotional` / `reflective`

## 必须执行的范围与结果过滤

与 `packages/agent-script/longmemory-recall.ts` 对齐：

1. 从当前工作目录识别 Agent 范围：位于 `apps/<agent>` 时，使用 `user_id: "apps/<agent>"`。无法识别时不要回退到全局查询，应请用户确认目标 Agent。
2. 固定使用 `k: 5`。
3. `openmemory_query` 没有 `min_score` 参数。收到结果后必须从结构化结果中仅保留 `score >= 0.6` 的候选；无 `score` 的候选视为不满足条件。
4. `min_salience` 是额外的服务端过滤条件；仅在用户明确要求“重要记忆”或给出阈值时加入，不能替代 `score >= 0.6` 的客户端过滤。

## 执行步骤

### Step 1: 解析查询

从用户输入中提取关键词(2-6 字最佳)。

如果用户只说"搜一下"没给关键词,问:"你想查什么?"

### Step 2: 调用 query tool

调用 `mcp__longmemory__openmemory_query`,参数:

- `query`: 用户关键词或原话
- `k`: 固定 5
- `user_id`: 当前 Agent 的 `apps/<agent>` 范围

可选优化:

- **用户说"找决策/约定"**: 加 `sector: "semantic"`
- **用户说"找历史事件"**: 加 `sector: "episodic"`
- **用户说"找流程/模式"**: 加 `sector: "procedural"`
- **用户说"只想要重要的"**: 加 `min_salience: 0.5`

### Step 3: 格式化输出

工具返回结果包含两段:

1. **人读文本**:格式如 `1. [semantic] score=1.227 salience=1.000 id=138c3b35-... \n<content>`
2. **结构化 JSON**:完整对象数组

必须以结构化 JSON 的 `score` 执行 `score >= 0.6` 过滤，再展示过滤后候选的人读内容或等价摘要；不要把低分候选直接输出给用户。

如果有结果,可以补一句:"完整 ID 见原始输出。"

如果过滤后没结果,补:"没有找到与 '<query>' 相关且评分不低于 0.6 的记忆。"

## 不做的事

- 不修改任何记忆(只读)
- 不删除任何记忆
- 不在结果里塞额外解释(LLM 自己根据结果回复用户)
- 不展示 `score < 0.6`、无 `score` 或不属于当前 `user_id` 范围的候选

## 错误处理

- tool 失败(超时/连接错)→ 告诉用户:"LongMemory 暂时连不上,无法搜索。"
- 不要假装查到了