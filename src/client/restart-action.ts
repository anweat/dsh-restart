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
import { useEffect, useRef, useState } from 'react'
import { rememberRestartCompleted } from './restart-marker.ts'
import { restartAndWait } from './restart-monitor.ts'

/** Where the gate currently is. */
export type RestartActionPhase = 'idle' | 'confirming' | 'busy' | 'failed'

/** The only events any seat may dispatch. */
export type RestartActionEvent = 'request' | 'cancel' | 'confirm' | 'fail' | 'settle'

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
export function reduceRestartPhase(phase: RestartActionPhase, event: RestartActionEvent): RestartActionPhase {
  switch (event) {
    case 'request':
      return phase === 'busy' ? phase : 'confirming'
    case 'cancel':
      return phase === 'confirming' ? 'idle' : phase
    case 'confirm':
      return phase === 'confirming' ? 'busy' : phase
    case 'fail':
      return phase === 'busy' ? 'failed' : phase
    case 'settle':
      return phase === 'failed' ? 'idle' : phase
  }
}

/** Observable gate state plus the handlers every seat wires to its buttons. */
export interface RestartAction {
  phase: RestartActionPhase
  /** The Host answered, but the process identity never changed. */
  stale: boolean
  /** The new process answered: the restart succeeded and this page stayed open. */
  succeeded: boolean
  /** Transport-level failure detail, shown as the button's tooltip. */
  detail: string
  /** Arm the confirmation dialog. Never restarts anything by itself. */
  request: () => void
  /** Dismiss the dialog without restarting. */
  cancel: () => void
  /** Run the restart. Only reachable from the confirming phase. */
  confirm: () => void
  /** Return a failed seat to idle (each quick seat owns its own reset timer). */
  settle: () => void
}

interface GateState {
  phase: RestartActionPhase
  stale: boolean
  detail: string
  succeeded: boolean
}

const IDLE: GateState = { phase: 'idle', stale: false, detail: '', succeeded: false }

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
export function useRestartAction(): RestartAction {
  const [state, setState] = useState<GateState>(IDLE)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])

  const transition = (event: RestartActionEvent): void => {
    setState(current => {
      const next = reduceRestartPhase(current.phase, event)
      if (next === current.phase) {
        // `settle` on an idle seat is how a component clears the success note.
        return current.succeeded ? { ...current, succeeded: false } : current
      }
      return { phase: next, stale: false, detail: '', succeeded: false }
    })
  }

  const confirm = (): void => {
    if (state.phase !== 'confirming') return
    const aborter = new AbortController()
    controller.current = aborter
    setState({ phase: 'busy', stale: false, detail: '', succeeded: false })
    void restartAndWait({ signal: aborter.signal, isVisible: () => document.visibilityState === 'visible' })
      .then((outcome) => {
        if (aborter.signal.aborted) return
        if (outcome === 'restarted') {
          // The shell reconnects on its own, so this page stays open: this run
          // is the one that can report success, and no reload is needed.
          rememberRestartCompleted()
          setState({ phase: 'idle', stale: false, detail: '', succeeded: true })
          return
        }
        setState({ phase: reduceRestartPhase('busy', 'fail'), stale: true, detail: '', succeeded: false })
      })
      .catch((error: unknown) => {
        if (aborter.signal.aborted) return
        setState({
          phase: reduceRestartPhase('busy', 'fail'),
          stale: false,
          detail: error instanceof Error ? error.message : String(error),
          succeeded: false,
        })
      })
      .finally(() => { if (controller.current === aborter) controller.current = null })
  }

  return {
    ...state,
    request: () => { transition('request') },
    cancel: () => { transition('cancel') },
    confirm,
    settle: () => { transition('settle') },
  }
}
