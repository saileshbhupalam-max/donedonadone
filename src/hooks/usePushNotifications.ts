import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = ((import.meta.env.VITE_VAPID_PUBLIC_KEY || '') as string).replace(/\s+/g, '') || undefined;

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

export function usePushNotifications() {
  const { user } = useAuth();
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const isPushSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY;

  // Check existing subscription
  useEffect(() => {
    if (!user || !isPushSupported) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            // Verify it exists in DB
            const { data } = await supabase
              .from("push_subscriptions")
              .select("id")
              .eq("user_id", user.id)
              .eq("endpoint", sub.endpoint)
              .maybeSingle();
            setIsPushEnabled(!!data);
          }
        }
      } catch (e) {
        console.error("[PushCheck]", e);
      }
      setLoading(false);
    })();
  }, [user, isPushSupported]);

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      const registration = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!key || !auth) return false;

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth: authKey,
        },
        { onConflict: "endpoint" }
      );

      if (error) {
        console.error("[PushSubscribe]", error);
        return false;
      }

      setIsPushEnabled(true);
      return true;
    } catch (e) {
      console.error("[PushSubscribe]", e);
      return false;
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setIsPushEnabled(false);
    } catch (e) {
      console.error("[PushUnsubscribe]", e);
    }
  }, [user]);

  return {
    isPushSupported,
    isPushEnabled,
    loading,
    requestPushPermission,
    unsubscribe,
  };
}
