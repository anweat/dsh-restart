export interface RestartIdentity {
  pid: number
  startedAt: string
}

export interface RestartWaitOptions {
  fetchImpl?: typeof fetch
  isVisible?: () => boolean
  maxVisibleStableProbes?: number
  pollIntervalMs?: number
  signal?: AbortSignal
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>
}

export type RestartWaitResult = 'restarted' | 'stale'

const RESTART_URL = '/plugins/dsh-restart/restart'

class RestartProbeUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RestartProbeUnavailableError'
  }
}

function abortError(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

function defaultSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError(signal))
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(abortError(signal))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function parseRestartIdentity(value: unknown): RestartIdentity {
  const candidate = value as Partial<RestartIdentity> | null
  if (
    candidate === null
    || !Number.isInteger(candidate.pid)
    || Number(candidate.pid) <= 0
    || typeof candidate.startedAt !== 'string'
    || candidate.startedAt === ''
  ) {
    throw new Error('invalid restart identity')
  }
  return { pid: Number(candidate.pid), startedAt: candidate.startedAt }
}

async function fetchRestartIdentity(fetchImpl: typeof fetch, signal?: AbortSignal): Promise<RestartIdentity> {
  let response: Response
  try {
    response = await fetchImpl(RESTART_URL, {
      method: 'GET',
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new RestartProbeUnavailableError('identity probe unavailable', { cause: error })
  }
  if (!response.ok) throw new RestartProbeUnavailableError(`identity probe failed: HTTP ${response.status}`)
  return parseRestartIdentity(await response.json())
}

function identityChanged(before: RestartIdentity, after: RestartIdentity): boolean {
  return before.pid !== after.pid || before.startedAt !== after.startedAt
}

/** Restart DSH and wait until the process identity changes. */
export async function restartAndWait(options: RestartWaitOptions = {}): Promise<RestartWaitResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const isVisible = options.isVisible ?? (() => document.visibilityState === 'visible')
  const maxVisibleStableProbes = options.maxVisibleStableProbes ?? 90
  const pollIntervalMs = options.pollIntervalMs ?? 1000
  const sleep = options.sleep ?? defaultSleep
  const { signal } = options

  const baseline = await fetchRestartIdentity(fetchImpl, signal)
  const response = await fetchImpl(RESTART_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal,
  })
  if (!response.ok) throw new Error(`restart request failed: HTTP ${response.status}`)

  let visibleStableProbes = 0
  while (visibleStableProbes < maxVisibleStableProbes) {
    await sleep(pollIntervalMs, signal)
    let current: RestartIdentity
    try {
      current = await fetchRestartIdentity(fetchImpl, signal)
    } catch (error) {
      if (!(error instanceof RestartProbeUnavailableError)) throw error
      continue
    }
    if (identityChanged(baseline, current)) return 'restarted'
    if (isVisible()) visibleStableProbes += 1
  }
  return 'stale'
}
