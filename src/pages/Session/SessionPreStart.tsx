import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, ExternalLink } from "lucide-react";
import { CheckInButton } from "@/components/session/CheckInButton";
import { PHASE_EMOJIS } from "./constants";
import { Phase } from "./types";

interface SessionPreStartProps {
  event: any;
  phases: Phase[];
  checkedIn: boolean;
  eventId: string;
  userId: string;
  onCheckedIn: () => void;
  onStartSession: () => void;
}

export function SessionPreStart({ event, phases, checkedIn, eventId, userId, onCheckedIn, onStartSession }: SessionPreStartProps) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-6 text-center space-y-4">
        <p className="font-serif text-lg text-foreground">Ready to start?</p>
        <div className="space-y-2">
          {phases.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm">
              <span className="text-lg">{PHASE_EMOJIS[p.phase_type] || "\u{1F4CB}"}</span>
              <span className="flex-1 text-left text-foreground">{p.phase_label}</span>
              <span className="text-muted-foreground">{p.duration_minutes}min</span>
            </div>
          ))}
        </div>
        {event.vibe_soundtrack && (
          <a href={event.vibe_soundtrack} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Music className="w-3 h-3" /> Session Playlist <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {!checkedIn ? (
          <CheckInButton
            eventId={eventId}
            userId={userId}
            onCheckedIn={onCheckedIn}
            hasVenueCoords={!!event?.venue_latitude}
          />
        ) : (
          <Button className="w-full" onClick={onStartSession}>Start Session</Button>
        )}
      </CardContent>
    </Card>
  );
}
