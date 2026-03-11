import { useState, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { BarChart3, Users, Send, Inbox, Lock, Sparkles } from "lucide-react";
import { trackConversion } from "@/lib/trackConversion";

interface AnalyticsData {
  total_member_sessions: number;
  total_connections_formed: number;
  total_intros_sent: number;
  total_intros_received: number;
  top_industries_connected: { industry: string; count: number }[];
  monthly_activity: { month: string; sessions: number; intros: number }[];
}

function AnalyticsTeaser() {
  const navigate = useNavigate();
  return (
    <Card className="border-border/50 bg-muted/10">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif text-sm text-foreground">Company Analytics</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/50 blur-[2px]" />
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>Unlock company analytics with Max</span>
        </div>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { trackConversion("clicked_upgrade", { from: "company_analytics_gate" }); navigate("/pricing"); }}>
          <Sparkles className="w-3 h-3" /> See Plans
        </Button>
      </CardContent>
    </Card>
  );
}

export function CompanyAnalytics({ companyId }: { companyId: string }) {
  const { hasFeature } = useSubscription();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const canSee = hasFeature("company_analytics");

  useEffect(() => {
    if (!canSee) { setLoading(false); return; }
    supabase.rpc("get_company_analytics", { p_company_id: companyId }).then(({ data: result }) => {
      if (result) setData(result as unknown as AnalyticsData);
      setLoading(false);
    });
  }, [companyId, canSee]);

  if (!canSee) return <AnalyticsTeaser />;
  if (loading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (!data) return null;

  const maxSessions = Math.max(...data.monthly_activity.map((m) => m.sessions), 1);

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <h3 className="font-serif text-base text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Analytics
        </h3>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Sessions" value={data.total_member_sessions} />
          <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Connections" value={data.total_connections_formed} />
          <StatCard icon={<Send className="w-3.5 h-3.5" />} label="Intros Sent" value={data.total_intros_sent} />
          <StatCard icon={<Inbox className="w-3.5 h-3.5" />} label="Intros Received" value={data.total_intros_received} />
        </div>

        {/* Monthly chart */}
        {data.monthly_activity.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Monthly Sessions</p>
            <div className="flex items-end gap-1 h-20">
              {data.monthly_activity.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${(m.sessions / maxSessions) * 100}%`, minHeight: 2 }}
                  />
                  <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top industries */}
        {data.top_industries_connected.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Top Industries Connected</p>
            <div className="flex flex-wrap gap-1.5">
              {data.top_industries_connected.map((ind) => (
                <Badge key={ind.industry} variant="outline" className="text-[10px]">
                  {ind.industry} ({ind.count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px]">{label}</span></div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
