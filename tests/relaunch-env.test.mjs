import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { inheritedEnvironmentOf, relaunchEnvironment } from '../lib/relaunch-env.js'
import { restartHelperScript } from '../lib/relaunch-helper.js'

/** A launcher-shaped snapshot over the environment DSH inherited at launch. */
function snapshot(inherited) {
  return {
    getFrom(name, sources) {
      return sources.includes('process') && Object.hasOwn(inherited, name) ? { value: inherited[name] } : undefined
    },
  }
}

test('the relaunch drops .env values and restores what the process inherited', () => {
  const inherited = { PATH: '/usr/bin', HTTP_PROXY: 'http://user-proxy:1', HOME: '/home/u', https_proxy: 'http://keep:2' }
  const current = {
    PATH: '/usr/bin',
    HOME: '/home/u',
    EXA_API_KEY: 'from-dotenv', // materialized from a .env file
    HTTP_PROXY: 'http://settings-proxy:9', // published over the inherited value
    NO_PROXY: 'localhost', // published, never inherited
    // https_proxy was deleted by the proxy policy
  }
  assert.deepEqual(relaunchEnvironment(current, snapshot(inherited)), inherited)
})

test('without a launcher snapshot the current environment is kept', () => {
  assert.deepEqual(relaunchEnvironment({ A: '1', B: undefined }, undefined), { A: '1' })
})

test('the snapshot is read from the plugin context when the launcher provided one', () => {
  const s = snapshot({})
  assert.equal(inheritedEnvironmentOf({ get: name => name === 'launchEnvironment' ? s : undefined }), s)
  assert.equal(inheritedEnvironmentOf({ get: () => undefined }), undefined)
  assert.equal(inheritedEnvironmentOf({}), undefined)
  assert.equal(inheritedEnvironmentOf({ get: () => { throw new Error('no service') } }), undefined)
})

test('a relaunched process sees the inherited environment, not the .env additions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-env-'))
  try {
    const result = path.join(root, 'env.json')
    const childScript = path.join(root, 'fake-dsh.cjs')
    const helperPath = path.join(root, 'helper.cjs')
    fs.writeFileSync(childScript, [
      "const fs = require('node:fs')",
      "fs.writeFileSync(process.argv[2], JSON.stringify({ dotenv: process.env.DSH_TEST_DOTENV ?? null, proxy: process.env.HTTP_PROXY ?? null, path: process.env.PATH ?? null }))",
    ].join('\n'), 'utf8')
    const inherited = { PATH: process.env.PATH ?? '', HTTP_PROXY: 'http://user-proxy:1' }
    const env = relaunchEnvironment(
      { ...inherited, DSH_TEST_DOTENV: 'secret', HTTP_PROXY: 'http://published:9' },
      snapshot(inherited),
    )
    fs.writeFileSync(helperPath, restartHelperScript({
      argv: [childScript, result],
      cwd: root,
      logOut: path.join(root, 'out.log'),
      logErr: path.join(root, 'err.log'),
      selfPath: helperPath,
      oldPid: 2 ** 22 + 12345, // no such process: relaunch right away
      delayMs: 0,
      exitTimeoutMs: 1_000,
    }), 'utf8')
    const helper = spawn(process.execPath, [helperPath], { stdio: 'ignore', env })
    await new Promise(resolve => helper.once('exit', resolve))
    const deadline = Date.now() + 10_000
    while (!fs.existsSync(result) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(JSON.parse(fs.readFileSync(result, 'utf8')), {
      dotenv: null,
      proxy: 'http://user-proxy:1',
      path: inherited.PATH,
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
