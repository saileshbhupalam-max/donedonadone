/**
 * @component NeighborhoodUnlock
 * @description Shows neighborhood unlock progress on Home page. Two states:
 *
 * **Locked:** "X/10 members to unlock [area]" with endowed 20% progress bar
 * (never shows 0% — feels hopeless) + referral share CTA via Web Share API.
 *
 * **Unlocked:** Green celebration card with "Nominate your favorite cafe" CTA
 * linking to /nominate. Shows active venue + nomination counts.
 *
 * Props: neighborhood (slug), userId, referralCode (optional for share link)
 * Dependencies: venueNomination.ts (getNeighborhoodReadiness), neighborhoods.ts (displayNeighborhood)
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Share2, PartyPopper, Plus } from "lucide-react";
import { getNeighborhoodReadiness, type NeighborhoodReadiness } from "@/lib/venueNomination";
import { displayNeighborhood } from "@/lib/neighborhoods";
import { motion, AnimatePresence } from "framer-motion";

interface NeighborhoodUnlockProps {
  neighborhood: string;
  userId: string;
  referralCode?: string;
}

export function NeighborhoodUnlock({ neighborhood, userId, referralCode }: NeighborhoodUnlockProps) {
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState<NeighborhoodReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!neighborhood) return;
    getNeighborhoodReadiness(neighborhood).then((r) => {
      setReadiness(r);
      setLoading(false);
    });
  }, [neighborhood]);

  if (loading || !readiness) return null;

  const { memberCount, threshold, isUnlocked, activeVenues, nominations } = readiness;

  // Endowed progress: start at 20% so it never feels like zero
  const rawPercent = Math.round((memberCount / threshold) * 100);
  const displayPercent = Math.min(Math.max(rawPercent, 20), 100);

  // Already unlocked — show nomination CTA
  if (isUnlocked) {
    return (
      <Card className="border-green-500/20 bg-green-50/30 dark:bg-green-950/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <PartyPopper className="w-5 h-5 text-green-600" />
            <h3 className="font-serif text-base text-foreground">{neighborhood} is unlocked!</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {activeVenues} active {activeVenues === 1 ? "venue" : "venues"} · {nominations.length} {nominations.length === 1 ? "nomination" : "nominations"}
          </p>
          <Button
            size="sm"
            className="w-full"
            onClick={() => navigate("/nominate")}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nominate your favorite cafe
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not unlocked — show progress + referral CTA
  const remaining = threshold - memberCount;
  const displayName = displayNeighborhood(neighborhood);
  const inviteMsg = referralCode
    ? `Join DanaDone in ${displayName}! Use my invite: ${window.location.origin}/invite/${referralCode}`
    : `Join DanaDone in ${displayName}!`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join DanaDone", text: inviteMsg });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(inviteMsg);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-serif text-base text-foreground">Unlock {displayName}</h3>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> {memberCount}/{threshold} members
          </span>
          <span className="text-xs font-medium text-foreground">{displayPercent}%</span>
        </div>

        <Progress value={displayPercent} className="h-2 mb-3" />

        <p className="text-xs text-muted-foreground mb-3">
          {remaining} more {remaining === 1 ? "member" : "members"} and you can nominate venues and unlock sessions in your area.
        </p>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleShare}
        >
          <Share2 className="w-3.5 h-3.5 mr-1.5" /> Invite friends to unlock your area
        </Button>
      </CardContent>
    </Card>
  );
}
