/**
 * Emit the JS source used by the detached restart helper.
 *
 * On Windows DSH needs a real-but-hidden console so later sandboxed PowerShell
 * children inherit it instead of flashing a new visible console. The launcher
 * therefore goes through Start-Process, with a Win32-quoted argument line kept
 * inside a base64 JSON payload so spaces, quotes, empty arguments, and Unicode
 * survive the JavaScript -> PowerShell boundary unchanged.
 *
 * The relaunch is gated on the old DSH process actually having exited
 * (`whenProcessExits`): a fixed sleep raced a slow graceful shutdown and could
 * start a second DSH while the first still held the listen port.
 */
export function relaunchHelperSource(): string {
  return String.raw`
function relaunchDirect(execPath, argv, cwd, logOut, logErr) {
  const out = fs.openSync(logOut, 'a')
  const err = fs.openSync(logErr, 'a')
  try {
    const child = spawn(execPath, argv, {
      cwd: cwd,
      detached: true,
      stdio: ['ignore', out, err],
      env: process.env,
      windowsHide: true,
    })
    child.once('error', function () {})
    child.unref()
    return child.pid
  } finally {
    try { fs.closeSync(out) } catch {}
    try { fs.closeSync(err) } catch {}
  }
}

function quoteWindowsArg(value) {
  const arg = String(value)
  if (arg !== '' && !/[\s"]/u.test(arg)) return arg
  let quoted = '"'
  let backslashes = 0
  for (const char of arg) {
    if (char === '\\') {
      backslashes += 1
      continue
    }
    if (char === '"') {
      quoted += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
      continue
    }
    quoted += '\\'.repeat(backslashes) + char
    backslashes = 0
  }
  return quoted + '\\'.repeat(backslashes * 2) + '"'
}

function relaunchHiddenConsole(execPath, argv, cwd, logOut, logErr) {
  const payload = Buffer.from(JSON.stringify({
    filePath: execPath,
    argumentLine: argv.map(quoteWindowsArg).join(' '),
    workingDirectory: cwd,
    logOut: logOut,
    logErr: logErr,
  }), 'utf8').toString('base64')
  const script = "$ErrorActionPreference = 'Stop'\r\n"
    + "$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + payload + "')) | ConvertFrom-Json\r\n"
    + "$params = @{\r\n"
    + "  FilePath = [string]$payload.filePath\r\n"
    + "  WorkingDirectory = [string]$payload.workingDirectory\r\n"
    + "  WindowStyle = 'Hidden'\r\n"
    + "  RedirectStandardOutput = [string]$payload.logOut\r\n"
    + "  RedirectStandardError = [string]$payload.logErr\r\n"
    + "}\r\n"
    + "if ([string]$payload.argumentLine -ne '') { $params.ArgumentList = [string]$payload.argumentLine }\r\n"
    + "Start-Process @params\r\n"
  const psPath = path.join(os.tmpdir(), 'dsh-relaunch-' + process.pid + '-' + Date.now() + '.ps1')
  fs.writeFileSync(psPath, '\ufeff' + script, 'utf8')
  try {
    const psExe = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe',
    )
    const r = spawnSync(psExe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return r.status === 0
  } finally {
    try { fs.unlinkSync(psPath) } catch {}
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return !!(e && e.code === 'EPERM')
  }
}

function whenProcessExits(pid, timeoutMs, pollMs, callback) {
  const deadline = Date.now() + timeoutMs
  const poll = function () {
    if (!processAlive(pid)) return callback(true)
    if (Date.now() >= deadline) return callback(false)
    setTimeout(poll, pollMs)
  }
  poll()
}

function relaunchDsh(execPath, argv, cwd, logOut, logErr) {
  if (process.platform === 'win32') {
    let ok = false
    try { ok = relaunchHiddenConsole(execPath, argv, cwd, logOut, logErr) } catch { ok = false }
    if (ok) return 'hidden-console'
    relaunchDirect(execPath, argv, cwd, logOut, logErr)
    return 'direct-fallback'
  }
  relaunchDirect(execPath, argv, cwd, logOut, logErr)
  return 'direct'
}
`
}

export interface RestartHelperScriptOptions {
  /** Node argv of the DSH process to relaunch (execArgv + script + args). */
  argv: readonly string[]
  cwd: string
  logOut: string
  logErr: string
  /** Where the script itself is written; it deletes this file once loaded. */
  selfPath: string
  /** The DSH process that must be gone before the relaunch. */
  oldPid: number
  /** When the old process is scheduled to leave. */
  delayMs: number
  /** How long past `delayMs` to wait for it before giving up without a relaunch. */
  exitTimeoutMs: number
}

/**
 * The complete detached helper script (CommonJS). It deletes its own file as
 * soon as it is loaded: a supervisor that kills the helper together with the
 * old process (systemd KillMode=control-group) would otherwise leave one stale
 * file per restart. It then waits for the old process to exit, and relaunches
 * DSH with the same argv + cwd, output appended to the log files. If the old
 * process outlives the timeout no second DSH is started.
 */
export function restartHelperScript(options: RestartHelperScriptOptions): string {
  return [
    "const { spawn, spawnSync } = require('node:child_process')",
    "const fs = require('node:fs')",
    "const os = require('node:os')",
    "const path = require('node:path')",
    relaunchHelperSource(),
    `const argv = ${JSON.stringify(options.argv)}`,
    `const cwd = ${JSON.stringify(options.cwd)}`,
    `const logOut = ${JSON.stringify(options.logOut)}`,
    `const logErr = ${JSON.stringify(options.logErr)}`,
    `const selfPath = ${JSON.stringify(options.selfPath)}`,
    `const oldPid = ${JSON.stringify(options.oldPid)}`,
    `const delay = ${JSON.stringify(options.delayMs)}`,
    `const exitTimeout = ${JSON.stringify(options.exitTimeoutMs)}`,
    'try { fs.unlinkSync(selfPath) } catch {}',
    "const logFailure = (message) => { try { fs.appendFileSync(logErr, new Date().toISOString() + ' ' + message + '\\n', 'utf8') } catch {} }",
    'setTimeout(() => {',
    '  whenProcessExits(oldPid, exitTimeout, 100, (exited) => {',
    '    try {',
    '      if (exited) relaunchDsh(process.execPath, argv, cwd, logOut, logErr)',
    "      else logFailure('relaunch skipped: old DSH pid ' + oldPid + ' still alive ' + exitTimeout + 'ms after its scheduled exit')",
    '    } catch (e) {',
    "      logFailure('relaunch failed: ' + String(e && e.stack || e))",
    '    } finally {',
    '      process.exit(0)',
    '    }',
    '  })',
    '}, delay)',
  ].join('\n')
}
