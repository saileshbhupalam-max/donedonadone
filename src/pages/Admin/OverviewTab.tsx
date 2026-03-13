import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays } from "date-fns";
import { Users, CalendarDays, MessageSquare, BarChart3 } from "lucide-react";

export function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const oneWeekAgo = subDays(new Date(), 7).toISOString();

      const [members, newMembers, events, upcomingEvents, rsvps, activePrompt, promptResponses, neighborhoods] = await Promise.all([
        supabase.from("profiles").select("profile_completion", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("date", today),
        supabase.from("event_rsvps").select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo),
        supabase.from("prompts").select("id, question, response_count").eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("prompt_responses").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("neighborhood"),
      ]);

      const completions = (members.data || []).map((p: any) => p.profile_completion || 0);
      const avgCompletion = completions.length ? Math.round(completions.reduce((a: number, b: number) => a + b, 0) / completions.length) : 0;

      const neighborhoodCounts: Record<string, number> = {};
      (neighborhoods.data || []).forEach((p: any) => {
        if (p.neighborhood) neighborhoodCounts[p.neighborhood] = (neighborhoodCounts[p.neighborhood] || 0) + 1;
      });

      setStats({
        totalMembers: members.count || 0,
        newThisWeek: newMembers.count || 0,
        avgCompletion,
        totalEvents: events.count || 0,
        upcomingEvents: upcomingEvents.count || 0,
        rsvpsThisWeek: rsvps.count || 0,
        activePrompt: activePrompt.data,
        totalPromptResponses: promptResponses.count || 0,
        neighborhoodCounts,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Members", value: stats.totalMembers, icon: Users },
          { label: "New This Week", value: stats.newThisWeek, icon: Users },
          { label: "Avg Completion", value: `${stats.avgCompletion}%`, icon: BarChart3 },
          { label: "Upcoming Sessions", value: stats.upcomingEvents, icon: CalendarDays },
          { label: "RSVPs This Week", value: stats.rsvpsThisWeek, icon: CalendarDays },
          { label: "Total Responses", value: stats.totalPromptResponses, icon: MessageSquare },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="w-3.5 h-3.5" />
                <span className="text-[11px]">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.activePrompt && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Active Prompt</p>
            <p className="text-sm font-medium text-foreground">{stats.activePrompt.question}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.activePrompt.response_count || 0} responses</p>
          </CardContent>
        </Card>
      )}

      {/* Analytics moved to dedicated tab */}
    </div>
  );
}
