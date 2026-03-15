import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Users, Shield, AlertTriangle } from "lucide-react";
import { createSmartGroups } from "@/lib/antifragile";
import { processSessionNoShows } from "@/lib/sessionSafety";
import { NOTIFICATION_COPY } from "@/lib/personality";
import { GroupPreviewModal, type GroupMember } from "@/components/admin/GroupPreviewModal";

export function EventsTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minThreshold, setMinThreshold] = useState(3);
  const [requests, setRequests] = useState<any[]>([]);
  const [showGroupPreview, setShowGroupPreview] = useState(false);
  const [previewGroups, setPreviewGroups] = useState<GroupMember[][]>([]);
  const [previewEvent, setPreviewEvent] = useState<any>(null);
  const [previewProfiles, setPreviewProfiles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: eventsData }, { data: settings }] = await Promise.all([
        supabase.from("events").select("*, profiles:created_by(display_name)").order("date", { ascending: false }),
        supabase.from("app_settings").select("value").eq("key", "min_session_threshold").single(),
      ]);
      setEvents(eventsData || []);
      if (settings?.value) setMinThreshold((settings.value as Record<string, unknown>)?.value as number || 3);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    supabase.from("session_requests").select("*, profiles:user_id(display_name)").eq("status", "pending").order("created_at", { ascending: false })
      .then(({ data }) => setRequests(data || []));
  }, []);

  const demandClusters = useMemo(() => {
    const groups: Record<string, any[]> = {};
    requests.forEach((r) => {
      const key = `${r.neighborhood}_${r.preferred_time}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).filter(([, v]) => v.length >= 3);
  }, [requests]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today);

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  const handleToggleGuaranteed = async (eventId: string, current: boolean) => {
    const { error } = await supabase.from("events").update({ guaranteed: !current }).eq("id", eventId);
    if (error) { toast.error("Failed to update"); return; }
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, guaranteed: !current } : e));
    toast.success(!current ? "Session guaranteed — runs even with 1 attendee" : "Guarantee removed");
  };

  const handleProcessNoShows = async (eventId: string, title: string) => {
    const result = await processSessionNoShows(eventId);
    if (result.success) {
      toast.success(result.noShowsProcessed > 0
        ? `Processed ${result.noShowsProcessed} no-show${result.noShowsProcessed > 1 ? "s" : ""} for ${title}`
        : `No ghost no-shows found for ${title}`);
    } else {
      toast.error(result.error || "Failed to process no-shows");
    }
  };

  const renderEvent = (e: any, showFlag: boolean) => {
    const isFlagged = showFlag && (e.rsvp_count || 0) < minThreshold;
    return (
      <Card key={e.id} className={isFlagged ? "border-destructive/50" : ""}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                {e.women_only && <Badge className="bg-secondary/20 text-secondary border-0 text-[10px]">W</Badge>}
                {e.admin_seeded && <Badge className="bg-blue-500/20 text-blue-600 border-0 text-[10px]">Seeded</Badge>}
                {e.guaranteed && <Badge className="bg-green-500/20 text-green-600 border-0 text-[10px]">Guaranteed</Badge>}
                {e.auto_created && <Badge className="bg-amber-500/20 text-amber-600 border-0 text-[10px]">Auto</Badge>}
                {e.status === "cancelled" && <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>}
                {isFlagged && <Badge variant="destructive" className="text-[10px]">Low RSVPs</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(parseISO(e.date), "MMM d")} · {e.neighborhood || "—"} · by {(e.profiles as { display_name: string } | null)?.display_name || "Unknown"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-muted-foreground">{e.rsvp_count || 0} RSVPs</span>
              {e.checkin_pin && <p className="text-[10px] text-muted-foreground font-mono">PIN: {e.checkin_pin}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleShuffleGroups = () => {
    if (!previewProfiles || previewProfiles.length === 0) return;
    const members = previewProfiles.map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      gender: p.gender,
      events_attended: p.events_attended || 0,
      is_table_captain: p.is_table_captain || false,
      no_show_count: p.no_show_count || 0,
      reliability_status: p.reliability_status || "good",
      work_vibe: p.work_vibe || null,
      noise_preference: p.noise_preference || null,
      comm_style: p.comm_style || null,
      looking_for: p.looking_for || null,
      can_offer: p.can_offer || null,
    }));
    const newGroups = createSmartGroups(members, 4);
    setPreviewGroups(newGroups);
  };

  const handleSaveGroups = async () => {
    if (!previewEvent || previewGroups.length === 0) return;
    const e = previewEvent;
    try {
      for (let i = 0; i < previewGroups.length; i++) {
        const { data: group } = await supabase.from("groups").insert({
          event_id: e.id,
          group_number: i + 1,
          table_assignment: `Table ${i + 1}`,
        }).select().single();
        if (group) {
          const memberInserts = previewGroups[i].map((m) => ({ group_id: group.id, user_id: m.id }));
          await supabase.from("group_members").insert(memberInserts);
        }
      }
      // Send buddy intro notifications to each group member
      const profileMap = new Map(previewProfiles.map((p: any) => [p.id, p]));
      for (let i = 0; i < previewGroups.length; i++) {
        for (const member of previewGroups[i]) {
          const teammateNames = previewGroups[i]
            .filter((m) => m.id !== member.id)
            .map((m) => {
              const prof = profileMap.get(m.id);
              return prof?.display_name || "a member";
            });
          if (teammateNames.length === 0) continue;
          const day = format(parseISO(e.date), "EEEE");
          const body = NOTIFICATION_COPY.groupAssigned(teammateNames, e.venue_name, day);
          await supabase.rpc("create_system_notification", {
            p_user_id: member.id,
            p_title: `Meet your table for ${e.title}!`,
            p_body: body,
            p_type: "buddy_intro",
            p_link: `/events/${e.id}`,
          });
        }
      }
      const totalMembers = previewGroups.reduce((sum, g) => sum + g.length, 0);
      toast.success(`Created ${previewGroups.length} groups for ${totalMembers} attendees`);
      setShowGroupPreview(false);
      setPreviewGroups([]);
      setPreviewEvent(null);
      setPreviewProfiles([]);
    } catch (err) {
      console.error("[SaveGroups]", err);
      toast.error("Failed to save groups");
    }
  };

  const fulfillRequest = async (id: string) => {
    try {
      const { error } = await supabase.from("session_requests").update({ status: "fulfilled" }).eq("id", id);
      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Request marked fulfilled");
    } catch (error) {
      console.error("[FulfillRequest]", error);
      toast.error("Something went wrong updating the request.");
    }
  };

  return (
    <div className="space-y-4">
      {/* High demand alerts */}
      {demandClusters.map(([key, items]) => (
        <Card key={key} className="border-primary/30">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-primary">🔥 High demand — {items.length} requests for {items[0].neighborhood} ({items[0].preferred_time})</p>
            <p className="text-[10px] text-muted-foreground">Consider creating a session</p>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs font-medium text-muted-foreground">Upcoming ({upcoming.length})</p>
      {upcoming.length === 0 ? <p className="text-xs text-muted-foreground">No upcoming sessions</p> :
        <div className="space-y-2">{upcoming.map((e) => (
          <div key={e.id} className="space-y-1">
            {renderEvent(e, true)}
            <div className="flex gap-1 ml-3">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => handleToggleGuaranteed(e.id, !!e.guaranteed)}>
              <Shield className="w-3 h-3 mr-1" /> {e.guaranteed ? "Remove Guarantee" : "Guarantee"}
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
              try {
                const { data: rsvps } = await supabase.from("event_rsvps").select("user_id").eq("event_id", e.id).eq("status", "going");
                if (!rsvps || rsvps.length === 0) { toast.error("No confirmed RSVPs for this session"); return; }
                const userIds = rsvps.map((r: any) => r.user_id);
                const { data: profiles } = await supabase.from("profiles").select("id, display_name, gender, events_attended, is_table_captain, no_show_count, reliability_status, work_vibe, noise_preference, comm_style, looking_for, can_offer").in("id", userIds);
                if (!profiles || profiles.length === 0) { toast.error("Could not load profiles"); return; }
                const members = profiles.map((p: any) => ({
                  id: p.id,
                  display_name: p.display_name,
                  gender: p.gender,
                  events_attended: p.events_attended || 0,
                  is_table_captain: p.is_table_captain || false,
                  no_show_count: p.no_show_count || 0,
                  reliability_status: p.reliability_status || "good",
                  work_vibe: p.work_vibe || null,
                  noise_preference: p.noise_preference || null,
                  comm_style: p.comm_style || null,
                  looking_for: p.looking_for || null,
                  can_offer: p.can_offer || null,
                }));
                const groups = createSmartGroups(members, 4);
                setPreviewGroups(groups);
                setPreviewEvent(e);
                setPreviewProfiles(profiles);
                setShowGroupPreview(true);
              } catch (err) {
                console.error("[CreateGroups]", err);
                toast.error("Failed to load members for grouping");
              }
            }}>
              <Users className="w-3 h-3 mr-1" /> Create Groups
            </Button>
            </div>
          </div>
        ))}</div>}
      <p className="text-xs font-medium text-muted-foreground">Past ({past.length})</p>
      {past.length === 0 ? <p className="text-xs text-muted-foreground">No past sessions</p> :
        <div className="space-y-2">{past.map((e) => (
          <div key={e.id} className="space-y-1">
            {renderEvent(e, false)}
            {e.status !== "completed" && e.status !== "cancelled" && (
              <Button size="sm" variant="outline" className="text-xs ml-3" onClick={() => handleProcessNoShows(e.id, e.title)}>
                <AlertTriangle className="w-3 h-3 mr-1" /> Process No-Shows
              </Button>
            )}
          </div>
        ))}</div>}

      {/* Session Requests */}
      <GroupPreviewModal
        open={showGroupPreview}
        onOpenChange={setShowGroupPreview}
        event={previewEvent}
        groups={previewGroups}
        onConfirm={handleSaveGroups}
        onShuffle={handleShuffleGroups}
      />

      {requests.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">Session Requests ({requests.length} pending)</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{(r.profiles as { display_name: string } | null)?.display_name || "Member"} · {r.request_type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.neighborhood} · {r.preferred_time} · {(r.preferred_days || []).join(", ")} · {format(parseISO(r.created_at), "MMM d")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => fulfillRequest(r.id)}>Fulfilled</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
