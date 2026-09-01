import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // #130: pdf.js is its own chunk. The upload screen does not need it,
        // and it outlives our app code in the cache.
        manualChunks: (id) => (id.includes("pdfjs-dist") ? "pdfjs" : undefined),
      },
    },
  },
  plugins: [
    VitePWA({
      // #131: we tell the reader ourselves, so an old bundle never lingers.
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "필기웹",
        short_name: "필기웹",
        description: "PDF 위에 펜으로 필기하는 웹앱. 로그인도 서버도 없습니다.",
        lang: "ko",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#F3F0E8",
        theme_color: "#F3F0E8",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The pdf.js worker is 1.4MB and must be there offline.
        globPatterns: ["**/*.{js,css,html,png,svg,mjs}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "index.html",
      },
    }),
  ],
});
