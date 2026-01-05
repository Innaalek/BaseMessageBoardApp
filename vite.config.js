import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /.*\.jsx?$/, // разрешает JSX в .js/.jsx
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "./index.html",
    },
  },
});
