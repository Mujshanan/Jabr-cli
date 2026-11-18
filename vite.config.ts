import { defineConfig } from "vite";

import packageJson from "./package.json";

const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

export default defineConfig({
  plugins: [{
    name: "inject-package-version",
    transformIndexHtml(html) {
      return html.replace(/%APP_VERSION%/g, packageJson.version);
    },
  }],
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
