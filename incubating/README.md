# Incubating Skills

存放正在开发、尚未发布的 skill。目录内的 skill 不参与根目录 `remote-*/` 校验，不被 cc-switch / Codex installer 同步分发。

## 约定

- 整目录存放：`remote-<name>/` 完整放在本目录，目录名保持 `remote-<name>`（例如 `incubating/remote-new-tool/`）
- `SKILL.md` 顶部 frontmatter 加 `status:` 字段标注当前阶段，可选值：`draft` / `wip` / `review` / `ready`
- 文件结构与根目录一致：`SKILL.md` + 可选 `references/`、`agents/`、`scripts/`

```markdown
---
name: remote-new-tool
description: Use when …（一句话描述用途）
status: wip
---

# Remote New Tool

…内容…
```

## 何时放进这里

- 想法已经成型、开始写 `SKILL.md` 草稿
- 已有初版但在补 references / 验证工作流
- 想让同事看一遍再决定是否发布（`status: review`）

## 毕业：发布到根目录

满足以下条件后挪到仓库根、加入根 `README.md` Skill 索引：

1. `status: ready`，SKILL.md 描述准确、references 自洽
2. 通过根 README 末尾的 `Skill 校验` 脚本
3. 提交时单独一个 `feat(skills):` commit，便于回滚

## 放弃：转交 `deprecated/`

迭代中发现方向错了 / 已被新方案覆盖 → 整目录移到 `deprecated/`，按那边的约定补弃用说明。