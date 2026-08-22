/**
 * dsh-restart — permanent "restart the whole DeepSeek Harness" plugin.
 *
 * Registers a model-callable `restart_harness` tool and a `/restart` command
 * that reload plugins and configuration by restarting the DSH node process.
 *
 * Restart mechanism (Node-native):
 *   - discovery is unnecessary: this plugin runs INSIDE the DSH node process, so
 *     `process.pid` / `process.cwd()` / `process.execPath` / `process.execArgv` /
 *     `process.argv` are read directly.
 *   - relaunch: spawn a detached `node -e` helper (survives the parent's exit via
 *     `detached: true` + `stdio: 'ignore'` + `unref()`), which waits until the old
 *     process releases the listen port, then spawns the new DSH (same argv + cwd,
 *     stdout/stderr appended to timestamped logs). The old process then
 *     `process.exit(0)`s after `delayMs` so the tool result can flush first.
 *   - a "process index" file (`$DSH_HOME/dsh-process.json`) is still written at
 *     boot for external inspection (pid + cwd + command line).
 *
 * @module dsh-restart
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-shell'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { spawn } from 'node:child_process'
import process from 'node:process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-restart'
export const inject = ['tools', 'commands', 'agents', 'shell', 'sandboxPolicy']

/** Plugin configuration (editable via settings.yaml and, later, the UI card). */
interface RestartConfig {
  legacyRestart: boolean
  continuePrompt: string
  watchdogEnabled: boolean
  watchdogCooldownMs: number
  watchdogPollMs: number
}

const RestartConfigSchema: z<RestartConfig> = z.object({
  legacyRestart: z.boolean().default(false),
  continuePrompt: z.string().default('（系统已重启完成）请继续之前未完成的工作。'),
  watchdogEnabled: z.boolean().default(false),
  watchdogCooldownMs: z.number().default(60000),
  watchdogPollMs: z.number().default(1000),
})

const DEFAULT_CONFIG: RestartConfig = {
  legacyRestart: false,
  continuePrompt: '（系统已重启完成）请继续之前未完成的工作。',
  watchdogEnabled: false,
  watchdogCooldownMs: 60000,
  watchdogPollMs: 1000,
}

/** The "process file index": boot facts for external inspection. */
const INDEX_FILENAME = 'dsh-process.json'

/** The "resume marker": the in-progress session to restore after a restart. */
const RESUME_FILENAME = 'dsh-resume.json'

/** Watchdog artifact filenames (supervisor script + its pid lock). */
const WATCHDOG_FILENAME = 'dsh-watchdog.cjs'
const WATCHDOG_PID_FILENAME = 'dsh-watchdog.pid'

/** Restart-in-progress flag: stops the watchdog from racing a deliberate restart. */
const RESTARTING_FLAG_FILENAME = 'dsh-restarting.flag'

function homeDir(): string {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function indexFilePath(): string {
  return path.join(homeDir(), INDEX_FILENAME)
}

function resumeFilePath(): string {
  return path.join(homeDir(), RESUME_FILENAME)
}

function watchdogFilePath(): string {
  return path.join(homeDir(), WATCHDOG_FILENAME)
}

function watchdogPidFilePath(): string {
  return path.join(homeDir(), WATCHDOG_PID_FILENAME)
}

function restartingFlagFilePath(): string {
  return path.join(homeDir(), RESTARTING_FLAG_FILENAME)
}

function writeRestartingFlag(): void {
  try { fs.writeFileSync(restartingFlagFilePath(), String(Date.now()), 'utf8') } catch { /* best-effort */ }
}

function clearRestartingFlag(): void {
  try { fs.unlinkSync(restartingFlagFilePath()) } catch { /* already gone */ }
}

/** Record the in-progress sessions before restart (for auto-resume after reboot). */
function writeResumeMarker(sessionIds: string[]): void {
  try {
    fs.writeFileSync(resumeFilePath(), JSON.stringify({
      sessionIds,
      restartAt: new Date().toISOString(),
      pid: process.pid,
    }, null, 2) + '\n', 'utf8')
  } catch (error) {
    console.error('[dsh-restart] failed to write resume marker:', error)
  }
}

/** Read a session id defensively from an agent-shaped object. */
function sessionIdOf(agent: unknown): string | undefined {
  const session = (agent as { session?: { id?: unknown; header?: { id?: unknown } } } | undefined)?.session
  const id = session?.id ?? session?.header?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/** Read the resume marker recorded before the last restart (list or legacy single form). */
function readResumeMarker(): string[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(resumeFilePath(), 'utf8'))
    const record = parsed as { sessionIds?: unknown; sessionId?: unknown }
    if (Array.isArray(record.sessionIds)) {
      return record.sessionIds.filter((id): id is string => typeof id === 'string' && id !== '')
    }
    if (typeof record.sessionId === 'string' && record.sessionId !== '') {
      return [record.sessionId]
    }
    return []
  } catch {
    return []
  }
}

