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
 *   - relaunch: spawn a detached helper script (survives the parent's exit via
 *     `detached: true` + `stdio: 'ignore'` + `unref()`), which waits until the old
 *     process has exited (and so released the listen port), then spawns the new
 *     DSH (same argv + cwd, stdout/stderr appended to timestamped logs). The old
 *     process leaves after `delayMs` so the tool result can flush first, through
 *     DSH's own graceful SIGTERM shutdown where available (see exitForRestart).
 *   - the new DSH gets the environment DSH was launched with (relaunch-env.ts),
 *     not the current one with `.env` values and the published proxy mixed in.
 *   - as the main process of a systemd service no helper is used (it would die
 *     with the service cgroup); the service manager restarts DSH (supervisor.ts).
 *   - a "process index" file (`$DSH_HOME/dsh-process.json`) is still written at
 *     boot for external inspection (pid + cwd + command line).
 *
 * @module dsh-restart
 */

import type { Context, Volatile, VolatileSnapshot } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-shell'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage, type ContextFormed } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'
import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { restartHelperScript } from './relaunch-helper.js'
import { RestartCoordinator } from './restart-coordinator.js'
import { exitForRestart, superviseRestartHelper } from './restart-helper-lifecycle.js'
import { inheritedEnvironmentOf, relaunchEnvironment } from './relaunch-env.js'
import { detectSystemdService, journalCommand, supervisedRestart, type SystemdService } from './supervisor.js'

// The auto-continue follow-up's producer kind (DSH 0.2.x message sources are a
// merge-extensible sum type; each plugin declares its own kind).
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-restart': { kind: 'dsh-restart' } & ContextFormed
  }
}

export const name = 'dsh-restart'
export const inject = ['tools', 'commands', 'agents', 'shell', 'sandboxPolicy']

/**
 * Plugin configuration. DSH 0.2.x derives the settings form from the exported
 * `Config` schema and hands the resolved config to `apply` as its second
 * argument. Volatile fields arrive as live references the settings form
 * updates in place, so reading `.get()` at use time always sees current
 * values; only volatile fields are editable through the form.
 */
interface RestartConfig {
  legacyRestart: Volatile<boolean>
  /** Empty = follow the DSH Language setting (see defaultContinuePrompt). */
  continuePrompt: Volatile<string>
  /** @deprecated Retained only so existing settings files remain readable. */
  watchdogEnabled: boolean
  /** @deprecated The embedded watchdog is disabled and this value is ignored. */
  watchdogCooldownMs: number
  /** @deprecated The embedded watchdog is disabled and this value is ignored. */
  watchdogPollMs: number
}

const RestartConfigSchema = z.object({
  legacyRestart: z.boolean().default(false).volatile(),
  continuePrompt: z.string().default('').volatile(),
  watchdogEnabled: z.boolean().default(false),
  watchdogCooldownMs: z.number().default(60000),
  watchdogPollMs: z.number().default(1000),
})

/** DSH reads this export for the settings form and config validation. */
export const Config = RestartConfigSchema

/** A detached stand-in for a live reference, for hosts that pass no config. */
const stableRef = <T>(value: T): Volatile<T> => ({ get: (): VolatileSnapshot<T> => value as VolatileSnapshot<T> })

const DEFAULT_CONFIG: RestartConfig = {
  legacyRestart: stableRef(false),
  continuePrompt: stableRef(''),
  watchdogEnabled: false,
  watchdogCooldownMs: 60000,
  watchdogPollMs: 1000,
}

/**
 * The default continue prompt follows the DSH Language setting (the `locale`
 * entry's BCP 47-style preference): Chinese for `zh`, English otherwise.
 * Injected Chinese text nudges Chinese-capable models into replying in
 * Chinese for the rest of the session, so the prompt language must follow the
 * UI language instead of being hardcoded. With no preference the UI follows
 * the browser, which the host cannot see directly; the browser half therefore
 * reports its active locale (`x-dsh-locale` on this plugin's route, with the
 * request's Accept-Language as a fallback) and the restart records it in the
 * resume marker. Without any of these it falls back to English, mirroring
 * DSH's own FALLBACK_LOCALE.
 */
const ZH_CONTINUE_PROMPT = '（系统已重启完成）请继续之前未完成的工作。'
const EN_CONTINUE_PROMPT = '(The system restart is complete.) Please continue the unfinished work.'

