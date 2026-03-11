import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Users, Flame, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DigestData {
  user_id: string;
  week_start: string;
  sessions_attended: number;
  connections_made: number;
  props_received: number;
  rank_progress: string | null;
  highlight: string | null;
}

export function WeeklyDigest() {
  const navigate = useNavigate();
  const [data, setData] = useState<DigestData | null>(null);

  useEffect(() => {
    // get_weekly_digest returns Json; cast to access fields
    supabase.rpc("get_weekly_digest").then(({ data: result }) => {
      const digest = result as unknown as DigestData | null;
      if (digest && digest.user_id) setData(digest);
    });
  }, []);

  if (!data) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Your Week
          </p>
          <button
            onClick={() => navigate("/me")}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
          >
            View full stats <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <StatItem icon={<CalendarDays className="w-3 h-3" />} value={data.sessions_attended} label="Sessions" />
          <StatItem icon={<Users className="w-3 h-3" />} value={data.connections_made} label="Connections" />
          <StatItem icon={<Flame className="w-3 h-3" />} value={data.props_received} label="Props" />
        </div>

        {data.rank_progress && (
          <p className="text-[11px] text-muted-foreground">📈 {data.rank_progress}</p>
        )}

        {data.highlight && (
          <p className="text-xs text-foreground font-medium">{data.highlight}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
