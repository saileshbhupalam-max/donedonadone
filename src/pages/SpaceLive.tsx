import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Users, Clock, Zap, Calendar } from "lucide-react";

interface LiveData {
  venueName: string;
  neighborhood: string;
  activeCount: number;
  monthlyHours: number;
  weeklyUnique: number;
  nextSession: { date: string; time: string; format: string; spotsLeft: number } | null;
}

const ROTATE_INTERVAL = 8000;
const REFRESH_INTERVAL = 60000;

export default function SpaceLive() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LiveData | null>(null);
  const [statIdx, setStatIdx] = useState(0);

  usePageTitle(data ? `${data.venueName} Live` : "FocusClub Live");

  const fetchData = async () => {
    if (!id) return;

    // Get location info
    const { data: loc } = await supabase.from("locations").select("name, neighborhood").eq("id", id).maybeSingle();
    if (!loc) return;

    // Active check-ins count
    const { count: activeCount } = await supabase.from("check_ins").select("id", { count: "exact", head: true }).eq("location_id", id).is("checked_out_at", null);

    // Next upcoming event
    const today = new Date().toISOString().split("T")[0];
    const { data: nextEv } = await supabase.from("events").select("date, start_time, session_format, max_spots, spots_filled").eq("venue_id", id).gte("date", today).order("date").order("start_time").limit(1);

    // Weekly unique visitors (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: weekCheckins } = await supabase.from("check_ins").select("user_id").eq("location_id", id).gte("checked_in_at", weekAgo);
    const weeklyUnique = new Set((weekCheckins || []).map((c: any) => c.user_id)).size;

    // Monthly focus hours estimate (events this month * avg 3hr)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const { count: monthEvents } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("venue_id", id).gte("date", monthStart);
    const monthlyHours = (monthEvents || 0) * 3 * 4; // avg 3hrs * avg 4 people

    const next = nextEv?.[0];
    setData({
      venueName: loc.name,
      neighborhood: loc.neighborhood || "",
      activeCount: activeCount || 0,
      monthlyHours,
      weeklyUnique,
      nextSession: next ? {
        date: next.date,
        time: next.start_time,
        format: next.session_format || "Structured",
        spotsLeft: (next.max_spots || 8) - (next.spots_filled || 0),
      } : null,
    });
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, REFRESH_INTERVAL); return () => clearInterval(i); }, [id]);
  useEffect(() => { const i = setInterval(() => setStatIdx(p => (p + 1) % 4), ROTATE_INTERVAL); return () => clearInterval(i); }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-lg">Loading...</div>
      </div>
    );
  }

  const stats = [
    { icon: Users, label: "people focused right now", value: data.activeCount },
    { icon: Zap, label: "focused hours this month", value: data.monthlyHours },
    { icon: Users, label: "unique coworkers this week", value: data.weeklyUnique },
    { icon: Calendar, label: data.nextSession ? `Next: ${data.nextSession.format} — ${data.nextSession.spotsLeft} spots left` : "Check focusclub.in for sessions", value: data.nextSession ? data.nextSession.date : "" },
  ];

  const current = stats[statIdx];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-12 select-none overflow-hidden">
      {/* Venue name */}
      <h1 className="font-serif text-4xl md:text-6xl text-foreground text-center mb-2">
        {data.venueName}
      </h1>
      {data.neighborhood && (
        <p className="text-lg text-muted-foreground mb-12">{data.neighborhood}</p>
      )}

      {/* Rotating stat */}
      <div className="text-center transition-all duration-700 mb-16" key={statIdx}>
        <div className="flex items-center justify-center gap-4 mb-3">
          <current.icon className="w-10 h-10 text-primary" />
          <span className="text-7xl md:text-9xl font-bold text-foreground font-mono">
            {current.value}
          </span>
        </div>
        <p className="text-xl md:text-2xl text-muted-foreground">
          {current.label}
        </p>
      </div>

      {/* QR placeholder + branding */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-40 h-40 rounded-2xl border-2 border-primary/30 bg-primary/5 flex items-center justify-center">
          <p className="text-sm text-muted-foreground text-center px-4">
            Scan QR to join
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">FocusClub</span>
        </p>
      </div>

      {/* Stat dots */}
      <div className="flex gap-2 mt-8">
        {stats.map((_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === statIdx ? "bg-primary scale-125" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
