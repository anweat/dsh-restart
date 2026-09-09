import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

test('published host and client bundles do not ship the detached watchdog', () => {
  const host = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  const client = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.doesNotMatch(host, /dsh-watchdog\.cjs|port .* down, relaunching/)
  assert.doesNotMatch(client, /watchdogEnabledHint|watchdogCooldownMs|watchdogPollMs/)
})

test('host startup leaves a stop marker for watchdogs detached by older releases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-disable-watchdog-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = root
  const ctx = {
    agents: { get() { return undefined }, roots() { return [] } },
    commands: { register() {} },
    effect(register) { register() },
    inject() {},
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx)
    assert.equal(fs.existsSync(path.join(root, 'dsh-stop.flag')), true)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
})
