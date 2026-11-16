import { registerCommands } from "../command/register";
import { CommandDispatcher } from "../engine/dispatcher";
import { CommandRegistry } from "../engine/registry";
import type { OutputKind, TerminalContext } from "../engine/types";
import { renderAst } from "./ast-renderer";
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

function printAst(ast: unknown): void {
  const line = document.createElement("div");
  line.className = "output-line output-line--ast";
  line.innerHTML = renderAst(ast);
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
  if (rendererButton) {
    const mathBlock = rendererButton.closest<HTMLElement>(".math-output");
    const renderer = rendererButton.dataset.mathRenderer;
    if (mathBlock && (renderer === "katex" || renderer === "mathjax")) {
      await renderMathOutput(mathBlock, renderer);
    }
    return;
  }

  const button = event.target.closest<HTMLButtonElement>("button[data-ast-action]");
  if (!button) return;
  const astView = button.closest<HTMLElement>(".ast-view");
  if (!astView) return;

  const action = button.dataset.astAction;
  if (action === "expand" || action === "collapse") {
    const expanded = action === "expand";
    astView.querySelectorAll<HTMLDetailsElement>("details.ast-details").forEach((details) => {
      details.open = expanded;
    });
    return;
  }
  if (action === "raw") {
    const raw = astView.querySelector<HTMLElement>(".ast-raw");
    if (!raw) return;
    raw.hidden = !raw.hidden;
    button.textContent = raw.hidden ? "Raw JSON" : "Hide JSON";
    return;
  }
  if (action === "copy") {
    event.preventDefault();
    event.stopPropagation();
    const data = button.dataset.copy;
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(JSON.parse(data), null, 2));
      button.dataset.original ??= button.textContent ?? "";
      const previousTimer = copyButtonTimers.get(button);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      button.textContent = "✓";
      const timer = window.setTimeout(() => {
        button.textContent = button.dataset.original ?? "";
        copyButtonTimers.delete(button);
      }, 1200);
      copyButtonTimers.set(button, timer);
    } catch {
      button.textContent = "!";
      button.title = "Clipboard access unavailable";
    }
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
const copyButtonTimers = new WeakMap<HTMLButtonElement, number>();

// Commands execute serially so asynchronous initialization or evaluation cannot
// let a later command print its output before an earlier command has completed.
let dispatchQueue: Promise<void> = Promise.resolve();

print("Welcome to Jabr CLI v0.1.0.", "success");
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

  dispatchQueue = dispatchQueue
    .then(() => dispatcher.dispatch(value))
    .catch((error: unknown) => {
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
  if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) {
    return;
  }
  input.focus();
});
