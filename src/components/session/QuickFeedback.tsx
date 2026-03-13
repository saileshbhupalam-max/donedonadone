import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface QuickFeedbackProps {
  eventId: string;
  onDetailedFeedback: () => void;
}

const RATING_EMOJIS = [
  { value: 1, emoji: "\u{1F614}", label: "Meh" },
  { value: 2, emoji: "\u{1F610}", label: "Okay" },
  { value: 3, emoji: "\u{1F642}", label: "Good" },
  { value: 4, emoji: "\u{1F60A}", label: "Great" },
  { value: 5, emoji: "\u{1F929}", label: "Amazing" },
];

export function QuickFeedback({ eventId, onDetailedFeedback }: QuickFeedbackProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || selected === null) return;
    setSubmitting(true);
    try {
      await supabase.from("event_feedback").upsert({
        event_id: eventId,
        user_id: user.id,
        rating: selected,
        feedback_type: "quick",
      }, { onConflict: "event_id,user_id" });
      setSubmitted(true);
      toast.success("Thanks for the feedback!");
    } catch {
      toast.error("Couldn't save feedback. Try again?");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-2xl">{"\u{2728}"}</p>
          <p className="font-serif text-lg text-foreground">You're all set</p>
          <p className="text-sm text-muted-foreground">Your feedback shapes future sessions.</p>
          <Button onClick={() => navigate("/events")} className="w-full">
            Back to Sessions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <div className="text-center space-y-1">
          <p className="font-serif text-base text-foreground">How was your session?</p>
          <p className="text-xs text-muted-foreground">Quick rate — tap and go</p>
        </div>

        <div className="flex justify-center gap-3">
          {RATING_EMOJIS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                selected === r.value
                  ? "bg-primary/10 scale-110 ring-2 ring-primary/30"
                  : "hover:bg-muted"
              }`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className="text-[10px] text-muted-foreground">{r.label}</span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={selected === null || submitting}
          className="w-full"
          size="sm"
        >
          {submitting ? "Saving..." : "Done"}
        </Button>

        <button
          onClick={onDetailedFeedback}
          className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Give detailed feedback instead
        </button>
      </CardContent>
    </Card>
  );
}
