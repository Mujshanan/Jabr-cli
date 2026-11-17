export const MAX_MERMAID_SOURCE_LENGTH = 50_000;

interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}
interface MermaidApi {
  initialize(config: {
    startOnLoad: boolean;
    securityLevel: "strict";
    theme: "dark";
    flowchart: { htmlLabels: boolean };
  }): void;
  render(id: string, source: string): Promise<MermaidRenderResult>;
}
declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

let initialized = false;
let nextDiagramId = 0;

export function validateMermaidSource(source: string): string {
  const normalized = source.trim();
  if (!normalized) throw new Error('Usage: mermaid "flowchart TD; A-->B"');
  if (normalized.length > MAX_MERMAID_SOURCE_LENGTH) {
    throw new Error(`Mermaid source exceeds the ${MAX_MERMAID_SOURCE_LENGTH.toLocaleString()} character limit.`);
  }
  return normalized;
}

export function createMermaidOutput(source: string): HTMLElement {
  const block = document.createElement("section");
  block.className = "mermaid-output";

  const toolbar = document.createElement("div");
  toolbar.className = "mermaid-output__toolbar";
  const title = document.createElement("span");
  title.className = "mermaid-output__title";
  title.textContent = "Mermaid diagram";
  toolbar.append(title);

  const rendered = document.createElement("div");
  rendered.className = "mermaid-output__rendered";
  rendered.setAttribute("role", "img");
  rendered.setAttribute("aria-label", "Rendered Mermaid diagram");
  rendered.textContent = "Rendering diagram…";

  const details = document.createElement("details");
  details.className = "mermaid-output__source";
  const summary = document.createElement("summary");
  summary.textContent = "Diagram source";
  const code = document.createElement("code");
  code.textContent = source;
  details.append(summary, code);

  block.append(toolbar, rendered, details);
  void renderMermaidOutput(block, source);
  return block;
}

export async function renderMermaidOutput(block: HTMLElement, source: string): Promise<void> {
  const target = block.querySelector<HTMLElement>(".mermaid-output__rendered");
  if (!target) return;

  try {
    const mermaid = window.mermaid;
    if (!mermaid) {
      throw new Error("Mermaid did not load. Check your internet connection and reload Jabr.");
    }
    if (!initialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "dark",
        flowchart: { htmlLabels: false },
      });
      initialized = true;
    }

    const id = `jabr-mermaid-${++nextDiagramId}`;
    const result = await mermaid.render(id, source);
    // Mermaid runs in strict security mode; only its sanitized SVG output is inserted.
    target.innerHTML = result.svg;
    result.bindFunctions?.(target);
  } catch (error) {
    target.replaceChildren();
    target.removeAttribute("role");
    const message = document.createElement("div");
    message.className = "mermaid-output__error";
    message.textContent = error instanceof Error ? error.message : String(error);
    target.append(message);
  }
}
