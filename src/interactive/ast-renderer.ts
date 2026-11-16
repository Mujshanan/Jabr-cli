type AstRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AstRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function appendValue(parent: HTMLElement, value: unknown, depth: number): void {
  if (depth > 80) {
    const limit = document.createElement("span");
    limit.className = "ast-value";
    limit.textContent = "Maximum display depth reached";
    parent.append(limit);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendEntry(parent, String(index), item, depth + 1);
    });
    return;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, child]) => {
      appendEntry(parent, key, child, depth + 1);
    });
    return;
  }

  const leaf = document.createElement("span");
  leaf.className = "ast-value";
  leaf.textContent = describe(value);
  parent.append(leaf);
}

function appendEntry(parent: HTMLElement, key: string, value: unknown, depth: number): void {
  const item = document.createElement("li");
  item.className = "ast-node";

  const label = document.createElement("span");
  label.className = "ast-key";
  label.textContent = key;
  item.append(label);

  if (Array.isArray(value) || isRecord(value)) {
    const children = document.createElement("ul");
    children.className = "ast-children";
    appendValue(children, value, depth);
    item.append(children);
  } else {
    const leaf = document.createElement("span");
    leaf.className = "ast-value";
    leaf.textContent = describe(value);
    item.append(leaf);
  }

  parent.append(item);
}

/** Render Mathlex's JSON AST as safe, inspectable HTML (no innerHTML or eval). */
export function renderAst(ast: unknown): HTMLElement {
  const tree = document.createElement("div");
  tree.className = "ast-tree";
  const list = document.createElement("ul");
  list.className = "ast-children ast-children--root";
  appendValue(list, ast, 0);
  tree.append(list);
  return tree;
}
