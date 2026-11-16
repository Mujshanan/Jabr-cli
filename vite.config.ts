import { defineConfig } from "vite";

export default defineConfig({
  server: { host: process.env.CODESPACES ? "0.0.0.0" : "127.0.0.1" },
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
