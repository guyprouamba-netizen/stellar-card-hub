// Plain Vite SPA configuration — produces a static dist/ that can be uploaded
// to any static host (cPanel public_html, Netlify, Cloudflare Pages, etc.).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { host: "::", port: 8080 },
  build: { outDir: "dist", sourcemap: false },
});
