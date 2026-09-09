/** Prevent concurrent restart requests from scheduling duplicate helpers. */
export class RestartCoordinator<T> {
  private current: T | undefined

  claim(schedule: () => T): { fresh: boolean; value: T } {
    if (this.current !== undefined) return { fresh: false, value: this.current }
    const value = schedule()
    this.current = value
    return { fresh: true, value }
  }

  release(value: T): void {
    if (Object.is(this.current, value)) this.current = undefined
  }
}
