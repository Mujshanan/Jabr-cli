import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: { host: environment?.CODESPACES ? "0.0.0.0" : "127.0.0.1" },
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        terminal: "index.html",
        engineTest: "engine-test.html",
      },
    },
  },
});
