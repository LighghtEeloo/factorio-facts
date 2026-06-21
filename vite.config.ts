import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/factorio-facts/" : "/",
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (normalizedId.includes("/node_modules/react")) {
            return "react";
          }

          if (normalizedId.includes("/node_modules/scheduler")) {
            return "react";
          }

          if (normalizedId.includes("/node_modules/lz-string")) {
            return "url-codec";
          }

          if (normalizedId.includes("/node_modules/@xyflow/react")) {
            return "graph-vendor";
          }

          if (normalizedId.includes("/data/vendor/factoriolab/")) {
            return "factoriolab-data";
          }

          return undefined;
        },
      },
    },
  },
}));
