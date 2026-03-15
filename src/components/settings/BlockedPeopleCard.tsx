/**
 * @module BlockedPeopleCard
 * @description Settings card showing the list of people the user has blocked.
 * Available to all users. Shows avatar, name, and unblock action.
 * Blocked people never know they're blocked.
 *
 * Dependencies: memberBlocks.ts, useAuth
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ShieldBan, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getBlockedUsers, unblockUser, type BlockedUser } from "@/lib/memberBlocks";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

export function BlockedPeopleCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getBlockedUsers(user.id).then((result) => {
      setBlocked(result);
      setLoading(false);
    });
  }, [user]);

  if (loading) return null;

  const handleUnblock = async (blockedId: string, name: string | null) => {
    if (!user) return;
    const result = await unblockUser(user.id, blockedId);
    if (result.success) {
      setBlocked((prev) => prev.filter((b) => b.blocked_id !== blockedId));
      toast.success(`Unblocked ${name?.split(" ")[0] || "this person"}`);
    } else {
      toast.error(result.error || "Could not unblock.");
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldBan className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-serif text-base text-foreground">Blocked Members</h2>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Blocked members can still see sessions and your profile — but you'll get a private heads-up
          if they RSVP to a session you're attending. They don't know they're blocked.
        </p>

        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No one blocked. You can block someone from their profile menu.
          </p>
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <Avatar
                  className="w-8 h-8 cursor-pointer"
                  onClick={() => navigate(`/profile/${b.blocked_id}`)}
                >
                  <AvatarImage src={b.avatar_url || ""} />
                  <AvatarFallback className="text-[10px] bg-muted">
                    {getInitials(b.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm text-foreground truncate cursor-pointer hover:underline"
                    onClick={() => navigate(`/profile/${b.blocked_id}`)}
                  >
                    {b.display_name || "DanaDone Member"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-green-600"
                  onClick={() => handleUnblock(b.blocked_id, b.display_name)}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}

        {blocked.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {blocked.length}/25 blocks used
          </p>
        )}
      </CardContent>
    </Card>
  );
}
