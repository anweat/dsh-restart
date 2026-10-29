/** Stable local class names; the plugin ships as one self-contained client.js. */
export const styles = {
    body: 'dsh-restart-body',
    description: 'dsh-restart-description',
    readOnly: 'dsh-restart-read-only', field: 'dsh-restart-field', toggleField: 'dsh-restart-toggle-field',
    toggleCopy: 'dsh-restart-toggle-copy', label: 'dsh-restart-label', hint: 'dsh-restart-hint',
    checkbox: 'dsh-restart-checkbox', input: 'dsh-restart-input', footer: 'dsh-restart-footer',
    actionHint: 'dsh-restart-action-hint', failed: 'dsh-restart-failed', restart: 'dsh-restart-button',
};
const STYLE_ID = 'dsh-restart-settings-card-styles';
/** Install card styles once without creating a second dynamically loaded asset. */
export function ensureStyles() {
    if (document.getElementById(STYLE_ID) !== null)
        return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.dsh-restart-body{flex-direction:column;display:flex}
.dsh-restart-description{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-read-only{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-field,.dsh-restart-toggle-field{display:flex;gap:6px;padding:12px 0}
.dsh-restart-field{flex-direction:column}.dsh-restart-toggle-field{align-items:flex-start;cursor:pointer}
.dsh-restart-field+.dsh-restart-field,.dsh-restart-field+.dsh-restart-toggle-field,.dsh-restart-toggle-field+.dsh-restart-field,.dsh-restart-toggle-field+.dsh-restart-toggle-field{border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-toggle-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-button:focus-visible,.dsh-restart-checkbox:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-checkbox{width:16px;height:16px;margin:2px 2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dsh-restart-checkbox:disabled{cursor:default;opacity:.5}
.dsh-restart-input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-restart-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.dsh-restart-footer{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-action-hint,.dsh-restart-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5}
.dsh-restart-action-hint{color:var(--dsw-alias-label-tertiary)}.dsh-restart-failed{color:var(--dsw-alias-label-error)}
.dsh-restart-button{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-button:disabled{opacity:.4;cursor:default}
@media(max-width:480px){.dsh-restart-footer{align-items:stretch;flex-direction:column}.dsh-restart-button{width:100%}}
`;
    document.head.append(style);
}
