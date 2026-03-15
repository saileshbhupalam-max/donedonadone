/**
 * @module SmartIntroCard
 * @description Renders AI-powered smart intro suggestions during session break phases.
 * Shows top 2 group member matches with contextual intro lines and conversation starters.
 *
 * Dependencies: smartIntros (generateSmartIntros), matchUtils (via smartIntros), shadcn/ui, lucide-react
 * Related: Session/index.tsx (parent), smartIntros.ts (data generation)
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, Check } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { generateSmartIntros, SmartIntro } from "@/lib/smartIntros";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface SmartIntroCardProps {
  currentUser: Profile;
  groupMembers: Profile[];
}

function IntroEntry({ intro }: { intro: SmartIntro }) {
  const [connected, setConnected] = useState(false);

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/50 bg-card/80 p-3">
      {/* Header: avatar + name + score */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarImage src={intro.memberAvatar ?? ""} alt={intro.memberName} />
          <AvatarFallback className="text-xs font-medium">
            {getInitials(intro.memberName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">
              {intro.memberName.split(" ")[0]}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 font-semibold shrink-0"
            >
              {intro.matchScore}% match
            </Badge>
          </div>
        </div>
      </div>

      {/* Intro line */}
      <p className="text-sm text-foreground/80 leading-snug">
        {intro.introLine}
      </p>

      {/* Conversation starter */}
      <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
        <MessageCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          {intro.conversationStarter}
        </p>
      </div>

      {/* Connected button */}
      <Button
        variant={connected ? "default" : "outline"}
        size="sm"
        className="w-full text-xs h-7"
        onClick={() => setConnected(!connected)}
      >
        {connected ? (
          <>
            <Check className="h-3 w-3 mr-1" />
            Connected!
          </>
        ) : (
          "We talked"
        )}
      </Button>
    </div>
  );
}

export function SmartIntroCard({ currentUser, groupMembers, eventId }: SmartIntroCardProps & { eventId?: string }) {
  const intros = useMemo(
    () => {
      // Guard: if called with only eventId (from EventDetail), skip until proper props are passed
      if (!currentUser || !groupMembers || groupMembers.length === 0) return [];
      return generateSmartIntros(currentUser, groupMembers);
    },
    [currentUser, groupMembers],
  );

  if (intros.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Who to talk to right now
          </h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Based on your profile, these members are your best matches
        </p>

        {/* Intro entries */}
        <div className="space-y-3">
          {intros.map((intro) => (
            <IntroEntry key={intro.memberId} intro={intro} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
