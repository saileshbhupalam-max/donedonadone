/**
 * @module pushNotifications
 * @description Web Push API integration for browser push notifications.
 * Handles subscription lifecycle: request permission -> subscribe -> store on server.
 *
 * WHY push over email: Push has 7x higher engagement rate for time-sensitive
 * notifications like session reminders (Airship 2023 benchmark).
 *
 * WHY granular controls: Users who choose their notification categories retain 2x
 * compared to all-or-nothing toggles (Leanplum 2023).
 *
 * Key exports: requestPushPermission, subscribeToPush, unsubscribeFromPush
 * Dependencies: supabase client, Web Push API, VAPID public key env var
 * Tables: push_subscriptions (endpoint, p256dh, auth keys per user)
 *
 * NOTE: For React components, prefer the usePushNotifications hook which wraps
 * these functions with state management. This module is for non-React contexts
 * (service workers, standalone scripts, Edge Function callbacks).
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array for the Push API.
 * WHY: The PushManager.subscribe() API requires an ArrayBuffer, not a string.
 * The VAPID public key is stored as URL-safe base64 in env vars.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser supports Web Push notifications.
 * WHY separate check: Calling requestPermission on unsupported browsers throws,
 * and we need to show/hide the push toggle in the UI based on capability.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Request the browser's notification permission.
 * Returns true if permission is granted (or was already granted).
 *
 * WHY separate from subscribe: Permission request should happen on user action
 * (button tap), not on page load. Browser UX guidelines penalize sites that
 * request permission without user intent.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (err) {
    console.error("[PushNotifications] Permission request failed:", err);
    return false;
  }
}

/**
 * Subscribe the user to push notifications and store the subscription server-side.
 * Requires permission to already be granted (call requestPushPermission first).
 *
 * WHY we store p256dh + auth separately: The send-notification Edge Function
 * needs these keys to encrypt the push payload per the Web Push protocol (RFC 8291).
 * Storing them as separate columns allows the Edge Function to query without
 * parsing JSONB on every send.
 *
 * @param userId - The authenticated user's UUID
 * @returns true if subscription was created and stored successfully
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const vapidKey = ((import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || "")
    .replace(/\s+/g, "");

  if (!vapidKey) {
    console.warn(
      "[PushNotifications] No VAPID public key configured (VITE_VAPID_PUBLIC_KEY). " +
      "Push subscriptions cannot be created without it."
    );
    return false;
  }

  try {
    // Register the push service worker if not already registered
    const registration = await navigator.serviceWorker.register("/sw-push.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    // Get or create the push subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // Extract the encryption keys needed for Web Push protocol
    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");
    if (!p256dhKey || !authKey) {
      console.error("[PushNotifications] Subscription missing encryption keys");
      return false;
    }

    const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)));
    const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)));

    // Store in push_subscriptions table (upsert by endpoint to handle re-subscribes)
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("[PushNotifications] Failed to store subscription:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[PushNotifications] Subscribe error:", err);
    return false;
  }
}

/**
 * Unsubscribe the user from push notifications.
 * Removes both the browser subscription and the server-side record.
 *
 * WHY we delete server-side too: Stale subscriptions cause 410 Gone errors
 * from the push service, wasting Edge Function invocations. The send-notification
 * function does clean up 410s, but proactive cleanup is better.
 *
 * @param userId - The authenticated user's UUID
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration(
      "/sw-push.js"
    );
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Remove from DB first (so Edge Function stops sending immediately)
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);

        // Then unsubscribe the browser
        await subscription.unsubscribe();
      }
    }
  } catch (err) {
    console.error("[PushNotifications] Unsubscribe error:", err);
  }
}

/**
 * Check if the user has an active push subscription stored server-side.
 * Useful for showing the push toggle state on page load without waiting
 * for the service worker to initialize.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  return !!data && data.length > 0;
}
