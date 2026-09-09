import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

test('restart route is disposed with the injected Web server lifetime', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-route-'))
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  let route
  let disposed = false

  process.env.DSH_HOME = root
  const config = {
    legacyRestart: false,
    continuePrompt: 'continue',
    watchdogEnabled: false,
    watchdogCooldownMs: 60_000,
    watchdogPollMs: 1_000,
  }
  const effect = (register) => {
    const cleanup = register()
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  }
  const ctx = {
    agents: { get() { return undefined }, roots() { return [] } },
    commands: { register() {} },
    effect,
    inject(dependencies, callback) {
      if (dependencies.includes('settings')) {
        callback({
          settings: {
            installSection(_ctx, _name, _schema, _defaults, options) {
              options.setSource(() => config)
            },
          },
        })
      }
      if (dependencies.includes('webServer')) {
        callback({
          effect,
          webServer: {
            register(value) {
              route = value
              return () => { disposed = true }
            },
          },
        })
      }
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx)
    assert.equal(route?.path, '/plugins/dsh-restart/restart')
    for (const cleanup of cleanups) cleanup()
    assert.equal(disposed, true)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
})
