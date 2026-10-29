/** Stable local class names; the plugin ships as one self-contained client.js. */
export declare const styles: {
    readonly body: "dsh-restart-body";
    readonly description: "dsh-restart-description";
    readonly readOnly: "dsh-restart-read-only";
    readonly field: "dsh-restart-field";
    readonly toggleField: "dsh-restart-toggle-field";
    readonly toggleCopy: "dsh-restart-toggle-copy";
    readonly label: "dsh-restart-label";
    readonly hint: "dsh-restart-hint";
    readonly checkbox: "dsh-restart-checkbox";
    readonly input: "dsh-restart-input";
    readonly footer: "dsh-restart-footer";
    readonly actionHint: "dsh-restart-action-hint";
    readonly failed: "dsh-restart-failed";
    readonly restart: "dsh-restart-button";
};
/** Install card styles once without creating a second dynamically loaded asset. */
export declare function ensureStyles(): void;
