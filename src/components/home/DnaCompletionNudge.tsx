import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dna } from "lucide-react";
import { calculateDnaCompletion, TasteGraphRow } from "@/lib/dnaCompletion";
import { PostSessionDnaPrompt } from "@/components/session/PostSessionDnaPrompt";

interface Props {
  userId: string;
}

export function DnaCompletionNudge({ userId }: Props) {
  const navigate = useNavigate();
  const [completion, setCompletion] = useState<number | null>(null);
  const [showInline, setShowInline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("taste_graph")
        .select("role_type, skills, work_looking_for, work_can_offer, topics, industries, values, peak_hours")
        .eq("user_id", userId)
        .maybeSingle();
      setCompletion(calculateDnaCompletion(data as TasteGraphRow | null));
    })();
  }, [userId]);

  // Don't render if loading, >= 50%, or dismissed
  if (completion === null || completion >= 50 || dismissed) return null;

  if (showInline) {
    return (
      <PostSessionDnaPrompt
        userId={userId}
        onComplete={() => {
          setShowInline(false);
          // Re-fetch completion
          (async () => {
            const { data } = await supabase
              .from("taste_graph")
              .select("role_type, skills, work_looking_for, work_can_offer, topics, industries, values, peak_hours")
              .eq("user_id", userId)
              .maybeSingle();
            const pct = calculateDnaCompletion(data as TasteGraphRow | null);
            setCompletion(pct);
            if (pct >= 50) setDismissed(true);
          })();
        }}
        onSkip={() => setShowInline(false)}
      />
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Your Work DNA is {completion}% complete</p>
        </div>
        <Progress value={completion} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          Complete your DNA for better group matches and session recommendations.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowInline(true)}>
            Answer 1 question now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/me/dna")}>
            Complete your DNA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
