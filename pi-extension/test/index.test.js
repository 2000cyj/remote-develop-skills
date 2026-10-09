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
