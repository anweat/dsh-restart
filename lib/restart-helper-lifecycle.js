/** Keep the old DSH alive unless Node confirms that its detached helper spawned. */
export function superviseRestartHelper(helper, options) {
    const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    helper.once('spawn', () => { schedule(options.exit, options.delayMs); });
    helper.once('error', options.onError);
    helper.unref();
}
