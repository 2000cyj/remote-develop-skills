---
name: remote-commit-git
description: Use when 在 git 仓库里有一批混合变更(业务代码 / 配置 / 文档 / 依赖)需要按 conventional commits 拆成多个语义内聚的 commit 并推送(单仓库或多 monorepo 嵌套子仓库),或在 commitlint + lint-staged + changesets 仓库里做"安全分批提交";不要用于 1-2 个文件的小改动,或用户明确要求单 commit 的场景。
---

# remote-commit-git

把一批混合变更按 conventional commits 拆成多个独立 commit 并推送,适用于单仓库或 monorepo 嵌套子仓库场景。本 skill 不管具体业务代码,只管"怎么把 staged 变更切成干净的 commit 系列"。

## 适用与不适用

### 适用

- 一次会话里改了多类文件(代码 + 配置 + 文档 + 依赖),需要按语义分批提交,而不是 1 个 mega-commit
- 仓库遵循 conventional commits + commitlint,`commit-msg` 钩子会拦截格式错的提交
- 仓库使用 lint-staged(commit 时自动 lint+prettier 暂存区)
- monorepo 里有嵌套子仓库(`apps/<name>/.git`),需要父、子分别 commit + push

### 不适用

- 只有 1-2 个文件的小改动 → 直接 `git add` + `git commit -m` 即可
- 用户明确说"就一个 commit"
- 不是 git 工作流(如改 svn、hg、文件本地落盘)→ 用对应工具

## Workflow

按以下顺序执行,不可跳步。

### 1. 摸底(必做)

```bash
git remote -v            # 确认远端 URL,推出目标平台(gitee / github / gitlab)
git status              # 看清变更全貌
```

**关键检查**:

- **危险文件**:如果看到 `.turbo/` / `node_modules/` / `dist/` / `*.log` / `.env` 等被 stage,**立刻 `git restore --staged <path>` 撤回**。这些通常应被 `.gitignore` 排除,如果漏配,在 commit 前补到 `.gitignore`。
- **嵌套子仓库**:看到 `?? apps/<some>/` 之类的整目录 untracked,**先 `ls apps/<some>/.git`**。有 `.git` 说明这是独立的子仓库(不是普通 package),不要 add 它(会被当 gitlink),而是在根 `.gitignore` 屏蔽整个目录,由子仓库自己管。
- **行尾警告(LF will be replaced by CRLF)**:Windows + LF Prettier 配置常见,不阻断,但要知道 commit 后远端会是 CRLF(若团队需要纯 LF,需先 `git config core.autocrlf false`)。
- **`git status --short` 与 `git diff --stat` 不一致**:autocrlf 会让 status 报一堆假阳性 modified;**提交前以 `git diff --cached --stat` 为准**,不要被 status 数字吓到。

### 2. 设计 commit 边界

按"语义原子性"切分,常见拆法:

| 类型        | 触发场景                            | 例                                                      |
| ----------- | ----------------------------------- | ------------------------------------------------------- |
| `build:`    | 构建/类型检查/test 工具链、产物配置 | `build: 引入构建、类型检查与测试工具链`                 |
| `feat:`     | 新增功能模块                        | `feat: 引入 turbo 任务编排与 pnpm catalog 集中管理版本` |
| `feat:`     | 新增工具/工作流                     | `feat: 引入 changesets 管理 monorepo 版本与发包`        |
| `docs:`     | 文档/注释/README                    | `docs: 更新 README.md 反映完整工具链`                   |
| `chore:`    | 不影响功能的杂项                    | `chore: 升级 typescript 至 5.9`                         |
| `fix:`      | bug 修复                            | `fix: 修复构建产物 main 入口错误`                       |
| `refactor:` | 重构(无新功能)                      | `refactor: 重构 utils 包目录结构`                       |

**每条 commit 的文件清单要可独立 review**。一个 commit 内如果同时改"业务逻辑 + 工具配置 + 文档",说明切得太粗。

### 3. 拆分 staging(逐个 commit 准备)

```bash
# 重置暂存区到 HEAD,从干净状态开始按 commit 边界 add
git reset HEAD              # 全部撤回 working tree

# 第一个 commit
git add <files-of-commit-1>
git status --short | grep -E "^[AMDR] "   # 核对 staging

# commit(中文 message,commitlint 不拦截正文语言)
git commit -m "..."
```

