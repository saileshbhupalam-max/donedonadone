import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, parseISO, subDays, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";

// ─── Funnel Card ──────────────────────────────────────
function FunnelMetrics() {
  const [funnel, setFunnel] = useState<{ label: string; count: number; pct: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pageViews, signups, onboarded, firstRsvp, firstFeedback, repeat] = await Promise.all([
        supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "page_view"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
        supabase.from("event_rsvps").select("user_id").eq("status", "going"),
        supabase.from("event_feedback").select("user_id").eq("attended", true),
        supabase.from("event_feedback").select("user_id").eq("attended", true),
      ]);

      const uniqueRsvpUsers = new Set((firstRsvp.data || []).map((r: any) => r.user_id)).size;
      const uniqueFeedbackUsers = new Set((firstFeedback.data || []).map((r: any) => r.user_id)).size;
      
      // Count repeat attendees (2+ feedback)
      const feedbackCounts: Record<string, number> = {};
      (repeat.data || []).forEach((r: any) => { feedbackCounts[r.user_id] = (feedbackCounts[r.user_id] || 0) + 1; });
      const repeatUsers = Object.values(feedbackCounts).filter(c => c >= 2).length;

      const pvCount = pageViews.count || 0;
      const steps = [
        { label: "Page Views", count: pvCount },
        { label: "Sign-ups", count: signups.count || 0 },
        { label: "Onboarding Done", count: onboarded.count || 0 },
        { label: "First RSVP", count: uniqueRsvpUsers },
        { label: "First Attended", count: uniqueFeedbackUsers },
        { label: "Repeat (2+)", count: repeatUsers },
      ];

      const base = steps[0].count || 1;
      setFunnel(steps.map((s, i) => ({
        ...s,
        pct: i === 0 ? "100%" : `${Math.round((s.count / (steps[i - 1].count || 1)) * 100)}%`,
      })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-40" />;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-medium text-foreground">Conversion Funnel</h3>
        {funnel.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{step.label}</span>
                <span className="text-foreground font-medium">{step.count}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.max(5, (step.count / (funnel[0]?.count || 1)) * 100)}%` }}
                />
              </div>
            </div>
            {i > 0 && <span className="text-[10px] text-muted-foreground w-10 text-right">{step.pct}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Acquisition Channels ──────────────────────────────
function AcquisitionChannels() {
  const [channels, setChannels] = useState<{ label: string; count: number }[]>([]);
  const [topReferrers, setTopReferrers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: venueScans }] = await Promise.all([
        supabase.from("profiles").select("id, referred_by, display_name"),
        supabase.from("venue_scans").select("resulted_in_signup", { count: "exact" }).eq("resulted_in_signup", true),
      ]);

      const allProfiles = profiles || [];
      const referralCount = allProfiles.filter(p => p.referred_by).length;
      const qrCount = venueScans?.length || 0;
      const directCount = allProfiles.length - referralCount - qrCount;

      setChannels([
        { label: "Direct", count: Math.max(0, directCount) },
        { label: "Referral", count: referralCount },
        { label: "QR Code", count: qrCount },
      ]);

      // Top referrers
      const refCounts: Record<string, number> = {};
      allProfiles.forEach(p => { if (p.referred_by) refCounts[p.referred_by] = (refCounts[p.referred_by] || 0) + 1; });
      const sorted = Object.entries(refCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
      const referrerIds = sorted.map(([id]) => id);
      
      if (referrerIds.length > 0) {
        const { data: referrerProfiles } = await supabase.from("profiles").select("id, display_name").in("id", referrerIds);
        const nameMap = new Map((referrerProfiles || []).map(p => [p.id, p.display_name]));
        setTopReferrers(sorted.map(([id, count]) => ({ name: nameMap.get(id) || "Unknown", count })));
      }

      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-32" />;

  const total = channels.reduce((a, c) => a + c.count, 0) || 1;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Acquisition Channels</h3>
        <div className="flex gap-1 h-6 rounded-full overflow-hidden">
          {channels.map(c => (
            <div key={c.label} className={`flex items-center justify-center text-[10px] text-primary-foreground font-medium ${c.label === "Direct" ? "bg-primary" : c.label === "Referral" ? "bg-secondary" : "bg-muted-foreground"}`}
              style={{ width: `${Math.max(10, (c.count / total) * 100)}%` }}>
              {c.count}
            </div>
          ))}
        </div>
        <div className="flex gap-4 text-xs">
          {channels.map(c => (
            <span key={c.label} className="text-muted-foreground">{c.label}: <span className="font-medium text-foreground">{c.count}</span></span>
          ))}
        </div>

        {topReferrers.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Top Referrers</p>
            {topReferrers.map((r, i) => (
              <div key={i} className="flex justify-between text-xs py-1">
                <span className="text-foreground">{r.name}</span>
                <span className="text-muted-foreground">{r.count} referrals</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Viral Metrics ──────────────────────────────────────
function ViralMetrics() {
  const [metrics, setMetrics] = useState({ shares: 0, viralCoeff: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const oneWeekAgo = subDays(new Date(), 7).toISOString();
      const [{ count: shares }, { count: totalMembers }, { count: referred }] = await Promise.all([
        supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "share_click").gte("created_at", oneWeekAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).not("referred_by", "is", null),
      ]);
      setMetrics({
        shares: shares || 0,
        viralCoeff: (totalMembers || 1) > 0 ? Number(((referred || 0) / (totalMembers || 1)).toFixed(2)) : 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-20" />;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Viral Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-bold text-foreground">{metrics.shares}</p>
            <p className="text-[11px] text-muted-foreground">Shares this week</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{metrics.viralCoeff}</p>
            <p className="text-[11px] text-muted-foreground">Viral coefficient</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Retention Metrics ──────────────────────────────────
function RetentionMetrics() {
  const [metrics, setMetrics] = useState({ wau: 0, mau: 0, atRisk: 0, churned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const sevenDaysAgo = subDays(now, 7).toISOString();
      const thirtyDaysAgo = subDays(now, 30).toISOString();

      const { data: profiles } = await supabase.from("profiles").select("last_active_at").eq("onboarding_completed", true);
      
      let wau = 0, mau = 0, atRisk = 0, churned = 0;
      (profiles || []).forEach((p: any) => {
        if (!p.last_active_at) { churned++; return; }
        if (p.last_active_at >= sevenDaysAgo) wau++;
        if (p.last_active_at >= thirtyDaysAgo) mau++;
        else churned++;
        
        const daysSince = Math.floor((now.getTime() - parseISO(p.last_active_at).getTime()) / (24 * 60 * 60 * 1000));
        if (daysSince >= 3 && daysSince < 30) atRisk++;
      });

      setMetrics({ wau, mau, atRisk, churned });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-32" />;

  const ratio = metrics.mau > 0 ? Math.round((metrics.wau / metrics.mau) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Retention</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-bold text-foreground">{metrics.wau}</p>
            <p className="text-[11px] text-muted-foreground">WAU</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{metrics.mau}</p>
            <p className="text-[11px] text-muted-foreground">MAU</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{ratio}%</p>
            <p className="text-[11px] text-muted-foreground">WAU/MAU</p>
          </div>
          <div>
            <p className="text-xl font-bold text-destructive">{metrics.atRisk}</p>
            <p className="text-[11px] text-muted-foreground">At Risk</p>
          </div>
        </div>
        <div className="pt-2 border-t border-border flex justify-between text-xs">
          <span className="text-muted-foreground">Churned (30+ days):</span>
          <span className="text-foreground font-medium">{metrics.churned}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Milestones Summary ──────────────────────────────────
function MilestonesSummary() {
  const [milestones, setMilestones] = useState<{ type: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("member_milestones").select("milestone_type");
      const counts: Record<string, number> = {};
      ((data || [])).forEach((m: any) => { counts[m.milestone_type] = (counts[m.milestone_type] || 0) + 1; });
      setMilestones(
        Object.entries(counts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-24" />;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-medium text-foreground">Milestones Achieved</h3>
        {milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground">No milestones yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {milestones.map(m => (
              <Badge key={m.type} variant="outline" className="text-[10px]">
                {m.type.replace(/_/g, " ")} × {m.count}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Growth Tab ──────────────────────────────────────
export function GrowthTab() {
  return (
    <div className="space-y-4">
      <FunnelMetrics />
      <AcquisitionChannels />

      <div className="grid grid-cols-1 gap-4">
        <ViralMetrics />
        <RetentionMetrics />
      </div>

      <MilestonesSummary />
    </div>
  );
}
