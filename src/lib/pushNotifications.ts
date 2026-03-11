import { supabase } from "@/integrations/supabase/client";

/**
 * Request push notification permission and store the token.
 * Returns true if permission was granted and token stored.
 */
export async function requestPushPermission(userId: string): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // Register/get the service worker
    const registration = await navigator.serviceWorker.register("/sw-push.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    // Get push subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // We need a VAPID public key to create a subscription
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("[PushNotifications] No VAPID public key configured");
        // Store a placeholder token for future use
        await storeToken(userId, "pending_vapid_config", "web");
        return true;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // Store the endpoint as token
    await storeToken(userId, subscription.endpoint, "web");
    return true;
  } catch (err) {
    console.error("[PushNotifications] Error:", err);
    return false;
  }
}

async function storeToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform,
      is_active: true,
    },
    { onConflict: "user_id,token" }
  );
  if (error) {
    console.error("[PushNotifications] Failed to store token:", error);
  }
}

/**
 * Check if user already has an active push token.
 */
export async function hasActivePushToken(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("push_tokens")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);
  return !!data && data.length > 0;
}

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
