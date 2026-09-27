import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { RestartCardState } from './index.ts';
import type { SidebarFooterActionOwnerProps } from './slot-contracts.ts';
/** The inject face both quick seats consume. */
export interface QuickRestartProps extends PropsLocale<'restart.card'> {
    useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R;
}
/** Sidebar footer rail seat: the core sidebar adds it above its Settings row. */
export interface SidebarQuickRestartProps extends SidebarFooterActionOwnerProps, QuickRestartProps {
}
/** Icon-only on the collapsed rail, labelled on the expanded sidebar. */
export declare function SidebarQuickRestart({ wide, t, useDshRestart }: SidebarQuickRestartProps): import("react").JSX.Element | null;
/** Conversation header seat, next to the session title and its other actions. */
export declare function HeaderQuickRestart({ t, useDshRestart }: QuickRestartProps): import("react").JSX.Element | null;
/** Geometry of one seat. */
export type QuickRestartVariant = 'rail' | 'wide' | 'header';
interface QuickRestartButtonProps {
    variant: QuickRestartVariant;
    t: PropsLocale<'restart.card'>['t'];
}
/** The actual button, plus its dialog — one gate instance per seat. */
export declare function QuickRestartButton({ variant, t }: QuickRestartButtonProps): import("react").JSX.Element;
export {};
