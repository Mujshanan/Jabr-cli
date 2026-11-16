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
    expect(model.children[0]?.id).toBe("root.value");
    expect(model.children[0]?.children[0]?.id).toBe("root.value.op");
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

  it("limits pathological nesting without throwing", () => {
    let value: unknown = "leaf";
    for (let index = 0; index < 90; index += 1) value = { child: value };
    const model = buildAstTreeModel(value);
    let current = model;
    while (current.children.length > 0) current = current.children[0]!;
    expect(current.kind).toBe("DepthLimit");
  });
});
