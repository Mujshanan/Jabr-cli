import { defineConfig } from "vite";

const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

export default defineConfig({
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
