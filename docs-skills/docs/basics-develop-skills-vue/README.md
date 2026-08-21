# Cashier Develop Web Skills

Cashier 出纳子应用开发技能仓库。每个 skill 一个目录，直接位于仓库根目录，自包含、便于扫描与分发。

结构参考 [jetlinks-develop-skills](https://github.com/jetlinks/jetlinks-develop-skills)。

## Repository Layout

```
basics-develop-skills-vue/
├── README.md
├── basics-button-permission-vue/      # 按钮操作权限
│   ├── SKILL.md
│   └── references/
├── basics-list-page-directory-vue/    # 列表页目录结构
│   ├── SKILL.md
│   └── references/
├── basics-permission-summary-vue/     # 权限汇总导出
│   ├── SKILL.md
│   └── references/
├── basics-ts-es-check-vue/            # TS & ESLint 静态检查
│   ├── SKILL.md
│   └── references/
└── basics-claude-hooks-vue/           # Claude Code hooks 使用说明
    ├── SKILL.md
    └── references/
```

## 约定说明

- 每个 skill 目录直接位于仓库根目录，方便只做浅层扫描的工具自动发现。
- 每个 skill 只保留运行所需文件：`SKILL.md`（必填）+ `references/`（可选深度参考）+ `agents/`（可选，Codex 用）。
- 仓库级说明放在本 README，不要在 skill 目录里额外堆叠说明性文档。
- `SKILL.md` 的 `name` 必须与父目录名一致；`description` 场景化，列出所有适用情况。

## Available Skills

**basics-button-permission-vue**

按钮操作权限统一标准。适用于给页面按钮（新增/查看/编辑/删除）添加操作权限控制，或改造现有按钮权限的命名、写法、兜底逻辑，确保全模块一致。

**basics-list-page-directory-vue**

列表页目录结构统一标准。适用于在 `src/pages/` 下新建页面/业务模块，或改造现有页面目录（7 项固定结构 + 递归嵌套 + 共用外层/独立当前）。

**basics-permission-summary-vue**

权限汇总导出。适用于把某个目录下所有按钮操作权限汇总成「结构化清单 + 可执行 SQL」，产出 3 个文件到目标目录 `docs/权限/`。

**basics-ts-es-check-vue**

TS & ESLint 静态检查。适用于提交前/改动后扫描 `src/` 质量、定位 vue-tsc / eslint 报错根因（TS2554、member-delimiter、valid-template-root 等），并区分 cashier 自身问题与 packages/share 既有问题。

**basics-claude-hooks-vue**

Claude Code hooks 使用说明。适用于判断某个自动化任务（检查、上下文注入、工具拦截、质量门等）该用 Skill 手动触发还是挂到某个生命周期 hook、选哪个事件（SessionStart/UserPromptSubmit/PreToolUse/Stop 等）、各阶段优缺点，以及新增/改造/排查 hooks 配置。

## Scenario Routing

推荐按场景直接使用 focused skill，不确定时先看各 skill 的 `description`：

| 场景 | skill |
|---|---|
| 给页面按钮加/改操作权限 | `$basics-button-permission-vue` |
| 新建/改造页面目录结构 | `$basics-list-page-directory-vue` |
| 总结/导出目录的按钮权限 SQL | `$basics-permission-summary-vue` |
| 按钮权限落地后整理权限码 | 先 `$basics-button-permission-vue` 规范码，再 `$basics-permission-summary-vue` 汇总 |
| 提交前/改动后扫描 TS & ESLint | `$basics-ts-es-check-vue` |
| 判断自动化任务挂哪个 hook / 看 hook 生命周期 | `$basics-claude-hooks-vue` |

## Usage

每个 skill 的 `SKILL.md` 是核心指令，`references/` 按需加载：

- 直接按 `SKILL.md` 的 Workflow 执行；
- 遇到细节（代码示例、格式模板、脚本）时，按 "Use references/xxx.md when ..." 加载对应参考；
- 落地完成后，`$basics-permission-summary-vue` 可汇总产出权限清单。
