import initCalcpad, { convert, version } from "../engine/civilkit-wasm/civilkit_engine.js";
import initHighlighter, { highlight, version as highlighterVersion } from "../engine/civilkit-highlighter-wasm/civilkit_highlighter.js";
import { createWorksheetEditor, type WorksheetEditor } from "../editor/create-editor";

interface CalcpadError {
  sourceLine?: number;
  outputLine?: number;
  message?: string;
  source?: string;
}
interface ConvertResponse {
  html?: string;
  errors?: CalcpadError[];
  status?: number;
  error?: string;
}
interface Token {
  line: number;
  column: number;
  length: number;
  type: string;
  typeId: number;
  text: string | null;
}
interface HighlightResponse {
  tokens?: Token[];
  status?: number;
  error?: string;
}

function requireElement<T>(element: T | null | undefined, selector: string): T {
  if (element == null) {
    throw new Error("Calcpad engine test page is missing required element: " + selector);
  }
  return element;
}

const editorHost = requireElement(
  document.querySelector<HTMLElement>("#worksheet-editor"),
  "#worksheet-editor",
);
const runButton = requireElement(
  document.querySelector<HTMLButtonElement>("#run-worksheet"),
  "#run-worksheet",
);
const tokenizeButton = requireElement(
  document.querySelector<HTMLButtonElement>("#inspect-tokens"),
  "#inspect-tokens",
);
const status = requireElement(
  document.querySelector<HTMLOutputElement>("#engine-status"),
  "#engine-status",
);
const versionLabel = requireElement(
  document.querySelector<HTMLElement>("#engine-version"),
  "#engine-version",
);
const report = requireElement(
  document.querySelector<HTMLIFrameElement>("#engine-report"),
  "#engine-report",
);
const errorsPanel = requireElement(
  document.querySelector<HTMLElement>("#engine-errors"),
  "#engine-errors",
);
const errorsText = requireElement(
  errorsPanel.querySelector<HTMLPreElement>("pre"),
  "#engine-errors pre",
);
const tokenOutput = requireElement(
  document.querySelector<HTMLElement>("#token-output"),
  "#token-output",
);
const tokenCount = requireElement(
  document.querySelector<HTMLElement>("#token-count"),
  "#token-count",
);

const INITIAL_WORKSHEET = "a = 6\nb = 7\nanswer = a*b";
const WORKSHEET_EXAMPLES: Record<string, string> = {
  scalar: "a = 6\nb = 7\nanswer = a*b",
  units: "length = 6 m\nwidth = 300 mm\narea = length * width",
  functions: "angle = 30 deg\nsine = sin(angle)\ncosine = cos(angle)",
};
let editor: WorksheetEditor | null = null;

function setStatus(message: string, state: "loading" | "ready" | "error"): void {
  status.value = message;
  status.textContent = message;
  status.dataset.state = state;
}
function renderReport(html: string): void {
  const documentHtml =
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<style>body{margin:16px;font:14px/1.5 system-ui,sans-serif;color:#17202b}img,svg{max-width:100%}</style>" +
    "</head><body>" + html + "</body></html>";
  report.srcdoc = documentHtml;
}
function renderErrors(items: CalcpadError[]): void {
  if (items.length === 0) {
    errorsPanel.hidden = true;
    errorsText.textContent = "";
    return;
  }
  errorsPanel.hidden = false;
  errorsText.textContent = items.map((item) => {
    const line = item.sourceLine ? "Line " + item.sourceLine + ": " : "";
    return line + (item.message ?? "Calculation message");
  }).join("\n");
}
function currentSource(): string {
  return editor?.getValue() ?? "";
}
function inspectTokens(): void {
  if (!editor) return;
  tokenizeButton.disabled = true;
  tokenOutput.textContent = "Tokenizing…";
  try {
    const response = JSON.parse(
      highlight(JSON.stringify({ content: currentSource(), includeText: true })),
    ) as HighlightResponse;
    if (response.status && response.status >= 400) {
      throw new Error(response.error ?? "Tokenizer returned status " + response.status);
    }
    const tokens = response.tokens ?? [];
    tokenCount.textContent = tokens.length + " tokens";
    tokenOutput.textContent = JSON.stringify(tokens, null, 2);
  } catch (error) {
    tokenCount.textContent = "Failed";
    tokenOutput.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    tokenizeButton.disabled = false;
  }
}
async function runWorksheet(): Promise<void> {
  if (!editor) return;
  runButton.disabled = true;
  setStatus("Calculating…", "loading");
  renderErrors([]);
  try {
    const response = JSON.parse(
      convert(JSON.stringify({ content: currentSource(), messageCodes: true }), true),
    ) as ConvertResponse;
    if (response.status && response.status >= 400) {
      throw new Error(response.error ?? "Calcpad returned status " + response.status);
    }
    renderReport(response.html ?? "");
    renderErrors(response.errors ?? []);
    setStatus("Ready", "ready");
  } catch (error) {
    setStatus("Calculation failed", "error");
    errorsPanel.hidden = false;
    errorsText.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    runButton.disabled = false;
  }
}
async function start(): Promise<void> {
  try {
    setStatus("Loading editor and WebAssembly…", "loading");
    const [worksheetEditor] = await Promise.all([
      createWorksheetEditor(
        editorHost,
        INITIAL_WORKSHEET,
        () => { tokenCount.textContent = "Source changed — tokenize to refresh"; },
        () => { if (!runButton.disabled) void runWorksheet(); },
      ),
      initCalcpad(),
      initHighlighter(),
    ]);
    editor = worksheetEditor;
    document.querySelectorAll<HTMLButtonElement>("[data-example]").forEach((button) => {
      button.addEventListener("click", () => {
        const source = WORKSHEET_EXAMPLES[button.dataset.example ?? ""];
        if (!source || !editor) return;
        editor.setValue(source);
        tokenCount.textContent = "Source changed — tokenize to refresh";
        tokenOutput.textContent = "Example loaded. Select Tokenize source to inspect the tokens.";
        editor.focus();
      });
    });
    versionLabel.textContent = "Calcpad " + version() + " · Highlighter " + highlighterVersion();
    runButton.disabled = false;
    tokenizeButton.disabled = false;
    setStatus("Ready", "ready");
    inspectTokens();
    await runWorksheet();
    editor.focus();
  } catch (error) {
    setStatus("Editor or engine failed to load", "error");
    errorsPanel.hidden = false;
    errorsText.textContent = error instanceof Error ? error.message : String(error);
  }
}
runButton.addEventListener("click", () => void runWorksheet());
tokenizeButton.addEventListener("click", inspectTokens);
void start();
