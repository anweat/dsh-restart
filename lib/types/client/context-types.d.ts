/** DSH client contracts consumed by the browser half. */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { zh } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'restart.card': keyof typeof zh;
    }
}
export type Context = ClientContext;
