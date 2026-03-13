import { supabase } from "@/integrations/supabase/client";

/** Fire-and-forget conversion event tracking */
export function trackConversion(eventType: string, eventData?: Record<string, unknown>) {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    supabase
      .from("conversion_events")
      .insert({ user_id: data.user.id, event_type: eventType, event_data: (eventData || {}) as any })
      .then(() => {})
      .catch((e) => console.error("[trackConversion]", e));
  }).catch((e) => console.error("[trackConversion:auth]", e));
}
