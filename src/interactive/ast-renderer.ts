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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function readableLabel(key: string): string {
  return LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
}

function iconFor(kind: string): { glyph: string; category: string } {
  const match = ICONS.find(([pattern]) => pattern.test(kind));
  return match ? { glyph: match[1], category: match[2] } : { glyph: "◇", category: "generic" };
}

function preview(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (isRecord(value)) return "{…}";
  return String(value);
}

function copyButton(value: unknown, label: string): string {
  const copyData = escapeHtml(JSON.stringify(value));
  return `<button class="ast-copy" type="button" data-ast-action="copy" data-copy="${copyData}" title="Copy this node as JSON" aria-label="Copy ${escapeHtml(label)} node">⧉</button>`;
}

function renderEntry(key: string, value: unknown, depth: number): string {
  const label = readableLabel(key);

  if (depth > 80) {
    return `<li class="ast-node"><span class="ast-node__label">${escapeHtml(label)}</span><span class="ast-value">Maximum display depth reached</span></li>`;
  }

  if (Array.isArray(value)) {
    const children = value.map((item, index) => renderEntry(String(index), item, depth + 1)).join("");
    return `<li class="ast-node"><details class="ast-details"><summary class="ast-summary"><span class="ast-icon ast-icon--collection">▦</span><span class="ast-node__label">${escapeHtml(label)}</span><span class="ast-preview">${value.length} items</span>${copyButton(value, label)}</summary><ul class="ast-children">${children}</ul></details></li>`;
  }

  if (isRecord(value)) {
    const kind = typeof value.kind === "string" ? value.kind : "";
    const title = kind || label;
    const icon = iconFor(kind || key);
    const childEntries = Object.entries(value).filter(([childKey]) => childKey !== "kind");
    const scalarValue = value.value;
    const valuePreview = scalarValue !== undefined && !isRecord(scalarValue) && !Array.isArray(scalarValue)
      ? preview(scalarValue)
      : childEntries.length === 0 ? "" : `${childEntries.length} fields`;
    const children = childEntries
      .map(([childKey, childValue]) => renderEntry(childKey, childValue, depth + 1))
      .join("");
    const kindTag = kind ? `<span class="ast-kind">${escapeHtml(kind)}</span>` : "";
    const summary = `<span class="ast-icon ast-icon--${icon.category}">${icon.glyph}</span><span class="ast-node__label">${escapeHtml(title)}</span>${kindTag}<span class="ast-preview">${escapeHtml(valuePreview)}</span>${copyButton(value, title)}`;

    if (children.length === 0) {
      return `<li class="ast-node ast-node--leaf"><div class="ast-summary ast-summary--leaf">${summary}</div></li>`;
    }

    return `<li class="ast-node"><details class="ast-details" ${depth === 0 ? "open" : ""}><summary class="ast-summary">${summary}</summary><ul class="ast-children">${children}</ul></details></li>`;
  }

  const icon = iconFor(key);
  return `<li class="ast-node ast-node--leaf"><div class="ast-summary ast-summary--leaf"><span class="ast-icon ast-icon--${icon.category}">${icon.glyph}</span><span class="ast-node__label">${escapeHtml(label)}</span><span class="ast-value">${escapeHtml(preview(value))}</span>${copyButton(value, label)}</div></li>`;
}

/** Render an AST as a readable, collapsible tree with an optional raw JSON view. */
export function renderAst(ast: unknown): string {
  const tree = `<ul class="ast-children ast-children--root">${renderEntry("Expression", ast, 0)}</ul>`;
  const json = escapeHtml(JSON.stringify(ast, null, 2) ?? "undefined");

  return `<section class="ast-view" aria-label="Abstract syntax tree">
    <div class="ast-toolbar">
      <span class="ast-toolbar__title">AST tree</span>
      <span class="ast-toolbar__spacer"></span>
      <button type="button" class="ast-action" data-ast-action="expand">Expand all</button>
      <button type="button" class="ast-action" data-ast-action="collapse">Collapse all</button>
      <button type="button" class="ast-action" data-ast-action="raw">Raw JSON</button>
    </div>
    <div class="ast-tree">${tree}</div>
    <pre class="ast-raw" hidden>${json}</pre>
  </section>`;
}
