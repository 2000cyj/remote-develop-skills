// remote-develop-skills — Pi extension
// 状态栏显示：○ 🛠 rds: <count> skills
// 命令：/rds status | list | route <query> | show | hide
//
// 启动时从仓库根 package.json 的 `pi.skills` 读路由表（与 SKILL.md router 同源）。
// 不依赖 SKILL.md 的 LLM 行为；自己解析并暴露给用户做自检。

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
// pi-extension/ 在仓库根；本文件在 pi-extension/index.js
const REPO_ROOT = dirname(dirname(__filename));
const PKG_JSON = join(REPO_ROOT, "package.json");
const ROUTER_SKILL = join(REPO_ROOT, "SKILL.md");

// ---------- 工具函数 ----------

/** 从仓库根 package.json 读取 pi.skills 列表（已规范化成绝对路径） */
function loadSkillPaths() {
  if (!existsSync(PKG_JSON)) return [];
  try {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8"));
    const skills = pkg?.pi?.skills;
    if (!Array.isArray(skills)) return [];
    return skills.map((p) =>
      p.startsWith(".") || p.startsWith("/") ? join(REPO_ROOT, p) : p
    );
  } catch {
    return [];
  }
}

/** 从 SKILL.md 提取 routing table。SKILL.md 格式：
 *  | trigger 描述（中文 + 代码 / 术语） | `remote-xxx/SKILL.md` |
 *  返回 [{ name, triggers: string[] }]，triggers 提取 trigger 描述里
 *  所有 ≥ 3 字符的 token（含中英）作为子串匹配关键词。
 */
function loadRouterTable() {
  if (!existsSync(ROUTER_SKILL)) return [];
  const text = readFileSync(ROUTER_SKILL, "utf8");
  const rows = [];
  // 匹配 "| trigger | `remote-xxx/SKILL.md` |" 形式
  const re = /^\|\s*([^|]+?)\s*\|\s*`?(remote-[a-z0-9-]+)\/?(?:SKILL\.md)?`?\s*\|/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    // 跳过表头
    if (/^[\s|:-]+$/.test(raw)) continue;
    // 提取 trigger 描述中的中英文 token（去标点）
    const tokens = raw
      .toLowerCase()
      .replace(/[`*_~]/g, " ")
      .split(/[\s,，。、;；/\\|`~!@#$%^&*()\[\]{}<>?:""''+=]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2); // 2+ 字符（中文单字也算 1，但起码 2 字符）
    rows.push({ name: m[2].trim(), rawTrigger: raw.trim(), tokens });
  }
  return rows;
}

/** 简单 router：query 字符串与每个 sub-skill 的 trigger tokens 做子串匹配 */
function routeQuery(table, query) {
  if (!query) return [];
  const q = query.toLowerCase();
  const hits = [];
  for (const row of table) {
    const matched = row.tokens.filter((t) => q.includes(t) || t.includes(q));
    if (matched.length > 0) {
      hits.push({ name: row.name, score: matched.length, matched });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

// ---------- Extension 默认导出 ----------

export default function remoteDevelopSkillsExtension(pi) {
  const skillPaths = loadSkillPaths();
  const subSkills = skillPaths
    .map((p) => p.replace(/\\/g, "/").match(/remote-[a-z0-9-]+/))
    .filter(Boolean);
  const routerRows = loadRouterTable();
  const total = subSkills.length;
  const routerCount = subSkills.filter((n) => n === "remote-develop-skills").length;

  // 用户偏好：是否隐藏 status 栏（默认显示）
  let hideStatus = false;
  // 当前 LLM 是否"激活"了 router（read 过 SKILL.md）—— 简化：用户可手动 toggle
  let isActive = false;

  // 状态栏文本生成
  function buildStatusText(theme) {
    if (hideStatus) return undefined;
    const indicator = isActive
      ? (theme?.fg ? theme.fg("accent", "●") : "●")
      : (theme?.fg ? theme.fg("dim", "○") : "○");
    const muted = (s) => (theme?.fg ? theme.fg("muted", s) : s);
    const text = (s) => (theme?.fg ? theme.fg("text", s) : s);
    const label = isActive ? "routing" : `${total} skills`;
    return `${indicator} 🛠 ${muted("rds: ")}${text(label)}`;
  }

  function syncStatus(ctx) {
    if (!ctx?.ui?.setStatus) return;
    let theme;
    try {
      theme = ctx.ui.theme;
    } catch {
      return;
    }
    const text = buildStatusText(theme);
    ctx.ui.setStatus("remote-develop-skills", text);
  }

  // 注册 /rds 命令
  pi.registerCommand("rds", {
    description: "remote-develop-skills: status | list | route <q> | show | hide | activate",
    handler: async (args, ctx) => {
      const notify = (msg, type = "info") => ctx?.ui?.notify?.(msg, type);
      const sub = (args || "").trim();
      const [cmd, ...rest] = sub.split(/\s+/);
      const arg = rest.join(" ").trim();

      if (!cmd || cmd === "status") {
        const lines = [
          `remote-develop-skills v1.0.2 (Pi extension)`,
          `repo root: ${REPO_ROOT}`,
          `total skills: ${total} (1 router + ${total - 1} sub)`,
          `router rows: ${routerRows.length}`,
          `status bar: ${hideStatus ? "hidden" : "shown"}`,
          `router activation: ${isActive ? "active (●)" : "idle (○)"}`,
        ];
        notify(lines.join("\n"), "info");
        return;
      }

      if (cmd === "list") {
        const lines = ["sub-skills (router routing table):"];
        for (const row of routerRows) {
          lines.push(`  • ${row.name}  (${row.tokens.length} tokens)`);
        }
        notify(lines.join("\n"), "info");
        return;
      }

      if (cmd === "route") {
        if (!arg) {
          notify("Usage: /rds route <query>", "warning");
          return;
        }
        const hits = routeQuery(routerRows, arg);
        if (hits.length === 0) {
          notify(`No match for "${arg}". Try /rds list to see all sub-skills.`, "warning");
          return;
        }
        const lines = [`router matches for "${arg}":`];
        for (const h of hits.slice(0, 5)) {
          lines.push(`  → ${h.name}  (matched: ${h.matched.slice(0, 3).join(", ")})`);
        }
        notify(lines.join("\n"), "info");
        return;
      }

      if (cmd === "show") {
        hideStatus = false;
        syncStatus(ctx);
        notify("rds status bar: shown", "info");
        return;
      }

      if (cmd === "hide") {
        hideStatus = true;
        syncStatus(ctx);
        notify("rds status bar: hidden", "info");
        return;
      }

      if (cmd === "activate" || cmd === "on") {
        isActive = true;
        syncStatus(ctx);
        notify("rds router: active (●)", "info");
        return;
      }

      if (cmd === "deactivate" || cmd === "off") {
        isActive = false;
        syncStatus(ctx);
        notify("rds router: idle (○)", "info");
        return;
      }

      notify(`Unknown sub-command: ${cmd}. Try status | list | route <q> | show | hide | activate | deactivate`, "warning");
    },
  });

  // 启动时刷一次状态栏
  pi.on("session_start", async (_event, ctx) => {
    syncStatus(ctx);
  });

  // 让用户能在 session 之间记下偏好（optional，简化不持久化）
  pi.appendEntry("rds-info", {
    totalSkills: total,
    subSkills: subSkills.filter((n) => n !== "remote-develop-skills"),
  });
}
