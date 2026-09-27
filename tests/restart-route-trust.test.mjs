import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

const CONFIG = {
  legacyRestart: false,
  continuePrompt: 'continue',
  watchdogEnabled: false,
  watchdogCooldownMs: 60_000,
  watchdogPollMs: 1_000,
}

/**
 * Boot the Host half against a fake ctx and hand back the registered route.
 * 'connection' is only injected when a caller supplies one, mimicking a host
 * that has no Connection service at all.
 */
function boot(connection) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-trust-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = root
  let route
  const effect = (register) => {
    const cleanup = register()
    return typeof cleanup === 'function' ? cleanup : undefined
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
              options.setSource(() => CONFIG)
            },
          },
        })
      }
      if (dependencies.includes('connection') && connection !== undefined) {
        callback({ connection, effect })
      }
      if (dependencies.includes('webServer')) {
        callback({
          effect,
          webServer: { register(value) { route = value; return () => {} } },
        })
      }
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  apply(ctx)
  return {
    route,
    restore() {
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

function request(method, remoteAddress, headers) {
  return { method, socket: { remoteAddress: remoteAddress }, headers: headers }
}

function response() {
  return {
    status: 0,
    headers: undefined,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(body) { this.body = body === undefined ? '' : body; return this },
  }
}

test('the restart route delegates its fence to Connection when one is present', () => {
  const seen = []
  const booted = boot({
    requestRejection(req) {
      seen.push(req.headers)
      return undefined
    },
  })
  try {
    assert.equal(booted.route?.path, '/plugins/dsh-restart/restart')
    const res = response()
    // A non-loopback address proves the fence, not the historical loopback
    // rule, is what admitted this request (that is the reverse-proxy case).
    booted.route.handler(request('GET', '203.0.113.9', { host: 'dsh.example.com' }), res)
    assert.equal(res.status, 200)
    const identity = JSON.parse(res.body)
    assert.equal(identity.pid, process.pid)
    assert.equal(typeof identity.startedAt, 'string')
    assert.notEqual(identity.startedAt, '')
    assert.equal(seen.length, 1)
    // The fence receives the request's own headers, which is what lets it
    // apply the same Host/Origin and browser-auth checks as the api channel.
    assert.equal(seen[0].host, 'dsh.example.com')
  } finally {
    booted.restore()
  }
})

test('the restart route reports the fence rejection verbatim', () => {
  let rejection = 401
  const booted = boot({ requestRejection() { return rejection } })
  try {
    const unauthorized = response()
    booted.route.handler(request('GET', '127.0.0.1', { host: '127.0.0.1:3080' }), unauthorized)
    assert.equal(unauthorized.status, 401)
    assert.equal(unauthorized.body, 'unauthorized')

    rejection = 403
    const forbidden = response()
    booted.route.handler(request('POST', '127.0.0.1', { host: '127.0.0.1:3080' }), forbidden)
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body, 'forbidden')

    // A refused POST must not reach the restart path: 202 is that path's answer.
    assert.notEqual(forbidden.status, 202)
  } finally {
    booted.restore()
  }
})

test('without a Connection service the historical loopback rule still decides', () => {
  const booted = boot(undefined)
  try {
    const remote = response()
    booted.route.handler(request('GET', '203.0.113.9', { host: '127.0.0.1:3080' }), remote)
    assert.equal(remote.status, 403)
    assert.equal(remote.body, 'forbidden')

    const local = response()
    booted.route.handler(request('GET', '127.0.0.1', { host: '127.0.0.1:3080' }), local)
    assert.equal(local.status, 200)

    // POST additionally keeps the Origin-equals-Host requirement of that rule.
    const mismatched = response()
    booted.route.handler(request('POST', '127.0.0.1', { host: '127.0.0.1:3080', origin: 'http://evil.example' }), mismatched)
    assert.equal(mismatched.status, 403)
  } finally {
    booted.restore()
  }
})
