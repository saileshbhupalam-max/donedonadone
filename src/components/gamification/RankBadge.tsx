import { getRankForHours } from "@/lib/ranks";

interface RankBadgeProps {
  focusHours?: number;
  size?: "sm" | "md";
}

export function RankBadge({ focusHours = 0, size = "sm" }: RankBadgeProps) {
  const rank = getRankForHours(focusHours);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 ${
      size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
    }`}>
      {rank.emoji} {rank.name}
    </span>
  );
}
