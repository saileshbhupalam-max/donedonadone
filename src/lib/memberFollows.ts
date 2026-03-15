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

const MAX_FOLLOWS = 20;
const MAX_DAILY_CHANGES = 5;
const RATE_LIMIT_KEY = "fc_follow_changes";

// ─── Types ──────────────────────────────────

export interface FollowedUser {
  id: string;
  followed_id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  created_at: string;
}

// ─── Rate Limiting (client-side) ──────────────

function getDailyChangeCount(): number {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { date: string; count: number };
    const today = new Date().toISOString().split("T")[0];
    if (data.date !== today) return 0;
    return data.count;
  } catch {
    return 0;
  }
}

function incrementDailyChanges(): void {
  const today = new Date().toISOString().split("T")[0];
  const current = getDailyChangeCount();
  localStorage.setItem(
    RATE_LIMIT_KEY,
    JSON.stringify({ date: today, count: current + 1 })
  );
}

// ─── Core Functions ──────────────────────────

/**
 * Follow a user. Enforces:
 * - Max tier check (caller must verify tier before calling)
 * - Max 20 follows cap
 * - Max 5 follow/unfollow actions per day
 */
export async function followUser(
  followerId: string,
  followedId: string
): Promise<{ success: boolean; error?: string }> {
  // Rate limit check
  if (getDailyChangeCount() >= MAX_DAILY_CHANGES) {
    return { success: false, error: "You've reached the daily limit for follow changes. Try again tomorrow." };
  }

  // Cap check
  const { count } = await supabase
    .from("member_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", followerId);

  if ((count ?? 0) >= MAX_FOLLOWS) {
    return { success: false, error: `You can follow up to ${MAX_FOLLOWS} people. Unfollow someone first.` };
  }

  const { error } = await supabase.from("member_follows").insert({
    follower_id: followerId,
    followed_id: followedId,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You're already following this person." };
    }
    console.error("[memberFollows] follow error:", error);
    return { success: false, error: "Could not follow. Try again." };
  }

  incrementDailyChanges();
  return { success: true };
}

/**
 * Unfollow a user.
 */
export async function unfollowUser(
  followerId: string,
  followedId: string
): Promise<{ success: boolean; error?: string }> {
  if (getDailyChangeCount() >= MAX_DAILY_CHANGES) {
    return { success: false, error: "You've reached the daily limit for follow changes. Try again tomorrow." };
  }

  const { error } = await supabase
    .from("member_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);

  if (error) {
    console.error("[memberFollows] unfollow error:", error);
    return { success: false, error: "Could not unfollow. Try again." };
  }

  incrementDailyChanges();
  return { success: true };
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
