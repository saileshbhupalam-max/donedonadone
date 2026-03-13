import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "offline.html"],
      manifest: {
        name: "FocusClub",
        short_name: "FocusClub",
        description: "Cowork with your people at great cafes",
        theme_color: "#18181b",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/home",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/sw-push\.js/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/.*tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "map-tiles", expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 } },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: { cacheName: "images", expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 30 } },
          },
          {
            urlPattern: /\.(woff2?|ttf|eot)$/i,
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: 86400 * 365 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Core React vendor chunk
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Supabase chunk
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // Radix UI + styling utilities
          if (id.includes('node_modules/@radix-ui/') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge')) {
            return 'vendor-ui';
          }
          // Charts
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-vendor')) {
            return 'vendor-charts';
          }
          // Animation
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-animation';
          }
          // Date handling
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-dates';
          }
          // Media/sharing libs
          if (id.includes('node_modules/html2canvas') ||
              id.includes('node_modules/qrcode')) {
            return 'vendor-media';
          }
          // Tanstack query
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
        },
      },
    },
    chunkSizeWarningLimit: 420,
  },
}));
