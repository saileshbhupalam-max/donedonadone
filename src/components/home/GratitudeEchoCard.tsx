/* DESIGN: Gratitude Echoes delay ~30% of props to create warm between-session moments.
   Intermittent reinforcement creates stronger emotional bonds than instant delivery.
   A notification arrives hours later saying "Someone appreciated you." */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const PROP_LABELS: Record<string, string> = {
  energy: "great energy ⚡", helpful: "being super helpful 🤝", focused: "infectious focus 🎯",
  inspiring: "being inspiring 💡", fun: "making it fun 🎉", kind: "being so welcoming 💛",
};

interface EchoData {
  id: string;
  prop_type: string;
  from_user: string;
  anonymous: boolean | null;
  event_id: string;
  from_display_name: string | null;
  from_avatar_url: string | null;
  venue_name: string | null;
  session_date: string | null;
}

export function GratitudeEchoCard() {
  const { user } = useAuth();
  const [echo, setEcho] = useState<EchoData | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("peer_props")
        .select("id, prop_type, from_user, anonymous, event_id")
        .eq("to_user", user.id)
        .eq("is_echo", true)
        .is("delivered_at", null)
        .lte("echo_deliver_at", now)
        .order("echo_deliver_at", { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        const prop = data[0];
        // Fetch sender profile + event info
        const [{ data: sender }, { data: event }] = await Promise.all([
          supabase.from("profiles").select("display_name, avatar_url").eq("id", prop.from_user).single(),
          supabase.from("events").select("venue_name, date").eq("id", prop.event_id).single(),
        ]);
        setEcho({
          ...prop,
          from_display_name: prop.anonymous ? null : sender?.display_name || null,
          from_avatar_url: prop.anonymous ? null : sender?.avatar_url || null,
          venue_name: event?.venue_name || null,
          session_date: event?.date || null,
        });
      }
    })();
  }, [user]);

  const handleAcknowledge = async () => {
    if (!echo) return;
    await supabase.from("peer_props")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", echo.id);
    setEcho(null);
  };

  if (!echo) return null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <Card className="border-amber-300/30 bg-gradient-to-br from-amber-50/60 to-yellow-50/40 dark:from-amber-950/30 dark:to-yellow-950/20 shadow-md">
        <CardContent className="p-5 space-y-3 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="inline-block"
          >
            <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
          </motion.div>

          <p className="font-serif text-base text-foreground">A gratitude echo arrived...</p>

          {!revealed ? (
            <Button size="sm" variant="outline" onClick={() => setRevealed(true)} className="gap-1.5">
              ✨ Reveal
            </Button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-sm text-foreground">
                {echo.from_display_name ? echo.from_display_name : "Someone"} appreciated you for {PROP_LABELS[echo.prop_type] || echo.prop_type}
              </p>

              {echo.from_display_name && echo.from_avatar_url && (
                <div className="flex justify-center">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={echo.from_avatar_url} />
                    <AvatarFallback className="text-xs bg-muted">{getInitials(echo.from_display_name)}</AvatarFallback>
                  </Avatar>
                </div>
              )}

              {echo.venue_name && (
                <p className="text-xs text-muted-foreground">
                  From your session at {echo.venue_name}
                </p>
              )}

              <Button size="sm" onClick={handleAcknowledge} className="gap-1.5">
                💛 Acknowledge
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
