/**
 * Emit the JS source shared by the detached restart helper and watchdog.
 *
 * On Windows DSH needs a real-but-hidden console so later sandboxed PowerShell
 * children inherit it instead of flashing a new visible console. The launcher
 * therefore goes through Start-Process, with a Win32-quoted argument line kept
 * inside a base64 JSON payload so spaces, quotes, empty arguments, and Unicode
 * survive the JavaScript -> PowerShell boundary unchanged.
 */
export declare function relaunchHelperSource(): string;