**经验**:`git commit -m` 用多行字符串(heredoc 或 `-m "..." -m "..."` 或 `printf` 内嵌换行)写详细正文,比单行 `m "type: 主题"` 信息量大很多。

### 4. 每个 commit 前核对 staging

```bash
git diff --stat --cached     # 看本次 commit 会改多少行、哪些文件
```

**核对清单**:

- [ ] 没有误入危险文件(`.turbo/`, `dist/`, `node_modules/`)
- [ ] 没有漏文件(应该一起的概念性文件都 stage 了)
- [ ] 没有多文件(超出本 commit 语义的改了)

### 5. commit 后核对

```bash
git status                   # working tree 应剩部分变更,已 commit 部分消失
git log --oneline -n <count>  # 看 commit 顺序、message 是否清晰
```

### 6. 全部 commit 完成,推送

```bash
git status                   # 必须 working tree clean
git log --oneline origin/master..HEAD   # 看本批有几条 commit
git push origin <branch>     # 默认 master
```

### 7. 多仓库工作流(嵌套子仓库场景)

结构示例:父 `remote-monorepo/` + 子 `apps/remote-control-vue3/`(独立 gitee 仓库)。**每个仓库独立 commit + push,互不污染**。

#### 7.1 摸底时识别所有仓库

```bash
# 在父仓库根目录
git status                              # 父仓库的变更
ls apps/*/.git 2>/dev/null              # 找出所有嵌套子仓库的 .git
# 然后对每个子仓库,逐个 cd 进去看状态:
for d in apps/*/; do
  [ -d "$d/.git" ] && echo "=== $d ===" && git -C "$d" status --short
done
```

#### 7.2 文件归属规则(自动分流)

按"文件的最近 git 根目录"分流:

| 仓库      | 归属判据                       | 远端(以 gitee 为例)                                    |
| --------- | ------------------------------ | ------------------------------------------------------- |
| 父仓库    | 除子仓库目录外的所有文件       | `https://gitee.com/<user>/<parent-repo>.git`            |
| 子仓库    | `apps/<child-name>/` 下所有文件 | `https://gitee.com/<user>/<child-repo>.git`             |

父仓库必须在 `.gitignore` 屏蔽子仓库目录(如 `apps/remote-control-vue3/`),否则父仓库 `git status` 会把它当 embedded git repo。

#### 7.3 串行 commit(按依赖顺序:子 → 父)

```bash
# 第一步:子仓库先 commit + push(父仓库的 catalog/lock 改动会引用子仓库声明的依赖,先子后父更稳)
cd apps/remote-control-vue3
# 走一遍前面 1-6 步的流程(摸底/设计边界/staging/commit)
git push origin master
cd ../..

# 第二步:父仓库 commit + push
cd <parent-root>
# 走一遍 1-6 步,注意 .gitignore 已经屏蔽了子仓库目录
git push origin master
```

**为什么先子后父**:子仓库的 `package.json` 引用父仓库 catalog 里的版本(如 `vue: catalog:`),先推子仓库再推父仓库的 catalog 更新,远端历史更连贯;反过来,父仓库先推 catalog 但子仓库还没声明 catalog 引用,中间会出现"孤儿 commit"。

#### 7.4 失败回滚

如果子仓库 push 失败:

1. **不要回滚父仓库已推的 commit**(父子仓库是独立历史,父仓库的 commit 不依赖子仓库的状态)
2. 检查子仓库远端认证、branch 名冲突
3. 修好后单独重 push 子仓库
4. 父仓库不用动

#### 7.5 不要用 git submodule 强行挂回父仓库

用户说"两个 git 分别识别,互不相关"→ 直接按 7.3 走。**不要**用 `git submodule` 把子仓库挂回父仓库——会丢失子仓库独立的 commit 历史与远端 URL 配置。

## Response Shape: commit message 模板(中文)

```text
<type>: <一句话主题,不超 50 字>

<正文段落 1: 改了哪几个维度>
- <维度 1>
- <维度 2>
- <维度 3>

<正文段落 2: 关键动机/取舍(可选)>
- <为什么这么做>
- <踩过的坑,以及规避方法>

<正文段落 3: 副作用/兼容(可选)>
- <依赖升级影响>
- <行为变更>
```

**示例**:

