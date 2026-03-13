import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getInitials } from "@/lib/utils";
import { MapPin, Users, Clock, Repeat, BarChart3, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO, subDays } from "date-fns";

interface PartnerStats {
  total_checkins: number;
  unique_visitors: number;
  avg_session_minutes: number;
  checkins_today: number;
  checkins_this_week: number;
  top_times: string[];
  repeat_rate: number;
}

interface WhosHerePerson {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  checked_in_at: string;
}

export default function PartnerDashboard() {
  usePageTitle("Partner Dashboard — FocusClub");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [currentPeople, setCurrentPeople] = useState<WhosHerePerson[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get application
      const { data: app } = await supabase
        .from("partner_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!app) { navigate("/partner/apply"); return; }
      setApplication(app);

      if (app.status !== "approved") { setLoading(false); return; }

      // Find linked location
      const { data: loc } = await supabase
        .from("locations")
        .select("id")
        .eq("partner_user_id", user.id)
        .maybeSingle();

      if (!loc) { setLoading(false); return; }
      setLocationId(loc.id);

      // Fetch stats and current people in parallel
      const [statsRes, peopleRes] = await Promise.all([
        supabase.rpc("get_partner_stats", { p_location_id: loc.id }),
        supabase.rpc("get_whos_here", { p_user_id: user.id, p_location_id: loc.id }),
      ]);

      if (statsRes.data && Array.isArray(statsRes.data) && statsRes.data.length > 0) {
        setStats(statsRes.data[0] as PartnerStats);
      }
      setCurrentPeople((peopleRes.data as WhosHerePerson[]) || []);

      // Weekly check-in data
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return format(d, "yyyy-MM-dd");
      });

      const { data: checkins } = await supabase
        .from("check_ins")
        .select("checked_in_at")
        .eq("location_id", loc.id)
        .gte("checked_in_at", days[0]);

      const countByDay: Record<string, number> = {};
      days.forEach((d) => { countByDay[d] = 0; });
      (checkins || []).forEach((c: any) => {
        const d = c.checked_in_at?.split("T")[0];
        if (d && countByDay[d] !== undefined) countByDay[d]++;
      });

      setWeeklyData(days.map((d) => ({ date: d, count: countByDay[d] })));
      setLoading(false);
    })();
  }, [user, navigate]);

  if (loading) {
    return (
      <AppShell>
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  // Pending state
  if (application?.status === "pending") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <h1 className="font-serif text-2xl text-foreground">Application Under Review</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your application for <span className="font-medium text-foreground">{application.venue_name}</span> is being reviewed. We'll notify you once it's approved.
          </p>
          <Button variant="outline" onClick={() => navigate("/home")}>Back to Home</Button>
        </div>
      </AppShell>
    );
  }

  // Rejected state
  if (application?.status === "rejected") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <h1 className="font-serif text-2xl text-foreground">Application Needs Changes</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            {application.rejection_reason || "Please contact us for more details about your application."}
          </p>
          <Button onClick={() => navigate("/home")}>Back to Home</Button>
        </div>
      </AppShell>
    );
  }

  const maxWeekly = Math.max(...weeklyData.map((d) => d.count), 1);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-4 space-y-5 max-w-lg mx-auto pb-8"
      >
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl text-foreground">{application?.venue_name}</h1>
            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600">Approved</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{application?.neighborhood} · Partner Dashboard</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Check-ins", value: stats.total_checkins, icon: MapPin },
              { label: "Unique Visitors", value: stats.unique_visitors, icon: Users },
              { label: "Today", value: stats.checkins_today, icon: Clock },
              { label: "Repeat Rate", value: `${stats.repeat_rate}%`, icon: Repeat },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <s.icon className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Who's here now */}
        <section>
          <h2 className="font-serif text-lg text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> At your venue now
          </h2>
          {currentPeople.length === 0 ? (
            <Card><CardContent className="py-4 text-center text-sm text-muted-foreground">No one checked in right now</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{currentPeople.length} {currentPeople.length === 1 ? "person" : "people"} here</p>
                {currentPeople.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={p.avatar_url || ""} />
                      <AvatarFallback className="text-[10px]">{getInitials(p.display_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{p.display_name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Weekly trend */}
        <section>
          <h2 className="font-serif text-lg text-foreground mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> This week
          </h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-end gap-1.5 h-24">
                {weeklyData.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">{d.count}</span>
                    <div
                      className="w-full rounded-t bg-primary/80 transition-all"
                      style={{ height: `${(d.count / maxWeekly) * 100}%`, minHeight: d.count > 0 ? 4 : 1 }}
                    />
                    <span className="text-[9px] text-muted-foreground">{format(parseISO(d.date + "T00:00:00"), "EEE").slice(0, 2)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">{stats?.checkins_this_week || 0} check-ins this week</p>
            </CardContent>
          </Card>
        </section>

        {/* Peak hours */}
        {stats && stats.top_times.length > 0 && (
          <section>
            <h2 className="font-serif text-lg text-foreground mb-2">Peak Hours</h2>
            <div className="flex gap-2">
              {stats.top_times.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-xs px-3 py-1">{t}</Badge>
              ))}
            </div>
          </section>
        )}
      </motion.div>
    </AppShell>
  );
}
