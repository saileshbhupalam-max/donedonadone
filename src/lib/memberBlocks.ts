/**
 * @module memberBlocks
 * @description Safety Block List — Any user can block another user. Blocking is
 * completely invisible to the blocked person. The only effect: the blocker gets
 * a private notification when the blocked person RSVPs to a session the blocker
 * is attending. Blocked users are also suppressed from match nudges and
 * suggestions for the blocker.
 *
 * Key exports:
 * - blockUser() — Block with cap (25)
 * - unblockUser() — Remove a block
 * - isBlocked() — Check block status for a single user
 * - getBlockedUsers() — List for settings page
 * - getBlockedUserIds() — Set<string> for filtering (match nudges, suggestions)
 *
 * Dependencies: Supabase client
 * Tables: member_blocks, profiles
 */
import { supabase } from "@/integrations/supabase/client";

const MAX_BLOCKS = 25;

// ─── Types ──────────────────────────────────

export interface BlockedUser {
  id: string;
  blocked_id: string;
  display_name: string | null;
  avatar_url: string | null;
  reason: string | null;
  created_at: string;
}

// ─── Core Functions ──────────────────────────

/**
 * Block a user. Enforces max 25 blocks.
 * No confirmation dialog by design — make it easy to act on gut feeling.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Cap check
  const { count } = await supabase
    .from("member_blocks")
    .select("id", { count: "exact", head: true })
    .eq("blocker_id", blockerId);

  if ((count ?? 0) >= MAX_BLOCKS) {
    return {
      success: false,
      error: `You can block up to ${MAX_BLOCKS} people. If you're hitting this limit, please contact support.`,
    };
  }

  const { error } = await supabase.from("member_blocks").insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
    reason: reason || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This person is already blocked." };
    }
    console.error("[memberBlocks] block error:", error);
    return { success: false, error: "Could not block. Try again." };
  }

  return { success: true };
}

/**
 * Unblock a user.
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("member_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  if (error) {
    console.error("[memberBlocks] unblock error:", error);
    return { success: false, error: "Could not unblock. Try again." };
  }

  return { success: true };
}

/**
 * Check if blocker has blocked a specific person.
 */
export async function isBlocked(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("member_blocks")
    .select("id", { count: "exact", head: true })
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  return (count ?? 0) > 0;
}

/**
 * Get the list of people the current user has blocked.
 * Joins with profiles for display info.
 */
export async function getBlockedUsers(
  blockerId: string
): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from("member_blocks")
    .select("id, blocked_id, reason, created_at, profiles!member_blocks_blocked_id_fkey(display_name, avatar_url)")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    blocked_id: row.blocked_id,
    display_name: row.profiles?.display_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
    reason: row.reason,
    created_at: row.created_at,
  }));
}

/**
 * Get a Set of blocked user IDs for the current user.
 * Used for filtering match nudges, suggestions, WhosHere, etc.
 * This is the primary integration point — call once, pass the Set to filters.
 */
export async function getBlockedUserIds(
  blockerId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("member_blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId);

  if (error || !data) return new Set();
  return new Set(data.map((row: any) => row.blocked_id));
}
