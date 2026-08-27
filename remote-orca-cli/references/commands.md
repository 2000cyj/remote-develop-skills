# Orca CLI 18 类命令速查

> Orca 小版本会增/改子命令。要拿权威 schema，运行时跑：
>
> ```bash
> orca agent-context --json
> ```
>
> 输出含 `schemaVersion`、`commandCount`、每条命令的 `path / flags / examples / notes`。本地缓存本文件时在文件头注释 `orca <version>` 与日期。

来源：`orca --help` 顶层分类（2026-08-22 抓取），共 **18 类 / 232 个子命令**（`commandCount: 232`，`schemaVersion: 1`）。

## 18 类分组

| # | 分类 | 一行说明 | 高频子命令 |
|---|---|---|---|
| 1 | Startup | 启 Orca 桌面端或 headless server | `open`、`serve`、`status` |
| 2 | Diagnostics | 抓 runtime 快照 | `diagnostics memory` |
| 3 | Agent Discovery | 机器可读命令 schema（agent 用） | `agent-context` |
| 4 | Accounts | 托管 Claude / Codex 账号 | `account add`、`account list` |
| 5 | Skills | 安装/分发 Orca **自带** skill | `skills list`、`skills installed`、`skills get`、`skills install`、`skills update`、`skills share` |
| 6 | Environments | 已配对的远程 runtime | `environment add`、`list`、`show`、`rm` |
| 7 | Environment Recipes | per-workspace 沙箱/VM 校验 | `vm recipe doctor` |
| 8 | Automations | 计划任务 | `automations list/show/create/edit/remove/run/runs` |
| 9 | Projects | 跨 host 的 project host setup | `project list/setups/setup-*` |
| 10 | Repos | 已登记的 git repo | `repo list/add/show/set-base-ref/search-refs` |
| 11 | Worktrees | Orca 维护的 worktree | `worktree list/show/current/create/set/rm/ps` |
| 12 | Files | 在 Orca 编辑器中打开文件 | `file open`、`file diff`、`file open-changed` |
| 13 | Terminals | 受 Orca 管理的终端会话 | `terminal list/show/read/send/wait/stop/create/rename/split/switch/focus/close` |
| 14 | Orchestration | 多 agent 编排（线程消息 / ask-reply / DAG / 决策门） | `orchestration run-create/run-use/send/check/ask/reply/dispatch/worker-*/gate-*/coordinator-*/reset` |
| 15 | Computer Use | 通过 a11y tree 操作桌面 app | `computer capabilities/permissions/list-apps/list-windows/get-app-state/click/scroll/drag/type-text/press-key/hotkey/...` |
| 16 | Linear | Linear 工单读写 | `linear ...` |
| 17 | Mobile Emulator (iOS Simulator) | iOS 模拟器 | `emulator list/attach/tap/type/gesture/button/rotate/exec/kill` |
| 18 | Browser Automation | Orca 内嵌浏览器 | Tab 管理：`orca tab create/list/show/current/switch/close`；页面操作：`orca goto/back/forward/reload/snapshot/click/fill/type/select/hover/keypress/scroll/wait/screenshot/full-screenshot/eval/dialog/pdf` |

> 注意：`orca --help` 把 `Computer Use` / `Linear` / `Mobile Emulator` / `Browser Automation` 列成顶层分类，但 `agent-context --json` 把这些命令展开成了顶层 path（如 `computer`、`linear`、`emulator`、`tab`、`click`）。`agent-context --json` 的 `commandCount: 232` 是去重后的权威数字。

## 8 个高频子命令最小示例

