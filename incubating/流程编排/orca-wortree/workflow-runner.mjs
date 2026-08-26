#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CONFIG = join(SCRIPT_DIR, "workflow.yaml")
const STATE_DIR = join(SCRIPT_DIR, "state")
const ORCA = process.env.ORCA_CLI_COMMAND || (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : "orca")

const args = parseArgs(process.argv.slice(2))
const command = args._[0] || "status"
const configPath = resolve(args.config || DEFAULT_CONFIG)

const MODE_COMMANDS = new Set(["create", "sync", "status", "retry", "pause", "resume", "archive", "cleanup"])

function parseArgs(values) {
  const result = { _: [] }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith("--")) {
      result._.push(value)
      continue
    }
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    const next = values[index + 1]
    result[key] = next && !next.startsWith("--") ? values[++index] : true
  }
  return result
}

function fail(message) {
  throw new Error(message)
}

function readConfig() {
  if (!existsSync(configPath)) fail(`配置文件不存在：${configPath}`)
  const config = parse(readFileSync(configPath, "utf8"))
  validateConfig(config)
  return config
}

function validateConfig(config) {
  if (!config || typeof config !== "object") fail("配置文件必须是 YAML 对象")
  if (config.version !== 1) fail("version 必须为 1")
  if (config.workflow?.enabled === false) fail("workflow.enabled 已设为 false")
  if (!config.run?.objective || typeof config.run.objective !== "string") fail("run.objective 不能为空")
  if (!Array.isArray(config.workers) || config.workers.length === 0) fail("workers 必须是非空数组")

  const ids = new Set()
  for (const worker of config.workers) {
    if (!worker?.id || typeof worker.id !== "string") fail("每个 worker 必须有字符串 id")
    if (ids.has(worker.id)) fail(`worker id 重复：${worker.id}`)
    ids.add(worker.id)
    if (!worker.task?.description || typeof worker.task.description !== "string") fail(`worker ${worker.id} 缺少 task.description`)
    if (worker.worktree?.mode && !["current", "new-child", "new-top-level"].includes(worker.worktree.mode)) {
      fail(`worker ${worker.id} 的 worktree.mode 不合法`)
    }
    for (const dependency of worker.task.dependsOn || []) {
      if (!ids.has(dependency) && !config.workers.some(item => item.id === dependency)) {
        fail(`worker ${worker.id} 依赖不存在：${dependency}`)
      }
    }
  }
  assertAcyclic(config.workers)
}

