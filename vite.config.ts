import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project below /Jabr-math/; Vite dev stays at /.
  base: command === "build" ? "/Jabr-math/" : "/",
  server: { host: "0.0.0.0" },
  build: { target: "es2020" },
}));
