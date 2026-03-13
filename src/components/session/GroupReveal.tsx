/* DESIGN: The Reveal transforms pre-session anxiety into anticipation.
   Instead of "who will I sit with?" → "I can't wait to meet my table."
   Shows assigned tablemates with clues before the session. */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { motion } from "framer-motion";
import { MatchExplanation } from "@/components/discover/MatchExplanation";
import { useSubscription } from "@/hooks/useSubscription";
import { Sparkles, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GroupRevealProps {
  eventId: string;
  userId: string;
}

function getClue(profile: Record<string, any> | null): string {
  if (profile?.can_offer?.length > 0) return `Offers: ${profile!.can_offer[0]}`;
  if (profile?.work_vibe) {
    const labels: Record<string, string> = { deep_focus: "Deep Focus", casual_social: "Social", balanced: "Balanced" };
    return `${labels[profile.work_vibe] || profile.work_vibe} worker`;
  }
  if ((profile?.events_attended || 0) >= 10) return "donedonadone veteran";
  return "Someone interesting...";
}

export function GroupReveal({ eventId, userId }: GroupRevealProps) {
  const [groupMembers, setGroupMembers] = useState<Record<string, any>[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const { hasFeature } = useSubscription();
  const canSeeIcebreakers = hasFeature("ai_icebreakers");
  const navigate = useNavigate();
  const [icebreakers, setIcebreakers] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchGroup() {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("user_id, profiles:user_id(display_name, avatar_url, tagline, work_vibe, looking_for, can_offer, events_attended)")
        .eq("event_id", eventId)
        .eq("status", "going")
        .neq("user_id", userId)
        .limit(8);

      setGroupMembers(rsvps || []);

      // Fetch icebreakers for group members if user can see them
      if (canSeeIcebreakers && rsvps && rsvps.length > 0) {
        const ibMap: Record<string, string> = {};
        await Promise.all(
          rsvps.map(async (m) => {
            // get_match_explanation returns Json; cast to access fields
            const { data } = await supabase.rpc("get_match_explanation", {
              p_matched_user_id: m.user_id,
              p_session_id: eventId,
            }) as { data: { icebreaker?: string } | null };
            if (data?.icebreaker) ibMap[m.user_id] = data.icebreaker;
          })
        );
        setIcebreakers(ibMap);
      }
    }
    fetchGroup();
  }, [eventId, userId, canSeeIcebreakers]);

  if (groupMembers.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <p className="font-serif text-sm text-foreground">Your Table</p>
        <p className="text-xs text-muted-foreground">
          Tap each card to reveal who you're working with
        </p>

        <div className="grid grid-cols-2 gap-3">
          {groupMembers.map((member, i) => (
            <motion.div
              key={member.user_id}
              onClick={() => setRevealed(r => ({ ...r, [member.user_id]: true }))}
              whileTap={{ scale: 0.95 }}
              className="cursor-pointer"
            >
              {!revealed[member.user_id] ? (
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 min-h-[100px] justify-center">
                  <p className="text-2xl">?</p>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {getClue(member.profiles)}
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card min-h-[100px] justify-center"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.profiles?.avatar_url || ""} />
                    <AvatarFallback className="text-xs bg-muted">
                      {getInitials(member.profiles?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-medium text-foreground text-center">
                    {member.profiles?.display_name || "Member"}
                  </p>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {member.profiles?.tagline || member.profiles?.work_vibe || ""}
                  </p>
                  <MatchExplanation matchedUserId={member.user_id} sessionId={eventId} />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* AI Icebreakers section */}
        {canSeeIcebreakers ? (
          Object.keys(icebreakers).length > 0 && (
            <Card className="border-primary/10 bg-primary/5">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Icebreakers
                </p>
                {groupMembers.filter(m => icebreakers[m.user_id]).map(m => (
                  <p key={m.user_id} className="text-[11px] text-muted-foreground">
                    💡 <span className="font-medium text-foreground">{m.profiles?.display_name}:</span> "{icebreakers[m.user_id]}"
                  </p>
                ))}
              </CardContent>
            </Card>
          )
        ) : (
          groupMembers.length > 0 && (
            <button
              onClick={() => navigate("/pricing")}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
            >
              <Lock className="w-3 h-3" /> Upgrade to Plus for AI conversation starters
            </button>
          )
        )}
      </CardContent>
    </Card>
  );
}
