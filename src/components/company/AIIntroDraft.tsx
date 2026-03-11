import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIIntroDraftProps {
  fromCompanyId: string;
  toCompanyId: string;
  onDraft: (text: string) => void;
}

export function AIIntroDraft({ fromCompanyId, toCompanyId, onDraft }: AIIntroDraftProps) {
  const { hasFeature } = useSubscription();
  const canDraft = hasFeature("ai_intro_drafts");
  const [loading, setLoading] = useState(false);

  if (!canDraft) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Lock className="w-2.5 h-2.5" /> Max feature
      </span>
    );
  }

  const handleDraft = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-intro", {
        body: { from_company_id: fromCompanyId, to_company_id: toCompanyId },
      });
      if (error) throw error;
      if (data?.draft) {
        onDraft(data.draft);
        toast.success("Draft generated!");
      } else {
        toast.error("Couldn't generate draft");
      }
    } catch {
      toast.error("AI draft failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-xs gap-1.5 text-primary"
      onClick={handleDraft}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      Draft with AI
    </Button>
  );
}
