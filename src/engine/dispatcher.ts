import { parseCommand } from "./parser";
import type { CommandRegistry } from "./registry";
import type { TerminalContext } from "./types";

export class CommandDispatcher {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly context: TerminalContext,
  ) {}

  async dispatch(input: string): Promise<void> {
    let parsed;
    try {
      parsed = parseCommand(input);
    } catch (error) {
      this.context.print(error instanceof Error ? error.message : "Could not parse command.", "error");
      return;
    }

    if (!parsed.name) return;

    const command = this.registry.get(parsed.name);
    if (!command) {
      this.context.print(`Unknown command: ${parsed.name}. Type "help" for available commands.`, "error");
      return;
    }

    try {
      await command.execute(parsed.args, this.context);
    } catch (error) {
      this.context.print(error instanceof Error ? error.message : "Command failed unexpectedly.", "error");
    }
  }
}
