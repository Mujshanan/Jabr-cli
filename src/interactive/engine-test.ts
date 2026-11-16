import initCivilKit, { convert, version } from "../engine/civilkit-wasm/civilkit_engine.js";
import initHighlighter, { highlight, version as highlighterVersion } from "../engine/civilkit-highlighter-wasm/civilkit_highlighter.js";

interface CivilKitError {
  sourceLine?: number;
  outputLine?: number;
  message?: string;
  source?: string;
}
interface ConvertResponse {
  html?: string;
  errors?: CivilKitError[];
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

const source = document.querySelector<HTMLTextAreaElement>("#worksheet-source");
const runButton = document.querySelector<HTMLButtonElement>("#run-worksheet");
const tokenizeButton = document.querySelector<HTMLButtonElement>("#inspect-tokens");
const status = document.querySelector<HTMLOutputElement>("#engine-status");
const versionLabel = document.querySelector<HTMLElement>("#engine-version");
const report = document.querySelector<HTMLIFrameElement>("#engine-report");
const errorsPanel = document.querySelector<HTMLElement>("#engine-errors");
const errorsText = errorsPanel?.querySelector("pre");
const tokenOutput = document.querySelector<HTMLElement>("#token-output");
const tokenCount = document.querySelector<HTMLElement>("#token-count");

if (!source || !runButton || !tokenizeButton || !status || !versionLabel || !report ||
    !errorsPanel || !errorsText || !tokenOutput || !tokenCount) {
  throw new Error("CivilKit engine test page is missing required elements.");
}

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
function renderErrors(items: CivilKitError[]): void {
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
function inspectTokens(): void {
  tokenizeButton.disabled = true;
  tokenOutput.textContent = "Tokenizing…";
  try {
    const response = JSON.parse(
      highlight(JSON.stringify({ content: source.value, includeText: true })),
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
  runButton.disabled = true;
  setStatus("Calculating…", "loading");
  renderErrors([]);
  try {
    const response = JSON.parse(
      convert(JSON.stringify({ content: source.value, messageCodes: true }), true),
    ) as ConvertResponse;
    if (response.status && response.status >= 400) {
      throw new Error(response.error ?? "CivilKit returned status " + response.status);
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
    setStatus("Loading WebAssembly…", "loading");
    await Promise.all([initCivilKit(), initHighlighter()]);
    versionLabel.textContent = "CivilKit " + version() + " · Highlighter " + highlighterVersion();
    runButton.disabled = false;
    tokenizeButton.disabled = false;
    setStatus("Ready", "ready");
    inspectTokens();
    await runWorksheet();
  } catch (error) {
    setStatus("Engine failed to load", "error");
    errorsPanel.hidden = false;
    errorsText.textContent = error instanceof Error ? error.message : String(error);
  }
}
runButton.addEventListener("click", () => void runWorksheet());
tokenizeButton.addEventListener("click", inspectTokens);
source.addEventListener("input", () => {
  tokenCount.textContent = "Source changed — tokenize to refresh";
});
void start();
