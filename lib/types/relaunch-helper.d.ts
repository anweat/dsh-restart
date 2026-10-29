/**
 * Emit the JS source used by the detached restart helper.
 *
 * On Windows DSH needs a real-but-hidden console so later sandboxed PowerShell
 * children inherit it instead of flashing a new visible console. The launcher
 * therefore goes through Start-Process, with a Win32-quoted argument line kept
 * inside a base64 JSON payload so spaces, quotes, empty arguments, and Unicode
 * survive the JavaScript -> PowerShell boundary unchanged.
 *
 * The relaunch is gated on the old DSH process actually having exited
 * (`whenProcessExits`): a fixed sleep raced a slow graceful shutdown and could
 * start a second DSH while the first still held the listen port.
 */
export declare function relaunchHelperSource(): string;
export interface RestartHelperScriptOptions {
    /** Node argv of the DSH process to relaunch (execArgv + script + args). */
    argv: readonly string[];
    cwd: string;
    logOut: string;
    logErr: string;
    /** Where the script itself is written; it deletes this file once loaded. */
    selfPath: string;
    /** The DSH process that must be gone before the relaunch. */
    oldPid: number;
    /** When the old process is scheduled to leave. */
    delayMs: number;
    /** How long past `delayMs` to wait for it before giving up without a relaunch. */
    exitTimeoutMs: number;
}
/**
 * The complete detached helper script (CommonJS). It deletes its own file as
 * soon as it is loaded: a supervisor that kills the helper together with the
 * old process (systemd KillMode=control-group) would otherwise leave one stale
 * file per restart. It then waits for the old process to exit, and relaunches
 * DSH with the same argv + cwd, output appended to the log files. If the old
 * process outlives the timeout no second DSH is started.
 */
export declare function restartHelperScript(options: RestartHelperScriptOptions): string;
