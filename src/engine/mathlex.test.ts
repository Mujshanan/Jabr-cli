import { describe, expect, it } from "vitest";
import { renderAst } from "../interactive/ast-renderer";

describe("renderAst", () => {
  it("renders nested AST data as an HTML tree", () => {
    const html = renderAst({
      kind: "Binary",
      value: {
        op: { kind: "Add" },
        left: { kind: "Integer", value: 2 },
        right: { kind: "Variable", value: "x" },
      },
    });

    expect(html).toContain('class="ast-tree"');
    expect(html).toContain("Binary");
    expect(html).toContain("Add");
    expect(html).toContain("Integer");
    expect(html).toContain("x");
    expect(html).toContain('data-ast-action="expand"');
    expect(html).toContain('data-ast-action="raw"');
    expect(html).toContain("<details");
    expect(html).toContain("ast-icon");
  });

  it("escapes HTML-like values", () => {
    const html = renderAst({ kind: "Variable", value: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
