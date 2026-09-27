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
import type { Context } from './context-types.ts';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { ConfirmDialogSurface } from './RestartConfirmDialog.tsx';
import { reduceRestartPhase } from './restart-action.ts';
import type { SettingsSectionOwnerProps } from './slot-contracts.ts';
export declare const name = "dsh-restart-client";
export declare const inject: string[];
export declare const NS = "restart.card";
/** The slice of the host's settings the UI projects. */
export interface RestartCardState {
    /** The settings service has a ready value for this namespace. */
    available: boolean;
    writable: boolean;
    legacyRestart: boolean;
    continuePrompt: string;
}
/** Props of the registered settings page. */
export type RestartSectionProps = SettingsSectionOwnerProps & PropsLocale<typeof NS> & {
    useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R;
    set: (field: string, value: unknown) => void;
    clear: (field: string) => void;
};
/** Seams the test suite exercises directly (the bundle exposes no other one). */
export declare const internals: {
    ConfirmDialogSurface: typeof ConfirmDialogSurface;
    reduceRestartPhase: typeof reduceRestartPhase;
};
/**
 * Wire the three surfaces up to the host settings namespace.
 * @param ctx - the client cordis context.
 */
export declare function apply(ctx: Context): void;
