import { supabase } from "@/integrations/supabase/client";
import { subDays, subMonths, format, startOfMonth, parseISO } from "date-fns";

export interface SpaceInsightsData {
  venue: { name: string; address: string; neighborhood: string };
  stats: {
    totalSessions: number;
    uniqueMembers: number;
    repeatRate: number;
    avgRating: number;
  };
  monthlyAttendance: { month: string; count: number }[];
  peakTimes: { day: number; timeSlot: string; count: number }[];
  communityHealth: {
    activeThisMonth: number;
    newThisMonth: number;
    returningPct: number;
  };
  ratings: { category: string; average: number; count: number }[];
  formatBreakdown: { format: string; count: number }[];
}

type DateRange = "month" | "quarter" | "all";

function getDateCutoff(range: DateRange): string | null {
  if (range === "all") return null;
  const days = range === "month" ? 30 : 90;
  return subDays(new Date(), days).toISOString().split("T")[0];
}

const FORMAT_LABELS: Record<string, string> = {
  structured_4hr: "Structured 4hr",
  structured_2hr: "Structured 2hr",
  focus_only_4hr: "Focus Only 4hr",
  focus_only_2hr: "Focus Only 2hr",
  casual: "Casual",
};

function classifyTimeSlot(time: string | null): string {
  if (!time) return "Morning";
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export async function fetchSpaceInsights(
  venuePartnerId: string,
  dateRange: DateRange
): Promise<SpaceInsightsData | null> {
  // 1. Fetch venue info
  const { data: venue, error: venueError } = await supabase
    .from("venue_partners")
    .select("venue_name, venue_address, neighborhood")
    .eq("id", venuePartnerId)
    .maybeSingle();

  if (venueError || !venue) return null;

  const cutoff = getDateCutoff(dateRange);

  // 2. Fetch events at this venue
  let eventsQuery = supabase
    .from("events")
    .select("id, date, start_time, session_format")
    .eq("venue_partner_id", venuePartnerId);
  if (cutoff) eventsQuery = eventsQuery.gte("date", cutoff);

  const { data: events } = await eventsQuery;
  const eventList = events ?? [];
  const eventIds = eventList.map((e) => e.id);

  // 3. Fetch RSVPs for these events
  let rsvps: { user_id: string; event_id: string; created_at: string | null }[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("event_rsvps")
      .select("user_id, event_id, created_at")
      .in("event_id", eventIds)
      .eq("status", "going");
    rsvps = data ?? [];
  }

  // 4. Fetch venue_vibes for these events
  let vibes: {
    noise_level: number | null;
    wifi_quality: number | null;
    coffee_quality: number | null;
    seating_comfort: number | null;
    power_outlets: number | null;
  }[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("venue_vibes")
      .select(
        "noise_level, wifi_quality, coffee_quality, seating_comfort, power_outlets"
      )
      .in("event_id", eventIds);
    vibes = data ?? [];
  }

  // --- Compute stats ---
  const totalSessions = eventList.length;
  const uniqueUserIds = new Set(rsvps.map((r) => r.user_id));
  const uniqueMembers = uniqueUserIds.size;

  // Repeat rate: users who attended 2+ events / total unique
  const userEventCounts = new Map<string, number>();
  for (const r of rsvps) {
    userEventCounts.set(r.user_id, (userEventCounts.get(r.user_id) ?? 0) + 1);
  }
  const repeatUsers = [...userEventCounts.values()].filter((c) => c >= 2).length;
  const repeatRate = uniqueMembers > 0 ? Math.round((repeatUsers / uniqueMembers) * 100) : 0;

  // Average rating (mean of all numeric vibe columns)
  let totalRatingSum = 0;
  let totalRatingCount = 0;
  for (const v of vibes) {
    const vals = [
      v.noise_level,
      v.wifi_quality,
      v.coffee_quality,
      v.seating_comfort,
      v.power_outlets,
    ].filter((x): x is number => x !== null);
    totalRatingSum += vals.reduce((a, b) => a + b, 0);
    totalRatingCount += vals.length;
  }
  const avgRating =
    totalRatingCount > 0
      ? Math.round((totalRatingSum / totalRatingCount) * 10) / 10
      : 0;

  // --- Monthly attendance (last 6 months) ---
  const sixMonthsAgo = subMonths(new Date(), 6);
  const monthCounts = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const m = format(subMonths(new Date(), i), "yyyy-MM");
    monthCounts.set(m, 0);
  }
  for (const e of eventList) {
    const m = e.date.substring(0, 7); // "yyyy-MM"
    if (parseISO(e.date) >= sixMonthsAgo && monthCounts.has(m)) {
      monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
    }
  }
  const monthlyAttendance = [...monthCounts.entries()].map(([month, count]) => ({
    month: format(parseISO(month + "-01"), "MMM yyyy"),
    count,
  }));

  // --- Peak times heatmap ---
  const peakMap = new Map<string, number>();
  for (const e of eventList) {
    const dayOfWeek = parseISO(e.date).getDay(); // 0=Sun
    const slot = classifyTimeSlot(e.start_time);
    const key = `${dayOfWeek}-${slot}`;
    peakMap.set(key, (peakMap.get(key) ?? 0) + 1);
  }
  const peakTimes: SpaceInsightsData["peakTimes"] = [];
  for (const [key, count] of peakMap) {
    const [dayStr, timeSlot] = key.split("-");
    peakTimes.push({ day: parseInt(dayStr, 10), timeSlot, count });
  }

  // --- Community health (this calendar month) ---
  const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  // All events this month at venue (unfiltered by dateRange)
  const { data: thisMonthEvents } = await supabase
    .from("events")
    .select("id")
    .eq("venue_partner_id", venuePartnerId)
    .gte("date", thisMonthStart);
  const thisMonthEventIds = (thisMonthEvents ?? []).map((e) => e.id);

  let thisMonthRsvps: { user_id: string }[] = [];
  if (thisMonthEventIds.length > 0) {
    const { data } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .in("event_id", thisMonthEventIds)
      .eq("status", "going");
    thisMonthRsvps = data ?? [];
  }
  const activeThisMonth = new Set(thisMonthRsvps.map((r) => r.user_id)).size;

  // "New" = users whose first RSVP at this venue was this month
  // To figure this out, we need all-time RSVPs at this venue
  const { data: allTimeEvents } = await supabase
    .from("events")
    .select("id")
    .eq("venue_partner_id", venuePartnerId)
    .lt("date", thisMonthStart);
  const priorEventIds = (allTimeEvents ?? []).map((e) => e.id);

  let priorUserIds = new Set<string>();
  if (priorEventIds.length > 0) {
    const { data } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .in("event_id", priorEventIds)
      .eq("status", "going");
    priorUserIds = new Set((data ?? []).map((r) => r.user_id));
  }

  const thisMonthUserIds = new Set(thisMonthRsvps.map((r) => r.user_id));
  const newThisMonth = [...thisMonthUserIds].filter(
    (id) => !priorUserIds.has(id)
  ).length;
  const returningPct =
    activeThisMonth > 0
      ? Math.round(((activeThisMonth - newThisMonth) / activeThisMonth) * 100)
      : 0;

  // --- Ratings breakdown ---
  const ratingCategories = [
    { key: "noise_level" as const, label: "Noise Level" },
    { key: "wifi_quality" as const, label: "WiFi Quality" },
    { key: "coffee_quality" as const, label: "Coffee Quality" },
    { key: "seating_comfort" as const, label: "Seating Comfort" },
    { key: "power_outlets" as const, label: "Power Outlets" },
  ];
  const ratings = ratingCategories.map(({ key, label }) => {
    const vals = vibes
      .map((v) => v[key])
      .filter((x): x is number => x !== null);
    const avg =
      vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0;
    return { category: label, average: avg, count: vals.length };
  });

  // --- Session formats ---
  const formatCounts = new Map<string, number>();
  for (const e of eventList) {
    const f = e.session_format ?? "unknown";
    formatCounts.set(f, (formatCounts.get(f) ?? 0) + 1);
  }
  const formatBreakdown = [...formatCounts.entries()]
    .map(([fmt, count]) => ({
      format: FORMAT_LABELS[fmt] ?? fmt,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    venue: {
      name: venue.venue_name,
      address: venue.venue_address ?? "",
      neighborhood: venue.neighborhood ?? "",
    },
    stats: { totalSessions, uniqueMembers, repeatRate, avgRating },
    monthlyAttendance,
    peakTimes,
    communityHealth: { activeThisMonth, newThisMonth, returningPct },
    ratings,
    formatBreakdown,
  };
}
