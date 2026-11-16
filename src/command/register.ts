import {
  latexExpressionToLatex,
  mathExpressionToLatex,
  parseLatexExpression,
  parseMathExpression,
} from "../engine/mathlex";
import type { Command } from "../engine/types";
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

type ExpressionMode = "math" | "latex";
type ExpressionOutput = "render" | "ast";

function createExpressionCommand(
  name: string,
  description: string,
  usage: string,
  mode: ExpressionMode,
  output: ExpressionOutput,
): Command {
  return {
    name,
    description,
    usage,
    rawArguments: true,
    execute: async (_args, context, rawArgs) => {
      const expression = getRawExpression(rawArgs);
      if (!expression) {
        context.print(`Usage: ${usage}`, "error");
        return;
      }

      if (output === "ast") {
        const ast = mode === "math"
          ? await parseMathExpression(expression)
          : await parseLatexExpression(expression);
        context.print(`Mathlex AST (${mode === "math" ? "plain text" : "LaTeX"}): ${expression}`, "success");
        context.printAst(ast, expression);
        return;
      }

      const latex = mode === "math"
        ? await mathExpressionToLatex(expression)
        : await latexExpressionToLatex(expression);
      context.printMath(latex, expression);
    },
  };
}

export function registerCommands(registry: CommandRegistry): void {
  registry.register({
    name: "help",
    description: "List available commands or show details for one command.",
    usage: "help [command]",
    execute: (args, context) => {
      const requested = args[0]?.toLowerCase();
      if (requested) {
        const command = registry.get(requested);
        if (!command) {
          context.print(`Unknown command: ${requested}`, "error");
          return;
        }
        context.print(command.name, "success");
        context.print(command.description);
        if (command.usage) context.print(`Usage: ${command.usage}`, "muted");
        return;
      }

      context.print("Available commands:", "success");
      for (const command of registry.list()) {
        context.print("  " + command.name.padEnd(12) + " " + command.description);
      }
      context.print('Use "help <command>" for command usage.', "muted");
    },
  });

  registry.register({
    name: "echo",
    description: "Print text to the terminal.",
    usage: 'echo "your message"',
    execute: (args, context) => context.print(args.join(" ")),
  });

  registry.register(createExpressionCommand(
    "math",
    "Parse a plain-text expression and render it as formatted mathematics.",
    "math 2*x + sin(y)^2",
    "math",
    "render",
  ));
  registry.register(createExpressionCommand(
    "math-latex",
    "Parse LaTeX input and render it as formatted mathematics.",
    "math-latex \\frac{1}{2}",
    "latex",
    "render",
  ));
  registry.register(createExpressionCommand(
    "ast",
    "Parse a plain-text mathematical expression and display its AST.",
    "ast 2*x + sin(y)^2",
    "math",
    "ast",
  ));
  registry.register(createExpressionCommand(
    "ast-latex",
    "Parse a LaTeX mathematical expression and display its AST.",
    "ast-latex \\frac{1}{2}",
    "latex",
    "ast",
  ));

  registry.register({
    name: "clear",
    description: "Clear the terminal output.",
    execute: (_args, context) => context.clear(),
  });

  registry.register({
    name: "version",
    description: "Show the Jabr CLI version.",
    execute: (_args, context) => context.print(`Jabr CLI v${__APP_VERSION__}`, "success"),
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