/** Append a line to the plugin's own debug log for diagnosing auto-continue. */
function debugLog(message: string): void {
  try {
    fs.appendFileSync(path.join(homeDir(), 'dsh-restart-auto.log'), `${new Date().toISOString()} ${message}\n`, 'utf8')
  } catch { /* best-effort */ }
}

/** Remove the resume marker once it has been consumed. */
function clearResumeMarker(): void {
  try { fs.unlinkSync(resumeFilePath()) } catch { /* already gone */ }
}

/**
 * After a restart, wait for the recorded session to be resumed (the client
 * re-opens it) and then inject one "continue" follow-up so the agent picks up
 * the interrupted work without a manual prompt. Polls the live agent registry;
 * gives up after ~60s and clears the marker.
 */
function tryAutoContinue(ctx: Context, dynamic: () => RestartConfig): void {
  const sessionIds = readResumeMarker()
  debugLog(`auto-continue: marker has ${sessionIds.length} session(s) ${JSON.stringify(sessionIds)}`)
  if (sessionIds.length === 0) return
  const pending = new Set(sessionIds)
  let attempts = 0
  const interval = setInterval(() => {
    attempts += 1
    for (const sessionId of [...pending]) {
      const agent = ctx.agents.get(sessionId as never)
      if (agent === undefined) continue
      debugLog(`auto-continue: agent for ${sessionId} is live, following up`)
      try {
        agent.followup(createUserMessage({
          content: [{ type: 'text', text: dynamic().continuePrompt }],
          source: { kind: 'plugin', plugin: name, form: 'instructions' },
        }))
      } catch (error) {
        console.error('[dsh-restart] auto-continue failed:', error)
        debugLog(`auto-continue: followup error for ${sessionId}: ${String(error)}`)
      }
      pending.delete(sessionId)
    }
    if (pending.size === 0) {
      debugLog('auto-continue: all sessions continued')
      clearInterval(interval)
      clearResumeMarker()
    } else if (attempts >= 120) {
      debugLog(`auto-continue: timed out after 60s, ${pending.size} session(s) never resumed: ${JSON.stringify([...pending])}`)
      clearInterval(interval)
      clearResumeMarker()
    }
  }, 500)
  ctx.effect(() => () => clearInterval(interval))
}

/**
 * The supervisor script (written to $DSH_HOME/dsh-watchdog.cjs and run detached):
 * polls whether the DSH web server answers on its port, and relaunches it when
 * the port goes down. Liveness is PORT-based (not pid-based), so a stale process
 * index can never cause a double spawn. A `dsh-restarting.flag` (written by both
 * the restart tool and the watchdog's own relaunch) suppresses relaunch while a
 * restart is already in flight. A `dsh-stop.flag` file stops the watchdog.
 */
