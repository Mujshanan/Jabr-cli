import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "0.0.0.0" },
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        terminal: resolve(process.cwd(), "index.html"),
        engineTest: resolve(process.cwd(), "engine-test.html"),
      },
    },
  },
});
