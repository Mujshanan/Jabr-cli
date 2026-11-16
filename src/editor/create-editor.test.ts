import { describe, expect, it, vi } from "vitest";
import { mountWorksheetEditor } from "./create-editor";

interface FakeUpdate {
  docChanged: boolean;
  state: { doc: { toString(): string } };
}
interface FakeExtension {
  listener?: (update: FakeUpdate) => void;
}
class FakeDom {
  private readonly handlers = new Map<string, EventListener>();
  addEventListener(type: string, listener: EventListener): void { this.handlers.set(type, listener); }
  removeEventListener(type: string, listener: EventListener): void {
    if (this.handlers.get(type) === listener) this.handlers.delete(type);
  }
  dispatch(event: Event): void { this.handlers.get(event.type)?.(event); }
  get handlerCount(): number { return this.handlers.size; }
}
class FakeEditorView {
  static instances: FakeEditorView[] = [];
  static updateListener = {
    of(listener: (update: FakeUpdate) => void): FakeExtension {
      return { listener };
    },
  };
  static theme() { return { type: "theme" }; }

  state: FakeUpdate["state"];
  readonly dom = new FakeDom() as unknown as HTMLElement;
  destroyed = false;
  focused = false;
  private readonly listener?: (update: FakeUpdate) => void;

  constructor(config: { doc: string; extensions: unknown[] }) {
    this.state = { doc: { toString: () => config.doc } };
    this.listener = (config.extensions.find((item) =>
      typeof item === "object" && item !== null && "listener" in item
    ) as FakeExtension | undefined)?.listener;
    FakeEditorView.instances.push(this);
  }
  focus(): void { this.focused = true; }
  destroy(): void { this.destroyed = true; }
  changeDocument(value: string): void {
    this.state = { doc: { toString: () => value } };
    this.listener?.({ docChanged: true, state: this.state });
  }
}
const fakeModule = {
  basicSetup: { type: "basic-setup" },
  EditorView: FakeEditorView,
} as unknown as Parameters<typeof mountWorksheetEditor>[2];

describe("worksheet CodeMirror adapter", () => {
  it("preserves the initial worksheet and reads the current document", () => {
    FakeEditorView.instances = [];
    const editor = mountWorksheetEditor({} as HTMLElement, "a = 6\nb = 7", fakeModule);
    expect(editor.getValue()).toBe("a = 6\nb = 7");
    FakeEditorView.instances[0].changeDocument("answer = 42");
    expect(editor.getValue()).toBe("answer = 42");
    editor.destroy();
  });

  it("notifies the host when the document changes", () => {
    FakeEditorView.instances = [];
    const changed = vi.fn();
    const editor = mountWorksheetEditor({} as HTMLElement, "x = 1", fakeModule, changed);
    FakeEditorView.instances[0].changeDocument("x = 2");
    expect(changed).toHaveBeenCalledWith("x = 2");
    editor.destroy();
  });

  it("runs on Ctrl+Enter and removes its keyboard handler on teardown", () => {
    FakeEditorView.instances = [];
    const run = vi.fn();
    const editor = mountWorksheetEditor({} as HTMLElement, "x = 1", fakeModule, undefined, run);
    const view = FakeEditorView.instances[0];
    const dom = view.dom as unknown as FakeDom;
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperties(event, {
      key: { value: "Enter" },
      ctrlKey: { value: true },
      metaKey: { value: false },
    });
    dom.dispatch(event);
    expect(run).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(dom.handlerCount).toBe(1);
    editor.destroy();
    expect(view.destroyed).toBe(true);
    expect(dom.handlerCount).toBe(0);
  });
});
