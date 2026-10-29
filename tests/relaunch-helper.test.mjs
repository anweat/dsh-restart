import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import vm from 'node:vm'

import { relaunchHelperSource, restartHelperScript } from '../lib/relaunch-helper.js'

function generatedRelaunch() {
  const context = { Buffer, fs, os, path, process, spawn, spawnSync }
  return vm.runInNewContext(`${relaunchHelperSource()}\nrelaunchDsh`, context)
}

function generatedDirectRelaunch(context) {
  return vm.runInNewContext(`${relaunchHelperSource()}\nrelaunchDirect`, context)
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

test('direct relaunch closes its copies of redirected log descriptors', () => {
  const closed = []
  const fakeFs = {
    openSync(file) { return file === 'stdout.log' ? 31 : 32 },
    closeSync(fd) { closed.push(fd) },
  }
  const child = {
    pid: 1234,
    once() { return this },
    unref() {},
  }
  const relaunchDirect = generatedDirectRelaunch({
    Buffer,
    fs: fakeFs,
    os,
    path,
    process,
    spawn() { return child },
    spawnSync,
  })

  assert.equal(relaunchDirect('node', ['dsh.js'], '.', 'stdout.log', 'stderr.log'), 1234)
  assert.deepEqual(closed, [31, 32])
})

function generatedWhenProcessExits() {
  const context = { Buffer, fs, os, path, process, spawn, spawnSync, setTimeout }
  return vm.runInNewContext(`${relaunchHelperSource()}\nwhenProcessExits`, context)
}

function exited(child) {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once('exit', () => resolve())
  })
}

test('exit wait resolves only after the old process is gone', async () => {
  const old = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 400)'], { stdio: 'ignore' })
  let oldExitedAt
  old.once('exit', () => { oldExitedAt = Date.now() })
  const whenProcessExits = generatedWhenProcessExits()

  const result = await new Promise(resolve => {
    whenProcessExits(old.pid, 10_000, 20, gone => resolve({ gone, at: Date.now() }))
  })

  assert.equal(result.gone, true)
  assert.ok(oldExitedAt !== undefined && result.at >= oldExitedAt, 'reported exit before the process was gone')
})

test('exit wait gives up when the old process outlives the timeout', async () => {
  const old = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' })
  try {
    const whenProcessExits = generatedWhenProcessExits()
    const gone = await new Promise(resolve => { whenProcessExits(old.pid, 200, 20, resolve) })
    assert.equal(gone, false)
  } finally {
    old.kill()
    await exited(old)
  }
})

test('helper script deletes itself and relaunches only after the old process exits', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-helper-'))
  try {
    const startedFile = path.join(root, 'relaunched.json')
    const childScript = path.join(root, 'fake-dsh.cjs')
    const helperPath = path.join(root, 'helper.cjs')
    fs.writeFileSync(childScript, [
      "const fs = require('node:fs')",
      "fs.writeFileSync(process.argv[2], JSON.stringify({ at: Date.now(), cwd: process.cwd(), args: process.argv.slice(3) }))",
    ].join('\n'), 'utf8')

    // The "old DSH" outlives the helper's initial delay, as a slow graceful
    // shutdown does; the relaunch must wait for it instead of racing it.
    const old = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 700)'], { stdio: 'ignore' })
    let oldExitedAt
    old.once('exit', () => { oldExitedAt = Date.now() })

    fs.writeFileSync(helperPath, restartHelperScript({
      argv: [childScript, startedFile, 'web', 'two words'],
      cwd: root,
      logOut: path.join(root, 'out.log'),
      logErr: path.join(root, 'err.log'),
      selfPath: helperPath,
      oldPid: old.pid,
      delayMs: 50,
      exitTimeoutMs: 10_000,
    }), 'utf8')
    const helper = spawn(process.execPath, [helperPath], { stdio: 'ignore' })

    await waitForFile(startedFile)
    const relaunched = JSON.parse(fs.readFileSync(startedFile, 'utf8'))
    assert.ok(oldExitedAt !== undefined && relaunched.at >= oldExitedAt, 'relaunched while the old process was alive')
    assert.equal(fs.realpathSync(relaunched.cwd), fs.realpathSync(root))
    assert.deepEqual(relaunched.args, ['web', 'two words'])
    await exited(helper)
    assert.equal(fs.existsSync(helperPath), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('helper script does not start a second DSH while the old one stays alive', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-helper-'))
  const old = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' })
  try {
    const startedFile = path.join(root, 'relaunched.json')
    const childScript = path.join(root, 'fake-dsh.cjs')
    const helperPath = path.join(root, 'helper.cjs')
    const logErr = path.join(root, 'err.log')
    fs.writeFileSync(childScript, "require('node:fs').writeFileSync(process.argv[2], '{}')", 'utf8')
    fs.writeFileSync(helperPath, restartHelperScript({
      argv: [childScript, startedFile],
      cwd: root,
      logOut: path.join(root, 'out.log'),
      logErr,
      selfPath: helperPath,
      oldPid: old.pid,
      delayMs: 20,
      exitTimeoutMs: 300,
    }), 'utf8')
    const helper = spawn(process.execPath, [helperPath], { stdio: 'ignore' })
    await exited(helper)

    assert.equal(fs.existsSync(startedFile), false)
    assert.match(fs.readFileSync(logErr, 'utf8'), /relaunch skipped: old DSH pid \d+ still alive/)
    assert.equal(fs.existsSync(helperPath), false)
  } finally {
    old.kill()
    await exited(old)
    fs.rmSync(root, { recursive: true, force: true })
  }
})
