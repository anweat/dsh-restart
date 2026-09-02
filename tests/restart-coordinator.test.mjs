import assert from 'node:assert/strict'
import test from 'node:test'

import { RestartCoordinator } from '../lib/restart-coordinator.js'

test('restart coordinator reuses one scheduled restart until it is released', () => {
  const coordinator = new RestartCoordinator()
  let schedules = 0
  const schedule = () => ({ id: ++schedules })

  const first = coordinator.claim(schedule)
  const duplicate = coordinator.claim(schedule)

  assert.equal(first.fresh, true)
  assert.equal(duplicate.fresh, false)
  assert.equal(duplicate.value, first.value)
  assert.equal(schedules, 1)

  coordinator.release(first.value)
  const retry = coordinator.claim(schedule)
  assert.equal(retry.fresh, true)
  assert.equal(retry.value.id, 2)
})
