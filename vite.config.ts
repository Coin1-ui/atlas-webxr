import { defineConfig, loadEnv } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { customModelsApiPlugin } from "./plugins/custom-models-api";
import { atlasSaasApiPlugin } from "./plugins/atlas-saas-api";
import { salesDeckPlugin } from "./plugins/sales-deck";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  /** Amplify: `/` — GitHub Pages subfolder: `/atlas-webxr/` */
  const base = env.VITE_BASE_PATH || "/";

  return {
    base,
    define: {
      global: "globalThis",
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, "index.html"),
          salesDeck: path.resolve(rootDir, "sales-deck.html"),
        },
      },
    },
    server: {
      host: true,
      https: true,
    },
    preview: {
      host: true,
      https: true,
    },
    plugins: [
      salesDeckPlugin(),
      atlasSaasApiPlugin(),
      customModelsApiPlugin(),
      basicSsl(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        includeAssets: ["favicon.svg", "favicon-16.png", "favicon-32.png", "apple-touch-icon-180.png", "icon-512.png"],
        manifest: {
          name: "Atlas Field AR",
          short_name: "Atlas AR",
          description: "Browser AR model placement",
          theme_color: "#050a14",
          background_color: "#050a14",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            {
              src: "favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "favicon-32.png",
              sizes: "32x32",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "apple-touch-icon-180.png",
              sizes: "180x180",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{html,ico,svg,json,webmanifest}"],
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.js$/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "atlas-js-assets",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
                networkTimeoutSeconds: 8,
              },
            },
            {
              urlPattern: /\/assets\/.*\.css$/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "atlas-css-assets",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
      }),
    ],
  };
});
