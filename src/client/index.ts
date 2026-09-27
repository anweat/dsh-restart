/**
 * dsh-restart — client half.
 *
 * Three surfaces, one settings namespace:
 *   1. 'settings.section'   — the plugin's own page in the settings navigation
 *                             (0.1.7 replaced the 0.1.5 'settings.plugin.item'
 *                             card list, which is why the old build rendered
 *                             nothing at all);
 *   2. 'sidebar.footer.action'      — the one-click entry at the sidebar foot,
 *                                     directly above Settings (default on);
 *   3. 'conversation.session.header.actions' — the same entry beside the
 *                                     conversation title (default off).
 *
 * 2 and 3 are placement toggles on 1, and all of them are list slots, so other
 * plugins stack beside this one instead of competing for the cell. Every restart
 * - from the settings page or from either quick entry — goes through the same
 * confirmation gate in restart-action.ts.
 */
import type { Context } from './context-types.ts'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSettingsSource } from './settings-source.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { HeaderQuickRestart, SidebarQuickRestart } from './QuickRestartButton.tsx'
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
  /** Show the quick entry at the sidebar foot (above Settings). */
  quickRestartSidebar: boolean
  /** Show the quick entry beside the conversation title. */
  quickRestartHeader: boolean
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
      // Absent (older settings.yaml, or a host that has not reloaded its
      // schema yet) keeps the historical behaviour: the foot entry is on.
      quickRestartSidebar: value.quickRestartSidebar !== false,
      quickRestartHeader: value.quickRestartHeader === true,
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

  // Sidebar foot, above Settings. slots.inject defers until the core sidebar
  // declares the slot, so bundle load order does not matter.
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-restart',
    order: 30,
    locale: NS,
    inject: hooksOnly,
  }, SidebarQuickRestart))

  // Conversation header, for when the sidebar is collapsed or hidden. Session
  // scoped: the owner only renders it while a session is open.
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'dsh-restart',
    order: 30,
    locale: NS,
    inject: hooksOnly,
  }, HeaderQuickRestart))
}
