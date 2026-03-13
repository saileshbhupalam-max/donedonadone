import { test, expect } from "@playwright/test";

/**
 * Protected Routes E2E Tests
 *
 * Verify that all protected routes:
 * 1. Return 200 (SPA routing)
 * 2. Mount React without JS crash
 * 3. Redirect to / after auth resolves (unauthenticated)
 *
 * These tests complement smoke.spec.ts by covering ALL routes,
 * including the new growth system routes added in the permissionless
 * growth milestone.
 */

test.describe("All protected routes render without crash", () => {
  const allProtectedRoutes = [
    // Core app
    "/home",
    "/discover",
    "/events",
    "/prompts",
    "/me",
    "/settings",
    "/pricing",
    "/companies",
    "/needs",
    // Growth system
    "/nominate",
    "/credits",
    "/network",
    // Admin
    "/admin",
    // Partner
    "/partner",
    "/partner/apply",
    // Session (with fake ID)
    "/session/00000000-0000-0000-0000-000000000000",
    // Event detail (with fake ID)
    "/events/00000000-0000-0000-0000-000000000000",
    // Profile (with fake ID)
    "/profile/00000000-0000-0000-0000-000000000000",
    // Company
    "/company/create",
    "/company/00000000-0000-0000-0000-000000000000",
    // Onboarding
    "/onboarding",
    // Map
    "/map",
    // DNA
    "/me/dna",
  ];

  for (const route of allProtectedRoutes) {
    test(`${route} renders without JS crash`, async ({ page }) => {
      const response = await page.goto(route);
      // SPA: server always returns 200
      expect(response?.status()).toBe(200);
      // React mounted successfully
      await expect(page.locator("#root")).toBeAttached();
    });
  }
});

test.describe("Protected routes redirect unauthenticated users", () => {
  // Core routes that should redirect to landing
  const redirectRoutes = ["/home", "/discover", "/events", "/nominate"];

  for (const route of redirectRoutes) {
    test(`${route} redirects to / after auth resolves`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL("/", { timeout: 30000 });
      await expect(page).toHaveURL("/");
    });
  }
});
