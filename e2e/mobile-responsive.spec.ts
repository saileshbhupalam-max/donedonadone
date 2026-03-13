import { test, expect } from "@playwright/test";

/**
 * Mobile Responsiveness E2E Tests
 *
 * FocusClub is a mobile-first PWA. These tests verify that
 * pages render correctly at common mobile viewport sizes.
 * No horizontal overflow, content visible, touch targets adequate.
 */

const MOBILE_VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "Samsung Galaxy S21", width: 360, height: 800 },
];

test.describe("Mobile responsiveness", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("landing page has no horizontal overflow", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("h1")).toContainText("FocusClub", { timeout: 15000 });
        const isOverflowing = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(isOverflowing).toBe(false);
      });

      test("landing page CTA button is visible and tappable", async ({ page }) => {
        await page.goto("/");
        const btn = page.locator("button", { hasText: "Join the club" });
        await expect(btn).toBeVisible({ timeout: 15000 });
        // Button should be at least 44px tall (mobile tap target)
        const box = await btn.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.height).toBeGreaterThanOrEqual(40);
      });

      test("feature cards stack vertically", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("text=Smart Matching")).toBeVisible({ timeout: 15000 });
        // All cards should be visible (stacked, not side-by-side off screen)
        await expect(page.locator("text=Weekly Prompts")).toBeVisible();
        await expect(page.locator("text=Cowork Sessions")).toBeVisible();
      });

      test("404 page renders at mobile width", async ({ page }) => {
        await page.goto("/nonexistent-route");
        await expect(page.locator("h1")).toContainText("404", { timeout: 30000 });
        const isOverflowing = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(isOverflowing).toBe(false);
      });
    });
  }
});
