import type { Context } from './context-types.ts';
/** Snapshot of one configuration form. */
export interface SettingsFormSnapshot {
    status?: string;
    writable?: boolean;
    value?: unknown;
}
/** The form of one profile entry, as a client settings service exposes it. */
export interface SettingsForm {
    getSnapshot(): SettingsFormSnapshot;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): unknown;
    unset(field: string): unknown;
}
/** The client configuration-forms service (DSH 0.1.7 `configForms`). */
export interface SettingsFormsService {
    get(entryId: string): SettingsForm;
}
/** The legacy per-namespace scope service (DSH 0.1.5 `settingsScope`). */
export interface LegacySettingsScopeService {
    bind(spec: {
        namespace: string;
    }): SettingsForm;
}
/** The settings surface one plugin page can read and write through. */
export interface SettingsSource {
    /** The form's current snapshot, or undefined while no service serves it. */
    snapshot(): SettingsFormSnapshot | undefined;
    /** Subscribe to form or availability changes; returns the unsubscribe. */
    subscribe(listener: () => void): () => void;
    /** Write one field through the bound form, when there is one. */
    set(field: string, value: unknown): void;
    /** Remove one field's user value, when there is a bound form. */
    unset(field: string): void;
    /** Drop the form subscription. */
    dispose(): void;
}
/**
 * Resolve the settings form for one profile entry, preferring the native
 * 0.1.7 service over the legacy scope.
 * @param ctx - the client cordis context.
 * @param entryId - the profile entry id whose configuration the page edits.
 * @returns a source the page can project, write through, and dispose.
 */
export declare function createSettingsSource(ctx: Context, entryId: string): SettingsSource;
