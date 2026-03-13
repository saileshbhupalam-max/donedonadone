import { test, expect } from "@playwright/test";

/**
 * Landing Page E2E Tests
 *
 * Comprehensive tests for the public landing page (/).
 * The landing page is the first thing users see — it must:
 * - Load fast and show branding immediately
 * - Display all feature cards and value props
 * - Have a working Google sign-in CTA
 * - Show trust signals (women-only, verified, private reporting)
 * - Link to partner venues
 * - Be responsive (mobile-first design)
 */

test.describe("Landing page branding and hero", () => {
  test("shows donedonadone heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("donedonadone", { timeout: 15000 });
  });

  test("shows tagline", async ({ page }) => {
    await page.goto("/");
    // Tagline is split across text nodes: "Where strangers become" + "coworkers become friends."
    await expect(page.locator("h2")).toContainText("coworkers become friends", { timeout: 15000 });
  });

  test("shows description paragraph", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=3-5 people at great cafes")).toBeVisible({ timeout: 15000 });
  });

  test("has 'Join the club' CTA button", async ({ page }) => {
    await page.goto("/");
    const joinBtn = page.locator("button", { hasText: "Join the club" });
    await expect(joinBtn).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Landing page how-it-works section", () => {
  test("shows all 3 steps", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Book a session")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Meet your table")).toBeVisible();
    await expect(page.locator("text=Focus together")).toBeVisible();
  });

  test("step descriptions are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Pick a cafe, pick a time")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=3-5 compatible people")).toBeVisible();
    await expect(page.locator("text=Work, connect, and come back")).toBeVisible();
  });
});

test.describe("Landing page feature cards", () => {
  test("shows Smart Matching card", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Smart Matching")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=matched with people who work like you")).toBeVisible();
  });

  test("shows Weekly Prompts card", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Weekly Prompts")).toBeVisible({ timeout: 15000 });
  });

  test("shows Cowork Sessions card", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Cowork Sessions")).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Landing page trust signals", () => {
  test("shows women-only sessions badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Women-only sessions available")).toBeVisible({ timeout: 15000 });
  });

  test("shows verified community badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Verified community members")).toBeVisible({ timeout: 15000 });
  });

  test("shows private reporting badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Private reporting system")).toBeVisible({ timeout: 15000 });
  });

  test("shows HSR Layout location", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Starting in HSR Layout, Bangalore")).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Landing page footer", () => {
  test("has partner venues link", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("a", { hasText: "Our Partner Venues" });
    await expect(link).toBeVisible({ timeout: 15000 });
    await expect(link).toHaveAttribute("href", "/partners");
  });

  test("shows built in Bangalore text", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Built with")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=in Bangalore")).toBeVisible();
  });
});

test.describe("Landing page meta", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/donedonadone/i);
  });

  test("viewport renders at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("donedonadone", { timeout: 15000 });
    // Content should not overflow horizontally
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });
});
