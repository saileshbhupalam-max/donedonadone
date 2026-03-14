import { useState, useEffect } from "react";
import { trackConversion } from "@/lib/trackConversion";
import { AppShell } from "@/components/layout/AppShell";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureGate } from "@/components/FeatureGate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SendConnectionRequest } from "@/components/connections/SendConnectionRequest";
import { useNavigate } from "react-router-dom";
import { Globe, MapPin, Lock, UserPlus, Sparkles } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { motion } from "framer-motion";

interface CrossSpacePerson {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  work_vibe: string | null;
  venue_name: string;
  venue_area: string | null;
}

const VIBE_LABELS: Record<string, string> = {
  deep_focus: "Deep Focus",
  casual_social: "Social",
  balanced: "Balanced",
};

function NetworkTeaser() {
  const navigate = useNavigate();
  return (
    <Card className="border-border/50 bg-muted/10">
      <CardContent className="pt-6 pb-8 space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Globe className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="font-serif text-xl text-foreground">Your Network Across Bangalore</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Discover matched professionals at cafes you haven't visited yet
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-muted blur-[2px]" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5" />
          <span>Available on Max plan</span>
        </div>
        <Button onClick={() => { trackConversion("clicked_upgrade", { from: "cross_space_network_gate" }); navigate("/pricing"); }} className="gap-2">
          <Sparkles className="w-4 h-4" /> Unlock with Max — ₹1,499/month
        </Button>
      </CardContent>
    </Card>
  );
}

function NetworkContent() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<CrossSpacePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectTarget, setConnectTarget] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    supabase.rpc("get_cross_space_people").then(({ data }) => {
      if (data && Array.isArray(data)) setPeople(data as unknown as CrossSpacePerson[]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-3">
              <Skeleton className="w-36 h-44 rounded-xl" />
              <Skeleton className="w-36 h-44 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5 text-center space-y-2">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No cross-space matches yet. Attend more sessions to discover people at other venues.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by venue
  const byVenue = people.reduce<Record<string, CrossSpacePerson[]>>((acc, p) => {
    const key = `${p.venue_name}||${p.venue_area || ""}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(byVenue).map(([key, members]) => {
        const [venueName, venueArea] = key.split("||");
        return (
          <div key={key} className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{venueName}</p>
                {venueArea && <p className="text-[11px] text-muted-foreground">{venueArea}</p>}
              </div>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {members.map((m) => (
                  <Card key={m.user_id} className="w-40 flex-shrink-0 border-border/50">
                    <CardContent className="p-3 space-y-2.5">
                      <button onClick={() => navigate(`/profile/${m.user_id}`)} className="flex flex-col items-center gap-2 w-full">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={m.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(m.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-medium text-foreground truncate w-full text-center">{m.display_name || "Member"}</p>
                      </button>
                      {m.tagline && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 text-center">{m.tagline}</p>
                      )}
                      {m.work_vibe && (
                        <Badge variant="outline" className="text-[9px] mx-auto block w-fit">
                          {VIBE_LABELS[m.work_vibe] || m.work_vibe}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs gap-1"
                        onClick={() => setConnectTarget({ id: m.user_id, display_name: m.display_name, avatar_url: m.avatar_url })}
                      >
                        <UserPlus className="w-3 h-3" /> Connect
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        );
      })}

      {connectTarget && (
        <SendConnectionRequest
          open={!!connectTarget}
          onOpenChange={(open) => !open && setConnectTarget(null)}
          targetUser={connectTarget}
        />
      )}
    </div>
  );
}

export default function CrossSpaceNetwork() {
  usePageTitle("Network — DanaDone");

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-5"
      >
        <h1 className="font-serif text-xl text-foreground">Cross-Space Network</h1>
        <FeatureGate requiredTier="max" teaser={<NetworkTeaser />}>
          <NetworkContent />
        </FeatureGate>
      </motion.div>
    </AppShell>
  );
}
