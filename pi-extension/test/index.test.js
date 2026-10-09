// pi-extension self-test: verify the extension's data-loading and routing logic
// without requiring a full Pi session. Run with: node --test test/index.test.js

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// __dirname = pi-extension/test → dirname = pi-extension → dirname = repo root
const REPO_ROOT = dirname(dirname(__dirname));

// ---- 复制 extension 内部的两个纯函数（避免 import 触发 Pi 加载） ----

function loadSkillPaths(repoRoot) {
  const pkgJson = join(repoRoot, "package.json");
  if (!existsSync(pkgJson)) return [];
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  return (pkg?.pi?.skills || []).map((p) => (p.startsWith(".") ? join(repoRoot, p) : p));
}

function loadRouterTable(repoRoot) {
  const skill = join(repoRoot, "SKILL.md");
  if (!existsSync(skill)) return [];
  const text = readFileSync(skill, "utf8");
  const rows = [];
  const re = /^\|\s*([^|]+?)\s*\|\s*`?(remote-[a-z0-9-]+)\/?(?:SKILL\.md)?`?\s*\|/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    if (/^[\s|:-]+$/.test(raw)) continue;
    const tokens = raw
      .toLowerCase()
      .replace(/[`*_~]/g, " ")
      .split(/[\s,，。、;；/\\|`~!@#$%^&*()\[\]{}<>?:""''+=]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    rows.push({ name: m[2].trim(), rawTrigger: raw.trim(), tokens });
  }
  return rows;
}

function routeQuery(table, query) {
  if (!query) return [];
  const q = query.toLowerCase();
  return table
    .map((r) => {
      const matched = r.tokens.filter((t) => q.includes(t) || t.includes(q));
      return { name: r.name, score: matched.length, matched };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);
}

function classifyReadPath(absPath, repoRoot, _skillPaths) {
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

// 复制 extension 里的 detectLoadedSkillCount 逻辑
function detectLoadedSkillCount(mockPi, fallback) {
  try {
    const settings = mockPi.getSettings?.();
    if (settings?.packages && Array.isArray(settings.packages)) {
      const rdsEntry = settings.packages.find(
        (p) => typeof p === "object" && p?.source && p.source.includes("remote-develop-skills")
      );
      if (rdsEntry && Array.isArray(rdsEntry.skills) && rdsEntry.skills.length > 0) {
        return rdsEntry.skills.length;
      }
    }
  } catch {
    // ignore
  }
  return fallback;
}

// ---- Tests ----

test("loadSkillPaths returns 11 skills (1 router + 10 sub)", () => {
  const paths = loadSkillPaths(REPO_ROOT);
  assert.equal(paths.length, 11);
  assert.ok(paths[0].endsWith("SKILL.md"), "first is router");
});

test("loadRouterTable extracts 10 sub-skill rows", () => {
  const table = loadRouterTable(REPO_ROOT);
  assert.equal(table.length, 10);
  assert.ok(table.every((r) => r.name.startsWith("remote-")));
  assert.ok(table.every((r) => r.tokens.length > 0));
});

test("router excludes the SKILL.md self row (router only lists sub-skills)", () => {
  const table = loadRouterTable(REPO_ROOT);
  // 仓库根 SKILL.md 的 "Enable a skill" 表也会被正则匹配但 name 是 remote-* 子 skill 名
  // 不能包含 router 自己
  assert.ok(!table.some((r) => r.name === "remote-develop-skills" && r.rawTrigger.includes("router")),
    "router self-row should not be in routing table");
});

test("route 'git commit' → remote-commit-git", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "git commit");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].name, "remote-commit-git");
});

test("route 'idea mcp' → remote-idea-mcp-usage", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "idea mcp");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].name, "remote-idea-mcp-usage");
});

test("route 'orca cli' → remote-orca-cli", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "orca cli");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].name, "remote-orca-cli");
});

test("route '写权限 allowlist' → remote-write-scope", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "写权限 allowlist");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].name, "remote-write-scope");
});

test("route 'agent 派发' → remote-orca-agent-communication", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "agent 派发");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].name, "remote-orca-agent-communication");
});

test("route 'vue 列表页' → remote-cashier-list-page-directory", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "vue 列表页");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].name, "remote-cashier-list-page-directory");
});

test("unknown query returns no hits (no false positives)", () => {
  const table = loadRouterTable(REPO_ROOT);
  const hits = routeQuery(table, "this-is-a-completely-unrelated-string-xyz123");
  assert.equal(hits.length, 0);
});

