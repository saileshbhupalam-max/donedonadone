import { Link } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RankAvatar } from "@/components/gamification/RankAvatar";
import { RankBadge } from "@/components/gamification/RankBadge";
import { getRankForHours } from "@/lib/ranks";
import type { MatchedProfile } from "@/hooks/useProfiles";
import { CaptainBadge } from "@/components/captain/CaptainCard";
import { TierBadge } from "@/components/ui/TierBadge";
import type { TierId } from "@/hooks/useSubscription";
import { useSubscription } from "@/hooks/useSubscription";
import { MatchExplanation } from "@/components/discover/MatchExplanation";

const vibeConfig: Record<string, { label: string; emoji: string; className: string }> = {
  "deep_focus": { label: "Deep Focus", emoji: "🎯", className: "bg-primary/15 text-primary border-primary/30" },
  "casual_social": { label: "Casual", emoji: "☕", className: "bg-secondary/15 text-secondary border-secondary/30" },
  "balanced": { label: "Balanced", emoji: "⚖️", className: "bg-accent text-accent-foreground border-border" },
};

interface MemberCardProps {
  profile: MatchedProfile;
  showMatch?: boolean;
  showNew?: boolean;
  promptCount?: number;
}

export function MemberCard({ profile, showMatch, showNew, promptCount }: MemberCardProps) {
  const vibe = profile.work_vibe ? vibeConfig[profile.work_vibe] : null;
  const focusHours = Number(profile.focus_hours ?? 0);
  const rank = getRankForHours(focusHours);
  const { hasFeature } = useSubscription();

  return (
    <Link
      to={`/profile/${profile.id}`}
      className={`block rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5 relative ${rank.cardBorder} ${rank.cardBg || ""}`}
    >
      {showMatch && profile.matchScore > 0 && (
        <span className="absolute top-2 right-2 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
          {profile.matchScore}%
        </span>
      )}
      {showNew && (
        <span className="absolute top-2 right-2 text-[11px] font-semibold bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
          New
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <RankAvatar avatarUrl={profile.avatar_url} displayName={profile.display_name} focusHours={focusHours} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="font-semibold text-sm text-foreground truncate">{profile.display_name}</p>
            {profile.is_table_captain && <CaptainBadge />}
            {profile.subscription_tier && profile.subscription_tier !== "free" && (
              <TierBadge tier={profile.subscription_tier as TierId} size="sm" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.tagline || "No tagline yet"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {focusHours > 0 && <RankBadge focusHours={focusHours} size="sm" />}
        {vibe && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${vibe.className}`}>
            {vibe.emoji} {vibe.label}
          </span>
        )}
        {(profile.looking_for ?? []).slice(0, 1).map(tag => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      {(promptCount ?? 0) > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1.5">💬 {promptCount}</p>
      )}
      {showMatch && (
        <MatchExplanation matchedUserId={profile.id} />
      )}
    </Link>
  );
}