```bash
# 1. 启动 / 看状态
orca open                                  # 启 Orca 桌面端并等 runtime 可达
orca status --json                         # 看 app/runtime/graph 就绪状态
orca serve --project-root <path>           # 无窗口起 runtime

# 2. 拿权威 schema（agent 用）
orca agent-context --json                  # 永远可跑，无需 runtime

# 3. 建 worktree 并直接拉 agent
orca worktree create \
  --repo name:bi-cashier \
  --name agent-task-1 \
  --agent codex \
  --prompt "开始实现 X 工单"

# 4. 在已有 worktree 追加新 agent（更轻量）
orca terminal create \
  --worktree active \
  --command codex

# 5. 读 / 等终端
orca terminal read --terminal term_123
orca terminal wait --terminal term_123 --for exit --timeout-ms 60000 --json

# 6. 列已登记 repo / worktree
orca repo list
orca worktree list --worktree active

# 7. 跨 agent 发消息
orca orchestration send --run <run-id> --to <recipient> --subject "hi" --body "message" --json

# 8. 内嵌浏览器四步走
orca tab create --url https://example.com
orca snapshot                                # 拿 element ref（@e1, @e2...）
orca click --element @e3
orca fill --element @e5 --value "search query"
```

## 8 个高频子命令最小示例

```bash
# 1. 启动 / 看状态
orca open                                  # 启 Orca 桌面端并等 runtime 可达
orca status --json                         # 看 app/runtime/graph 就绪状态
orca serve --project-root <path>           # 无窗口起 runtime

# 2. 拿权威 schema（agent 用）
orca agent-context --json                  # 永远可跑，无需 runtime

# 3. 建 worktree 并直接拉 agent
orca worktree create \
  --repo name:bi-cashier \
  --name agent-task-1 \
  --agent codex \
  --prompt "开始实现 X 工单"

# 4. 在已有 worktree 追加新 agent（更轻量）
orca terminal create \
  --worktree active \
  --command codex

# 5. 读 / 等终端
orca terminal read --terminal term_123
orca terminal wait --terminal term_123 --for exit --timeout-ms 60000 --json

# 6. 列已登记 repo / worktree
orca repo list
orca worktree list --worktree active

# 7. 跨 agent 发消息
orca orchestration send --run <run-id> --to <recipient> --subject "hi" --body "message" --json

# 8. 内嵌浏览器四步走
orca tab create --url https://example.com
orca snapshot                                # 拿 element ref（@e1, @e2...）
orca click --element @e3
orca fill --element @e5 --value "search query"
```

## 浏览器自动化完整方案

### 1. 先确认 Orca runtime

浏览器命令需要当前 Orca runtime 可达。先执行：

```bash
orca status --json
```

至少确认以下状态：

```json
{
  "result": {
    "app": { "running": true },
    "runtime": { "state": "ready", "reachable": true },
    "graph": { "state": "ready" }
  }
}
```

如果桌面端没有启动：

```bash
orca open
```

无窗口或服务器环境：

```bash
orca serve --project-root <path>
```

需要读取当前版本的精确命令、参数和能力时：

```bash
orca agent-context --json
```

`agent-context --json` 可在没有运行 Orca app 时使用，适合 SSH、CI 和 headless 场景。它是命令 schema 的权威来源；不要只依赖旧版文档中的子命令名称。

### 2. 创建浏览器 Tab

打开 URL 并创建新 Tab：

```bash
orca tab create \
  --url https://example.com \
  --json
```

在指定 worktree 中创建：

```bash
orca tab create \
  --url https://example.com \
  --worktree active \
  --json
```

指定浏览器 profile：

```bash
orca tab create \
  --url https://example.com \
  --profile <profile-id> \
  --json
```

记录返回结果中的页面 ID。不同版本字段可能略有差异；后续多次操作前，优先用 `orca tab list --json` 确认 `browserPageId`。

### 3. 管理多个 Tab

```bash
# 列出所有 Tab，并拿到 browserPageId
orca tab list --json

# 查看当前 Tab
orca tab current --json

# 查看指定 Tab
orca tab show --page <browser-page-id> --json

# 切换到指定 Tab
orca tab switch --page <browser-page-id> --json

# 按索引切换
orca tab switch --index 0 --json

# 关闭 Tab
orca tab close --index 0 --json
```

多 Tab 场景推荐保存页面 ID：

```bash
page_id=$(orca tab list --json | jq -r '.tabs[0].browserPageId')
```

如果 JSON 字段因版本变化不匹配，先直接查看 `orca tab list --json` 的实际输出，再使用返回的页面 ID。

### 4. 页面导航

以下命令操作当前 Tab；多 Tab 时追加 `--page <browser-page-id>`：

