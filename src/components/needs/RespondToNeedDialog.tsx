import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { parseNeedMeta, isOffer, NEED_CATEGORIES, BUDGET_OPTIONS, DURATION_OPTIONS } from "@/lib/needsMatch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Briefcase, HandHelping, Clock, DollarSign, Tag } from "lucide-react";
import { toast } from "sonner";

interface NeedItem {
  id: string;
  title: string;
  description: string | null;
  request_type: string;
  user_id: string;
  status: string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

interface RespondToNeedDialogProps {
  need: NeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResponded?: () => void;
}

export function RespondToNeedDialog({ need, open, onOpenChange, onResponded }: RespondToNeedDialogProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!need) return null;

  const { text, meta } = parseNeedMeta(need.description);
  const needIsOffer = isOffer(need.title, need.description);
  const category = NEED_CATEGORIES[need.request_type] || NEED_CATEGORIES.other;
  const budgetLabel = BUDGET_OPTIONS.find(b => b.value === meta.budget)?.label;
  const durationLabel = DURATION_OPTIONS.find(d => d.value === meta.duration)?.label;

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    const { data: updated, error } = await supabase
      .from("micro_requests")
      .update({ claimed_by: user.id, status: "claimed" })
      .eq("id", need.id)
      .eq("status", "open")
      .select();

    if (error) {
      toast.error("Failed to respond. Please try again.");
      setSubmitting(false);
      return;
    }

    if (!updated || updated.length === 0) {
      toast.error("This has already been claimed by someone else.");
      setSubmitting(false);
      onOpenChange(false);
      onResponded?.();
      return;
    }

    // If we had a notifications system, we'd send a notification here with the message
    // For now, just show success
    toast.success(
      needIsOffer
        ? "You expressed interest! The poster will be notified."
        : "You offered to help! The poster will be notified."
    );
    setMessage("");
    setSubmitting(false);
    onOpenChange(false);
    onResponded?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            {needIsOffer ? "Express Interest" : "Offer to Help"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {needIsOffer
              ? "Let them know you're interested in their offer."
              : "Let them know how you can help."}
          </DialogDescription>
        </DialogHeader>

        {/* Need details card */}
        <div className="rounded-lg border border-border/50 p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={needIsOffer
                ? "text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400"
              }
            >
              {needIsOffer ? (
                <><HandHelping className="w-3 h-3 mr-0.5" /> Offer</>
              ) : (
                <><Briefcase className="w-3 h-3 mr-0.5" /> Need</>
              )}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{category.label}</Badge>
          </div>
          <p className="text-sm font-medium">{need.title}</p>
          {text && <p className="text-xs text-muted-foreground">{text}</p>}

          <div className="flex flex-wrap gap-2">
            {budgetLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <DollarSign className="w-3 h-3" /> {budgetLabel}
              </span>
            )}
            {durationLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" /> {durationLabel}
              </span>
            )}
          </div>

          {meta.skills && meta.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {meta.skills.map(skill => (
                <Badge key={skill} variant="secondary" className="text-[10px]">
                  <Tag className="w-2.5 h-2.5 mr-0.5" />
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {need.profiles?.display_name && (
            <p className="text-[10px] text-muted-foreground">
              Posted by {need.profiles.display_name}
            </p>
          )}
        </div>

        {/* Message field */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Your message (optional)</Label>
          <Textarea
            placeholder={needIsOffer
              ? "Tell them why you're interested..."
              : "Describe how you can help..."
            }
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, 300))}
            maxLength={300}
            className="text-sm min-h-[60px]"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {needIsOffer ? "I'm Interested" : "I Can Help"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
