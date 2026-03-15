import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getInitials } from "@/lib/utils";

// ─── Profile Views Section ──────────────────────────────
export function ProfileViewsSection({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<Array<{ viewer_id: string; viewed_at: string; display_name: string | null; avatar_url: string | null }>>([]);

  useEffect(() => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fetchViews = async () => {
      const { count } = await supabase
        .from("profile_views")
        .select("id", { count: "exact", head: true })
        .eq("viewed_id", userId)
        .gte("viewed_at", oneWeekAgo);
      setViewCount(count || 0);

      if (hasFeature("profile_views_names")) {
        const { data } = await supabase
          .from("profile_views")
          .select("viewer_id, viewed_at, profiles:viewer_id(display_name, avatar_url)")
          .eq("viewed_id", userId)
          .gte("viewed_at", oneWeekAgo)
          .order("viewed_at", { ascending: false })
          .limit(10);
        setViewers((data || []).map((d: any) => ({
          viewer_id: d.viewer_id,
          viewed_at: d.viewed_at,
          display_name: d.profiles?.display_name,
          avatar_url: d.profiles?.avatar_url,
        })));
      }
    };
    fetchViews();
  }, [userId, hasFeature]);

  if (viewCount === 0) return null;

  const canSeeNames = hasFeature("profile_views_names");

  return (
    <Card className="border-border/50 cursor-pointer" role="button" tabIndex={0} onClick={() => !canSeeNames && navigate("/pricing")} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!canSeeNames) navigate("/pricing"); } }}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{viewCount} {viewCount === 1 ? "person" : "people"} viewed your profile this week</p>
        </div>
        {canSeeNames ? (
          <div className="space-y-2">
            {viewers.map((v) => (
              <div key={v.viewer_id} className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={v.avatar_url || ""} />
                  <AvatarFallback className="text-[8px]">{getInitials(v.display_name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground">{v.display_name || "Someone"}</span>
                <span className="text-[10px] text-muted-foreground">· {format(parseISO(v.viewed_at), "MMM d")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-muted blur-[2px] border-2 border-background" />
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Upgrade to Plus to see who's viewing you</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
