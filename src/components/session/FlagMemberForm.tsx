import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { checkFlagEscalation } from "@/lib/antifragile";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";

interface FlagMemberFormProps {
  eventId: string;
  attendees: Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
  onDone: () => void;
}

const REASONS = [
  { value: "uncomfortable", label: "Made me uncomfortable" },
  { value: "disruptive", label: "Was disruptive" },
  { value: "inappropriate", label: "Inappropriate behavior" },
  { value: "other", label: "Other" },
];

export function FlagMemberForm({ eventId, attendees, onDone }: FlagMemberFormProps) {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !selectedUser || !reason) return;
    setSubmitting(true);

    const { error } = await supabase.from("member_flags").insert({
      flagged_user: selectedUser,
      flagged_by: user.id,
      session_id: eventId,
      reason,
      notes: notes || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error(ERROR_STATES.generic);
    } else {
      toast.success(CONFIRMATIONS.flagSubmitted);
      checkFlagEscalation(selectedUser);
      onDone();
    }
  };

  const othersOnly = attendees.filter(a => a.id !== user?.id);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Report an issue</p>
        <p className="text-xs text-muted-foreground">This is completely private. The person won't know.</p>

        <div className="flex flex-wrap gap-2">
          {othersOnly.map(a => (
            <button key={a.id} onClick={() => setSelectedUser(a.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                selectedUser === a.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
              }`}>
              <Avatar className="w-6 h-6">
                <AvatarImage src={a.avatar_url || ""} />
                <AvatarFallback className="text-[9px]">{getInitials(a.display_name)}</AvatarFallback>
              </Avatar>
              {a.display_name?.split(" ")[0] || "Member"}
            </button>
          ))}
        </div>

        {selectedUser && (
          <div className="flex flex-wrap gap-2">
            {REASONS.map(r => (
              <button key={r.value} onClick={() => setReason(r.value)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                  reason === r.value ? "bg-destructive/10 border-destructive text-destructive" : "border-border hover:bg-muted"
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        )}

        {reason && (
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything else? (optional)"
            rows={2}
          />
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDone}>Never mind</Button>
          <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={!selectedUser || !reason || submitting}>
            {submitting ? "Submitting..." : "Report"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