```bash
# 打开 URL
orca goto --url https://example.com/login --page <browser-page-id> --json

# 返回上一页
orca back --page <browser-page-id> --json

# 前进
orca forward --page <browser-page-id> --json

# 刷新
orca reload --page <browser-page-id> --json
```

### 5. 等待页面状态

等待页面加载完成：

```bash
orca wait \
  --load networkidle \
  --timeout 30000 \
  --page <browser-page-id> \
  --json
```

等待文字出现：

```bash
orca wait \
  --text "登录成功" \
  --timeout 30000 \
  --page <browser-page-id> \
  --json
```

等待 URL 匹配：

```bash
orca wait \
  --url "**/dashboard**" \
  --timeout 30000 \
  --page <browser-page-id> \
  --json
```

等待 JavaScript 条件：

```bash
orca wait \
  --fn "document.readyState === 'complete'" \
  --timeout 30000 \
  --page <browser-page-id> \
  --json
```

等待元素状态：

```bash
orca wait \
  --selector "button[type=submit]" \
  --state visible \
  --timeout 30000 \
  --page <browser-page-id> \
  --json
```

### 6. 获取 accessibility snapshot

操作网页元素前，必须先获取当前页面的 accessibility snapshot：

```bash
orca snapshot \
  --page <browser-page-id> \
  --json
```

snapshot 会列出可操作元素和临时 ref，例如：

```text
@e1  textbox  用户名
@e2  textbox  密码
@e3  button   登录
```

后续操作使用 snapshot 中的 element ref：

```bash
orca click --element @e3 --page <browser-page-id> --json
```

### 7. 点击、填写和选择

点击元素：

```bash
orca click \
  --element @e3 \
  --page <browser-page-id> \
  --json
```

清空并填写输入框：

```bash
orca fill \
  --element @e1 \
  --value "username" \
  --page <browser-page-id> \
  --json
```

在当前焦点输入文本：

```bash
orca type \
  --input "需要输入的文本" \
  --page <browser-page-id> \
  --json
```

选择下拉选项：

```bash
orca select \
  --element @e5 \
  --value "option-value" \
  --page <browser-page-id> \
  --json
```

悬停：

```bash
orca hover \
  --element @e6 \
  --page <browser-page-id> \
  --json
```

按键：

```bash
orca keypress \
  --key Enter \
  --page <browser-page-id> \
  --json
```

常见按键包括 `Enter`、`Tab`、`Escape`、`ArrowDown`、`ArrowUp`、`Backspace` 和 `Delete`。

### 8. 滚动

```bash
orca scroll \
  --direction down \
  --amount 600 \
  --page <browser-page-id> \
  --json
```

支持的方向包括 `up`、`down`、`left` 和 `right`。滚动后如果页面发生 DOM 变化，重新执行 snapshot。

### 9. 截图和 PDF

截取当前 viewport：

```bash
orca screenshot \
  --format png \
  --page <browser-page-id> \
  --json
```

截取完整页面：

```bash
orca full-screenshot \
  --format png \
  --page <browser-page-id> \
  --json
```

导出当前页面为 PDF：

```bash
orca pdf \
  --page <browser-page-id> \
  --json
```

### 10. 执行 JavaScript

在当前 Tab 页面上下文执行 JavaScript：

```bash
# 页面标题
orca eval \
  --expression "document.title" \
  --page <browser-page-id> \
  --json

# 当前 URL
orca eval \
  --expression "location.href" \
  --page <browser-page-id> \
  --json

# 页面文本
orca eval \
  --expression "document.body.innerText" \
  --page <browser-page-id> \
  --json
```

不要用 `eval` 绕过页面权限、认证机制、跨域限制或安全控制；需要登录时使用正常的页面交互流程。

### 11. 处理浏览器对话框

接受浏览器 JavaScript 对话框：

```bash
orca dialog accept \
  --page <browser-page-id> \
  --json
```

接受 prompt 并输入内容：

```bash
orca dialog accept \
  --text "输入内容" \
  --page <browser-page-id> \
  --json
```

取消对话框：

```bash
orca dialog dismiss \
  --page <browser-page-id> \
  --json
```

