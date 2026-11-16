import type { Command } from "./types";

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    const name = command.name.trim().toLowerCase();
    if (!name) throw new Error("Command name cannot be empty.");
    if (this.commands.has(name)) throw new Error(`Command "${name}" is already registered.`);
    this.commands.set(name, { ...command, name });
  }

  get(name: string): Command | undefined {
    return this.commands.get(name.toLowerCase());
  }

  list(): Command[] {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
