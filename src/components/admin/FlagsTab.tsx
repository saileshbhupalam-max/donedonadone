import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Check, ShieldAlert, Ban, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FlagEntry {
  id: string;
  flagged_user: string;
  flagged_by: string;
  session_id: string;
  reason: string;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  flagged_profile?: { display_name: string | null };
  flagger_profile?: { display_name: string | null };
  event?: { title: string };
}

export function FlagsTab() {
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspendDuration, setSuspendDuration] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const fetchFlags = async () => {
    const { data } = await supabase.from("member_flags")
      .select("*, flagged_profile:profiles!member_flags_flagged_user_fkey(display_name), flagger_profile:profiles!member_flags_flagged_by_fkey(display_name), event:events!member_flags_session_id_fkey(title)")
      .order("created_at", { ascending: false });
    setFlags(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFlags(); }, []);

  const activeFlags = flags.filter(f => !f.resolved_at);
  const resolvedFlags = flags.filter(f => f.resolved_at);

  // Aggregate active by flagged user
  const byUser: Record<string, FlagEntry[]> = {};
  activeFlags.forEach(f => {
    if (!byUser[f.flagged_user]) byUser[f.flagged_user] = [];
    byUser[f.flagged_user].push(f);
  });
  const sortedUsers = Object.entries(byUser).sort(([, a], [, b]) => b.length - a.length);

  // Aggregate resolved by flagged user
  const resolvedByUser: Record<string, FlagEntry[]> = {};
  resolvedFlags.forEach(f => {
    if (!resolvedByUser[f.flagged_user]) resolvedByUser[f.flagged_user] = [];
    resolvedByUser[f.flagged_user].push(f);
  });
  const sortedResolved = Object.entries(resolvedByUser).sort(([, a], [, b]) => b.length - a.length);

  const handleDismiss = async (userId: string) => {
    setActing(userId);
    const { error } = await supabase.from("member_flags")
      .update({ resolved_at: new Date().toISOString(), resolution: "dismissed" })
      .eq("flagged_user", userId)
      .is("resolved_at", null);
    setActing(null);
    if (error) { toast.error("Failed to dismiss flags"); return; }
    toast.success("Flags dismissed");
    fetchFlags();
  };

  const handleWarn = async (userId: string, displayName: string) => {
    setActing(userId);
    // Send warning notification
    const { error: notifError } = await supabase.rpc("create_system_notification", {
      p_user_id: userId,
      p_title: "Community Guidelines Reminder",
      p_body: "We've received feedback about your behavior in sessions. Please review our community guidelines.",
      p_type: "warning",
    });
    if (notifError) { toast.error("Failed to send warning"); setActing(null); return; }

    // Mark flags as warned
    await supabase.from("member_flags")
      .update({ resolved_at: new Date().toISOString(), resolution: "warned" })
      .eq("flagged_user", userId)
      .is("resolved_at", null);

    setActing(null);
    toast.success(`Warning sent to ${displayName || "member"}`);
    fetchFlags();
  };

  const handleSuspend = async (userId: string, displayName: string) => {
    const duration = suspendDuration[userId];
    if (!duration) { toast.error("Select a suspension duration"); return; }
    setActing(userId);

    let suspendedUntil: string | null = null;
    let durationText = "";
    if (duration === "permanent") {
      suspendedUntil = "2099-12-31T23:59:59Z";
      durationText = "permanently";
    } else {
      const days = duration === "1week" ? 7 : duration === "2weeks" ? 14 : 30;
      const until = new Date();
      until.setDate(until.getDate() + days);
      suspendedUntil = until.toISOString();
      durationText = `for ${duration === "1week" ? "1 week" : duration === "2weeks" ? "2 weeks" : "1 month"}`;
    }

    // Update profile
    const { error: profileError } = await supabase.from("profiles")
      .update({
        suspended_until: suspendedUntil,
        suspension_reason: `Suspended ${durationText} due to community reports`,
      })
      .eq("id", userId);
    if (profileError) { toast.error("Failed to suspend user"); setActing(null); return; }

    // Notify user
    await supabase.rpc("create_system_notification", {
      p_user_id: userId,
      p_title: duration === "permanent" ? "Account suspended" : "Account temporarily suspended",
      p_body: duration === "permanent"
        ? "Your account has been suspended due to community guidelines violations."
        : `Your account has been suspended ${durationText}. Please review our community guidelines.`,
      p_type: "suspension",
    });

    // Mark flags
    await supabase.from("member_flags")
      .update({ resolved_at: new Date().toISOString(), resolution: "suspended" })
      .eq("flagged_user", userId)
      .is("resolved_at", null);

    setActing(null);
    toast.success(`${displayName || "Member"} suspended ${durationText}`);
    fetchFlags();
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const renderFlagGroup = (userId: string, userFlags: FlagEntry[], showActions: boolean) => {
    const name = userFlags[0]?.flagged_profile?.display_name || "Unknown";
    const uniqueFlaggers = new Set(userFlags.map(f => f.flagged_by)).size;
    const uniqueSessions = new Set(userFlags.map(f => f.session_id)).size;
    const isEscalated = uniqueFlaggers >= 2 && uniqueSessions >= 2;
    const resolution = userFlags[0]?.resolution;

    return (
      <Card key={userId} className={isEscalated && showActions ? "border-destructive/50" : ""}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">
                {userFlags.length} flag{userFlags.length > 1 ? "s" : ""} · {uniqueFlaggers} unique flagger{uniqueFlaggers > 1 ? "s" : ""} · {uniqueSessions} session{uniqueSessions > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isEscalated && showActions && <Badge variant="destructive" className="text-[10px]">⚠️ Escalated</Badge>}
              {!showActions && resolution && (
                <Badge variant={resolution === "suspended" ? "destructive" : resolution === "warned" ? "secondary" : "outline"} className="text-[10px] capitalize">
                  {resolution === "dismissed" && <Check className="w-3 h-3 mr-1" />}
                  {resolution === "warned" && <ShieldAlert className="w-3 h-3 mr-1" />}
                  {resolution === "suspended" && <Ban className="w-3 h-3 mr-1" />}
                  {resolution}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {userFlags.map(f => (
              <div key={f.id} className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{f.reason}</Badge>
                <span>by {f.flagger_profile?.display_name || "anonymous"}</span>
                <span>at {f.event?.title || "unknown session"}</span>
                {f.notes && <span className="italic">"{f.notes}"</span>}
                {f.resolved_at && <span className="text-[10px]">· {format(new Date(f.resolved_at), "MMM d, yyyy")}</span>}
              </div>
            ))}
          </div>

          {showActions && (
            <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
              <Button size="sm" variant="outline" className="text-xs" disabled={acting === userId} onClick={() => handleDismiss(userId)}>
                <Check className="w-3 h-3 mr-1" /> Dismiss
              </Button>
              <Button size="sm" variant="secondary" className="text-xs" disabled={acting === userId} onClick={() => handleWarn(userId, name)}>
                <ShieldAlert className="w-3 h-3 mr-1" /> Warn
              </Button>
              <div className="flex items-center gap-1">
                <Select value={suspendDuration[userId] || ""} onValueChange={(v) => setSuspendDuration(prev => ({ ...prev, [userId]: v }))}>
                  <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1week">1 week</SelectItem>
                    <SelectItem value="2weeks">2 weeks</SelectItem>
                    <SelectItem value="1month">1 month</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="destructive" className="text-xs" disabled={acting === userId || !suspendDuration[userId]} onClick={() => handleSuspend(userId, name)}>
                  <Ban className="w-3 h-3 mr-1" /> Suspend
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h2 className="font-serif text-lg text-foreground">Member Flags</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{flags.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Flags</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-orange-500">{activeFlags.length}</p>
            <p className="text-[10px] text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{sortedUsers.length}</p>
            <p className="text-[10px] text-muted-foreground">Flagged Members</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="text-xs">Active ({activeFlags.length})</TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs">Resolved ({resolvedFlags.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-3 space-y-3">
          {sortedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No active flags. That's a good sign.</p>
            </div>
          ) : sortedUsers.map(([userId, userFlags]) => renderFlagGroup(userId, userFlags, true))}
        </TabsContent>

        <TabsContent value="resolved" className="mt-3 space-y-3">
          {sortedResolved.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No resolved flags yet.</p>
            </div>
          ) : sortedResolved.map(([userId, userFlags]) => renderFlagGroup(userId, userFlags, false))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
