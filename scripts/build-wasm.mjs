import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const developmentBuild = process.argv.includes("--dev");
const wasmPackProfileArgs = developmentBuild ? ["--dev"] : [];
const coreWasm = resolve(root, "engine/calcpad-wasm/Cargo.toml");
const highlighterWasm = resolve(root, "engine/calcpad-highlighter-wasm/Cargo.toml");
const mathlexManifest = resolve(root, "rust/mathlex-bridge/Cargo.toml");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Command failed (" + result.status + "): " + command + " " + args.join(" "));
}

for (const [label, manifest] of [["Jabr Calcpad WASM", coreWasm], ["Jabr highlighter WASM", highlighterWasm], ["Mathlex bridge", mathlexManifest]]) {
  if (!existsSync(manifest)) throw new Error(label + " manifest is missing: " + manifest);
}

console.log("[1/4] Installing the wasm32-unknown-unknown target...");
run("rustup", ["target", "add", "wasm32-unknown-unknown"]);

console.log("[2/4] Building Jabr's local Calcpad calculation engine for the browser...");
run("wasm-pack", ["build", "engine/calcpad-wasm", "--target", "web", "--out-dir", "../../src/engine/civilkit-wasm", "--out-name", "civilkit_engine", ...wasmPackProfileArgs]);

console.log("[3/4] Building Jabr's local tokenizer/highlighter for browser inspection...");
run("wasm-pack", ["build", "engine/calcpad-highlighter-wasm", "--target", "web", "--out-dir", "../../src/engine/civilkit-highlighter-wasm", "--out-name", "civilkit_highlighter", ...wasmPackProfileArgs]);

console.log("[4/4] Building the existing Mathlex compatibility bridge...");
run("wasm-pack", ["build", "rust/mathlex-bridge", "--target", "web", "--out-dir", "../../src/engine/wasm", "--out-name", "jabr_mathlex", ...wasmPackProfileArgs]);

console.log("Vendored Calcpad core, highlighter, and Mathlex WebAssembly packages built successfully.");
