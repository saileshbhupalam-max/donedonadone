/* DESIGN: Monday Focus + Friday Wins create lightweight recurring engagement.
   Monday/Friday only — consistent rhythm, not constant noise.
   Users share intentions and wins, creating belonging between sessions. */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Target, Trophy, Heart } from "lucide-react";
import { toast } from "sonner";
import { startOfWeek } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type RitualRow = Tables<"community_rituals">;
type RitualLikeRow = Tables<"ritual_likes">;
type ProfileLite = Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url">;

interface RitualFeedItem extends Omit<RitualRow, "likes_count"> {
  likes_count: number;
  display_name: string | null;
  avatar_url: string | null;
  user_liked: boolean;
}

interface CommunityRitualCardProps {
  type: "monday_intention" | "friday_win";
}

export function CommunityRitualCard({ type }: CommunityRitualCardProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feed, setFeed] = useState<RitualFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekOf = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0];
  const isMonday = type === "monday_intention";
  const Icon = isMonday ? Target : Trophy;
  const title = isMonday ? "Monday Focus" : "Friday Wins";
  const prompt = isMonday ? "What's your #1 goal this week?" : "What did you accomplish this week?";
  const placeholder = isMonday ? "Ship the landing page..." : "Closed 2 deals this week...";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: existing } = await supabase
        .from("community_rituals")
        .select("id, user_id, content, likes_count, created_at, ritual_type, week_of")
        .eq("user_id", user.id)
        .eq("ritual_type", type)
        .eq("week_of", weekOf)
        .maybeSingle();

      if (existing) {
        setSubmitted(true);
        setContent(existing.content);
      }

      const { data: rituals } = await supabase
        .from("community_rituals")
        .select("id, user_id, content, likes_count, created_at, ritual_type, week_of")
        .eq("ritual_type", type)
        .eq("week_of", weekOf)
        .order("created_at", { ascending: false })
        .limit(10);

      if (rituals && rituals.length > 0) {
        const userIds = [...new Set(rituals.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);
        const profileMap = new Map((profiles || []).map((p: ProfileLite) => [p.id, p]));

        const ritualIds = rituals.map((r) => r.id);
        const { data: myLikes } = await supabase
          .from("ritual_likes")
          .select("ritual_id")
          .eq("user_id", user.id)
          .in("ritual_id", ritualIds);
        const likedSet = new Set((myLikes || []).map((l: Pick<RitualLikeRow, "ritual_id">) => l.ritual_id));

        setFeed(rituals.map((r) => ({
          ...r,
          likes_count: r.likes_count || 0,
          display_name: profileMap.get(r.user_id)?.display_name || null,
          avatar_url: profileMap.get(r.user_id)?.avatar_url || null,
          user_liked: likedSet.has(r.id),
        })));
      }
      setLoading(false);
    })();
  }, [user, type, weekOf]);

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from("community_rituals").upsert({
      user_id: user.id,
      ritual_type: type,
      content: content.trim(),
      week_of: weekOf,
    }, { onConflict: "user_id,ritual_type,week_of" });
    if (error) {
      toast.error("Couldn't save");
      return;
    }
    setSubmitted(true);
    toast.success(isMonday ? "Focus locked in! 🎯" : "Wins recorded! 🏆");
  };

  const toggleLike = async (ritualId: string, currentlyLiked: boolean) => {
    if (!user) return;

    const updatedFeed = feed.map((r) =>
      r.id === ritualId
        ? { ...r, user_liked: !currentlyLiked, likes_count: r.likes_count + (currentlyLiked ? -1 : 1) }
        : r
    );
    setFeed(updatedFeed);

    if (currentlyLiked) {
      await supabase.from("ritual_likes").delete().eq("user_id", user.id).eq("ritual_id", ritualId);
      await supabase.from("community_rituals").update({ likes_count: Math.max(0, (feed.find((r) => r.id === ritualId)?.likes_count || 1) - 1) }).eq("id", ritualId);
      return;
    }

    await supabase.from("ritual_likes").insert({ user_id: user.id, ritual_id: ritualId });
    await supabase.from("community_rituals").update({ likes_count: (feed.find((r) => r.id === ritualId)?.likes_count || 0) + 1 }).eq("id", ritualId);
  };

  return (
    <Card className={`border-${isMonday ? "primary" : "secondary"}/20`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h3 className="font-serif text-sm text-foreground">{title}</h3>
        </div>

        {!submitted ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{prompt}</p>
            <Input
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 280))}
              placeholder={placeholder}
              maxLength={280}
            />
            <Button size="sm" onClick={handleSubmit} disabled={!content.trim()} className="w-full">
              Share {isMonday ? "🎯" : "🏆"}
            </Button>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-foreground">
            "{content}"
          </div>
        )}

        {/* Community feed */}
        {feed.length > 0 && (
          <AnimatePresence>
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This week</p>
              {feed.filter(r => r.user_id !== user?.id).slice(0, 5).map(r => (
                <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-start gap-2 py-1.5">
                  <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                    <AvatarImage src={r.avatar_url || ""} />
                    <AvatarFallback className="text-[8px] bg-muted">{getInitials(r.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">{r.display_name?.split(" ")[0] || "Member"}</span>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                  </div>
                  <button
                    onClick={() => toggleLike(r.id, r.user_liked)}
                    className={`flex items-center gap-0.5 text-[10px] shrink-0 transition-colors ${r.user_liked ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                  >
                    <Heart className={`w-3 h-3 ${r.user_liked ? "fill-current" : ""}`} />
                    {r.likes_count > 0 && r.likes_count}
                  </button>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
