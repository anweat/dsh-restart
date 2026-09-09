/** Prevent concurrent restart requests from scheduling duplicate helpers. */
export class RestartCoordinator {
    current;
    claim(schedule) {
        if (this.current !== undefined)
            return { fresh: false, value: this.current };
        const value = schedule();
        this.current = value;
        return { fresh: true, value };
    }
    release(value) {
        if (Object.is(this.current, value))
            this.current = undefined;
    }
}
