import init, { parse_latex, parse_math } from "./wasm/jabr_mathlex";

export interface MathlexAstNode {
  readonly kind: string;
  readonly value: unknown;
  readonly annotations?: Readonly<Record<string, string>>;
}

type MathlexParser = (input: string) => string;

let initialization: Promise<unknown> | undefined;

async function ensureInitialized(): Promise<void> {
  if (!initialization) {
    initialization = init().catch((error: unknown) => {
      // Do not permanently cache a rejected initialization attempt.
      initialization = undefined;
      throw error;
    });
  }

  await initialization;
}

function decodeAst(json: string): MathlexAstNode {
  const ast: unknown = JSON.parse(json);

  if (
    typeof ast !== "object" ||
    ast === null ||
    !("kind" in ast) ||
    typeof ast.kind !== "string" ||
    !("value" in ast)
  ) {
    throw new Error("Mathlex returned an AST that does not match its documented wire format.");
  }

  return ast as MathlexAstNode;
}

async function parse(input: string, parser: MathlexParser): Promise<MathlexAstNode> {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new TypeError("A non-empty mathematical expression is required.");
  }

  await ensureInitialized();
  return decodeAst(parser(input));
}

/** Parse plain-text notation using Mathlex and return its JSON AST. */
export function parseMathExpression(input: string): Promise<MathlexAstNode> {
  return parse(input, parse_math);
}

/** Parse LaTeX notation using Mathlex and return its JSON AST. */
export function parseLatexExpression(input: string): Promise<MathlexAstNode> {
  return parse(input, parse_latex);
}
