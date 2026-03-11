import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { MapPin, Link2, Hand } from "lucide-react";

interface Summary {
  total_checkins: number;
  total_connections: number;
  total_requests_helped: number;
}

export function ActivitySummary() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("get_activity_summary", { p_user_id: user.id })
      .then(({ data: rows }) => {
        if (rows && Array.isArray(rows) && rows.length > 0) {
          setData(rows[0] as Summary);
        }
      });
  }, [user]);

  if (!data) return null;

  const stats = [
    data.total_checkins > 0 && { icon: MapPin, label: `${data.total_checkins} check-in${data.total_checkins !== 1 ? "s" : ""}` },
    data.total_connections > 0 && { icon: Link2, label: `${data.total_connections} connection${data.total_connections !== 1 ? "s" : ""}` },
    data.total_requests_helped > 0 && { icon: Hand, label: `${data.total_requests_helped} helped` },
  ].filter(Boolean) as { icon: React.ElementType; label: string }[];

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s) => (
        <Badge key={s.label} variant="outline" className="gap-1.5 text-xs font-normal py-1 px-2.5">
          <s.icon className="w-3 h-3" />
          {s.label}
        </Badge>
      ))}
    </div>
  );
}
