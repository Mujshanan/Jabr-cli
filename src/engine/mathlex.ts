import init, {
  latex_to_latex,
  math_to_latex,
  parse_latex,
  parse_math,
} from "./wasm/jabr_mathlex";

export interface MathlexAstNode {
  readonly kind: string;
  readonly value: unknown;
  readonly annotations?: Readonly<Record<string, string>>;
}

type MathlexParser = (input: string) => string;
type MathlexLatexSerializer = (input: string) => string;

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

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function decodeAst(json: string): MathlexAstNode {
  const ast: unknown = JSON.parse(json);

  if (
    typeof ast !== "object" ||
    ast === null ||
    !("kind" in ast) ||
    typeof ast.kind !== "string" ||
    !("value" in ast) ||
    ("annotations" in ast && !isStringRecord(ast.annotations))
  ) {
    throw new Error("Mathlex returned an AST that does not match its documented wire format.");
  }

  return ast as MathlexAstNode;
}

async function parse(input: string, parser: MathlexParser): Promise<MathlexAstNode> {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new TypeError("A non-empty mathematical expression is required.");
  }

  try {
    await ensureInitialized();
    return decodeAst(parser(input));
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

async function serializeLatex(
  input: string,
  serializer: MathlexLatexSerializer,
): Promise<string> {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new TypeError("A non-empty mathematical expression is required.");
  }

  try {
    await ensureInitialized();
    const latex = serializer(input);
    if (typeof latex !== "string" || latex.trim().length === 0) {
      throw new Error("Mathlex returned an empty LaTeX expression.");
    }
    return latex;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

/** Parse plain-text notation using Mathlex and return its JSON AST. */
export function parseMathExpression(input: string): Promise<MathlexAstNode> {
  return parse(input, parse_math);
}

/** Parse LaTeX notation using Mathlex and return its JSON AST. */
export function parseLatexExpression(input: string): Promise<MathlexAstNode> {
  return parse(input, parse_latex);
}

/** Parse plain-text notation and serialize its Mathlex AST to LaTeX. */
export function mathExpressionToLatex(input: string): Promise<string> {
  return serializeLatex(input, math_to_latex);
}

/** Parse LaTeX notation and serialize its Mathlex AST to normalized LaTeX. */
export function latexExpressionToLatex(input: string): Promise<string> {
  return serializeLatex(input, latex_to_latex);
}
