import { test, expect } from "@playwright/test";

/**
 * Growth System E2E Tests
 *
 * Tests for the permissionless growth engine pages:
 * - /nominate (venue nomination flow)
 * - /credits (Focus Credits page)
 * - /network (cross-space network)
 * - Growth components on /home (NeighborhoodUnlock)
 *
 * These pages are protected — unauthenticated users get redirected to /.
 * We verify the redirect behavior and that pages don't crash.
 */

test.describe("Growth system pages (unauthenticated)", () => {
  const growthRoutes = [
    { path: "/nominate", name: "Nominate Venue" },
    { path: "/credits", name: "Focus Credits" },
    { path: "/network", name: "Cross-Space Network" },
  ];

  for (const { path, name } of growthRoutes) {
    test(`${name} (${path}) redirects to / when not authenticated`, async ({ page }) => {
      await page.goto(path);
      // Protected routes redirect to landing after auth resolves
      await page.waitForURL("/", { timeout: 30000 });
      await expect(page).toHaveURL("/");
    });

    test(`${name} (${path}) does not crash on direct access`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("#root")).toBeAttached();
    });
  }
});

test.describe("Venue nomination page structure", () => {
  test("/nominate serves valid HTML with React root", async ({ page }) => {
    const response = await page.goto("/nominate");
    expect(response?.status()).toBe(200);
    const html = await page.content();
    expect(html).toContain("FocusClub");
    await expect(page.locator("#root")).toBeAttached();
  });
});

test.describe("Credits page structure", () => {
  test("/credits serves valid HTML with React root", async ({ page }) => {
    const response = await page.goto("/credits");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#root")).toBeAttached();
  });
});
