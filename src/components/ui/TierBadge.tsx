import { Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TierId } from "@/hooks/useSubscription";

interface TierBadgeProps {
  tier: TierId;
  size?: "sm" | "md";
  className?: string;
}

const tierConfig: Record<string, { label: string; border: string; text: string; bg: string; icon?: "sparkles" | "crown"; glow?: boolean }> = {
  free: { label: "", border: "", text: "", bg: "" },
  plus: { label: "Plus", border: "border-blue-500/40", text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  pro: { label: "Pro", border: "border-purple-500/40", text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", icon: "sparkles" },
  max: { label: "Max", border: "border-yellow-500/40", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", icon: "crown", glow: true },
};

export function TierBadge({ tier, size = "sm", className }: TierBadgeProps) {
  if (tier === "free") return null;

  const config = tierConfig[tier];
  if (!config || !config.label) return null;

  const isSmall = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border font-semibold",
        config.border,
        config.text,
        config.bg,
        isSmall ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        config.glow && "shadow-[0_0_6px_hsl(45,90%,50%,0.3)]",
        className
      )}
    >
      {config.icon === "sparkles" && <Sparkles className={cn(isSmall ? "w-2.5 h-2.5" : "w-3 h-3")} />}
      {config.icon === "crown" && <Crown className={cn(isSmall ? "w-2.5 h-2.5" : "w-3 h-3")} />}
      {config.label}
    </span>
  );
}
