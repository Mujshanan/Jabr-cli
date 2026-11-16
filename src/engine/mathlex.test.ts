import { describe, expect, it } from "vitest";
import { renderAst } from "../interactive/ast-renderer";

describe("renderAst", () => {
  it("renders nested AST data as text nodes", () => {
    const tree = renderAst({
      kind: "Binary",
      value: {
        op: { kind: "Add" },
        left: { kind: "Integer", value: 2 },
        right: { kind: "Variable", value: "x" },
      },
    });

    expect(tree.textContent).toContain("Binary");
    expect(tree.textContent).toContain("Add");
    expect(tree.textContent).toContain("Integer");
    expect(tree.textContent).toContain("x");
  });

  it("does not interpret HTML-like values as markup", () => {
    const tree = renderAst({ kind: "Variable", value: "<img src=x onerror=alert(1)>" });
    expect(tree.querySelector("img")).toBeNull();
    expect(tree.textContent).toContain("<img src=x");
  });
});
