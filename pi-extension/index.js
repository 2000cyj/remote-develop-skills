// remote-develop-skills — Pi extension
//
// 在 TUI 状态栏里显示路由状态：
//   ○ 🛠 rds: <N> skills            // idle（router 还没被读）
//   ● 🛠 rds: router read           // LLM 读了根 SKILL.md（看路由表）
//   ● 🛠 rds: <sub-skill-name>      // LLM 读了这个 sub-skill 的 SKILL.md（路由命中）
//
// 注册 /rds 命令供用户自检：status | list | route <q> | show | hide | activate | deactivate
//
// 启动时从仓库根 package.json 的 `pi.skills` 读路由源（与 SKILL.md router 同源），
// 自己解析触发词并暴露给用户做自检，不依赖 SKILL.md 的 LLM 行为。

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

// 常用 stop words（中文 + 英文），会被过滤，避免误命中
const STOP_WORDS = new Set([
  // 英文
  "and", "or", "not", "in", "as", "the", "a", "an", "of", "to", "for", "with", "by", "on",
  "is", "are", "was", "were", "be", "been", "this", "that", "it", "its",
  "do", "does", "did", "no", "yes", "but", "if", "then", "so", "than",
  "context", "case", "insensitive", "substring", "token", "match", "priority",
  "command", "cli", "etc",
  // 中文 stop words（不常有，但防护一下）
  "与", "或", "不", "在", "里", "上", "下", "的", "了", "和",
]);

/** 从 trigger 描述里抽 token：
 *  1) 优先反引号包裹的词（明确列出的技术词），
 *  2) 补充 prose 里的具体词（例 "rds repo maintenance" 中的 "rds" / "maintenance"）。
 *  过滤 "AND" / "OR" / "in" / "context" 等 stop words，避免误命中。
 */
