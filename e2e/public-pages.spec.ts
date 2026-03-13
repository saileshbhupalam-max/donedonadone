import { test, expect } from "@playwright/test";

/**
 * Public page content tests.
 *
 * These tests verify content on pages that should be accessible without auth.
 * However, even public pages go through AuthProvider loading, so we use
 * generous timeouts.
 */

test.describe("Landing page", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/donedonadone/i);
  });

  test("shows donedonadone branding immediately", async ({ page }) => {
    await page.goto("/");
    // Both loading state and final render show "done" in the h1 logo
    await expect(page.locator("h1").first()).toContainText("done", { timeout: 10000 });
  });

  test("displays feature cards after auth resolves", async ({ page }) => {
    await page.goto("/");
    // Features appear after loading=false — now in "Why" section
    await expect(page.locator("text=Smart Matching")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=Curated Sessions")).toBeVisible();
    await expect(page.locator("text=Real Community")).toBeVisible();
  });

  test("has sign-in button after auth resolves", async ({ page }) => {
    await page.goto("/");
    // Wait for the actual landing content (not loading state)
    await expect(page.locator("text=Smart Matching")).toBeVisible({ timeout: 30000 });
    // CTA buttons should be present
    const buttons = page.locator("button");
    await expect(buttons.first()).toBeVisible();
  });
});

test.describe("Space Insights (public)", () => {
  test("/space/fake-id/insights does not show 404", async ({ page }) => {
    await page.goto("/space/fake-id/insights");
    // Should not show 404 — SpaceInsights is a public route
    // Wait for either content or empty state
    await page.waitForLoadState("networkidle");
    // The h1 "404" should NOT appear (this route exists)
    const has404 = await page.locator("h1:has-text('404')").isVisible().catch(() => false);
    expect(has404).toBe(false);
  });
});

test.describe("404 page", () => {
  test("shows 404 heading", async ({ page }) => {
    await page.goto("/nonexistent-route");
    await expect(page.locator("h1")).toContainText("404", { timeout: 30000 });
  });

  test("has navigation link back to app", async ({ page }) => {
    await page.goto("/nonexistent-route");
    const backLink = page.locator("a", { hasText: "Take me back" });
    await expect(backLink).toBeVisible({ timeout: 30000 });
  });
});
