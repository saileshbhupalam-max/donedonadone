import { Page } from "@playwright/test";

/**
 * The Supabase auth loading state shows a "FocusClub" pulsing text.
 * This can take 10-30+ seconds to resolve when Supabase backend is slow/unreachable.
 *
 * For E2E tests, we need strategies that don't depend on auth resolving quickly.
 */

/**
 * Wait for auth loading to resolve by checking if the loading indicator disappears.
 * Falls back after maxWait ms regardless.
 */
export async function waitForAuthLoading(page: Page, maxWait = 25000) {
  try {
    // Wait for either: auth loading resolves (animate-pulse disappears)
    // or the page has substantive content
    await page.waitForFunction(
      () => {
        const pulsingH1 = document.querySelector("h1.animate-pulse");
        if (!pulsingH1) return true; // No loading indicator
        // Check if there's other content besides the loading spinner
        const allText = document.body?.innerText?.replace(/\s+/g, " ").trim() || "";
        return allText.length > 20;
      },
      { timeout: maxWait }
    );
  } catch {
    // Auth loading didn't resolve in time — continue anyway
    // Tests will assert on what's actually visible
  }
}
