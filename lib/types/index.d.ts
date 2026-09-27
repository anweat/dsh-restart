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
import z from '@deepseek-ai/schemastery';
export declare const name = "dsh-restart";
export declare const inject: string[];
/** Plugin configuration (editable via settings.yaml and the settings page). */
interface RestartConfig {
    legacyRestart: boolean;
    continuePrompt: string;
    /**
     * Show the one-click restart entry at the sidebar foot, above Settings.
     * A Web-UI preference, but it lives in the same settings namespace so the
     * settings page persists it through settings.yaml like every other field.
     */
    quickRestartSidebar: boolean;
    /** Show the one-click restart entry beside the conversation title. */
    quickRestartHeader: boolean;
    /** @deprecated Retained only so existing settings files remain readable. */
    watchdogEnabled: boolean;
    /** @deprecated The embedded watchdog is disabled and this value is ignored. */
    watchdogCooldownMs: number;
    /** @deprecated The embedded watchdog is disabled and this value is ignored. */
    watchdogPollMs: number;
}
/**
 * The plugin configuration schema, exported under the name the Host reads.
 *
 * DSH 0.1.7 serves a settings form only for a profile entry whose plugin
 * module exports `Config`: the settings provider resolves an entry through
 * `entry.fiber.runtime.Config` (`SettingsForms.schema`). Without this export
 * the entry has no settings namespace at all — the client configuration form
 * never reaches `ready`, the page renders its unavailable note, and no
 * settings.yaml section is offered for this plugin.
 */
export declare const Config: z<RestartConfig>;
export declare function apply(ctx: Context, config?: RestartConfig): void;
export {};
