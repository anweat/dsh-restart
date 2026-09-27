/** Where the gate currently is. */
export type RestartActionPhase = 'idle' | 'confirming' | 'busy' | 'failed';
/** The only events any seat may dispatch. */
export type RestartActionEvent = 'request' | 'cancel' | 'confirm' | 'fail' | 'settle';
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
export declare function reduceRestartPhase(phase: RestartActionPhase, event: RestartActionEvent): RestartActionPhase;
/** Observable gate state plus the handlers every seat wires to its buttons. */
export interface RestartAction {
    phase: RestartActionPhase;
    /** The Host answered, but the process identity never changed. */
    stale: boolean;
    /** The new process answered: the restart succeeded and this page stayed open. */
    succeeded: boolean;
    /** Transport-level failure detail, shown as the button's tooltip. */
    detail: string;
    /** Arm the confirmation dialog. Never restarts anything by itself. */
    request: () => void;
    /** Dismiss the dialog without restarting. */
    cancel: () => void;
    /** Run the restart. Only reachable from the confirming phase. */
    confirm: () => void;
    /** Return a failed seat to idle (each quick seat owns its own reset timer). */
    settle: () => void;
}
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
export declare function useRestartAction(): RestartAction;
