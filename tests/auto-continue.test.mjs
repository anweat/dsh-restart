import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

const wait = delayMs => new Promise(resolve => setTimeout(resolve, delayMs))

// DSH 0.2.x hands volatile fields to apply() as live references ({ get }).
const ref = value => ({ get: () => value })

const BASE_CONFIG = {
  legacyRestart: ref(false),
  continuePrompt: ref(''),
  watchdogEnabled: false,
  watchdogCooldownMs: 60_000,
  watchdogPollMs: 1_000,
}

/**
 * One auto-continue run: apply() against a minimal 0.2.x-shaped host until the
 * recorded session is followed up, and return the injected message text.
 */
async function continueMessage({ config = {}, localePreference } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-continue-'))
  const marker = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  const originalConsoleError = console.error
  let injected

  process.env.DSH_HOME = root
  fs.writeFileSync(marker, JSON.stringify({ sessionIds: ['session-1'] }), 'utf8')
  console.error = () => {}

  const ctx = {
    agents: {
      get(sessionId) {
        if (sessionId !== 'session-1') return undefined
        return {
          followup(message) {
            injected = message.content.find(block => block.type === 'text')?.text
          },
        }
      },
    },
    commands: { register() {} },
    effect(register) {
      const cleanup = register()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(dependencies, callback) {
      if (!dependencies.includes('settings')) return
      callback({
        settings: {
          describe() {
            return localePreference === undefined
              ? []
              : [{ ns: 'locale', value: { preference: localePreference } }]
          },
        },
      })
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx, { ...BASE_CONFIG, ...config })
    const deadline = Date.now() + 5_000
    while (injected === undefined && Date.now() < deadline) await wait(50)
    assert.notEqual(injected, undefined, 'auto-continue follow-up never arrived')
    return injected
  } finally {
    for (const cleanup of cleanups) cleanup()
    console.error = originalConsoleError
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
}

test('auto-continue writes the default prompt in the DSH Language setting', async () => {
  assert.equal(
    await continueMessage({ localePreference: 'en' }),
    '(The system restart is complete.) Please continue the unfinished work.',
  )
  assert.equal(
    await continueMessage({ localePreference: 'zh' }),
    '（系统已重启完成）请继续之前未完成的工作。',
  )
  assert.equal(
    await continueMessage({ localePreference: 'zh-CN' }),
    '（系统已重启完成）请继续之前未完成的工作。',
  )
})

test('auto-continue falls back to English when no language preference is set', async () => {
  assert.equal(
    await continueMessage({}),
    '(The system restart is complete.) Please continue the unfinished work.',
  )
})

test('auto-continue prefers a configured continue prompt over the language default', async () => {
  assert.equal(
    await continueMessage({ localePreference: 'zh', config: { continuePrompt: ref('继续修 bug') } }),
    '继续修 bug',
  )
})

test('auto-continue keeps the recovery marker when followup throws', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-continue-'))
  const marker = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  const originalConsoleError = console.error

  process.env.DSH_HOME = root
  fs.writeFileSync(marker, JSON.stringify({ sessionIds: ['session-1'] }), 'utf8')
  console.error = () => {}

  const ctx = {
    agents: {
      get(sessionId) {
        if (sessionId !== 'session-1') return undefined
        return { followup() { throw new Error('queue unavailable') } }
      },
    },
    commands: { register() {} },
    effect(register) {
      const cleanup = register()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(dependencies, callback) {
      if (!dependencies.includes('settings')) return
      callback({ settings: { describe() { return [] } } })
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx, { ...BASE_CONFIG })
    await wait(650)
    assert.equal(fs.existsSync(marker), true)
  } finally {
    for (const cleanup of cleanups) cleanup()
    console.error = originalConsoleError
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
})

/** A DSH_HOME sandbox plus a minimal 0.2.x-shaped host over a mutable agent table. */
function sandbox(marker, { controller, localePreference } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-continue-'))
  const markerPath = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const originalConsoleError = console.error
  const cleanups = []
  const agents = new Map()
  const followups = []
  const commands = []
  const routes = []
  process.env.DSH_HOME = root
  console.error = () => {}
  if (marker !== undefined) fs.writeFileSync(markerPath, JSON.stringify(marker), 'utf8')

  const agent = (id, status = 'idle') => ({
    id,
    status,
    followup(message) { followups.push({ id, text: message.content[0]?.text }) },
  })
  const effect = (register) => {
    const cleanup = register()
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  }
  const ctx = {
    agents: {
      get: id => agents.get(id),
      roots: () => [...agents.values()],
    },
    commands: { register(command) { commands.push(command) } },
    effect,
    inject(dependencies, callback) {
      if (dependencies.includes('settings')) {
        callback({
          settings: {
            describe: () => localePreference === undefined ? [] : [{ ns: 'locale', value: { preference: localePreference } }],
          },
        })
      }
      if (dependencies.includes('sessionController') && controller !== undefined) {
        callback({ effect, sessionController: controller })
      }
      if (dependencies.includes('webServer')) {
        callback({ effect, webServer: { register(route) { routes.push(route); return () => {} } } })
      }
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }
  return {
    agents,
    agent,
    commands,
    routes,
    ctx,
    followups,
    markerPath,
    readMarker: () => fs.existsSync(markerPath) ? JSON.parse(fs.readFileSync(markerPath, 'utf8')) : undefined,
    unload() {
      while (cleanups.length > 0) cleanups.pop()()
    },
    dispose() {
      this.unload()
      console.error = originalConsoleError
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

const OTHER_PID = process.pid + 1

test('auto-continue ignores a marker written by this same process', async () => {
  const box = sandbox()
  try {
    // The restart command writes the marker in this process; the failing
    // legacy shell keeps the process from going anywhere.
    box.agents.set('session-1', box.agent('session-1', 'running'))
    let releaseShell
    box.ctx.shell = {
      resolve: request => request,
      execute: () => new Promise(resolve => { releaseShell = resolve }),
    }
    apply(box.ctx, { ...BASE_CONFIG, legacyRestart: ref(true) })
    const pendingRestart = box.commands.find(command => command.name === 'restart').handler({})
    const written = box.readMarker()
    assert.equal(written.pid, process.pid)
    assert.equal(typeof written.startedAt, 'string')

    // A hot reload re-applies the plugin while that restart is still pending.
    box.unload()
    box.agents.set('session-1', box.agent('session-1'))
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.deepEqual(box.followups, [])
    assert.deepEqual(box.readMarker()?.sessionIds, ['session-1'])
    // Settle it inside the sandbox so its cleanup never touches the real DSH_HOME.
    releaseShell({ result: async () => ({ exitCode: 1 }) })
    assert.equal((await pendingRestart).kind, 'error')
  } finally {
    box.dispose()
  }
})

test('auto-continue still consumes a marker from an earlier process that had the same PID', async () => {
  const box = sandbox({ sessionIds: ['session-1'], pid: process.pid, startedAt: '2000-01-01T00:00:00.000Z' })
  try {
    box.agents.set('session-1', box.agent('session-1'))
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.deepEqual(box.followups.map(f => f.id), ['session-1'])
  } finally {
    box.dispose()
  }
})

test('auto-continue shrinks the marker so a plugin reload never continues a session twice', async () => {
  const box = sandbox({ sessionIds: ['session-1', 'session-2'], pid: OTHER_PID, restartAt: '2026-10-29T00:00:00.000Z' })
  try {
    box.agents.set('session-1', box.agent('session-1'))
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.deepEqual(box.followups.map(f => f.id), ['session-1'])
    assert.deepEqual(box.readMarker(), { sessionIds: ['session-2'], pid: OTHER_PID, restartAt: '2026-10-29T00:00:00.000Z' })

    // Hot reload: the plugin is applied again before session-2 resumed.
    box.unload()
    box.agents.set('session-2', box.agent('session-2'))
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.deepEqual(box.followups.map(f => f.id), ['session-1', 'session-2'])
    assert.equal(box.readMarker(), undefined)
  } finally {
    box.dispose()
  }
})

test('auto-continue does not queue a second turn on a session that is already running', async () => {
  const box = sandbox({ sessionIds: ['session-1'], pid: OTHER_PID })
  try {
    box.agents.set('session-1', box.agent('session-1', 'running'))
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.deepEqual(box.followups, [])
    assert.equal(box.readMarker(), undefined)
  } finally {
    box.dispose()
  }
})

test('a failed legacy restart drops the resume marker it wrote', async () => {
  const box = sandbox()
  try {
    box.agents.set('session-1', box.agent('session-1', 'running'))
    box.ctx.shell = {
      resolve: request => request,
      execute: async () => ({ result: async () => ({ exitCode: 1, stdout: { text: '' }, stderr: { text: 'pwsh missing' } }) }),
    }
    apply(box.ctx, { ...BASE_CONFIG, legacyRestart: ref(true) })
    const restartCommand = box.commands.find(command => command.name === 'restart')
    const result = await restartCommand.handler({})
    assert.equal(result.kind, 'error')
    assert.equal(fs.existsSync(box.markerPath), false)
  } finally {
    box.dispose()
  }
})

test('a session no browser re-opens is resumed through the session controller', async () => {
  const resolved = []
  let box
  const controller = {
    async resolveAgent(id) {
      resolved.push(id)
      if (id === 'session-gone') return { error: { code: 'session/not-found', message: 'not found' } }
      box.agents.set(id, box.agent(id))
      return { agent: box.agents.get(id) }
    },
  }
  box = sandbox({ sessionIds: ['session-1', 'session-gone'], pid: OTHER_PID }, { controller })
  try {
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(1_200)
    assert.deepEqual(box.followups.map(f => f.id), ['session-1'])
    // Each session is resumed once; one that cannot be resumed is dropped early, not after 60s.
    assert.deepEqual(resolved.sort(), ['session-1', 'session-gone'])
    assert.equal(box.readMarker(), undefined)
  } finally {
    box.dispose()
  }
})

test('a session the client already re-opened is not resumed again', async () => {
  const resolved = []
  const box = sandbox({ sessionIds: ['session-1'], pid: OTHER_PID }, {
    controller: { async resolveAgent(id) { resolved.push(id); return { error: { message: 'unexpected' } } } },
  })
  try {
    box.agents.set('session-1', box.agent('session-1'))
    apply(box.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.deepEqual(resolved, [])
    assert.deepEqual(box.followups.map(f => f.id), ['session-1'])
  } finally {
    box.dispose()
  }
})

function webRequest(method, headers = {}) {
  return {
    method,
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', ...headers },
  }
}

function webResponse() {
  return { status: undefined, body: '', writeHead(status) { this.status = status }, end(body = '') { this.body = body } }
}

test('the UI locale a browser reports is recorded with the restart and words the continue prompt', async () => {
  const box = sandbox()
  try {
    box.agents.set('session-1', box.agent('session-1', 'running'))
    let releaseShell
    box.ctx.shell = { resolve: request => request, execute: () => new Promise(resolve => { releaseShell = resolve }) }
    apply(box.ctx, { ...BASE_CONFIG, legacyRestart: ref(true) })
    const route = box.routes.find(r => r.path === '/plugins/dsh-restart/restart')
    route.handler(webRequest('GET', { 'x-dsh-locale': 'zh' }), webResponse())
    const pendingRestart = box.commands.find(command => command.name === 'restart').handler({})
    const marker = box.readMarker()
    assert.equal(marker.uiLocale, 'zh')
    releaseShell({ result: async () => ({ exitCode: 1 }) })
    await pendingRestart
  } finally {
    box.dispose()
  }

  const restarted = sandbox({ sessionIds: ['session-1'], pid: OTHER_PID, uiLocale: 'zh' })
  try {
    restarted.agents.set('session-1', restarted.agent('session-1'))
    apply(restarted.ctx, { ...BASE_CONFIG })
    // The new process may hear another locale first; the one shown at restart time wins.
    restarted.routes[0].handler(webRequest('GET', { 'x-dsh-locale': 'en' }), webResponse())
    await wait(700)
    assert.equal(restarted.followups[0]?.text, '（系统已重启完成）请继续之前未完成的工作。')
  } finally {
    restarted.dispose()
  }

  // An explicit Language setting still wins over the browser's locale.
  const explicit = sandbox({ sessionIds: ['session-1'], pid: OTHER_PID, uiLocale: 'zh' }, { localePreference: 'en' })
  try {
    explicit.agents.set('session-1', explicit.agent('session-1'))
    apply(explicit.ctx, { ...BASE_CONFIG })
    await wait(700)
    assert.equal(explicit.followups[0]?.text, '(The system restart is complete.) Please continue the unfinished work.')
  } finally {
    explicit.dispose()
  }
})

test('without a locale hint the request Accept-Language picks the first built-in language', async () => {
  const box = sandbox()
  try {
    box.agents.set('session-1', box.agent('session-1', 'running'))
    let releaseShell
    box.ctx.shell = { resolve: request => request, execute: () => new Promise(resolve => { releaseShell = resolve }) }
    apply(box.ctx, { ...BASE_CONFIG, legacyRestart: ref(true) })
    const route = box.routes.find(r => r.path === '/plugins/dsh-restart/restart')
    route.handler(webRequest('GET', { 'x-dsh-locale': 'en' }), webResponse())
    route.handler(webRequest('GET', { 'accept-language': 'de-DE,de;q=0.9,zh-CN;q=0.8,en;q=0.7' }), webResponse())
    const pendingRestart = box.commands.find(command => command.name === 'restart').handler({})
    assert.equal(box.readMarker().uiLocale, 'zh-CN')
    releaseShell({ result: async () => ({ exitCode: 1 }) })
    await pendingRestart
  } finally {
    box.dispose()
  }
})
