/*
 * The settings service this page edits through, discovered at runtime.
 *
 * DSH 0.1.7 serves configuration forms through the client's own `configForms`
 * service, keyed by the profile entry id. The 0.1.5-era `settingsScope` is kept
 * as a fallback for hosts that still provide it (some deployments ship a
 * compatibility service under that name). Neither is demanded at load time:
 * the restart button is the reason this plugin exists and must work even when no
 * settings transport is mounted, so both lookups are optional scoped injections
 * and an absent service only leaves the page in its quiet state.
 */
import type { Context } from './context-types.ts'

/** Snapshot of one configuration form. */
export interface SettingsFormSnapshot {
  status?: string
  writable?: boolean
  value?: unknown
}

/** The form of one profile entry, as a client settings service exposes it. */
export interface SettingsForm {
  getSnapshot(): SettingsFormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): unknown
  unset(field: string): unknown
}

/** The client configuration-forms service (DSH 0.1.7 `configForms`). */
export interface SettingsFormsService {
  get(entryId: string): SettingsForm
}

/** The legacy per-namespace scope service (DSH 0.1.5 `settingsScope`). */
export interface LegacySettingsScopeService {
  bind(spec: { namespace: string }): SettingsForm
}

/** The settings surface one plugin page can read and write through. */
export interface SettingsSource {
  /** The form's current snapshot, or undefined while no service serves it. */
  snapshot(): SettingsFormSnapshot | undefined
  /** Subscribe to form or availability changes; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
  /** Write one field through the bound form, when there is one. */
  set(field: string, value: unknown): void
  /** Remove one field's user value, when there is a bound form. */
  unset(field: string): void
  /** Drop the form subscription. */
  dispose(): void
}

function isFormsService(value: unknown): value is SettingsFormsService {
  return typeof value === 'object' && value !== null && typeof (value as SettingsFormsService).get === 'function'
}

function isLegacyScope(value: unknown): value is LegacySettingsScopeService {
  return typeof value === 'object' && value !== null && typeof (value as LegacySettingsScopeService).bind === 'function'
}

/**
 * Resolve the settings form for one profile entry, preferring the native
 * 0.1.7 service over the legacy scope.
 * @param ctx - the client cordis context.
 * @param entryId - the profile entry id whose configuration the page edits.
 * @returns a source the page can project, write through, and dispose.
 */
export function createSettingsSource(ctx: Context, entryId: string): SettingsSource {
  const listeners = new Set<() => void>()
  let form: SettingsForm | undefined
  let unsubscribeForm: (() => void) | undefined

  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  const attach = (next: SettingsForm | undefined): void => {
    if (next === undefined || next === form) return
    unsubscribeForm?.()
    unsubscribeForm = undefined
    form = next
    try {
      unsubscribeForm = next.subscribe(notify)
    } catch {
      unsubscribeForm = undefined
    }
    notify()
  }

  // Native 0.1.7 first: the shared configuration forms service.
  try {
    ctx.inject(['configForms'], (formsCtx) => {
      const service = (formsCtx as unknown as { configForms?: unknown }).configForms
      if (!isFormsService(service)) return
      try {
        attach(service.get(entryId))
      } catch {
        // An entry the deployment does not serve leaves the legacy path open.
      }
    })
  } catch {
    // A host without the service simply keeps the quiet state.
  }

  // Legacy 0.1.5 hosts (and the compatibility services some deployments mount).
  try {
    ctx.inject(['settingsScope'], (scopeCtx) => {
      if (form !== undefined) return
      const service = (scopeCtx as unknown as { settingsScope?: unknown }).settingsScope
      if (!isLegacyScope(service)) return
      try {
        attach(service.bind({ namespace: entryId }))
      } catch {
        // Nothing to bind: the page reports the namespace as unresolved.
      }
    })
  } catch {
    // Same as above: the absence of a settings service is not a failure.
  }

  return {
    snapshot() {
      try {
        return form?.getSnapshot()
      } catch {
        return undefined
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(field, value) {
      try {
        void form?.set(field, value)
      } catch {
        // A refused write leaves the previous value on screen.
      }
    },
    unset(field) {
      try {
        void form?.unset(field)
      } catch {
        // Same as above.
      }
    },
    dispose() {
      unsubscribeForm?.()
      unsubscribeForm = undefined
      form = undefined
      listeners.clear()
    },
  }
}
