import assert from 'node:assert/strict'
import test from 'node:test'

import { exitForRestart, superviseRestartHelper } from '../lib/restart-helper-lifecycle.js'

function fakeHelper() {
  const listeners = new Map()
  return {
    once(event, listener) { listeners.set(event, listener); return this },
    unref() {},
    emit(event, value) { listeners.get(event)?.(value) },
  }
}

test('old process exit is armed only after the detached helper spawns', () => {
  const helper = fakeHelper()
  const timers = []
  let exits = 0
  let failures = 0

  superviseRestartHelper(helper, {
    delayMs: 2_000,
    exit: () => { exits += 1 },
    onError: () => { failures += 1 },
    schedule: (callback, delayMs) => { timers.push({ callback, delayMs }) },
  })

  assert.equal(timers.length, 0)
  helper.emit('spawn')
  assert.equal(timers.length, 1)
  assert.equal(timers[0].delayMs, 2_000)
  assert.equal(exits, 0)
  timers[0].callback()
  assert.equal(exits, 1)
  assert.equal(failures, 0)
})

test('helper spawn failure is reported without arming old process exit', () => {
  const helper = fakeHelper()
  const timers = []
  const failure = new Error('spawn failed')
  let reported

  superviseRestartHelper(helper, {
    delayMs: 2_000,
    exit: () => assert.fail('old process must remain alive'),
    onError: error => { reported = error },
    schedule: (callback, delayMs) => { timers.push({ callback, delayMs }) },
  })

  helper.emit('error', failure)
  assert.equal(reported, failure)
  assert.equal(timers.length, 0)
})

function fakeProcess({ platform = 'linux', sigtermListeners = 1 } = {}) {
  const calls = []
  return {
    calls,
    pid: 4242,
    platform,
    listenerCount(event) { return event === 'SIGTERM' ? sigtermListeners : 0 },
    kill(pid, signal) { calls.push(['kill', pid, signal]) },
    exit(code) { calls.push(['exit', code]) },
  }
}

test('restart exit goes through the host graceful SIGTERM shutdown on POSIX', () => {
  const proc = fakeProcess()
  exitForRestart(proc)
  assert.deepEqual(proc.calls, [['kill', 4242, 'SIGTERM']])
})

test('restart exit falls back to process.exit without a SIGTERM handler or on Windows', () => {
  const bare = fakeProcess({ sigtermListeners: 0 })
  exitForRestart(bare)
  assert.deepEqual(bare.calls, [['exit', 0]])

  const windows = fakeProcess({ platform: 'win32' })
  exitForRestart(windows)
  assert.deepEqual(windows.calls, [['exit', 0]])
})

test('a real process with a SIGTERM shutdown handler runs it on restart exit', {
  skip: process.platform === 'win32',
}, async () => {
  const { spawn } = await import('node:child_process')
  const lifecycle = new URL('../lib/restart-helper-lifecycle.js', import.meta.url).href
  const child = spawn(process.execPath, ['--input-type=module', '-e', [
    `import { exitForRestart } from ${JSON.stringify(lifecycle)}`,
    // Stands in for DSH's bounded shutdown: dispose, then exit with code 0.
    "const alive = setTimeout(() => process.exit(9), 5000)",
    "process.on('SIGTERM', () => { clearTimeout(alive); process.stdout.write('disposed', () => process.exit(0)) })",
    'exitForRestart(process)',
  ].join('\n')], { stdio: ['ignore', 'pipe', 'inherit'] })
  let stdout = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  const code = await new Promise(resolve => child.once('close', resolve))
  assert.equal(code, 0)
  assert.equal(stdout, 'disposed')
})
