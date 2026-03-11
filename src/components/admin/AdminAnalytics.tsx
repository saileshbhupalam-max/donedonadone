import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Users, Zap, MapPin, Link2, CheckCircle2, Radio } from "lucide-react";

const COLORS = {
  primary: "#C47B5A",
  secondary: "#7B9E87",
  accent: "#D4A853",
  muted: "#9CA3AF",
};

interface PlatformStats {
  total_users: number;
  users_this_week: number;
  users_this_month: number;
  total_checkins: number;
  checkins_today: number;
  checkins_this_week: number;
  active_now: number;
  total_connections: number;
  connections_this_week: number;
  total_requests: number;
  requests_completed: number;
  avg_taste_match: number;
  avg_dna_completion: number;
  total_locations: number;
  active_locations: number;
}

interface DailyMetric {
  date: string;
  new_users: number;
  checkins: number;
  connections: number;
  active_users: number;
}

interface TopLocation {
  location_id: string;
  location_name: string;
  location_type: string;
  checkin_count: number;
  unique_users: number;
}

export function AdminAnalyticsCharts() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [locations, setLocations] = useState<TopLocation[]>([]);
  const [flagStats, setFlagStats] = useState({ enabled: 0, disabled: 0 });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      const [platformRes, dailyRes, locationsRes, flagsRes] = await Promise.all([
        supabase.rpc("get_platform_analytics"),
        supabase.rpc("get_daily_metrics", { p_days: days }),
        supabase.rpc("get_top_locations", { p_days: 7 }),
        supabase.from("feature_flags").select("enabled"),
      ]);

      if (platformRes.data && Array.isArray(platformRes.data) && platformRes.data.length > 0) {
        setStats(platformRes.data[0] as PlatformStats);
      } else if (platformRes.data && !Array.isArray(platformRes.data)) {
        setStats(platformRes.data as unknown as PlatformStats);
      }

      setDaily((dailyRes.data || []) as DailyMetric[]);
      setLocations((locationsRes.data || []) as TopLocation[]);

      const flags = (flagsRes.data || []) as { enabled: boolean }[];
      setFlagStats({
        enabled: flags.filter(f => f.enabled).length,
        disabled: flags.filter(f => !f.enabled).length,
      });

      setLoading(false);
    })();
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const kpis = stats ? [
    { label: "Total Users", value: stats.total_users, icon: Users, sub: `+${stats.users_this_week} this week` },
    { label: "Active Now", value: stats.active_now, icon: Radio, sub: `${stats.active_locations} locations` },
    { label: "Check-ins Today", value: stats.checkins_today, icon: Zap, sub: `${stats.checkins_this_week} this week` },
    { label: "Connections", value: stats.total_connections, icon: Link2, sub: `+${stats.connections_this_week} this week` },
    { label: "Requests Done", value: stats.requests_completed, icon: CheckCircle2, sub: `of ${stats.total_requests} total` },
    { label: "Locations", value: stats.total_locations, icon: MapPin, sub: `${stats.active_locations} active` },
  ] : [];

  const chartData = daily.map(d => ({
    date: format(new Date(d.date), "MMM d"),
    "New Users": d.new_users,
    "Check-ins": d.checkins,
    "Connections": d.connections,
  }));

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <k.icon className="w-3.5 h-3.5" />
                <span className="text-[11px]">{k.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{k.value}</p>
              <p className="text-[10px] text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Growth Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">Daily Metrics</p>
            <div className="flex gap-1">
              {[7, 14, 30].map(d => (
                <Button
                  key={d}
                  size="sm"
                  variant={days === d ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="New Users" stroke={COLORS.secondary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Check-ins" stroke={COLORS.primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Connections" stroke={COLORS.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Not enough data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Top Locations */}
      {locations.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Top Locations (7 days)</p>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_70px_60px_60px] gap-1 px-3 py-2 bg-muted text-[10px] font-medium text-muted-foreground uppercase">
                <span>Name</span><span>Type</span><span>Check-ins</span><span>Users</span>
              </div>
              {locations.map(loc => (
                <div key={loc.location_id} className="grid grid-cols-[1fr_70px_60px_60px] gap-1 px-3 py-2 border-t items-center">
                  <span className="text-xs text-foreground truncate">{loc.location_name}</span>
                  <Badge variant="outline" className="text-[9px] w-fit">{loc.location_type}</Badge>
                  <span className="text-xs text-muted-foreground">{loc.checkin_count}</span>
                  <span className="text-xs text-muted-foreground">{loc.unique_users}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Metrics */}
      {stats && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground">Engagement</p>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Avg DNA Completion</span>
                <span className="text-foreground font-medium">{Math.round(stats.avg_dna_completion)}%</span>
              </div>
              <Progress value={stats.avg_dna_completion} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Avg Connection Strength</span>
                <span className="text-foreground font-medium">{Math.round(stats.avg_taste_match)}</span>
              </div>
              <Progress value={stats.avg_taste_match} className="h-2" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Feature Flags</span>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px]">✅ {flagStats.enabled} enabled</Badge>
                <Badge variant="outline" className="text-[10px]">⏸ {flagStats.disabled} disabled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
