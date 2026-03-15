import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { calculateSessionHours, addFocusHours } from "@/lib/ranks";
import { GivePropsFlow } from "@/components/session/GivePropsFlow";
import { VenueReviewCard } from "@/components/venue/VenueReviewCard";

export function FeedbackCard({ event, userId, onDismiss }: { event: any; userId: string; onDismiss: () => void }) {
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [showVenueReview, setShowVenueReview] = useState(false);
  const [venuePartnerInfo, setVenuePartnerInfo] = useState<{ id: string; venue_name: string } | null>(null);
  const [feedbackEventId, setFeedbackEventId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("events").select("venue_partner_id").eq("id", event.id).single()
      .then(({ data }: any) => {
        if (data?.venue_partner_id) {
          supabase.from("venue_partners").select("id, venue_name").eq("id", data.venue_partner_id).single()
            .then(({ data: vp }: any) => { if (vp) setVenuePartnerInfo(vp); });
        }
      });
  }, [event.id]);

  const EMOJIS = [
    { value: 1, emoji: "😞" }, { value: 2, emoji: "😐" }, { value: 3, emoji: "🙂" },
    { value: 4, emoji: "😊" }, { value: 5, emoji: "🤩" },
  ];

  const submitFeedback = async (rating: number, attended: boolean = true) => {
    try {
      const { error } = await supabase.from("event_feedback").insert({
        event_id: event.id, user_id: userId, rating: attended ? rating : null, comment: comment || null, attended,
      });
      if (error) throw error;
      if (attended) {
        const { data: prof } = await supabase.from("profiles").select("events_attended, referred_by").eq("id", userId).single();
        const newCount = (prof?.events_attended || 0) + 1;
        await supabase.from("profiles").update({ events_attended: newCount }).eq("id", userId);
        const hours = calculateSessionHours(event.start_time, event.end_time, event.title);
        await addFocusHours(userId, hours);
        // Wire referral milestones: award referrer FC on 1st and 3rd session
        if (prof?.referred_by && (newCount === 1 || newCount === 3)) {
          import("@/lib/referralEngine").then(({ checkReferralMilestones }) => {
            const milestone = newCount === 1 ? "first_session" : "third_session";
            checkReferralMilestones(prof.referred_by, userId, milestone).catch(console.error);
          });
        }
        setFeedbackEventId(event.id);
        setShowProps(true);
        setSubmitted(true);
      } else {
        const { data: prof } = await supabase.from("profiles").select("events_no_show").eq("id", userId).single();
        await supabase.from("profiles").update({ events_no_show: (prof?.events_no_show || 0) + 1 }).eq("id", userId);
        setSubmitted(true);
        toast.success(CONFIRMATIONS.rsvpCancelled);
        setTimeout(onDismiss, 1500);
      }
    } catch (error) {
      console.error("[EventFeedback]", error);
      toast.error(ERROR_STATES.generic);
    }
  };

  const handlePropsDone = () => {
    if (venuePartnerInfo) { setShowProps(false); setShowVenueReview(true); }
    else onDismiss();
  };

  if (showVenueReview && venuePartnerInfo) {
    return <VenueReviewCard venuePartnerId={venuePartnerInfo.id} venueName={venuePartnerInfo.venue_name} eventId={event.id} userId={userId} onDone={onDismiss} />;
  }
  if (showProps && feedbackEventId) return <GivePropsFlow eventId={feedbackEventId} onDone={handlePropsDone} />;
  if (submitted) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">How was your session at {event.title}?</p>
        <div className="flex justify-center gap-3">
          {EMOJIS.map((e) => (
            <button key={e.value} onClick={() => submitFeedback(e.value)} className="text-2xl hover:scale-125 transition-transform p-1">{e.emoji}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 200))} placeholder="Any feedback? (optional)" rows={2} className="flex-1" />
        </div>
        <button onClick={() => submitFeedback(0, false)} className="text-xs text-muted-foreground hover:underline">I wasn't there</button>
      </CardContent>
    </Card>
  );
}
