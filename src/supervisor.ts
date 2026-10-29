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
  unit: string
  /** Managed by the per-user manager (`systemctl --user`). */
  user: boolean
  /** The unit's Restart= policy (no, always, on-success, on-failure, ...). */
  restart: string
  /** The unit's KillMode= (control-group, mixed, process, none). */
  killMode: string
}

export interface SystemctlResult {
  status: number | null
  stdout: string
}

export interface SystemdProbe {
  platform: string
  pid: number
  env: Readonly<Record<string, string | undefined>>
  /** Contents of /proc/self/cgroup. */
  readCgroup: () => string
  /** Run systemctl synchronously with these arguments. */
  systemctl: (args: readonly string[]) => SystemctlResult
}

/** Opt-out for setups where the unit should not be involved (`DSH_RESTART_SYSTEMD=0`). */
export const SYSTEMD_OPT_OUT_ENV = 'DSH_RESTART_SYSTEMD'

/** The `.service` owning this process's cgroup, from /proc/self/cgroup (v2 or v1 name=systemd). */
export function serviceFromCgroup(cgroup: string): { unit: string; user: boolean } | undefined {
  const lines = cgroup.split('\n')
  const line = lines.find(entry => entry.startsWith('0::')) ?? lines.find(entry => entry.includes(':name=systemd:'))
  if (line === undefined) return undefined
  const cgroupPath = line.slice(line.indexOf(':', line.indexOf(':') + 1) + 1).trim()
  const segments = cgroupPath.split('/').filter(segment => segment !== '')
  const unit = segments.at(-1)
  if (unit === undefined || !unit.endsWith('.service') || /^user@\d+\.service$/.test(unit)) return undefined
  return { unit, user: segments.slice(0, -1).some(segment => /^user@\d+\.service$/.test(segment)) }
}

/** Parse `systemctl show -p A -p B` output (`Key=value` lines). */
export function parseSystemctlShow(stdout: string): Record<string, string> {
  const properties: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const separator = line.indexOf('=')
    if (separator > 0) properties[line.slice(0, separator)] = line.slice(separator + 1).trim()
  }
  return properties
}

/** The systemd service whose main process this is, or undefined when not (or unknown). */
export function detectSystemdService(probe: SystemdProbe): SystemdService | undefined {
  if (probe.platform !== 'linux') return undefined
  if (probe.env[SYSTEMD_OPT_OUT_ENV] === '0') return undefined
  // systemd sets INVOCATION_ID for every unit process (v232+), NOTIFY_SOCKET for Type=notify.
  if (!probe.env.INVOCATION_ID && !probe.env.NOTIFY_SOCKET) return undefined
  let owner: { unit: string; user: boolean } | undefined
  try {
    owner = serviceFromCgroup(probe.readCgroup())
  } catch {
    return undefined
  }
  if (owner === undefined) return undefined
  let shown: SystemctlResult
  try {
    shown = probe.systemctl([
      ...owner.user ? ['--user'] : [],
      'show', owner.unit, '-p', 'MainPID', '-p', 'Restart', '-p', 'KillMode',
    ])
  } catch {
    return undefined
  }
  if (shown.status !== 0) return undefined
  const properties = parseSystemctlShow(shown.stdout)
  if (Number(properties.MainPID) !== probe.pid) return undefined
  return {
    unit: owner.unit,
    user: owner.user,
    restart: properties.Restart ?? 'no',
    killMode: properties.KillMode ?? 'control-group',
  }
}

/** How the restart is carried out under a detected service. */
export type SupervisedRestart =
  | { kind: 'exit' }
  | { kind: 'systemctl'; args: string[] }

/** Restart= policies under which a clean exit (code 0 after SIGTERM) is relaunched. */
const RESTARTS_ON_CLEAN_EXIT = new Set(['always', 'on-success'])

/**
 * @param service - the detected unit.
 * @param privileged - whether this process may manage system units (root).
 * @returns the restart route, or an error when neither route can work: a
 *   system unit an unprivileged process cannot restart, under a policy that
 *   does not relaunch a clean exit (the helper would die with the cgroup and
 *   leave DSH down).
 */
export function supervisedRestart(service: SystemdService, privileged: boolean): SupervisedRestart | { kind: 'unsupported'; reason: string } {
  if (RESTARTS_ON_CLEAN_EXIT.has(service.restart)) return { kind: 'exit' }
  if (!service.user && !privileged) {
    return {
      kind: 'unsupported',
      reason: `DSH runs as system unit ${service.unit} with Restart=${service.restart}, which does not relaunch a clean exit, `
        + `and this process may not restart system units; run \`systemctl restart ${service.unit}\` or set Restart=always`,
    }
  }
  return { kind: 'systemctl', args: [...service.user ? ['--user'] : [], 'restart', '--no-block', service.unit] }
}

/** Where the relaunched DSH's output goes under the service manager. */
export function journalCommand(service: SystemdService): string {
  return `journalctl ${service.user ? '--user ' : ''}-u ${service.unit}`
}
