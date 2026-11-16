export type OutputKind = "normal" | "muted" | "command" | "success" | "error";

export interface TerminalContext {
  print: (content: string, kind?: OutputKind) => void;
  printAst: (ast: unknown) => void;
  printMath: (latex: string, source: string) => void;
  clear: () => void;
}

export interface Command {
  name: string;
  description: string;
  usage?: string;
  /** Pass the untouched text after the command name instead of shell-like tokenized arguments. */
  rawArguments?: boolean;
  execute: (args: string[], context: TerminalContext, rawArgs: string) => void | Promise<void>;
}

export interface ParsedCommand {
  name: string;
  args: string[];
  rawArgs: string;
}
