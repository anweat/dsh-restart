/** Record a successful restart so a later page load can still report it. */
export declare function rememberRestartCompleted(): void;
/** Read and clear the marker; true on the first load after a successful restart. */
export declare function consumeRestartCompleted(): boolean;
