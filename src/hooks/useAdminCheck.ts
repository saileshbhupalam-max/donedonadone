import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAILS } from "@/pages/Admin/constants";

/**
 * Determines whether the current user is an admin.
 *
 * Check order:
 * 1. profile.user_type === "admin" (DB role — source of truth)
 * 2. Hardcoded ADMIN_EMAILS fallback (bootstrap / emergency access)
 * 3. `admin_emails` setting in app_settings table (dynamic, no redeploy needed)
 *
 * The hardcoded list is checked synchronously so the page doesn't flash
 * while the DB query is in flight.
 */
export function useAdminCheck(): { isAdmin: boolean; loading: boolean } {
  const { user, profile, loading: authLoading } = useAuth();
  const [dbAdminEmails, setDbAdminEmails] = useState<string[] | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "admin_emails")
          .single();

        if (!cancelled && data?.value) {
          // value is stored as a JSON object with an "emails" array,
          // e.g. { "emails": ["a@b.com", "c@d.com"] }
          const parsed = data.value as Record<string, unknown>;
          if (Array.isArray(parsed.emails)) {
            setDbAdminEmails(parsed.emails as string[]);
          } else if (Array.isArray(parsed)) {
            // Direct array format
            setDbAdminEmails(parsed as string[]);
          }
        }
      } catch {
        // Silently fall back to hardcoded list — the setting may not exist yet
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (authLoading) return { isAdmin: false, loading: true };

  const email = user?.email || "";

  // Synchronous checks (no wait needed)
  if (profile?.user_type === "admin") return { isAdmin: true, loading: false };
  if (ADMIN_EMAILS.includes(email)) return { isAdmin: true, loading: false };

  // DB check still in flight — report loading only if the sync checks didn't match
  if (dbLoading) return { isAdmin: false, loading: true };

  // DB-driven admin list
  if (dbAdminEmails && dbAdminEmails.includes(email)) {
    return { isAdmin: true, loading: false };
  }

  return { isAdmin: false, loading: false };
}
