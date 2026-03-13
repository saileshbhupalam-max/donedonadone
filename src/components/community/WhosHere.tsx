import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/hooks/useUserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { RefreshCw, Users, Lock, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SendConnectionRequest } from "@/components/connections/SendConnectionRequest";

interface WhosHerePerson {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  mode: string;
  note: string | null;
  checked_in_at: string;
  location_name: string | null;
  location_type: string | null;
  role_type: string | null;
  looking_for: string[] | null;
  skills: string[] | null;
  taste_match_score: number;
}

function WhosHereInner() {
  const { user } = useAuth();
  const { currentLocation, activeCheckIn } = useUserContext();
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();
  const [people, setPeople] = useState<WhosHerePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectTarget, setConnectTarget] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null);

  const fetchPeople = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const rpcParams: Record<string, string | number | null> = { p_user_id: user.id };
    if (currentLocation?.id) {
      rpcParams.p_location_id = currentLocation.id;
    } else if (activeCheckIn) {
      rpcParams.p_latitude = Number(activeCheckIn.latitude || 0) || null;
      rpcParams.p_longitude = Number(activeCheckIn.longitude || 0) || null;
    }
    const { data } = await supabase.rpc("get_whos_here", rpcParams as any);
    setPeople(data || []);
    setLoading(false);
  }, [user, currentLocation, activeCheckIn]);

  useEffect(() => {
    fetchPeople();
    const interval = setInterval(fetchPeople, 60000);
    return () => clearInterval(interval);
  }, [fetchPeople]);

  const statusEmoji = (s: string) => s === "available" ? "🟢" : s === "deep_work" ? "🟡" : "🔴";
  const statusLabel = (s: string) => s === "available" ? "Available" : s === "deep_work" ? "Deep Work" : "Busy";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Who's Here
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchPeople}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {people.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            You're the first one here! Others will see you when they check in. 🌱
          </p>
        ) : (
          <div className="space-y-2">
            {people.map((p) => (
              <div key={p.user_id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="w-9 h-9 mt-0.5">
                  <AvatarImage src={p.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{getInitials(p.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                    {p.taste_match_score >= 80 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600">Great match</Badge>
                    )}
                    {p.taste_match_score >= 60 && p.taste_match_score < 80 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-600">Good match</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{statusEmoji(p.status)} {statusLabel(p.status)}</span>
                    {p.role_type && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{p.role_type}</Badge>}
                  </div>
                  {p.note && <p className="text-[11px] text-muted-foreground italic truncate">"{p.note}"</p>}
                  {p.looking_for && p.looking_for.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {p.looking_for.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" className="text-[10px] h-7 shrink-0" onClick={() => setConnectTarget({ id: p.user_id, display_name: p.display_name, avatar_url: p.avatar_url })}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {/* Discovery teaser for free users */}
      {!hasFeature("discovery_full") && (() => {
        const highMatches = people.filter(p => p.taste_match_score >= 75);
        if (highMatches.length === 0) return null;
        const topScore = Math.max(...highMatches.map(p => p.taste_match_score));
        return (
          <CardContent className="px-4 pb-4 pt-0">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-medium text-foreground">
                  {highMatches.length} {highMatches.length === 1 ? "person" : "people"} here {highMatches.length === 1 ? "is" : "are"} {topScore}%+ match{highMatches.length === 1 ? "" : "es"} for you
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">See full profiles and why you matched.</p>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/pricing")}>
                <Lock className="w-3 h-3" /> Unlock with Plus
              </Button>
            </div>
          </CardContent>
        );
      })()}

      {connectTarget && (
        <SendConnectionRequest
          open={!!connectTarget}
          onOpenChange={(o) => !o && setConnectTarget(null)}
          targetUser={connectTarget}
        />
      )}
    </Card>
  );
}

export function WhosHere() {
  return (
    <FeatureGate featureFlag="whos_here" requireCheckIn>
      <WhosHereInner />
    </FeatureGate>
  );
}
