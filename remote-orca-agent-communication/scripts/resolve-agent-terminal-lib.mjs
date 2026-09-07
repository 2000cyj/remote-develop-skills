/**
 * Pure terminal-resolution logic. Kept separate from the CLI so callers can
 * test their routing policy without talking to a live Orca runtime.
 */

const STABLE_FIELDS = ['worktreeId', 'agentIdentity'];
const ALL_FIELDS = ['handle', 'ptyId', 'incarnationId', 'tabId', 'leafId', ...STABLE_FIELDS];

function suppliedValues(selector) {
  return Object.fromEntries(
    ALL_FIELDS.filter((field) => selector[field]).map((field) => [field, selector[field]]),
  );
}

function same(value, expected) {
  return !expected || value === expected;
}

function compatible(term, selector) {
  return STABLE_FIELDS.every((field) => same(term[field], selector[field]));
}

function unique(candidates) {
  return candidates.length === 1 ? candidates[0] : null;
}

function availability(term) {
  if (term.orphaned) return { usable: false, code: 'terminal_orphaned', message: '终端已 orphaned，关联进程不可用。' };
  if (!term.connected) return { usable: false, code: 'terminal_disconnected', message: '终端当前未连接到 Orca runtime。' };
  if (!term.writable) return { usable: false, code: 'terminal_read_only', message: '终端不可写，不能发送消息。' };
  return { usable: true };
}

function changedFields(term, selector) {
  return ['incarnationId', 'tabId', 'leafId'].filter(
    (field) => selector[field] && term[field] !== selector[field],
  );
}

function success(term, selector, resolution) {
  const changed = changedFields(term, selector);
  const state = availability(term);
  if (!state.usable) {
    return {
      ok: false,
      usable: false,
      error: state,
      resolution,
      supplied: suppliedValues(selector),
      terminal: publicTerminal(term),
    };
  }
  return {
    ok: true,
    usable: true,
    resolution,
    recovered: resolution !== 'exact-match',
    supplied: suppliedValues(selector),
    terminal: publicTerminal(term),
    warnings: changed.length
      ? [`终端实例或布局已变化：${changed.join(', ')}；发送前应按新任务上下文重新确认。`]
      : [],
    sendTarget: {
      terminalHandle: term.handle,
      command: `orca terminal send --terminal ${term.handle} --text <message> --enter --json`,
    },
  };
}

function publicTerminal(term) {
  return {
    handle: term.handle,
    ptyId: term.ptyId ?? null,
    incarnationId: term.incarnationId ?? null,
    tabId: term.tabId ?? null,
    leafId: term.leafId ?? null,
    worktreeId: term.worktreeId ?? null,
    worktreePath: term.worktreePath ?? null,
    title: term.title ?? null,
    agentIdentity: term.agentIdentity ?? null,
    connected: Boolean(term.connected),
    writable: Boolean(term.writable),
    orphaned: Boolean(term.orphaned),
  };
}

function failure(code, message, selector, candidates = []) {
  return {
    ok: false,
    usable: false,
    error: { code, message },
    supplied: suppliedValues(selector),
    candidates: candidates.map(publicTerminal),
  };
}

/**
 * Resolve a possibly stale terminal reference to one live Orca terminal.
 *
 * Recovery priority: ptyId (durable logical terminal) → incarnationId →
 * leafId (specific pane) → handle → tabId. worktreeId and agentIdentity are
 * constraints whenever supplied; tabId alone is intentionally rejected when
 * it points to more than one pane.
 */
export function resolveAgentTerminal(terminals, selector) {
  const supplied = suppliedValues(selector);
  if (Object.keys(supplied).length === 0) {
    return failure('missing_selector', '至少传入 handle、ptyId、incarnationId、tabId、leafId、worktreeId 或 agentIdentity 之一。', selector);
  }

  const all = terminals.filter((term) => compatible(term, selector));
  const exact = all.filter((term) => ALL_FIELDS.every((field) => same(term[field], selector[field])));
  if (exact.length === 1) return success(exact[0], selector, 'exact-match');
  if (exact.length > 1) return failure('ambiguous_terminal', '全部标识匹配到多个终端，拒绝发送以避免误投递。', selector, exact);

  const strategies = [
    ['recovered-by-pty-id', 'ptyId'],
    ['recovered-by-incarnation-id', 'incarnationId'],
    ['recovered-by-leaf-id', 'leafId'],
    ['recovered-by-handle', 'handle'],
    ['recovered-by-tab-id', 'tabId'],
  ];
  for (const [resolution, field] of strategies) {
    if (!selector[field]) continue;
    const candidates = all.filter((term) => term[field] === selector[field]);
    const found = unique(candidates);
    if (found) return success(found, selector, resolution);
    if (candidates.length > 1) {
      return failure('ambiguous_terminal', `${field} 匹配到 ${candidates.length} 个终端；请同时提供 ptyId、leafId 或 worktreeId。`, selector, candidates);
    }
  }

  return failure(
    'terminal_not_found',
    '没有找到与所给标识相符的 Orca 终端。目标 Agent 可能不存在、已关闭，或传入的信息属于其他 worktree/runtime。',
    selector,
  );
}
