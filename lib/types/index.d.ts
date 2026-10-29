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
 *   - relaunch: spawn a detached helper script (survives the parent's exit via
 *     `detached: true` + `stdio: 'ignore'` + `unref()`), which waits until the old
 *     process has exited (and so released the listen port), then spawns the new
 *     DSH (same argv + cwd, stdout/stderr appended to timestamped logs). The old
 *     process leaves after `delayMs` so the tool result can flush first, through
 *     DSH's own graceful SIGTERM shutdown where available (see exitForRestart).
 *   - the new DSH gets the environment DSH was launched with (relaunch-env.ts),
 *     not the current one with `.env` values and the published proxy mixed in.
 *   - as the main process of a systemd service no helper is used (it would die
 *     with the service cgroup); the service manager restarts DSH (supervisor.ts).
 *   - a "process index" file (`$DSH_HOME/dsh-process.json`) is still written at
 *     boot for external inspection (pid + cwd + command line).
 *
 * @module dsh-restart
 */
import type { Context, Volatile } from '@deepseek-ai/cordis';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
import z from '@deepseek-ai/schemastery';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'dsh-restart': {
            kind: 'dsh-restart';
        } & ContextFormed;
    }
}
export declare const name = "dsh-restart";
export declare const inject: string[];
/**
 * Plugin configuration. DSH 0.2.x derives the settings form from the exported
 * `Config` schema and hands the resolved config to `apply` as its second
 * argument. Volatile fields arrive as live references the settings form
 * updates in place, so reading `.get()` at use time always sees current
 * values; only volatile fields are editable through the form.
 */
interface RestartConfig {
    legacyRestart: Volatile<boolean>;
    /** Empty = follow the DSH Language setting (see defaultContinuePrompt). */
    continuePrompt: Volatile<string>;
    /** @deprecated Retained only so existing settings files remain readable. */
    watchdogEnabled: boolean;
    /** @deprecated The embedded watchdog is disabled and this value is ignored. */
    watchdogCooldownMs: number;
    /** @deprecated The embedded watchdog is disabled and this value is ignored. */
    watchdogPollMs: number;
}
/** DSH reads this export for the settings form and config validation. */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    legacyRestart: z<boolean, boolean, "volatile-defined">;
    continuePrompt: z<string, string, "volatile-defined">;
    watchdogEnabled: z<boolean, boolean, "defined">;
    watchdogCooldownMs: z<number, number, "defined">;
    watchdogPollMs: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    legacyRestart: z<boolean, boolean, "volatile-defined">;
    continuePrompt: z<string, string, "volatile-defined">;
    watchdogEnabled: z<boolean, boolean, "defined">;
    watchdogCooldownMs: z<number, number, "defined">;
    watchdogPollMs: z<number, number, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config?: RestartConfig): void;
export {};
