import { describe, expect, it, vi } from "vitest";
import { CommandDispatcher } from "./dispatcher";
import { CommandRegistry } from "./registry";
import type { TerminalContext } from "./types";

function createContext(): TerminalContext {
  return {
    print: vi.fn(),
    printAst: vi.fn(),
    printMath: vi.fn(),
    clear: vi.fn(),
  };
}

describe("CommandDispatcher", () => {
  it("passes LaTeX command input through without shell tokenization", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();
    registry.register({
      name: "math-latex",
      description: "Parse LaTeX.",
      rawArguments: true,
      execute,
    });
    const context = createContext();
    const dispatcher = new CommandDispatcher(registry, context);

    await dispatcher.dispatch('math-latex "\\frac{1}{2}"');

    expect(execute).toHaveBeenCalledWith([], context, '"\\frac{1}{2}"');
  });

  it("allows apostrophes in ordinary command arguments", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();
    registry.register({
      name: "echo",
      description: "Print text.",
      execute,
    });
    const context = createContext();
    const dispatcher = new CommandDispatcher(registry, context);

    await dispatcher.dispatch("echo don't");

    expect(execute).toHaveBeenCalledWith(["don't"], context, "don't");
  });

  it("allows derivative notation in raw math commands", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();
    registry.register({
      name: "math",
      description: "Parse math.",
      rawArguments: true,
      execute,
    });
    const context = createContext();
    const dispatcher = new CommandDispatcher(registry, context);

    await dispatcher.dispatch("math f'(x)");

    expect(execute).toHaveBeenCalledWith([], context, "f'(x)");
  });
});
