import { test, expect } from "@playwright/test";

/**
 * Public Routes E2E Tests
 *
 * Tests for routes that should be accessible without authentication:
 * - / (landing page)
 * - /space/:id/insights (public venue insights)
 * - /space/:id/live (public live view)
 * - /invite/:code (invite redirect)
 * - /partners (partner venues listing, redirects when unauthed)
 * - /* (404 catch-all)
 */

test.describe("Space Insights (public venue page)", () => {
  test("/space/test-id/insights returns 200 and mounts React", async ({ page }) => {
    const response = await page.goto("/space/test-id/insights");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
  });

  test("/space/test-id/insights does not show 404", async ({ page }) => {
    await page.goto("/space/test-id/insights");
    await page.waitForLoadState("networkidle");
    const has404 = await page.locator("h1:has-text('404')").isVisible().catch(() => false);
    expect(has404).toBe(false);
  });

  test("/space/nonexistent/insights handles missing venue gracefully", async ({ page }) => {
    const response = await page.goto("/space/nonexistent-venue-id/insights");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
    // Should show empty state or loading, not crash
  });
});

test.describe("Space Live (public live view)", () => {
  test("/space/test-id/live returns 200", async ({ page }) => {
    const response = await page.goto("/space/test-id/live");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
  });
});

test.describe("Invite redirect", () => {
  test("/invite/test-code returns 200", async ({ page }) => {
    const response = await page.goto("/invite/test-code");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
  });
});

test.describe("404 page", () => {
  test("shows 404 heading for unknown routes", async ({ page }) => {
    await page.goto("/this-page-definitely-does-not-exist");
    await expect(page.locator("h1")).toContainText("404", { timeout: 30000 });
  });

  test("has 'Take me back' link pointing to /home", async ({ page }) => {
    await page.goto("/unknown-page");
    const link = page.locator("a", { hasText: "Take me back" });
    await expect(link).toBeVisible({ timeout: 30000 });
    await expect(link).toHaveAttribute("href", "/home");
  });

  test("404 page does not have unexpected console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/definitely-not-a-route");
    await page.waitForLoadState("networkidle");

    // Filter out known benign errors (supabase, fetch, manifest, intentional 404 logging)
    const realErrors = errors.filter(
      (e) => !/supabase|auth|fetch|manifest|sentry|CORS|net::ERR|workbox|service.worker|404 Error|non-existent route/i.test(e)
    );
    expect(realErrors).toHaveLength(0);
  });
});
