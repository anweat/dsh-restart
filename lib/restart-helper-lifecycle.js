/** Keep the old DSH alive unless Node confirms that its detached helper spawned. */
export function superviseRestartHelper(helper, options) {
    const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    helper.once('spawn', () => { schedule(options.exit, options.delayMs); });
    helper.once('error', options.onError);
    helper.unref();
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
export function exitForRestart(proc) {
    if (proc.platform !== 'win32' && proc.listenerCount('SIGTERM') > 0) {
        proc.kill(proc.pid, 'SIGTERM');
        return;
    }
    proc.exit(0);
}
