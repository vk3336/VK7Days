import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    // Temporarily disabled to prevent service worker conflicts
    // VitePWA({
    //   registerType: "autoUpdate",
    //   workbox: {
    //     globPatterns: ["**/*.{js,css,html,ico,png,svg,mp3}"],
    //     maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for audio files
    //     runtimeCaching: [],
    //   },

    //   // ✅ cache public assets (mp3 + index.json) for PWA/offline
    //   includeAssets: ["icons/vk7.png", "ringtone/Dholida.mp3"],

    //   manifest: {
    //     name: "VK7Days",
    //     short_name: "VK7Days",
    //     start_url: "/",
    //     scope: "/",
    //     display: "standalone",
    //     background_color: "#0b1220",
    //     theme_color: "#0b1220",
    //     icons: [
    //       { src: "/icons/vk7.png", sizes: "192x192", type: "image/png" },
    //       { src: "/icons/vk7.png", sizes: "512x512", type: "image/png" },
    //     ],
    //   },
    // }),
  ],
});
