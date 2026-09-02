/**
 * dsh-restart — client half: a plugin-config card (设置 → 插件 → 可配置) bound
 * to the `dsh-restart` settings namespace, so edits persist to settings.yaml and
 * the Host reads them back through installSettingsSection.
 */
import type { Context } from './context-types.ts';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
export declare const name = "dsh-restart-client";
export declare const inject: string[];
export declare const NS = "restart.card";
export interface RestartCardState {
    available: boolean;
    writable: boolean;
    legacyRestart: boolean;
    continuePrompt: string;
}
export type SettingsCardProps = PropsLocale<typeof NS> & {
    useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R;
    set: (field: string, value: unknown) => void;
    clear: (field: string) => void;
};
export declare function apply(ctx: Context): void;
