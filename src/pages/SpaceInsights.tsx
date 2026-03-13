import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  BarChart3,
  Users,
  Calendar,
  Star,
  Wifi,
  Coffee,
  Zap,
  Armchair,
  Volume2,
  MapPin,
  TrendingUp,
  UserPlus,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  fetchSpaceInsights,
  type SpaceInsightsData,
} from "@/lib/spaceInsights";
import { supabase } from "@/integrations/supabase/client";

type DateRange = "month" | "quarter" | "all";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  month: "Last 30 days",
  quarter: "Last 90 days",
  all: "All time",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = ["Morning", "Afternoon", "Evening"];

const RATING_ICONS: Record<string, React.ReactNode> = {
  "Noise Level": <Volume2 className="w-4 h-4" />,
  "WiFi Quality": <Wifi className="w-4 h-4" />,
  "Coffee Quality": <Coffee className="w-4 h-4" />,
  "Seating Comfort": <Armchair className="w-4 h-4" />,
  "Power Outlets": <Zap className="w-4 h-4" />,
};

// --- CSS-only chart components ---

function BarChartCSS({
  data,
  labelKey,
  valueKey,
}: {
  data: { [k: string]: string | number }[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => {
        const val = Number(d[valueKey]);
        const pct = (val / max) * 100;
        return (
          <div
            key={i}
            className="flex flex-col items-center flex-1 min-w-0 gap-1"
          >
            <span className="text-xs font-medium text-foreground">{val}</span>
            <div className="w-full flex items-end" style={{ height: "120px" }}>
              <div
                className="w-full rounded-t-md bg-primary transition-all duration-500"
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {String(d[labelKey])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapGrid({
  peakTimes,
}: {
  peakTimes: SpaceInsightsData["peakTimes"];
}) {
  const maxCount = Math.max(...peakTimes.map((p) => p.count), 1);

  function getCell(day: number, slot: string) {
    const match = peakTimes.find((p) => p.day === day && p.timeSlot === slot);
    return match?.count ?? 0;
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "60px repeat(7, 1fr)",
          gridTemplateRows: `auto repeat(${TIME_SLOTS.length}, 1fr)`,
        }}
      >
        {/* Header row */}
        <div />
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}

        {/* Data rows */}
        {TIME_SLOTS.map((slot) => (
          <>
            <div
              key={`label-${slot}`}
              className="text-xs text-muted-foreground flex items-center"
            >
              {slot}
            </div>
            {DAY_LABELS.map((_, dayIdx) => {
              const count = getCell(dayIdx, slot);
              const opacity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0.05;
              return (
                <div
                  key={`${dayIdx}-${slot}`}
                  className="rounded-md aspect-[2/1] min-h-[28px] flex items-center justify-center text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: `hsl(var(--primary) / ${opacity})`,
                    color:
                      opacity > 0.5
                        ? "hsl(var(--primary-foreground))"
                        : "hsl(var(--muted-foreground))",
                  }}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

function RatingBar({
  category,
  average,
  count,
}: {
  category: string;
  average: number;
  count: number;
}) {
  const pct = (average / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-36 shrink-0">
        <span className="text-muted-foreground">
          {RATING_ICONS[category] ?? <Star className="w-4 h-4" />}
        </span>
        <span className="text-sm text-foreground truncate">{category}</span>
      </div>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-foreground w-10 text-right">
        {average > 0 ? average.toFixed(1) : "--"}
      </span>
      <span className="text-xs text-muted-foreground w-12 text-right">
        ({count})
      </span>
    </div>
  );
}

function FormatList({
  formats,
}: {
  formats: SpaceInsightsData["formatBreakdown"];
}) {
  const total = formats.reduce((s, f) => s + f.count, 0) || 1;
  const colors = [
    "bg-primary",
    "bg-primary/80",
    "bg-primary/60",
    "bg-primary/40",
    "bg-primary/20",
  ];
  return (
    <div className="space-y-3">
      {formats.map((f, i) => {
        const pct = Math.round((f.count / total) * 100);
        return (
          <div key={f.format} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">{f.format}</span>
              <span className="text-muted-foreground">
                {f.count} ({pct}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colors[i % colors.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Skeleton loader ---

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

// --- Empty state ---

function EmptyInsights({ venueName }: { venueName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="font-serif text-xl text-foreground">
        No data yet{venueName ? ` for ${venueName}` : ""}
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Sessions will appear here once events are hosted at this space.
      </p>
    </div>
  );
}

// --- Live Conversion Hero ---

type CheckInProfile = {
  user_id: string;
  profiles: { display_name: string | null; avatar_url: string | null };
};

type NextEvent = {
  id: string;
  date: string;
  start_time: string;
  spots_filled: number | null;
  max_spots: number | null;
  session_format: string | null;
};

function LiveConversionHero({ locationId }: { locationId: string }) {
  const [checkedIn, setCheckedIn] = useState<CheckInProfile[]>([]);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [checkInsRes, eventsRes] = await Promise.all([
        supabase
          .from("check_ins")
          .select("user_id, profiles!inner(display_name, avatar_url)")
          .eq("location_id", locationId)
          .is("checked_out_at", null),
        supabase
          .from("events")
          .select("id, date, start_time, spots_filled, max_spots, session_format")
          .eq("venue_id", locationId)
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date")
          .order("start_time")
          .limit(1),
      ]);
      if (cancelled) return;
      setCheckedIn((checkInsRes.data as CheckInProfile[] | null) ?? []);
      setNextEvent(eventsRes.data?.[0] as NextEvent | undefined ?? null);
      setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, [locationId]);

  if (!loaded) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 pb-5 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    );
  }

  const spotsLeft =
    nextEvent && nextEvent.max_spots != null && nextEvent.spots_filled != null
      ? nextEvent.max_spots - nextEvent.spots_filled
      : null;

  function formatEventTime(evt: NextEvent) {
    const d = new Date(`${evt.date}T${evt.start_time}`);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + " at " + d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-6 pb-5 space-y-4">
        {/* Active check-ins */}
        {checkedIn.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {checkedIn.slice(0, 5).map((c) => (
                <Avatar key={c.user_id} className="w-8 h-8 border-2 border-background">
                  {c.profiles.avatar_url ? (
                    <AvatarImage src={c.profiles.avatar_url} alt={c.profiles.display_name ?? ""} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {(c.profiles.display_name ?? "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-sm font-medium text-foreground">
              {checkedIn.length} {checkedIn.length === 1 ? "person" : "people"} focused here right now
            </span>
          </div>
        )}

        {/* Next event or fallback */}
        {nextEvent ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="text-sm text-muted-foreground">
              Next session: <span className="text-foreground font-medium">{formatEventTime(nextEvent)}</span>
              {spotsLeft != null && (
                <> — <Badge variant="secondary" className="ml-1 text-xs">{spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left</Badge></>
              )}
            </p>
            <Button asChild size="sm" className="w-fit">
              <Link to={`/events/${nextEvent.id}`}>
                Join Session <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="text-sm text-muted-foreground">Be the first to book a session here</p>
            <Button asChild size="sm" variant="outline" className="w-fit">
              <Link to="/events">Browse Events</Link>
            </Button>
          </div>
        )}

        {/* CTA + branding */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <Button asChild size="sm" variant="default" className="w-fit">
            <Link to="/">
              Join FocusClub <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">FocusClub</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main page ---

export default function SpaceInsights() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SpaceInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("quarter");

  usePageTitle(
    data ? `${data.venue.name} Insights -- FocusClub` : "Space Insights -- FocusClub"
  );

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    fetchSpaceInsights(id, dateRange)
      .then((result) => {
        if (!result) {
          setError(true);
        } else {
          setData(result);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, dateRange]);

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">No space ID provided.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="font-serif text-xl text-foreground">Space not found</h2>
        <p className="text-sm text-muted-foreground max-w-xs text-center">
          This space may not exist or the link might be incorrect. Check with the
          venue for the right URL.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <InsightsSkeleton />
        ) : !data ? (
          <EmptyInsights />
        ) : (
          <>
            {/* Header */}
            <header className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="font-serif text-3xl md:text-4xl text-foreground">
                    {data.venue.name}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{data.venue.address || "Address not listed"}</span>
                    {data.venue.neighborhood && (
                      <Badge variant="secondary" className="text-xs">
                        {data.venue.neighborhood}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  Powered by{" "}
                  <span className="font-semibold text-foreground">FocusClub</span>
                </div>
              </div>

              {/* Date range filter */}
              <div className="flex gap-2">
                {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      dateRange === range
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {DATE_RANGE_LABELS[range]}
                  </button>
                ))}
              </div>
            </header>

            {/* Live Conversion Hero -- above the fold */}
            <LiveConversionHero locationId={id} />

            {data.stats.totalSessions === 0 ? (
              <EmptyInsights venueName={data.venue.name} />
            ) : (
              <>
                {/* Key Stats */}
                <section>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={<Calendar className="w-5 h-5" />}
                      label="Sessions Hosted"
                      value={data.stats.totalSessions}
                    />
                    <StatCard
                      icon={<Users className="w-5 h-5" />}
                      label="Unique Members"
                      value={data.stats.uniqueMembers}
                    />
                    <StatCard
                      icon={<RefreshCw className="w-5 h-5" />}
                      label="Repeat Rate"
                      value={`${data.stats.repeatRate}%`}
                    />
                    <StatCard
                      icon={<Star className="w-5 h-5" />}
                      label="Avg Rating"
                      value={
                        data.stats.avgRating > 0
                          ? data.stats.avgRating.toFixed(1)
                          : "--"
                      }
                      suffix="/5"
                    />
                  </div>
                </section>

                {/* Attendance Trends */}
                <section>
                  <SectionHeading
                    icon={<BarChart3 className="w-5 h-5" />}
                    title="Attendance Trends"
                    subtitle="Sessions per month (last 6 months)"
                  />
                  <Card>
                    <CardContent className="pt-6">
                      {data.monthlyAttendance.some((m) => m.count > 0) ? (
                        <BarChartCSS
                          data={data.monthlyAttendance}
                          labelKey="month"
                          valueKey="count"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No session data in the last 6 months
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Peak Times Heatmap */}
                <section>
                  <SectionHeading
                    icon={<Calendar className="w-5 h-5" />}
                    title="Peak Times"
                    subtitle="When sessions are most popular"
                  />
                  <Card>
                    <CardContent className="pt-6">
                      {data.peakTimes.length > 0 ? (
                        <HeatmapGrid peakTimes={data.peakTimes} />
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No scheduling data available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Community Health */}
                <section>
                  <SectionHeading
                    icon={<Users className="w-5 h-5" />}
                    title="Community Health"
                    subtitle="Member activity this month"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                      icon={<Users className="w-5 h-5" />}
                      label="Active This Month"
                      value={data.communityHealth.activeThisMonth}
                    />
                    <StatCard
                      icon={<UserPlus className="w-5 h-5" />}
                      label="New This Month"
                      value={data.communityHealth.newThisMonth}
                    />
                    <StatCard
                      icon={<TrendingUp className="w-5 h-5" />}
                      label="Returning"
                      value={`${data.communityHealth.returningPct}%`}
                    />
                  </div>
                </section>

                {/* Ratings Breakdown */}
                <section>
                  <SectionHeading
                    icon={<Star className="w-5 h-5" />}
                    title="Venue Ratings"
                    subtitle="Member feedback on workspace quality"
                  />
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      {data.ratings.some((r) => r.count > 0) ? (
                        data.ratings.map((r) => (
                          <RatingBar key={r.category} {...r} />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No ratings yet -- they'll appear after members submit
                          venue vibes
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Session Formats */}
                <section>
                  <SectionHeading
                    icon={<BarChart3 className="w-5 h-5" />}
                    title="Session Formats"
                    subtitle="Most popular session types"
                  />
                  <Card>
                    <CardContent className="pt-6">
                      {data.formatBreakdown.length > 0 ? (
                        <FormatList formats={data.formatBreakdown} />
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No format data available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </>
            )}

            {/* Footer */}
            <footer className="pt-8 pb-4 text-center">
              <p className="text-xs text-muted-foreground">
                Insights powered by{" "}
                <a
                  href="/"
                  className="text-primary hover:underline font-medium"
                >
                  FocusClub
                </a>{" "}
                -- Group coworking for Bangalore
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

// --- Reusable sub-components ---

function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <div>
        <h2 className="font-serif text-lg text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
