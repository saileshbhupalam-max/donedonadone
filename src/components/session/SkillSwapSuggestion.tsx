import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface Props {
  matches: Array<{
    profile: Profile;
    matchingSkills: string[];
  }>;
}

export function SkillSwapSuggestion({ matches }: Props) {
  const navigate = useNavigate();
  if (matches.length === 0) return null;

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium text-secondary">💡 Skill Swap!</p>
        {matches.map(m => (
          <div
            key={m.profile.id}
            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1"
            onClick={() => navigate(`/profile/${m.profile.id}`)}
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={m.profile.avatar_url || ""} />
              <AvatarFallback className="text-[9px]">{getInitials(m.profile.display_name)}</AvatarFallback>
            </Avatar>
            <span className="text-foreground">{m.profile.display_name?.split(" ")[0]}</span>
            <span className="text-muted-foreground text-xs">offers {m.matchingSkills.join(", ")}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
