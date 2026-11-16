import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const civilkitManifest = resolve(root, "vendor/civilkit-calcs/calcpad-wasm/Cargo.toml");
const highlighterManifest = resolve(root, "vendor/civilkit-calcs/calcpad-highlighter-wasm/Cargo.toml");
const mathlexManifest = resolve(root, "rust/mathlex-bridge/Cargo.toml");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Command failed (" + result.status + "): " + command + " " + args.join(" "));
  }
}

if (!existsSync(civilkitManifest)) {
  throw new Error("CivilKit submodule is missing. Run: git submodule update --init --recursive");
}
if (!existsSync(highlighterManifest)) {
  throw new Error("CivilKit highlighter WASM manifest is missing.");
}
if (!existsSync(mathlexManifest)) {
  throw new Error("The existing Mathlex bridge manifest is missing.");
}

console.log("[1/3] Installing the wasm32-unknown-unknown target...");
run("rustup", ["target", "add", "wasm32-unknown-unknown"]);

console.log("[2/3] Building CivilKit's worksheet calculation engine for the browser...");
run("wasm-pack", [
  "build",
  "vendor/civilkit-calcs/calcpad-wasm",
  "--target",
  "web",
  "--out-dir",
  "../../../src/engine/civilkit-wasm",
  "--out-name",
  "civilkit_engine",
]);

console.log("[3/4] Building CivilKit tokenizer/highlighter for browser inspection...");
run("wasm-pack", ["build", "vendor/civilkit-calcs/calcpad-highlighter-wasm", "--target", "web", "--out-dir", "../../../src/engine/civilkit-highlighter-wasm", "--out-name", "civilkit_highlighter"]);

console.log("[4/4] Building the existing Mathlex parser bridge used by the terminal prototype...");
run("wasm-pack", [
  "build",
  "rust/mathlex-bridge",
  "--target",
  "web",
  "--out-dir",
  "../../src/engine/wasm",
  "--out-name",
  "jabr_mathlex",
]);

console.log("CivilKit engine, CivilKit highlighter, and Mathlex WebAssembly packages built successfully.");
