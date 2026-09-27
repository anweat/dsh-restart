import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
/** Props of the dialog's markup. */
export interface ConfirmDialogSurfaceProps {
    t: TranslateNS<'restart.card'>;
    /** The restart is already in flight; both buttons lock. */
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}
/**
 * The confirmation markup on its own: no portal, no effects, no DOM access.
 * @param props - copy, busy state, and the two decisions.
 * @returns the dialog element tree.
 */
export declare function ConfirmDialogSurface({ t, busy, onConfirm, onCancel }: ConfirmDialogSurfaceProps): import("react").JSX.Element;
/** The mounted dialog: the surface, portalled to the document body, Escape-aware. */
export declare function RestartConfirmDialog(props: ConfirmDialogSurfaceProps): import("react").ReactPortal;
