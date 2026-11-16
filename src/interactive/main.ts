import { registerCommands } from "../command/register";
import { CommandDispatcher } from "../engine/dispatcher";
import { CommandRegistry } from "../engine/registry";
import type { OutputKind, TerminalContext } from "../engine/types";
import { renderAst } from "./ast-renderer";
import { CommandHistory } from "./command-history";

const output = document.querySelector<HTMLElement>("#terminal-output");
const form = document.querySelector<HTMLFormElement>("#terminal-form");
const input = document.querySelector<HTMLInputElement>("#terminal-input");

if (!output || !form || !input) {
  throw new Error("Terminal elements are missing from index.html.");
}

const terminalOutput = output;

function print(content: string, kind: OutputKind = "normal"): void {
  const line = document.createElement("div");
  line.className = `output-line output-line--${kind}`;
  line.textContent = content;
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function printAst(ast: unknown): void {
  const line = document.createElement("div");
  line.className = "output-line output-line--ast";
  // renderAst escapes all AST keys and values before producing this HTML.
  line.innerHTML = renderAst(ast);
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function clear(): void {
  terminalOutput.replaceChildren();
}

const context: TerminalContext = { print, printAst, clear };
const registry = new CommandRegistry();
registerCommands(registry);
const dispatcher = new CommandDispatcher(registry, context);
const history = new CommandHistory();

print("Welcome to Jabr CLI v0.1.0.", "success");
print('Type "help" to see available commands.', "muted");
print("");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;

  print(`guest@jabr:~$ ${value}`, "command");
  history.add(value);
  history.resetNavigation();
  input.value = "";
  await dispatcher.dispatch(value);
  input.focus();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    input.value = history.previous(input.value);
    input.setSelectionRange(input.value.length, input.value.length);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    input.value = history.next();
    input.setSelectionRange(input.value.length, input.value.length);
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    clear();
  }
});

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) {
    return;
  }
  input.focus();
});
