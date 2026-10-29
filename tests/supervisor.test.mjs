import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detectSystemdService,
  journalCommand,
  parseSystemctlShow,
  serviceFromCgroup,
  supervisedRestart,
} from '../lib/supervisor.js'

const LIVE_CGROUP = '0::/user.slice/user-1000.slice/user@1000.service/app.slice/dsh-web.service\n'

function probe(overrides = {}) {
  const calls = []
  return {
    calls,
    platform: 'linux',
    pid: 219732,
    env: { INVOCATION_ID: 'abc' },
    readCgroup: () => LIVE_CGROUP,
    systemctl(args) {
      calls.push(args)
      return { status: 0, stdout: 'MainPID=219732\nRestart=always\nKillMode=control-group\n' }
    },
    ...overrides,
  }
}

test('the owning service is read from the cgroup path', () => {
  assert.deepEqual(serviceFromCgroup(LIVE_CGROUP), { unit: 'dsh-web.service', user: true })
  assert.deepEqual(serviceFromCgroup('0::/system.slice/dsh.service\n'), { unit: 'dsh.service', user: false })
  assert.deepEqual(
    serviceFromCgroup('12:pids:/x\n1:name=systemd:/system.slice/dsh.service\n'),
    { unit: 'dsh.service', user: false },
  )
  // A terminal, a tmux scope or the user manager itself is not a DSH service.
  assert.equal(serviceFromCgroup('0::/user.slice/user-1000.slice/user@1000.service/tmux-spawn-1.scope\n'), undefined)
  assert.equal(serviceFromCgroup('0::/user.slice/user-1000.slice/user@1000.service/init.scope\n'), undefined)
  assert.equal(serviceFromCgroup('0::/user.slice/user-1000.slice/user@1000.service\n'), undefined)
})

test('systemctl show output is parsed into properties', () => {
  assert.deepEqual(parseSystemctlShow('MainPID=42\nRestart=on-failure\n\n'), { MainPID: '42', Restart: 'on-failure' })
})

test('the live dsh-web.service setup is detected as an auto-restarting user unit', () => {
  const p = probe()
  const service = detectSystemdService(p)
  assert.deepEqual(service, { unit: 'dsh-web.service', user: true, restart: 'always', killMode: 'control-group' })
  assert.deepEqual(p.calls, [['--user', 'show', 'dsh-web.service', '-p', 'MainPID', '-p', 'Restart', '-p', 'KillMode']])
  assert.deepEqual(supervisedRestart(service, false), { kind: 'exit' })
  assert.equal(journalCommand(service), 'journalctl --user -u dsh-web.service')
})

test('detection needs systemd markers, Linux, and this process as the unit main PID', () => {
  const noMarkers = probe({ env: {} })
  assert.equal(detectSystemdService(noMarkers), undefined)
  assert.deepEqual(noMarkers.calls, [], 'systemctl must not run without a systemd marker')

  assert.equal(detectSystemdService(probe({ platform: 'win32' })), undefined)
  assert.equal(detectSystemdService(probe({ env: { INVOCATION_ID: 'abc', DSH_RESTART_SYSTEMD: '0' } })), undefined)
  // A dsh started from a shell inside some service (or behind a wrapper) is not the main process.
  assert.equal(detectSystemdService(probe({ pid: 1234 })), undefined)
  assert.equal(detectSystemdService(probe({ systemctl: () => ({ status: 1, stdout: '' }) })), undefined)
  assert.equal(detectSystemdService(probe({ systemctl: () => { throw new Error('ENOENT') } })), undefined)
  assert.equal(detectSystemdService(probe({ readCgroup: () => { throw new Error('no /proc') } })), undefined)
  assert.ok(detectSystemdService(probe({ env: { NOTIFY_SOCKET: '/run/notify' } })))
})

test('a policy that does not relaunch a clean exit gets a restart job instead of a helper', () => {
  const user = { unit: 'dsh-web.service', user: true, restart: 'on-failure', killMode: 'control-group' }
  assert.deepEqual(supervisedRestart(user, false), { kind: 'systemctl', args: ['--user', 'restart', '--no-block', 'dsh-web.service'] })
  assert.deepEqual(supervisedRestart({ ...user, restart: 'on-success' }, false), { kind: 'exit' })

  const system = { unit: 'dsh.service', user: false, restart: 'no', killMode: 'control-group' }
  assert.deepEqual(supervisedRestart(system, true), { kind: 'systemctl', args: ['restart', '--no-block', 'dsh.service'] })
  const refused = supervisedRestart(system, false)
  assert.equal(refused.kind, 'unsupported')
  assert.match(refused.reason, /system unit dsh\.service with Restart=no/)
})
