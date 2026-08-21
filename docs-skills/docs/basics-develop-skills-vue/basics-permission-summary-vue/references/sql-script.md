# SQL 生成脚本

本文件是 `basics-permission-summary-vue` Workflow 第 5 步用的 node 脚本。把 `PKG` / `OUT` 改成目标目录的实际路径即可。

```bash
node <<'NODESCRIPT'
const fs = require("fs");
const PKG = "D:/OB/ob_web/micro/cashier/docs/权限/package.json"; // ← 改成目标目录的实际路径
const OUT = "D:/OB/ob_web/micro/cashier/docs/权限/权限.sql";      // ← 改成目标目录的实际路径
const data = JSON.parse(fs.readFileSync(PKG, "utf8"));

function suffix(e) {
  const op = e.operation, bn = e.buttonName;
  if (op === "新增") return "新增";
  if (op === "编辑") return "修改";
  if (op === "删除") return "删除";
  if (op === "查看") {
    const m = bn.match(/查看\s*·\s*(.+)$/);
    if (m) return "查看（" + m[1] + "）";
    return "查看";
  }
  if (e.permissionCode === "ryxxIdCard") return "查看身份证完整号"; // 特殊码按需追加
  return bn;
}

const TBL = "`bi_sys`.`sys_menu_permission`";
const COLS = "(`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`)";
const lines = [];
lines.push("-- 按钮权限菜单数据（由 " + PKG.split("/").slice(-2).join("/") + " 生成）");
lines.push("-- 表：bi_sys.sys_menu_permission；if_public_view=0 私有，tenant_id=1；Change 类 menu_name 沿用模板写作「修改」");
lines.push("");

const modules = Object.keys(data).filter(k => k !== "_meta");
for (const mod of modules) {
  const m = data[mod];
  const meta = m._meta || {};
  const prefix = meta.prefix || mod;
  const moduleName = meta.moduleName || mod;
  lines.push("-- " + moduleName + "（" + mod + "，路由 " + (meta.routePath || "(待定)") + "）");
  lines.push("INSERT INTO " + TBL + " " + COLS + " VALUES ('" + prefix + "', '" + prefix + "', '" + moduleName + "', 0, 1);");
  const codes = Object.keys(m).filter(k => k !== "_meta");
  for (const code of codes) {
    const e = m[code];
    lines.push("INSERT INTO " + TBL + " " + COLS + " VALUES ('" + prefix + "', '" + code + "', '" + moduleName + " - " + suffix(e) + "', 0, 1);");
  }
  lines.push("");
}

fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log("已写入 " + modules.length + " 个模块，" + lines.filter(l => l.startsWith("INSERT")).length + " 条 INSERT");
NODESCRIPT
```

> 需要幂等 SQL 时，把 INSERT 换成 `INSERT ... ON DUPLICATE KEY UPDATE`（键为 `menu_id`），或生成前先 `DELETE` 同 `two_level_id` 再插。
