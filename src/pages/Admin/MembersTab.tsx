import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Download, Search } from "lucide-react";

export function MembersTab() {
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
    a.href = url; a.download = `danadone-members-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
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
                {m.suspended_until && parseISO(m.suspended_until) > new Date() && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Suspended</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                {m.suspended_until && parseISO(m.suspended_until) > new Date() && (
                  <span className="text-[9px] text-destructive">
                    until {parseISO(m.suspended_until).getFullYear() >= 2099 ? "permanent" : format(parseISO(m.suspended_until), "MMM d")}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{m.profile_completion || 0}%</span>
            <span className="text-xs text-muted-foreground">{m.promptCount}</span>
            <span className="text-xs text-muted-foreground">{m.eventCount}</span>
            <span className="text-xs text-muted-foreground">{m.events_attended || 0}</span>
            <span className="text-xs text-muted-foreground">{m.events_no_show || 0}</span>
            {m.suspended_until && parseISO(m.suspended_until) > new Date() && (
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
