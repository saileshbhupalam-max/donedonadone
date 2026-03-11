import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppShareButton } from "./WhatsAppButton";
import { X } from "lucide-react";

interface RsvpSharePromptProps {
  eventTitle: string;
  eventDate: string;
  venueName: string | null;
  eventId: string;
  referralCode?: string | null;
}

export function RsvpSharePrompt({ eventTitle, eventDate, venueName, eventId, referralCode }: RsvpSharePromptProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${appUrl}/events/${eventId}${referralCode ? `?ref=${referralCode}` : ""}`;
  const msg = `Hey! I'm going to ${eventTitle} on ${eventDate} at ${venueName || "TBD"}. Come join? ${link}`;

  return (
    <Card className="border-secondary/30 bg-secondary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <p className="text-sm text-foreground">You're going! 🎉 Bring a friend?</p>
          <button onClick={() => setDismissed(true)} className="p-0.5 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <WhatsAppShareButton message={msg} label="Share with a friend" size="sm" fullWidth />
      </CardContent>
    </Card>
  );
}
