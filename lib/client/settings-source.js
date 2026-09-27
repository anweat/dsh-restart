function isFormsService(value) {
    return typeof value === 'object' && value !== null && typeof value.get === 'function';
}
function isLegacyScope(value) {
    return typeof value === 'object' && value !== null && typeof value.bind === 'function';
}
/**
 * Resolve the settings form for one profile entry, preferring the native
 * 0.1.7 service over the legacy scope.
 * @param ctx - the client cordis context.
 * @param entryId - the profile entry id whose configuration the page edits.
 * @returns a source the page can project, write through, and dispose.
 */
export function createSettingsSource(ctx, entryId) {
    const listeners = new Set();
    let form;
    let unsubscribeForm;
    const notify = () => {
        for (const listener of [...listeners])
            listener();
    };
    const attach = (next) => {
        if (next === undefined || next === form)
            return;
        unsubscribeForm?.();
        unsubscribeForm = undefined;
        form = next;
        try {
            unsubscribeForm = next.subscribe(notify);
        }
        catch {
            unsubscribeForm = undefined;
        }
        notify();
    };
    // Native 0.1.7 first: the shared configuration forms service.
    try {
        ctx.inject(['configForms'], (formsCtx) => {
            const service = formsCtx.configForms;
            if (!isFormsService(service))
                return;
            try {
                attach(service.get(entryId));
            }
            catch {
                // An entry the deployment does not serve leaves the legacy path open.
            }
        });
    }
    catch {
        // A host without the service simply keeps the quiet state.
    }
    // Legacy 0.1.5 hosts (and the compatibility services some deployments mount).
    try {
        ctx.inject(['settingsScope'], (scopeCtx) => {
            if (form !== undefined)
                return;
            const service = scopeCtx.settingsScope;
            if (!isLegacyScope(service))
                return;
            try {
                attach(service.bind({ namespace: entryId }));
            }
            catch {
                // Nothing to bind: the page reports the namespace as unresolved.
            }
        });
    }
    catch {
        // Same as above: the absence of a settings service is not a failure.
    }
    return {
        snapshot() {
            try {
                return form?.getSnapshot();
            }
            catch {
                return undefined;
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        set(field, value) {
            try {
                void form?.set(field, value);
            }
            catch {
                // A refused write leaves the previous value on screen.
            }
        },
        unset(field) {
            try {
                void form?.unset(field);
            }
            catch {
                // Same as above.
            }
        },
        dispose() {
            unsubscribeForm?.();
            unsubscribeForm = undefined;
            form = undefined;
            listeners.clear();
        },
    };
}
