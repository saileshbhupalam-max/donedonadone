import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WhatsAppShareButton, LinkedInShareButton } from "./WhatsAppButton";
import { X } from "lucide-react";

interface PostEventShareProps {
  hours: number;
  peopleCount: number;
  venue: string | null;
  referralCode?: string | null;
  eventUrl: string;
}

export function PostEventShareCard({ hours, peopleCount, venue, referralCode, eventUrl }: PostEventShareProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteLink = `${appUrl}/invite/${referralCode || ""}`;

  const waMessage = `Just did a ${hours}-hour coworking session with ${peopleCount} amazing people${venue ? ` at ${venue}` : ""} through donedonadone! 🎯\nIf you work remotely or freelance in Bangalore, check it out: ${inviteLink}`;

  const linkedInText = `Just finished a focused coworking session${venue ? ` at ${venue}` : ""} with ${peopleCount} people through @donedonadone.\nIf you're a remote worker, freelancer, or founder in Bangalore — this community is amazing.\n#coworking #bangalore #remotework #focusclub`;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-serif text-sm text-foreground">Share your experience ✨</p>
            <p className="text-xs text-muted-foreground mt-0.5">You just completed a great session! Tell your network.</p>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <WhatsAppShareButton message={waMessage} label="WhatsApp" size="sm" fullWidth />
          <LinkedInShareButton url={eventUrl} text={linkedInText} label="LinkedIn" size="sm" className="flex-1" />
        </div>
        <button onClick={() => setDismissed(true)} className="text-xs text-muted-foreground hover:underline w-full text-center">
          Maybe later
        </button>
      </CardContent>
    </Card>
  );
}
