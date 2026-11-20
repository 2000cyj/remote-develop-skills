import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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
