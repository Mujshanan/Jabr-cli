import { registerCommands } from "../command/register";
import { CommandDispatcher } from "../engine/dispatcher";
import { CommandRegistry } from "../engine/registry";
import type { OutputKind, TerminalContext } from "../engine/types";
import { renderAst } from "./ast-renderer";

const output = document.querySelector<HTMLElement>("#terminal-output");
const form = document.querySelector<HTMLFormElement>("#terminal-form");
const input = document.querySelector<HTMLInputElement>("#terminal-input");

if (!output || !form || !input) {
  throw new Error("Terminal elements are missing from index.html.");
}

function print(content: string, kind: OutputKind = "normal"): void {
  const line = document.createElement("div");
  line.className = `output-line output-line--${kind}`;
  line.textContent = content;
  output.append(line);
  output.scrollTop = output.scrollHeight;
}

function printAst(ast: unknown): void {
  const line = document.createElement("div");
  line.className = "output-line output-line--ast";
  // renderAst escapes all AST keys and values before producing this HTML.
  line.innerHTML = renderAst(ast);
  output.append(line);
  output.scrollTop = output.scrollHeight;
}

function clear(): void {
  output.replaceChildren();
}

const context: TerminalContext = { print, printAst, clear };
const registry = new CommandRegistry();
registerCommands(registry);
const dispatcher = new CommandDispatcher(registry, context);
const history: string[] = [];
let historyIndex = 0;

print("Welcome to Jabr CLI v0.1.0.", "success");
print('Type "help" to see available commands.', "muted");
print("");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;

  print(`guest@jabr:~$ ${value}`, "command");
  history.push(value);
  historyIndex = history.length;
  input.value = "";
  await dispatcher.dispatch(value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (history.length === 0) return;
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] ?? "";
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? "";
  } else if (event.ctrlKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    clear();
  }
});

document.addEventListener("click", () => input.focus());
