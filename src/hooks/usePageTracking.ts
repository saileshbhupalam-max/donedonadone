import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackAnalyticsEvent } from "@/lib/growth";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks page_view events on every route change.
 * Sends to both GA4 (via gtag) and Supabase analytics_events.
 * Call once in App.tsx inside BrowserRouter.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // GA4 handles page_view automatically via config, but we send to Supabase too
    trackEvent("page_view", { page: location.pathname });

    supabase.auth.getUser().then(({ data }) => {
      trackAnalyticsEvent("page_view", data.user?.id ?? null, {
        page: location.pathname,
        search: location.search,
      });
    });
  }, [location.pathname]);
}
