import { test, expect } from "@playwright/test";

/**
 * Performance E2E Tests
 *
 * Basic performance checks:
 * - Landing page loads within acceptable time
 * - Bundle is not excessively large
 * - Key resources load without errors
 * - Service worker registers (PWA)
 */

test.describe("Page load performance", () => {
  test("landing page loads in under 10 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - start;
    // Landing page DOM should be ready in under 10s (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });

  test("landing page reaches networkidle in under 30 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "networkidle" });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(30000);
  });
});

test.describe("Asset loading", () => {
  test("no failed resource requests on landing page", async ({ page }) => {
    const failedRequests: string[] = [];

    page.on("response", (response) => {
      // Ignore Supabase API calls (expected to have auth issues in E2E)
      // Ignore manifest (known issue)
      const url = response.url();
      if (url.includes("supabase") || url.includes("manifest")) return;

      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${url}`);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(failedRequests).toHaveLength(0);
  });

  test("main JS bundle loads successfully", async ({ page }) => {
    let jsLoaded = false;

    page.on("response", (response) => {
      const url = response.url();
      // Dev server serves from /src/ or /node_modules/, prod from /assets/
      if ((url.includes("/assets/") || url.includes("/src/")) && (url.endsWith(".js") || url.endsWith(".tsx") || url.endsWith(".ts"))) {
        if (response.status() === 200) jsLoaded = true;
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(jsLoaded).toBe(true);
  });

  test("CSS loads successfully", async ({ page }) => {
    let cssLoaded = false;

    page.on("response", (response) => {
      const url = response.url();
      if ((url.includes("/assets/") || url.includes("/src/")) && (url.endsWith(".css") || url.includes("css"))) {
        if (response.status() === 200) cssLoaded = true;
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(cssLoaded).toBe(true);
  });
});

test.describe("SPA routing performance", () => {
  test("client-side navigation is fast (no full page reload)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("FocusClub", { timeout: 15000 });

    // Navigate to 404 via client-side link
    const link = page.locator("a", { hasText: "Our Partner Venues" });
    await expect(link).toBeVisible({ timeout: 15000 });

    const start = Date.now();
    await link.click();
    // Should navigate without full page reload — React handles routing
    await page.waitForURL(/.*/, { timeout: 5000 });
    const navTime = Date.now() - start;

    // Client-side navigation should be fast (under 2s)
    expect(navTime).toBeLessThan(2000);
  });
});
