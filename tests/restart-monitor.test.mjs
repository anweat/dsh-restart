import assert from 'node:assert/strict'
import test from 'node:test'

import {
  restartAndWait,
} from '../lib/client/restart-monitor.js'

const oldIdentity = { pid: 101, startedAt: '2026-08-25T00:00:00.000Z' }
const newIdentity = { pid: 202, startedAt: '2026-08-25T00:01:00.000Z' }

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('takes the baseline from GET and ignores an identity-less POST response', async () => {
  let getCount = 0
  const fetchImpl = async (_input, init = {}) => {
    if (init.method === 'POST') return jsonResponse({ ok: true, pid: 101, restarting: true }, 202)
    getCount += 1
    return jsonResponse(getCount < 12 ? oldIdentity : newIdentity)
  }

  const result = await restartAndWait({
    fetchImpl,
    sleep: async () => {},
    isVisible: () => true,
  })

  assert.equal(result, 'restarted')
  assert.equal(getCount, 12)
})

test('does not count failed probes during a long restart outage', async () => {
  let getCount = 0
  const fetchImpl = async (_input, init = {}) => {
    if (init.method === 'POST') return jsonResponse({ ok: true }, 202)
    getCount += 1
    if (getCount === 1) return jsonResponse(oldIdentity)
    if (getCount <= 101) throw new TypeError('connection refused')
    return jsonResponse(newIdentity)
  }

  const result = await restartAndWait({
    fetchImpl,
    sleep: async () => {},
    isVisible: () => true,
    maxVisibleStableProbes: 3,
  })

  assert.equal(result, 'restarted')
  assert.equal(getCount, 102)
})

test('does not count unchanged identities while the page is hidden', async () => {
  let getCount = 0
  const fetchImpl = async (_input, init = {}) => {
    if (init.method === 'POST') return jsonResponse({ ok: true }, 202)
    getCount += 1
    return jsonResponse(getCount < 102 ? oldIdentity : newIdentity)
  }

  const result = await restartAndWait({
    fetchImpl,
    sleep: async () => {},
    isVisible: () => getCount > 101,
    maxVisibleStableProbes: 3,
  })

  assert.equal(result, 'restarted')
  assert.equal(getCount, 102)
})

test('reports a stale process after the configured number of visible successful probes', async () => {
  let getCount = 0
  const fetchImpl = async (_input, init = {}) => {
    if (init.method === 'POST') return jsonResponse({ ok: true }, 202)
    getCount += 1
    return jsonResponse(oldIdentity)
  }

  const result = await restartAndWait({
    fetchImpl,
    sleep: async () => {},
    isVisible: () => true,
    maxVisibleStableProbes: 3,
  })

  assert.equal(result, 'stale')
  assert.equal(getCount, 4)
})

test('rejects an invalid baseline identity before sending POST', async () => {
  const methods = []
  const fetchImpl = async (_input, init = {}) => {
    methods.push(init.method)
    return jsonResponse({ pid: 101 })
  }

  await assert.rejects(
    restartAndWait({ fetchImpl, sleep: async () => {}, isVisible: () => true }),
    /invalid restart identity/,
  )
  assert.deepEqual(methods, ['GET'])
})

test('rejects a malformed successful probe instead of treating it as downtime', async () => {
  let getCount = 0
  const fetchImpl = async (_input, init = {}) => {
    if (init.method === 'POST') return jsonResponse({ ok: true }, 202)
    getCount += 1
    if (getCount === 1) return jsonResponse(oldIdentity)
    if (getCount === 2) return jsonResponse({ pid: 101 })
    return jsonResponse(newIdentity)
  }

  await assert.rejects(
    restartAndWait({ fetchImpl, sleep: async () => {}, isVisible: () => true }),
    /invalid restart identity/,
  )
  assert.equal(getCount, 2)
})