function assertAcyclic(workers) {
  const graph = new Map(workers.map(worker => [worker.id, worker.task.dependsOn || []]))
  const visiting = new Set()
  const visited = new Set()
  function visit(id) {
    if (visiting.has(id)) fail(`检测到循环依赖：${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of graph.get(id) || []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const worker of workers) visit(worker.id)
}

function workflowId(config) {
  return config.workflow?.id || basenameWithoutExtension(configPath)
}

function basenameWithoutExtension(path) {
  return path.split(/[\\/]/).pop().replace(/\.[^.]+$/, "")
}

function statePath(config) {
  return join(STATE_DIR, `${workflowId(config)}.json`)
}

function loadState(config) {
  const path = statePath(config)
  if (!existsSync(path)) return createEmptyState(config)
  return JSON.parse(readFileSync(path, "utf8"))
}

function createEmptyState(config) {
  return {
    version: 1,
    workflowId: workflowId(config),
    configPath,
    runId: null,
    paused: false,
    workers: {},
    updatedAt: new Date().toISOString()
  }
}

function saveState(state, config) {
  mkdirSync(STATE_DIR, { recursive: true })
  state.updatedAt = new Date().toISOString()
  writeFileSync(statePath(config), `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

function resolveProjectPath(config) {
  const configured = config.project?.path || "."
  return isAbsolute(configured) ? configured : resolve(dirname(configPath), configured)
}

function runOrca(commandArgs, { allowFailure = false } = {}) {
  try {
    const output = execFileSync(ORCA, commandArgs, {
      cwd: resolveProjectPath(readConfig()),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
    return JSON.parse(output)
  } catch (error) {
    if (allowFailure) return null
    const detail = [error.stdout, error.stderr].filter(Boolean).join("\n").trim()
    fail(`Orca 命令失败：${commandArgs.join(" ")}\n${detail || error.message}`)
  }
}

function selector(value) {
  if (!value) return undefined
  return value.startsWith("id:") || value.startsWith("name:") || value.startsWith("path:") || value.startsWith("branch:")
    ? value
    : `id:${value}`
}

function effectiveWorker(config, worker) {
  return {
    ...worker,
    agent: { ...(config.defaults?.agent || {}), ...(worker.agent || {}) },
    worktree: { ...(config.defaults?.worktree || {}), ...(worker.worktree || {}) },
    task: { ...(config.defaults?.task || {}), ...(worker.task || {}) }
  }
}

function taskSpec(worker) {
  const title = worker.task.title || worker.name || worker.id
  return `${title}\n\n${worker.task.description}`
}

function getOrCreateRun(config, state, dryRun) {
  if (state.runId) return state.runId
  if (dryRun) return "<new-run>"
  const result = runOrca(["orchestration", "run-create", "--objective", config.run.objective, "--json"])
  state.runId = result.result?.run?.id || result.result?.id || null
  if (!state.runId) fail("Orca 未返回 runId")
  return state.runId
}

function taskCreateArgs(config, spec, dependencies) {
  const args = ["orchestration", "task-create", "--spec", spec]
  if (dependencies.length) args.push("--deps", JSON.stringify(dependencies))
  args.push("--json")
  return args
}

function ensureTask(config, state, worker, dryRun) {
  const entry = state.workers[worker.id] || {}
  if (entry.taskId) return entry.taskId
  if (dryRun) return "<new-task>"
  const dependencies = (worker.task.dependsOn || [])
    .map(id => state.workers[id]?.taskId)
    .filter(Boolean)
  const result = runOrca(taskCreateArgs(config, taskSpec(worker), dependencies))
  entry.taskId = result.result?.task?.id || result.result?.id || null
  if (!entry.taskId) fail(`Worker ${worker.id} 创建 Task 后未返回 taskId`)
  state.workers[worker.id] = entry
  return entry.taskId
}

function ensureWorker(config, state, worker, dryRun) {
  const entry = state.workers[worker.id] || {}
  if (entry.worktreeId && entry.dispatchId) return entry
  if (dryRun) return { ...entry, worktreeId: "<worktree>", dispatchId: "<dispatch>" }
  if (!entry.worktreeId) {
    const worktree = worker.worktree
    const args = ["worktree", "create", "--name", worktree.name || worker.name || worker.id, "--setup", worktree.setup || "run"]
    if (config.project?.repo) args.push("--repo", config.project.repo)
    if (config.project?.baseBranch || worktree.baseBranch) args.push("--base-branch", worktree.baseBranch || config.project.baseBranch)
    if (worktree.mode === "new-top-level") args.push("--no-parent")
    else if (worktree.parent === "coordinator" || worktree.mode === "new-child") args.push("--parent-worktree", "active")
    args.push("--json")
    const result = runOrca(args)
    entry.worktreeId = result.result?.worktree?.id
    if (!entry.worktreeId) fail(`Worker ${worker.id} 创建 Worktree 后未返回 worktreeId`)
  }
  if (!entry.dispatchId) {
    const agentArgs = ["orchestration", "worker-start", "--task", entry.taskId, "--worktree", selector(entry.worktreeId), "--agent", worker.agent.type, "--setup", worker.worktree.setup || "run"]
    if (worker.agent.model) agentArgs.push("--model", worker.agent.model)
    if (worker.agent.effort) agentArgs.push("--effort", worker.agent.effort)
    agentArgs.push("--json")
    const result = runOrca(agentArgs)
    entry.dispatchId = result.result?.dispatch?.id || result.result?.dispatchId
    entry.status = "running"
    if (!entry.dispatchId) fail(`Worker ${worker.id} 启动后未返回 dispatchId`)
  }
  state.workers[worker.id] = entry
  return entry
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2))
}

function printDryRun(config, state) {
  printJson({
    mode: "dry-run",
    workflowId: workflowId(config),
    objective: config.run.objective,
    runId: state.runId || "<new-run>",
    workers: config.workers.filter(worker => worker.enabled !== false).map(worker => {
      const effective = effectiveWorker(config, worker)
      return {
        id: worker.id,
        task: taskSpec(effective),
        agent: effective.agent,
        worktree: effective.worktree,
        dependsOn: effective.task.dependsOn || [],
        state: state.workers[worker.id] || null
      }
    })
  })
}

function sync(config, { dryRun = false, retry = false } = {}) {
  const state = loadState(config)
  if (state.paused && !retry) {
    printJson({ status: "paused", workflowId: workflowId(config), statePath: statePath(config) })
    return
  }
  if (dryRun) {
    printDryRun(config, state)
    return
  }
  getOrCreateRun(config, state, false)
  for (const rawWorker of config.workers.filter(worker => worker.enabled !== false)) {
    const worker = effectiveWorker(config, rawWorker)
    const entry = state.workers[worker.id] || {}
    if (entry.status === "completed") continue
    if (entry.status === "failed" && !retry) continue
    ensureTask(config, state, worker, false)
    const dependenciesReady = (worker.task.dependsOn || []).every(id => state.workers[id]?.status === "completed")
    if (!dependenciesReady) {
      entry.status = "blocked"
      state.workers[worker.id] = entry
      continue
    }
    ensureWorker(config, state, worker, false)
  }
  saveState(state, config)
  printJson({ status: "synced", workflowId: workflowId(config), statePath: statePath(config), state })
}

function status(config) {
  const state = loadState(config)
  printJson({ workflowId: workflowId(config), statePath: statePath(config), state })
}

function setPaused(config, paused) {
  const state = loadState(config)
  state.paused = paused
  saveState(state, config)
  printJson({ status: paused ? "paused" : "resumed", statePath: statePath(config) })
}

function archive(config) {
  const state = loadState(config)
  state.archivedAt = new Date().toISOString()
  saveState(state, config)
  printJson({ status: "archived", statePath: statePath(config) })
}

function cleanup(config) {
  const state = loadState(config)
  if (args.deleteWorktrees !== true && args.deleteWorktrees !== "true") {
    printJson({ status: "archived", message: "默认只归档状态，保留 Orca Worktree。使用 --delete-worktrees 才会请求删除。", statePath: statePath(config) })
    return
  }
  for (const entry of Object.values(state.workers)) {
    if (entry.worktreeId) runOrca(["worktree", "rm", "--worktree", selector(entry.worktreeId), "--force", "--json"], { allowFailure: true })
  }
  state.cleanedAt = new Date().toISOString()
  saveState(state, config)
  printJson({ status: "cleaned", statePath: statePath(config) })
}

function main() {
  const config = readConfig()
  if (command === "validate") {
    printJson({ valid: true, configPath, workflowId: workflowId(config), workerCount: config.workers.length })
    return
  }
  if (command === "dry-run") {
    sync(config, { dryRun: true })
    return
  }
  if (!MODE_COMMANDS.has(command)) fail(`未知命令：${command}`)
  if (command === "create" || command === "sync") return sync(config)
  if (command === "retry") return sync(config, { retry: true })
  if (command === "status") return status(config)
  if (command === "pause") return setPaused(config, true)
  if (command === "resume") return setPaused(config, false)
  if (command === "archive") return archive(config)
  if (command === "cleanup") return cleanup(config)
}

try {
  main()
} catch (error) {
  console.error(`[orca-workflow] ${error.message || error}`)
  process.exitCode = 1
}
