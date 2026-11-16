import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "0.0.0.0" },
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
