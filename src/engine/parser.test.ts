import { describe, expect, it } from "vitest";
import { parseCommand } from "./parser";

describe("parseCommand", () => {
  it("parses a command without arguments", () => {
    expect(parseCommand("help")).toEqual({ name: "help", args: [], rawArgs: "" });
  });

  it("normalizes the command name", () => {
    expect(parseCommand("  HeLp  ")).toEqual({ name: "help", args: [], rawArgs: "" });
  });

  it("parses multiple arguments", () => {
    expect(parseCommand("echo hello world")).toEqual({
      name: "echo", args: ["hello", "world"], rawArgs: "hello world",
    });
  });

  it("keeps double-quoted text as one argument", () => {
    expect(parseCommand('open "my project file"')).toEqual({
      name: "open", args: ["my project file"], rawArgs: '"my project file"',
    });
  });

  it("supports single-quoted arguments", () => {
    expect(parseCommand("echo 'hello world'")).toEqual({
      name: "echo", args: ["hello world"], rawArgs: "'hello world'",
    });
  });

  it("preserves an explicitly empty quoted argument", () => {
    expect(parseCommand('echo ""')).toEqual({ name: "echo", args: [""], rawArgs: '""' });
  });

  it("supports escaped spaces", () => {
    expect(parseCommand("open my\\ file")).toEqual({
      name: "open", args: ["my file"], rawArgs: "my\\ file",
    });
  });

  it("treats apostrophes inside words as literal characters", () => {
    expect(parseCommand("echo don't")).toEqual({
      name: "echo", args: ["don't"], rawArgs: "don't",
    });
  });

  it("treats derivative notation as literal in raw math mode", () => {
    expect(parseCommand("math f'(x)", true)).toEqual({
      name: "math", args: [], rawArgs: "f'(x)",
    });
  });

  it("preserves transpose notation in raw math mode", () => {
    expect(parseCommand("math A'(x)", true)).toEqual({
      name: "math", args: [], rawArgs: "A'(x)",
    });
  });

  it("preserves raw LaTeX backslashes without tokenizing them", () => {
    expect(parseCommand("math-latex \\frac{1}{2}", true)).toEqual({
      name: "math-latex", args: [], rawArgs: "\\frac{1}{2}",
    });
  });

  it("preserves spaces, quotes, and backslashes in raw math input", () => {
    expect(parseCommand('math-latex \\text{a "quoted" value}', true)).toEqual({
      name: "math-latex", args: [], rawArgs: '\\text{a "quoted" value}',
    });
  });

  it("keeps legacy outer quotes in raw mode for compatibility", () => {
    expect(parseCommand('math-latex "\\frac{1}{2}"', true)).toEqual({
      name: "math-latex", args: [], rawArgs: '"\\frac{1}{2}"',
    });
  });

  it("returns an empty command for blank input", () => {
    expect(parseCommand("   ")).toEqual({ name: "", args: [], rawArgs: "" });
  });

  it("rejects an unclosed double quote for tokenized commands", () => {
    expect(() => parseCommand('echo "unfinished')).toThrow("Unclosed quote");
  });
});
