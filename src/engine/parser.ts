import type { ParsedCommand } from "./types";

export function parseCommand(input: string): ParsedCommand {
  const tokens: string[] = [];
  let token = "";
  let tokenStarted = false;
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const character of input.trim()) {
    if (escaping) {
      token += character;
      tokenStarted = true;
      escaping = false;
      continue;
    }

    if (character === "\\" && quote !== "'") {
      escaping = true;
      tokenStarted = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = null;
      else token += character;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(token);
        token = "";
        tokenStarted = false;
      }
      continue;
    }

    token += character;
    tokenStarted = true;
  }

  if (escaping) token += "\\";
  if (quote) throw new Error("Unclosed quote in command.");
  if (tokenStarted) tokens.push(token);

  const [name = "", ...args] = tokens;
  return { name: name.toLowerCase(), args };
}
