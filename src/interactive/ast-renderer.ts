export interface AstTreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly preview: string;
  readonly value: unknown;
  readonly children: readonly AstTreeNode[];
}

type AstRecord = Record<string, unknown>;

const LABELS: Record<string, string> = {
  kind: "Type",
  op: "Operator",
  left: "Left operand",
  right: "Right operand",
  value: "Value",
  args: "Arguments",
  argument: "Argument",
  operands: "Operands",
  name: "Name",
  symbol: "Symbol",
  numerator: "Numerator",
  denominator: "Denominator",
  base: "Base",
  exponent: "Exponent",
  index: "Index",
  elements: "Elements",
};

const ICONS: Array<[RegExp, string, string]> = [
  [/integer|number|decimal|rational|float/i, "123", "number"],
  [/variable|symbol|identifier/i, "x", "variable"],
  [/add|subtract|minus|plus|sum/i, "+", "operator"],
  [/multiply|product|times/i, "×", "operator"],
  [/divide|quotient/i, "÷", "operator"],
  [/power|exponent/i, "xʸ", "operator"],
  [/function|call|sin|cos|tan|log|sqrt/i, "ƒ", "function"],
  [/matrix|vector|array|list/i, "▦", "collection"],
  [/equation|relation|equal|compare/i, "=", "relation"],
  [/string|text/i, "T", "text"],
  [/boolean|true|false/i, "◉", "boolean"],
  [/null|none/i, "∅", "null"],
];

function isRecord(value: unknown): value is AstRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readableLabel(key: string): string {
  return LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
}

function iconFor(kind: string): { glyph: string; category: string } {
  const match = ICONS.find(([pattern]) => pattern.test(kind));
  return match ? { glyph: match[1], category: match[2] } : { glyph: "◇", category: "generic" };
}

