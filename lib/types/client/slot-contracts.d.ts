declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /**
         * One page in the settings navigation. 0.1.7's replacement for the
         * per-plugin card list that 0.1.5 rendered from 'settings.plugin.item'.
         */
        'settings.section': {
            kind: 'list';
            scope: 'root';
            owner: SettingsSectionOwnerProps;
        };
    }
}
/** Owner share of a settings section entry. */
export interface SettingsSectionOwnerProps {
    /** Close the settings panel (the shell owns the open state). */
    close: () => void;
}
