import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ArrowUpDown, Download, Search, Users, CalendarDays, MessageSquare, BarChart3, Trophy } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AdminAnalyticsCharts } from "@/components/admin/AdminAnalytics";
import { StatusGameTab } from "@/components/admin/StatusGameTab";
import { IcebreakersTab } from "@/components/admin/IcebreakersTab";
import { PartnersTab } from "@/components/admin/PartnersTab";
import { PartnerApplicationsTab } from "@/components/admin/PartnerApplicationsTab";
import { GrowthTab } from "@/components/admin/GrowthTab";
import { ChaiSettingsTab } from "@/components/admin/ChaiSettingsTab";
import { FlagsTab } from "@/components/admin/FlagsTab";
import { FeatureFlagsTab } from "@/components/admin/FeatureFlagsTab";
import { SubscriptionsTab } from "@/components/admin/SubscriptionsTab";
import { AIConfigTab } from "@/components/admin/AIConfigTab";
import { AnalyticsEngagementTab } from "@/components/admin/AnalyticsEngagementTab";
import { NotificationsTab } from "@/components/admin/NotificationsTab";
import { createSmartGroups } from "@/lib/antifragile";

type Profile = Tables<"profiles">;

const ADMIN_EMAILS = ["saileshbhupalam@gmail.com"];

