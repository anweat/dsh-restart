/**
 * Local slot contract for the surface this plugin contributes to.
 *
 * The owning package is not a dependency of this plugin, and 0.1.5 (the line the
 * peer range still starts at) declares an empty SlotMap, so the key is declared
 * here with the shape 0.1.7 renders. Merging cannot conflict: this program never
 * pulls in the owner package's own declarations.
 *
 * It is an additive list slot. That is the whole conflict story: the plugin never
 * registers a 'single' or 'keyed' cell, so it can neither shadow another plugin
 * nor be shadowed by one — it stacks.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * One page in the settings navigation. 0.1.7's replacement for the
     * per-plugin card list that 0.1.5 rendered from 'settings.plugin.item'.
     */
    'settings.section': {
      kind: 'list'
      scope: 'root'
      owner: SettingsSectionOwnerProps
    }
  }
}

/** Owner share of a settings section entry. */
export interface SettingsSectionOwnerProps {
  /** Close the settings panel (the shell owns the open state). */
  close: () => void
}
