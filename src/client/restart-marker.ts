/**
 * Restart-completion marker.
 *
 * A restart no longer reloads the page: the run that arranged it reports success
 * from its own React state. The marker covers the one case React state cannot —
 * a manual refresh right after a restart, whose fresh run would otherwise have
 * nothing to report. It is written on success and consumed once.
 */
const RESTART_COMPLETED_KEY = 'dsh-restart:completed'

/** Record a successful restart so a later page load can still report it. */
export function rememberRestartCompleted(): void {
  try {
    sessionStorage.setItem(RESTART_COMPLETED_KEY, '1')
  } catch {
    // A blocked sessionStorage only costs the confirmation message.
  }
}

/** Read and clear the marker; true on the first load after a successful restart. */
export function consumeRestartCompleted(): boolean {
  try {
    const completed = sessionStorage.getItem(RESTART_COMPLETED_KEY) === '1'
    if (completed) sessionStorage.removeItem(RESTART_COMPLETED_KEY)
    return completed
  } catch {
    return false
  }
}
