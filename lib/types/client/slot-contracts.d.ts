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
        /**
         * Action row at the sidebar foot. The core sidebar renders these directly
         * ABOVE its own Settings row, in registration order.
         */
        'sidebar.footer.action': {
            kind: 'list';
            scope: 'root';
            owner: SidebarFooterActionOwnerProps;
        };
        /** Session action beside the conversation title. */
        'conversation.session.header.actions': {
            kind: 'list';
            scope: 'session';
            owner: ConversationHeaderActionOwnerProps;
        };
    }
}
/** Owner share of a settings section entry. */
export interface SettingsSectionOwnerProps {
    /** Close the settings panel (the shell owns the open state). */
    close: () => void;
}
/** Owner share the sidebar supplies to each footer action entry. */
export interface SidebarFooterActionOwnerProps {
    /** True while the sidebar is expanded; false on the collapsed icon rail. */
    wide: boolean;
}
/** Owner share of a conversation header action (entries receive no extra values). */
export interface ConversationHeaderActionOwnerProps {
    /** Marker field: header action entries receive no owner-specific values. */
    children?: never;
}
