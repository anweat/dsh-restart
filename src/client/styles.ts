/**
 * Stable local class names plus the single stylesheet the client half injects.
 *
 * Every colour/radius reads a DSH design token with a literal fallback, so the
 * plugin keeps rendering when a token is absent (it must work on the 0.1.5 line
 * it still declares as a peer, and on 0.1.7). Nothing here positions the plugin
 * against another plugin's DOM: the seats are ordinary list slots, and only the
 * confirmation dialog paints its own fixed layer (in a portal, above the app).
 */
export const styles = {
  page: 'dsh-restart-page', pageTitle: 'dsh-restart-page-title', pageDescription: 'dsh-restart-page-description',
  readOnly: 'dsh-restart-read-only', rows: 'dsh-restart-rows', row: 'dsh-restart-row',
  field: 'dsh-restart-field', toggleField: 'dsh-restart-toggle-field', toggleCopy: 'dsh-restart-toggle-copy',
  groupTitle: 'dsh-restart-group-title', label: 'dsh-restart-label', hint: 'dsh-restart-hint',
  checkbox: 'dsh-restart-checkbox', input: 'dsh-restart-input', footer: 'dsh-restart-footer',
  actionHint: 'dsh-restart-action-hint', failed: 'dsh-restart-failed', restart: 'dsh-restart-button',
  quick: 'dsh-restart-quick', quickRail: 'dsh-restart-quick-rail', quickWide: 'dsh-restart-quick-wide',
  quickHeader: 'dsh-restart-quick-header', quickBusy: 'dsh-restart-quick-busy',
  quickFailed: 'dsh-restart-quick-failed', quickSpin: 'dsh-restart-quick-spin', quickText: 'dsh-restart-quick-text',
  confirmOverlay: 'dsh-restart-confirm-overlay', confirmPanel: 'dsh-restart-confirm-panel',
  confirmTitle: 'dsh-restart-confirm-title', confirmBody: 'dsh-restart-confirm-body',
  confirmActions: 'dsh-restart-confirm-actions', confirmCancel: 'dsh-restart-confirm-cancel',
  confirmRestart: 'dsh-restart-confirm-restart',
} as const

const STYLE_ID = 'dsh-restart-client-styles'

const SHEET = `
.dsh-restart-page{display:flex;flex-direction:column;width:100%}
.dsh-restart-page-title{margin:4px 0 0;font-size:16px;font-weight:500;line-height:24px;color:var(--dsw-alias-label-primary)}
.dsh-restart-page-description{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-read-only{margin:8px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-rows{display:flex;flex-direction:column;margin-top:12px}
.dsh-restart-rows>.dsh-restart-row+.dsh-restart-row{border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-group-title{margin:0;padding:16px 0 0;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsh-restart-field,.dsh-restart-toggle-field{display:flex;gap:6px;padding:14px 0}
.dsh-restart-field{flex-direction:column}
.dsh-restart-toggle-field{align-items:flex-start;cursor:pointer}
.dsh-restart-toggle-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-label{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-restart-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-checkbox{width:16px;height:16px;margin:2px 2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dsh-restart-checkbox:disabled{cursor:default;opacity:.5}
.dsh-restart-input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-restart-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.dsh-restart-footer{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-action-hint,.dsh-restart-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:18px}
.dsh-restart-action-hint{color:var(--dsw-alias-label-tertiary)}.dsh-restart-failed{color:var(--dsw-alias-label-error)}
.dsh-restart-button{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-button:disabled{opacity:.4;cursor:default}
.dsh-restart-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@media(max-width:480px){.dsh-restart-footer{align-items:stretch;flex-direction:column}.dsh-restart-button{width:100%}}
.dsh-restart-quick{appearance:none;border:0;background:none;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0;border-radius:8px;transition:background .16s,color .16s}
.dsh-restart-quick:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-4))}
.dsh-restart-quick:hover{color:var(--dsw-alias-label-primary)}
.dsh-restart-quick:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-quick:disabled{opacity:.5;cursor:default}
.dsh-restart-quick-rail{width:36px;height:36px;margin:0 auto;border-radius:50%;font-size:17px;line-height:1}
.dsh-restart-quick-wide{width:auto;height:32px;margin:0;padding:0 10px;border-radius:8px;justify-content:flex-start;font-size:13px;line-height:1}
.dsh-restart-quick-header{height:28px;padding:0 8px;border-radius:var(--dsw-radius-sm,8px);font-size:13px;line-height:1}
.dsh-restart-quick-failed{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-error))}
.dsh-restart-quick-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes dsh-restart-quick-turn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.dsh-restart-quick-spin{display:inline-block;animation:dsh-restart-quick-turn 1s linear infinite}
@media(prefers-reduced-motion:reduce){.dsh-restart-quick-spin{animation:none}}
.dsh-restart-confirm-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45))}
.dsh-restart-confirm-panel{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:min(400px,calc(100vw - 48px));padding:20px;border-radius:var(--dsw-radius-panel,16px);background:var(--dsw-alias-bg-layer-2,#1f2023);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.4))}
.dsh-restart-confirm-title{margin:0;font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-restart-confirm-body{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-confirm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.dsh-restart-confirm-cancel{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:none;color:var(--dsw-alias-label-primary)}
.dsh-restart-confirm-cancel:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-4))}
.dsh-restart-confirm-cancel:focus-visible,.dsh-restart-confirm-restart:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-confirm-restart{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-confirm-cancel:disabled,.dsh-restart-confirm-restart:disabled{opacity:.4;cursor:default}
`

/** Install the stylesheet once, under one id, without a second network asset. */
export function ensureStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = SHEET
  document.head.append(style)
}
