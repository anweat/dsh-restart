import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { createSettingsSource } from "./settings-source.js";
import { HeaderQuickRestart, SidebarQuickRestart } from "./QuickRestartButton.js";
import { ConfirmDialogSurface } from "./RestartConfirmDialog.js";
import { RestartSection } from "./RestartSection.js";
import { reduceRestartPhase } from "./restart-action.js";
import { en, zh } from "./locales.js";
import { ensureStyles } from "./styles.js";
export const name = 'dsh-restart-client';
// Both settings services are optional (see settings-source.ts): demanding one
// here would keep the whole plugin — quick restart entries included — from
// applying on a host that does not mount it.
export const inject = ['slots', 'locale'];
export const NS = 'restart.card';
/** Seams the test suite exercises directly (the bundle exposes no other one). */
export const internals = { ConfirmDialogSurface, reduceRestartPhase };
/**
 * Wire the three surfaces up to the host settings namespace.
 * @param ctx - the client cordis context.
 */
export function apply(ctx) {
    ensureStyles();
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-restart: dictionaries');
    const source = createSettingsSource(ctx, 'dsh-restart');
    const t = ctx.locale.bind(NS);
    const project = () => {
        const snap = source.snapshot();
        const value = (snap?.value ?? {});
        return {
            available: snap?.status === 'ready',
            writable: snap?.writable === true,
            legacyRestart: value.legacyRestart === true,
            continuePrompt: typeof value.continuePrompt === 'string' ? value.continuePrompt : '',
            // Absent (older settings.yaml, or a host that has not reloaded its
            // schema yet) keeps the historical behaviour: the foot entry is on.
            quickRestartSidebar: value.quickRestartSidebar !== false,
            quickRestartHeader: value.quickRestartHeader === true,
        };
    };
    const store = createSnapshotStore(project());
    const unsubscribeSettings = source.subscribe(() => { store.set(project()); });
    ctx.effect(() => () => {
        unsubscribeSettings();
        source.dispose();
    }, 'dsh-restart: settings source');
    const hooksOnly = () => ({
        hooks: { dshRestart: store },
    });
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
            set: (field, value) => { source.set(field, value); },
            clear: (field) => { source.unset(field); },
        }),
    }, RestartSection));
    // Sidebar foot, above Settings. slots.inject defers until the core sidebar
    // declares the slot, so bundle load order does not matter.
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'dsh-restart',
        order: 30,
        locale: NS,
        inject: hooksOnly,
    }, SidebarQuickRestart));
    // Conversation header, for when the sidebar is collapsed or hidden. Session
    // scoped: the owner only renders it while a session is open.
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'dsh-restart',
        order: 30,
        locale: NS,
        inject: hooksOnly,
    }, HeaderQuickRestart));
}