```text
feat: 引入 turbo 任务编排与 pnpm catalog 集中管理版本

turbo 负责拓扑执行 + 本地构建缓存,二次构建全缓存命中仅 ~30ms
- 新增 turbo.json 声明任务图:build/typecheck/test dependsOn ^build,
  dev 任务 cache:false + persistent,format/commit 等交互任务不缓存
- 根 scripts 的 build/typecheck 切换为 turbo run

pnpm catalog 集中管理多包共用工具版本,后续升级改一处即可
- pnpm-workspace.yaml 新增 catalog 块,声明 typescript/tsup/vue/vite/
  @vitejs/plugin-vue/vue-tsc/vitest/@vue/test-utils/jsdom 共 9 个工具
- 各 package.json 改用 catalog: 引用,不再重复写版本号
```

## Required Constraints

### commitlint 规则(强制)

- **type 必须小写、必填**:`Feat:`、`DOCS:` 都会被拒。
- **subject 必须小写**:`subject-case` 规则禁止 sentence-case / start-case / pascal-case / upper-case。`docs: CLAUDE.md ...`、`chore(eslint): ...` 都会被拒;`docs: claude.md ...` 才过。**subject 里出现的文件/工具名(CLAUDE.md、ESLint、Vue)也得小写或避开**(实在避不开就用 `claude.md`、`eslint`、`vue` 这样的全小写)。
- **header 不超 100 字符**(默认 `header-max-length`),正文不限。
- **正文每行不超 100 字符**(`body-max-line-length`)。中文按字符数算,1 字符算 1,一行中文约可写 ~33 字,**写正文时心里默念"超 30 个中文字就换行"**。

### 通用踩坑(强制规避)

1. **pnpm/npm 内置命令会劫持同名 script**:`pnpm version` 调的是 npm version,不是你的 `version` script。如果必须用同名,加前缀(如 `release:version`)。
2. **`.turbo/` 即使在 `.gitignore` 也可能被 stage**:先用 `git restore --staged .turbo/` 撤回。
3. **lint-staged 会自动 add 它修改的文件**:commit 完可能发现多了几个文件(被 prettier 改的),正常。
4. **大文件 / 二进制文件**:如果不该进仓库(如 `*.tar.zst`),必须 `.gitignore` + `git rm --cached`。
5. **changeset 工作流**:`.changeset/*.md`(具体的 changeset 内容)不提交(因为 `release:version` 会自动删);但 `.changeset/config.json` 和 `.changeset/README.md` **要提交**(配置/文档)。
6. **嵌套子仓库(embedded git repo)**:本仓库 `apps/remote-control-vue3/` 是独立 git 仓库(自带 `.git`,有自己的 gitee 远端),不是普通 workspace package。父仓库 `git status` 会显示 `?? apps/remote-control-vue3/`(整个目录未追踪),`git add` 时 git 会把它当 gitlink 提示 `adding embedded git repository`——这种状态下文件不会被追踪。**处理方式**:根 `.gitignore` 加 `apps/remote-control-vue3/` 把整目录屏蔽,父仓库完全不管它,由子仓库自己提交到自己的远端。
7. **`git status --short` vs `git diff --stat` 可能不一致**:`git status --short` 显示 6 个文件 modified,但 `git diff --stat` 可能只显示 3 个真实改动。**提交前一定要用 `git diff --cached --stat` 确认 staging 区到底是什么**,不要信 `--short` 的初始数字。
8. **`core.autocrlf=true` 会让 git status 报一堆假阳性**:`git status` 显示 25 个文件 modified,但 `git diff --stat` 只显示 2 个真改动,其余是 autocrlf 把 LF 转 CRLF 的"将 LF 替换为 CRLF"警告。**多仓库工作流下,父仓库 status 里看到所有 packages/* 与 apps/* 都 modified 但 diff 空,基本就是这个原因**,提交时只看 diff 为准,不要被 status 的 modify 数量吓到。永久解决:`git config core.autocrlf false`(若团队能接受 LF 提交)。

## 完成检查清单

- [ ] `git status` 干净(全部 commit)
- [ ] `git log --oneline origin/master..HEAD` 列出本批 commit
- [ ] 每条 commit message 格式:`<type>(<scope>): <subject>` 或 `<type>: <subject>`
- [ ] 每条 commit 文件清单语义内聚
- [ ] `git push origin <branch>` 成功
- [ ] 远端 git log 显示本批 commit
- [ ] monorepo 场景下,父子仓库分别 push 成功,父仓库 `.gitignore` 屏蔽子仓库目录