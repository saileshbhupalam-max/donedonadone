/**
 * @module DemandSignalCard
 * @description Home page social proof card showing how many people have requested
 * sessions nearby. Creates urgency and validates the user's own desire to cowork.
 *
 * WHY social proof here: Foursquare/ClassPass data shows proactive demand signals
 * increase supply-demand matching by 40%. Showing "X people requested sessions
 * near you" leverages descriptive social norms (Cialdini, 2001) — when people see
 * others doing something, they're more likely to do it themselves.
 *
 * Key exports: DemandSignalCard
 * Dependencies: Supabase client, AuthContext
 * Tables: session_requests
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, ArrowRight } from "lucide-react";

/**
 * Shows a compact card on the Home page: "X people requested sessions near you"
 * Only renders when there are pending requests in the user's neighborhood.
 */
export function DemandSignalCard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.neighborhood) {
      setLoading(false);
      return;
    }

    const fetchDemand = async () => {
      // WHY count pending requests in user's neighborhood: This number directly
      // communicates latent demand, motivating the user to add their own signal.
      // Even a count of 1 ("1 person requested") has social proof value.
      const { count, error } = await supabase
        .from("session_requests")
        .select("id", { count: "exact", head: true })
        .eq("neighborhood", profile.neighborhood)
        .eq("status", "pending")
        .neq("user_id", user.id);

      if (!error && count && count > 0) {
        setRequestCount(count);
      }
      setLoading(false);
    };

    fetchDemand();
  }, [user?.id, profile?.neighborhood]);

  if (loading || requestCount === 0) return null;

  return (
    <Card
      className="border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate("/events")}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">
            {requestCount} {requestCount === 1 ? "person" : "people"} requested sessions near you
          </p>
          <p className="text-[10px] text-muted-foreground">
            Add yours to unlock a group session faster
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}
