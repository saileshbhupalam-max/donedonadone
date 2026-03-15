/**
 * @module DayPassConversionCard
 * @description Post-session CTA card that nudges day-pass users to become full members.
 * Shows after session wrap-up ONLY for users who attended via a day pass.
 * Displays match scores with top 2-3 group members and "why they match" reasons
 * from calculateMatch(), then offers a "Become a member" CTA linking to /pricing.
 *
 * Key exports:
 * - DayPassConversionCard — Self-contained card that checks day_pass status, fetches
 *   group members, calculates match scores, and renders conversion CTA
 *
 * Dependencies: matchUtils (calculateMatch), trackConversion, supabase, AuthContext, shadcn/ui
 * Tables: day_passes (read — check attendance type), group_members (read), groups (read), profiles (read)
 * Related: SessionWrapUp.tsx (parent), DayPassCard.tsx (purchase flow), matchUtils.ts (scoring)
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculateMatch } from "@/lib/matchUtils";
import { trackConversion } from "@/lib/trackConversion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight, Star, Sparkles } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { motion } from "framer-motion";

type Profile = Tables<"profiles">;

/** Match result for a single group member, used for rendering */
interface MemberMatch {
  memberId: string;
  displayName: string;
  score: number;
  reasons: string[];
}

interface DayPassConversionCardProps {
  eventId: string;
  userId: string;
}

/**
 * Renders a gradient CTA card for day-pass attendees showing how well they
 * matched with their group. Only visible when the user has an active day_pass
 * for this event. Fires a trackConversion event when rendered so we can
 * measure impression-to-upgrade rates.
 */
export function DayPassConversionCard({ eventId, userId }: DayPassConversionCardProps) {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<MemberMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDayPassUser, setIsDayPassUser] = useState(false);

  useEffect(() => {
    if (!userId || !eventId || !profile) {
      setLoading(false);
      return;
    }

    (async () => {
      // Step 1: Check if user attended via day pass — skip everything if they didn't.
      // Only "active" passes represent completed purchases that were used.
      const { data: dayPass } = await supabase
        .from("day_passes")
        .select("id")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .eq("status", "active")
        .maybeSingle();

      if (!dayPass) {
        setLoading(false);
        return;
      }

      setIsDayPassUser(true);

      // Step 2: Find the user's group for this event.
      // Uses the same join pattern as YourTableCard — group_members → groups via event_id.
      const { data: myMembership } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(event_id)")
        .eq("user_id", userId)
        .eq("groups.event_id", eventId)
        .limit(1);

      if (!myMembership || myMembership.length === 0) {
        setLoading(false);
        return;
      }

      const groupId = myMembership[0].group_id;

      // Step 3: Fetch full profiles of other group members.
      // We need the complete profile for calculateMatch (work_vibe, looking_for, etc.)
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .neq("user_id", userId);

      if (!memberRows || memberRows.length === 0) {
        setLoading(false);
        return;
      }

      const memberIds = memberRows.map((m) => m.user_id);
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", memberIds);

      if (!memberProfiles || memberProfiles.length === 0) {
        setLoading(false);
        return;
      }

      // Step 4: Score matches and pick top 3.
      // Sorting by score so the card leads with the strongest connection —
      // social proof that "these are YOUR people" drives conversion.
      const scored: MemberMatch[] = memberProfiles
        .map((memberProfile: Profile) => {
          const { score, reasons } = calculateMatch(profile, memberProfile);
          return {
            memberId: memberProfile.id,
            displayName: memberProfile.display_name || "Member",
            score,
            reasons,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setMatches(scored);

      // Step 5: Track that the conversion card was shown.
      // This fires once per render — lets us measure impression→click→upgrade funnel.
      const matchScores = scored.map((m) => ({ userId: m.memberId, score: m.score }));
      trackConversion("day_pass_to_member", { userId, eventId, matchScores });

      setLoading(false);
    })();
  }, [userId, eventId, profile]);

  // Don't render anything while loading or if user isn't a day-pass attendee
  if (loading || !isDayPassUser || matches.length === 0) return null;

  const topScore = matches[0]?.score ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="overflow-hidden border-primary/20">
        {/* Gradient header — visually distinct from other wrap-up cards to draw attention */}
        <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              You found your people
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Here's how well you matched with your table today
          </p>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Match score circles — visual anchoring makes abstract compatibility tangible */}
          <div className="flex items-center justify-center gap-4">
            {matches.map((match) => (
              <div key={match.memberId} className="flex flex-col items-center gap-1.5">
                {/* Score circle — size and color intensity scale with match quality */}
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle
                      cx="28" cy="28" r="24"
                      fill="none"
                      stroke="hsl(var(--border))"
                      strokeWidth="3"
                    />
                    <circle
                      cx="28" cy="28" r="24"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 * (1 - match.score / 100)}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground">{match.score}</span>
                  </div>
                </div>
                <span className="text-xs text-foreground truncate max-w-[72px] text-center">
                  {match.displayName.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Reason pills — concrete reasons are more persuasive than abstract scores */}
          {matches.some((m) => m.reasons.length > 0) && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {/* Deduplicate reasons across members and show up to 4 */}
              {Array.from(
                new Set(matches.flatMap((m) => m.reasons))
              )
                .slice(0, 4)
                .map((reason) => (
                  <Badge
                    key={reason}
                    variant="secondary"
                    className="text-[10px] px-2 py-0.5 font-normal"
                  >
                    {reason}
                  </Badge>
                ))}
            </div>
          )}

          {/* Social proof line — anchors the CTA with a concrete benefit */}
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <Star className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              {topScore >= 60
                ? "Strong matches like these are rare. Members get grouped with compatible people every session."
                : "Members get matched into compatible groups every session — no more working alone."}
            </p>
          </div>

          {/* CTA — Link to /pricing instead of onClick handler so it works with browser navigation */}
          <Button asChild className="w-full gap-2">
            <Link to="/pricing">
              <Users className="h-4 w-4" />
              Become a member
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
