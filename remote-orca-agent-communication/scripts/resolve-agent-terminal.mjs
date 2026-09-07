#!/usr/bin/env node
/**
 * Resolve and validate a target Orca Agent terminal before another Agent sends
 * it a message. This script never sends input itself.
 *
 * Example:
 *   node remote-orca-agent-communication/scripts/resolve-agent-terminal.mjs \
 *     --handle term_old --pty-id '<ptyId>' --incarnation-id '<oldId>'
 *
 * Exit codes:
 *   0 resolved and writable; safe for the caller to send to terminal.handle
 *   2 no terminal matched the supplied identity
 *   3 more than one terminal matched; caller must provide a stronger selector
 *   4 matched terminal is dead, orphaned, disconnected, or read-only
 *   64 invalid command-line arguments / Orca query failure
 */

import { execFileSync } from 'node:child_process';
import { resolveAgentTerminal } from './resolve-agent-terminal-lib.mjs';

const ORCA = process.env.ORCA_CLI_COMMAND || 'orca';
const args = process.argv.slice(2);
const OPTIONS = new Map([
  ['--handle', 'handle'],
  ['--pty-id', 'ptyId'],
  ['--incarnation-id', 'incarnationId'],
  ['--tab-id', 'tabId'],
  ['--leaf-id', 'leafId'],
  ['--worktree-id', 'worktreeId'],
  ['--agent-identity', 'agentIdentity'],
]);

function usage(exitCode = 0) {
  const out = `用法:
  node remote-orca-agent-communication/scripts/resolve-agent-terminal.mjs [selector ...]

选择参数（至少提供一个；可组合以缩小目标）：
  --handle <term_xxx>           Orca Terminal ID，适合当前运行时直接操作
  --pty-id <id>                 逻辑终端/会话 ID；handle 失效后的首选恢复依据
  --incarnation-id <id>         当前终端实例代次 ID
  --tab-id <id>                 Orca 页签 ID
  --leaf-id <id>                页签内具体 pane ID
  --worktree-id <repo::path>    限制必须属于此 worktree
  --agent-identity <name>       限制 Agent 类型，例如 claude / pi
  --help, -h                    显示帮助

输出：始终向 stdout 输出 JSON。
成功时读取 .terminal.handle 后，由调用 Agent 自己执行：
  orca terminal send --terminal <handle> --text <message> --enter --json

安全规则：脚本只解析和检查，不会自动发送消息。匹配失败、歧义或终端不可写时
退出非零；调用 Agent 必须停止发送并告知用户目标不存在或会话信息错误。`;
  (exitCode === 0 ? console.log : console.error)(out);
  process.exit(exitCode);
}

function parseArgs() {
  const selector = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--help' || token === '-h') usage(0);
    const [flag, inline] = token.split(/=(.*)/s, 2);
    const field = OPTIONS.get(flag);
    if (!field) usage(64);
    const value = inline ?? args[++i];
    if (!value || value.startsWith('--')) usage(64);
    selector[field] = value;
  }
  return selector;
}

function printAndExit(result) {
  console.log(JSON.stringify(result, null, 2));
  if (result.ok) process.exit(0);
  if (result.error.code === 'terminal_not_found') process.exit(2);
  if (result.error.code === 'ambiguous_terminal') process.exit(3);
  process.exit(4);
}

const selector = parseArgs();
if (Object.keys(selector).length === 0) {
  printAndExit(resolveAgentTerminal([], selector));
}

let parsed;
try {
  const raw = execFileSync(ORCA, ['terminal', 'list', '--json'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  parsed = JSON.parse(raw);
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    usable: false,
    error: {
      code: 'orca_query_failed',
      message: `无法查询 Orca terminal list：${error.message}`,
    },
    supplied: selector,
  }, null, 2));
  process.exit(64);
}

if (!parsed?.ok || !Array.isArray(parsed?.result?.terminals)) {
  console.log(JSON.stringify({
    ok: false,
    usable: false,
    error: {
      code: 'orca_query_failed',
      message: 'Orca 未返回可用的 terminal 列表。',
    },
    supplied: selector,
  }, null, 2));
  process.exit(64);
}

printAndExit(resolveAgentTerminal(parsed.result.terminals, selector));
