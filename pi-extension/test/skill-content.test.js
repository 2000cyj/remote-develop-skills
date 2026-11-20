import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tsRoot = join(repo, "remote-ts-es-check");
const tsEntry = readFileSync(join(tsRoot, "SKILL.md"), "utf8");

test("TS/ESLint entry stays under 16 KiB with valid on-demand references", () => {
  assert.ok(Buffer.byteLength(tsEntry, "utf8") <= 16 * 1024);
  const routes = [...tsEntry.matchAll(/^Use references\/([\w-]+\.md) when /gm)];
  assert.equal(routes.length, 10);
  for (const [, name] of routes) {
    assert.ok(existsSync(join(tsRoot, "references", name)), `Missing TS reference: ${name}`);
  }
});

test("TS/ESLint entry preserves hunk scope, explicit type-check consent and hook fields", () => {
  assert.match(tsEntry, /changed hunks/);
  assert.match(tsEntry, /禁止 `--fix`/);
  assert.match(tsEntry, /只有用户明确要求项目级\/全量类型验证时才运行/);
  assert.match(tsEntry, /仅发现类型嫌疑不构成授权/);
  for (const field of ["HOOK_ESLINT_ARGS", "HOOK_TSC_ARGS", "HOOK_MAX_ATTEMPTS", "HOOK_SRC_REGEX"]) {
    assert.match(tsEntry, new RegExp(`^${field}=`, "m"));
  }
});
const root = join(repo, "remote-cashier-java-standard");
const entry = readFileSync(join(root, "SKILL.md"), "utf8");
const references = [...entry.matchAll(/^Use `references\/([^`]+\.md)` when /gm)]
  .map((match) => match[1]);

test("cashier Java entry stays under 16 KiB and loads details on demand", () => {
  assert.ok(Buffer.byteLength(entry, "utf8") <= 16 * 1024);
  assert.ok(entry.startsWith("---\nname: remote-cashier-java-standard\n"));
  assert.doesNotMatch(entry, /必须先用 read 工具加载全文/);
  assert.match(entry, /不要求加载全部细则/);
});

test("all routed Java reference files exist and fit the 32 KiB detail budget", () => {
  assert.ok(references.length >= 20);
  assert.equal(new Set(references).size, references.length);
  for (const name of references) {
    const path = join(root, "references", name);
    assert.ok(existsSync(path), `Missing reference: ${name}`);
    // Existing large manuals explicitly use section reads; newly split files
    // must each stay small enough to read independently.
    if (/原规范细则/.test(readFileSync(path, "utf8"))) {
      assert.ok(statSync(path).size <= 32 * 1024, `Oversized detail: ${name}`);
    }
  }
});

test("legacy chapter families retain explicit navigation", () => {
  for (const name of [
    "po-identity.md", "po-boundaries.md", "pagination-rules.md",
    "documentation-rules.md", "soft-delete-cases.md",
    "audit-and-view-cases.md", "compile-history.md", "maven-build.md",
  ]) {
    assert.ok(references.includes(name), `Missing legacy route: ${name}`);
  }
  assert.match(entry, /历史 §21 的沙箱脚本由后来的 §22 与本入口覆盖/);
  const history = readFileSync(join(root, "references", "compile-history.md"), "utf8");
  assert.match(history, /不作为当前默认执行流程/);
});
