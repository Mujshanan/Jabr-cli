import { parseMathExpression } from "../engine/mathlex";
import type { CommandRegistry } from "../engine/registry";

export function registerCommands(registry: CommandRegistry): void {
  registry.register({
    name: "help",
    description: "List available commands.",
    execute: (_args, context) => {
      context.print("Available commands:", "success");
      for (const command of registry.list()) {
        context.print(`  ${command.name.padEnd(10)} ${command.description}`);
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
    name: "ast",
    description: "Parse a mathematical expression and display its AST.",
    usage: 'ast "2*x + sin(y)^2"',
    execute: async (args, context) => {
      const expression = args.join(" ").trim();
      if (!expression) {
        context.print('Usage: ast "mathematical expression"', "error");
        return;
      }

      const ast = await parseMathExpression(expression);
      context.print(`Abstract syntax tree for: ${expression}`, "success");
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