test("empty repo (no package.json) returns empty skill list gracefully", () => {
  const tmp = mkdtempSync(join(tmpdir(), "rds-test-"));
  try {
    const paths = loadSkillPaths(tmp);
    assert.equal(paths.length, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("empty repo (no SKILL.md) returns empty table gracefully", () => {
  const tmp = mkdtempSync(join(tmpdir(), "rds-test-"));
  try {
    const table = loadRouterTable(tmp);
    assert.equal(table.length, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- classifyReadPath ----

test("classifyReadPath detects router SKILL.md (forward slash)", () => {
  const r = classifyReadPath(REPO_ROOT + "/SKILL.md", REPO_ROOT, []);
  assert.equal(r, "router");
});

test("classifyReadPath detects router SKILL.md (back slash, Windows)", () => {
  const r = classifyReadPath(REPO_ROOT + "\\SKILL.md", REPO_ROOT, []);
  assert.equal(r, "router");
});

test("classifyReadPath detects sub-skill SKILL.md", () => {
  const r = classifyReadPath(REPO_ROOT + "/remote-orca-cli/SKILL.md", REPO_ROOT, []);
  assert.equal(r, "remote-orca-cli");
});

test("classifyReadPath rejects path outside repo", () => {
  const r = classifyReadPath("C:/Users/foo/other-repo/SKILL.md", REPO_ROOT, []);
  assert.equal(r, null);
});

test("classifyReadPath rejects random .md inside repo", () => {
  const r = classifyReadPath(REPO_ROOT + "/docs/test.md", REPO_ROOT, []);
  assert.equal(r, null);
});

test("classifyReadPath is case-insensitive on filename", () => {
  const r = classifyReadPath(REPO_ROOT + "/skill.md", REPO_ROOT, []);
  assert.equal(r, "router");
});

// ---- detectLoadedSkillCount ----

test("detectLoadedSkillCount returns rds.skills.length from settings", () => {
  const mockPi = {
    getSettings: () => ({
      packages: [
        { source: "git:github.com/foo/bar", skills: ["a.md", "b.md"] },
        { source: "git:github.com/2000cyj/remote-develop-skills@master", skills: ["SKILL.md", "x/SKILL.md", "y/SKILL.md", "z/SKILL.md", "w/SKILL.md", "v/SKILL.md", "u/SKILL.md", "t/SKILL.md", "s/SKILL.md"] },
      ],
    }),
  };
  assert.equal(detectLoadedSkillCount(mockPi, 11), 9);
});

test("detectLoadedSkillCount falls back when rds package is not in settings", () => {
  const mockPi = {
    getSettings: () => ({ packages: [{ source: "git:github.com/foo/bar" }] }),
  };
  assert.equal(detectLoadedSkillCount(mockPi, 11), 11);  // fallback to package.json count
});

test("detectLoadedSkillCount falls back when rds.skills is empty", () => {
  const mockPi = {
    getSettings: () => ({ packages: [{ source: "git:github.com/2000cyj/remote-develop-skills@master", skills: [] }] }),
  };
  // empty array means "disable all", so we fall back to package.json count
  assert.equal(detectLoadedSkillCount(mockPi, 11), 11);
});

test("detectLoadedSkillCount handles missing getSettings gracefully", () => {
  const mockPi = {};
  assert.equal(detectLoadedSkillCount(mockPi, 11), 11);
});

test("detectLoadedSkillCount handles getSettings throwing", () => {
  const mockPi = { getSettings: () => { throw new Error("not ready"); } };
  assert.equal(detectLoadedSkillCount(mockPi, 7), 7);
});

test("detectLoadedSkillCount ignores string-form package entries", () => {
  const mockPi = {
    getSettings: () => ({ packages: ["git:github.com/2000cyj/remote-develop-skills@master"] }),
  };
  // string form has no .skills property, so we fall back
  assert.equal(detectLoadedSkillCount(mockPi, 11), 11);
});

// ---- before_agent_start injection ----

// 复制 extension 里 before_agent_start handler 的逻辑
function simulateBeforeAgentStart(event, repoRoot) {
  if (!event?.systemPromptOptions) return;
  if (!Array.isArray(event.systemPromptOptions.promptGuidelines)) return;
  const routerPath = (repoRoot + "/SKILL.md").replace(/\\/g, "/");
  const rule =
    `BEFORE any other action in this turn (including reading any other skill, running any ` +
    `tool, or writing any code), you MUST first use the read tool to load the router skill ` +
    `file at exactly this absolute path: ${routerPath}. Read it in full, then re-read the ` +
    `routing table to identify which remote-* sub-skill matches the current task, then read ` +
    `that sub-skill's SKILL.md. Skip this router step ONLY if the user explicitly says ` +
    `"stop router" or "ignore remote-develop-skills".`;
  event.systemPromptOptions.promptGuidelines.push(rule);
}

test("before_agent_start pushes router rule into promptGuidelines", () => {
  const event = { systemPromptOptions: { promptGuidelines: [] } };
  simulateBeforeAgentStart(event, REPO_ROOT);
  assert.equal(event.systemPromptOptions.promptGuidelines.length, 1);
  const rule = event.systemPromptOptions.promptGuidelines[0];
  assert.ok(rule.includes("MUST first use the read tool"));
  assert.ok(rule.includes(REPO_ROOT.replace(/\\/g, "/") + "/SKILL.md"));
  assert.ok(rule.includes("stop router"));
});

test("before_agent_start appends to existing promptGuidelines (doesn't replace)", () => {
  const event = { systemPromptOptions: { promptGuidelines: ["- rule 1", "- rule 2"] } };
  simulateBeforeAgentStart(event, REPO_ROOT);
  assert.equal(event.systemPromptOptions.promptGuidelines.length, 3);
  assert.equal(event.systemPromptOptions.promptGuidelines[0], "- rule 1");
  assert.equal(event.systemPromptOptions.promptGuidelines[1], "- rule 2");
  assert.ok(event.systemPromptOptions.promptGuidelines[2].includes("MUST first use the read tool"));
});

test("before_agent_start is no-op when systemPromptOptions missing", () => {
  const event = { type: "before_agent_start" };
  // should not throw
  simulateBeforeAgentStart(event, REPO_ROOT);
  assert.equal(event.systemPromptOptions, undefined);
});

test("before_agent_start is no-op when promptGuidelines is not an array", () => {
  const event = { systemPromptOptions: { promptGuidelines: "not an array" } };
  // should not throw
  simulateBeforeAgentStart(event, REPO_ROOT);
  assert.equal(event.systemPromptOptions.promptGuidelines, "not an array");
});
