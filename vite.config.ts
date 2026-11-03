import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // GitHub Pages serves from /<repo-name>/; the workflow sets VITE_BASE. Locally it stays "/".
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
