import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The dsh-restart settings page: 设置 → DSH 重启.
 *
 * Registered into `settings.section`, which gives this plugin its own row in
 * the settings navigation (the 0.1.7 replacement for the per-plugin card list
 * that 0.1.5 rendered from `settings.plugin.item`) and a full page to lay out
 * its restart behaviour. Everything it edits is the host's own settings
 * namespace, so the values round-trip through settings.yaml.
 *
 * The restart button goes through a confirmation gate: this page can restart the
 * process the page itself is running in.
 */
import { useEffect, useRef, useState } from 'react';
import { RestartConfirmDialog } from "./RestartConfirmDialog.js";
import { consumeRestartCompleted } from "./restart-marker.js";
import { useRestartAction } from "./restart-action.js";
import { ensureStyles, styles as css } from "./styles.js";
/** How long the success note stays on the page after a restart. */
const SUCCESS_MS = 5000;
/** The dsh-restart settings page. */
export function RestartSection(props) {
    ensureStyles();
    const { t, set, clear, useDshRestart } = props;
    const state = useDshRestart(snapshot => snapshot);
    const restart = useRestartAction();
    const [completed, setCompleted] = useState(consumeRestartCompleted);
    // The text field is backed by the host's settings document, which answers a
    // write asynchronously: a controlled input bound straight to that value drops
    // every keystroke the user makes before the echo arrives. Keep a local draft
    // while the field is being edited, write it debounced, and fall back to the
    // host's value once the echo matches.
    const [draft, setDraft] = useState(null);
    const lastSent = useRef(null);
    // Either this run reported success, or a manual refresh consumed the marker.
    const succeeded = completed || restart.succeeded;
    useEffect(() => {
        if (!succeeded)
            return;
        const timer = window.setTimeout(() => {
            setCompleted(false);
            restart.settle();
        }, SUCCESS_MS);
        return () => { window.clearTimeout(timer); };
    }, [succeeded]);
    // The page is never empty: a host that has not served this entry's settings
    // namespace yet still gets the restart button (the reason this plugin
    // exists) plus an explicit note, instead of a blank panel the user cannot
    // tell apart from a broken install.
    const editable = state.available;
    const disabled = !editable || !state.writable;
    const busy = restart.phase === 'busy';
    const writeText = (field, value) => {
        if (value.trim() === '')
            clear(field);
        else
            set(field, value.trim());
    };
    const promptValue = draft ?? state.continuePrompt;
    const commitPrompt = () => {
        if (draft === null)
            return;
        const next = draft.trim();
        if (next === state.continuePrompt) {
            setDraft(null);
            return;
        }
        lastSent.current = next;
        writeText('continuePrompt', next);
    };
    useEffect(() => {
        if (draft === null)
            return;
        const next = draft.trim();
        if (next === state.continuePrompt) {
            lastSent.current = null;
            setDraft(null);
            return;
        }
        if (lastSent.current === next)
            return;
        const timer = window.setTimeout(() => {
            lastSent.current = next;
            writeText('continuePrompt', next);
        }, 500);
        return () => { window.clearTimeout(timer); };
    }, [draft, state.continuePrompt]);
    const status = restart.phase === 'failed'
        ? (restart.stale ? t('restartStale') : t('restartFailed'))
        : succeeded ? t('restartSucceeded') : t('restartHint');
    return (_jsxs("div", { className: css.page, children: [_jsx("h2", { className: css.pageTitle, children: t('title') }), _jsx("p", { className: css.pageDescription, children: t('description') }), editable ? null : _jsx("p", { className: css.readOnly, role: "status", children: t('settingsUnavailable') }), !editable || state.writable ? null : _jsx("p", { className: css.readOnly, role: "status", children: t('readOnly') }), _jsxs("div", { className: css.rows, children: [_jsxs("label", { className: css.row + ' ' + css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.legacyRestart, disabled: disabled, onChange: event => { set('legacyRestart', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('legacyRestart') }), _jsx("span", { className: css.hint, children: t('legacyRestartHint') })] })] }), _jsxs("label", { className: css.row + ' ' + css.field, htmlFor: "dsh-restart-continue-prompt", children: [_jsx("span", { className: css.label, children: t('continuePrompt') }), _jsx("input", { id: "dsh-restart-continue-prompt", className: css.input, type: "text", value: promptValue, disabled: disabled, onChange: event => { setDraft(event.currentTarget.value); }, onBlur: commitPrompt, onKeyDown: event => { if (event.key === 'Enter')
                                    commitPrompt(); } }), _jsx("span", { className: css.hint, children: t('continuePromptHint') })] })] }), _jsxs("div", { className: css.footer, children: [_jsx("p", { className: restart.phase === 'failed' ? css.failed : css.actionHint, role: "status", "aria-live": "polite", children: busy ? t('restarting') : status }), _jsx("button", { type: "button", className: css.restart, disabled: busy, "aria-haspopup": "dialog", onClick: restart.request, children: t(busy ? 'restarting' : 'restartNow') })] }), restart.phase === 'confirming'
                ? _jsx(RestartConfirmDialog, { t: t, busy: busy, onConfirm: restart.confirm, onCancel: restart.cancel })
                : null] }));
}
