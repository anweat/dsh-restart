/**
 * Emit the JS source used by the detached restart helper.
 *
 * On Windows DSH needs a real-but-hidden console so later sandboxed PowerShell
 * children inherit it instead of flashing a new visible console. The launcher
 * therefore goes through Start-Process, with a Win32-quoted argument line kept
 * inside a base64 JSON payload so spaces, quotes, empty arguments, and Unicode
 * survive the JavaScript -> PowerShell boundary unchanged.
 */
export function relaunchHelperSource() {
    return String.raw `
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
`;
}
