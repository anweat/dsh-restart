import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

const wait = delayMs => new Promise(resolve => setTimeout(resolve, delayMs))

test('auto-continue keeps the recovery marker when followup throws', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-continue-'))
  const marker = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  const originalConsoleError = console.error

  process.env.DSH_HOME = root
  fs.writeFileSync(marker, JSON.stringify({ sessionIds: ['session-1'] }), 'utf8')
  console.error = () => {}

  const config = {
    legacyRestart: false,
    continuePrompt: 'continue',
    watchdogEnabled: false,
    watchdogCooldownMs: 60_000,
    watchdogPollMs: 1_000,
  }
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
      callback({
        settings: {
          installSection(_ctx, _name, _schema, _defaults, options) {
            options.setSource(() => config)
          },
        },
      })
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx)
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
