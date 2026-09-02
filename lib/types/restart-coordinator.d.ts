/** Prevent concurrent restart requests from scheduling duplicate helpers. */
export declare class RestartCoordinator<T> {
    private current;
    claim(schedule: () => T): {
        fresh: boolean;
        value: T;
    };
    release(value: T): void;
}