/** The localized default prompt for the configured DSH language. */
function defaultContinuePrompt(preference: string | undefined): string {
  const language = preference?.split('-')[0]?.toLowerCase()
  return language === 'zh' ? ZH_CONTINUE_PROMPT : EN_CONTINUE_PROMPT
}

const LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

/** The browser UI's active locale, as reported on this plugin's Web route. */
function uiLocaleOf(headers: WebRestartRequest['headers']): string | undefined {
  const reported = headers['x-dsh-locale']
  if (typeof reported === 'string' && LOCALE_ID_PATTERN.test(reported)) return reported
  // Older clients send no hint: take the first built-in (zh/en) Accept-Language range.
  const accepted = headers['accept-language']
  if (typeof accepted !== 'string') return undefined
  for (const range of accepted.split(',')) {
    const tag = range.split(';')[0]?.trim() ?? ''
    const primary = tag.split('-')[0]?.toLowerCase()
    if ((primary === 'zh' || primary === 'en') && LOCALE_ID_PATTERN.test(tag)) return tag
  }
  return undefined
}

/** Last UI locale a browser reported to this process. */
let reportedUiLocale: string | undefined

/** The "process file index": boot facts for external inspection. */
const INDEX_FILENAME = 'dsh-process.json'

/** The "resume marker": the in-progress session to restore after a restart. */
const RESUME_FILENAME = 'dsh-resume.json'

/** Compatibility stop marker consumed by watchdogs detached by older releases. */
const LEGACY_WATCHDOG_STOP_FILENAME = 'dsh-stop.flag'

/** Stable identity for this loaded DSH process. */
const PROCESS_STARTED_AT = new Date(performance.timeOrigin).toISOString()

