/**
 * The secondary confirmation every restart trigger goes through.
 *
 * The surface is rendered into `document.body` through a portal rather than
 * inline: the seats this plugin occupies (the 56px sidebar rail, the
 * conversation header) clip or transform their children, so an inline dialog
 * would be cut off or trapped under another plugin's overlay. The portal's
 * first child is a plain function component so the markup stays
 * server-renderable and testable.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { styles as css } from './styles.ts'

const TITLE_ID = 'dsh-restart-confirm-title'
const BODY_ID = 'dsh-restart-confirm-body'

/** Props of the dialog's markup. */
export interface ConfirmDialogSurfaceProps {
  t: TranslateNS<'restart.card'>
  /** The restart is already in flight; both buttons lock. */
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The confirmation markup on its own: no portal, no effects, no DOM access.
 * @param props - copy, busy state, and the two decisions.
 * @returns the dialog element tree.
 */
export function ConfirmDialogSurface({ t, busy, onConfirm, onCancel }: ConfirmDialogSurfaceProps) {
  return (
    <div className={css.confirmOverlay} role="presentation" onClick={onCancel}>
      <div
        className={css.confirmPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={BODY_ID}
        onClick={event => { event.stopPropagation() }}
      >
        <p className={css.confirmTitle} id={TITLE_ID}>{t('confirmTitle')}</p>
        <p className={css.confirmBody} id={BODY_ID}>{t('confirmBody')}</p>
        <div className={css.confirmActions}>
          <button type="button" className={css.confirmCancel} disabled={busy} onClick={onCancel}>{t('confirmCancel')}</button>
          <button type="button" className={css.confirmRestart} disabled={busy} autoFocus onClick={onConfirm}>{t('confirmRestart')}</button>
        </div>
      </div>
    </div>
  )
}

/** The mounted dialog: the surface, portalled to the document body, Escape-aware. */
export function RestartConfirmDialog(props: ConfirmDialogSurfaceProps) {
  const { onCancel } = props
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onCancel])
  return createPortal(<ConfirmDialogSurface {...props} />, document.body)
}
