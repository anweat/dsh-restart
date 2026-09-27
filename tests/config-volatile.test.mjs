/**
 * Regression: DSH 0.1.7 serves a plugin's settings form only for the fields it
 * marks volatile.
 *
 * volatileForm (@deepseek-ai/dsh-settings) rebuilds the form from the fields
 * whose nearest schema ancestor carries a volatile mark, and
 * SettingsForms.describe() drops an entry whose form is undefined. A Config
 * schema that marks no field therefore leaves the settings page with no
 * writable namespace and every control disabled. See markVolatile in
 * src/index.ts.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { Config } from '../lib/index.js'

/** The fields the settings page edits; every one present must be served. */
const REQUIRED = ['legacyRestart', 'continuePrompt', 'quickRestartSidebar', 'quickRestartHeader']

/** Deprecated fields kept readable in settings.yaml but never shown. */
const HIDDEN = ['watchdogEnabled', 'watchdogCooldownMs', 'watchdogPollMs']

test('every settings-page field carries the volatile mark', () => {
  const dict = Config.dict ?? {}
  const present = REQUIRED.filter(field => field in dict)
  assert.ok(present.includes('legacyRestart') && present.includes('continuePrompt'), 'the page fields must exist')
  for (const field of present) {
    const meta = dict[field]?.meta ?? {}
    assert.equal(meta.volatile, true, field + ' must carry the volatile mark')
  }
  for (const field of HIDDEN) {
    const meta = dict[field]?.meta ?? {}
    assert.notEqual(meta.volatile, true, field + ' must stay out of the served form')
  }
})
