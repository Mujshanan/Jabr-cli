import { describe, expect, it } from "vitest";
import { buildAstTreeModel } from "./ast-renderer";

describe("buildAstTreeModel", () => {
  it("normalizes a nested Mathlex AST into stable path-keyed nodes", () => {
    const model = buildAstTreeModel({
      kind: "Binary",
      value: {
        op: { kind: "Add" },
        left: { kind: "Integer", value: 2 },
        right: { kind: "Variable", value: "x" },
      },
    });

    expect(model.id).toBe("root");
    expect(model.kind).toBe("Binary");
    expect(model.children[0]?.id).toBe("root/value");
    expect(model.children[0]?.children[0]?.id).toBe("root/value/op");
    expect(model.children[0]?.children[1]?.kind).toBe("Integer");
    expect(model.children[0]?.children[1]?.preview).toBe("2");
    expect(model.children[0]?.children[2]?.kind).toBe("Variable");
    expect(model.children[0]?.children[2]?.preview).toBe('"x"');
  });

  it("preserves arrays, scalar values, and unknown node kinds", () => {
    const model = buildAstTreeModel({
      kind: "CivilKitFutureNode",
      items: [1, "two", null],
    });

    expect(model.kind).toBe("CivilKitFutureNode");
    expect(model.children[0]?.kind).toBe("Array");
    expect(model.children[0]?.children.map((node) => node.preview)).toEqual(["1", '"two"', "null"]);
  });

  it("escapes path segments so keys cannot collide", () => {
    const model = buildAstTreeModel({
      "a.b": 1,
      a: { b: 2 },
      "x/y": 3,
    });
    expect(model.children.map((node) => node.id)).toEqual(["root/a.b", "root/a", "root/x~1y"]);
    expect(model.children[1]?.children[0]?.id).toBe("root/a/b");
  });

  it("keeps source spans as node metadata rather than AST children", () => {
    const model = buildAstTreeModel({
      kind: "Binary",
      span: { start: 0, end: 5, unit: "utf16" },
      value: {
        left: { kind: "Integer", value: 12, span: { start: 0, end: 2, unit: "utf16" } },
        right: { kind: "Variable", value: "x", span: { start: 4, end: 5, unit: "utf16" } },
      },
    });
    expect(model.span).toEqual({ start: 0, end: 5, unit: "utf16" });
    expect(model.children.map((node) => node.label)).toEqual(["Value"]);
    expect(model.children[0]?.children[0]?.span).toEqual({ start: 0, end: 2, unit: "utf16" });
    expect(model.children[0]?.children[1]?.span).toEqual({ start: 4, end: 5, unit: "utf16" });
  });

  it("rejects invalid source spans", () => {
    const model = buildAstTreeModel({
      kind: "Variable",
      span: { start: 5, end: 2, unit: "utf16" },
      value: "x",
    });
    expect(model.span).toBeUndefined();
  });

  it("limits pathological nesting without throwing", () => {
    let value: unknown = "leaf";
    for (let index = 0; index < 90; index += 1) value = { child: value };
    const model = buildAstTreeModel(value);
    let current = model;
    while (current.children.length > 0) current = current.children[0]!;
    expect(current.kind).toBe("DepthLimit");
  });
});
