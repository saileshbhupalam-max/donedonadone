import { test, expect } from "@playwright/test";

/**
 * Verify that pages don't produce unexpected console errors on load.
 *
 * Known benign errors are filtered out:
 * - Supabase auth-related messages (expected when not logged in)
 * - Failed fetch requests (Supabase API calls that fail without auth)
 * - 404 console.error from NotFound page (intentional logging)
 */

const BENIGN_PATTERNS = [
  /auth/i,
  /Failed to fetch/i,
  /net::ERR_/i,
  /supabase/i,
  /401/,
  /403/,
  /CORS/i,
  /hydrat/i,
  /ResizeObserver/i,
  /\[vite\]/i,
  /chrome-extension/i,
  /404 Error/i,
  /non-existent route/i,
  /sentry/i,
  /dsn/i,
  /FetchError/i,
  /TypeError.*fetch/i,
  /AbortError/i,
  /service.worker/i,
  /workbox/i,
];

function isBenign(msg: string): boolean {
  return BENIGN_PATTERNS.some((p) => p.test(msg));
}

test.describe("Console errors on public pages", () => {
  const publicPages = [
    { name: "Landing", path: "/" },
    { name: "Space Insights", path: "/space/test-id/insights" },
    { name: "404", path: "/nonexistent" },
  ];

  for (const { name, path } of publicPages) {
    test(`${name} page (${path}) has no unexpected console errors`, async ({
      page,
    }) => {
      const errors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const realErrors = errors.filter((e) => !isBenign(e));

      if (realErrors.length > 0) {
        console.log(`Unexpected console errors on ${path}:`, realErrors);
      }

      expect(realErrors).toHaveLength(0);
    });
  }
});
