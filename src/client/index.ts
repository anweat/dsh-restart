/**
 * dsh-restart — client half.
 *
 * One surface: 'settings.section', the plugin's own page in the settings
 * navigation. DSH 0.1.7 replaced the 0.1.5 'settings.plugin.item' card list with
 * list slots, which is why the 0.1.5-era build rendered nothing at all.
 *
 * It registers an additive list slot, so other plugins stack beside it instead of
 * competing for the cell, and every restart it offers goes through the
 * confirmation gate in restart-action.ts.
 */
import type { Context } from './context-types.ts'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSettingsSource } from './settings-source.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { ConfirmDialogSurface } from './RestartConfirmDialog.tsx'
import { RestartSection } from './RestartSection.tsx'
import { reduceRestartPhase } from './restart-action.ts'
import { en, zh } from './locales.ts'
import { ensureStyles } from './styles.ts'
import type { SettingsSectionOwnerProps } from './slot-contracts.ts'

export const name = 'dsh-restart-client'
// Both settings services are optional (see settings-source.ts): demanding one
// here would keep the whole plugin — quick restart entries included — from
// applying on a host that does not mount it.
export const inject = ['slots', 'locale']
export const NS = 'restart.card'

/** The slice of the host's settings the UI projects. */
export interface RestartCardState {
  /** The settings service has a ready value for this namespace. */
  available: boolean
  writable: boolean
  legacyRestart: boolean
  continuePrompt: string
}

/** Props of the registered settings page. */
export type RestartSectionProps = SettingsSectionOwnerProps & PropsLocale<typeof NS> & {
  useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R
  set: (field: string, value: unknown) => void
  clear: (field: string) => void
}

/** Seams the test suite exercises directly (the bundle exposes no other one). */
export const internals = { ConfirmDialogSurface, reduceRestartPhase }

/**
 * Wire the three surfaces up to the host settings namespace.
 * @param ctx - the client cordis context.
 */
export function apply(ctx: Context): void {
  ensureStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-restart: dictionaries')

  const source = createSettingsSource(ctx, 'dsh-restart')
  const t = ctx.locale.bind(NS)

  const project = (): RestartCardState => {
    const snap = source.snapshot()
    const value = (snap?.value ?? {}) as Record<string, unknown>
    return {
      available: snap?.status === 'ready',
      writable: snap?.writable === true,
      legacyRestart: value.legacyRestart === true,
      continuePrompt: typeof value.continuePrompt === 'string' ? value.continuePrompt : '',
    }
  }

  const store: SnapshotStore<RestartCardState> = createSnapshotStore(project())
  const unsubscribeSettings = source.subscribe(() => { store.set(project()) })
  ctx.effect(() => () => {
    unsubscribeSettings()
    source.dispose()
  }, 'dsh-restart: settings source')

  const hooksOnly = (): { hooks: { dshRestart: SnapshotStore<RestartCardState> } } => ({
    hooks: { dshRestart: store },
  })

  // Own settings page. The nav row reads its label through resolveSlotLabel, so
  // the thunk keeps the text following the active locale.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-restart',
    order: 50,
    label: () => t('title'),
    locale: NS,
    inject: () => ({
      ...hooksOnly(),
      set: (field: string, value: unknown) => { source.set(field, value) },
      clear: (field: string) => { source.unset(field) },
    }),
  }, RestartSection))

}
