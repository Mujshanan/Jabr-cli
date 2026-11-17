import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import initSync, {
  parse_math,
  parse_latex,
  math_to_latex,
  latex_to_latex,
} from "../wasm/jabr_mathlex.js";

initSync({
  module: readFileSync(new URL("../wasm/jabr_mathlex_bg.wasm", import.meta.url)),
});

test("plain-text parser returns the documented Mathlex AST shape", () => {
  const ast = JSON.parse(parse_math("2*x + sin(y)^2"));
  assert.equal(typeof ast.kind, "string");
  assert.ok(Object.hasOwn(ast, "value"));
});

test("LaTeX parser accepts fractions", () => {
  const ast = JSON.parse(parse_latex("\\frac{1}{2}"));
  assert.equal(typeof ast.kind, "string");
  assert.ok(Object.hasOwn(ast, "value"));
});

test("plain-text serializer returns LaTeX", () => {
  const latex = math_to_latex("2*x + 3");
  assert.equal(typeof latex, "string");
  assert.match(latex, /x/);
});

test("LaTeX serializer normalizes fractions", () => {
  const latex = latex_to_latex("\\frac{1}{2}");
  assert.match(latex, /\\\\frac/);
});

test("invalid expressions are rejected", () => {
  assert.throws(() => parse_math("2 + * 3"));
});
