/** In-memory command history for the terminal prompt. */
export class CommandHistory {
  private readonly entries: string[] = [];
  private static readonly MAX_ENTRIES = 100;
  private index = 0;
  private draft = "";

  add(command: string): void {
    const value = command.trim();
    if (!value) return;

    if (this.entries[this.entries.length - 1] !== value) {
      this.entries.push(value);
      if (this.entries.length > CommandHistory.MAX_ENTRIES) {
        this.entries.shift();
      }
    }
    this.index = this.entries.length;
    this.draft = "";
  }

  previous(currentValue: string): string {
    if (this.entries.length === 0) return currentValue;

    if (this.index === this.entries.length) {
      this.draft = currentValue;
    }

    this.index = Math.max(0, this.index - 1);
    return this.entries[this.index] ?? "";
  }

  next(): string {
    if (this.index >= this.entries.length) return this.draft;

    this.index += 1;
    return this.index === this.entries.length
      ? this.draft
      : this.entries[this.index] ?? "";
  }

  resetNavigation(): void {
    this.index = this.entries.length;
    this.draft = "";
  }

  get length(): number {
    return this.entries.length;
  }
}
