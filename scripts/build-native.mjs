import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const manifest = resolve(root, "engine/calcpad-core/Cargo.toml");
const fixture = resolve(root, "tests/fixtures/civilkit-smoke.cpd");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Command failed (" + result.status + "): " + command + " " + args.join(" "));
  }
}

if (!existsSync(manifest)) throw new Error("Vendored Jabr Calcpad core manifest is missing.");
if (!existsSync(fixture)) throw new Error("Native engine smoke fixture is missing: " + fixture);

console.log("[1/2] Building Jabr's locally vendored Calcpad core and native runner...");
run("cargo", ["build", "--release", "--manifest-path", manifest, "--bin", "jabr-engine"]);

const executable = join(root, "engine", "target", "release", process.platform === "win32" ? "jabr-engine.exe" : "jabr-engine");
if (!existsSync(executable)) throw new Error("Jabr engine executable was not produced: " + executable);

const temp = mkdtempSync(join(tmpdir(), "jabr-engine-native-"));
try {
  const output = join(temp, "smoke.html");
  console.log("[2/2] Running the native engine against the smoke worksheet...");
  run(executable, [fixture, output]);
  const html = readFileSync(output, "utf8");
  if (!html.includes("42")) throw new Error("Native engine smoke output did not contain expected result 42.");
  console.log("Jabr vendored Calcpad core native build and smoke test passed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
