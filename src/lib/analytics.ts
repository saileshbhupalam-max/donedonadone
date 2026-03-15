/**
 * @module analytics
 * @description Google Analytics 4 (gtag.js) wrapper for event tracking.
 * Provides a thin abstraction over window.gtag so components don't
 * need to check for gtag existence or deal with the raw API.
 *
 * Key exports:
 * - trackEvent() — send a custom GA4 event (fire-and-forget)
 * - trackFunnelStep() — send a funnel step event with funnel_name + step metadata
 *
 * Dependencies: gtag.js loaded in index.html
 * Tables used: none (GA4 is external)
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Send a custom GA4 event. Fire-and-forget — never throws.
 * WHY fire-and-forget: Analytics must never break the user experience. A failed GA4
 * call should be invisible. The try/catch with empty handler ensures even if gtag
 * throws (ad blocker, CSP violation, script not loaded), the app continues normally.
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    window.gtag?.("event", eventName, params);
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Track a funnel step in GA4. Includes funnel_name and step_number for funnel visualization.
 *
 * WHY funnel_name + step_number as parameters: GA4's funnel exploration report requires
 * consistent event names with step metadata to build conversion funnels. Using a single
 * "funnel_step" event (vs. separate events per step) keeps the GA4 event namespace clean
 * and allows creating new funnels without code changes — just filter by funnel_name.
 * step_number enables ordered funnel visualization even if events arrive out of order.
 */
export function trackFunnelStep(
  funnelName: string,
  stepNumber: number,
  stepName: string,
  extra?: Record<string, unknown>
) {
  trackEvent("funnel_step", {
    funnel_name: funnelName,
    step_number: stepNumber,
    step_name: stepName,
    ...extra,
  });
}
