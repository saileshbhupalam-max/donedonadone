import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { trackConversion } from "@/lib/trackConversion";

interface MentorRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    canHelpWith: string[];
    domains: string[];
  };
}

export function MentorRequestDialog({ open, onOpenChange, mentor }: MentorRequestDialogProps) {
  const { user } = useAuth();
  const { getLimit } = useSubscription();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  const weeklyLimit = getLimit("connections_per_week");

  useEffect(() => {
    if (!user || !open) return;
    if (weeklyLimit === -1) { setAtLimit(false); return; }
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("from_user", user.id)
      .gte("created_at", oneWeekAgo)
      .then(({ count }) => {
        const c = count || 0;
        setWeeklyCount(c);
        const isAtLimit = weeklyLimit > 0 && c >= weeklyLimit;
        setAtLimit(isAtLimit);
        if (isAtLimit) trackConversion("hit_limit", { limit: "connections_per_week" });
      });
  }, [user, open, weeklyLimit]);

  const handleSend = async () => {
    if (!user) return;
    setSending(true);

    // Prefix the message to indicate mentorship request type
    const mentorshipMessage = `[mentorship-request] ${message.trim() || "I'd love to connect for mentoring."}`;

    const { error } = await supabase.from("connection_requests").insert({
      from_user: user.id,
      to_user: mentor.id,
      message: mentorshipMessage,
    });

    setSending(false);

    if (error) {
      if (error.code === "23505") {
        toast.info("You've already sent a request to this person");
      } else {
        toast.error("Couldn't send request. Try again.");
        console.error("[MentorRequestDialog]", error);
      }
    } else {
      toast.success("Mentoring request sent!");
      setMessage("");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Request Mentoring
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar className="w-16 h-16">
            <AvatarImage src={mentor.avatarUrl || ""} />
            <AvatarFallback>{getInitials(mentor.displayName)}</AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium text-foreground">{mentor.displayName}</p>

          {mentor.canHelpWith.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {mentor.canHelpWith.slice(0, 4).map((item) => (
                <Badge key={item} variant="secondary" className="text-[10px] px-2 py-0.5">
                  {item}
                </Badge>
              ))}
            </div>
          )}

          {mentor.domains.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center">
              {mentor.domains.slice(0, 3).map((domain) => (
                <Badge key={domain} variant="outline" className="text-[9px] px-1.5 py-0">
                  {domain}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            What would you like help with?
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 300))}
            placeholder="I'm looking for guidance on..."
            className="resize-none"
            rows={3}
          />
          <p className="text-[10px] text-muted-foreground text-right">{message.length}/300</p>
        </div>

        {atLimit ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-foreground">
              You've used all {weeklyLimit} connection requests this week.
            </p>
            <p className="text-xs text-muted-foreground">Upgrade to Plus for unlimited connections.</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => { onOpenChange(false); navigate("/pricing"); }}>
                See Plans
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                OK
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button onClick={handleSend} disabled={sending} className="w-full">
              <GraduationCap className="w-4 h-4 mr-1.5" />
              {sending ? "Sending..." : "Send Mentoring Request"}
            </Button>
            {weeklyLimit > 0 && weeklyCount !== null && (
              <p className="text-[10px] text-muted-foreground text-center">
                {weeklyLimit - weeklyCount} of {weeklyLimit} connections remaining this week
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
