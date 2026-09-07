import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAgentTerminal } from './resolve-agent-terminal-lib.mjs';

const live = {
  handle: 'term_new',
  ptyId: 'repo::/project@@agent-vue',
  incarnationId: 'incarnation-new',
  tabId: 'tab-new',
  leafId: 'leaf-new',
  worktreeId: 'repo::/project',
  worktreePath: '/project',
  agentIdentity: 'pi',
  title: 'Pi - agent-vue',
  connected: true,
  writable: true,
  orphaned: false,
};

test('uses a current handle directly', () => {
  const result = resolveAgentTerminal([live], {
    handle: 'term_new',
    ptyId: live.ptyId,
    incarnationId: live.incarnationId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.resolution, 'exact-match');
  assert.equal(result.terminal.handle, 'term_new');
});

test('recovers a replacement handle by durable ptyId after a restart', () => {
  const result = resolveAgentTerminal([live], {
    handle: 'term_old',
    ptyId: live.ptyId,
    incarnationId: 'incarnation-old',
    tabId: 'tab-old',
    leafId: 'leaf-old',
    worktreeId: live.worktreeId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.resolution, 'recovered-by-pty-id');
  assert.equal(result.terminal.handle, 'term_new');
  assert.match(result.warnings[0], /incarnationId/);
});

test('does not choose an ambiguous tab', () => {
  const second = { ...live, handle: 'term_second', ptyId: 'repo::/project@@agent-tests', leafId: 'leaf-second' };
  const result = resolveAgentTerminal([live, second], { tabId: live.tabId, worktreeId: live.worktreeId });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'ambiguous_terminal');
});

test('refuses a terminal that cannot receive input', () => {
  const dead = { ...live, connected: false };
  const result = resolveAgentTerminal([dead], { ptyId: dead.ptyId });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'terminal_disconnected');
  assert.equal(result.usable, false);
});

test('returns not-found without sending when every supplied identity is stale', () => {
  const result = resolveAgentTerminal([live], { ptyId: 'missing', worktreeId: live.worktreeId });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'terminal_not_found');
});
