import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { SettingsCard } from "./SettingsCard.js";
import { en, zh } from "./locales.js";
import { ensureStyles } from "./styles.js";
import { reportUiLocale } from "./restart-monitor.js";
export const name = 'dsh-restart-client';
export const inject = ['slots', 'locale', 'configForms'];
export const NS = 'restart.card';
export function apply(ctx) {
    ensureStyles();
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-restart: dictionaries');
    // With no explicit Language setting the UI follows the browser, which the
    // host cannot see; report the active locale so the post-restart continue
    // prompt matches what this UI shows.
    const uiLocale = () => ctx.locale.getLocale().active;
    reportUiLocale(uiLocale());
    ctx.on('locale/change', (snapshot) => { reportUiLocale(snapshot.active); });
    const scope = ctx.configForms.get('dsh-restart');
    const project = () => {
        const snap = scope.getSnapshot();
        const value = snap.value ?? {};
        return {
            available: snap.status === 'ready',
            writable: snap.writable,
            legacyRestart: value.legacyRestart === true,
            continuePrompt: typeof value.continuePrompt === 'string' ? value.continuePrompt : '',
        };
    };
    const store = createSnapshotStore(project());
    // The form is shared per namespace and outlives this plugin, so the listener
    // must go with this fiber (client hot reload) instead of feeding a dead store.
    ctx.effect(() => scope.subscribe(() => { store.set(project()); }), 'dsh-restart: config form');
    // DSH 0.2.x declares the seat only while the plugin-manager page is open;
    // the helper re-registers the entry on every declaration epoch.
    ctx.slots.inject('plugins.bundle.config', function* () {
        yield ctx.slots.register({
            name: 'plugins.bundle.config',
            key: 'dsh-restart',
            locale: NS,
            inject: () => ({
                hooks: { dshRestart: store },
                set: (field, value) => { void scope.set(field, value); },
                clear: (field) => { void scope.unset(field); },
                uiLocale,
            }),
        }, SettingsCard);
    });
}
