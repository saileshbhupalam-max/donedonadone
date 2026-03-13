import { test, expect } from "@playwright/test";

/**
 * Navigation tests — verify routing behavior.
 *
 * Note: Protected route redirects depend on Supabase auth resolving,
 * which can be very slow (15-30s) when the backend is unreachable.
 * We test redirect behavior with generous timeouts.
 */

test.describe("Navigation and routing", () => {
  test("Landing page serves HTML and React mounts", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeAttached();
    // Should have some text content (loading state or full page)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("404 route shows 404 content once auth resolves", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-at-all");
    // Wait for the 404 text to appear (may need to wait for auth loading)
    await expect(page.locator("text=404")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=Take me back")).toBeVisible();
  });

  test("404 page 'Take me back' link points to /home", async ({ page }) => {
    await page.goto("/unknown-page");
    // Wait for 404 content
    const link = page.locator("a", { hasText: "Take me back" });
    await expect(link).toBeVisible({ timeout: 30000 });
    await expect(link).toHaveAttribute("href", "/home");
  });

  test("/home redirects to / after auth resolves", async ({ page }) => {
    await page.goto("/home");
    // Auth loading can take a while, then ProtectedRoute redirects to "/"
    await page.waitForURL("/", { timeout: 30000 });
    await expect(page).toHaveURL("/");
  });
});
