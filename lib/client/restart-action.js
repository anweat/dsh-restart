/**
 * The restart confirmation gate: a pure transition table plus the React hook
 * that drives it.
 *
 * Every restart this plugin triggers from the Web UI takes the same path —
 * `request` only arms the confirmation, `confirm` is the one transition that
 * talks to the Host. Keeping the table pure (and out of the components) is what
 * makes "a stray confirm can never restart DSH" checkable without a DOM, and it
 * is the single place where the secondary-confirmation requirement lives.
 */
import { useEffect, useRef, useState } from 'react';
import { rememberRestartCompleted } from "./restart-marker.js";
import { restartAndWait } from "./restart-monitor.js";
/**
 * Advance the confirmation gate.
 *
 * `confirm` is deliberately inert outside `confirming`: the restart request can
 * only follow a `request` the user has already answered in the dialog. `fail`
 * is inert outside `busy` for the same reason — a late rejection from an
 * aborted attempt cannot paint an error on an idle button.
 *
 * @param phase - current phase.
 * @param event - the transition to apply.
 * @returns the next phase.
 */
export function reduceRestartPhase(phase, event) {
    switch (event) {
        case 'request':
            return phase === 'busy' ? phase : 'confirming';
        case 'cancel':
            return phase === 'confirming' ? 'idle' : phase;
        case 'confirm':
            return phase === 'confirming' ? 'busy' : phase;
        case 'fail':
            return phase === 'busy' ? 'failed' : phase;
        case 'settle':
            return phase === 'failed' ? 'idle' : phase;
    }
}
const IDLE = { phase: 'idle', stale: false, detail: '', succeeded: false };
/**
 * Drive the gate from one component.
 *
 * The returned handlers keep their identity per render but are all safe to call
 * from a stale closure: every update goes through the functional setState form,
 * and the only value read from the render scope is the phase `confirm` guards
 * on.
 *
 * @returns the gate state and its handlers.
 */
export function useRestartAction() {
    const [state, setState] = useState(IDLE);
    const controller = useRef(null);
    useEffect(() => () => { controller.current?.abort(); }, []);
    const transition = (event) => {
        setState(current => {
            const next = reduceRestartPhase(current.phase, event);
            if (next === current.phase) {
                // `settle` on an idle seat is how a component clears the success note.
                return current.succeeded ? { ...current, succeeded: false } : current;
            }
            return { phase: next, stale: false, detail: '', succeeded: false };
        });
    };
    const confirm = () => {
        if (state.phase !== 'confirming')
            return;
        const aborter = new AbortController();
        controller.current = aborter;
        setState({ phase: 'busy', stale: false, detail: '', succeeded: false });
        void restartAndWait({ signal: aborter.signal, isVisible: () => document.visibilityState === 'visible' })
            .then((outcome) => {
            if (aborter.signal.aborted)
                return;
            if (outcome === 'restarted') {
                // The shell reconnects on its own, so this page stays open: this run
                // is the one that can report success, and no reload is needed.
                rememberRestartCompleted();
                setState({ phase: 'idle', stale: false, detail: '', succeeded: true });
                return;
            }
            setState({ phase: reduceRestartPhase('busy', 'fail'), stale: true, detail: '', succeeded: false });
        })
            .catch((error) => {
            if (aborter.signal.aborted)
                return;
            setState({
                phase: reduceRestartPhase('busy', 'fail'),
                stale: false,
                detail: error instanceof Error ? error.message : String(error),
                succeeded: false,
            });
        })
            .finally(() => { if (controller.current === aborter)
            controller.current = null; });
    };
    return {
        ...state,
        request: () => { transition('request'); },
        cancel: () => { transition('cancel'); },
        confirm,
        settle: () => { transition('settle'); },
    };
}
