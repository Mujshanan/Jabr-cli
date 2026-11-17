import { describe, expect, it, vi } from "vitest";
import {
  executeCommandScript,
  executeCommandSequence,
  parseCommandSequence,
} from "./sequence";

describe("parseCommandSequence", () => {
  it("splits semicolon and success-gated commands", () => {
    expect(parseCommandSequence('echo one; math "x + y" && ast "x + y"')).toEqual([
      { command: "echo one", condition: "always" },
      { command: 'math "x + y"', condition: "always" },
      { command: 'ast "x + y"', condition: "success" },
    ]);
  });

  it("preserves separators inside quoted arguments", () => {
    expect(parseCommandSequence('echo "a; b && c"')).toEqual([
      { command: 'echo "a; b && c"', condition: "always" },
    ]);
  });

  it("rejects unclosed quotes", () => {
    expect(() => parseCommandSequence('echo "unfinished')).toThrow("Unclosed quote");
  });

  it("ignores empty sequence segments", () => {
    expect(parseCommandSequence(" ; echo ready && ; ")).toEqual([
      { command: "echo ready", condition: "always" },
    ]);
  });
});

describe("executeCommandSequence", () => {
  it("runs commands sequentially", async () => {
    const order: string[] = [];
    const dispatch = vi.fn(async (command: string) => {
      order.push(command);
      return { ok: true };
    });

    const results = await executeCommandSequence("one; two && three", dispatch);

    expect(order).toEqual(["one", "two", "three"]);
    expect(results.map((result) => result.status)).toEqual(["success", "success", "success"]);
  });

  it("skips && commands after failure but continues after semicolon", async () => {
    const dispatch = vi.fn(async (command: string) => ({ ok: command !== "fail" }));
    const results = await executeCommandSequence("fail && skip; continue", dispatch);

    expect(dispatch.mock.calls.map(([command]) => command)).toEqual(["fail", "continue"]);
    expect(results.map((result) => result.status)).toEqual(["error", "skipped", "success"]);
  });
});

describe("executeCommandScript", () => {
  it("ignores blank lines and comments and stops on a failed line", async () => {
    const dispatch = vi.fn(async (command: string) => ({ ok: command !== "bad" }));
    const results = await executeCommandScript("# sample\n\none; two\nbad\nnever", dispatch);

    expect(dispatch.mock.calls.map(([command]) => command)).toEqual(["one", "two", "bad"]);
    expect(results.map((result) => result.status)).toEqual(["success", "success", "error"]);
  });
});
