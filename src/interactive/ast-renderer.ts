type AstRecord = Record<string, unknown>;

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

function leaf(value: unknown): string {
  if (typeof value === "string") return escapeHtml(JSON.stringify(value));
  if (value === null) return "null";
  return escapeHtml(String(value));
}

function renderEntry(key: string, value: unknown, depth: number): string {
  const label = `<span class="ast-key">${escapeHtml(key)}</span>`;

  if (depth > 80) {
    return `<li class="ast-node">${label}<span class="ast-value">Maximum display depth reached</span></li>`;
  }

  if (Array.isArray(value)) {
    const children = value.map((item, index) => renderEntry(String(index), item, depth + 1)).join("");
    return `<li class="ast-node">${label}<ul class="ast-children">${children}</ul></li>`;
  }

  if (isRecord(value)) {
    const children = Object.entries(value)
      .map(([childKey, childValue]) => renderEntry(childKey, childValue, depth + 1))
      .join("");
    return `<li class="ast-node">${label}<ul class="ast-children">${children}</ul></li>`;
  }

  return `<li class="ast-node">${label}<span class="ast-value">${leaf(value)}</span></li>`;
}

/** Render Mathlex's JSON AST as an escaped, nested HTML tree. */
export function renderAst(ast: unknown): string {
  if (isRecord(ast)) {
    const entries = Object.entries(ast)
      .map(([key, value]) => renderEntry(key, value, 0))
      .join("");
    return `<div class="ast-tree"><ul class="ast-children ast-children--root">${entries}</ul></div>`;
  }

  return `<div class="ast-tree"><ul class="ast-children ast-children--root">${renderEntry("root", ast, 0)}</ul></div>`;
}
