/**
 * @module YourPlaces
 * @description Shows venues the user has visited (via check-ins), with visit counts
 * and links to /venue/:id. Used in Profile Journey tab.
 *
 * Key exports: YourPlaces
 * Dependencies: Supabase, useAuth
 * Tables: check_ins (joined with locations)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VisitedPlace {
  location_id: string;
  location_name: string;
  location_type: string;
  visit_count: number;
  last_visit: string;
}

const typeEmoji: Record<string, string> = {
  cafe: "☕",
  coworking_space: "🏢",
  tech_park: "🏗️",
  other: "📍",
};

export function YourPlaces() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get check-ins grouped by location with visit counts
      const { data } = await supabase
        .from("check_ins")
        .select("location_id, checked_in_at, locations!inner(id, name, location_type)")
        .eq("user_id", user.id)
        .not("location_id", "is", null)
        .order("checked_in_at", { ascending: false });

      if (!data || data.length === 0) { setLoading(false); return; }

      // Group by location
      const grouped = new Map<string, VisitedPlace>();
      for (const row of data as any[]) {
        const locId = row.location_id;
        const loc = row.locations;
        if (!loc) continue;
        const existing = grouped.get(locId);
        if (existing) {
          existing.visit_count++;
        } else {
          grouped.set(locId, {
            location_id: locId,
            location_name: loc.name,
            location_type: loc.location_type,
            visit_count: 1,
            last_visit: row.checked_in_at,
          });
        }
      }

      // Sort by visit count descending
      setPlaces([...grouped.values()].sort((a, b) => b.visit_count - a.visit_count));
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <Skeleton className="h-20" />;
  if (places.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" /> Your Places
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {places.map(p => (
          <Card
            key={p.location_id}
            className="shrink-0 w-36 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => navigate(`/venue/${p.location_id}`)}
          >
            <CardContent className="p-3 space-y-1">
              <p className="text-xs font-medium text-foreground truncate">
                {typeEmoji[p.location_type] || "📍"} {p.location_name}
              </p>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {p.visit_count} {p.visit_count === 1 ? "visit" : "visits"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
