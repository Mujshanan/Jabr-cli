import { describe, expect, it, vi } from "vitest";
import { CommandDispatcher } from "./dispatcher";
import { CommandRegistry } from "./registry";
import type { TerminalContext } from "./types";

function createDispatcher() {
  const context: TerminalContext = {
    print: vi.fn(),
    printAst: vi.fn(),
    printMath: vi.fn(),
    clear: vi.fn(),
  };
  const registry = new CommandRegistry();
  registry.register({
    name: "ok",
    description: "Successful test command.",
    execute: vi.fn(),
  });
  registry.register({
    name: "fail",
    description: "Failing test command.",
    execute: () => { throw new Error("expected failure"); },
  });
  return { dispatcher: new CommandDispatcher(registry, context), context };
}

describe("CommandDispatcher automation", () => {
  it("dispatches a semicolon sequence in order", async () => {
    const { dispatcher } = createDispatcher();
    const result = await dispatcher.dispatch("ok; ok");
    expect(result.ok).toBe(true);
  });

  it("returns a failed outcome and skips && after command errors", async () => {
    const { dispatcher } = createDispatcher();
    const result = await dispatcher.dispatch("fail && missing");
    expect(result.ok).toBe(false);
  });

  it("runs script lines sequentially and stops on the first failed line", async () => {
    const { dispatcher, context } = createDispatcher();
    const result = await dispatcher.dispatchScript("# test\nok\nfail\nok");
    expect(result.ok).toBe(false);
    expect(context.print).toHaveBeenCalledWith(
      "Script stopped at command: fail",
      "error",
    );
  });
});