function watchdogScript(cooldownMs: number, pollMs: number): string {
  return String.raw`// dsh-watchdog: monitors the DSH web port and relaunches it on death.
const { spawn } = require('node:child_process')
const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const indexFile = path.join(home, 'dsh-process.json')
const stopFile = path.join(home, 'dsh-stop.flag')
const restartFlag = path.join(home, 'dsh-restarting.flag')
const pidFile = path.join(home, 'dsh-watchdog.pid')
const logFile = path.join(home, 'dsh-watchdog.log')
const PORT = (function () {
  const m = String(process.env.DSH_WEB_URL || '').match(/:(\d+)/)
  return m ? Number(m[1]) : 3080
})()

function log(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n', 'utf8') } catch {}
}

try { fs.writeFileSync(pidFile, String(process.pid), 'utf8') } catch {}

function readIndex() {
  try { return JSON.parse(fs.readFileSync(indexFile, 'utf8')) } catch { return null }
}

function portUp(cb) {
  const s = net.connect({ port: PORT, host: '127.0.0.1', timeout: 400 })
  s.once('connect', function () { s.destroy(); cb(true) })
  s.once('timeout', function () { s.destroy(); cb(false) })
  s.once('error', function () { cb(false) })
}

function restartInProgress() {
  try {
    const t = Number(fs.readFileSync(restartFlag, 'utf8'))
    return Number.isFinite(t) && (Date.now() - t) < ${cooldownMs}
  } catch { return false }
}

function relaunch() {
  const idx = readIndex()
  if (!idx || !idx.execPath) { log('relaunch: no usable index'); return }
  try { fs.writeFileSync(restartFlag, String(Date.now()), 'utf8') } catch {}
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const out = path.join(os.tmpdir(), 'dsh-watchdog-' + stamp + '.out.log')
  const err = path.join(os.tmpdir(), 'dsh-watchdog-' + stamp + '.err.log')
  try {
    const o = fs.openSync(out, 'a')
    const e = fs.openSync(err, 'a')
    const argv = [].concat(idx.execArgv || [], idx.argv || [])
    const child = spawn(idx.execPath, argv, { cwd: idx.cwd, detached: true, stdio: ['ignore', o, e], env: process.env })
    child.once('error', function (er) { log('relaunch spawn error: ' + String(er)) })
    child.unref()
    log('relaunch: spawned pid ' + child.pid + ' cwd=' + idx.cwd)
  } catch (er) {
    log('relaunch failed: ' + String(er))
  }
}

let checking = false
setInterval(function () {
  if (fs.existsSync(stopFile)) {
    log('stop flag present, exiting')
    try { fs.unlinkSync(pidFile) } catch {}
    process.exit(0)
  }
  if (checking) return
  checking = true
  portUp(function (up) {
    if (up) { checking = false; return }
    if (restartInProgress()) { checking = false; return }
    log('port ' + PORT + ' down, relaunching')
    relaunch()
    checking = false
  })
}, ${pollMs})

log('watchdog started, pid ' + process.pid)
`
}

/** Spawn the supervisor once (guarded by its pid lock) so DSH comes back on death. */
function ensureWatchdog(dynamic: () => RestartConfig): void {
  if (!dynamic().watchdogEnabled) return
  try {
    const pid = Number.parseInt(fs.readFileSync(watchdogPidFilePath(), 'utf8'), 10)
    if (!Number.isNaN(pid) && pid > 0) {
      try { process.kill(pid, 0); return } catch { /* stale pid file — spawn a fresh one */ }
    }
  } catch { /* no pid file yet */ }
  try {
    fs.writeFileSync(watchdogFilePath(), watchdogScript(dynamic().watchdogCooldownMs, dynamic().watchdogPollMs), 'utf8')
    const child = spawn(process.execPath, [watchdogFilePath()], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    })
    child.once('error', () => {})
    child.unref()
    debugLog('watchdog spawned pid ' + child.pid)
  } catch (error) {
    console.error('[dsh-restart] failed to spawn watchdog:', error)
  }
}

/** Quote one argv element for a cmd-runnable command line. */
function quoteArg(value: string): string {
  return /[\s"]/.test(value) ? '"' + value.replace(/"/g, '\\"') + '"' : value
}

/** Reconstruct the launch command line from the running node process. */
function launchCommandLine(): string {
  return [process.execPath, ...process.execArgv, ...process.argv.slice(1)]
    .map(quoteArg)
    .join(' ')
}

/** Write pid + cwd + command line at boot (kept for external inspection). */
function writeProcessIndex(): void {
  try {
    const file = indexFilePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({
      pid: process.pid,
      cwd: process.cwd(),
      commandLine: launchCommandLine(),
      execPath: process.execPath,
      execArgv: process.execArgv,
      argv: process.argv.slice(1),
      startedAt: new Date().toISOString(),
    }, null, 2) + '\n', 'utf8')
  } catch (error) {
    console.error('[dsh-restart] failed to write process index:', error)
  }
}

