/**
 * @module PendingApprovals
 * @description Shows sessions at the partner's venue that need approval.
 * Partner can approve (→ upcoming) or reject (→ cancelled, attendees notified).
 *
 * Dependencies: supabase, sonner
 * RPCs: approve_venue_session, reject_venue_session
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalendarCheck, CalendarX, Clock, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface PendingEvent {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  max_attendees: number | null;
  rsvp_count: number;
}

interface PendingApprovalsProps {
  locationId: string;
}

export function PendingApprovals({ locationId }: PendingApprovalsProps) {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, date, start_time, end_time, max_attendees")
        .eq("location_id", locationId)
        .eq("status", "pending_venue_approval")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date");

      if (data) {
        // Get RSVP counts for each event
        const withCounts = await Promise.all(
          data.map(async (e) => {
            const { count } = await supabase
              .from("event_rsvps")
              .select("id", { count: "exact", head: true })
              .eq("event_id", e.id)
              .eq("status", "going");
            return { ...e, rsvp_count: count || 0 };
          })
        );
        setEvents(withCounts);
      }
      setLoading(false);
    })();
  }, [locationId]);

  const handleApprove = async (eventId: string) => {
    setActing(eventId);
    const { data } = await supabase.rpc("approve_venue_session", { p_event_id: eventId });
    const result = data as any;
    if (result?.success) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      toast.success("Session approved! Attendees have been notified.");
    } else {
      toast.error(result?.error || "Could not approve session.");
    }
    setActing(null);
  };

  const handleReject = async (eventId: string) => {
    setActing(eventId);
    const { data } = await supabase.rpc("reject_venue_session", {
      p_event_id: eventId,
      p_reason: rejectReason[eventId] || null,
    });
    const result = data as any;
    if (result?.success) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      toast.success("Session declined. Attendees have been notified.");
    } else {
      toast.error(result?.error || "Could not decline session.");
    }
    setActing(null);
  };

  if (loading || events.length === 0) return null;

  return (
    <section>
      <h2 className="font-serif text-lg text-foreground mb-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-orange-500" /> Pending Approvals
      </h2>
      <div className="space-y-3">
        {events.map((e) => (
          <Card key={e.id} className="border-orange-200 dark:border-orange-500/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                  Needs approval
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(e.date), "EEE, MMM d")}
                  {e.start_time && ` · ${e.start_time}`}
                  {e.end_time && ` – ${e.end_time}`}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {e.rsvp_count}{e.max_attendees ? ` / ${e.max_attendees}` : ""} people
                </span>
              </div>
              <Input
                value={rejectReason[e.id] || ""}
                onChange={(ev) => setRejectReason((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                placeholder="Reason if declining (optional)"
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-1"
                  size="sm"
                  onClick={() => handleApprove(e.id)}
                  disabled={acting === e.id}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  {acting === e.id ? "..." : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleReject(e.id)}
                  disabled={acting === e.id}
                >
                  <CalendarX className="w-3.5 h-3.5" />
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
