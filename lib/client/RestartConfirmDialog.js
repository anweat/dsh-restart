import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The secondary confirmation every restart trigger goes through.
 *
 * The surface is rendered into `document.body` through a portal rather than
 * inline: the seats this plugin occupies (the 56px sidebar rail, the
 * conversation header) clip or transform their children, so an inline dialog
 * would be cut off or trapped under another plugin's overlay. The portal's
 * first child is a plain function component so the markup stays
 * server-renderable and testable.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { styles as css } from "./styles.js";
const TITLE_ID = 'dsh-restart-confirm-title';
const BODY_ID = 'dsh-restart-confirm-body';
/**
 * The confirmation markup on its own: no portal, no effects, no DOM access.
 * @param props - copy, busy state, and the two decisions.
 * @returns the dialog element tree.
 */
export function ConfirmDialogSurface({ t, busy, onConfirm, onCancel }) {
    return (_jsx("div", { className: css.confirmOverlay, role: "presentation", onClick: onCancel, children: _jsxs("div", { className: css.confirmPanel, role: "dialog", "aria-modal": "true", "aria-labelledby": TITLE_ID, "aria-describedby": BODY_ID, onClick: event => { event.stopPropagation(); }, children: [_jsx("p", { className: css.confirmTitle, id: TITLE_ID, children: t('confirmTitle') }), _jsx("p", { className: css.confirmBody, id: BODY_ID, children: t('confirmBody') }), _jsxs("div", { className: css.confirmActions, children: [_jsx("button", { type: "button", className: css.confirmCancel, disabled: busy, onClick: onCancel, children: t('confirmCancel') }), _jsx("button", { type: "button", className: css.confirmRestart, disabled: busy, autoFocus: true, onClick: onConfirm, children: t('confirmRestart') })] })] }) }));
}
/** The mounted dialog: the surface, portalled to the document body, Escape-aware. */
export function RestartConfirmDialog(props) {
    const { onCancel } = props;
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                onCancel();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => { document.removeEventListener('keydown', onKeyDown); };
    }, [onCancel]);
    return createPortal(_jsx(ConfirmDialogSurface, { ...props }), document.body);
}
