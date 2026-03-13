import { defineConfig } from "@playwright/test";

/**
 * Playwright config for running E2E tests against a live dev server.
 * Usage: npx playwright test --config=playwright.dev.config.ts
 *
 * Assumes `npm run dev` is already running on port 8080.
 * Does NOT build or start a server — connects to existing one.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 35000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  // No webServer — assumes dev server is already running
});
