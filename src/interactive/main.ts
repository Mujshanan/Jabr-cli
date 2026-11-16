import { registerCommands } from "../command/register";
import { CommandDispatcher } from "../engine/dispatcher";
import { createDispatchQueue } from "../engine/dispatch-queue";
import { CommandRegistry } from "../engine/registry";
import type { MathlexAstNode } from "../engine/mathlex";
import type { OutputKind, TerminalContext } from "../engine/types";
import { createAstExplorer } from "./ast-renderer";
import { CommandHistory } from "./command-history";
import { createMathOutput, renderMathOutput } from "./math-renderer";

const output = document.querySelector<HTMLElement>("#terminal-output");
const form = document.querySelector<HTMLFormElement>("#terminal-form");
const input = document.querySelector<HTMLInputElement>("#terminal-input");
if (!output || !form || !input) {
  throw new Error("Terminal elements are missing from index.html.");
}
const terminalOutput = output;

function print(content: string, kind: OutputKind = "normal"): void {
  const line = document.createElement("div");
  line.className = "output-line output-line--" + kind;
  line.textContent = content;
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function printAst(ast: MathlexAstNode): void {
  const line = document.createElement("div");
  line.className = "output-line output-line--ast";
  line.append(createAstExplorer(ast));
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function printMath(latex: string, source: string): void {
  const line = document.createElement("div");
  line.className = "output-line output-line--math";
  line.append(createMathOutput(latex, source));
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

terminalOutput.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;
  const rendererButton = event.target.closest<HTMLButtonElement>("button[data-math-renderer]");
  if (!rendererButton) return;
  const mathBlock = rendererButton.closest<HTMLElement>(".math-output");
  const renderer = rendererButton.dataset.mathRenderer;
  if (mathBlock && (renderer === "katex" || renderer === "mathjax")) {
    await renderMathOutput(mathBlock, renderer);
  }
});

function clear(): void {
  terminalOutput.replaceChildren();
}
const context: TerminalContext = { print, printAst, printMath, clear };
const registry = new CommandRegistry();
registerCommands(registry);
const dispatcher = new CommandDispatcher(registry, context);
const history = new CommandHistory();
const enqueueDispatch = createDispatchQueue();

print("Welcome to Jabr CLI v" + __APP_VERSION__ + ".", "success");
print('Type "help" to see available commands.', "muted");
print("");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  print("guest@jabr:~$ " + value, "command");
  history.add(value);
  history.resetNavigation();
  input.value = "";

  void enqueueDispatch(() => dispatcher.dispatch(value)).catch((error: unknown) => {
    print(error instanceof Error ? error.message : "Command failed unexpectedly.", "error");
  });
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
  if (window.getSelection()?.toString()) return;
  if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) {
    return;
  }
  input.focus();
});
