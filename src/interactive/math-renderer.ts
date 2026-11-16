export type MathRenderer = "katex" | "mathjax";

interface KatexApi {
  render(tex: string, element: HTMLElement, options?: {
    displayMode?: boolean; throwOnError?: boolean; trust?: boolean;
  }): void;
}
interface MathJaxApi {
  typesetPromise(elements?: HTMLElement[]): Promise<void>;
  typesetClear?: (elements?: HTMLElement[]) => void;
}
declare global {
  interface Window {
    katex?: KatexApi;
    MathJax?: MathJaxApi;
  }
}

export function createMathOutput(latex: string, source: string): HTMLElement {
  const block = document.createElement("section");
  block.className = "math-output";
  block.dataset.latex = latex;

  const toolbar = document.createElement("div");
  toolbar.className = "math-output__toolbar";
  const title = document.createElement("span");
  title.className = "math-output__title";
  title.textContent = "Mathematical output";
  const controls = document.createElement("div");
  controls.className = "math-output__controls";

  for (const renderer of ["katex", "mathjax"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "math-output__renderer";
    button.dataset.mathRenderer = renderer;
    button.textContent = renderer === "katex" ? "KaTeX" : "MathJax";
    button.setAttribute("aria-pressed", String(renderer === "katex"));
    controls.append(button);
  }
  toolbar.append(title, controls);

  const rendered = document.createElement("div");
  rendered.className = "math-output__rendered";
  rendered.setAttribute("aria-label", "Rendered mathematical expression");

  const details = document.createElement("details");
  details.className = "math-output__source";
  const summary = document.createElement("summary");
  summary.textContent = "LaTeX source";
  const code = document.createElement("code");
  code.textContent = latex;
  details.append(summary, code);

  const caption = document.createElement("div");
  caption.className = "math-output__caption";
  caption.textContent = "Input: " + source;

  block.append(toolbar, rendered, details, caption);
  void renderMathOutput(block, "katex");
  return block;
}

const renderTokens = new WeakMap<HTMLElement, number>();

export async function renderMathOutput(
  block: HTMLElement,
  renderer: MathRenderer,
): Promise<void> {
  const target = block.querySelector<HTMLElement>(".math-output__rendered");
  const latex = block.dataset.latex;
  if (!target || !latex) return;

  const token = (renderTokens.get(block) ?? 0) + 1;
  renderTokens.set(block, token);
  const isCurrentRender = () => renderTokens.get(block) === token;

  block.querySelectorAll<HTMLButtonElement>("[data-math-renderer]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mathRenderer === renderer));
  });
  window.MathJax?.typesetClear?.([target]);
  target.replaceChildren();

  try {
    if (renderer === "katex") {
      if (!window.katex) {
        throw new Error("KaTeX did not load. Check your internet connection and reload Jabr.");
      }
      window.katex.render(latex, target, {
        displayMode: true,
        throwOnError: false,
        trust: false,
      });
      return;
    }

    if (!window.MathJax?.typesetPromise) {
      throw new Error("MathJax did not load. Check your internet connection and reload Jabr.");
    }

    // Typeset off-DOM so a slow MathJax operation cannot overwrite a newer
    // KaTeX/MathJax selection in the visible target.
    const staging = document.createElement("div");
    staging.textContent = "\\\\[" + latex + "\\\\]";
    await window.MathJax.typesetPromise([staging]);
    if (!isCurrentRender()) {
      window.MathJax.typesetClear?.([staging]);
      return;
    }
    target.replaceChildren(...Array.from(staging.childNodes));
  } catch (error) {
    if (!isCurrentRender()) return;
    target.replaceChildren();
    const message = document.createElement("div");
    message.className = "math-output__error";
    message.textContent = error instanceof Error ? error.message : String(error);
    target.append(message);
  }
}
