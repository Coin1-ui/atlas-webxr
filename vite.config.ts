import { defineConfig } from 'vite'
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: '/atlas-webxr/',
  server: {
    host: true,
    https: true,
  },
  preview: {
    host: true,
    https: true,
  },
  plugins: [
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Atlas Field AR",
        short_name: "Atlas AR",
        description: "Zero-cost procedural AR training in the browser",
        theme_color: "#1565c0",
        background_color: "#0a1628",
        display: "standalone",
        start_url: "/atlas-webxr/",
        scope: "/atlas-webxr/",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,json,glb}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
});