function homeDir(): string {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function indexFilePath(): string {
  return path.join(homeDir(), INDEX_FILENAME)
}

function resumeFilePath(): string {
  return path.join(homeDir(), RESUME_FILENAME)
}

/** Disable any detached watchdog that may have survived an upgrade. */
function disableLegacyWatchdog(): void {
  try {
    fs.mkdirSync(homeDir(), { recursive: true })
    fs.writeFileSync(
      path.join(homeDir(), LEGACY_WATCHDOG_STOP_FILENAME),
      'disabled by dsh-restart: embedded watchdog retired\n',
      'utf8',
    )
  } catch (error) {
    console.error('[dsh-restart] failed to disable legacy watchdog:', error)
  }
}

/** The resume marker: sessions to continue, and which process scheduled the restart. */
interface ResumeMarker {
  sessionIds: string[]
  restartAt?: string
  /**
   * Identity of the process that wrote the marker; while it is still this one
   * the restart has not happened. Both are compared because a PID alone repeats
   * across restarts inside a PID namespace (DSH as PID 1 in a container).
   */
  pid?: number
  startedAt?: string
  /** The browser UI locale at restart time (see defaultContinuePrompt). */
  uiLocale?: string
}

function saveResumeMarker(marker: ResumeMarker): void {
  try {
    fs.writeFileSync(resumeFilePath(), JSON.stringify(marker, null, 2) + '\n', 'utf8')
  } catch (error) {
    console.error('[dsh-restart] failed to write resume marker:', error)
  }
}

/** Record the in-progress sessions before restart (for auto-resume after reboot). */
function writeResumeMarker(sessionIds: string[]): void {
  const marker: ResumeMarker = { sessionIds, restartAt: new Date().toISOString(), pid: process.pid, startedAt: PROCESS_STARTED_AT }
  if (reportedUiLocale !== undefined) marker.uiLocale = reportedUiLocale
  saveResumeMarker(marker)
}

/** Read a session id defensively from an agent-shaped object. */
function sessionIdOf(agent: unknown): string | undefined {
  const session = (agent as { session?: { id?: unknown; header?: { id?: unknown } } } | undefined)?.session
  const id = session?.id ?? session?.header?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/** Read the resume marker recorded before the last restart (list or legacy single form). */
function readResumeMarker(): ResumeMarker {
  try {
    const parsed = JSON.parse(fs.readFileSync(resumeFilePath(), 'utf8'))
    const record = parsed as { sessionIds?: unknown; sessionId?: unknown; restartAt?: unknown; pid?: unknown; startedAt?: unknown; uiLocale?: unknown }
    const marker: ResumeMarker = { sessionIds: [] }
    if (typeof record.restartAt === 'string') marker.restartAt = record.restartAt
    if (typeof record.pid === 'number' && Number.isInteger(record.pid)) marker.pid = record.pid
    if (typeof record.startedAt === 'string') marker.startedAt = record.startedAt
    if (typeof record.uiLocale === 'string' && LOCALE_ID_PATTERN.test(record.uiLocale)) marker.uiLocale = record.uiLocale
    if (Array.isArray(record.sessionIds)) {
      marker.sessionIds = record.sessionIds.filter((id): id is string => typeof id === 'string' && id !== '')
    } else if (typeof record.sessionId === 'string' && record.sessionId !== '') {
      marker.sessionIds = [record.sessionId]
    }
    return marker
  } catch {
    return { sessionIds: [] }
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

/** The DSH Language setting (`locale` entry), read through the settings service. */
type ReadLocalePreference = () => string | undefined

/** Host-owned "open this session" (the session controller's resolveAgent), when mounted. */
type ResumeSession = (sessionId: string) => Promise<unknown>

/**
 * After a restart, bring each recorded session back and inject one "continue"
 * follow-up so the agent picks up the interrupted work without a manual
 * prompt. A session that no browser re-opens is resumed through the session
 * controller, the same host-owned path the Web client uses to open a session:
 * the agent is owned by the controller, not by this plugin, so a reload of
 * this plugin never tears it down. Polls the live agent registry; gives up
 * after ~60s and clears the marker.
 *
 * The marker is shrunk as sessions are continued, so a re-apply of this plugin
 * (hot reload) inside the window never continues the same session twice, and a
 * marker written by this very process (restart still pending, or a failed
 * restart) is left alone instead of prompting sessions that never restarted.
 */
function tryAutoContinue(
  ctx: Context,
  dynamic: () => RestartConfig,
  readLocalePreference: ReadLocalePreference,
  resumeSession: () => ResumeSession | undefined,
): void {
  const marker = readResumeMarker()
  const { sessionIds } = marker
  debugLog(`auto-continue: marker has ${sessionIds.length} session(s) ${JSON.stringify(sessionIds)}`)
  if (sessionIds.length === 0) return
  if (marker.pid === process.pid && marker.startedAt === PROCESS_STARTED_AT) {
    debugLog('auto-continue: marker was written by this process (restart not happened yet), skipping')
    return
  }
  const pending = new Set(sessionIds)
  const resuming = new Set<string>()
  const unresumable = new Set<string>()
  let attempts = 0
  const interval = setInterval(() => {
    attempts += 1
    const before = pending.size
    for (const sessionId of [...pending]) {
      const agent = ctx.agents.get(sessionId as never)
      if (agent === undefined) {
        if (unresumable.has(sessionId)) {
          pending.delete(sessionId)
          continue
        }
        const resume = resumeSession()
        if (resume !== undefined && !resuming.has(sessionId)) {
          resuming.add(sessionId)
          debugLog(`auto-continue: resuming ${sessionId} through the session controller`)
          resume(sessionId).then((result) => {
            const error = (result as { error?: unknown } | undefined)?.error
            if (error === undefined) return
            debugLog(`auto-continue: cannot resume ${sessionId}: ${String((error as { message?: unknown }).message ?? error)}`)
            unresumable.add(sessionId)
          }, (error: unknown) => {
            debugLog(`auto-continue: resume of ${sessionId} threw: ${String(error)}`)
            unresumable.add(sessionId)
          })
        }
        continue
      }
      if (agent.status === 'running') {
        // Something else (the user, the host's own recovery, another plugin)
        // already resumed this session; a follow-up would queue a second turn.
        debugLog(`auto-continue: ${sessionId} is already running, not following up`)
        pending.delete(sessionId)
        continue
      }
      debugLog(`auto-continue: agent for ${sessionId} is live, following up`)
      try {
        const prompt = dynamic().continuePrompt.get().trim()
          || defaultContinuePrompt(readLocalePreference() ?? marker.uiLocale ?? reportedUiLocale)
        agent.followup(createUserMessage({
          content: [{ type: 'text', text: prompt }],
          source: { kind: 'dsh-restart', form: 'instructions' },
        }))
      } catch (error) {
        console.error('[dsh-restart] auto-continue failed:', error)
        debugLog(`auto-continue: followup error for ${sessionId}: ${String(error)}`)
        continue
      }
      pending.delete(sessionId)
    }
    if (pending.size === 0) {
      debugLog('auto-continue: done, no sessions left to continue')
      clearInterval(interval)
      clearResumeMarker()
    } else if (attempts >= 120) {
      debugLog(`auto-continue: timed out after 60s, ${pending.size} session(s) never came back: ${JSON.stringify([...pending])}`)
      clearInterval(interval)
      clearResumeMarker()
    } else if (pending.size < before) {
      saveResumeMarker({ ...marker, sessionIds: [...pending] })
    }
  }, 500)
  ctx.effect(() => () => clearInterval(interval))
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
      startedAt: PROCESS_STARTED_AT,
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
  /** Set when the service manager carries out the restart (no helper). */
  supervisor?: string
}

const restartCoordinator = new RestartCoordinator<RestartInfo>()

/** How long the helper waits past the scheduled exit for the old process to go. */
const OLD_PROCESS_EXIT_TIMEOUT_MS = 30_000

/** The systemd service this process is the main process of, if any. */
function systemdService(): SystemdService | undefined {
  return detectSystemdService({
    platform: process.platform,
    pid: process.pid,
    env: process.env,
    readCgroup: () => fs.readFileSync('/proc/self/cgroup', 'utf8'),
    systemctl: (args) => {
      const result = spawnSync('systemctl', args, { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
      return { status: result.status, stdout: result.stdout ?? '' }
    },
  })
}

/**
 * Restart as the main process of a systemd service: the manager relaunches
 * DSH, either after a graceful exit (Restart=always/on-success) or through a
 * restart job. Returns undefined when not under such a service.
 */
function launchSupervisedRestart(delayMs: number): RestartInfo | undefined {
  const service = systemdService()
  if (service === undefined) return undefined
  const route = supervisedRestart(service, process.getuid?.() === 0)
  if (route.kind === 'unsupported') throw new Error(route.reason)
  const journal = journalCommand(service)
  const info: RestartInfo = {
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    commandLine: launchCommandLine(),
    delayMs,
    logOut: journal,
    logErr: journal,
    supervisor: `systemd${service.user ? ' --user' : ''} ${service.unit} (Restart=${service.restart})`,
  }
  debugLog(`restart: under ${info.supervisor}, ${route.kind === 'exit' ? 'leaving for the manager to relaunch' : 'requesting a restart job'}`)
  setTimeout(() => {
    if (route.kind === 'exit') {
      exitForRestart(process)
      return
    }
    const job = spawn('systemctl', route.args, { stdio: 'ignore' })
    const fail = (reason: string): void => {
      restartCoordinator.release(info)
      clearResumeMarker()
      console.error(`[dsh-restart] systemctl ${route.args.join(' ')} failed: ${reason}`)
      debugLog(`restart: systemctl ${route.args.join(' ')} failed: ${reason}`)
    }
    job.once('error', error => { fail(String(error)) })
    job.once('exit', (code, signal) => { if (code !== 0) fail(`exit ${code ?? signal}`) })
  }, delayMs)
  return info
}

/**
 * Node-native self-restart. Spawns a detached helper that relaunches DSH after
 * the current process has exited and released its port, then schedules the
 * current process's own exit. Under a systemd service the manager restarts
 * DSH instead (launchSupervisedRestart).
 */
function launchRestart(delayMs: number, env: Record<string, string>): RestartInfo {
  const supervised = launchSupervisedRestart(delayMs)
  if (supervised !== undefined) return supervised
  const argv = [...process.execArgv, ...process.argv.slice(1)]
  const cwd = process.cwd()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logOut = path.join(os.tmpdir(), `dsh-restart-${stamp}.out.log`)
  const logErr = path.join(os.tmpdir(), `dsh-restart-${stamp}.err.log`)
  const helperPath = path.join(os.tmpdir(), `dsh-restart-helper-${process.pid}-${Date.now()}.cjs`)

  // Written to a temp .cjs rather than passed via `node -e`, because the shared
  // relaunch helper contains quoting that does not survive an inline argument.
  const helperCode = restartHelperScript({
    argv,
    cwd,
    logOut,
    logErr,
    selfPath: helperPath,
    oldPid: process.pid,
    delayMs,
    exitTimeoutMs: OLD_PROCESS_EXIT_TIMEOUT_MS,
  })

  fs.writeFileSync(helperPath, helperCode, 'utf8')
  // The helper hands its own environment to the new DSH (relaunchDirect, and
  // Start-Process through PowerShell on Windows).
  const helper = spawn(process.execPath, [helperPath], {
    detached: true,
    stdio: 'ignore',
    env,
    windowsHide: true,
  })
  const info: RestartInfo = {
    ok: true,
    pid: process.pid,
    cwd,
    commandLine: launchCommandLine(),
    delayMs,
    logOut,
    logErr,
  }
  superviseRestartHelper(helper, {
    delayMs,
    exit: () => exitForRestart(process),
    onError: (error) => {
      restartCoordinator.release(info)
      // The process stays up, so nothing restarted: a leftover marker would
      // prompt these sessions on some unrelated later boot.
      clearResumeMarker()
      try { fs.unlinkSync(helperPath) } catch { /* helper never owned cleanup */ }
      console.error('[dsh-restart] failed to spawn restart helper:', error)
      debugLog(`restart helper spawn failed: ${String(error)}`)
    },
  })
  return info
}

function restart(ctx: Context, delayMs: number): RestartInfo {
  try {
    return restartCoordinator.claim(() => launchRestart(delayMs, relaunchEnvironment(process.env, inheritedEnvironmentOf(ctx)))).value
  } catch (error) {
    clearResumeMarker()
    debugLog(`restart scheduling failed: ${String(error)}`)
    throw error
  }
}

/** Upper bound for a model-supplied delay (setTimeout clamps >2^31-1 to 1ms). */
const MAX_RESTART_DELAY_MS = 60_000

/** Normalize the tool's optional delay: positive integer ms, default 2000. */
function restartDelayMs(value: unknown): number {
  const delayMs = Number(value)
  return delayMs > 0 ? Math.min(Math.floor(delayMs), MAX_RESTART_DELAY_MS) : 2000
}

interface WebRestartRequest {
  socket: { remoteAddress?: string }
  headers: { origin?: string; host?: string; 'accept-language'?: string; 'x-dsh-locale'?: string | string[] }
}

function isLoopbackWebRequest(req: WebRestartRequest): boolean {
  const address = req.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Accept the privileged restart action only from this Web host on loopback. */
function isTrustedWebRestart(req: WebRestartRequest): boolean {
  if (!isLoopbackWebRequest(req)) return false
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

/**
 * Run the legacy PowerShell/WMI restart through the shell service. When the
 * script fails this process keeps running, so its resume marker is dropped.
 */
async function restartLegacy(ctx: Context, delayMs: number, policy: unknown): Promise<unknown> {
  const request: Record<string, unknown> = {
    command: buildLegacyScript(indexFilePath(), delayMs),
    timeoutMs: 30000,
  }
  if (policy !== undefined) request.sandboxPolicy = policy
  let result
  try {
    const spec = ctx.shell.resolve(request as never)
    const execution = await ctx.shell.execute(spec)
    result = await execution.result()
  } catch (error) {
    clearResumeMarker()
    throw error
  }
  const stdout = result.stdout?.text ?? ''
  const stderr = result.stderr?.text ?? ''
  if (result.exitCode !== 0) {
    clearResumeMarker()
    return { ok: false, error: 'legacy restart failed', exitCode: result.exitCode, stdout, stderr }
  }
  try {
    return { ok: true, ...JSON.parse(stdout.trim()) }
  } catch {
    return { ok: false, error: 'failed to parse legacy restart output', stdout, stderr }
  }
}

export function apply(ctx: Context, config: RestartConfig = DEFAULT_CONFIG): void {
  debugLog(`apply: start pid=${process.pid}`)
  try {
    writeProcessIndex()
    debugLog('apply: index written')
  } catch (error) {
    debugLog('apply: writeProcessIndex THREW: ' + String(error))
  }
  disableLegacyWatchdog()
  // DSH 0.2.x validates config against the exported `Config` schema; volatile
  // fields are committed in place, other changes restart this plugin.
  const dynamic = (): RestartConfig => config
  // The DSH Language setting lives in the `locale` settings entry; the
  // settings service exposes every entry's live values through describe().
  let readLocalePreference: ReadLocalePreference = () => undefined
  try {
    ctx.inject(['settings'], (settingsCtx) => {
      readLocalePreference = () => {
        try {
          const rows = settingsCtx.settings.describe() as { ns?: string; value?: { preference?: unknown } }[]
          const preference = rows.find(row => row.ns === 'locale')?.value?.preference
          return typeof preference === 'string' && preference !== '' ? preference : undefined
        } catch {
          return undefined
        }
      }
    })
    debugLog('apply: settings installed')
  } catch (error) {
    debugLog('apply: settings inject THREW: ' + String(error))
  }

  // The session controller (Web/API host) resumes sessions under its own
  // fiber; optional, so other surfaces keep waiting for a client instead.
  let resumeSession: ResumeSession | undefined
  try {
    ctx.inject(['sessionController'] as never, (controllerCtx: Context) => {
      const controller = (controllerCtx as unknown as { sessionController?: { resolveAgent?: (id: never) => Promise<unknown> } }).sessionController
      if (typeof controller?.resolveAgent !== 'function') return
      resumeSession = sessionId => controller.resolveAgent!(sessionId as never)
      controllerCtx.effect(() => () => { resumeSession = undefined }, 'dsh-restart: session resume')
    })
  } catch (error) {
    debugLog('apply: sessionController inject THREW: ' + String(error))
  }

  try {
    tryAutoContinue(ctx, dynamic, readLocalePreference, () => resumeSession)
    debugLog('apply: auto-continue scheduled')
  } catch (error) {
    debugLog('apply: tryAutoContinue THREW: ' + String(error))
  }
  // The restart bundle may mount before the Web host. A one-shot ctx.get()
  // therefore makes the Settings button permanently unavailable on that boot.
  // Inject the optional service so the route follows the Web server lifetime.
  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.webServer as { register: (route: WebRoute) => () => void }
    webCtx.effect(() => webServer.register({
      kind: 'exact',
      path: '/plugins/dsh-restart/restart',
      handler: (req, res) => {
        if (req.method === 'GET') {
          if (!isLoopbackWebRequest(req)) {
            res.writeHead(403)
            res.end('forbidden')
            return
          }
          reportedUiLocale = uiLocaleOf(req.headers) ?? reportedUiLocale
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify({ pid: process.pid, startedAt: PROCESS_STARTED_AT }))
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'GET, POST' })
          res.end('method not allowed')
          return
        }
        if (!isTrustedWebRestart(req)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        reportedUiLocale = uiLocaleOf(req.headers) ?? reportedUiLocale
        const sessionIds = runningSessionIds(ctx)
        if (sessionIds.length > 0) writeResumeMarker(sessionIds)
        let result: RestartInfo
        try {
          result = restart(ctx, 2000)
        } catch (error) {
          res.writeHead(500, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify({ ok: false, error: String(error) }))
          return
        }
        res.writeHead(202, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify({ ...result, sessionIds }))
      },
    }), 'dsh-restart: restart route')
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
      const delayMs = restartDelayMs(a.delayMs)
      // Only resume sessions that were mid-turn (running) at restart time. Idle
      // (already-ended) conversations are left alone — the client re-opens them.
      const sessionIds = runningSessionIds(ctx)
      if (sessionIds.length > 0) writeResumeMarker(sessionIds)
      if (dynamic().legacyRestart.get()) {
        let policy: unknown
        if (exec?.agent?.session) {
          try { policy = ctx.sandboxPolicy.resolve({ session: exec.agent.session }) } catch { policy = undefined }
        }
        const result = await restartLegacy(ctx, delayMs, policy)
        return { ...(result as object), sessionIds }
      }
      return { ...restart(ctx, delayMs), sessionIds }
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
      if (dynamic().legacyRestart.get()) {
        let policy: unknown
        if (invocation?.agent?.session) {
          try { policy = ctx.sandboxPolicy.resolve({ session: invocation.agent.session }) } catch { policy = undefined }
        }
        result = await restartLegacy(ctx, 2000, policy)
      } else {
        try {
          result = restart(ctx, 2000)
        } catch (error) {
          result = { ok: false, error: error instanceof Error ? error.message : String(error) }
        }
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
