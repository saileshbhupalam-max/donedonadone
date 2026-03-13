import { useState } from "react";
import { Trophy, Medal, Camera, Star, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// TODO: wire to engine
function getLeaderboard(_neighborhood: string, _period: "week" | "allTime") {
  return {
    entries: [
      { rank: 1, name: "Priya K.", avatar: null, fc: 340, topType: "photos" },
      { rank: 2, name: "Arjun M.", avatar: null, fc: 280, topType: "referrals" },
      { rank: 3, name: "Deepa S.", avatar: null, fc: 210, topType: "venue-data" },
      { rank: 4, name: "Rahul P.", avatar: null, fc: 180, topType: "ratings" },
      { rank: 5, name: "Sneha V.", avatar: null, fc: 150, topType: "photos" },
    ],
    currentUser: { rank: 4, name: "You", avatar: null, fc: 180, topType: "ratings" },
    totalContributors: 67,
  };
}

interface NeighborhoodLeaderboardProps {
  neighborhood: string;
  userId: string;
}

const TYPE_BADGES: Record<string, { icon: React.ElementType; label: string }> = {
  photos: { icon: Camera, label: "Photographer" },
  referrals: { icon: Users, label: "Connector" },
  "venue-data": { icon: Star, label: "Scout" },
  ratings: { icon: Star, label: "Reviewer" },
};

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-500",
  2: "text-gray-400",
  3: "text-amber-700",
};

export function NeighborhoodLeaderboard({ neighborhood, userId }: NeighborhoodLeaderboardProps) {
  const [period, setPeriod] = useState<"week" | "allTime">("week");
  const data = getLeaderboard(neighborhood, period);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            {neighborhood} Leaderboard
          </CardTitle>
        </div>
        {/* User rank callout */}
        {data.currentUser && (
          <p className="text-sm text-muted-foreground">
            You're <span className="font-semibold text-foreground">#{data.currentUser.rank}</span> in {neighborhood}
          </p>
        )}
        {/* Period tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-0.5 mt-2">
          {(["week", "allTime"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md transition-all font-medium",
                period === p ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "week" ? "This Week" : "All Time"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.entries.map((entry) => {
          const isCurrentUser = entry.rank === data.currentUser?.rank;
          const badge = TYPE_BADGES[entry.topType];

          return (
            <div
              key={entry.rank}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-all",
                isCurrentUser && "bg-primary/5 border border-primary/20"
              )}
            >
              {/* Rank */}
              <div className="w-6 text-center">
                {entry.rank <= 3 ? (
                  <Medal className={cn("w-5 h-5 mx-auto", RANK_STYLES[entry.rank])} />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">{entry.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="w-8 h-8">
                <AvatarImage src={entry.avatar || undefined} />
                <AvatarFallback className="text-xs bg-muted">
                  {entry.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>

              {/* Name & badge */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isCurrentUser && "text-primary")}>
                  {isCurrentUser ? "You" : entry.name}
                </p>
                {badge && (
                  <div className="flex items-center gap-1">
                    <badge.icon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{badge.label}</span>
                  </div>
                )}
              </div>

              {/* FC */}
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {entry.fc} FC
              </span>
            </div>
          );
        })}

        {/* Social proof */}
        <p className="text-xs text-center text-muted-foreground pt-2">
          {data.totalContributors} contributors in {neighborhood} this {period === "week" ? "week" : "month"}
        </p>
      </CardContent>
    </Card>
  );
}
