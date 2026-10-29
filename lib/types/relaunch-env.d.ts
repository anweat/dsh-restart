/**
 * The environment a relaunched DSH starts with.
 *
 * By the time a restart is requested `process.env` is no longer the
 * environment DSH was launched with: the launcher materialized the invoking
 * directory's and the Harness home's `.env` values into it, and
 * `dsh-http-proxy` publishes the resolved proxy policy through the proxy
 * variables (overwriting or deleting inherited ones). Passing that on would
 * make `.env` values look inherited to the next launch (the launch
 * environment's most trusted layer) and make the published proxy sticky even
 * after the proxy setting is changed. The launcher's frozen snapshot
 * (`ctx.launchEnvironment`) keeps the inherited layer separately, so the
 * relaunch uses exactly that: every current name is reset to its inherited
 * value or dropped when it was not inherited. The new process re-reads the
 * same `.env` files (same cwd and home) and republishes the proxy itself.
 */
/** The part of DSH's LaunchEnvironmentSnapshot this needs. */
export interface InheritedEnvironment {
    getFrom(name: string, sources: readonly 'process'[]): {
        value: string;
    } | undefined;
}
/**
 * @param current - this process's environment now.
 * @param inherited - the launcher's snapshot; absent outside the product CLI.
 * @returns the environment to relaunch with (current as-is without a snapshot).
 */
export declare function relaunchEnvironment(current: Readonly<Record<string, string | undefined>>, inherited: InheritedEnvironment | undefined): Record<string, string>;
/** Read the launcher's snapshot from a plugin context without depending on its package. */
export declare function inheritedEnvironmentOf(ctx: {
    get?: (name: string) => unknown;
}): InheritedEnvironment | undefined;
