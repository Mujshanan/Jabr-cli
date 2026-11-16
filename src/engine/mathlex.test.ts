import { beforeEach, describe, expect, it, vi } from "vitest";

const wasm = vi.hoisted(() => ({
  init: vi.fn(),
  parse_math: vi.fn(),
  parse_latex: vi.fn(),
  math_to_latex: vi.fn(),
  latex_to_latex: vi.fn(),
}));

vi.mock("./wasm/jabr_mathlex", () => ({
  default: wasm.init,
  parse_math: wasm.parse_math,
  parse_latex: wasm.parse_latex,
  math_to_latex: wasm.math_to_latex,
  latex_to_latex: wasm.latex_to_latex,
}));

import {
  latexExpressionToLatex,
  mathExpressionToLatex,
  parseLatexExpression,
  parseMathExpression,
} from "./mathlex";

const astJson = JSON.stringify({ kind: "Integer", value: 2 });

describe("Mathlex WASM adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wasm.init.mockResolvedValue(undefined);
    wasm.parse_math.mockReturnValue(astJson);
    wasm.parse_latex.mockReturnValue(astJson);
    wasm.math_to_latex.mockReturnValue("2");
    wasm.latex_to_latex.mockReturnValue("2");
  });

  it("passes plain-text expressions unchanged to the parser", async () => {
    await expect(parseMathExpression("2*x + 3")).resolves.toEqual({
      kind: "Integer",
      value: 2,
    });
    expect(wasm.parse_math).toHaveBeenCalledWith("2*x + 3");
  });

  it("preserves LaTeX backslashes", async () => {
    const expression = "\\\\frac{1}{2}";
    await parseLatexExpression(expression);
    expect(wasm.parse_latex).toHaveBeenCalledWith(expression);
  });

  it("preserves apostrophes in variable names", async () => {
    await parseMathExpression("x' + y''");
    expect(wasm.parse_math).toHaveBeenCalledWith("x' + y''");
  });

  it("rejects empty and whitespace-only input before initializing WASM", async () => {
    await expect(parseMathExpression("")).rejects.toThrow("non-empty");
    await expect(parseLatexExpression("   ")).rejects.toThrow("non-empty");
    expect(wasm.init).not.toHaveBeenCalled();
    expect(wasm.parse_math).not.toHaveBeenCalled();
    expect(wasm.parse_latex).not.toHaveBeenCalled();
  });

  it("propagates LaTeX parser errors", async () => {
    wasm.parse_latex.mockImplementation(() => {
      throw new Error("invalid LaTeX input");
    });

    await expect(parseLatexExpression("\\\\notACommand{")).rejects.toThrow(
      "invalid LaTeX input",
    );
  });

  it("serializes plain-text and LaTeX expressions", async () => {
    await expect(mathExpressionToLatex("2")).resolves.toBe("2");
    await expect(latexExpressionToLatex("2")).resolves.toBe("2");
  });
});
