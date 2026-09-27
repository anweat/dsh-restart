/**
 * The dsh-restart settings page: 设置 → DSH 重启.
 *
 * Registered into `settings.section`, which gives this plugin its own row in
 * the settings navigation (the 0.1.7 replacement for the per-plugin card list
 * that 0.1.5 rendered from `settings.plugin.item`) and a full page to lay out
 * its restart behaviour. Everything it edits is the host's own settings
 * namespace, so the values round-trip through settings.yaml.
 *
 * The restart button here goes through the same confirmation gate as the main
 * panel entries: this page can restart the process the page is running in.
 */
import { useEffect, useRef, useState } from 'react'
import type { RestartSectionProps } from './index.ts'
import { RestartConfirmDialog } from './RestartConfirmDialog.tsx'
import { consumeRestartCompleted } from './restart-marker.ts'
import { useRestartAction } from './restart-action.ts'
import { ensureStyles, styles as css } from './styles.ts'

/** How long the success note stays on the page after a restart. */
const SUCCESS_MS = 5000

/** The dsh-restart settings page. */
export function RestartSection(props: RestartSectionProps) {
  ensureStyles()
  const { t, set, clear, useDshRestart } = props
  const state = useDshRestart(snapshot => snapshot)
  const restart = useRestartAction()
  const [completed, setCompleted] = useState(consumeRestartCompleted)
  // The text field is backed by the host's settings document, which answers a
  // write asynchronously: a controlled input bound straight to that value drops
  // every keystroke the user makes before the echo arrives. Keep a local draft
  // while the field is being edited, write it debounced, and fall back to the
  // host's value once the echo matches.
  const [draft, setDraft] = useState<string | null>(null)
  const lastSent = useRef<string | null>(null)
  // Either this run reported success, or a manual refresh consumed the marker.
  const succeeded = completed || restart.succeeded

  useEffect(() => {
    if (!succeeded) return
    const timer = window.setTimeout(() => {
      setCompleted(false)
      restart.settle()
    }, SUCCESS_MS)
    return () => { window.clearTimeout(timer) }
  }, [succeeded])

  // The page is never empty: a host that has not served this entry's settings
  // namespace yet still gets the restart button (the reason this plugin
  // exists) plus an explicit note, instead of a blank panel the user cannot
  // tell apart from a broken install.
  const editable = state.available
  const disabled = !editable || !state.writable
  const busy = restart.phase === 'busy'

  const writeText = (field: string, value: string): void => {
    if (value.trim() === '') clear(field)
    else set(field, value.trim())
  }

  const promptValue = draft ?? state.continuePrompt
  const commitPrompt = (): void => {
    if (draft === null) return
    const next = draft.trim()
    if (next === state.continuePrompt) { setDraft(null); return }
    lastSent.current = next
    writeText('continuePrompt', next)
  }
  useEffect(() => {
    if (draft === null) return
    const next = draft.trim()
    if (next === state.continuePrompt) { lastSent.current = null; setDraft(null); return }
    if (lastSent.current === next) return
    const timer = window.setTimeout(() => {
      lastSent.current = next
      writeText('continuePrompt', next)
    }, 500)
    return () => { window.clearTimeout(timer) }
  }, [draft, state.continuePrompt])
  const status = restart.phase === 'failed'
    ? (restart.stale ? t('restartStale') : t('restartFailed'))
    : succeeded ? t('restartSucceeded') : t('restartHint')

  return (
    <div className={css.page}>
      <h2 className={css.pageTitle}>{t('title')}</h2>
      <p className={css.pageDescription}>{t('description')}</p>
      {editable ? null : <p className={css.readOnly} role="status">{t('settingsUnavailable')}</p>}
      {!editable || state.writable ? null : <p className={css.readOnly} role="status">{t('readOnly')}</p>}

      <div className={css.rows}>
        <label className={css.row + ' ' + css.toggleField}>
          <input
            className={css.checkbox}
            type="checkbox"
            checked={state.legacyRestart}
            disabled={disabled}
            onChange={event => { set('legacyRestart', event.currentTarget.checked) }}
          />
          <span className={css.toggleCopy}>
            <span className={css.label}>{t('legacyRestart')}</span>
            <span className={css.hint}>{t('legacyRestartHint')}</span>
          </span>
        </label>

        <label className={css.row + ' ' + css.field} htmlFor="dsh-restart-continue-prompt">
          <span className={css.label}>{t('continuePrompt')}</span>
          <input
            id="dsh-restart-continue-prompt"
            className={css.input}
            type="text"
            value={promptValue}
            disabled={disabled}
            onChange={event => { setDraft(event.currentTarget.value) }}
            onBlur={commitPrompt}
            onKeyDown={event => { if (event.key === 'Enter') commitPrompt() }}
          />
          <span className={css.hint}>{t('continuePromptHint')}</span>
        </label>
      </div>

      <div className={css.rows}>
        <p className={css.groupTitle}>{t('quickSection')}</p>
        <label className={css.row + ' ' + css.toggleField}>
          <input
            className={css.checkbox}
            type="checkbox"
            checked={state.quickRestartSidebar}
            disabled={disabled}
            onChange={event => { set('quickRestartSidebar', event.currentTarget.checked) }}
          />
          <span className={css.toggleCopy}>
            <span className={css.label}>{t('quickSidebar')}</span>
            <span className={css.hint}>{t('quickSidebarHint')}</span>
          </span>
        </label>

        <label className={css.row + ' ' + css.toggleField}>
          <input
            className={css.checkbox}
            type="checkbox"
            checked={state.quickRestartHeader}
            disabled={disabled}
            onChange={event => { set('quickRestartHeader', event.currentTarget.checked) }}
          />
          <span className={css.toggleCopy}>
            <span className={css.label}>{t('quickHeader')}</span>
            <span className={css.hint}>{t('quickHeaderHint')}</span>
          </span>
        </label>
      </div>

      <div className={css.footer}>
        <p className={restart.phase === 'failed' ? css.failed : css.actionHint} role="status" aria-live="polite">
          {busy ? t('restarting') : status}
        </p>
        <button type="button" className={css.restart} disabled={busy} aria-haspopup="dialog" onClick={restart.request}>
          {t(busy ? 'restarting' : 'restartNow')}
        </button>
      </div>

      {restart.phase === 'confirming'
        ? <RestartConfirmDialog t={t} busy={busy} onConfirm={restart.confirm} onCancel={restart.cancel} />
        : null}
    </div>
  )
}
