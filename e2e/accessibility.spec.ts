import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Basic accessibility checks using axe-core.
 *
 * These test for WCAG 2.1 Level A/AA violations on pages that render
 * without needing auth to resolve. We run on whatever state the page
 * reaches after networkidle.
 */

test.describe("Accessibility", () => {
  test("Landing page has no critical a11y violations", async ({ page }) => {
    // Disable animations so axe doesn't catch mid-fade elements
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Wait for any remaining CSS animations/transitions to settle
    await page.waitForTimeout(1000);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("iframe")
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        "A11y violations on /:",
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
          null,
          2
        )
      );
    }

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical).toEqual([]);
  });

  test("Space Insights page has no critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/space/test/insights");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("iframe")
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        "A11y violations on /space/test/insights:",
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
          null,
          2
        )
      );
    }

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical).toEqual([]);
  });

  test("404 page has no critical a11y violations", async ({ page }) => {
    await page.goto("/nonexistent");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("iframe")
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        "A11y violations on 404 page:",
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
          null,
          2
        )
      );
    }

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical).toEqual([]);
  });
});
