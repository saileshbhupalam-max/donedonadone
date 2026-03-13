import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/hooks/useUserContext";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SendConnectionRequest } from "@/components/connections/SendConnectionRequest";

interface MatchPerson {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role_type: string | null;
  looking_for: string[] | null;
  skills: string[] | null;
  taste_match_score: number;
  matchingTags: string[];
}

function MatchSuggestionsInner() {
  const { user } = useAuth();
  const { currentLocation, activeCheckIn, dnaComplete } = useUserContext();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectTarget, setConnectTarget] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      // Get current user's taste graph
      const { data: myTg } = await supabase
        .from("taste_graph")
        .select("work_looking_for, work_can_offer, skills")
        .eq("user_id", user.id)
        .maybeSingle();

      const myLookingFor = myTg?.work_looking_for || [];
      const mySkills = myTg?.skills || [];

      // Get who's here
      const rpcParams: Record<string, string> = { p_user_id: user.id };
      if (currentLocation?.id) rpcParams.p_location_id = currentLocation.id;
      const { data: people } = await supabase.rpc("get_whos_here", rpcParams as any);

      if (!people || people.length === 0) { setMatches([]); setLoading(false); return; }

      // Find matches based on overlap
      const scored: MatchPerson[] = people
        .map((p: any) => {
          const theirSkills = p.skills || [];
          const theirLookingFor = p.looking_for || [];
          const matchingTags: string[] = [];

          // Their skills match my looking_for
          myLookingFor.forEach((tag: string) => {
            if (theirSkills.includes(tag)) matchingTags.push(tag);
          });
          // My skills match their looking_for
          theirLookingFor.forEach((tag: string) => {
            if (mySkills.includes(tag) && !matchingTags.includes(tag)) matchingTags.push(tag);
          });

          return { ...p, matchingTags };
        })
        .filter((p: MatchPerson) => p.matchingTags.length > 0 || p.taste_match_score >= 60)
        .sort((a: MatchPerson, b: MatchPerson) => b.taste_match_score - a.taste_match_score)
        .slice(0, 5);

      setMatches(scored);
      setLoading(false);
    };

    fetch();
  }, [user, currentLocation]);

  if (loading) return null;

  if (dnaComplete < 30) {
    return (
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4 text-center space-y-2">
          <Sparkles className="w-5 h-5 text-primary mx-auto" />
          <p className="text-sm font-medium text-foreground">Complete your Work DNA to see personalized matches</p>
          <Button size="sm" variant="outline" onClick={() => navigate("/me/dna")}>Build your DNA</Button>
        </CardContent>
      </Card>
    );
  }

  if (matches.length < 2) {
    return (
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Not enough matches yet. Strengthen your DNA profile for better results.</p>
          <Button size="sm" variant="outline" onClick={() => navigate("/me/dna")}>Improve your DNA</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> People who match what you're looking for
        </p>
        <div className="space-y-2">
          {matches.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/profile/${m.user_id}`)}
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={m.avatar_url || ""} />
                <AvatarFallback className="text-[10px]">{getInitials(m.display_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{m.display_name}</p>
                  {m.role_type && <span className="text-[10px] text-muted-foreground capitalize">{m.role_type}</span>}
                </div>
                <div className="flex gap-1 flex-wrap mt-0.5">
                  {m.matchingTags.slice(0, 3).map((tag) => (
                    <Badge key={tag} className="text-[9px] px-1.5 py-0">{tag}</Badge>
                  ))}
                </div>
              </div>
              {m.taste_match_score >= 60 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 ${
                    m.taste_match_score >= 80
                      ? "border-green-500/30 text-green-600"
                      : "border-blue-500/30 text-blue-600"
                  }`}
                >
                  {m.taste_match_score}%
                </Badge>
              )}
              <Button size="sm" variant="outline" className="text-[10px] h-7 shrink-0" onClick={(e) => { e.stopPropagation(); setConnectTarget({ id: m.user_id, display_name: m.display_name, avatar_url: m.avatar_url }); }}>
                Connect
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
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

export function MatchSuggestions() {
  return (
    <FeatureGate featureFlag="taste_matching" requireCheckIn requireDnaComplete={30}>
      <MatchSuggestionsInner />
    </FeatureGate>
  );
}
