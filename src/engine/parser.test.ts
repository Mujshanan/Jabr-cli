import { describe, expect, it } from "vitest";
import { parseCommand } from "./parser";

describe("parseCommand", () => {
  it("parses a command without arguments", () => {
    expect(parseCommand("help")).toEqual({ name: "help", args: [] });
  });

  it("normalizes the command name", () => {
    expect(parseCommand("  HeLp  ")).toEqual({ name: "help", args: [] });
  });

  it("parses multiple arguments", () => {
    expect(parseCommand("echo hello world")).toEqual({ name: "echo", args: ["hello", "world"] });
  });

  it("keeps quoted text as one argument", () => {
    expect(parseCommand('open "my project file"')).toEqual({ name: "open", args: ["my project file"] });
  });

  it("supports single quotes", () => {
    expect(parseCommand("echo 'hello world'")).toEqual({ name: "echo", args: ["hello world"] });
  });

  it("preserves an explicitly empty quoted argument", () => {
    expect(parseCommand('echo ""')).toEqual({ name: "echo", args: [""] });
  });

  it("supports escaped spaces", () => {
    expect(parseCommand("open my\\ file")).toEqual({ name: "open", args: ["my file"] });
  });

  it("returns an empty command for blank input", () => {
    expect(parseCommand("   ")).toEqual({ name: "", args: [] });
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCommand('echo "unfinished')).toThrow("Unclosed quote");
  });
});
