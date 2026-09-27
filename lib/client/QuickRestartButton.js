import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The one-click restart entry, in whichever main-panel seat the user enabled.
 *
 * Two seats share this component: the sidebar footer rail (rendered by the core
 * sidebar directly above its own Settings row, so it never displaces another
 * plugin's entry) and the conversation header. Both are additive list slots, so
 * a second contributor stacks beside us instead of fighting for the cell.
 *
 * A seat renders null while its placement toggle is off: registrations stay
 * static, flip instantly with the setting, and a disabled seat never has to be
 * re-registered. The class names adapt to the seat — the sidebar rail is 36px
 * wide and icon-only, the expanded sidebar and the conversation header show the
 * label — because the owner, not this plugin, decides that geometry.
 */
import { useEffect, useRef } from 'react';
import { RestartConfirmDialog } from "./RestartConfirmDialog.js";
import { useRestartAction } from "./restart-action.js";
import { ensureStyles, styles as css } from "./styles.js";
/** How long a failed attempt stays visible before the seat returns to idle. */
const RESET_MS = 8000;
/** Icon-only on the collapsed rail, labelled on the expanded sidebar. */
export function SidebarQuickRestart({ wide, t, useDshRestart }) {
    const enabled = useDshRestart(snapshot => snapshot.quickRestartSidebar);
    if (!enabled)
        return null;
    return _jsx(QuickRestartButton, { variant: wide ? 'wide' : 'rail', t: t });
}
/** Conversation header seat, next to the session title and its other actions. */
export function HeaderQuickRestart({ t, useDshRestart }) {
    const enabled = useDshRestart(snapshot => snapshot.quickRestartHeader);
    if (!enabled)
        return null;
    return _jsx(QuickRestartButton, { variant: "header", t: t });
}
const VARIANT_CLASS = {
    rail: css.quickRail,
    wide: css.quickWide,
    header: css.quickHeader,
};
/** The actual button, plus its dialog — one gate instance per seat. */
export function QuickRestartButton({ variant, t }) {
    ensureStyles();
    const restart = useRestartAction();
    const resetTimer = useRef(null);
    useEffect(() => () => {
        if (resetTimer.current !== null)
            window.clearTimeout(resetTimer.current);
    }, []);
    useEffect(() => {
        // A failed or successful attempt both settle back to idle on their own.
        if (restart.phase !== 'failed' && !restart.succeeded)
            return;
        resetTimer.current = window.setTimeout(() => {
            resetTimer.current = null;
            restart.settle();
        }, RESET_MS);
        return () => {
            if (resetTimer.current !== null) {
                window.clearTimeout(resetTimer.current);
                resetTimer.current = null;
            }
        };
    }, [restart.phase, restart.succeeded]);
    const busy = restart.phase === 'busy';
    const failed = restart.phase === 'failed';
    const succeeded = restart.succeeded;
    const label = busy ? t('quickRestarting') : failed ? t('quickFailed') : succeeded ? t('quickSucceeded') : t('quickTitle');
    const className = [
        css.quick,
        VARIANT_CLASS[variant],
        busy ? css.quickBusy : '',
        failed ? css.quickFailed : '',
    ].filter(Boolean).join(' ');
    return (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: className, "aria-label": label, "aria-haspopup": "dialog", title: failed && restart.detail !== '' ? label + ': ' + restart.detail : label, disabled: busy, onClick: restart.request, children: [_jsx("span", { "aria-hidden": "true", className: busy ? css.quickSpin : undefined, children: '\u21BB' }), variant === 'rail' ? null : _jsx("span", { className: css.quickText, children: label })] }), restart.phase === 'confirming'
                ? _jsx(RestartConfirmDialog, { t: t, busy: false, onConfirm: restart.confirm, onCancel: restart.cancel })
                : null] }));
}
