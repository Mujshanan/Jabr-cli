import {
  latexExpressionToLatex,
  mathExpressionToLatex,
  parseLatexExpression,
  parseMathExpression,
} from "../engine/mathlex";
import type { CommandRegistry } from "../engine/registry";

function getRawExpression(rawArgs: string): string {
  const expression = rawArgs.trim();
  if (expression.length >= 2) {
    const first = expression[0];
    const last = expression[expression.length - 1];
    if ((first === '"' || first === "'") && last === first) {
      return expression.slice(1, -1);
    }
  }
  return expression;
}

export function registerCommands(registry: CommandRegistry): void {
  registry.register({
    name: "help",
    description: "List available commands.",
    execute: (_args, context) => {
      context.print("Available commands:", "success");
      for (const command of registry.list()) {
        context.print("  " + command.name.padEnd(12) + " " + command.description);
      }
    },
  });

  registry.register({
    name: "echo",
    description: "Print text to the terminal.",
    usage: 'echo "your message"',
    execute: (args, context) => context.print(args.join(" ")),
  });

  registry.register({
    name: "math",
    description: "Parse a plain-text expression and render it as formatted mathematics.",
    usage: 'math 2*x + sin(y)^2',
    rawArguments: true,
    execute: async (_args, context, rawArgs) => {
      const expression = getRawExpression(rawArgs);
      if (!expression) {
        context.print("Usage: math expression", "error");
        return;
      }
      const latex = await mathExpressionToLatex(expression);
      context.printMath(latex, expression);
    },
  });

  registry.register({
    name: "math-latex",
    description: "Parse LaTeX input and render it as formatted mathematics.",
    usage: "math-latex \\frac{1}{2}",
    rawArguments: true,
    execute: async (_args, context, rawArgs) => {
      const expression = getRawExpression(rawArgs);
      if (!expression) {
        context.print("Usage: math-latex LaTeX-expression", "error");
        return;
      }
      const latex = await latexExpressionToLatex(expression);
      context.printMath(latex, expression);
    },
  });

  registry.register({
    name: "ast",
    description: "Parse a plain-text mathematical expression and display its AST.",
    usage: "ast 2*x + sin(y)^2",
    rawArguments: true,
    execute: async (_args, context, rawArgs) => {
      const expression = getRawExpression(rawArgs);
      if (!expression) {
        context.print("Usage: ast expression", "error");
        return;
      }
      const ast = await parseMathExpression(expression);
      context.print("Mathlex AST (plain text): " + expression, "success");
      context.printAst(ast);
    },
  });

  registry.register({
    name: "ast-latex",
    description: "Parse a LaTeX mathematical expression and display its AST.",
    usage: "ast-latex \\frac{1}{2}",
    rawArguments: true,
    execute: async (_args, context, rawArgs) => {
      const expression = getRawExpression(rawArgs);
      if (!expression) {
        context.print("Usage: ast-latex LaTeX-expression", "error");
        return;
      }
      const ast = await parseLatexExpression(expression);
      context.print("Mathlex AST (LaTeX): " + expression, "success");
      context.printAst(ast);
    },
  });

  registry.register({
    name: "clear",
    description: "Clear the terminal output.",
    execute: (_args, context) => context.clear(),
  });

  registry.register({
    name: "version",
    description: "Show the Jabr CLI version.",
    execute: (_args, context) => context.print("Jabr CLI v0.1.0", "success"),
  });

  registry.register({
    name: "about",
    description: "Show information about Jabr CLI.",
    execute: (_args, context) => {
      context.print("Jabr CLI is a lightweight command interface for your application.");
      context.print("It runs registered application commands; it is not a system shell.", "muted");
    },
  });
}
