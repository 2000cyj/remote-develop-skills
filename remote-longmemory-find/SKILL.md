---
name: remote-longmemory-find
description: 按 ID 查找 LongMemory 中某条记忆的完整内容。当用户提供了引用 ID(如 `[lm:abc12345]`)、想看 search 结果里某条的完整内容、或者直接给了记忆 ID 时使用。
---

# LongMemory 按 ID 查找

查看一条特定记忆的完整内容。

## 适用场景

- 用户给了形如 `[lm:abc12345]` 的引用(常出现在之前的 search 结果里)
- search 后用户说"看第 2 条的完整内容"
- 用户直接说"找 ID 是 xxx 的那条"
- 用户问"那条记忆原话是什么"

## 工具

调用 `mcp__longmemory__openmemory_get`。

## 工具参数(对齐 longmemory 真实 schema)

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `id` | string | ✅ | — | **完整 UUID**(longmemory 不接受短 hex 前缀) |
| `include_vectors` | bool | ❌ | `false` | 是否包含向量元数据(默认 false,够用) |
| `user_id` | string | ❌ | — | 校验归属(可选,通常不用) |

⚠️ **关键限制**:`id` 必须是**完整 UUID**(形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`),**不接受 8 位短 hex**。如果用户给了短 hex,需要先用 `longmemory-search` 查到完整 ID。

## 执行步骤

### Step 1: 解析 ID

从用户输入抽 UUID:

- `[lm:abc12345-...-...]` → `abc12345-...-...`
- "找完整 ID 是 xxx-xxx-xxx-xxx 的那条" → 直接用

**如果用户只给了 8 位短 ID**(没有完整 UUID):

1. 先调 `mcp__longmemory__openmemory_list`,`limit: 50`
2. 找出 `id.startsWith(短 hex)` 的那条
3. 用完整 ID 调 get

如果完全抽不到 ID,问用户:"请提供完整 UUID(可在 search 结果里复制)。"

### Step 2: 调用 get tool

调用 `mcp__longmemory__openmemory_get`,参数:

- `id`: 上一步拿到的完整 UUID
- `include_vectors`: 默认 false(够用,除非用户明确说要看向量)

### Step 3: 展示详情

工具返回的 content 文本就是 longmemory 的格式化输出,直接展示。

如果用户想看 metadata 字段(JSON 格式),可以用 search 的原始 JSON 输出里的 metadata 字段,或重新 list 拿。

## 不做的事

- 不修改或删除(只读)
- 不自动跳转其他相关记忆
- 不展示超过 1 条

## 错误处理

- tool 返回 `"Memory <id> not found."` → 告诉用户:"未找到 ID 为 <id> 的记忆。"
- tool 失败 → 告诉用户:"LongMemory 暂时连不上,无法查询。"