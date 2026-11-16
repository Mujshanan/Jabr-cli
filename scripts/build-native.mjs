import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const upstream = resolve(root, "vendor/civilkit-calcs");
const manifest = join(upstream, "calcpad-cli", "Cargo.toml");
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

if (!existsSync(manifest)) {
  throw new Error("CivilKit submodule is missing. Run: git submodule update --init --recursive");
}
if (!existsSync(fixture)) {
  throw new Error("Native CLI smoke fixture is missing: " + fixture);
}

console.log("[1/2] Building the CivilKit native CLI...");
run("cargo", ["build", "--locked", "--release", "--manifest-path", manifest]);

const executable = join(
  upstream,
  "target",
  "release",
  process.platform === "win32" ? "Cli.exe" : "Cli",
);
if (!existsSync(executable)) {
  throw new Error("CivilKit CLI executable was not produced: " + executable);
}

const temp = mkdtempSync(join(tmpdir(), "jabr-civilkit-native-"));
try {
  const output = join(temp, "smoke.html");
  console.log("[2/2] Running the native CLI against the Jabr smoke worksheet...");
  run(executable, [fixture, output, "-b", "-s"]);
  const html = readFileSync(output, "utf8");
  if (!html.includes('class="calcpad-output"') || !html.includes("42")) {
    throw new Error("Native CLI smoke output did not contain the expected calculation result.");
  }
  console.log("CivilKit native CLI build and smoke test passed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
