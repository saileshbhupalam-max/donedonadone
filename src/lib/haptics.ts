/**
 * @module haptics
 * @description Device vibration feedback patterns for tactile UI responses.
 * Uses the Web Vibration API (navigator.vibrate) with safe optional chaining.
 *
 * Key exports:
 * - hapticLight() — Short 10ms vibration for taps and selections
 * - hapticSuccess() — Double-pulse pattern [10, 50, 10] for confirmations
 * - hapticWarning() — Triple-pulse pattern [30, 30, 30] for warnings/errors
 *
 * Dependencies: None (uses native Web API)
 * Side effects: Triggers device vibration on supported devices; no-op on unsupported
 * Related: Used across UI components for button presses, RSVP confirmation, check-in success
 */
export function hapticLight() {
  navigator.vibrate?.(10);
}

export function hapticSuccess() {
  navigator.vibrate?.([10, 50, 10]);
}

export function hapticWarning() {
  navigator.vibrate?.([30, 30, 30]);
}
