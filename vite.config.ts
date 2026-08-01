// Plain Vite SPA configuration — produces a static dist/ that can be uploaded
// to any static host (cPanel public_html, Netlify, Cloudflare Pages, etc.).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), VitePWA({
    strategies: "generateSW",
    registerType: "autoUpdate",
    injectRegister: null,
    filename: "sw.js",
    devOptions: { enabled: false },
    workbox: {
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/~oauth/],
      runtimeCaching: [
        { urlPattern: ({ request }) => request.mode === "navigate", handler: "NetworkFirst", options: { cacheName: "fasopay-pages", networkTimeoutSeconds: 4 } },
        { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*\.[a-f0-9]+\./.test(url.pathname), handler: "CacheFirst", options: { cacheName: "fasopay-assets" } },
      ],
    },
    manifest: false,
  })],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { host: "::", port: 8080 },
  build: { outDir: "dist", sourcemap: false },
});