function pathSegment(value: string): string {
  return "/" + value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function preview(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "[" + value.length + " items]";
  if (isRecord(value)) return "{…}";
  return String(value);
}

/** Normalize arbitrary parser JSON into a stable, path-keyed tree for the UI. */
export function buildAstTreeModel(value: unknown): AstTreeNode {
  function visit(key: string, current: unknown, id: string, depth: number): AstTreeNode {
    if (depth > 80) {
      return {
        id,
        label: readableLabel(key),
        kind: "DepthLimit",
        preview: "Maximum display depth reached",
        value: current,
        children: [],
      };
    }

    if (Array.isArray(current)) {
      return {
        id,
        label: readableLabel(key),
        kind: "Array",
        preview: current.length + " items",
        value: current,
        children: current.map((item, index) => visit(String(index), item, id + pathSegment(String(index)), depth + 1)),
      };
    }

    if (isRecord(current)) {
      const kind = typeof current.kind === "string" ? current.kind : "Object";
      const entries = Object.entries(current).filter(([childKey]) => childKey !== "kind");
      const children = entries.map(([childKey, childValue]) =>
        visit(childKey, childValue, id + pathSegment(childKey), depth + 1));
      const scalar = current.value;
      const summary = scalar !== undefined && !isRecord(scalar) && !Array.isArray(scalar)
        ? preview(scalar)
        : children.length === 0 ? "No fields" : children.length + " fields";
      return {
        id,
        label: kind === "Object" ? readableLabel(key) : kind,
        kind,
        preview: summary,
        value: current,
        children,
      };
    }

    return {
      id,
      label: readableLabel(key),
      kind: key,
      preview: preview(current),
      value: current,
      children: [],
    };
  }

  return visit("Expression", value, "root", 0);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, action: string, className = "ast-action"): HTMLButtonElement {
  const node = element("button", className, label);
  node.type = "button";
  node.dataset.astAction = action;
  return node;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "undefined";
}

/**
 * Mount a DOM-based AST explorer.
 *
 * The tree uses stable path IDs, and selection/details state is kept separately
 * from expansion state. No parser-specific source ranges are assumed.
 */
export function createAstExplorer(ast: unknown): HTMLElement {
  const model = buildAstTreeModel(ast);
  const root = element("section", "ast-view");
  root.setAttribute("aria-label", "Abstract syntax tree explorer");

  const toolbar = element("div", "ast-toolbar");
  toolbar.append(
    element("span", "ast-toolbar__title", "AST explorer"),
    element("span", "ast-toolbar__spacer"),
  );
  const expandAll = button("Expand all", "expand");
  const collapseAll = button("Collapse all", "collapse");
  const rawToggle = button("Full JSON", "raw");
  const copyRoot = button("Copy AST", "copy-root");
  toolbar.append(expandAll, collapseAll, rawToggle, copyRoot);

  const workspace = element("div", "ast-workspace");
  const treePanel = element("div", "ast-tree-panel");
  const treeHeading = element("div", "ast-panel-heading", "Structure");
  const tree = element("ul", "ast-children ast-children--root");
  const detailsPanel = element("aside", "ast-details-panel");
  detailsPanel.setAttribute("aria-label", "Selected AST node details");
  const detailsHeading = element("div", "ast-panel-heading", "Node details");
  const selectedTitle = element("div", "ast-details-title", model.label);
  const selectedMeta = element("div", "ast-details-meta", model.kind + " · " + model.id);
  const selectedJson = element("pre", "ast-details-json", serialize(model.value));
  const sourceNote = element(
    "p",
    "ast-source-note",
    "Source ranges are not provided by this parser AST; source highlighting is not available in this view.",
  );
  detailsPanel.append(detailsHeading, selectedTitle, selectedMeta, selectedJson, sourceNote);
  treePanel.append(treeHeading, tree);
  workspace.append(treePanel, detailsPanel);

  const fullJson = element("pre", "ast-raw", serialize(ast));
  fullJson.hidden = true;
  root.append(toolbar, workspace, fullJson);

  const rows = new Map<string, HTMLElement>();
  const childLists = new Map<string, HTMLUListElement>();
  const expandButtons = new Map<string, HTMLButtonElement>();
  const nodeButtons = new Map<string, HTMLButtonElement>();
  const expanded = new Set<string>(["root"]);
  let showingFullJson = false;

  function selectNode(node: AstTreeNode): void {
    selectedTitle.textContent = node.label;
    selectedMeta.textContent = node.kind + " · " + node.id;
    selectedJson.textContent = serialize(node.value);
    showingFullJson = false;
    fullJson.hidden = true;
    selectedJson.hidden = false;
    rawToggle.textContent = "Full JSON";
    for (const [id, nodeButton] of nodeButtons) {
      nodeButton.setAttribute("aria-current", String(id === node.id));
    }
  }

  function renderNode(node: AstTreeNode): HTMLLIElement {
    const item = element("li", "ast-node");
    item.dataset.nodeId = node.id;
    rows.set(node.id, item);

    const row = element("div", "ast-node-row");
    if (node.children.length > 0) {
      const isExpanded = expanded.has(node.id);
      const toggle = button(isExpanded ? "▾" : "▸", "toggle", "ast-toggle");
      toggle.setAttribute("aria-label", (isExpanded ? "Collapse " : "Expand ") + node.label);
      toggle.setAttribute("aria-expanded", String(isExpanded));
      toggle.dataset.nodeId = node.id;
      expandButtons.set(node.id, toggle);
      row.append(toggle);
    } else {
      row.append(element("span", "ast-toggle-spacer"));
    }

    const icon = iconFor(node.kind);
    const select = button("", "select", "ast-select");
    select.dataset.nodeId = node.id;
    select.setAttribute("aria-current", "false");
    const glyph = element("span", "ast-icon ast-icon--" + icon.category, icon.glyph);
    const label = element("span", "ast-node__label", node.label);
    const kind = element("span", "ast-kind", node.kind);
    const summary = element("span", "ast-preview", node.preview);
    select.append(glyph, label, kind, summary);
    nodeButtons.set(node.id, select);
    row.append(select);

    const copy = button("⧉", "copy-node", "ast-copy");
    copy.dataset.nodeId = node.id;
    copy.setAttribute("aria-label", "Copy " + node.label + " node JSON");
    row.append(copy);
    item.append(row);

    if (node.children.length > 0) {
      const children = element("ul", "ast-children");
      children.hidden = !expanded.has(node.id);
      childLists.set(node.id, children);
      for (const child of node.children) children.append(renderNode(child));
      item.append(children);
    }
    return item;
  }

  tree.append(renderNode(model));
  selectNode(model);

  function setExpanded(id: string, isExpanded: boolean): void {
    const list = childLists.get(id);
    const toggle = expandButtons.get(id);
    if (!list || !toggle) return;
    list.hidden = !isExpanded;
    toggle.textContent = isExpanded ? "▾" : "▸";
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute("aria-label", (isExpanded ? "Collapse " : "Expand ") + (rows.get(id)?.querySelector(".ast-node__label")?.textContent ?? "node"));
    if (isExpanded) expanded.add(id);
    else expanded.delete(id);
  }

  function setAllExpanded(isExpanded: boolean): void {
    for (const id of childLists.keys()) setExpanded(id, isExpanded);
  }

  expandAll.addEventListener("click", () => setAllExpanded(true));
  collapseAll.addEventListener("click", () => setAllExpanded(false));
  rawToggle.addEventListener("click", () => {
    showingFullJson = !showingFullJson;
    fullJson.hidden = !showingFullJson;
    selectedJson.hidden = showingFullJson;
    rawToggle.textContent = showingFullJson ? "Node details" : "Full JSON";
  });
  copyRoot.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(serialize(ast));
      copyRoot.textContent = "Copied";
      window.setTimeout(() => { copyRoot.textContent = "Copy AST"; }, 1000);
    } catch {
      copyRoot.textContent = "Copy unavailable";
    }
  });

  root.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLButtonElement>("button[data-ast-action]");
    if (!target) return;
    const action = target.dataset.astAction;
    const id = target.dataset.nodeId;
    if (action === "toggle" && id) {
      setExpanded(id, !expanded.has(id));
      return;
    }
    if (action === "select" && id) {
      const node = findNode(model, id);
      if (node) selectNode(node);
      return;
    }
    if (action === "copy-node" && id) {
      const node = findNode(model, id);
      if (!node) return;
      try {
        await navigator.clipboard.writeText(serialize(node.value));
        target.textContent = "✓";
        window.setTimeout(() => { target.textContent = "⧉"; }, 1000);
      } catch {
        target.textContent = "!";
      }
    }
  });

  return root;
}

function findNode(root: AstTreeNode, id: string): AstTreeNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}
