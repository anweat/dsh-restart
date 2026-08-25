export interface RestartIdentity {
    pid: number;
    startedAt: string;
}
export interface RestartWaitOptions {
    fetchImpl?: typeof fetch;
    isVisible?: () => boolean;
    maxVisibleStableProbes?: number;
    pollIntervalMs?: number;
    signal?: AbortSignal;
    sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}
export type RestartWaitResult = 'restarted' | 'stale';
/** Restart DSH and wait until the process identity changes. */
export declare function restartAndWait(options?: RestartWaitOptions): Promise<RestartWaitResult>;
