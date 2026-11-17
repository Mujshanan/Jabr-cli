import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  initSync,
  parse_math,
  parse_latex,
  math_to_latex,
  latex_to_latex,
} from "../wasm/jabr_mathlex.js";

const wasmPath = new URL("../wasm/jabr_mathlex_bg.wasm", import.meta.url);
initSync({ module: readFileSync(wasmPath) });

const MAX_EXPRESSION_LENGTH = 10_000;

function expressionSchema() {
  return z.string().trim().min(1).max(MAX_EXPRESSION_LENGTH);
}

function parseAst(parser, expression) {
  const json = parser(expression);
  return JSON.parse(json);
}

function textResult(value) {
  return { content: [{ type: "text", text: value }] };
}

export function createJabrMcpServer() {
  const server = new McpServer({
    name: "jabr-math",
    version: "0.1.0",
  });

  server.registerTool(
    "jabr_parse_math",
    {
      description: "Parse plain-text mathematical notation with Jabr's Mathlex engine and return its AST.",
      inputSchema: z.object({ expression: expressionSchema() }),
    },
    async ({ expression }) => {
      const ast = parseAst(parse_math, expression);
      return textResult(JSON.stringify({ expression, ast }, null, 2));
    },
  );

  server.registerTool(
    "jabr_parse_latex",
    {
      description: "Parse a LaTeX mathematical expression with Jabr's Mathlex engine and return its AST.",
      inputSchema: z.object({ expression: expressionSchema() }),
    },
    async ({ expression }) => {
      const ast = parseAst(parse_latex, expression);
      return textResult(JSON.stringify({ expression, ast }, null, 2));
    },
  );

  server.registerTool(
    "jabr_math_to_latex",
    {
      description: "Parse plain-text mathematical notation and serialize its AST to normalized LaTeX.",
      inputSchema: z.object({ expression: expressionSchema() }),
    },
    async ({ expression }) => textResult(math_to_latex(expression)),
  );

  server.registerTool(
    "jabr_latex_to_latex",
    {
      description: "Parse LaTeX notation and serialize its AST back to normalized LaTeX.",
      inputSchema: z.object({ expression: expressionSchema() }),
    },
    async ({ expression }) => textResult(latex_to_latex(expression)),
  );

  server.registerTool(
    "jabr_capabilities",
    {
      description: "Describe the mathematical capabilities exposed by Jabr-math MCP.",
      inputSchema: z.object({}),
    },
    async () => textResult(JSON.stringify({
      product: "Jabr-math",
      parser: "Mathlex 0.4.2",
      capabilities: [
        "plain-text mathematical parsing",
        "LaTeX parsing",
        "AST inspection",
        "plain-text to LaTeX serialization",
        "LaTeX normalization",
      ],
      limitations: [
        "Parsing and serialization only; no symbolic or numerical evaluation.",
        "No operating-system shell or arbitrary code execution.",
      ],
    }, null, 2)),
  );

  return server;
}

async function main() {
  const server = createJabrMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // MCP stdio reserves stdout for protocol messages.
    console.error("Jabr MCP server failed:", error);
    process.exitCode = 1;
  });
}
