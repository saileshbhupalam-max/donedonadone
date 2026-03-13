/* DESIGN: Pre-session buddy introduction card.
   When groups have been assigned, members see their actual tablemates
   before the session day -- turning "who will I sit with?" into anticipation. */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

interface TableMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
}

interface YourTableCardProps {
  eventId: string;
  userId: string;
  eventDate: string;
}

export function YourTableCard({ eventId, userId, eventDate }: YourTableCardProps) {
  const [tablemates, setTablemates] = useState<TableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchTablemates() {
      // Find which group the user belongs to for this event
      const { data: myMembership } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(event_id)")
        .eq("user_id", userId)
        .eq("groups.event_id", eventId)
        .limit(1);

      if (!myMembership || myMembership.length === 0) {
        setLoading(false);
        return;
      }

      const groupId = myMembership[0].group_id;

      // Fetch other members in the same group
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, profiles:user_id(display_name, avatar_url, tagline)")
        .eq("group_id", groupId)
        .neq("user_id", userId);

      if (members && members.length > 0) {
        setTablemates(
          members.map((m: any) => ({
            user_id: m.user_id,
            display_name: m.profiles?.display_name || null,
            avatar_url: m.profiles?.avatar_url || null,
            tagline: m.profiles?.tagline || null,
          }))
        );
      }
      setLoading(false);
    }
    fetchTablemates();
  }, [eventId, userId]);

  if (loading || tablemates.length === 0) return null;

  const dayLabel = (() => {
    try {
      return format(parseISO(eventDate), "EEEE");
    } catch {
      return "session day";
    }
  })();

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <p className="font-serif text-sm text-foreground">Your Table</p>
        <p className="text-xs text-muted-foreground">
          You'll meet them on {dayLabel}
        </p>

        <div className="space-y-2">
          {tablemates.map((mate) => (
            <div
              key={mate.user_id}
              className="flex items-center gap-3 cursor-pointer hover:bg-primary/5 rounded-lg p-1.5 -mx-1.5 transition-colors"
              onClick={() => navigate(`/profile/${mate.user_id}`)}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={mate.avatar_url || ""} />
                <AvatarFallback className="text-xs bg-muted">
                  {getInitials(mate.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {mate.display_name || "Member"}
                </p>
                {mate.tagline && (
                  <p className="text-xs text-muted-foreground truncate">
                    {mate.tagline}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
