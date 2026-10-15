# CHANGELOG

事故记录只放这里。**SKILL.md 与 references/ 只保留当前有效规则**，不再复盘。

## 2026-10-15 —— 规范重构（v4）

### 事故 1：拿 grep 当审查方法（storeEntryPlatform/）

用 `grep "^const formRules"` 找违规，命令只匹配变量名 `formRules`，漏掉 `const rules: FormRules<T>`（14 行纯静态）。user 点名才发现。

**根因不是 grep 写错，是把「执行器」当「规范」。** 修法：规范改成「声明种类 → 归属目录」表（`02-audit-page-compliance.md`），逐文件 read 后按声明种类判定；命名不再影响归属。

### 事故 2：computed 传 Ref/Reactive 容器（store/）

v2 规则写成「抽成 config 工厂，把 ctx 对象传进去」，agent 照做 → `getStoreAddOrEditFormItems(ctx)` 传 `Ref<T>` / `Reactive<T>` 包装。config 方法只需要值，不需要容器。

**根因是规则把「实现细节示例」写成了规则本身。** 修法：v3 明确「值当参数传，禁止传容器」，示例全部移出表格。

### 事故 3：多造枚举（storeEntryPlatform/）

`gotoDetail('view'|'edit')` 另建 `DETAIL_ACTION_ENUM`，但 `@/common/enum` 的 `pageModeEnum` 已有 `VIEW: "view"` / `CHANGE: "change"`，语义完全一致。

**根因是「先查公共 enum」这条优先级写得不够硬。** 修法：归属表 enum 行改成显式 3 级优先级（公共 → 本块 → 就近），并要求建枚举前先列 3 个候选。

### 事故 4：skill 副本落后于源目录

worktree 里 `.pi/git/github.com/2000cyj/remote-develop-skills/` 的副本与源目录 `C:/Users/20614/orca/remote-develop-skills/` 不同步（实际内容一致，CRLF 差异）。

**根因是没有「源改完必须 commit + worktree pull」的流程约束。** 修法：见下方「维护流程」。

### 事故 5：规则抄进 8 个文件，抄一次错一次

`FormRules` 抽取规则同时存在于 8 个文件，「声明种类归属表」同时存在于 3 个文件且措辞不同。改一次漏一处就产生互相矛盾的口径，agent 读到哪份取决于读了哪个 reference，行为随机。

**根因是把「速查」和「规范」混在同一批文件里。** 修法 v4：单一真源（归属表只在 `02-audit-page-compliance.md`），`SKILL.md` 与 `07-quick-reference.md` 只放链接不放正文。

### 事故 6：文件编号冲突（08 / 09 各两份）

```
08-appendix-remediation.md   (300 行)
08-no-inline-enum-in-vue.md  (290 行)
09-appendix-remediation.md   (185 行)
09-no-inline-type-in-vue.md  (214 行)
```
`read 08-*.md` 拿到的是随机一份。修法：playbook 统一改 90/ 编号。

## 2025-01-14 —— 数据搬运事故（company/）

同批 3 起，全部是「凭印象改值」而非「从 git HEAD 拿值」：

1. `COMPANY_TAB_PERM` 8 个权限码：working tree 已被改成 `cashier:company:edit:*`，git HEAD 是 `gsglCheck*`，agent 照抄 working tree。
2. `COMPANY_STATUS_TAG_MAP` 4 个颜色：凭业务合理性改了 `closed:warning → info` / `cancelled:info → danger`。
3. `index.vue handleViewTab` 路径：凭「架构统一」把 `/gsgl/check` 改成 `/company/edit/${uniqueValue}`，user 未批准。

**修法（仍是现行规则）**：任何字面量值改动必须 `git show HEAD:<file>` 拿原值 → 搬完 diff 验证 → 不一致立即停并问 user。规则正文见 `02-audit-page-compliance.md`「数据搬运保护」，本文不复述。

---

## 维护流程（必读）

改这个 skill 时：

1. **先改真源**。规范正文只写在对应 `references/NN-*.md` 里；`SKILL.md` 和 `07-quick-reference.md` 只放**链接**，不复制正文。
2. **改完跑自检**：`bash scripts/check-duplication.sh`（查重复编号 + 查「同一规则出现在 ≥3 个文件」）。
3. **commit + push**，然后在消费端 worktree 里 `git pull`，让 `.pi/git/.../remote-develop-skills/` 副本跟上。
4. **新事故写这里**，不要往 SKILL.md 追加复盘段——那会把速查表挤出行窗口。
