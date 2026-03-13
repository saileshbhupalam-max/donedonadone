import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { scoreNeedForUser } from "@/lib/needsMatch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type TasteGraph = Tables<"taste_graph">;

/**
 * Home page card that shows the count of needs matching the user's profile.
 * Only renders if there are 1+ matching needs.
 */
export function NeedsMatchCard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    const fetchAndScore = async () => {
      const [needsRes, tgRes] = await Promise.all([
        supabase
          .from("micro_requests")
          .select("id, title, description, request_type, user_id, status")
          .eq("status", "open")
          .neq("user_id", user.id)
          .gte("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("taste_graph")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const needs = needsRes.data || [];
      const tg = tgRes.data as TasteGraph | null;

      let count = 0;
      for (const need of needs) {
        const match = scoreNeedForUser(need, profile, tg);
        if (match.matchScore >= 20) count++;
      }

      setMatchCount(count);
      setLoading(false);
    };

    fetchAndScore();
  }, [user?.id, profile?.id]);

  // Don't render if loading or no matches
  if (loading || matchCount === 0) return null;

  return (
    <Card
      className="border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate("/needs?tab=matching")}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">
            {matchCount} need{matchCount !== 1 ? "s" : ""} matching your skills
          </p>
          <p className="text-[10px] text-muted-foreground">
            People in the community could use your help
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}
