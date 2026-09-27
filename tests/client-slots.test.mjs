import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

/** The slot the client half fills. */
const SLOTS = ['settings.section']

/** The stylesheet DOM the bundle writes into, keyed by element id. */
const domElements = new Map()

/**
 * Evaluate the shipped client bundle exactly as the Web runtime does: the
 * bundle registers a factory with __ModuleLoader__, and the loader hands it a
 * require() resolved against the client module graph.
 */
let registered
function loadClientBundle() {
  if (registered === undefined) {
    globalThis.window = { __ModuleLoader__: { load(value) { registered = value } } }
    globalThis.document = {
      getElementById(id) { return domElements.get(id) ?? null },
      createElement() { return { id: '', textContent: '' } },
      head: { append(node) { domElements.set(node.id, node) } },
    }
    require('../lib/client.js')
  }
  const definition = registered
  assert.ok(definition, 'the bundle must register itself with __ModuleLoader__')
  assert.equal(definition.id, 'dsh-restart')

  const store = {
    createSnapshotStore(initial) {
      let current = initial
      return {
        getSnapshot() { return current },
        subscribe() { return () => {} },
        set(next) { current = next },
      }
    },
  }
  return definition.factory(specifier => {
    if (specifier === '@deepseek-ai/dsh-client-store') return store
    return require(specifier)
  })
}

/** The native 0.1.7 settings form for this plugin entry, mutable through the same subscribe seam. */
function fakeForms(value = {}, status = 'ready') {
  let current = { status, writable: true, value }
  const listeners = new Set()
  const publish = () => { for (const listener of listeners) listener() }
  const form = {
    getSnapshot() { return current },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    set(field, next) {
      current = { ...current, value: { ...current.value, [field]: next } }
      publish()
      return Promise.resolve(true)
    },
    unset(field) {
      const { [field]: _dropped, ...rest } = current.value
      current = { ...current, value: rest }
      publish()
      return Promise.resolve(true)
    },
  }
  return {
    merge(next) {
      current = { ...current, value: { ...current.value, ...next } }
      publish()
    },
    get() { return form },
    form,
  }
}

/** Minimal client ctx: records what the plugin asks for and registers. */
function fakeCtx(value, status) {
  const forms = fakeForms(value, status)
  const injected = []
  const registered = []
  const ctx = {
    effect(callback) { return callback() },
    inject(dependencies, callback) {
      // Only the native 0.1.7 settings service is mounted here; the legacy
      // settingsScope stays absent, exactly as on a vanilla 0.1.7 host.
      if (dependencies.includes('configForms')) {
        return callback({ configForms: forms, effect(cb) { return cb() } })
      }
      return undefined
    },
    locale: {
      register() {},
      bind() { return (key) => 't:' + key },
    },
    slots: {
      inject(key, callback) { injected.push(key); return callback() },
      register(options, component) { registered.push({ options, component }); return () => {} },
    },
  }
  return { ctx, injected, registered, scope: forms, forms }
}

function entryFor(registered, name) {
  const entry = registered.find(candidate => candidate.options.name === name)
  assert.ok(entry, `${name} must be registered`)
  return entry
}

test('the client half fills one additive slot', () => {
  const bundle = loadClientBundle()
  const { ctx, injected, registered } = fakeCtx()

  bundle.apply(ctx)

  assert.deepEqual(injected, SLOTS)

  const section = entryFor(registered, 'settings.section')
  assert.equal(section.options.id, 'dsh-restart')
  assert.equal(section.options.order, 50)
  assert.equal(section.options.locale, 'restart.card')
  // The nav row reads the label through resolveSlotLabel, so a thunk keeps it
  // following the active locale instead of freezing at load time.
  assert.equal(typeof section.options.label, 'function')
  assert.equal(section.options.label(), 't:title')
  const sectionInject = section.options.inject()
  assert.equal(typeof sectionInject.set, 'function')
  assert.equal(typeof sectionInject.clear, 'function')
  assert.equal(typeof sectionInject.hooks.dshRestart, 'object')
})

