/* DESIGN: ScrapbookPrompt auto-generates a scrapbook entry at session wrap-up
   and shows "Your session story is ready!" preview card.
   Users don't manually create memories — we gather everything automatically. */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ScrapbookCard, type ScrapbookEntry } from "./ScrapbookCard";
import { motion } from "framer-motion";

interface GroupMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ScrapbookPromptProps {
  eventId: string;
  userId: string;
  event: any;
  intention: string;
  accomplished: string | null;
  totalMinutes: number;
  groupMembers: GroupMember[];
  onGenerated: () => void;
}

export function ScrapbookPrompt({
  eventId, userId, event, intention, accomplished, totalMinutes, groupMembers, onGenerated
}: ScrapbookPromptProps) {
  const navigate = useNavigate();
  const [entry, setEntry] = useState<ScrapbookEntry | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    generateScrapbook();
  }, []);

  const generateScrapbook = async () => {
    try {
      // Gather props received
      const { data: props } = await supabase
        .from("peer_props")
        .select("from_user, prop_type, profiles:from_user(display_name)")
        .eq("to_user", userId)
        .eq("event_id", eventId);

      const propsReceived = (props || []).map((p) => ({
        from_user_id: p.from_user,
        from_display_name: (p.profiles as any)?.display_name || null, // TODO: fix type — joined relation
        prop_type: p.prop_type,
      }));

      // Get photo
      const { data: photos } = await supabase
        .from("session_photos")
        .select("photo_url")
        .eq("event_id", eventId)
        .limit(1);

      // Get cowork again picks
      const { data: picks } = await supabase
        .from("cowork_preferences")
        .select("preferred_user_id")
        .eq("user_id", userId)
        .eq("event_id", eventId);

      const focusHours = Math.round(totalMinutes / 60 * 10) / 10;
      const memberNames = groupMembers
        .filter(m => m.user_id !== userId)
        .map(m => m.display_name?.split(" ")[0] || "someone")
        .slice(0, 3);
      const nameStr = memberNames.length > 0 ? ` with ${memberNames.join(" & ")}` : "";
      const highlight = `${focusHours}hr session at ${event.venue_name || "the spot"}${nameStr}`;

      const scrapbookData = {
        user_id: userId,
        event_id: eventId,
        session_date: event.date,
        venue_name: event.venue_name || null,
        venue_neighborhood: event.neighborhood || null,
        group_members: groupMembers.filter(m => m.user_id !== userId) as unknown as any,
        cowork_again_picks: (picks || []).map(p => p.preferred_user_id),
        intention: intention || null,
        intention_accomplished: accomplished || null,
        props_received: propsReceived as unknown as any,
        photo_url: photos?.[0]?.photo_url || null,
        focus_hours: focusHours,
        highlight,
      };

      const { data, error } = await supabase
        .from("session_scrapbook")
        .upsert(scrapbookData, { onConflict: "user_id,event_id" })
        .select()
        .single();

      if (error) throw error;

      setEntry(data as unknown as ScrapbookEntry);
      onGenerated();
    } catch (err) {
      console.error("[Scrapbook]", err);
    } finally {
      setGenerating(false);
    }
  };

  if (generating) return null;
  if (!entry) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3 text-center">
          <p className="text-2xl">📔</p>
          <p className="font-serif text-base text-foreground">Your session story is ready!</p>
        </CardContent>
      </Card>

      <div className="mt-3">
        <ScrapbookCard entry={entry} />
      </div>

      <div className="flex gap-2 mt-3">
        <Button variant="outline" className="flex-1" onClick={() => navigate("/me?tab=journey")}>
          View in Journey
        </Button>
      </div>
    </motion.div>
  );
}
