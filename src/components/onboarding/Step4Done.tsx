/* DESIGN: Compact confirmation — profile preview + CTA to find sessions.
   No "edit something" — the profile page handles that later. */

import type { OnboardingData } from "@/lib/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: OnboardingData;
}

const VIBE_LABELS: Record<string, string> = {
  deep_focus: "🎯 Deep Focus",
  casual_social: "☕ Casual Social",
  balanced: "⚖️ Balanced",
};

export function Step4Done({ data }: Props) {
  const initials = data.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center pt-8 gap-6 max-w-sm mx-auto">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl text-foreground">You're in! 🎉</h1>
        <p className="text-muted-foreground text-sm">This is how others see you at the table.</p>
      </div>

      {/* Profile preview card */}
      <div className="w-full bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 ring-2 ring-primary/20">
            <AvatarImage src={data.avatar_url || undefined} />
            <AvatarFallback className="text-lg font-medium bg-primary/10 text-primary">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-xl text-foreground truncate">{data.display_name}</h2>
            {data.tagline && (
              <p className="text-sm text-muted-foreground truncate">{data.tagline}</p>
            )}
          </div>
        </div>

        {data.work_vibe && (
          <Badge variant="secondary" className="rounded-full">
            {VIBE_LABELS[data.work_vibe] || data.work_vibe}
          </Badge>
        )}

        {data.what_i_do && (
          <p className="text-sm text-foreground/80 line-clamp-2">{data.what_i_do}</p>
        )}

        {data.looking_for.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Looking for</p>
            <div className="flex flex-wrap gap-1.5">
              {data.looking_for.slice(0, 5).map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary">
                  {tag}
                </span>
              ))}
              {data.looking_for.length > 5 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  +{data.looking_for.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {data.can_offer.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Can offer</p>
            <div className="flex flex-wrap gap-1.5">
              {data.can_offer.slice(0, 5).map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/15 text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.neighborhood && (
          <p className="text-xs text-muted-foreground">📍 {data.neighborhood}</p>
        )}
      </div>
    </div>
  );
}
