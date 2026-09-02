import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import vm from 'node:vm'

import { relaunchHelperSource } from '../lib/relaunch-helper.js'

function generatedRelaunch() {
  const context = { Buffer, fs, os, path, process, spawn, spawnSync }
  return vm.runInNewContext(`${relaunchHelperSource()}\nrelaunchDsh`, context)
}

async function waitForFile(file, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.fail(`timed out waiting for ${file}`)
}

test('Windows hidden-console relaunch preserves exact argv boundaries', {
  skip: process.platform !== 'win32',
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh restart argv '))
  assert.equal(path.dirname(root), os.tmpdir())
  try {
    const childScript = path.join(root, 'capture argv.cjs')
    const resultFile = path.join(root, 'captured argv.json')
    const logOut = path.join(root, 'stdout.log')
    const logErr = path.join(root, 'stderr.log')
    const expected = [
      'plain',
      'two words',
      'quote"inside',
      'trailing\\',
      'slashes-before-quote\\\\"end',
      '',
      "single'quote",
      '中文参数',
    ]
    fs.writeFileSync(childScript, [
      "const fs = require('node:fs')",
      "fs.writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)), 'utf8')",
    ].join('\n'), 'utf8')

    const relaunchDsh = generatedRelaunch()
    const mode = relaunchDsh(
      process.execPath,
      [childScript, resultFile, ...expected],
      root,
      logOut,
      logErr,
    )

    assert.equal(mode, 'hidden-console')
    await waitForFile(resultFile)
    assert.deepEqual(JSON.parse(fs.readFileSync(resultFile, 'utf8')), expected)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
