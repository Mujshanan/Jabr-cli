export type SequenceCondition = "always" | "success";

export interface SequenceStep {
  readonly command: string;
  readonly condition: SequenceCondition;
}

/** Split a command line on ; and && while preserving quoted and escaped separators. */
export function parseCommandSequence(input: string): SequenceStep[] {
  const steps: SequenceStep[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let nextCondition: SequenceCondition = "always";

  const push = () => {
    const command = token.trim();
    if (command) steps.push({ command, condition: nextCondition });
    token = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (escaping) {
      token += character;
      escaping = false;
      continue;
    }

    if (character === "\\" && quote !== "'") {
      token += character;
      escaping = true;
      continue;
    }

    if (quote) {
      token += character;
      if (character === quote) quote = null;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      token += character;
      continue;
    }

    if (character === ";") {
      push();
      nextCondition = "always";
      continue;
    }

    if (character === "&" && input[index + 1] === "&") {
      push();
      nextCondition = "success";
      index += 1;
      continue;
    }

    token += character;
  }

  if (quote) throw new Error("Unclosed quote in command sequence.");
  if (escaping) token += "\\";
  push();
  return steps;
}

export interface SequenceResult {
  readonly command: string;
  readonly condition: SequenceCondition;
  readonly status: "success" | "error" | "skipped";
  readonly error?: string;
}

export interface DispatchOutcome {
  readonly ok: boolean;
  readonly error?: string;
}

/** Execute sequence steps in order; && skips its next step after a failure. */
export async function executeCommandSequence(
  input: string,
  dispatch: (command: string) => Promise<DispatchOutcome>,
): Promise<SequenceResult[]> {
  const steps = parseCommandSequence(input);
  const results: SequenceResult[] = [];
  let previousSucceeded = true;

  for (const step of steps) {
    if (step.condition === "success" && !previousSucceeded) {
      results.push({ command: step.command, condition: step.condition, status: "skipped" });
      continue;
    }

    try {
      const outcome = await dispatch(step.command);
      previousSucceeded = outcome.ok;
      results.push({
        command: step.command,
        condition: step.condition,
        status: outcome.ok ? "success" : "error",
        ...(outcome.error ? { error: outcome.error } : {}),
      });
    } catch (error) {
      previousSucceeded = false;
      results.push({
        command: step.command,
        condition: step.condition,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/** Execute a .jabr text script. Blank lines and # comments are ignored. */
export async function executeCommandScript(
  source: string,
  dispatch: (command: string) => Promise<DispatchOutcome>,
): Promise<SequenceResult[]> {
  const results: SequenceResult[] = [];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;

    const lineResults = await executeCommandSequence(line, dispatch);
    results.push(...lineResults);
    if (lineResults.some((result) => result.status === "error")) break;
  }

  return results;
}
