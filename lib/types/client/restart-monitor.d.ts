export interface RestartIdentity {
    pid: number;
    startedAt: string;
}
export interface RestartWaitOptions {
    fetchImpl?: typeof fetch;
    isVisible?: () => boolean;
    /** The UI's active locale, reported so the host can word the continue prompt. */
    locale?: () => string | undefined;
    maxRecoveryProbes?: number;
    maxVisibleStableProbes?: number;
    pollIntervalMs?: number;
    signal?: AbortSignal;
    sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}
export type RestartWaitResult = 'restarted' | 'stale';
/** Header carrying the browser UI's active locale to the host. */
export declare const LOCALE_HEADER = "x-dsh-locale";
/**
 * Tell the host which locale this UI shows. Fire-and-forget: the host keeps
 * the last one it heard and records it with a restart's resume marker.
 */
export declare function reportUiLocale(locale: string, fetchImpl?: typeof fetch): void;
/** Restart DSH and wait until the process identity changes. */
export declare function restartAndWait(options?: RestartWaitOptions): Promise<RestartWaitResult>;
