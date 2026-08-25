import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { restartAndWait } from "./restart-monitor.js";
import { styles as css } from "./styles.js";
const RESTART_SUCCEEDED_KEY = 'dsh-restart:completed';
function consumeRestartSucceeded() {
    try {
        const succeeded = sessionStorage.getItem(RESTART_SUCCEEDED_KEY) === '1';
        if (succeeded)
            sessionStorage.removeItem(RESTART_SUCCEEDED_KEY);
        return succeeded;
    }
    catch {
        return false;
    }
}
function rememberRestartSucceeded() {
    try {
        sessionStorage.setItem(RESTART_SUCCEEDED_KEY, '1');
    }
    catch { /* reload still works */ }
}
/** The dsh-restart configuration card, styled with the host plugin-card tokens. */
export function SettingsCard(props) {
    const { t, set, clear } = props;
    const state = props.useDshRestart(snapshot => snapshot);
    const [open, setOpen] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [restartFailed, setRestartFailed] = useState(false);
    const [restartStale, setRestartStale] = useState(false);
    const [restartSucceeded, setRestartSucceeded] = useState(consumeRestartSucceeded);
    const restartController = useRef(null);
    useEffect(() => () => { restartController.current?.abort(); }, []);
    useEffect(() => {
        if (!restartSucceeded)
            return;
        const timer = window.setTimeout(() => { setRestartSucceeded(false); }, 5000);
        return () => { window.clearTimeout(timer); };
    }, [restartSucceeded]);
    if (!state.available)
        return null;
    const disabled = !state.writable;
    const toggle = (field, value) => { set(field, value); };
    const text = (field, value) => {
        if (value.trim() === '')
            clear(field);
        else
            set(field, value.trim());
    };
    const number = (field, value) => {
        if (value.trim() === '') {
            clear(field);
            return;
        }
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            set(field, parsed);
    };
    const restartNow = async () => {
        if (restarting)
            return;
        setRestarting(true);
        setRestartFailed(false);
        setRestartStale(false);
        setRestartSucceeded(false);
        const controller = new AbortController();
        restartController.current = controller;
        try {
            const result = await restartAndWait({
                signal: controller.signal,
                isVisible: () => document.visibilityState === 'visible',
            });
            if (result === 'stale') {
                setRestartStale(true);
                setRestarting(false);
                return;
            }
            rememberRestartSucceeded();
            window.location.reload();
        }
        catch {
            if (controller.signal.aborted)
                return;
            setRestartFailed(true);
            setRestarting(false);
        }
        finally {
            if (restartController.current === controller)
                restartController.current = null;
        }
    };
    return (_jsxs("li", { className: `${css.card} ${open ? css.cardOpen : ''}`, children: [_jsxs("button", { type: "button", className: css.header, "aria-expanded": open, "aria-label": `${t(open ? 'collapse' : 'expand')}: ${t('title')}`, onClick: () => { setOpen(!open); }, children: [_jsxs("span", { className: css.headText, children: [_jsx("span", { className: css.name, children: t('title') }), _jsx("span", { className: css.description, children: t('description') })] }), _jsx("svg", { className: `${css.chevron} ${open ? css.chevronOpen : ''}`, viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": "true", children: _jsx("path", { d: "M3.5 5.5 7 9l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), open ? (_jsxs("div", { className: css.body, children: [!state.writable ? _jsx("p", { className: css.readOnly, role: "status", children: t('readOnly') }) : null, _jsxs("label", { className: css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.legacyRestart, disabled: disabled, onChange: event => { toggle('legacyRestart', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('legacyRestart') }), _jsx("span", { className: css.hint, children: t('legacyRestartHint') })] })] }), _jsxs("label", { className: css.field, htmlFor: "dsh-restart-continue-prompt", children: [_jsx("span", { className: css.label, children: t('continuePrompt') }), _jsx("input", { id: "dsh-restart-continue-prompt", className: css.input, type: "text", value: state.continuePrompt, disabled: disabled, onChange: event => { text('continuePrompt', event.currentTarget.value); } }), _jsx("span", { className: css.hint, children: t('continuePromptHint') })] }), _jsxs("label", { className: css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.watchdogEnabled, disabled: disabled, onChange: event => { toggle('watchdogEnabled', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('watchdogEnabled') }), _jsx("span", { className: css.hint, children: t('watchdogEnabledHint') })] })] }), _jsxs("label", { className: css.field, htmlFor: "dsh-restart-watchdog-cooldown", children: [_jsx("span", { className: css.label, children: t('watchdogCooldownMs') }), _jsx("input", { id: "dsh-restart-watchdog-cooldown", className: css.input, type: "number", inputMode: "numeric", value: state.watchdogCooldownMs || '', disabled: disabled, onChange: event => { number('watchdogCooldownMs', event.currentTarget.value); } }), _jsx("span", { className: css.hint, children: t('watchdogCooldownMsHint') })] }), _jsxs("label", { className: css.field, htmlFor: "dsh-restart-watchdog-poll", children: [_jsx("span", { className: css.label, children: t('watchdogPollMs') }), _jsx("input", { id: "dsh-restart-watchdog-poll", className: css.input, type: "number", inputMode: "numeric", value: state.watchdogPollMs || '', disabled: disabled, onChange: event => { number('watchdogPollMs', event.currentTarget.value); } }), _jsx("span", { className: css.hint, children: t('watchdogPollMsHint') })] }), _jsxs("div", { className: css.footer, children: [_jsx("p", { className: restartFailed || restartStale ? css.failed : css.actionHint, role: "status", "aria-live": "polite", children: restartStale ? t('restartStale') : restartFailed ? t('restartFailed') : restartSucceeded ? t('restartSucceeded') : t('restartHint') }), _jsx("button", { type: "button", className: css.restart, disabled: restarting, onClick: () => { void restartNow(); }, children: t(restarting ? 'restarting' : 'restartNow') })] })] })) : null] }));
}
