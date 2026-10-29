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
/** The dsh-restart configuration section on this bundle's plugin-manager page. */
export function SettingsCard(props) {
    const { t, set, clear } = props;
    const state = props.useDshRestart(snapshot => snapshot);
    const [restarting, setRestarting] = useState(false);
    const [restartFailed, setRestartFailed] = useState(false);
    const [restartStale, setRestartStale] = useState(false);
    const [restartSucceeded, setRestartSucceeded] = useState(consumeRestartSucceeded);
    const restartController = useRef(null);
    // The prompt is edited as a local draft and written on blur/Enter (and on
    // unmount). Writing every keystroke trimmed the value, so no space could be
    // typed between words, and the controlled input fell back to the last
    // Host-accepted value while each write was in flight, dropping keystrokes.
    const [promptDraft, setPromptDraft] = useState(null);
    const lastPromptWrite = useRef(null);
    const commitPrompt = useRef(() => { });
    commitPrompt.current = () => {
        if (promptDraft === null || !state.writable)
            return;
        const value = promptDraft.trim();
        if (value === state.continuePrompt || value === lastPromptWrite.current)
            return;
        lastPromptWrite.current = value;
        if (value === '')
            clear('continuePrompt');
        else
            set('continuePrompt', value);
    };
    // A new accepted value (our own write echoing back, or another editor) wins.
    useEffect(() => {
        setPromptDraft(null);
        lastPromptWrite.current = null;
    }, [state.continuePrompt]);
    useEffect(() => () => { commitPrompt.current(); }, []);
    useEffect(() => () => { restartController.current?.abort(); }, []);
    useEffect(() => {
        if (!restartSucceeded)
            return;
        const timer = window.setTimeout(() => { setRestartSucceeded(false); }, 5000);
        return () => { window.clearTimeout(timer); };
    }, [restartSucceeded]);
    if (props.view !== 'page' || !state.available)
        return null;
    const disabled = !state.writable;
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
                locale: props.uiLocale,
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
    return (_jsxs("div", { className: css.body, children: [_jsx("p", { className: css.description, children: t('description') }), !state.writable ? _jsx("p", { className: css.readOnly, role: "status", children: t('readOnly') }) : null, _jsxs("label", { className: css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.legacyRestart, disabled: disabled, onChange: event => { set('legacyRestart', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('legacyRestart') }), _jsx("span", { className: css.hint, children: t('legacyRestartHint') })] })] }), _jsxs("label", { className: css.field, htmlFor: "dsh-restart-continue-prompt", children: [_jsx("span", { className: css.label, children: t('continuePrompt') }), _jsx("input", { id: "dsh-restart-continue-prompt", className: css.input, type: "text", value: promptDraft ?? state.continuePrompt, disabled: disabled, onChange: event => { setPromptDraft(event.currentTarget.value); }, onBlur: () => { commitPrompt.current(); }, onKeyDown: event => { if (event.key === 'Enter')
                            event.currentTarget.blur(); } }), _jsx("span", { className: css.hint, children: t('continuePromptHint') })] }), _jsxs("div", { className: css.footer, children: [_jsx("p", { className: restartFailed || restartStale ? css.failed : css.actionHint, role: "status", "aria-live": "polite", children: restartStale ? t('restartStale') : restartFailed ? t('restartFailed') : restartSucceeded ? t('restartSucceeded') : t('restartHint') }), _jsx("button", { type: "button", className: css.restart, disabled: restarting, onClick: () => { void restartNow(); }, children: t(restarting ? 'restarting' : 'restartNow') })] })] }));
}