function extractBacktickTokens(text) {
  const seen = new Set();
  const result = [];
  function add(raw) {
    if (!raw) return;
    let token = raw.trim();
    if (!token) return;
    token = token.replace(/^[\(\["'「『]+|[\)\]"'」』]+$/g, "");
    if (!token) return;
    if (STOP_WORDS.has(token.toLowerCase())) return;
    const hasCJK = /[\u4e00-\u9fa5]/.test(token);
    if (!hasCJK && token.length < 2) return;
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(key);
  }
  // 1) 优先：反引号包裹的词
  const re = /`([^`]+?)`/g;
  let m;
  while ((m = re.exec(text)) !== null) add(m[1]);
  // 2) 补充：prose 里的具体技术词（例 "rds repo maintenance" 中的 "rds"）
  const prose = text.replace(/`[^`]+?`/g, " ");
  const proseTokens = prose
    .toLowerCase()
    .replace(/[\(\)\[\]"',;:!?*_~]/g, " ")
    .split(/[\s,，。、;；/\\|`~!@#$%^&*()\[\]{}<>?:""''+=]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);  // prose 词更严，≥ 3 字符
  for (const t of proseTokens) add(t);
  return result;
}

/** 从 SKILL.md 提取 routing table。
 *  优先 3 列格式（新版）：
 *    | Positive tokens | Negative tokens | Sub-skill name |
 *  兑底 2 列格式（老版）：
 *    | trigger 描述 | `remote-xxx/SKILL.md` |
 *  返回 [{ name, rawTrigger, tokens }]，tokens 是 positive trigger 列里
 *  所有 ≥ 2 字符的 token（去标点 + 小写），作为子串匹配关键词。
 *  Negative 列不参与 rds extension 的路由计算（rds 只是个查询工具，
 *  实际路由决策在 LLM，看 SKILL.md 里的 decision algorithm + negative filters）。
 */
function loadRouterTable() {
  if (!existsSync(ROUTER_SKILL)) return [];
  const text = readFileSync(ROUTER_SKILL, "utf8");
  const rows = [];

  // 1) 3 列格式：positive | negative | sub-skill
  //    sub-skill 列不出现 /SKILL.md 后缀（新版规范：按 name 而非 path 路由）
  //    trigger 列必须是 keywords 形式（多个 token，含反引号或逗号），
  //    以过滤 examples 表里的 prose 句子列（4 列格式被 3 列正则意外匹配）。
  //    token 提取只保留反引号包裹的词（`` `xxx` ``），丢弃 "AND" / "OR"
  //    / "in" / "as" / "context" 等 prose stop words，避免 false positive。
  const re3 = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`?(remote-[a-z0-9-]+)`?\s*\|/gm;
  let m;
  while ((m = re3.exec(text)) !== null) {
    const raw = m[1];
    if (/^[\s|:-]+$/.test(raw)) continue;  // 跳过表头 / 分隔行
    if (!raw.includes("`") && !raw.includes(",")) continue;  // 跳过 prose 句子
    if (/^[""「]/.test(raw)) continue;  // 跳过 examples 表里的引号包裹句子
    const tokens = extractBacktickTokens(raw);
    if (tokens.length === 0) continue;
    rows.push({ name: m[3].trim(), rawTrigger: raw.trim(), tokens, source: "3col" });
  }
  if (rows.length > 0) return rows;

  // 2) 兑底 2 列格式：trigger | remote-xxx/SKILL.md
  //    老 SKILL.md 用 2 列 + 中文描述，同上用 extractBacktickTokens 抽 token。
  const re2 = /^\|\s*([^|]+?)\s*\|\s*`?(remote-[a-z0-9-]+)\/?(?:SKILL\.md)?`?\s*\|/gm;
  while ((m = re2.exec(text)) !== null) {
    const raw = m[1];
    if (/^[\s|:-]+$/.test(raw)) continue;
    const tokens = extractBacktickTokens(raw);
    if (tokens.length === 0) continue;
    rows.push({ name: m[2].trim(), rawTrigger: raw.trim(), tokens, source: "2col" });
  }
  return rows;
}

/** 简单 router：query 字符串与每个 sub-skill 的 trigger tokens 做子串匹配。
 *  priority 策略：行号越靠前 (SKILL.md 里越靠前的 decision step) 优先级越高。
 *  score = matched_tokens * 1000 + (table.length - row_index)
 *  这样 Step 1 (specific) 永远赢 Step 2 (general) 即使 token 命中少。
 *  跟 LLM 读 SKILL.md decision algorithm 的“越靠前优先”原则一致。
 */
function routeQuery(table, query) {
  if (!query) return [];
  const q = query.toLowerCase();
  const hits = [];
  for (let i = 0; i < table.length; i += 1) {
    const row = table[i];
    const matched = row.tokens.filter((t) => q.includes(t) || t.includes(q));
    if (matched.length > 0) {
      const priorityBonus = table.length - i;  // 0..table.length-1
      hits.push({ name: row.name, score: matched.length * 1000 + priorityBonus, matched });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

/** 给定一个文件绝对路径，判断是不是本仓库的 router SKILL.md 或某个 sub-skill 的 SKILL.md。
 *  返回 "router" | <sub-skill-name> | null。
 *  比较时统一用 posix 路径 + lowercase，避免 Windows / Git-Bash / 大小写差异。
 */
function classifyReadPath(absPath, repoRoot) {
  if (!absPath) return null;
  const norm = absPath.replace(/\\/g, "/").toLowerCase();
  const repoNorm = repoRoot.replace(/\\/g, "/").toLowerCase();
  if (!norm.startsWith(repoNorm + "/") && norm !== repoNorm) return null;
  const rel = norm.slice(repoNorm.length + 1);
  if (rel === "skill.md") return "router";
  if (rel.endsWith("/skill.md")) {
    const m = rel.match(/^(remote-[a-z0-9-]+)\/skill\.md$/);
    if (m) return m[1];
  }
  return null;
}

// ---------- Extension 默认导出 ----------

export default function remoteDevelopSkillsExtension(pi) {
  const skillPaths = loadSkillPaths();
  const routerRows = loadRouterTable();
  // 从 skillPaths 提取 sub-skill 名字（remote-* 目录名）
  const subSkills = skillPaths
    .map((p) => p.replace(/\\/g, "/").match(/remote-[a-z0-9-]+/))
    .filter(Boolean);
  const total = subSkills.length;

  // 动态计算 rds package 实际被 Pi 加载的 skill 数。
  // 首选 `pi.getSettings()`（eettings.json 里的 skills 数组是 Pi 实际加载的子集）；
  // settings.json 没列（“未配置”）的场合会 fallback 到从 package.json 的 pi.skills 推。
  function detectLoadedSkillCount() {
    try {
      const settings = pi.getSettings?.();
      if (settings?.packages && Array.isArray(settings.packages)) {
        const rdsEntry = settings.packages.find(
          (p) => typeof p === "object" && p?.source && p.source.includes("remote-develop-skills")
        );
        if (rdsEntry && Array.isArray(rdsEntry.skills) && rdsEntry.skills.length > 0) {
          return rdsEntry.skills.length;
        }
      }
    } catch {
      // ignore: getSettings 可能在某些 event context 下不可用
    }
    // fallback：package.json pi.skills
    return subSkills.length;
  }
  let loadedSkillCount = total;  // 初始为 package.json 推算的总数；session_start 时刷新为 Pi 实际加载数

  // 用户偏好：是否隐藏 status 栏（默认显示）
  let hideStatus = false;
  // router 状态机：监听 LLM 行为自动更新
  //   activeSub = null       → router 未被读 / agent_end 后重置
  //   activeSub = "router"   → LLM 读了本仓库根 SKILL.md（看路由表）
  //   activeSub = "remote-xxx" → LLM 读了这个 sub-skill 的 SKILL.md（路由命中）
  let activeSub = null;
  // 手动 override：true 时永远 active，忽略 tool_call 自动状态
  let manualActive = false;

  // 状态栏文本生成
  function buildStatusText(theme) {
    if (hideStatus) return undefined;
    const isActive = manualActive || activeSub !== null;
    const indicator = isActive
      ? (theme?.fg ? theme.fg("accent", "●") : "●")
      : (theme?.fg ? theme.fg("dim", "○") : "○");
    const muted = (s) => (theme?.fg ? theme.fg("muted", s) : s);
    const text = (s) => (theme?.fg ? theme.fg("text", s) : s);
    let label;
    if (activeSub === "router") label = "router read";
    else if (activeSub && activeSub.startsWith("remote-")) label = activeSub;
    else if (manualActive) label = "manual";
    else label = `${loadedSkillCount} skills`;
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
    description:
      "remote-develop-skills: status | list | route <q> | show | hide | activate | deactivate",
    handler: async (args, ctx) => {
      const notify = (msg, type = "info") => ctx?.ui?.notify?.(msg, type);
      const sub = (args || "").trim();
      const [cmd, ...rest] = sub.split(/\s+/);
      const arg = rest.join(" ").trim();

      if (!cmd || cmd === "status") {
        const lines = [
          `remote-develop-skills Pi extension`,
          `repo root: ${REPO_ROOT}`,
          `total skills: ${total} (1 router + ${total - 1} sub) — loaded by Pi: ${loadedSkillCount}`,
          `router rows: ${routerRows.length}`,
          `status bar: ${hideStatus ? "hidden" : "shown"}`,
          `router activation: ${manualActive || activeSub ? "active (●)" : "idle (○)"}`,
          `current activeSub: ${activeSub ?? "(none)"}`,
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
          notify(
            `No match for "${arg}". Try /rds list to see all sub-skills.`,
            "warning"
          );
          return;
        }
        const lines = [`router matches for "${arg}":`];
        for (const h of hits.slice(0, 5)) {
          lines.push(
            `  → ${h.name}  (matched: ${h.matched.slice(0, 3).join(", ")})`
          );
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
        manualActive = true;
        syncStatus(ctx);
        notify("rds router: manual active (●)", "info");
        return;
      }

      if (cmd === "deactivate" || cmd === "off") {
        manualActive = false;
        activeSub = null;
        syncStatus(ctx);
        notify("rds router: idle (○)", "info");
        return;
      }

      notify(
        `Unknown sub-command: ${cmd}. Try status | list | route <q> | show | hide | activate | deactivate`,
        "warning"
      );
    },
  });

  // 启动时刷一次状态栏 + 记一次 session 入口。
  // 注意：appendEntry / setStatus 等 action method 只能在事件处理函数里调用，
  // 不能在 factory 函数顶层（那时 runtime 还没初始化）。
  pi.on("session_start", async (_event, ctx) => {
    // 拿 Pi 实际加载的 skill 数（跟随 settings.json 实际配置）
    loadedSkillCount = detectLoadedSkillCount();
    syncStatus(ctx);
    try {
      pi.appendEntry("rds-info", {
        totalSkills: total,
        subSkills: subSkills.filter((n) => n !== "remote-develop-skills"),
      });
    } catch {
      // ignore: appendEntry 在某些 event context 下也可能不可用
    }
  });

  // 强制 LLM 在每个 turn 走读 router SKILL.md。
  // 原因：Pi 默认是 “use read tool when task matches description”，是被动匹配。
  // router 和 sub-skill 在 <available_skills> 里平级，LLM 训练倾向挑更具体的 sub-skill
  // （如 remote-cashier-java-standard），直接绕过 router。
  // 补了这条规则后，router 被拍到 Pi system prompt rules 顶部，LLM 会当必须遵守的规则执行。
  // router 自己会教 LLM 怎么从 <available_skills> 取 sub-skill location，所以这里只需强制
  // "先读 router"，不规定加载子 skill 的具体方式。
  pi.on("before_agent_start", async (event) => {
    if (!event?.systemPromptOptions) return;
    if (!Array.isArray(event.systemPromptOptions.promptGuidelines)) return;
    const routerPath = join(REPO_ROOT, "SKILL.md");
    const rule =
      `BEFORE any other action in this turn (including reading any other skill, running any ` +
      `tool, or writing any code), you MUST first use the read tool to load the router skill ` +
      `file at exactly this absolute path: ${routerPath}. The router SKILL.md itself contains ` +
      `the routing table and instructions for how to load the matching sub-skill from ` +
      `<available_skills> (do NOT bypass the router and pick a sub-skill directly from ` +
      `<available_skills> on your own). Skip the router step ONLY if the user explicitly says ` +
      `"stop router" or "ignore remote-develop-skills".`;
    event.systemPromptOptions.promptGuidelines.push(rule);
  });

  // 监听 LLM 的 read 工具调用：如果读的是本仓库的 SKILL.md（router）
  // 或某个 remote-*/SKILL.md（sub-skill），亮起状态栏。
  // 这样用户看到 ● 时就知道 router 已被 LLM 启动、路由命中了。
  pi.on("tool_call", async (event, _ctx) => {
    if (manualActive) return;  // manual override 期间不覆盖
    if (event?.toolName !== "read") return;
    const path = event?.input?.path;
    if (!path) return;
    // resolve 实际路径（处理相对路径）
    let absPath;
    try {
      absPath =
        path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path)
          ? path
          : join(_ctx?.cwd || REPO_ROOT, path);
    } catch {
      return;
    }
    const classified = classifyReadPath(absPath, REPO_ROOT);
    if (classified && classified !== activeSub) {
      activeSub = classified;
      syncStatus(_ctx);
      _ctx?.ui?.notify?.(`rds ● active → ${classified}`, "info");
    }
  });

  // agent_end 重置 activeSub：LLM 跑完一个 turn，圆圈变回 ○。
  // 如果下一 turn 又读了 SKILL.md，会重新亮起。
  pi.on("agent_end", async (_event, ctx) => {
    if (manualActive) return;
    if (activeSub !== null) {
      activeSub = null;
      syncStatus(ctx);
    }
  });
}
