import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, MapPin, Hand, AlertTriangle, Map } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { VenueVibeSummary } from "@/components/session/VenueVibeRating";
import { VenueQuickBadges } from "@/components/venue/VenueQuickBadges";
import type { VenueBadge } from "@/hooks/useVenueBadgesBatch";
import { Event as EventType } from "@/hooks/useEvents";
import { getNeighborhoodLabel, getTimingLabel, isWithin48Hours } from "./constants";

export interface EventCardProps {
  event: EventType;
  onRsvp: (id: string, status: "going") => void;
  userRsvp: { status: string } | null;
  isPast: boolean;
  allUpcoming: EventType[];
  minThreshold: number;
  isRestricted?: boolean;
  circleUserIds?: string[];
  /** Pre-fetched venue badges from batch hook — avoids per-card query */
  preloadedBadges?: VenueBadge[];
}

export function EventCard({ event, onRsvp, userRsvp, isPast, allUpcoming, minThreshold, isRestricted, circleUserIds, preloadedBadges }: EventCardProps) {
  const navigate = useNavigate();
  const goingCount = event.rsvps?.filter((r) => r.status === "going").length || 0;
  const goingAvatars = event.rsvps?.filter((r) => r.status === "going").slice(0, 5) || [];
  const timingLabel = !isPast ? getTimingLabel(event.date) : null;
  const isLowAttendance = !isPast && isWithin48Hours(event.date) && goingCount < minThreshold;

  // Circle members going to this event
  const circleGoing = circleUserIds && circleUserIds.length > 0
    ? (event.rsvps || []).filter(r => r.status === "going" && circleUserIds.includes(r.user_id))
    : [];

  const nearbySessions = isLowAttendance ? allUpcoming.filter((e) =>
    e.id !== event.id &&
    (e.neighborhood === event.neighborhood || !event.neighborhood) &&
    (e.rsvps?.filter((r) => r.status === "going").length || 0) > goingCount
  ).slice(0, 3) : [];

  return (
    <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", isLowAttendance && "border-destructive/30")}
      onClick={() => navigate(`/events/${event.id}`)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-lg text-foreground">{event.title}</h3>
              {event.women_only && <Badge className="bg-secondary/20 text-secondary border-0 text-xs">Women Only</Badge>}
              {event.session_format?.startsWith("focus_only") && <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-0 text-xs">Focus Only</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>
                {format(parseISO(event.date), "EEE, MMM d")}
                {event.start_time && ` · ${event.start_time}`}
                {event.end_time && ` - ${event.end_time}`}
              </span>
            </div>
            {event.venue_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{event.venue_name}{event.neighborhood ? ` · ${getNeighborhoodLabel(event.neighborhood)}` : ""}</span>
              </div>
            )}
            {event.venue_name && <VenueQuickBadges venueName={event.venue_name} preloadedBadges={preloadedBadges} />}
          </div>
          {timingLabel && (
            <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary">{timingLabel}</Badge>
          )}
        </div>

        {event.description && <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>}

        {/* Venue vibe summary */}
        {event.venue_name && <VenueVibeSummary venueName={event.venue_name} />}

        {event.max_spots && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{goingCount} of {event.max_spots} spots</span>
              {goingCount >= event.max_spots && <span className="text-destructive font-medium">Full</span>}
            </div>
            <Progress value={(goingCount / event.max_spots) * 100} className="h-1.5" />
          </div>
        )}

        {isLowAttendance && (
          <div className="bg-destructive/10 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>This session needs more people — invite a friend or check nearby sessions</span>
            </div>
            {nearbySessions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {nearbySessions.map((ns) => (
                  <button key={ns.id} onClick={() => navigate(`/events/${ns.id}`)}
                    className="text-[11px] bg-background border border-border rounded-full px-2.5 py-1 hover:bg-muted transition-colors">
                    {ns.title} · {ns.rsvps?.filter((r) => r.status === "going").length || 0} going
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {goingAvatars.length > 0 && (
              <div className="flex -space-x-2">
                {goingAvatars.map((r) => (
                  <Avatar key={r.id} className="w-7 h-7 border-2 border-background">
                    <AvatarImage src={r.profile?.avatar_url || ""} />
                    <AvatarFallback className="text-[10px] bg-muted">{getInitials(r.profile?.display_name)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
            <span className="text-xs text-muted-foreground">{goingCount} going</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/map?event=${event.id}`); }}
            className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
            <Map className="w-3 h-3" /> Map
          </button>
        </div>

        {/* DESIGN: Social proof — circle members going creates warm FOMO */}
        {circleGoing.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-primary">
            <div className="flex -space-x-1">
              {circleGoing.slice(0, 3).map(r => (
                <Avatar key={r.id} className="w-5 h-5 border border-background">
                  <AvatarImage src={r.profile?.avatar_url || ""} />
                  <AvatarFallback className="text-[8px] bg-primary/10">{getInitials(r.profile?.display_name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span>
              {circleGoing[0]?.profile?.display_name?.split(" ")[0]}
              {circleGoing.length > 1 ? ` + ${circleGoing.length - 1} from your circle` : " from your circle"} going
            </span>
          </div>
        )}

        {!isPast && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {userRsvp?.status === "going" ? (
              <Button size="sm" variant="default" className="flex-1 bg-primary"
                onClick={() => onRsvp(event.id, "going")}>
                <Hand className="w-3.5 h-3.5" /> Going ✓
              </Button>
            ) : event.max_spots && goingCount >= event.max_spots ? (
              <Button size="sm" variant="outline" className="flex-1"
                onClick={() => onRsvp(event.id, "going")}
                disabled={isRestricted}>
                Join Waitlist
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1"
                onClick={() => onRsvp(event.id, "going")}
                disabled={isRestricted}>
                <Hand className="w-3.5 h-3.5" /> RSVP
              </Button>
            )}
          </div>
        )}

        {isPast && <Badge variant="outline" className="text-xs text-muted-foreground">Session complete</Badge>}
      </CardContent>
    </Card>
  );
}
