import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // ✅ cache public assets (mp3 + index.json) for PWA/offline
      includeAssets: ["icons/vk7.png"],

      manifest: {
        name: "VK7Days",
        short_name: "VK7Days",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b1220",
        theme_color: "#0b1220",
        icons: [
          { src: "/icons/vk7.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/vk7.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  publicDir: "public",
});