这里的 `dialog` 主要对应浏览器 JavaScript 的 alert/confirm/prompt，不一定等同于 Orca 桌面应用或操作系统原生 UI 对话框。

### 12. 完整示例：打开网页并搜索

```bash
# 1. 检查 runtime
orca status --json

# 2. 创建 Tab
orca tab create --url https://example.com --json

# 3. 获取稳定页面 ID
orca tab list --json
# 记下 tabs[].browserPageId

# 4. 获取页面元素
orca snapshot --page <browser-page-id> --json
# 假设搜索框是 @e2，搜索按钮是 @e3

# 5. 填写搜索框
orca fill --element @e2 --value "Orca browser" \
  --page <browser-page-id> --json

# 6. 点击搜索按钮
orca click --element @e3 \
  --page <browser-page-id> --json

# 7. 等待结果
orca wait --text "Orca browser" --timeout 30000 \
  --page <browser-page-id> --json

# 8. 页面变化后重新获取 snapshot
orca snapshot --page <browser-page-id> --json
```

### 13. 浏览器自动化硬规则

- 先运行 `orca status --json`，确认 app、runtime、graph 均 ready。
- 命令格式不确定时，运行 `orca agent-context --json` 获取当前版本 schema。
- `tab create` 负责创建 Tab；导航和交互使用顶层 `goto`、`snapshot`、`click`、`fill` 等命令。
- 多 Tab 时用 `orca tab list --json` 获取 `browserPageId`，后续命令显式传 `--page`。
- `snapshot` 返回的 `@e1`、`@e2` 等 ref 是临时引用，不是永久 DOM ID。
- 每次导航、刷新、点击导致 DOM 重渲染后，必须重新 snapshot；不能继续使用旧 ref。
- 机器读取优先使用 `--json`，并记录后续需要的 `browserPageId`。
- `tab` 是浏览器自动化；`computer` 是桌面应用 accessibility 自动化，不能混用。
- `dialog dismiss` 只处理浏览器对话框，不能保证关闭桌面应用原生窗口。
- 不要将账号、密码、Token、Cookie 等敏感值写入日志、报告或提交记录。



- `--json` — 机器可读输出（agent 首选）。
- `--help` — 子命令帮助；命令参数以当前版本 `--help` 或 `orca agent-context --json` 为准。
- `--pairing-code <code>` / `--environment <selector>` — 远程 runtime 入口；也可用环境变量 `ORCA_PAIRING_CODE` / `ORCA_ENVIRONMENT`。
- `--page <id>` — 浏览器 Tab 复用（`orca tab list --json` 拿 `browserPageId`）。
- `--worktree <selector>` — 指定操作所在 worktree；常用 `active` / `current` / `id:<uuid>` / `path:<path>`。

## 已登记的 repo / worktree（2026-08-22 抓取）

- **已登记 repo**：28 条，含 `bi-FOB/bi-{basics,basics-data,cashier,core,file,flowables,gateway,invoke,kingdee,logistics,message,monitor,openapi,pack,personnel,plan,product-factory,reorder,reorder-system,skill,sql,system}`、`ob_web` 三包（main / cashier / share）、独立 `cashier`、`remote-develop-skills` 自身（UUID `dad07f73-9067-453a-a903-e6ee42db434c`）。
- **同名歧义**：名为 `cashier` 的有 2 个 repo（`797c739d-...` micro-app vs `ccad9ddb-...` 独立 cashier），必须用 `id:<uuid>` 或 `path:<path>` 消歧。
- **当前 worktree**：本会话所在
  `0ee28200-afe7-44d0-aa4b-98f8110fa87f::C:/Users/20614/orca/workspaces/bi-cashier/dev-chenyanjun-one-3`，displayName `dev-chenyanjun-one-3`，父 `bi-cashier` 的 `dev-chenyanjun-one`。

## 不要做的事

- 不要把 `orca skills install` 当作本仓库 `remote-*` 的安装入口——它装的是 Orca 自带 skill，不是本仓库。
- 不要绕过 `orca` 命令直接 `git worktree add`——Orca 元数据会失同步。
- 不要在 SSH/无 runtime 时跑 `worktree create` / `terminal create`——只有 `agent-context` / `--help` 在无 runtime 下安全。