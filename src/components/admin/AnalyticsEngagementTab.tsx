import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Users, AlertTriangle, BarChart3, TrendingDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Engagement Overview ─────────────────────────────
function EngagementOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from("user_engagement_scores")
      .select("score, churn_risk", { count: "exact" });

    if (data) {
      const rows = data;
      const active = rows.filter((r) => r.score > 0).length;
      const highRisk = rows.filter((r) => r.churn_risk === "high").length;
      const avgScore = rows.length
        ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
        : 0;
      setStats({ active, highRisk, avgScore, total: count || rows.length });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const { data, error } = await supabase.rpc("compute_all_engagement_scores");
    setRefreshing(false);
    if (error) { toast.error("Failed to refresh scores"); return; }
    toast.success(`Scored ${data} users`);
    fetchStats();
  };

  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Engagement Overview</h3>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Scoring..." : "Refresh Scores"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat icon={<Users className="w-3.5 h-3.5" />} label="Active Users" value={stats?.active || 0} />
        <MiniStat icon={<AlertTriangle className="w-3.5 h-3.5 text-destructive" />} label="High Risk" value={stats?.highRisk || 0} />
        <MiniStat icon={<BarChart3 className="w-3.5 h-3.5" />} label="Avg Score" value={stats?.avgScore || 0} />
        <MiniStat icon={<Users className="w-3.5 h-3.5" />} label="Users Scored" value={stats?.total || 0} />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px]">{label}</span></div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

// ─── Churn Risk Table ─────────────────────────────
function ChurnRiskTable() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_engagement_scores")
        .select("user_id, score, sessions_last_30d, last_active_at, profiles(display_name, subscription_tier)")
        .eq("churn_risk", "high")
        .order("score", { ascending: true })
        .limit(20);
      setUsers(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (users.length === 0) return <p className="text-sm text-muted-foreground">No high-risk users 🎉</p>;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4 text-destructive" /> Churn Risk
      </h3>
      <div className="space-y-1.5">
        {users.map((u) => (
          <div key={u.user_id} className="flex items-center justify-between p-2 rounded-lg border border-border text-xs">
            <span className="font-medium text-foreground">{u.profiles?.display_name || "Unknown"}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Score: {u.score}</span>
              <span className="text-muted-foreground">{u.sessions_last_30d} sessions</span>
              {u.last_active_at && <span className="text-muted-foreground">{format(new Date(u.last_active_at), "MMM d")}</span>}
              <Badge variant="outline" className="text-[9px]">{u.profiles?.subscription_tier || "free"}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Conversion Funnel ─────────────────────────────
function ConversionFunnel() {
  const [period, setPeriod] = useState<"7" | "30">("30");
  const [funnel, setFunnel] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("conversion_events")
        .select("event_type")
        .gte("created_at", since);

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.event_type] = (counts[row.event_type] || 0) + 1;
      }
      setFunnel(counts);
      setLoading(false);
    })();
  }, [period]);

  const steps = ["saw_gate", "viewed_pricing", "clicked_upgrade", "started_checkout", "completed_upgrade"];

  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <TrendingDown className="w-4 h-4" /> Conversion Funnel
        </h3>
        <div className="flex gap-1">
          <Button size="sm" variant={period === "7" ? "default" : "ghost"} className="text-[10px] h-6 px-2" onClick={() => setPeriod("7")}>7d</Button>
          <Button size="sm" variant={period === "30" ? "default" : "ghost"} className="text-[10px] h-6 px-2" onClick={() => setPeriod("30")}>30d</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const count = funnel[step] || 0;
          const prev = i > 0 ? funnel[steps[i - 1]] || 0 : 0;
          const dropOff = i > 0 && prev > 0 ? Math.round(((prev - count) / prev) * 100) : null;
          return (
            <div key={step} className="flex items-center gap-2 text-xs">
              <span className="w-32 text-muted-foreground truncate">{step.replace(/_/g, " ")}</span>
              <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, count * 2)}%` }} />
              </div>
              <span className="w-8 text-right font-medium text-foreground">{count}</span>
              {dropOff !== null && <span className="text-[9px] text-destructive w-10">-{dropOff}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top Gates Hit ─────────────────────────────
function TopGatesHit() {
  const [gates, setGates] = useState<{ feature: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("conversion_events")
        .select("event_data")
        .eq("event_type", "saw_gate");

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const feat = (row.event_data as Record<string, string> | null)?.feature || "unknown";
        counts[feat] = (counts[feat] || 0) + 1;
      }
      setGates(
        Object.entries(counts)
          .map(([feature, count]) => ({ feature, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (gates.length === 0) return <p className="text-sm text-muted-foreground">No gate events yet</p>;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Eye className="w-4 h-4" /> Top Gates Hit
      </h3>
      <div className="space-y-1">
        {gates.map((g) => (
          <div key={g.feature} className="flex items-center justify-between text-xs p-2 rounded-lg border border-border">
            <span className="text-foreground font-medium">{g.feature}</span>
            <span className="text-muted-foreground">{g.count} hits</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Digest Generator ─────────────────────────────
function DigestGenerator() {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("compute-weekly-digest");
    setGenerating(false);
    if (error) { toast.error("Failed to generate digests"); return; }
    toast.success(`Generated ${data?.count ?? 0} digests`);
  };

  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-foreground">Weekly Digests</h3>
      <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleGenerate} disabled={generating}>
        <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
        {generating ? "Generating..." : "Generate Digests"}
      </Button>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────
export function AnalyticsEngagementTab() {
  return (
    <div className="space-y-6">
      <EngagementOverview />
      <ChurnRiskTable />
      <ConversionFunnel />
      <TopGatesHit />
      <DigestGenerator />
    </div>
  );
}
