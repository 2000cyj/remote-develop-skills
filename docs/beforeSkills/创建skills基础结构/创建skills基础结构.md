# 创建 Skills 基础结构 —— jetlinks-develop-skills 学习心得

> 学习来源：https://github.com/jetlinks/jetlinks-develop-skills（master 分支）
> 用途：作为搭建自己 skills 的**结构与写法蓝图**

## 一、仓库整体组织

- 每个 skill 一个目录，**直接放在仓库根目录**，不套 `skills/` 子目录 —— 便于被只做浅层扫描的工具自动发现
- 仓库根目录放：`README.md`（仓库级说明）+ `SECONDARY_DEVELOPMENT_PLAYBOOK.md`（完整实践手册）+ 各 skill 目录
- 命名：`<项目前缀>-<领域>`（如 `jetlinks-conventions`），前缀区分项目/团队
- 每个 skill **自包含**、只保留运行所需文件；仓库级说明集中在根 README，**不要在 skill 目录里堆说明性文档**

## 二、技能目录结构

```
jetlinks-<domain>/          # 一个技能一个目录（目录名 = SKILL.md 的 name）
├── SKILL.md               # 必填：元数据 + 核心指令
├── references/            # 可选：细分主题的深度参考文档
├── agents/                # 可选：openai.yaml 子代理/接口定义
├── scripts/               # 可选：可执行脚本
└── assets/                # 可选：模板、schema 等静态资源
```

## 三、SKILL.md 写法（核心）

### 1. YAML Frontmatter

```yaml
---
name: jetlinks-conventions     # 必须与父目录名一致
description: >-                # 长场景描述，列举所有适用场景/触发条件
  ...
---
```

- `name`：小写 + 连字符，**必须与父目录名一致**
- `description`：**场景化** —— 列举这个 skill 适用的所有情况，是智能体判断"用不用它"的依据

### 2. 正文结构

```
# Title

Read references/xxx.md first.        # 首读引导（把最该先读的参考点出来）

## Workflow                            # 有序工作流步骤
1. ...
2. ...

## Required Constraints               # 硬约束（红线/倾向）
- Do not ...
- Prefer ...
- Use references/xxx.md when <具体场景>

## Response Shape                    # 输出格式要求
Conventions to follow
Adjacent files checked
...
```

### 3. 写法风格要点

- 正文用英文，约束用**祈使句**："Do not ..." / "Prefer ..." / "Use ... when ..." / "Keep ..."
- **场景化按需加载**：`Use references/xxx.md when <具体场景>` —— 让智能体按需读深度文档，不一次性灌入
- **交叉引用其他 skill**：`$jetlinks-reactive`、`$jetlinks-router` —— 形成 skill 网络，跨领域时路由
- 每步工作流动作可指向具体 reference（"Load references/xxx.md and resolve ..."）
- 分两种文档语言：SKILL.md 用英文指令，references 用中文深度说明

## 四、references/ 深度参考

- 一个 skill 下按主题拆多个 md：`code-conventions.md`、`code-comments.md`、`i18n.md`、`tracing.md`、`mbean-observability.md`、`root-cause-and-no-hack-rules.md` ...
- 结构：`# 标题` + 用途说明 + `## 核心原则`（编号原则）+ `## 常见落地要求`（子节，如"导入与注解"）
- 文档之间可互相链接（`[root-cause-and-no-hack-rules.md](root-cause-and-no-hack-rules.md)`）
- **SKILL.md 只放流程与约束，细节全部下沉 references，按需加载** —— 控制单次上下文体积

## 五、agents/（openai.yaml）

```yaml
interface:
  display_name: "JetLinks Conventions"
  short_description: "..."
  default_prompt: >-
    (完整行为规则，编号列出 + 跨 skill 路由)
```

- Codex 风格：`interface.display_name / short_description / default_prompt`
- `default_prompt` 是核心：把 SKILL 规则完整落进 prompt，并带跨 skill 路由（如"落地完成切 $jetlinks-delivery"）

## 六、Skill 网络与场景路由

- **总入口 skill**（`jetlinks-router`）：任务分类与路由，不确定用哪个时走它
- **focused skills**：按场景直达（"只想做 CRUD → $jetlinks-crud"）
- 推荐用法：**优先直接使用 focused skill，不确定再走总入口**
- skill 内部也可路由：如"响应式根因落地切 $jetlinks-reactive""交付切 $jetlinks-delivery"

## 七、安装与分发（供参考）

- **CC Switch**：以仓库根目录为扫描入口，同步启用需要的 skill
- **Codex skill installer**：`Use $skill-installer to install skill from <url>`
- **手动**：把 skill 目录复制到 `~/.codex/skills/`
- 校验方式：用一个真实任务走一遍总入口 skill，确认分类路由正确

## 八、搭建自己 skills 的落地清单

1. 确定 skill 边界：每个 skill 一个领域，拆"总入口 + focused"
2. 目录放根目录，命名 `<前缀>-<领域>`
3. 先写 SKILL.md：场景化 `description` + `Workflow` + `Required Constraints` + `Response Shape`
4. 细节下沉 `references/`，SKILL.md 里用 "Use references/xxx.md when ..." 按需加载
5. 跨 skill 用 `$skill-name` 显式路由
6. 自包含、只留运行所需文件；说明文档集中放根 README
7. 需要 Codex 子代理时，agents/openai.yaml 用 `interface: display_name / short_description / default_prompt`
