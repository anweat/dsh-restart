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
    /** Show the quick entry at the sidebar foot (above Settings). */
    quickRestartSidebar: boolean;
    /** Show the quick entry beside the conversation title. */
    quickRestartHeader: boolean;
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
