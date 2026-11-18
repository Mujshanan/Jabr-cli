/**
 * Minimal CodeMirror 6 loader and worksheet-editor adapter.
 *
 * CodeMirror is loaded as one version-pinned ESM bundle so the engine lab
 * does not add a framework or a set of package-manager dependencies.
 */
const CODEMIRROR_MODULE_URL = "https://esm.sh/codemirror@6.0.2?bundle";

interface EditorDocument {
  toString(): string;
}
interface EditorViewState {
  doc: EditorDocument;
}
interface EditorViewUpdate {
  docChanged: boolean;
  state: EditorViewState;
}
interface EditorViewInstance {
  readonly state: EditorViewState;
  readonly dom: HTMLElement;
  focus(): void;
  dispatch(spec: { changes: { from: number; to: number; insert: string } }): void;
  destroy(): void;
}
interface EditorViewConfig {
  doc: string;
  extensions: unknown[];
  parent: HTMLElement;
}
interface EditorViewConstructor {
  new (config: EditorViewConfig): EditorViewInstance;
  updateListener: {
    of(listener: (update: EditorViewUpdate) => void): unknown;
  };
  theme(spec: Record<string, Record<string, string>>): unknown;
}
interface CodeMirrorModule {
  basicSetup: unknown;
  EditorView: EditorViewConstructor;
}

export interface WorksheetEditor {
  getValue(): string;
  focus(): void;
  setValue(value: string): void;
  destroy(): void;
}

export function mountWorksheetEditor(
  parent: HTMLElement,
  initialValue: string,
  module: CodeMirrorModule,
  onChange?: (value: string) => void,
  onRun?: () => void,
): WorksheetEditor {
  const theme = module.EditorView.theme({
    "&": {
      height: "340px",
      backgroundColor: "#0e1218",
      color: "#e8edf4",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      lineHeight: "1.7",
      overflow: "auto",
    },
    ".cm-gutters": {
      backgroundColor: "#111720",
      color: "#718096",
      border: "none",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "#18212c",
    },
    ".cm-cursor": {
      borderLeftColor: "#a9c7ff",
    },
    ".cm-selectionBackground": {
      backgroundColor: "#27486b !important",
    },
    "&.cm-focused": {
      outline: "none",
    },
  });

  const changeListener = module.EditorView.updateListener.of((update) => {
    if (update.docChanged) onChange?.(update.state.doc.toString());
  });
  const view = new module.EditorView({
    doc: initialValue,
    extensions: [module.basicSetup, theme, changeListener],
    parent,
  });

  const handleKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      onRun?.();
    }
  };
  view.dom.addEventListener("keydown", handleKeyDown);

  return {
    getValue: () => view.state.doc.toString(),
    focus: () => view.focus(),
    setValue: (value: string) => view.dispatch({
      changes: { from: 0, to: view.state.doc.toString().length, insert: value },
    }),
    destroy: () => {
      view.dom.removeEventListener("keydown", handleKeyDown);
      view.destroy();
    },
  };
}

export async function createWorksheetEditor(
  parent: HTMLElement,
  initialValue: string,
  onChange?: (value: string) => void,
  onRun?: () => void,
): Promise<WorksheetEditor> {
  // The URL is intentionally dynamic so Vite leaves this browser ESM import
  // external instead of trying to resolve it during the local build.
  const module = await import(/* @vite-ignore */ CODEMIRROR_MODULE_URL) as CodeMirrorModule;
  return mountWorksheetEditor(parent, initialValue, module, onChange, onRun);
}
