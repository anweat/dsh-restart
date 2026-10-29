interface RestartHelperProcess {
    once(event: 'spawn', listener: () => void): unknown;
    once(event: 'error', listener: (error: Error) => void): unknown;
    unref(): void;
}
interface RestartHelperLifecycleOptions {
    delayMs: number;
    exit: () => void;
    onError: (error: Error) => void;
    schedule?: (callback: () => void, delayMs: number) => unknown;
}
/** Keep the old DSH alive unless Node confirms that its detached helper spawned. */
export declare function superviseRestartHelper(helper: RestartHelperProcess, options: RestartHelperLifecycleOptions): void;
interface ExitingProcess {
    readonly pid: number;
    readonly platform: string;
    listenerCount(event: 'SIGTERM'): number;
    kill(pid: number, signal: 'SIGTERM'): unknown;
    exit(code: number): unknown;
}
/**
 * Leave the old DSH process for a restart. DSH 0.2.x installs a bounded
 * graceful shutdown on SIGTERM (it disposes the whole plugin tree, then
 * force-exits after 5s), so on POSIX the exit goes through it: sessions are
 * closed, MCP/LSP/terminal children are reaped and the listen socket is
 * released instead of being dropped by a bare `process.exit`. Windows has no
 * catchable SIGTERM and hosts without a handler would just die from the
 * signal, so both keep the immediate exit.
 */
export declare function exitForRestart(proc: ExitingProcess): void;
export {};
