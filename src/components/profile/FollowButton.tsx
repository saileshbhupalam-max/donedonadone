/**
 * @module FollowButton
 * @description VIP follow button for profile pages. Only visible to Max-tier members.
 * Following is private — the followed person never knows.
 *
 * Dependencies: memberFollows.ts, useSubscription, useAuth
 * Tables: member_follows (via lib)
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { followUser, unfollowUser, isFollowing } from "@/lib/memberFollows";
import { toast } from "sonner";

interface FollowButtonProps {
  currentUserId: string;
  targetUserId: string;
}

export function FollowButton({ currentUserId, targetUserId }: FollowButtonProps) {
  const { tier } = useSubscription();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const isMaxTier = tier === "max";

  useEffect(() => {
    if (!isMaxTier) {
      setLoading(false);
      return;
    }
    isFollowing(currentUserId, targetUserId).then((result) => {
      setFollowing(result);
      setLoading(false);
    });
  }, [currentUserId, targetUserId, isMaxTier]);

  // Don't render anything for non-Max users (they shouldn't know this feature exists)
  if (!isMaxTier) return null;
  if (loading) return null;

  const handleToggle = async () => {
    setActing(true);
    if (following) {
      const result = await unfollowUser(currentUserId, targetUserId);
      if (result.success) {
        setFollowing(false);
        toast.success("Unfollowed. You won't get RSVP alerts for this person.");
      } else {
        toast.error(result.error || "Could not unfollow.");
      }
    } else {
      const result = await followUser(currentUserId, targetUserId);
      if (result.success) {
        setFollowing(true);
        toast.success("Following! You'll be notified when they RSVP to sessions.");
      } else {
        toast.error(result.error || "Could not follow.");
      }
    }
    setActing(false);
  };

  return (
    <Button
      variant={following ? "secondary" : "outline"}
      size="sm"
      className="gap-1.5 text-xs"
      onClick={handleToggle}
      disabled={acting}
    >
      {following ? (
        <>
          <EyeOff className="w-3.5 h-3.5" />
          Following
        </>
      ) : (
        <>
          <Eye className="w-3.5 h-3.5" />
          <Crown className="w-3 h-3 text-amber-500" />
          Follow
        </>
      )}
    </Button>
  );
}
