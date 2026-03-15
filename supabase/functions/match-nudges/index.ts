/**
 * @module match-nudges Edge Function
 * @description Daily proactive match nudge generator. Finds top matches for
 * active members and sends push + in-app notifications via send-notification.
 *
 * Run daily via cron or manual invoke. For each active user:
 * 1. Scores against other active users (same algo as client-side matchUtils)
 * 2. Classifies nudge type (new_member, session_buddy, skill_swap, neighbor, interest_twin)
 * 3. Skips users already nudged in the last 7 days (dedup via notification_log)
 * 4. Sends top 3 via send-notification (in-app + push + email)
 *
 * @tables profiles, event_rsvps, connection_requests, notification_log
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Match scoring (mirrors src/lib/matchUtils.ts) ─────────

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  what_i_do: string | null;
  work_vibe: string | null;
  neighborhood: string | null;
  noise_preference: string | null;
  communication_style: string | null;
  looking_for: string[] | null;
  can_offer: string[] | null;
  interests: string[] | null;
  created_at: string | null;
  last_seen_at: string | null;
}

function calculateMatch(
  viewer: ProfileRow,
  member: ProfileRow
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (viewer.work_vibe && viewer.work_vibe === member.work_vibe) {
    score += 20;
    reasons.push(`Same work vibe: ${member.work_vibe}`);
  }
  if (
    viewer.neighborhood &&
    viewer.neighborhood === member.neighborhood
  ) {
    score += 15;
    reasons.push(`Both in ${member.neighborhood}`);
  }
  if (
    viewer.noise_preference &&
    viewer.noise_preference === member.noise_preference
  ) {
    score += 5;
  }
  if (
    viewer.communication_style &&
    viewer.communication_style === member.communication_style
  ) {
    score += 5;
  }

  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const lookingMatchOffers = viewerLooking.filter((t) =>
    memberOffers.includes(t)
  );
  score += lookingMatchOffers.length * 15;
  lookingMatchOffers.slice(0, 2).forEach((t) => {
    reasons.push(`They offer ${t}`);
  });

  const viewerOffers = viewer.can_offer ?? [];
  const memberLooking = member.looking_for ?? [];
  const offersMatchLooking = viewerOffers.filter((t) =>
    memberLooking.includes(t)
  );
  score += offersMatchLooking.length * 10;

  const sharedInterests = (viewer.interests ?? []).filter((i) =>
    (member.interests ?? []).includes(i)
  );
  score += sharedInterests.length * 5;
  if (sharedInterests.length > 0) {
    reasons.push(`Shared interests: ${sharedInterests.slice(0, 3).join(", ")}`);
  }

  return { score: Math.min(score, 100), reasons: reasons.slice(0, 4) };
}

// ── Nudge classification (mirrors src/lib/matchNudges.ts) ──

type NudgeType =
  | "new_member"
  | "session_buddy"
  | "skill_swap"
  | "neighbor"
  | "interest_twin";

const PRIORITY_MAP: Record<NudgeType, number> = {
  new_member: 5,
  session_buddy: 4,
  skill_swap: 3,
  neighbor: 2,
  interest_twin: 1,
};

function classifyNudge(
  viewer: ProfileRow,
  member: ProfileRow,
  matchResult: { score: number; reasons: string[] },
  recentMemberIds: Set<string>,
  sessionBuddyIds: Set<string>,
  sessionBuddyEventTitle: Map<string, string>
): { type: NudgeType; title: string; body: string } | null {
  const firstName = member.display_name?.split(" ")[0] || "Someone";

  // 1. New member
  if (recentMemberIds.has(member.id) && matchResult.score >= 40) {
    const whatTheyDo = member.what_i_do || member.tagline || "a fellow focused worker";
    return {
      type: "new_member",
      title: `New match: ${firstName} just joined!`,
      body: `${firstName} is ${whatTheyDo}. ${matchResult.score}% match — ${matchResult.reasons[0] || ""}`.trim(),
    };
  }

  // 2. Session buddy
  if (sessionBuddyIds.has(member.id)) {
    const eventTitle =
      sessionBuddyEventTitle.get(member.id) || "an upcoming session";
    return {
      type: "session_buddy",
      title: `You and ${firstName} are both going to ${eventTitle}`,
      body: `Say hi — you're a ${matchResult.score}% match!`,
    };
  }

  // 3. Skill swap
  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const viewerOffers = viewer.can_offer ?? [];
  const memberLooking = member.looking_for ?? [];
  const theyOfferYouNeed = viewerLooking.filter((t) =>
    memberOffers.includes(t)
  );
  const youOfferTheyNeed = viewerOffers.filter((t) =>
    memberLooking.includes(t)
  );

  if (theyOfferYouNeed.length > 0 && youOfferTheyNeed.length > 0) {
    return {
      type: "skill_swap",
      title: `Skill swap with ${firstName}`,
      body: `${firstName} can help with ${theyOfferYouNeed[0]}, and you can help with ${youOfferTheyNeed[0]}.`,
    };
  }

  // 4. Neighbor
  if (
    viewer.neighborhood &&
    member.neighborhood &&
    viewer.neighborhood === member.neighborhood &&
    matchResult.score >= 40
  ) {
    return {
      type: "neighbor",
      title: `${firstName} also works from ${member.neighborhood}`,
      body: `${matchResult.score}% match — ${matchResult.reasons[0] || "check them out!"}`,
    };
  }

  // 5. Interest twin
  const shared = (viewer.interests ?? []).filter((i) =>
    (member.interests ?? []).includes(i)
  );
  if (shared.length >= 3) {
    return {
      type: "interest_twin",
      title: `You and ${firstName} share ${shared.length} interests`,
      body: `You both love ${shared.slice(0, 3).join(", ")}. Lots to talk about!`,
    };
  }

  // Fallback: high-score skill match
  if (matchResult.score >= 50 && theyOfferYouNeed.length > 0) {
    return {
      type: "skill_swap",
      title: `${firstName} can help with ${theyOfferYouNeed[0]}`,
      body: `${matchResult.score}% match — connect and collaborate!`,
    };
  }

  return null;
}

// ── Main handler ──────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const todayStr = now.toISOString().split("T")[0];

    // 1. Get active profiles (seen in last 30 days, with at least display_name)
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, tagline, what_i_do, work_vibe, neighborhood, noise_preference, communication_style, looking_for, can_offer, interests, created_at, last_seen_at"
      )
      .not("display_name", "is", null)
      .gte("last_seen_at", thirtyDaysAgo);

    if (profileErr || !profiles) {
      console.error("[MatchNudges] Profile fetch error:", profileErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch profiles" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[MatchNudges] Processing ${profiles.length} active profiles`);

    if (profiles.length < 2) {
      return new Response(
        JSON.stringify({ nudges_sent: 0, message: "Not enough active profiles" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get upcoming RSVPs for session buddy detection
    const { data: allRsvps } = await supabase
      .from("event_rsvps")
      .select("event_id, user_id, events!inner(id, title, date)")
      .eq("status", "going")
      .gte("events.date", todayStr);

    // 3. Get recent notification_log to avoid re-sending nudges
    const { data: recentLogs } = await supabase
      .from("notification_log")
      .select("user_id, metadata")
      .eq("category", "match_nudge")
      .gte("created_at", sevenDaysAgo);

    // Build set of recently-nudged pairs: "userId:matchedUserId"
    const recentlyNudged = new Set<string>();
    for (const log of recentLogs ?? []) {
      const matchedId = (log.metadata as any)?.matched_user_id;
      if (matchedId) {
        recentlyNudged.add(`${log.user_id}:${matchedId}`);
      }
    }

    // 4. Get all connections
    const { data: connections } = await supabase
      .from("connection_requests")
      .select("from_user, to_user, status")
      .in("status", ["pending", "accepted"]);

    // Build connection map
    const connectionMap = new Map<string, Set<string>>();
    for (const conn of connections ?? []) {
      if (!connectionMap.has(conn.from_user))
        connectionMap.set(conn.from_user, new Set());
      if (!connectionMap.has(conn.to_user))
        connectionMap.set(conn.to_user, new Set());
      connectionMap.get(conn.from_user)!.add(conn.to_user);
      connectionMap.get(conn.to_user)!.add(conn.from_user);
    }

    // Recent members (joined in last 7 days)
    const recentMemberIds = new Set(
      profiles
        .filter((p) => p.created_at && p.created_at >= sevenDaysAgo)
        .map((p) => p.id)
    );

    let totalNudgesSent = 0;
    const NUDGES_PER_USER = 3;

    // 5. Process each user
    for (const viewer of profiles) {
      // Build session buddy set for this user
      const sessionBuddyIds = new Set<string>();
      const sessionBuddyEventTitle = new Map<string, string>();
      const rsvpList = allRsvps ?? [];
      const userEventIds = new Set(
        rsvpList
          .filter((r: any) => r.user_id === viewer.id)
          .map((r: any) => r.event_id)
      );
      for (const rsvp of rsvpList) {
        const r = rsvp as any;
        if (r.user_id !== viewer.id && userEventIds.has(r.event_id)) {
          sessionBuddyIds.add(r.user_id);
          if (r.events?.title) {
            sessionBuddyEventTitle.set(r.user_id, r.events.title);
          }
        }
      }

      const connectedIds = connectionMap.get(viewer.id) ?? new Set();

      // Score and classify matches
      const candidates: Array<{
        type: NudgeType;
        title: string;
        body: string;
        matchedId: string;
        matchedName: string;
        score: number;
        priority: number;
      }> = [];

      for (const member of profiles) {
        if (member.id === viewer.id) continue;

        // Skip if already nudged about this person recently
        if (recentlyNudged.has(`${viewer.id}:${member.id}`)) continue;

        const matchResult = calculateMatch(viewer, member);
        if (matchResult.score < 40) continue;

        const classification = classifyNudge(
          viewer,
          member,
          matchResult,
          recentMemberIds,
          sessionBuddyIds,
          sessionBuddyEventTitle
        );

        if (!classification) continue;

        candidates.push({
          ...classification,
          matchedId: member.id,
          matchedName: member.display_name || "DanaDone Member",
          score: matchResult.score,
          priority: PRIORITY_MAP[classification.type],
        });
      }

      // Sort by priority (desc), then score (desc)
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.score - a.score;
      });

      // Send top N nudges
      const toSend = candidates.slice(0, NUDGES_PER_USER);

      for (const nudge of toSend) {
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              user_id: viewer.id,
              category: "match_nudge",
              title: nudge.title,
              body: nudge.body,
              link: `/profile/${nudge.matchedId}`,
              data: {
                matched_user_id: nudge.matchedId,
                nudge_type: nudge.type,
                match_score: nudge.score,
              },
            },
          });
          totalNudgesSent++;
        } catch (err) {
          console.error(
            `[MatchNudges] Failed to send nudge for ${viewer.id}:`,
            err
          );
        }
      }
    }

    console.log(
      `[MatchNudges] Done. Sent ${totalNudgesSent} nudges for ${profiles.length} users`
    );

    return new Response(
      JSON.stringify({
        nudges_sent: totalNudgesSent,
        users_processed: profiles.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[MatchNudges] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
