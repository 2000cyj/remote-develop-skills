# format-unused-tailwind-checks

原入口细则与示例。按需读取；所有命令和修复均受入口的 task-files / changed-hunks 边界约束。示例中的全 src 搜索仅用于已知符号的只读引用追踪，不授权全项目扫描或批量修复。项目级类型检查只在用户明确要求时运行。规则冲突时以入口为准。

7. **格式嫌疑主动扫描**（即使 ESLint 0 报错也要做）：
   - **JSDoc 起始行同行接文字**（防 jsdoc/multiline-blocks）：grep 文件内所有 `/**` 行，若 `/**` 后紧跟非空字符（非换行、非空格引导的 ` *`），则该注释违规。修复：把首行 `/**` 单独成行，文字挪到下一行 ` * <text>`，未行用 ` */`。参考 `references/baseline-eslint.md` 中的 "jsdoc/multiline-blocks 形态"。
     ```bash
     grep -nE "^\s*/\*\* [^/\*\s]" src/ -r --include="*.ts" --include="*.vue" --include="*.js"
     ```
   - 命中 → Read 上下文确认是否为多行注释（不是首行就是单行注释）
   - 违规 → 手动调整 `/**` 起头位置，不加 `eslint-disable`
   - 不主动添加 `eslint-disable-next-line jsdoc/multiline-blocks` 绕过
8. **未使用代码主动扫描**（即使 ESLint 默认 0 报错也要做）：
   - **背景**：cashier 项目的 eslint.config.js 默认禁用了 `no-unused-vars`（避免误报 props/emits 等子类型），导致代码中的孤儿 import / 死代码变量 / 孤儿 API 函数 默认不会被 ESLint 报警。
   - **主动开启 no-unused-vars 扫一遍**（不写入项目配置，只在 CLI 加 `--rule`）：
     ```bash
     npx eslint <lint-files...> --rule '{"unused-imports/no-unused-imports":"error","no-unused-imports":"error","unused-imports/no-unused-vars":"error","no-unused-vars":"error","vue/no-unused-components":"error","vue/no-unused-vars":"error"}'
     ```
     命中 → 逐项 Read 上下文判断是"真死代码"还是"动态/反射场景假装豁免"。
   - **判断 "真死代码 vs 假装豁免"**：
     - 真死代码：删除 var/const/function/import 行，运行逻辑不变
     - 假装豁免（下划线前缀）：`const _xxx = ...`、`function _yyy() {...}`——这是错误的逃生口，下划线前缀让 ESLint 不报警但死代码仍存在，**必须直接删**。例外：`_<slot-name>` / `_event` 之类是 Vue 模板 slot 占位符或事件保留名，**保留**。
     - 动态场景：JSX/模板反射用法、props 解构、`v-for` 中 `:key`、模板字符串拼装的标识符——Read 上下文确认后再决定。
   - **下划线前辍死代码主动扫描**（grep 不依赖 ESLint 配置）：
     ```bash
     # 找出声明的下划线前辍变量/函数/常量（疑似死代码逃生口）
     grep -nE '(const|let|function|class)\s+_\w+\s*[=(:]' src/ -r --include="*.ts" --include="*.vue"
     ```
     命中 → 逐项 Read 上下文确认：
     - 如果被引用（如 `_handleAddRowToQueue(companyId)`）→ 合法命名，保留
     - 如果仅声明无引用 → **真死代码，删掉**
     - 不要"为了安全再加下划线"
   - **孤儿 API 函数扫描**（声明了 `export function` 但全局无调用方）：
     ```bash
     # 找出 apis 目录的所有 export 函数
     grep -nE '^export\s+(async\s+)?function\s+\w+' src/ -r --include="*.ts" --include="*.vue"
     ```
     对每个函数名 grep 跨文件调用方（排除声明处本身）：
     ```bash
     grep -rn "\b<函数名>\b" src/ --include="*.ts" --include="*.vue" | grep -v "^<声明文件>:<行号>:"
     ```
     - 唯一调用方 = 自己（声明 + 自己 import）→ 孤儿函数，删
     - 多处调用 → 保留
   - **行为验证**：删除后跑 5 个 E2E 脚本（如业务域内）或 `npx vue-tsc --noEmit`（如跨域），确认行为不变
   - **不修改 eslint.config.js**：检测只在 CLI 加 `--rule`，不写入项目配置（用户可能故意关掉 disable，避免写代码风格无法控制）
9. **Tailwind 任意值飘红主动扫描**（IDE Tailwind IntelliSense 提示，**ESLint 抓不到，需 grep**）：
   - **背景**：项目用 Tailwind CSS 4.x（cashier 项目为 4.1.18），IDE Tailwind IntelliSense 会提示 `The class 'min-h-[48px]' can be written as 'min-h-12'`——这些是 spacing / sizing / text-size 任意值的"等价短写"提示。颜色任意值飘红（`bg-[#xxx]`）是另一问题（需抽 `<style scoped>` 或加 Tailwind 主题，本 skill 不覆盖）。
   - **默认比例映射表**：
     - spacing / sizing：`gap / p / px / py / pt / pb / pl / pr / m / mx / my / mt / mb / ml / mr / space / inset / w / h / min-* / max-*` 数值任意值（如 `gap-[8px]` → `gap-2`）
     - text size：`text-[12px]` → `text-xs`、`text-[14px]` → `text-sm`、`text-[16px]` → `text-base`
     - rounded：`rounded-[2px]` → `rounded-sm`、`rounded-[8px]` → `rounded-lg`、`rounded-[10px]` → `rounded-xl`
   - **不可转换**：`text-[13px]` / `text-[15px]`（不在默认字号比例）、`rounded-[20px]`（不是 full 语义）、颜色 / 阴影 / 渐变任意值
   - **主动扫描方法**：
     ```bash
     grep -hoE '\b(min-h|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|rounded|w|h|space-x|space-y|top|bottom|left|right|text)-\[\s*([0-9.]+)(px|rem)?\s*\]' src/ -r --include="*.vue" | sort -u
     ```
   - **Ponytail rung 选择**：
     1. rung 1：仅换短写不改逻辑，业务 0 改动
     2. rung 6：写一次性 Python 脚本批量替换（见 `references/baseline-eslint.md`）
   - **修复**：批量 Python 脚本见 `references/baseline-eslint.md` 中 "Tailwind 任意值需等价短写" 形态