interface RestartInfo {
  ok: boolean
  pid: number
  cwd: string
  commandLine: string
  delayMs: number
  logOut: string
  logErr: string
}

/**
 * Node-native self-restart. Spawns a detached helper that relaunches DSH after
 * the current process has exited and released its port, then schedules the
 * current process's own exit.
 */
function restart(delayMs: number): RestartInfo {
  writeRestartingFlag()
  const argv = [...process.execArgv, ...process.argv.slice(1)]
  const cwd = process.cwd()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logOut = path.join(os.tmpdir(), `dsh-restart-${stamp}.out.log`)
  const logErr = path.join(os.tmpdir(), `dsh-restart-${stamp}.err.log`)

  // Detached helper: waits for the old process to release its port, then spawns
  // the new DSH with the same argv + cwd, output appended to the log files.
  const helperCode = [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    `const argv = ${JSON.stringify(argv)}`,
    `const cwd = ${JSON.stringify(cwd)}`,
    `const logOut = ${JSON.stringify(logOut)}`,
    `const logErr = ${JSON.stringify(logErr)}`,
    `const delay = ${delayMs + 800}`,
    'setTimeout(() => {',
    '  try {',
    '    const out = fs.openSync(logOut, "a")',
    '    const err = fs.openSync(logErr, "a")',
    '    const child = spawn(process.execPath, argv, { cwd: cwd, detached: true, stdio: ["ignore", out, err], env: process.env })',
    '    child.once("error", () => process.exit(0))',
    '    child.unref()',
    '  } catch (e) { process.exit(0) }',
    '}, delay)',
  ].join('\n')

  const helper = spawn(process.execPath, ['-e', helperCode], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  helper.once('error', () => {})
  helper.unref()

  // Exit the old process after the tool/command result has had time to flush.
  setTimeout(() => process.exit(0), delayMs)

  return {
    ok: true,
    pid: process.pid,
    cwd,
    commandLine: launchCommandLine(),
    delayMs,
    logOut,
    logErr,
  }
}

/** Accept the privileged restart action only from this Web host on loopback. */
function isTrustedWebRestart(req: { socket: { remoteAddress?: string }; headers: { origin?: string; host?: string } }): boolean {
  const address = req.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const { origin, host } = req.headers
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}

/** Session ids that should resume after a deliberate restart. */
function runningSessionIds(ctx: Context): string[] {
  return [...new Set(
    ctx.agents.roots()
      .filter(agent => agent.status === 'running')
      .map(agent => String(agent.id)),
  )]
}

/**
 * Legacy restart (PowerShell + WMI + taskkill), kept for compatibility: reads
 * the process index, writes a helper .ps1, launches it detached via WMI, and
 * lets it taskkill the tree before relaunching via cmd /c.
 */
function buildLegacyScript(indexPath: string, delayMs: number): string {
  const indexPathLiteral = indexPath.replace(/'/g, "''")
  return `$ErrorActionPreference = 'Stop'
$indexPath = '${indexPathLiteral}'
if (-not (Test-Path -LiteralPath $indexPath)) { throw "process index not found: $indexPath" }
$idx = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
$pid0 = [int]$idx.pid
$cwd = [string]$idx.cwd
$cmdline = [string]$idx.commandLine
if (-not (Get-Process -Id $pid0 -ErrorAction SilentlyContinue)) { throw "recorded pid $pid0 is not alive" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logOut = Join-Path $env:TEMP ("dsh-restart-" + $stamp + ".out.log")
$logErr = Join-Path $env:TEMP ("dsh-restart-" + $stamp + ".err.log")
$cwdB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($cwd))
$cmdB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($cmdline))
$logOutB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($logOut))
$logErrB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($logErr))
$helperTemplate = @'
$ErrorActionPreference = 'Continue'
$nodePid = __PID__
$cwdB64 = '__CWDB64__'
$cmdB64 = '__CMDB64__'
$logOutB64 = '__LOGOUTB64__'
$logErrB64 = '__LOGERRB64__'
$delayMs = __DELAY__
$cwd = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($cwdB64))
$cmdline = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($cmdB64))
$logOut = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($logOutB64))
$logErr = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($logErrB64))
Start-Sleep -Milliseconds $delayMs
taskkill /F /T /PID $nodePid 2>&1 | Out-Null
Start-Sleep -Milliseconds 500
try {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/s','/c', $cmdline -WorkingDirectory $cwd -WindowStyle Hidden -RedirectStandardOutput $logOut -RedirectStandardError $logErr
} catch {
  Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmdline; CurrentDirectory = $cwd } | Out-Null
}
'@
$helper = $helperTemplate.Replace('__PID__', [string]$pid0).Replace('__CWDB64__', $cwdB64).Replace('__CMDB64__', $cmdB64).Replace('__LOGOUTB64__', $logOutB64).Replace('__LOGERRB64__', $logErrB64).Replace('__DELAY__', [string]${delayMs})
$helperPath = Join-Path $env:TEMP 'dsh-restart-helper.ps1'
Set-Content -LiteralPath $helperPath -Value $helper -Encoding UTF8
$launch = 'pwsh.exe -NoProfile -NonInteractive -File "' + $helperPath + '"'
$r = Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{ CommandLine = $launch }
$result = [ordered]@{ pid = $pid0; cwd = $cwd; commandLine = $cmdline; delayMs = ${delayMs}; helperReturnValue = [int]$r.ReturnValue; helperPid = [int]$r.ProcessId; logOut = $logOut; logErr = $logErr }
$result | ConvertTo-Json -Compress`
}

/** Run the legacy PowerShell/WMI restart through the shell service. */
async function restartLegacy(ctx: Context, delayMs: number, policy: unknown): Promise<unknown> {
  writeRestartingFlag()
  const request: Record<string, unknown> = {
    command: buildLegacyScript(indexFilePath(), delayMs),
    timeoutMs: 30000,
  }
  if (policy !== undefined) request.sandboxPolicy = policy
  const spec = ctx.shell.resolve(request as never)
  const result = await ctx.shell.run(spec)
  const stdout = result.stdout && typeof result.stdout.text === 'string' ? result.stdout.text : ''
  const stderr = result.stderr && typeof result.stderr.text === 'string' ? result.stderr.text : ''
  if (result.exitCode !== 0) {
    return { ok: false, error: 'legacy restart failed', exitCode: result.exitCode, stdout, stderr }
  }
  try {
    return { ok: true, ...JSON.parse(stdout.trim()) }
  } catch {
    return { ok: false, error: 'failed to parse legacy restart output', stdout, stderr }
  }
}

export function apply(ctx: Context): void {
  debugLog(`apply: start pid=${process.pid}`)
  try {
    writeProcessIndex()
    debugLog('apply: index written')
  } catch (error) {
    debugLog('apply: writeProcessIndex THREW: ' + String(error))
  }
  clearRestartingFlag()

  let resolveConfig: () => RestartConfig = () => DEFAULT_CONFIG
  const dynamic = (): RestartConfig => resolveConfig()
  try {
    installSettingsSection(ctx, settingsNamespace('dsh-restart'), RestartConfigSchema, DEFAULT_CONFIG, {
      setSource: (get) => { resolveConfig = get },
      onChange: () => {},
    })
    debugLog('apply: settings installed')
  } catch (error) {
    debugLog('apply: installSettingsSection THREW: ' + String(error))
  }

  try {
    tryAutoContinue(ctx, dynamic)
    debugLog('apply: auto-continue scheduled')
  } catch (error) {
    debugLog('apply: tryAutoContinue THREW: ' + String(error))
  }
  try {
    ensureWatchdog(dynamic)
    debugLog('apply: watchdog ensured')
  } catch (error) {
    debugLog('apply: ensureWatchdog THREW: ' + String(error))
  }

  // The restart bundle may mount before the Web host. A one-shot ctx.get()
  // therefore makes the Settings button permanently unavailable on that boot.
  // Inject the optional service so the route follows the Web server lifetime.
  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.webServer as { register: (route: WebRoute) => () => void }
    webServer.register({
      kind: 'exact',
      path: '/plugins/dsh-restart/restart',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end('method not allowed')
          return
        }
        if (!isTrustedWebRestart(req)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        const sessionIds = runningSessionIds(ctx)
        if (sessionIds.length > 0) writeResumeMarker(sessionIds)
        const result = restart(2000)
        res.writeHead(202, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify({ ...result, sessionIds }))
      },
    })
  })

  try {
    ctx.tools.register(defineTool({
    name: 'restart_harness',
    description:
      '重启整个 DeepSeek Harness 进程，用于重新加载插件与配置（profile 的 cordis 组合、settings 等）。'
      + '直接读取当前 node 进程的 pid/工作目录/启动命令行，派生一个 detach 的 helper，'
      + '在旧进程退出并释放端口后以原命令行在原目录重新拉起，然后旧进程退出。'
      + '触发后当前会话连接会短暂中断，网页随后自动重连到新进程。'
      + '返回旧进程 pid、cwd、命令行与日志文件路径。',
    parameters: {
      delayMs: { type: 'number', description: '旧进程退出前等待的毫秒数（给当前结果留出回传时间），默认 2000。' },
    },
    output: {
      schema: { type: 'json' },
      render(_args, value) {
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
      },
    },
    async execute(args, exec) {
      const a = (args ?? {}) as { delayMs?: number }
      const delayMs = Number(a.delayMs) > 0 ? Math.floor(Number(a.delayMs)) : 2000
      // Only resume sessions that were mid-turn (running) at restart time. Idle
      // (already-ended) conversations are left alone — the client re-opens them.
      const sessionIds = runningSessionIds(ctx)
      if (sessionIds.length > 0) writeResumeMarker(sessionIds)
      if (dynamic().legacyRestart) {
        let policy: unknown
        if (exec?.agent?.session) {
          try { policy = ctx.sandboxPolicy.resolve({ session: exec.agent.session }) } catch { policy = undefined }
        }
        const result = await restartLegacy(ctx, delayMs, policy)
        return { ...(result as object), sessionIds }
      }
      return { ...restart(delayMs), sessionIds }
    },
  }))
    debugLog('apply: restart_harness tool registered')
  } catch (error) {
    debugLog('apply: tools.register THREW: ' + String(error))
  }

  try {
    ctx.commands.register({
    name: 'restart',
    description: '重启 DeepSeek Harness（重载插件与配置）',
    recordInput: false,
    async handler(invocation) {
      // Only resume sessions that were mid-turn (running); idle conversations stay put.
      const sessionIds = runningSessionIds(ctx)
      if (sessionIds.length > 0) writeResumeMarker(sessionIds)
      let result: unknown
      if (dynamic().legacyRestart) {
        let policy: unknown
        if (invocation?.agent?.session) {
          try { policy = ctx.sandboxPolicy.resolve({ session: invocation.agent.session }) } catch { policy = undefined }
        }
        result = await restartLegacy(ctx, 2000, policy)
      } else {
        result = restart(2000)
      }
      const r = result as { ok?: boolean; pid?: number; delayMs?: number; logOut?: string; error?: string }
      if (r.ok === false) {
        return { kind: 'error', text: r.error ?? '重启失败' }
      }
      return {
        kind: 'success',
        text: `重启已安排：DSH 进程 PID ${r.pid} 将在约 ${r.delayMs}ms 后重启，将恢复 ${sessionIds.length} 个会话，新进程日志见 ${r.logOut}`,
      }
    },
  })
    debugLog('apply: restart command registered')
  } catch (error) {
    debugLog('apply: commands.register THREW: ' + String(error))
  }

  debugLog('apply: complete')
}
