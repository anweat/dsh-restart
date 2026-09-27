/**
 * dsh-restart — permanent "restart the whole DeepSeek Harness" plugin.
 *
 * Registers a model-callable `restart_harness` tool and a `/restart` command
 * that reload plugins and configuration by restarting the DSH node process.
 *
 * Restart mechanism (Node-native):
 *   - discovery is unnecessary: this plugin runs INSIDE the DSH node process, so
 *     `process.pid` / `process.cwd()` / `process.execPath` / `process.execArgv` /
 *     `process.argv` are read directly.
 *   - relaunch: spawn a detached `node -e` helper (survives the parent's exit via
 *     `detached: true` + `stdio: 'ignore'` + `unref()`), which waits until the old
 *     process releases the listen port, then spawns the new DSH (same argv + cwd,
 *     stdout/stderr appended to timestamped logs). The old process then
 *     `process.exit(0)`s after `delayMs` so the tool result can flush first.
 *   - a "process index" file (`$DSH_HOME/dsh-process.json`) is still written at
 *     boot for external inspection (pid + cwd + command line).
 *
 * @module dsh-restart
 */
import type { Context } from '@deepseek-ai/cordis';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
export declare const name = "dsh-restart";
export declare const inject: string[];
/**
 * Producer-owned message source kind for the session-format v4 log.
 *
 * Before v4 a plugin-authored message could claim the shared `plugin` kind.
 * The v4 validator instead resolves `source.kind` against the producer-owned
 * kinds declared in this merge-extensible map and rejects every other value
 * with `SessionFormatError: format v4 message requires a producer-owned source
 * kind`, so — exactly like the harness's own producers — we declare ours here
 * rather than reusing someone else's identity.
 */
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'dsh-restart': {
            readonly kind: 'dsh-restart';
        } & ContextFormed;
    }
}
export declare function apply(ctx: Context): void;
