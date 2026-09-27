/**
 * The one-click restart entry, in whichever main-panel seat the user enabled.
 *
 * Two seats share this component: the sidebar footer rail (rendered by the core
 * sidebar directly above its own Settings row, so it never displaces another
 * plugin's entry) and the conversation header. Both are additive list slots, so
 * a second contributor stacks beside us instead of fighting for the cell.
 *
 * A seat renders null while its placement toggle is off: registrations stay
 * static, flip instantly with the setting, and a disabled seat never has to be
 * re-registered. The class names adapt to the seat — the sidebar rail is 36px
 * wide and icon-only, the expanded sidebar and the conversation header show the
 * label — because the owner, not this plugin, decides that geometry.
 */
import { useEffect, useRef } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RestartCardState } from './index.ts'
import type { SidebarFooterActionOwnerProps } from './slot-contracts.ts'
import { RestartConfirmDialog } from './RestartConfirmDialog.tsx'
import { useRestartAction } from './restart-action.ts'
import { ensureStyles, styles as css } from './styles.ts'

/** How long a failed attempt stays visible before the seat returns to idle. */
const RESET_MS = 8000

/** The inject face both quick seats consume. */
export interface QuickRestartProps extends PropsLocale<'restart.card'> {
  useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R
}

/** Sidebar footer rail seat: the core sidebar adds it above its Settings row. */
export interface SidebarQuickRestartProps extends SidebarFooterActionOwnerProps, QuickRestartProps {}

/** Icon-only on the collapsed rail, labelled on the expanded sidebar. */
export function SidebarQuickRestart({ wide, t, useDshRestart }: SidebarQuickRestartProps) {
  const enabled = useDshRestart(snapshot => snapshot.quickRestartSidebar)
  if (!enabled) return null
  return <QuickRestartButton variant={wide ? 'wide' : 'rail'} t={t} />
}

/** Conversation header seat, next to the session title and its other actions. */
export function HeaderQuickRestart({ t, useDshRestart }: QuickRestartProps) {
  const enabled = useDshRestart(snapshot => snapshot.quickRestartHeader)
  if (!enabled) return null
  return <QuickRestartButton variant="header" t={t} />
}

/** Geometry of one seat. */
export type QuickRestartVariant = 'rail' | 'wide' | 'header'

interface QuickRestartButtonProps {
  variant: QuickRestartVariant
  t: PropsLocale<'restart.card'>['t']
}

const VARIANT_CLASS = {
  rail: css.quickRail,
  wide: css.quickWide,
  header: css.quickHeader,
} as const

/** The actual button, plus its dialog — one gate instance per seat. */
export function QuickRestartButton({ variant, t }: QuickRestartButtonProps) {
  ensureStyles()
  const restart = useRestartAction()
  const resetTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
  }, [])

  useEffect(() => {
    // A failed or successful attempt both settle back to idle on their own.
    if (restart.phase !== 'failed' && !restart.succeeded) return
    resetTimer.current = window.setTimeout(() => {
      resetTimer.current = null
      restart.settle()
    }, RESET_MS)
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current)
        resetTimer.current = null
      }
    }
  }, [restart.phase, restart.succeeded])

  const busy = restart.phase === 'busy'
  const failed = restart.phase === 'failed'
  const succeeded = restart.succeeded
  const label = busy ? t('quickRestarting') : failed ? t('quickFailed') : succeeded ? t('quickSucceeded') : t('quickTitle')
  const className = [
    css.quick,
    VARIANT_CLASS[variant],
    busy ? css.quickBusy : '',
    failed ? css.quickFailed : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="dialog"
        title={failed && restart.detail !== '' ? label + ': ' + restart.detail : label}
        disabled={busy}
        onClick={restart.request}
      >
        <span aria-hidden="true" className={busy ? css.quickSpin : undefined}>{'\u21BB'}</span>
        {variant === 'rail' ? null : <span className={css.quickText}>{label}</span>}
      </button>
      {restart.phase === 'confirming'
        ? <RestartConfirmDialog t={t} busy={false} onConfirm={restart.confirm} onCancel={restart.cancel} />
        : null}
    </>
  )
}
