import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface VenueReviewCardProps {
  venuePartnerId: string;
  venueName: string;
  eventId: string;
  userId: string;
  onDone: () => void;
}

export function VenueReviewCard({ venuePartnerId, venueName, eventId, userId, onDone }: VenueReviewCardProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (rating === 0) return;
    try {
      const { error } = await supabase.from("venue_reviews").insert({
        venue_partner_id: venuePartnerId,
        user_id: userId,
        event_id: eventId,
        rating,
        comment: comment || null,
      });
      if (error) throw error;
      toast.success(CONFIRMATIONS.venueReviewed);
      setSubmitted(true);
      setTimeout(onDone, 1000);
    } catch (e: any) {
      if (e.code === "23505") {
        toast.info("You already reviewed this venue");
        onDone();
      } else {
        console.error(e);
        toast.error(ERROR_STATES.generic);
      }
    }
  };

  if (submitted) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">How was {venueName}? 📍</p>
        <div className="flex gap-1 justify-center">
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} onMouseEnter={() => setHover(v)} onMouseLeave={() => setHover(0)} onClick={() => setRating(v)}>
              <Star className={cn("w-8 h-8 transition-colors", (hover || rating) >= v ? "fill-primary text-primary" : "text-muted-foreground/30")} />
            </button>
          ))}
        </div>
        <Input value={comment} onChange={e => setComment(e.target.value.slice(0, 200))} placeholder="Quick comment (optional)" />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={submit} disabled={rating === 0}>Rate it</Button>
          <Button size="sm" variant="ghost" onClick={onDone}>Skip</Button>
        </div>
      </CardContent>
    </Card>
  );
}
