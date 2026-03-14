import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { WhatsAppShareButton } from "@/components/sharing/WhatsAppButton";
import { format, subDays, isMonday, startOfWeek, endOfWeek } from "date-fns";

import { useRef } from "react";
import { Download } from "lucide-react";

// ─── Community Highlight (social proof for ALL members) ──────
export function CommunityHighlight() {
  const navigate = useNavigate();
  const [highlight, setHighlight] = useState<{
    eventTitle: string;
    venueName: string | null;
    attendees: { avatar_url: string | null; display_name: string | null }[];
    totalCount: number;
    dayLabel: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const yesterday = subDays(new Date(), 1).toISOString().split("T")[0];
      const twoDaysAgo = subDays(new Date(), 2).toISOString().split("T")[0];

      // Find events from yesterday or 2 days ago
      const { data: recentEvents } = await supabase.from("events")
        .select("id, title, venue_name, date")
        .gte("date", twoDaysAgo).lte("date", yesterday)
        .order("date", { ascending: false }).limit(1);

      if (!recentEvents || recentEvents.length === 0) return;
      const ev = recentEvents[0];

      // Get attendees who gave feedback (actually attended)
      const { data: feedback } = await supabase.from("event_feedback")
        .select("user_id").eq("event_id", ev.id).eq("attended", true);
      if (!feedback || feedback.length === 0) return;

      const userIds = feedback.map(f => f.user_id);
      const { data: profiles } = await supabase.from("profiles")
        .select("avatar_url, display_name").in("id", userIds).limit(5);

      const dayLabel = ev.date === yesterday ? "yesterday" : "recently";

      setHighlight({
        eventTitle: ev.title,
        venueName: ev.venue_name,
        attendees: profiles || [],
        totalCount: userIds.length,
        dayLabel,
      });
    })();
  }, []);

  if (!highlight) return null;

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-4 space-y-2">
        <p className="text-xs font-medium text-secondary">DanaDone Highlight ✨</p>
        <p className="text-sm text-foreground">
          {highlight.totalCount} members coworked{highlight.venueName ? ` at ${highlight.venueName}` : ""} {highlight.dayLabel}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {highlight.attendees.map((a, i) => (
              <Avatar key={i} className="w-7 h-7 border-2 border-background">
                <AvatarImage src={a.avatar_url || ""} />
                <AvatarFallback className="text-[10px] bg-muted">{getInitials(a.display_name)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          {highlight.totalCount > 5 && (
            <span className="text-xs text-muted-foreground">and {highlight.totalCount - 5} more</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/events")}>
          Join the next session →
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Enhanced Weekly Digest with Shareable Image ──────
interface EnhancedWeeklyDigestProps {
  sessions: number;
  hours: number;
  propsGiven: number;
  propsReceived: number;
  newPeopleMet: number;
  streak: number;
  topPercent: number | null;
  communityStats: { members: number; sessionsThisWeek: number; propsThisWeek: number };
  displayName: string | null;
  referralCode: string | null;
}

export function EnhancedWeeklyDigest(props: EnhancedWeeklyDigestProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
    const a = document.createElement("a");
    a.download = `danadone-week-${format(new Date(), "yyyy-MM-dd")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const shareMsg = `My DanaDone week: ${props.sessions} sessions, ${props.hours}h deep work, ${props.propsReceived} props received${props.streak > 0 ? `, 🔥 ${props.streak} streak` : ""}! Join me: ${window.location.origin}/invite/${props.referralCode || ""}`;

  return (
    <div className="space-y-2">
      {/* Visible card */}
      <Card className="border-secondary/20 bg-secondary/5">
        <CardContent className="p-4 space-y-3">
          <p className="font-serif text-sm text-foreground">Your Week in DanaDone 📊</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{props.sessions}</p>
              <p className="text-[10px] text-muted-foreground">Sessions</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{props.hours}h</p>
              <p className="text-[10px] text-muted-foreground">Deep Work</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{props.streak}</p>
              <p className="text-[10px] text-muted-foreground">🔥 Streak</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Props given: <span className="font-medium text-foreground">{props.propsGiven}</span></span>
            <span>Props received: <span className="font-medium text-foreground">{props.propsReceived}</span></span>
            <span>New people met: <span className="font-medium text-foreground">{props.newPeopleMet}</span></span>
          </div>
          {props.topPercent && props.topPercent <= 30 && (
            <p className="text-xs font-medium text-secondary">You're in the top {props.topPercent}% of active members!</p>
          )}
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
            Community: {props.communityStats.members} members · {props.communityStats.sessionsThisWeek} sessions · {props.communityStats.propsThisWeek} props this week
          </div>
          <div className="flex gap-2">
            <WhatsAppShareButton message={shareMsg} label="Share your week" size="sm" variant="outline" className="flex-1 text-xs" />
            <Button size="sm" variant="ghost" className="text-xs" onClick={downloadImage}>
              <Download className="w-3 h-3" /> Image
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden card for image generation */}
      <div className="overflow-hidden h-0">
        <div ref={cardRef} style={{
          width: 400, padding: 32, background: "linear-gradient(135deg, #F5F0EB, #F0D5C5)",
          fontFamily: "Inter, sans-serif", borderRadius: 16
        }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>FOCUSCLUB WEEKLY SUMMARY</p>
            <p style={{ fontSize: 20, fontFamily: "DM Serif Display, serif", color: "#2D2D2D" }}>
              {props.displayName?.split(" ")[0]}'s Week
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: "center", background: "rgba(255,255,255,0.6)", borderRadius: 12, padding: 12 }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#2D2D2D" }}>{props.sessions}</p>
              <p style={{ fontSize: 10, color: "#888" }}>Sessions</p>
            </div>
            <div style={{ textAlign: "center", background: "rgba(255,255,255,0.6)", borderRadius: 12, padding: 12 }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#2D2D2D" }}>{props.hours}h</p>
              <p style={{ fontSize: 10, color: "#888" }}>Deep Work</p>
            </div>
            <div style={{ textAlign: "center", background: "rgba(255,255,255,0.6)", borderRadius: 12, padding: 12 }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#2D2D2D" }}>🔥{props.streak}</p>
              <p style={{ fontSize: 10, color: "#888" }}>Streak</p>
            </div>
          </div>
          <div style={{ textAlign: "center", borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 12 }}>
            <p style={{ fontSize: 11, color: "#888" }}>Join me on DanaDone · danadone.club</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Smart Invite Suggestion (for Discover) ──────
interface InviteSuggestionProps {
  matchName: string;
  workVibe: string | null;
  referralCode: string | null;
}

export function InviteSuggestion({ matchName, workVibe, referralCode }: InviteSuggestionProps) {
  const vibeLabels: Record<string, string> = { deep_focus: "deep focus", casual_social: "casual coworking", balanced: "balanced work" };
  const vibeLabel = workVibe ? vibeLabels[workVibe] || workVibe : "focused work";

  return (
    <Card className="border-dashed border-primary/20">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Know someone like {matchName}? Members like them love DanaDone.
        </p>
        <WhatsAppShareButton
          message={`I found my coworking match on DanaDone! If you're into ${vibeLabel}, you'd love it too: ${window.location.origin}/invite/${referralCode || ""}`}
          label="Invite someone similar"
          size="sm"
          variant="outline"
          className="text-xs"
        />
      </CardContent>
    </Card>
  );
}
