const RESTART_URL = '/plugins/dsh-restart/restart';
class RestartProbeUnavailableError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'RestartProbeUnavailableError';
    }
}
function abortError(signal) {
    return signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}
function defaultSleep(delayMs, signal) {
    if (signal?.aborted)
        return Promise.reject(abortError(signal));
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            window.clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(abortError(signal));
        };
        const timer = window.setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, delayMs);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
function parseRestartIdentity(value) {
    const candidate = value;
    if (candidate === null
        || !Number.isInteger(candidate.pid)
        || Number(candidate.pid) <= 0
        || typeof candidate.startedAt !== 'string'
        || candidate.startedAt === '') {
        throw new Error('invalid restart identity');
    }
    return { pid: Number(candidate.pid), startedAt: candidate.startedAt };
}
async function fetchRestartIdentity(fetchImpl, signal) {
    let response;
    try {
        response = await fetchImpl(RESTART_URL, {
            method: 'GET',
            cache: 'no-store',
            signal,
        });
    }
    catch (error) {
        if (signal?.aborted)
            throw error;
        throw new RestartProbeUnavailableError('identity probe unavailable', { cause: error });
    }
    if (!response.ok)
        throw new RestartProbeUnavailableError(`identity probe failed: HTTP ${response.status}`);
    return parseRestartIdentity(await response.json());
}
async function frontendReady(fetchImpl, signal) {
    let response;
    try {
        response = await fetchImpl('/', {
            method: 'GET',
            cache: 'no-store',
            signal,
        });
    }
    catch (error) {
        if (signal?.aborted)
            throw error;
        throw new RestartProbeUnavailableError('frontend probe unavailable', { cause: error });
    }
    if (response.status === 401 || response.status === 403) {
        throw new Error(`restart recovery unauthorized: HTTP ${response.status}`);
    }
    return response.ok;
}
function identityChanged(before, after) {
    return before.pid !== after.pid || before.startedAt !== after.startedAt;
}
/** Restart DSH and wait until the process identity changes. */
export async function restartAndWait(options = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const isVisible = options.isVisible ?? (() => document.visibilityState === 'visible');
    const maxRecoveryProbes = options.maxRecoveryProbes ?? 120;
    const maxVisibleStableProbes = options.maxVisibleStableProbes ?? 90;
    const pollIntervalMs = options.pollIntervalMs ?? 1000;
    const sleep = options.sleep ?? defaultSleep;
    const { signal } = options;
    const baseline = await fetchRestartIdentity(fetchImpl, signal);
    const response = await fetchImpl(RESTART_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal,
    });
    if (!response.ok)
        throw new Error(`restart request failed: HTTP ${response.status}`);
    let visibleStableProbes = 0;
    let recoveryProbes = 0;
    while (visibleStableProbes < maxVisibleStableProbes) {
        await sleep(pollIntervalMs, signal);
        let current;
        try {
            current = await fetchRestartIdentity(fetchImpl, signal);
        }
        catch (error) {
            if (!(error instanceof RestartProbeUnavailableError))
                throw error;
            continue;
        }
        if (identityChanged(baseline, current)) {
            recoveryProbes += 1;
            try {
                if (await frontendReady(fetchImpl, signal))
                    return 'restarted';
            }
            catch (error) {
                if (!(error instanceof RestartProbeUnavailableError))
                    throw error;
            }
            if (recoveryProbes >= maxRecoveryProbes) {
                throw new Error('restarted process did not serve the authenticated frontend');
            }
            continue;
        }
        if (isVisible())
            visibleStableProbes += 1;
    }
    return 'stale';
}
