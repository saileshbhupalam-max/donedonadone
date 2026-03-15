// Daily Health Check Edge Function
//
// Runs once daily via pg_cron. Checks business metrics and alerts admins
// if anything is concerning (zero sessions, zero check-ins, etc.).
//
// Deploy: supabase functions deploy daily-health-check
// Cron setup (pg_cron):
//   SELECT cron.schedule('daily-health-check', '0 20 * * *',
//     $$SELECT net.http_post(
//       'https://<project>.supabase.co/functions/v1/daily-health-check',
//       '{}', 'application/json',
//       ARRAY[net.http_header('Authorization', 'Bearer <service_role_key>')]
//     )$$
//   );
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface HealthAlert {
  metric: string;
  value: number;
  threshold: string;
  severity: "warning" | "critical";
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Today's boundaries (IST)
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const todayDate = now.toISOString().split("T")[0];

  const alerts: HealthAlert[] = [];

  // 1. Sessions created today
  const { count: sessionsToday } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayISO);

  if (sessionsToday === 0) {
    alerts.push({
      metric: "Sessions created today",
      value: 0,
      threshold: "> 0",
      severity: "warning",
    });
  }

  // 2. Upcoming sessions with RSVPs (tomorrow)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  const { count: tomorrowSessions } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("date", tomorrowDate)
    .eq("status", "upcoming");

  if (tomorrowSessions === 0) {
    alerts.push({
      metric: "Sessions scheduled for tomorrow",
      value: 0,
      threshold: "> 0",
      severity: "critical",
    });
  }

  // 3. Check-ins today
  const { count: checkInsToday } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayISO);

  // Only alert if there were sessions today but no check-ins
  const { count: todaySessionEvents } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("date", todayDate)
    .eq("status", "completed");

  if ((todaySessionEvents ?? 0) > 0 && (checkInsToday ?? 0) === 0) {
    alerts.push({
      metric: "Check-ins today (with completed sessions)",
      value: checkInsToday ?? 0,
      threshold: "> 0",
      severity: "critical",
    });
  }

  // 4. Pending session requests older than 7 days (demand not being met)
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: staleRequests } = await supabase
    .from("session_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("created_at", weekAgo.toISOString());

  if ((staleRequests ?? 0) > 5) {
    alerts.push({
      metric: "Stale session requests (7+ days pending)",
      value: staleRequests ?? 0,
      threshold: "< 5",
      severity: "warning",
    });
  }

  // 5. New signups today (growth indicator)
  const { count: signupsToday } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayISO);

  // Build summary
  const summary = {
    date: todayDate,
    metrics: {
      sessions_created_today: sessionsToday ?? 0,
      sessions_tomorrow: tomorrowSessions ?? 0,
      check_ins_today: checkInsToday ?? 0,
      stale_requests: staleRequests ?? 0,
      signups_today: signupsToday ?? 0,
    },
    alerts,
    healthy: alerts.length === 0,
  };

  // If there are alerts, notify all admin users
  if (alerts.length > 0) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_type", "admin");

    if (admins && admins.length > 0) {
      const alertSummary = alerts
        .map((a) => `${a.severity === "critical" ? "!!" : "!"} ${a.metric}: ${a.value} (expected ${a.threshold})`)
        .join("\n");

      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        type: "health_check",
        title: `Daily Health Check: ${alerts.length} alert${alerts.length > 1 ? "s" : ""}`,
        body: alertSummary,
        data: summary,
        read: false,
      }));

      await supabase.from("notifications").insert(notifications);
    }
  }

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
