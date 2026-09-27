import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { createSettingsSource } from "./settings-source.js";
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
}
