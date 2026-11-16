import init, { parse_math } from "./wasm/jabr_mathlex";

let initialization: Promise<void> | undefined;

/** Initialize the Rust/WebAssembly parser once, then parse a plain-text expression. */
export async function parseMathExpression(input: string): Promise<unknown> {
  if (!initialization) initialization = init();
  await initialization;
  return JSON.parse(parse_math(input)) as unknown;
}
