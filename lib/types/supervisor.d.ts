/**
 * systemd awareness for the Node-native restart.
 *
 * When DSH is the main process of a systemd service, the detached relaunch
 * helper lives in the same cgroup and, under the default
 * KillMode=control-group, is killed the moment the old process exits. The
 * restart then only works if the unit itself brings DSH back, so the restart
 * defers to the service manager instead of racing it:
 *
 *   - Restart=always / on-success: just leave gracefully (exit code 0); the
 *     manager relaunches after RestartSec.
 *   - any other Restart= policy: ask the manager for a restart job
 *     (`systemctl restart --no-block <unit>`), which stops DSH with SIGTERM
 *     and starts it again whatever the policy is.
 *
 * Detection is conservative: it needs a systemd marker in the environment,
 * a cgroup that ends in a `.service`, and that unit's MainPID to be this very
 * process. A shell inside some other service (a terminal emulator's unit, a
 * tmux scope) or an ExecStart wrapper keeps the helper path.
 */
/** The systemd service this process is the main process of. */
export interface SystemdService {
    unit: string;
    /** Managed by the per-user manager (`systemctl --user`). */
    user: boolean;
    /** The unit's Restart= policy (no, always, on-success, on-failure, ...). */
    restart: string;
    /** The unit's KillMode= (control-group, mixed, process, none). */
    killMode: string;
}
export interface SystemctlResult {
    status: number | null;
    stdout: string;
}
export interface SystemdProbe {
    platform: string;
    pid: number;
    env: Readonly<Record<string, string | undefined>>;
    /** Contents of /proc/self/cgroup. */
    readCgroup: () => string;
    /** Run systemctl synchronously with these arguments. */
    systemctl: (args: readonly string[]) => SystemctlResult;
}
/** Opt-out for setups where the unit should not be involved (`DSH_RESTART_SYSTEMD=0`). */
export declare const SYSTEMD_OPT_OUT_ENV = "DSH_RESTART_SYSTEMD";
/** The `.service` owning this process's cgroup, from /proc/self/cgroup (v2 or v1 name=systemd). */
export declare function serviceFromCgroup(cgroup: string): {
    unit: string;
    user: boolean;
} | undefined;
/** Parse `systemctl show -p A -p B` output (`Key=value` lines). */
export declare function parseSystemctlShow(stdout: string): Record<string, string>;
/** The systemd service whose main process this is, or undefined when not (or unknown). */
export declare function detectSystemdService(probe: SystemdProbe): SystemdService | undefined;
/** How the restart is carried out under a detected service. */
export type SupervisedRestart = {
    kind: 'exit';
} | {
    kind: 'systemctl';
    args: string[];
};
/**
 * @param service - the detected unit.
 * @param privileged - whether this process may manage system units (root).
 * @returns the restart route, or an error when neither route can work: a
 *   system unit an unprivileged process cannot restart, under a policy that
 *   does not relaunch a clean exit (the helper would die with the cgroup and
 *   leave DSH down).
 */
export declare function supervisedRestart(service: SystemdService, privileged: boolean): SupervisedRestart | {
    kind: 'unsupported';
    reason: string;
};
/** Where the relaunched DSH's output goes under the service manager. */
export declare function journalCommand(service: SystemdService): string;
