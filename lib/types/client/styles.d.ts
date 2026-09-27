/**
 * Stable local class names plus the single stylesheet the client half injects.
 *
 * Every colour/radius reads a DSH design token with a literal fallback, so the
 * plugin keeps rendering when a token is absent (it must work on the 0.1.5 line
 * it still declares as a peer, and on 0.1.7). Nothing here positions the plugin
 * against another plugin's DOM: the seats are ordinary list slots, and only the
 * confirmation dialog paints its own fixed layer (in a portal, above the app).
 */
export declare const styles: {
    readonly page: "dsh-restart-page";
    readonly pageTitle: "dsh-restart-page-title";
    readonly pageDescription: "dsh-restart-page-description";
    readonly readOnly: "dsh-restart-read-only";
    readonly rows: "dsh-restart-rows";
    readonly row: "dsh-restart-row";
    readonly field: "dsh-restart-field";
    readonly toggleField: "dsh-restart-toggle-field";
    readonly toggleCopy: "dsh-restart-toggle-copy";
    readonly groupTitle: "dsh-restart-group-title";
    readonly label: "dsh-restart-label";
    readonly hint: "dsh-restart-hint";
    readonly checkbox: "dsh-restart-checkbox";
    readonly input: "dsh-restart-input";
    readonly footer: "dsh-restart-footer";
    readonly actionHint: "dsh-restart-action-hint";
    readonly failed: "dsh-restart-failed";
    readonly restart: "dsh-restart-button";
    readonly quick: "dsh-restart-quick";
    readonly quickRail: "dsh-restart-quick-rail";
    readonly quickWide: "dsh-restart-quick-wide";
    readonly quickHeader: "dsh-restart-quick-header";
    readonly quickBusy: "dsh-restart-quick-busy";
    readonly quickFailed: "dsh-restart-quick-failed";
    readonly quickSpin: "dsh-restart-quick-spin";
    readonly quickText: "dsh-restart-quick-text";
    readonly confirmOverlay: "dsh-restart-confirm-overlay";
    readonly confirmPanel: "dsh-restart-confirm-panel";
    readonly confirmTitle: "dsh-restart-confirm-title";
    readonly confirmBody: "dsh-restart-confirm-body";
    readonly confirmActions: "dsh-restart-confirm-actions";
    readonly confirmCancel: "dsh-restart-confirm-cancel";
    readonly confirmRestart: "dsh-restart-confirm-restart";
};
/** Install the stylesheet once, under one id, without a second network asset. */
export declare function ensureStyles(): void;
