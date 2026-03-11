import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import { getRankForHours } from "@/lib/ranks";

interface RankAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  focusHours?: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: { avatar: "h-9 w-9", wrapper: "p-[2px]", skeleton: "h-9 w-9" },
  md: { avatar: "h-11 w-11", wrapper: "p-[2px]", skeleton: "h-11 w-11" },
  lg: { avatar: "h-16 w-16", wrapper: "p-[3px]", skeleton: "h-16 w-16" },
  xl: { avatar: "h-20 w-20", wrapper: "p-[3px]", skeleton: "h-20 w-20" },
};

export function RankAvatar({ avatarUrl, displayName, focusHours = 0, size = "md", className = "" }: RankAvatarProps) {
  const rank = getRankForHours(focusHours);
  const initials = getInitials(displayName);
  const s = sizeMap[size];
  const [imgLoaded, setImgLoaded] = useState(!avatarUrl);

  const avatarElement = (
    <Avatar className={`${s.avatar} ${!rank.ringColor ? className : ""}`}>
      {!imgLoaded && avatarUrl && <Skeleton className={`${s.skeleton} rounded-full absolute inset-0`} />}
      <AvatarImage
        src={avatarUrl ?? undefined}
        alt={displayName ?? ""}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        className={imgLoaded ? "" : "opacity-0"}
      />
      <AvatarFallback className="bg-muted text-muted-foreground text-xs">{initials}</AvatarFallback>
    </Avatar>
  );

  if (!rank.ringColor) return avatarElement;

  return (
    <div
      className={`rounded-full ${s.wrapper} ${className}`}
      style={{
        background: rank.ringColor,
        boxShadow: rank.glow ? `0 0 12px ${rank.ringColor}40, 0 0 24px ${rank.ringColor}20` : undefined,
        padding: rank.ringWidth >= 3 ? "3px" : "2px",
      }}
    >
      <Avatar className={`${s.avatar} border-2 border-background`}>
        {!imgLoaded && avatarUrl && <Skeleton className={`${s.skeleton} rounded-full absolute inset-0`} />}
        <AvatarImage
          src={avatarUrl ?? undefined}
          alt={displayName ?? ""}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          className={imgLoaded ? "" : "opacity-0"}
        />
        <AvatarFallback className="bg-muted text-muted-foreground text-xs">{initials}</AvatarFallback>
      </Avatar>
    </div>
  );
}
