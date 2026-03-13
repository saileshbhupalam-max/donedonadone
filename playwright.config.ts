import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Auth loading with Supabase can take a while to resolve with placeholder creds
  timeout: 30000,
  retries: 1,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    // Build with e2e env (placeholder Supabase creds) then serve
    command: "npm run build:e2e && npx vite preview --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
