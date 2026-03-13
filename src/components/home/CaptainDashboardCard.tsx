import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { Users, CalendarIcon, Shield } from "lucide-react";

interface UpcomingDuty {
  id: string;
  title: string;
  date: string;
  going_count: number | null;
}

export function CaptainDashboardCard() {
  const { user, profile } = useAuth();
  const [duties, setDuties] = useState<UpcomingDuty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDuties = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        // Fetch upcoming events where this captain has RSVP'd
        const { data } = await supabase
          .from("event_rsvps")
          .select("event_id, events(id, title, date, going_count)")
          .eq("user_id", user.id)
          .gte("events.date", today)
          .order("created_at", { ascending: true })
          .limit(3);

        if (data) {
          const mapped = data
            .filter((r: any) => r.events)
            .map((r: any) => ({
              id: r.events.id,
              title: r.events.title,
              date: r.events.date,
              going_count: r.events.going_count,
            }));
          setDuties(mapped);
        }
      } catch {
        // Silently degrade — card still shows stats
      } finally {
        setLoading(false);
      }
    };

    fetchDuties();
  }, [user]);

  if (!profile?.is_table_captain) return null;

  const captainSessions = (profile as any).captain_sessions ?? 0;

  return (
    <Card className="border-amber-200/40 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-600" />
          <span className="font-serif text-sm font-semibold text-foreground">Captain Dashboard</span>
          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Table Captain
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 rounded-md bg-white/60 dark:bg-white/5">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{captainSessions}</p>
            <p className="text-[10px] text-muted-foreground">Sessions Captained</p>
          </div>
          <div className="text-center p-2 rounded-md bg-white/60 dark:bg-white/5">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{profile.events_attended ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Total Attended</p>
          </div>
        </div>

        {/* Upcoming duties */}
        {!loading && duties.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Upcoming Duties
            </p>
            {duties.map((duty) => (
              <div key={duty.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-white/50 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{duty.title}</p>
                  <p className="text-muted-foreground">
                    {duty.date ? format(parseISO(duty.date), "EEE, MMM d") : "TBD"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {duty.going_count != null && (
                    <span className="flex items-center gap-0.5 text-muted-foreground">
                      <Users className="h-3 w-3" /> {duty.going_count}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[9px] px-1.5">
                    Groups pending
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && duties.length === 0 && captainSessions > 0 && (
          <p className="text-xs text-muted-foreground text-center py-1">No upcoming captain duties. Enjoy the break!</p>
        )}
      </CardContent>
    </Card>
  );
}
