import { describe, expect, it } from "vitest";
import { MAX_MERMAID_SOURCE_LENGTH, validateMermaidSource } from "./mermaid-renderer";

describe("validateMermaidSource", () => {
  it("trims valid diagram source", () => {
    expect(validateMermaidSource("  flowchart TD\n A-->B  ")).toBe("flowchart TD\n A-->B");
  });

  it("rejects empty source", () => {
    expect(() => validateMermaidSource("  ")).toThrow(/Usage: mermaid/);
  });

  it("enforces the source size limit", () => {
    expect(() => validateMermaidSource("a".repeat(MAX_MERMAID_SOURCE_LENGTH + 1))).toThrow(/character limit/);
  });
});
