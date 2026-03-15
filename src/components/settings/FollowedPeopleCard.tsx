/**
 * @module FollowedPeopleCard
 * @description Settings card showing the list of people the user follows.
 * Max-tier only. Shows avatar, name, and unfollow action.
 *
 * Dependencies: memberFollows.ts, useSubscription, useAuth
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Crown, UserMinus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { getFollowedUsers, unfollowUser, type FollowedUser } from "@/lib/memberFollows";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

export function FollowedPeopleCard() {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [followed, setFollowed] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const isMaxTier = tier === "max";

  useEffect(() => {
    if (!user || !isMaxTier) {
      setLoading(false);
      return;
    }
    getFollowedUsers(user.id).then((result) => {
      setFollowed(result);
      setLoading(false);
    });
  }, [user, isMaxTier]);

  // Don't render for non-Max users
  if (!isMaxTier) return null;
  if (loading) return null;

  const handleUnfollow = async (followedId: string, name: string | null) => {
    if (!user) return;
    const result = await unfollowUser(user.id, followedId);
    if (result.success) {
      setFollowed((prev) => prev.filter((f) => f.followed_id !== followedId));
      toast.success(`Unfollowed ${name?.split(" ")[0] || "this person"}`);
    } else {
      toast.error(result.error || "Could not unfollow.");
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <h2 className="font-serif text-base text-foreground">People You Follow</h2>
          <Badge variant="outline" className="text-[9px] gap-1 px-1.5">
            <Crown className="w-2.5 h-2.5 text-amber-500" /> Max
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">
          You'll be notified when these people RSVP to sessions. They don't know you follow them.
        </p>

        {followed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            You're not following anyone yet. Visit someone's profile to follow them.
          </p>
        ) : (
          <div className="space-y-2">
            {followed.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <Avatar
                  className="w-8 h-8 cursor-pointer"
                  onClick={() => navigate(`/profile/${f.followed_id}`)}
                >
                  <AvatarImage src={f.avatar_url || ""} />
                  <AvatarFallback className="text-[10px] bg-muted">
                    {getInitials(f.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm text-foreground truncate cursor-pointer hover:underline"
                    onClick={() => navigate(`/profile/${f.followed_id}`)}
                  >
                    {f.display_name || "DanaDone Member"}
                  </p>
                  {f.tagline && (
                    <p className="text-[10px] text-muted-foreground truncate">{f.tagline}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleUnfollow(f.followed_id, f.display_name)}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          {followed.length}/20 follows used
        </p>
      </CardContent>
    </Card>
  );
}
