# Deprecated Skills

存放已弃用、不再维护的 skill。目录内的 skill 不参与根目录 `remote-*/` 校验、不再随仓库同步。

## 约定

- 整目录搬入：把要弃用的 `remote-<name>/` 完整剪切到本目录，目录名保持原样（例如 `deprecated/remote-old-tool/`）
- `SKILL.md` 保留：仍保留 `name:` 字段，但顶部加一行弃用说明，例如：

  ```markdown
  ---
  name: remote-old-tool
  description: Use when 已弃用，仅供历史代码参考，不再更新。
  ---

  # remote-old-tool（已弃用）

  弃用原因 / 替代 skill：`<新 skill 名>`
  ```

- 不再发布：cc-switch / Codex installer 不会扫描本目录，不会被分发到 `~/.codex/skills/`

## 何时放进这里

- 业务规则已变更、文档不再反映现状
- 已有新 skill 完整覆盖其使用场景
- 工具链 / 平台已下线（对应命令、API 不可用）