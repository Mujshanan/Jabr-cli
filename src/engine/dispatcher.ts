import { parseCommand } from "./parser";
import { executeCommandScript, executeCommandSequence } from "./sequence";
import type { CommandRegistry } from "./registry";
import type { TerminalContext } from "./types";

export interface DispatchOutcome {
  readonly ok: boolean;
  readonly error?: string;
}

export class CommandDispatcher {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly context: TerminalContext,
  ) {}

  async dispatch(input: string): Promise<DispatchOutcome> {
    let results;
    try {
      results = await executeCommandSequence(input, (command) => this.dispatchSingle(command));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse command sequence.";
      this.context.print(message, "error");
      return { ok: false, error: message };
    }

    for (const result of results) {
      if (result.status === "skipped") {
        this.context.print(`Skipped after previous command failed: ${result.command}`, "muted");
      }
    }

    const failure = results.find((result) => result.status === "error");
    return failure ? { ok: false, error: failure.error } : { ok: true };
  }

  async dispatchScript(source: string): Promise<DispatchOutcome> {
    let results;
    try {
      results = await executeCommandScript(source, (command) => this.dispatchSingle(command));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse command script.";
      this.context.print(message, "error");
      return { ok: false, error: message };
    }

    const failure = results.find((result) => result.status === "error");
    if (failure) {
      this.context.print(`Script stopped at command: ${failure.command}`, "error");
      return { ok: false, error: failure.error };
    }

    this.context.print(`Script completed (${results.length} command(s)).`, "success");
    return { ok: true };
  }

  private async dispatchSingle(input: string): Promise<DispatchOutcome> {
    let parsed;
    try {
      parsed = parseCommand(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse command.";
      this.context.print(message, "error");
      return { ok: false, error: message };
    }

    if (!parsed.name) return { ok: true };

    const command = this.registry.get(parsed.name);
    if (!command) {
      const message = `Unknown command: ${parsed.name}. Type "help" for available commands.`;
      this.context.print(message, "error");
      return { ok: false, error: message };
    }

    try {
      await command.execute(parsed.args, this.context);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed unexpectedly.";
      this.context.print(message, "error");
      return { ok: false, error: message };
    }
  }
}
