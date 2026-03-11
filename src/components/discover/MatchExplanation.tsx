import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Sparkles, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  matchedUserId: string;
  sessionId?: string;
}

export function MatchExplanation({ matchedUserId, sessionId }: Props) {
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();
  const canSee = hasFeature("match_reasons");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canSee) return;
    setLoading(true);
    supabase
      .rpc("get_match_explanation", {
        p_matched_user_id: matchedUserId,
        ...(sessionId ? { p_session_id: sessionId } : {}),
      })
      .then(({ data }) => {
        // get_match_explanation returns Json; cast to access fields
        const result = data as unknown as { explanation?: string; icebreaker?: string; compatibility_score?: number } | null;
        if (result && result.explanation) {
          setExplanation(result.explanation);
          setIcebreaker(result.icebreaker || null);
          setScore(result.compatibility_score || null);
        }
        setLoading(false);
      });
  }, [matchedUserId, sessionId, canSee]);

  if (!canSee) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <Lock className="w-2.5 h-2.5 text-muted-foreground/60" />
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/pricing"); }}
          className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
        >
          See why you matched — upgrade to Plus
        </button>
      </div>
    );
  }

  if (loading) return <div className="h-4 w-24 bg-muted animate-pulse rounded mt-1" />;
  if (!explanation) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-start gap-1.5">
        <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-snug">{explanation}</p>
      </div>
      {score && (
        <span className="text-[9px] text-primary font-medium">{score}% compatible</span>
      )}
      {icebreaker && (
        <p className="text-[10px] text-muted-foreground/80 italic">
          💡 Try: "{icebreaker}"
        </p>
      )}
    </div>
  );
}