// ─── Overview Tab ──────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const oneWeekAgo = subDays(new Date(), 7).toISOString();

      const [members, newMembers, events, upcomingEvents, rsvps, activePrompt, promptResponses, neighborhoods] = await Promise.all([
        supabase.from("profiles").select("profile_completion", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("date", today),
        supabase.from("event_rsvps").select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo),
        supabase.from("prompts").select("id, question, response_count").eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("prompt_responses").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("neighborhood"),
      ]);

      const completions = (members.data || []).map((p: any) => p.profile_completion || 0);
      const avgCompletion = completions.length ? Math.round(completions.reduce((a: number, b: number) => a + b, 0) / completions.length) : 0;

      const neighborhoodCounts: Record<string, number> = {};
      (neighborhoods.data || []).forEach((p: any) => {
        if (p.neighborhood) neighborhoodCounts[p.neighborhood] = (neighborhoodCounts[p.neighborhood] || 0) + 1;
      });

      setStats({
        totalMembers: members.count || 0,
        newThisWeek: newMembers.count || 0,
        avgCompletion,
        totalEvents: events.count || 0,
        upcomingEvents: upcomingEvents.count || 0,
        rsvpsThisWeek: rsvps.count || 0,
        activePrompt: activePrompt.data,
        totalPromptResponses: promptResponses.count || 0,
        neighborhoodCounts,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Members", value: stats.totalMembers, icon: Users },
          { label: "New This Week", value: stats.newThisWeek, icon: Users },
          { label: "Avg Completion", value: `${stats.avgCompletion}%`, icon: BarChart3 },
          { label: "Upcoming Sessions", value: stats.upcomingEvents, icon: CalendarDays },
          { label: "RSVPs This Week", value: stats.rsvpsThisWeek, icon: CalendarDays },
          { label: "Total Responses", value: stats.totalPromptResponses, icon: MessageSquare },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="w-3.5 h-3.5" />
                <span className="text-[11px]">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.activePrompt && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Active Prompt</p>
            <p className="text-sm font-medium text-foreground">{stats.activePrompt.question}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.activePrompt.response_count || 0} responses</p>
          </CardContent>
        </Card>
      )}

      {/* Analytics moved to dedicated tab */}
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────
function MembersTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("joined");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: promptCounts }, { data: rsvpCounts }, { data: badgeCounts }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("prompt_responses").select("user_id"),
        supabase.from("event_rsvps").select("user_id").eq("status", "going"),
        supabase.from("member_badges").select("user_id"),
      ]);

      const promptMap: Record<string, number> = {};
      (promptCounts || []).forEach((r: any) => { promptMap[r.user_id] = (promptMap[r.user_id] || 0) + 1; });
      const rsvpMap: Record<string, number> = {};
      (rsvpCounts || []).forEach((r: any) => { rsvpMap[r.user_id] = (rsvpMap[r.user_id] || 0) + 1; });
      const badgeMap: Record<string, number> = {};
      (badgeCounts || []).forEach((r: any) => { badgeMap[r.user_id] = (badgeMap[r.user_id] || 0) + 1; });

      setMembers((profiles || []).map((p) => ({
        ...p,
        promptCount: promptMap[p.id] || 0,
        eventCount: rsvpMap[p.id] || 0,
        badgeCount: badgeMap[p.id] || 0,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = members.filter((m) =>
      !search || m.display_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === "completion") list.sort((a, b) => (b.profile_completion || 0) - (a.profile_completion || 0));
    else if (sortBy === "prompts") list.sort((a, b) => b.promptCount - a.promptCount);
    else if (sortBy === "events") list.sort((a, b) => b.eventCount - a.eventCount);
    else list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return list;
  }, [members, search, sortBy]);

  const exportCSV = () => {
    const headers = ["Name", "Email", "Joined", "Focus Hours", "Focus Rank", "Completion", "Prompts", "Sessions Attended", "No-Shows", "Sessions (Going RSVPs)", "Badges", "Neighborhood", "Work Vibe", "Last Active"];
    const rows = filtered.map((m) => [
      m.display_name || "", m.email || "", m.created_at?.split("T")[0] || "",
      m.focus_hours ?? 0, m.focus_rank || "Newcomer",
      m.profile_completion || 0, m.promptCount, m.events_attended || 0, m.events_no_show || 0, m.eventCount, m.badgeCount,
      m.neighborhood || "", m.work_vibe || "", m.last_active_at?.split("T")[0] || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `focusclub-members-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members..." className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="joined">Joined</SelectItem>
            <SelectItem value="completion">Completion</SelectItem>
            <SelectItem value="prompts">Prompts</SelectItem>
            <SelectItem value="events">Sessions</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={exportCSV}><Download className="w-4 h-4" /></Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_40px_40px_40px_40px] gap-1 px-3 py-2 bg-muted text-[10px] font-medium text-muted-foreground uppercase">
          <span>Member</span><span>Comp.</span><span>📝</span><span>🎪</span><span>✅</span><span>❌</span>
        </div>
        {filtered.map((m) => (
          <div key={m.id}
            className="grid grid-cols-[1fr_60px_40px_40px_40px_40px] gap-1 px-3 py-2 border-t cursor-pointer hover:bg-muted/50 items-center"
            onClick={() => window.open(`/profile/${m.id}`, "_blank")}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground truncate">{m.display_name || "—"}</p>
                {m.suspended_until && new Date(m.suspended_until) > new Date() && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Suspended</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                {m.suspended_until && new Date(m.suspended_until) > new Date() && (
                  <span className="text-[9px] text-destructive">
                    until {new Date(m.suspended_until).getFullYear() >= 2099 ? "permanent" : format(new Date(m.suspended_until), "MMM d")}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{m.profile_completion || 0}%</span>
            <span className="text-xs text-muted-foreground">{m.promptCount}</span>
            <span className="text-xs text-muted-foreground">{m.eventCount}</span>
            <span className="text-xs text-muted-foreground">{m.events_attended || 0}</span>
            <span className="text-xs text-muted-foreground">{m.events_no_show || 0}</span>
            {m.suspended_until && new Date(m.suspended_until) > new Date() && (
              <Button size="sm" variant="outline" className="text-[10px] col-span-6 mt-1 h-6" onClick={async (e) => {
                e.stopPropagation();
                await supabase.from("profiles").update({ suspended_until: null, suspension_reason: null }).eq("id", m.id);
                await supabase.rpc("create_system_notification", {
                  p_user_id: m.id,
                  p_title: "Account suspension lifted",
                  p_body: "Your account suspension has been lifted. Welcome back!",
                  p_type: "suspension_lifted",
                });
                setMembers(prev => prev.map(p => p.id === m.id ? { ...p, suspended_until: null, suspension_reason: null } : p));
                toast.success("Suspension lifted");
              }}>
                Lift Suspension
              </Button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">{filtered.length} members</p>
    </div>
  );
}

// ─── Prompts Tab ──────────────────────────────────────────
function PromptsTab() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmoji, setNewEmoji] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const fetchPrompts = async () => {
    const { data } = await supabase.from("prompts").select("*").order("sort_order", { ascending: true });
    setPrompts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  const setActive = async (id: string) => {
    try {
      // Deactivate all, activate selected
      await supabase.from("prompts").update({ is_active: false }).neq("id", "none");
      await supabase.from("prompts").update({ is_active: true }).eq("id", id);

      // Notify all members
      const { data: profiles } = await supabase.from("profiles").select("id").eq("onboarding_completed", true);
      const prompt = prompts.find((p) => p.id === id);
      if (profiles && prompt) {
        for (const p of profiles) {
          await supabase.rpc("create_system_notification", {
            p_user_id: p.id,
            p_title: `New prompt: ${prompt.emoji || "💬"} ${prompt.question.slice(0, 50)}`,
            p_body: "Share your answer with the community!",
            p_type: "new_prompt",
            p_link: "/prompts",
          });
        }
      }

      toast.success("Prompt activated & members notified!");
      fetchPrompts();
    } catch (error) {
      console.error("[SetActivePrompt]", error);
      toast.error("Something went wrong activating the prompt.");
    }
  };

  const createPrompt = async () => {
    if (!newQuestion) return;
    try {
      const maxOrder = Math.max(0, ...prompts.map((p) => p.sort_order || 0));
      const { error } = await supabase.from("prompts").insert({
        question: newQuestion,
        emoji: newEmoji || null,
        category: newCategory || null,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
      setNewQuestion(""); setNewEmoji(""); setNewCategory("");
      toast.success("Prompt created!");
      fetchPrompts();
    } catch (error) {
      console.error("[CreatePrompt]", error);
      toast.error("Something went wrong creating the prompt.");
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Create New Prompt</p>
          <div className="flex gap-2">
            <Input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="🎯" className="w-14" />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {["work_style", "interests", "social", "reflection", "icebreaker"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Your prompt question..." rows={2} />
          <Button size="sm" onClick={createPrompt} disabled={!newQuestion}>Create Prompt</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {prompts.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{p.emoji || "💬"}</span>
                  <p className="text-sm text-foreground truncate">{p.question}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{p.response_count || 0} responses</span>
                </div>
              </div>
              {p.is_active ? (
                <Badge className="bg-secondary text-secondary-foreground shrink-0">Active</Badge>
              ) : (
                <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setActive(p.id)}>Set Active</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Events Tab ──────────────────────────────────────────
function EventsTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minThreshold, setMinThreshold] = useState(3);
  const [requests, setRequests] = useState<any[]>([]);

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

  const renderEvent = (e: any, showFlag: boolean) => {
    const isFlagged = showFlag && (e.rsvp_count || 0) < minThreshold;
    return (
      <Card key={e.id} className={isFlagged ? "border-destructive/50" : ""}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                {e.women_only && <Badge className="bg-secondary/20 text-secondary border-0 text-[10px]">👩</Badge>}
                {isFlagged && <Badge variant="destructive" className="text-[10px]">⚠️ Low RSVPs</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(e.date), "MMM d")} · {e.neighborhood || "—"} · by {(e.profiles as { display_name: string } | null)?.display_name || "Unknown"}
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
            <Button size="sm" variant="outline" className="text-xs ml-3" onClick={async () => {
              try {
                const { data: rsvps } = await supabase.from("event_rsvps").select("user_id").eq("event_id", e.id).eq("status", "going");
                if (!rsvps || rsvps.length === 0) { toast.error("No confirmed RSVPs for this session"); return; }
                const userIds = rsvps.map((r: any) => r.user_id);
                const { data: profiles } = await supabase.from("profiles").select("id, gender, events_attended, is_table_captain, no_show_count, reliability_status").in("id", userIds);
                if (!profiles || profiles.length === 0) { toast.error("Could not load profiles"); return; }
                const members = profiles.map((p: any) => ({
                  id: p.id,
                  gender: p.gender,
                  events_attended: p.events_attended || 0,
                  is_table_captain: p.is_table_captain || false,
                  no_show_count: p.no_show_count || 0,
                  reliability_status: p.reliability_status || "good",
                }));
                const groups = createSmartGroups(members, 4);
                for (let i = 0; i < groups.length; i++) {
                  const { data: group } = await supabase.from("groups").insert({
                    event_id: e.id,
                    group_number: i + 1,
                    table_assignment: `Table ${i + 1}`,
                  }).select().single();
                  if (group) {
                    const memberInserts = groups[i].map((m) => ({ group_id: group.id, user_id: m.id }));
                    await supabase.from("group_members").insert(memberInserts);
                  }
                }
                toast.success(`Created ${groups.length} groups for ${rsvps.length} attendees`);
              } catch (err) {
                console.error("[CreateGroups]", err);
                toast.error("Failed to create groups");
              }
            }}>
              <Users className="w-3 h-3 mr-1" /> Create Groups
            </Button>
          </div>
        ))}</div>}
      <p className="text-xs font-medium text-muted-foreground">Past ({past.length})</p>
      {past.length === 0 ? <p className="text-xs text-muted-foreground">No past sessions</p> :
        <div className="space-y-2">{past.map((e) => renderEvent(e, false))}</div>}

      {/* Session Requests */}
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
                      {r.neighborhood} · {r.preferred_time} · {(r.preferred_days || []).join(", ")} · {format(new Date(r.created_at), "MMM d")}
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

// ─── Settings Tab ──────────────────────────────────────────
function SettingsTab() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("app_settings").select("*").order("key").then(({ data }) => {
      setSettings(data || []);
      setLoading(false);
    });
  }, []);

  const handleSave = async (key: string) => {
    const raw = edits[key];
    if (raw === undefined) return;
    try {
      const setting = settings.find((s) => s.key === key);
      const newValue = { ...setting.value, value: isNaN(Number(raw)) ? (raw === "true" ? true : raw === "false" ? false : raw) : Number(raw) };
      const { error } = await supabase.from("app_settings").update({ value: newValue, updated_at: new Date().toISOString() }).eq("key", key);
      if (error) throw error;
      setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value: newValue } : s));
      setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
      toast.success(`Setting "${key}" updated`);
    } catch (error) {
      console.error("[SaveSetting]", error);
      toast.error("Something went wrong saving the setting.");
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-3">
      {settings.map((s) => (
        <Card key={s.key}>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">{s.key}</p>
            <p className="text-xs text-muted-foreground">{s.value?.description}</p>
            <div className="flex gap-2">
              <Input
                value={edits[s.key] ?? String(s.value?.value ?? "")}
                onChange={(e) => setEdits((prev) => ({ ...prev, [s.key]: e.target.value }))}
                className="flex-1"
              />
              <Button size="sm" onClick={() => handleSave(s.key)} disabled={edits[s.key] === undefined}>Save</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────
export default function Admin() {
  usePageTitle("Mission Control -- FocusClub");
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.user_type === 'admin' || ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/home");
    }
  }, [user, authLoading, navigate, isAdmin]);

  if (authLoading || !user || !isAdmin) {
    return <AppShell><div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Skeleton className="h-8 w-32" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl text-foreground">Mission Control</h1>

        <Tabs defaultValue="analytics">
          <TabsList className="w-full flex">
            <TabsTrigger value="analytics" className="flex-1 text-xs">Analytics</TabsTrigger>
            <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
            <TabsTrigger value="members" className="flex-1 text-xs">Members</TabsTrigger>
            <TabsTrigger value="status" className="flex-1 text-xs">Status</TabsTrigger>
            <TabsTrigger value="icebreakers" className="flex-1 text-xs">Icebreakers</TabsTrigger>
            <TabsTrigger value="partners" className="flex-1 text-xs">Partners</TabsTrigger>
            <TabsTrigger value="applications" className="flex-1 text-xs">Applications</TabsTrigger>
            <TabsTrigger value="growth" className="flex-1 text-xs">Growth</TabsTrigger>
             <TabsTrigger value="flags" className="flex-1 text-xs">Flags</TabsTrigger>
            <TabsTrigger value="feature-flags" className="flex-1 text-xs">Feature Flags</TabsTrigger>
            <TabsTrigger value="chai" className="flex-1 text-xs">Chai</TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-1 text-xs">Subs</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 text-xs">AI</TabsTrigger>
            <TabsTrigger value="engagement" className="flex-1 text-xs">Engagement</TabsTrigger>
            <TabsTrigger value="notifs" className="flex-1 text-xs">Notifs</TabsTrigger>
            <TabsTrigger value="prompts" className="flex-1 text-xs">Prompts</TabsTrigger>
            <TabsTrigger value="events" className="flex-1 text-xs">Sessions</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4"><AdminAnalyticsCharts /></TabsContent>
          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="members" className="mt-4"><MembersTab /></TabsContent>
          <TabsContent value="status" className="mt-4"><StatusGameTab /></TabsContent>
          <TabsContent value="icebreakers" className="mt-4"><IcebreakersTab /></TabsContent>
          <TabsContent value="partners" className="mt-4"><PartnersTab /></TabsContent>
          <TabsContent value="applications" className="mt-4"><PartnerApplicationsTab /></TabsContent>
          <TabsContent value="growth" className="mt-4"><GrowthTab /></TabsContent>
          <TabsContent value="flags" className="mt-4"><FlagsTab /></TabsContent>
          <TabsContent value="feature-flags" className="mt-4"><FeatureFlagsTab /></TabsContent>
          <TabsContent value="chai" className="mt-4"><ChaiSettingsTab /></TabsContent>
          <TabsContent value="subscriptions" className="mt-4"><SubscriptionsTab /></TabsContent>
          <TabsContent value="ai" className="mt-4"><AIConfigTab /></TabsContent>
          <TabsContent value="engagement" className="mt-4"><AnalyticsEngagementTab /></TabsContent>
          <TabsContent value="notifs" className="mt-4"><NotificationsTab /></TabsContent>
          <TabsContent value="prompts" className="mt-4"><PromptsTab /></TabsContent>
          <TabsContent value="events" className="mt-4"><EventsTab /></TabsContent>
          <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
