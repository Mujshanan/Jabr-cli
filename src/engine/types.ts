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
  execute: (args: string[], context: TerminalContext) => void | Promise<void>;
}

export interface ParsedCommand {
  name: string;
  args: string[];
}
