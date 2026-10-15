# Quick Reference

**规范正文不在这里。** 归属表在 `02-audit-page-compliance.md`。

本文件只做两件事：给一张「我要干什么 → 读哪个文件」的路由，以及几条最容易忘的一行提醒。

## 路由

| 我要… | 读 |
|---|---|
| 审查一个业务块是否合规 | `02-audit-page-compliance.md` |
| 判断某个文件/常量该放哪 | `02-audit-page-compliance.md` 归属表 |
| 建新页面目录 | `01-create-new-page.md` |
| 改不合规目录 | `03-refactor-page.md` |
| 拿不准外层 vs 内层 | `04-shared-vs-private.md` |
| 嵌套 addOrEdit | `05-nested-addoredit.md` |
| 不知道该不该改 | `06-product-boundary.md` |
| 批量清 inline enum | `90-remediation-enum-playbook.md` |
| 批量清 inline type | `91-remediation-type-playbook.md` |
| 验收 | `11-must-use-remote-ts-es-check.md` |

## 最容易忘的 6 条

1. **逐文件 read 找违规，不用 grep。** 命令只匹配写法，必然漏检。
2. **类型全进 `types/index.ts`**——`interface` / `type` / 泛型 / 联合 / string union，一条例外都没有。
3. **`computed` 里的纯数据全部搬 config**：无响应式依赖 → 常量；有 → 方法，**值当参数传，禁止传 `Ref` / `Reactive` 容器**。
4. **建枚举前先查 `@/common/enum`**：公共 → 本块 `enum/` → 就近 `enum/`，三级都没有才建。
5. **改任何字面量值前 `git show HEAD:<file>`**，不一致就停并问 user。
6. **验收只扫本次改过的文件**，禁止全项目扫 / `--fix` / 裸跑 `vue-tsc`。
7. **禁转发别名**：`const rules = FORM_RULES` / `import { X as rules }` 全部不写——删掉转发行，模板直接用导入名。

## 7 项目录

```
src/pages/<业务模块>/
├── index.vue       列表页
├── addOrEdit/      新增/修改/详情
├── apis/           接口请求
├── components/     跨页共用组件（内层共用放 addOrEdit/components/）
├── config/         静态配置 / 工厂
├── enum/           字典 / 枚举 / 魔法值
├── utils/          工具（默认只有 index.ts）
└── types/          全部 type / interface
```

不预创建空目录；哪项业务存在才建哪项。

## 判定式（细则见 02）

| 声明种类 | 去哪 |
|---|---|
| `interface` / `type` | `types/index.ts` |
| `FormRules` | 纯静态 → `config/`；引 enum 工厂 → `enum/`；含 validator / 依赖 props → `config/` 方法 |
| `computed` | → `config/`（常量或方法，值当参数传） |
| 静态数组 / 字典 | `config/` 或 `enum/` |
| 工具函数 | `utils/index.ts` |
| 接口函数 | `apis/index.ts` |
| 枚举 / 魔法值 | 公共 enum → 本块 enum → 就近 enum |
| 状态 / 事件 / 副作用 | `.vue` 内 |
| 转发别名 `const rules = FORM_RULES` | **不写**——模板直接用导入名 |

## 维护

改这个 skill 前读 `CHANGELOG.md` 末尾的「维护流程」。**规范正文只写在 `02`，本文件只放链接。**
