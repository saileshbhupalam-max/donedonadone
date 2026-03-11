import { Link } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { RankAvatar } from "@/components/gamification/RankAvatar";
import { RankBadge } from "@/components/gamification/RankBadge";
import type { MatchedProfile } from "@/hooks/useProfiles";

interface HorizontalCardProps {
  profile: MatchedProfile;
  showMatch?: boolean;
  showNew?: boolean;
}

export function HorizontalCard({ profile, showMatch, showNew }: HorizontalCardProps) {
  const focusHours = Number(profile.focus_hours ?? 0);

  return (
    <Link
      to={`/profile/${profile.id}`}
      className="flex-shrink-0 w-[160px] rounded-xl border border-border bg-card p-3.5 transition-all hover:shadow-md relative"
    >
      {showMatch && profile.matchScore > 0 && (
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
          {profile.matchScore}%
        </span>
      )}
      {showNew && (
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5">
          New
        </span>
      )}
      <div className="flex justify-center">
        <RankAvatar avatarUrl={profile.avatar_url} displayName={profile.display_name} focusHours={focusHours} size="md" />
      </div>
      <p className="font-semibold text-xs text-foreground text-center mt-2 truncate">{profile.display_name}</p>
      <p className="text-[10px] text-muted-foreground text-center mt-0.5 truncate">{profile.tagline || "No tagline"}</p>
      {focusHours > 0 && (
        <div className="flex justify-center mt-1">
          <RankBadge focusHours={focusHours} size="sm" />
        </div>
      )}
      {showMatch && profile.matchReasons.length > 0 && (
        <p className="text-[9px] text-muted-foreground text-center mt-1.5 line-clamp-2 leading-tight">
          {profile.matchReasons[0]}
        </p>
      )}
    </Link>
  );
}
