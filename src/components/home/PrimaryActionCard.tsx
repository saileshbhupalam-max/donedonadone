/* DESIGN: Home answers "What should I do right now?" instantly.
   One card, priority-based: active session > feedback > today > upcoming > find session */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddToCalendarButton } from "@/components/session/AddToCalendarButton";
import { Timer, ArrowRight, CalendarIcon, MapPin } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface NextMeetup {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time?: string | null;
  venue_name: string | null;
  goingCount: number;
}

interface PendingFeedback {
  id: string;
  title: string;
  date: string;
}

interface Props {
  nextMeetup: NextMeetup | null;
  pendingFeedback: PendingFeedback[];
  upcomingEvent: { id: string; title: string; goingCount: number } | null;
  onFeedbackClick?: (eventId: string) => void;
}

function getActionType(nextMeetup: NextMeetup | null, pendingFeedback: PendingFeedback[]): string {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Check for pending feedback first
  if (pendingFeedback.length > 0) return "feedback";

  if (!nextMeetup) return "find-session";

  const isToday = nextMeetup.date === today;

  if (isToday && nextMeetup.start_time) {
    // Parse start time and check if session is happening now
    const [hours, mins] = nextMeetup.start_time.match(/(\d+)/g)?.map(Number) || [0, 0];
    const sessionStart = new Date(now);
    sessionStart.setHours(hours, mins || 0, 0);
    const diffMin = differenceInMinutes(sessionStart, now);

    if (diffMin <= 0 && diffMin > -240) return "active-session";
    if (diffMin > 0 && diffMin <= 180) return "today";
  }

  if (isToday) return "today";
  return "upcoming";
}

export function PrimaryActionCard({ nextMeetup, pendingFeedback, upcomingEvent, onFeedbackClick }: Props) {
  const navigate = useNavigate();
  const actionType = getActionType(nextMeetup, pendingFeedback);

  if (actionType === "feedback" && pendingFeedback[0]) {
    // Feedback is handled inline on Home — skip rendering here
    return null;
  }

  if (actionType === "active-session" && nextMeetup) {
    return (
      <motion.div whileTap={{ scale: 0.98 }}>
        {/* WCAG 2.1 SC 2.1.1 — interactive content must be keyboard-operable */}
        <Card className="border-primary/30 bg-primary/5 cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/session/${nextMeetup.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/session/${nextMeetup.id}`); } }}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-xs font-medium text-primary">Session is live!</p>
            </div>
            <p className="font-serif text-lg text-foreground">{nextMeetup.title}</p>
            {nextMeetup.venue_name && <p className="text-xs text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{nextMeetup.venue_name}</p>}
            <Button size="sm" className="w-full gap-2">
              <Timer className="w-4 h-4" /> Check in →
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (actionType === "today" && nextMeetup) {
    return (
      <Card className="border-primary/20 cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/events/${nextMeetup.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${nextMeetup.id}`); } }}>
        <CardContent className="p-4 space-y-2">
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">Today!</Badge>
          <p className="font-serif text-lg text-foreground">{nextMeetup.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {nextMeetup.start_time && <span>🕐 {nextMeetup.start_time}</span>}
            {nextMeetup.venue_name && <span>📍 {nextMeetup.venue_name}</span>}
          </div>
          <AddToCalendarButton
            event={{
              title: nextMeetup.title,
              date: nextMeetup.date,
              startTime: nextMeetup.start_time,
              endTime: nextMeetup.end_time || null,
              venueName: nextMeetup.venue_name,
              venueAddress: null,
            }}
            size="sm"
            variant="outline"
          />
        </CardContent>
      </Card>
    );
  }

  if (actionType === "upcoming" && nextMeetup) {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" role="button" tabIndex={0} onClick={() => navigate(`/events/${nextMeetup.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${nextMeetup.id}`); } }}>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your next session</p>
          <p className="font-serif text-base text-foreground">{nextMeetup.title}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><CalendarIcon className="w-3 h-3 inline mr-1" />{format(parseISO(nextMeetup.date), "EEE, MMM d")}{nextMeetup.start_time ? ` · ${nextMeetup.start_time}` : ""}</span>
            {nextMeetup.venue_name && <span><MapPin className="w-3 h-3 inline mr-1" />{nextMeetup.venue_name}</span>}
          </div>
          {nextMeetup.goingCount > 0 && <p className="text-xs text-muted-foreground">{nextMeetup.goingCount} other{nextMeetup.goingCount !== 1 ? "s" : ""} going</p>}
          <AddToCalendarButton
            event={{
              title: nextMeetup.title,
              date: nextMeetup.date,
              startTime: nextMeetup.start_time,
              endTime: nextMeetup.end_time || null,
              venueName: nextMeetup.venue_name,
              venueAddress: null,
            }}
            size="sm"
            variant="outline"
          />
        </CardContent>
      </Card>
    );
  }

  // find-session
  if (upcomingEvent) {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" role="button" tabIndex={0} onClick={() => navigate(`/events/${upcomingEvent.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${upcomingEvent.id}`); } }}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Don't miss out</p>
            <p className="font-serif text-base text-foreground">{upcomingEvent.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{upcomingEvent.goingCount} going</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" role="button" tabIndex={0} onClick={() => navigate("/events")} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate("/events"); } }}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">You haven't booked yet this week</p>
          <p className="font-serif text-base text-foreground">Find your table →</p>
        </div>
        <CalendarIcon className="w-5 h-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