test('the settings page carries the restart button and the configuration rows', () => {
  const bundle = loadClientBundle()
  const { ctx, registered } = fakeCtx({ legacyRestart: false, continuePrompt: 'continue' })
  bundle.apply(ctx)
  const section = entryFor(registered, 'settings.section')
  const useDshRestart = selector => selector(section.options.inject().hooks.dshRestart.getSnapshot())

  const html = renderToStaticMarkup(React.createElement(section.component, {
    close() {},
    t: key => key,
    useDshRestart,
    set() {},
    clear() {},
  }))
  assert.match(html, /dsh-restart-page-title">title</)
  assert.match(html, /id="dsh-restart-continue-prompt"/)
  assert.match(html, /dsh-restart-button[^>]*aria-haspopup="dialog"[^>]*>restartNow</)
  assert.match(html, /dsh-restart-action-hint/)
  // Regression: the prompt field must stay typeable (the settings echo arrives
  // asynchronously, so the field keeps a local draft while it is edited).
  assert.ok(!/id="dsh-restart-continue-prompt"[^>]*disabled/.test(html), 'the prompt field accepts typing')
  // An unresolved namespace still renders the page: the note plus a working
  // restart button, instead of a blank panel the user cannot diagnose.
  const pending = fakeCtx({}, 'pending')
  bundle.apply(pending.ctx)
  const pendingSection = entryFor(pending.registered, 'settings.section')
  const pendingHtml = renderToStaticMarkup(React.createElement(pendingSection.component, {
    close() {}, t: key => key, set() {}, clear() {},
    useDshRestart: selector => selector({
      available: false, writable: false, legacyRestart: false, continuePrompt: '',
      quickRestartSidebar: true, quickRestartHeader: false,
    }),
  }))
  assert.match(pendingHtml, /settingsUnavailable/)
  assert.match(pendingHtml, /dsh-restart-page-title/)
  assert.match(pendingHtml, /dsh-restart-button[^>]*>restartNow</)
  assert.ok(pendingHtml.includes('disabled'), 'an unresolved namespace disables the switches')
})

test('a stray confirm can never restart the harness', () => {
  const bundle = loadClientBundle()
  const { reduceRestartPhase } = bundle.internals
  assert.equal(typeof reduceRestartPhase, 'function')

  // Only the dialog's own confirm, answered from the confirming phase, starts
  // the restart; every other phase treats it as inert.
  for (const phase of ['idle', 'busy', 'failed']) {
    assert.equal(reduceRestartPhase(phase, 'confirm'), phase, `confirm must be inert while ${phase}`)
  }
  assert.equal(reduceRestartPhase('confirming', 'confirm'), 'busy')

  assert.equal(reduceRestartPhase('idle', 'request'), 'confirming')
  assert.equal(reduceRestartPhase('confirming', 'request'), 'confirming')
  assert.equal(reduceRestartPhase('busy', 'request'), 'busy', 'a request cannot re-arm a running restart')
  assert.equal(reduceRestartPhase('confirming', 'cancel'), 'idle')
  assert.equal(reduceRestartPhase('idle', 'cancel'), 'idle')
  assert.equal(reduceRestartPhase('busy', 'cancel'), 'busy', 'a running restart is not cancellable')
  assert.equal(reduceRestartPhase('busy', 'fail'), 'failed')
  assert.equal(reduceRestartPhase('confirming', 'fail'), 'confirming', 'an unwound attempt cannot paint an error')
  assert.equal(reduceRestartPhase('failed', 'settle'), 'idle')
  assert.equal(reduceRestartPhase('busy', 'settle'), 'busy')
})

test('the confirmation dialog is a real modal with both decisions', () => {
  const bundle = loadClientBundle()
  const { ConfirmDialogSurface } = bundle.internals
  assert.equal(typeof ConfirmDialogSurface, 'function')

  const html = renderToStaticMarkup(React.createElement(ConfirmDialogSurface, {
    t: key => key,
    busy: false,
    onConfirm() {},
    onCancel() {},
  }))
  assert.match(html, /role="dialog"/)
  assert.match(html, /aria-modal="true"/)
  assert.match(html, /aria-labelledby="dsh-restart-confirm-title"/)
  assert.match(html, /aria-describedby="dsh-restart-confirm-body"/)
  assert.match(html, /id="dsh-restart-confirm-title"/)
  assert.match(html, /dsh-restart-confirm-body/)
  assert.match(html, /dsh-restart-confirm-cancel/)
  assert.match(html, /dsh-restart-confirm-restart/)
  assert.ok(!html.includes('disabled'))

  const busy = renderToStaticMarkup(React.createElement(ConfirmDialogSurface, {
    t: key => key,
    busy: true,
    onConfirm() {},
    onCancel() {},
  }))
  assert.equal((busy.match(/disabled/g) ?? []).length, 2, 'both decisions lock while the restart runs')
})

test('the stylesheet is installed once, under one id', () => {
  const bundle = loadClientBundle()
  bundle.apply(fakeCtx().ctx)
  bundle.apply(fakeCtx().ctx)

  const sheets = [...domElements.keys()].filter(id => id === 'dsh-restart-client-styles')
  assert.deepEqual(sheets, ['dsh-restart-client-styles'])
  const sheet = domElements.get('dsh-restart-client-styles').textContent
  assert.match(sheet, /\.dsh-restart-confirm-panel\{/)
  assert.match(sheet, /var\(--dsw-alias-label-primary\)/, 'design tokens carry the app theme')
})

test('the shipped client bundle never reloads the page after a restart', () => {
  const bundle = fs.readFileSync(require.resolve('../lib/client.js'), 'utf8')
  assert.equal(bundle.includes('location.reload'), false)
})
