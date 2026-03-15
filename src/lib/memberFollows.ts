/**
 * @module memberFollows
 * @description VIP Attendance Alerts — Max-tier members can follow people and
 * get notified when they RSVP to sessions. Following is completely private:
 * the followed person never knows who follows them.
 *
 * Key exports:
 * - followUser() — Follow with tier check, cap (20), rate limit (5/day)
 * - unfollowUser() — Remove a follow
 * - isFollowing() — Check follow status for a single user
 * - getFollowedUsers() — List for settings page
 * - getFollowCount() — Current follow count
 *
 * Dependencies: Supabase client
 * Tables: member_follows, profiles
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────

export interface FollowedUser {
  id: string;
  followed_id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  created_at: string;
}

// ─── Core Functions ──────────────────────────

/**
 * Follow a user. Server-side RPC enforces:
 * - auth.uid() identity (no impersonation)
 * - Max 20 follows cap
 * - Max 5 new follows per 24 hours (server-side, not localStorage)
 */
export async function followUser(
  _followerId: string,
  followedId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("user_follow_user", {
    p_followed_id: followedId,
  });

  if (error) {
    console.error("[memberFollows] follow error:", error);
    return { success: false, error: "Could not follow. Try again." };
  }

  const result = data as { success: boolean; error?: string };
  return result;
}

/**
 * Unfollow a user via server-side RPC.
 */
export async function unfollowUser(
  _followerId: string,
  followedId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("user_unfollow_user", {
    p_followed_id: followedId,
  });

  if (error) {
    console.error("[memberFollows] unfollow error:", error);
    return { success: false, error: "Could not unfollow. Try again." };
  }

  const result = data as { success: boolean; error?: string };
  return result;
}

/**
 * Check if the current user is following a specific person.
 * Returns false if not following or on error.
 */
export async function isFollowing(
  followerId: string,
  followedId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("member_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);

  return (count ?? 0) > 0;
}

/**
 * Get the list of people the current user follows.
 * Joins with profiles for display info.
 */
export async function getFollowedUsers(
  followerId: string
): Promise<FollowedUser[]> {
  const { data, error } = await supabase
    .from("member_follows")
    .select("id, followed_id, created_at, profiles!member_follows_followed_id_fkey(display_name, avatar_url, tagline)")
    .eq("follower_id", followerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    followed_id: row.followed_id,
    display_name: row.profiles?.display_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
    tagline: row.profiles?.tagline ?? null,
    created_at: row.created_at,
  }));
}

/**
 * Get the current follow count.
 */
export async function getFollowCount(followerId: string): Promise<number> {
  const { count } = await supabase
    .from("member_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", followerId);

  return count ?? 0;
}
