interface RestartHelperProcess {
  once(event: 'spawn', listener: () => void): unknown
  once(event: 'error', listener: (error: Error) => void): unknown
  unref(): void
}

interface RestartHelperLifecycleOptions {
  delayMs: number
  exit: () => void
  onError: (error: Error) => void
  schedule?: (callback: () => void, delayMs: number) => unknown
}

/** Keep the old DSH alive unless Node confirms that its detached helper spawned. */
export function superviseRestartHelper(
  helper: RestartHelperProcess,
  options: RestartHelperLifecycleOptions,
): void {
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs))
  helper.once('spawn', () => { schedule(options.exit, options.delayMs) })
  helper.once('error', options.onError)
  helper.unref()
}
