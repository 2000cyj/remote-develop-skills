# Orca Workflow Runner

本目录同时保留两类**互不兼容**的资料：

## 现有：Worktree Workflow Runner

以下文件属于现有的 Worktree 工作流 runner：

- `workflow.yaml`：runner 配置。
- `workflow-runner.mjs`：runner 生命周期脚本。
- `state/`：按 workflow ID 保存运行状态。

该 runner 会管理 Worktree，并且只接受 `workflow.yaml` 对应的配置结构。

## 新增：工作组声明式流程设计

以下文件只定义工作组终端、经理编排、Orca 通信与阶段交付；**不包含可执行的配置加载器或 runner**：

- [orca-work-orchestration/workgroup-orchestration-workflow.md](./orca-work-orchestration/workgroup-orchestration-workflow.md)：完整流程、目录解析、异常决策与阶段交付规范。
- [orca-work-orchestration/workgroup.example.yaml](./orca-work-orchestration/workgroup.example.yaml)：声明式配置示例。

`workgroup.example.yaml` **不能**作为 `workflow-runner.mjs` 的输入，也不能通过 `--config workgroup.example.yaml` 调用现有 runner。两套配置请勿混用；工作组设计当前不定义项目目录创建、仓库、分支或版本控制规则。

## 目录

- `workflow.yaml`：静态工作流配置
- `workflow-runner.mjs`：工作流生命周期脚本
- `package.json`：脚本独立依赖，不污染项目业务依赖
- `state/`：按 workflow ID 保存运行状态

## 安装依赖

在项目根目录执行：

```powershell
pnpm --dir docs/orca-wortree install
```

Node.js 仍然使用全局安装的 `node` 执行，YAML 解析器只安装在本目录。

## 命令

```powershell
node docs/orca-wortree/workflow-runner.mjs validate
node docs/orca-wortree/workflow-runner.mjs dry-run
node docs/orca-wortree/workflow-runner.mjs create
node docs/orca-wortree/workflow-runner.mjs sync
node docs/orca-wortree/workflow-runner.mjs status
node docs/orca-wortree/workflow-runner.mjs retry
node docs/orca-wortree/workflow-runner.mjs pause
node docs/orca-wortree/workflow-runner.mjs resume
node docs/orca-wortree/workflow-runner.mjs archive
node docs/orca-wortree/workflow-runner.mjs cleanup
node docs/orca-wortree/workflow-runner.mjs cleanup --delete-worktrees
```

`validate` 和 `dry-run` 不会调用 Orca 创建资源。

`create` 与 `sync` 会复用 `state/<workflow-id>.json` 中已有的 Run、Task 和 Worktree 记录，不会重复创建已经记录的资源。

脚本默认不重试失败任务，使用 `retry` 才会重新启动失败 Worker；默认不删除 Worktree，只有显式传入 `--delete-worktrees` 才会请求删除。

## 使用前

1. 编辑 `workflow.yaml`，至少修改 `run.objective` 和 Worker 任务说明。
2. 为每个 Worker 保持稳定、唯一的 `id`。
3. 先运行 `validate` 和 `dry-run`。
4. 确认配置后执行 `create` 或 `sync`。

## 状态

运行状态保存在：

```text
docs/orca-wortree/state/<workflow-id>.json
```

不要手动删除状态文件，否则脚本无法知道之前创建的 Orca 资源，下一次 `sync` 可能重新创建资源。
