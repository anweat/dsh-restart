import assert from 'node:assert/strict'
import test from 'node:test'

import { superviseRestartHelper } from '../lib/restart-helper-lifecycle.js'

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
