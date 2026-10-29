/**
 * dsh-restart — client half: the configuration section on this bundle's
 * plugin-manager page (Settings → Plugins → dsh-restart), bound to the
 * `dsh-restart` settings namespace. DSH 0.2.x serves the namespace through
 * the `configForms` service and hosts bundle configuration in the keyed
 * `plugins.bundle.config` slot; the Host reads the values back from the
 * exported `Config` schema.
 */
import type { Context } from './context-types.ts';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
export declare const name = "dsh-restart-client";
export declare const inject: string[];
export declare const NS = "restart.card";
export interface RestartCardState {
    available: boolean;
    writable: boolean;
    legacyRestart: boolean;
    continuePrompt: string;
}
export type SettingsCardProps = PropsLocale<typeof NS> & PluginConfigViewProps & {
    useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R;
    set: (field: string, value: unknown) => void;
    clear: (field: string) => void;
    /** The UI's active locale, sent with the restart request. */
    uiLocale: () => string;
};
export declare function apply(ctx: Context): void;
