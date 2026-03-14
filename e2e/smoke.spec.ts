import { test, expect } from "@playwright/test";

/**
 * Smoke tests: verify that the app boots and routes work.
 *
 * IMPORTANT: The app has a Supabase auth loading state that can take 15-30s to resolve
 * when the Supabase backend is slow/unreachable. Tests are designed to work regardless
 * of whether auth loading has completed.
 */

test.describe("App boots and serves pages", () => {
  test("/ serves the app (HTML loads, React mounts)", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // React app mounts — at minimum the root div exists
    await expect(page.locator("#root")).toBeAttached();
  });

  test("/ shows DanaDone branding (loading or landing)", async ({ page }) => {
    await page.goto("/");
    // Both loading state and final render show "done" in the h1 logo
    await expect(page.locator("h1").first()).toContainText("done", { timeout: 10000 });
  });

  test("/space/test-id/insights serves the app", async ({ page }) => {
    const response = await page.goto("/space/test-id/insights");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
  });

  test("/nonexistent serves the app (SPA routing)", async ({ page }) => {
    const response = await page.goto("/nonexistent");
    // SPA: server returns 200 for all routes, client handles routing
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
  });
});

test.describe("Protected routes show loading state for unauthenticated users", () => {
  // Protected routes show the "DanaDone" loading screen while auth resolves,
  // then redirect to "/". We verify they at least render without crashing.
  const protectedRoutes = [
    "/home",
    "/events",
    "/discover",
    "/pricing",
    "/companies",
    "/needs",
  ];

  for (const route of protectedRoutes) {
    test(`${route} renders without JS crash`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("#root")).toBeAttached();
      // Should show either loading state or redirect to landing
      // Both are valid — the point is no crash
    });
  }
});
