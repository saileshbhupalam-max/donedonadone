/* DESIGN: After each session, users choose who they'd cowork with again.
   Mutual selections create "Your Circle" — organic relationships that
   drive future grouping and create the real switching cost. */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { hapticSuccess } from "@/lib/haptics";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

interface CoworkAgainCardProps {
  eventId: string;
  userId: string;
  groupMembers: Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>;
}

export function CoworkAgainCard({ eventId, userId, groupMembers }: CoworkAgainCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const promises = Array.from(selected).map(preferredId =>
      supabase.from("cowork_preferences").insert({
        user_id: userId,
        preferred_user_id: preferredId,
        event_id: eventId,
      })
    );
    await Promise.all(promises);
    setSubmitted(true);
    hapticSuccess();
  };

  if (submitted) return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 text-center">
        <p className="text-sm text-foreground">✅ Noted! We'll try to group you together next time.</p>
      </CardContent>
    </Card>
  );

  const others = groupMembers.filter(m => m.user_id !== userId);
  if (others.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <p className="font-serif text-sm text-foreground">Who would you cowork with again?</p>
        <p className="text-xs text-muted-foreground">
          Tap the people you clicked with. Mutual picks get prioritized in future groups.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {others.map(m => (
            <motion.button
              key={m.user_id}
              onClick={() => toggleSelect(m.user_id)}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                selected.has(m.user_id) ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"
              }`}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={m.avatar_url || ""} />
                <AvatarFallback className="text-xs bg-muted">{getInitials(m.display_name)}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-foreground truncate w-full text-center">
                {m.display_name?.split(" ")[0] || "Member"}
              </span>
              {selected.has(m.user_id) && <Check className="w-3.5 h-3.5 text-primary" />}
            </motion.button>
          ))}
        </div>

        <Button size="sm" className="w-full" onClick={handleSubmit} disabled={selected.size === 0}>
          {selected.size === 0 ? "Select someone" : `Save (${selected.size} selected)`}
        </Button>
      </CardContent>
    </Card>
  );
}
