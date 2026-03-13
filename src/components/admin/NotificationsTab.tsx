import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Send, Zap, CalendarDays } from "lucide-react";

interface LogStats {
  channel: string;
  count: number;
}

interface StatusStats {
  status: string;
  count: number;
}

const CATEGORIES = [
  "session_reminder",
  "streak_warning",
  "weekly_digest",
  "connection_updates",
  "community_updates",
  "upgrade_prompts",
  "custom",
];

export function NotificationsTab() {
  const [logStats, setLogStats] = useState<LogStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");

  // Custom notification form
  const [targetUserId, setTargetUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; display_name: string; email: string }>>([]);
  const [category, setCategory] = useState("custom");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Trigger states
  const [triggeringStreaks, setTriggeringStreaks] = useState(false);
  const [triggeringReminders, setTriggeringReminders] = useState(false);

  const fetchStats = async () => {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(dateRange));
    const sinceStr = since.toISOString();

    const { data: logs } = await supabase
      .from("notification_log")
      .select("channel, status")
      .gte("created_at", sinceStr);

    if (logs) {
      const channelMap: Record<string, number> = {};
      const statusMap: Record<string, number> = {};
      logs.forEach((l) => {
        channelMap[l.channel] = (channelMap[l.channel] || 0) + 1;
        statusMap[l.status] = (statusMap[l.status] || 0) + 1;
      });
      setLogStats(Object.entries(channelMap).map(([channel, count]) => ({ channel, count })));
      setStatusStats(Object.entries(statusMap).map(([status, count]) => ({ status, count })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const searchUsers = async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(5);
    setSearchResults((data || []) as { id: string; display_name: string; email: string }[]);
  };

  const sendCustomNotification = async () => {
    if (!targetUserId || !title) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: { user_id: targetUserId, category, title, body, link: null },
      });
      if (error) throw error;
      toast.success("Notification sent!");
      setTitle("");
      setBody("");
      setTargetUserId("");
      setUserSearch("");
      fetchStats();
    } catch (err) {
      console.error("[SendCustomNotif]", err);
      toast.error("Failed to send notification");
    }
    setSending(false);
  };

  const triggerStreakWarnings = async () => {
    setTriggeringStreaks(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-streak-warnings");
      if (error) throw error;
      toast.success(`Sent ${data?.warnings_sent || 0} streak warnings`);
      fetchStats();
    } catch (err) {
      console.error("[TriggerStreaks]", err);
      toast.error("Failed to trigger streak warnings");
    }
    setTriggeringStreaks(false);
  };

  const triggerSessionReminders = async () => {
    setTriggeringReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-session-reminders");
      if (error) throw error;
      toast.success(`Sent ${data?.reminders_sent || 0} session reminders`);
      fetchStats();
    } catch (err) {
      console.error("[TriggerReminders]", err);
      toast.error("Failed to trigger session reminders");
    }
    setTriggeringReminders(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Notification Stats</h3>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["in_app", "push", "whatsapp", "email"] as const).map((ch) => {
          const stat = logStats.find((s) => s.channel === ch);
          return (
            <Card key={ch}>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground capitalize">{ch.replace("_", " ")}</p>
                <p className="text-xl font-bold text-foreground">{stat?.count || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusStats.map((s) => (
          <Badge
            key={s.status}
            variant={s.status === "failed" ? "destructive" : "outline"}
            className="text-xs"
          >
            {s.status}: {s.count}
          </Badge>
        ))}
      </div>

      {/* Trigger buttons */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Batch Actions</h3>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={triggerStreakWarnings}
              disabled={triggeringStreaks}
              className="gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              {triggeringStreaks ? "Sending..." : "Trigger Streak Warnings"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={triggerSessionReminders}
              disabled={triggeringReminders}
              className="gap-1.5"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {triggeringReminders ? "Sending..." : "Trigger Session Reminders"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom notification */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Send Custom Notification
          </h3>

          <div className="space-y-1">
            <Input
              value={userSearch}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search user by name or email..."
            />
            {searchResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0"
                    onClick={() => {
                      setTargetUserId(u.id);
                      setUserSearch(u.display_name || u.email);
                      setSearchResults([]);
                    }}
                  >
                    <span className="font-medium text-foreground">{u.display_name || "—"}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
            {targetUserId && (
              <p className="text-[10px] text-muted-foreground">
                Selected: {targetUserId.slice(0, 8)}...
              </p>
            )}
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification body (optional)"
            rows={2}
          />
          <Button
            size="sm"
            onClick={sendCustomNotification}
            disabled={sending || !targetUserId || !title}
          >
            {sending ? "Sending..." : "Send Notification"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
