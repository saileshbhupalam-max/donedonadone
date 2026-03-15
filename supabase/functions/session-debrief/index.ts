/**
 * @module session-debrief Edge Function
 * @description Generates personalized post-session summaries for each user
 * after a coworking session ends. Uses a two-tier strategy to control AI costs:
 *
 * 1. **Tier gating** -- Only Pro/Max subscribers (or boost holders) receive
 *    AI-generated debriefs. Free/Plus users get template-based debriefs at
 *    zero AI cost. This keeps the feature available to everyone while reserving
 *    expensive Claude calls for paying users.
 *
 * 2. **Group batching** -- Instead of one Claude call per user, we make one
 *    call per GROUP containing all member contexts. A group of 4 Pro users
 *    costs 1 API call instead of 4 (75% savings). The model returns a JSON
 *    array with one debrief per member.
 *
 * Called after a session ends, either for a single user (user_id provided)
 * or all checked-in attendees (batch mode).
 *
 * @key-exports Deno.serve handler (POST)
 * @dependencies Anthropic Claude API (claude-haiku-4-5-20251001)
 * @tables events, groups, group_members, event_rsvps, profiles, peer_props,
 *         venue_vibes, notifications, notification_log, ai_usage_log,
 *         user_subscriptions, session_boosts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---- Types ----

interface DebriefRequest {
  event_id: string;
  user_id?: string;
}

interface GroupMemberProfile {
  display_name: string;
  work_vibe: string | null;
  can_offer: string[] | null;
  looking_for: string[] | null;
}

interface PropRecord {
  name: string;
  prop_type: string;
}

interface VenueStats {
  name: string;
  avg_noise: number | null;
  avg_wifi: number | null;
  avg_vibe: string | null;
}

interface DebriefContext {
  user: {
    display_name: string;
    work_vibe: string | null;
    looking_for: string[] | null;
    can_offer: string[] | null;
  };
  group_members: GroupMemberProfile[];
  props_received: PropRecord[];
  props_given: PropRecord[];
  venue: VenueStats;
  session: {
    title: string;
    duration_hours: number;
  };
}

interface MemberInsight {
  name: string;
  insight: string;
  action: string;
}

interface DebriefResult {
  summary: string;
  member_insights: MemberInsight[];
  venue_note: string;
  motivation: string;
}

/** Context for a single member within a batch group call. */
interface BatchMemberContext {
  userId: string;
  profile: any;
  propsReceived: PropRecord[];
  propsGiven: PropRecord[];
}

// ---- Constants ----

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Single-user prompt gets 512 tokens; batch prompt needs more headroom
// because the response contains one debrief object per group member.
const MAX_TOKENS_SINGLE = 512;
const MAX_TOKENS_BATCH = 1536;

const SYSTEM_PROMPT = `You are a coworking session debrief writer for DanaDone.
Write a brief, warm, personalized post-session summary.

Format your response as JSON:
{
  "summary": "1-2 sentence highlight of the session",
  "member_insights": [
    { "name": "...", "insight": "1 sentence about potential collaboration", "action": "specific follow-up suggestion" }
  ],
  "venue_note": "optional 1 sentence about venue if there was a notable rating",
  "motivation": "1 sentence encouragement for next session"
}

Keep it concise, warm, and actionable. Focus on collaboration opportunities.
Do not use emojis. Use the person's first name.`;

// Batch prompt asks for ALL members' debriefs in one call.
// WHY: A group of 4 users means 1 API call instead of 4. The model sees every
// member's context simultaneously, which also produces better cross-references
// (e.g., "You and Priya are both looking for design feedback").
const BATCH_SYSTEM_PROMPT = `You are a coworking session debrief writer for DanaDone.
Generate personalized post-session summaries for EACH member in the group.

Return a JSON array where each element has:
[
  {
    "user_name": "the member's name",
    "summary": "1-2 sentence highlight personalized to this member",
    "member_insights": [
      { "name": "...", "insight": "1 sentence about potential collaboration with this specific member", "action": "specific follow-up suggestion" }
    ],
    "venue_note": "optional 1 sentence about venue",
    "motivation": "1 sentence encouragement"
  }
]

Keep it concise, warm, and actionable. Focus on collaboration opportunities.
Do not use emojis. Use each person's first name.
Generate one entry per member in the group.`;

// Tiers that qualify for AI-generated debriefs.
// WHY: AI calls cost money. Free/Plus users still get debriefs (template-based)
// so the feature is universally available, but only paying users get the
// personalized AI version. This aligns cost with revenue.
const PRO_TIER_IDS = new Set(["pro", "max"]);

// ---- Handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: only accept service_role calls (from cron or other Edge Functions)
    const authToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken || authToken !== serviceKey) {
      return new Response(
        JSON.stringify({ error: "Forbidden: service_role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { event_id, user_id }: DebriefRequest = await req.json();
    if (!event_id) {
      return new Response(
        JSON.stringify({ error: "event_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -- Fetch the event --
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, date, start_time, end_time, venue_name")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -- Determine target users --
    // If user_id is specified, debrief only that user.
    // Otherwise, debrief every attendee who checked in to the session.
    // We use checked_in = true because debriefs should only go to people
    // who actually showed up, not those who just RSVPed.
    let targetUserIds: string[];

    if (user_id) {
      targetUserIds = [user_id];
    } else {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("user_id")
        .eq("event_id", event_id)
        .eq("status", "going")
        .eq("checked_in", true);

      targetUserIds = (rsvps || []).map((r: any) => r.user_id);
    }

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ generated: 0, users: [], message: "No checked-in attendees found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -- Tier gating: determine which users qualify for AI debriefs --
    // Check active subscriptions and temporary session boosts.
    // WHY two sources: A user can be Pro via subscription OR via a one-time
    // boost (e.g., gifted by a friend, earned via referral). Both grant the
    // same AI debrief benefit.
    const { data: subscriptions } = await supabase
      .from("user_subscriptions")
      .select("user_id, tier_id")
      .in("user_id", targetUserIds)
      .eq("status", "active");

    const { data: boosts } = await supabase
      .from("session_boosts")
      .select("user_id, boost_tier")
      .in("user_id", targetUserIds)
      .gt("expires_at", new Date().toISOString());

    const proUserIds = new Set<string>();

    for (const sub of subscriptions || []) {
      if (PRO_TIER_IDS.has(sub.tier_id)) proUserIds.add(sub.user_id);
    }
    for (const boost of boosts || []) {
      if (PRO_TIER_IDS.has(boost.boost_tier)) proUserIds.add(boost.user_id);
    }

    // -- Fetch all groups for this event --
    const { data: groups } = await supabase
      .from("groups")
      .select("id, group_number, group_members(user_id)")
      .eq("event_id", event_id);

    // Build a map: user_id -> list of group-mate user_ids.
    // A user may not be in any group (no groups created yet), in which case
    // we fall back to all checked-in attendees as their "group."
    const userToGroupmates = new Map<string, string[]>();
    const userToGroupId = new Map<string, string>();
    const allGroupUserIds = new Set<string>();

    for (const g of groups || []) {
      const members = ((g as any).group_members || []).map((m: any) => m.user_id);
      for (const uid of members) {
        allGroupUserIds.add(uid);
        userToGroupId.set(uid, (g as any).id);
      }
      for (const uid of members) {
        const mates = members.filter((m: string) => m !== uid);
        const existing = userToGroupmates.get(uid) || [];
        userToGroupmates.set(uid, [...existing, ...mates]);
      }
    }

    // If no groups exist, treat all checked-in attendees as one group.
    // This handles casual sessions where the admin never assigned groups.
    if (!groups || groups.length === 0) {
      for (const uid of targetUserIds) {
        userToGroupmates.set(uid, targetUserIds.filter((id) => id !== uid));
        userToGroupId.set(uid, "ungrouped");
      }
    }

    // -- Fetch all profiles we need --
    const allRelevantIds = new Set<string>([...targetUserIds, ...allGroupUserIds]);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, work_vibe, looking_for, can_offer, interests")
      .in("id", Array.from(allRelevantIds));

    const profileMap: Record<string, any> = {};
    for (const p of profiles || []) {
      profileMap[p.id] = p;
    }

    // -- Fetch all peer props for this event --
    const { data: allProps } = await supabase
      .from("peer_props")
      .select("from_user, to_user, prop_type")
      .eq("event_id", event_id);

    // -- Fetch venue vibe ratings for this event --
    const { data: vibeRatings } = await supabase
      .from("venue_vibes")
      .select("noise_level, wifi_quality, coffee_quality, seating_comfort, overall_vibe")
      .eq("event_id", event_id);

    // Compute averages across all ratings for this session.
    // Ratings are 1-5 integers; overall_vibe is text so we take the mode.
    const venueStats = computeVenueStats(event.venue_name || "the venue", vibeRatings || []);

    // Compute session duration from start_time and end_time (HH:MM format).
    const durationHours = computeDurationHours(event.start_time, event.end_time);

    const sessionInfo = { title: event.title, duration_hours: durationHours };

    // -- Precompute props per user --
    // Build these maps once so we can look them up for both batch and template paths.
    const propsReceivedMap = new Map<string, PropRecord[]>();
    const propsGivenMap = new Map<string, PropRecord[]>();

    for (const uid of targetUserIds) {
      propsReceivedMap.set(
        uid,
        (allProps || [])
          .filter((p: any) => p.to_user === uid)
          .map((p: any) => ({
            name: profileMap[p.from_user]?.display_name || "Someone",
            prop_type: p.prop_type,
          }))
      );
      propsGivenMap.set(
        uid,
        (allProps || [])
          .filter((p: any) => p.from_user === uid)
          .map((p: any) => ({
            name: profileMap[p.to_user]?.display_name || "Someone",
            prop_type: p.prop_type,
          }))
      );
    }

    // -- Generate debriefs --
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let generated = 0;
    const processedUsers: string[] = [];

    // Partition target users into groups for batch AI generation.
    // WHY group-level batching: The Claude prompt includes all members' profiles,
    // so one call produces debriefs for everyone in the group. A session with
    // 20 users in 5 groups of 4 = 5 API calls instead of 20.
    const groupBuckets = new Map<string, string[]>();
    for (const uid of targetUserIds) {
      const gid = userToGroupId.get(uid) || "ungrouped";
      const bucket = groupBuckets.get(gid) || [];
      bucket.push(uid);
      groupBuckets.set(gid, bucket);
    }

    // Track which users already got an AI debrief via batch, so we skip them
    // in the per-user fallback loop.
    const aiDebriefResults = new Map<string, DebriefResult>();

    // -- Batch AI generation for groups with Pro+ members --
    if (anthropicKey) {
      for (const [_groupId, memberIds] of groupBuckets) {
        // Only Pro+ users in this group get AI debriefs.
        const proMembersInGroup = memberIds.filter((uid) => proUserIds.has(uid));

        if (proMembersInGroup.length === 0) continue;

        // Build batch context for all Pro+ members in this group.
        const batchMembers: BatchMemberContext[] = proMembersInGroup
          .map((uid) => ({
            userId: uid,
            profile: profileMap[uid],
            propsReceived: propsReceivedMap.get(uid) || [],
            propsGiven: propsGivenMap.get(uid) || [],
          }))
          .filter((m) => m.profile); // skip users with missing profiles

        if (batchMembers.length === 0) continue;

        // If only one Pro user in the group, use the original single-user path
        // to avoid the overhead of the batch JSON array format.
        if (batchMembers.length === 1) {
          const m = batchMembers[0];
          const groupmates = userToGroupmates.get(m.userId) || [];
          const memberProfiles: GroupMemberProfile[] = groupmates
            .map((gid) => profileMap[gid])
            .filter(Boolean)
            .map((p: any) => ({
              display_name: p.display_name || "A coworker",
              work_vibe: p.work_vibe,
              can_offer: p.can_offer,
              looking_for: p.looking_for,
            }));

          const context: DebriefContext = {
            user: {
              display_name: m.profile.display_name || "Coworker",
              work_vibe: m.profile.work_vibe,
              looking_for: m.profile.looking_for,
              can_offer: m.profile.can_offer,
            },
            group_members: memberProfiles,
            props_received: m.propsReceived,
            props_given: m.propsGiven,
            venue: venueStats,
            session: sessionInfo,
          };

          const result = await generateAIDebrief(context, anthropicKey, supabase);
          aiDebriefResults.set(m.userId, result);
        } else {
          // Batch call: one Claude request for all Pro+ members in this group.
          const results = await generateBatchDebriefs(
            batchMembers,
            venueStats,
            sessionInfo,
            anthropicKey,
            supabase,
            profileMap,
            userToGroupmates
          );
          for (const [uid, result] of results) {
            aiDebriefResults.set(uid, result);
          }
        }
      }
    }

    // -- Generate debriefs for all target users and store notifications --
    for (const uid of targetUserIds) {
      const profile = profileMap[uid];
      if (!profile) continue;

      let debrief: DebriefResult;

      if (aiDebriefResults.has(uid)) {
        // This user got an AI debrief via batch (or single) call above.
        debrief = aiDebriefResults.get(uid)!;
      } else {
        // Non-Pro user, or no API key, or AI failed for this group.
        // Fall back to the deterministic template -- zero AI cost.
        const groupmates = userToGroupmates.get(uid) || [];
        const memberProfiles: GroupMemberProfile[] = groupmates
          .map((gid) => profileMap[gid])
          .filter(Boolean)
          .map((p: any) => ({
            display_name: p.display_name || "A coworker",
            work_vibe: p.work_vibe,
            can_offer: p.can_offer,
            looking_for: p.looking_for,
          }));

        const context: DebriefContext = {
          user: {
            display_name: profile.display_name || "Coworker",
            work_vibe: profile.work_vibe,
            looking_for: profile.looking_for,
            can_offer: profile.can_offer,
          },
          group_members: memberProfiles,
          props_received: propsReceivedMap.get(uid) || [],
          props_given: propsGivenMap.get(uid) || [],
          venue: venueStats,
          session: sessionInfo,
        };

        debrief = generateTemplateDebrief(context);
        await supabase.from("ai_usage_log").insert({
          task_type: "session_debrief",
          source: "template",
        });
      }

      // -- Store notification --
      await supabase.from("notifications").insert({
        user_id: uid,
        type: "session_debrief",
        title: "Your session debrief is ready",
        body: debrief.summary,
        link: `/events/${event_id}`,
      });

      await supabase.from("notification_log").insert({
        user_id: uid,
        channel: "in_app",
        category: "session_debrief",
        title: "Your session debrief is ready",
        body: debrief.summary,
        status: "sent",
        metadata: {
          event_id,
          member_insights: debrief.member_insights,
          venue_note: debrief.venue_note,
          motivation: debrief.motivation,
        },
      });

      generated++;
      processedUsers.push(uid);
    }

    return new Response(
      JSON.stringify({ generated, users: processedUsers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SessionDebrief] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---- AI Generation (single user) ----

async function generateAIDebrief(
  context: DebriefContext,
  apiKey: string,
  supabase: any
): Promise<DebriefResult> {
  const userPrompt = buildUserPrompt(context);

  try {
    const resp = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS_SINGLE,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      console.error("[SessionDebrief] Claude API error:", resp.status, await resp.text());
      // Degrade gracefully to template if the API call fails.
      await supabase.from("ai_usage_log").insert({
        task_type: "session_debrief",
        source: "template",
      });
      return generateTemplateDebrief(context);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    await supabase.from("ai_usage_log").insert({
      task_type: "session_debrief",
      source: "ai",
      provider_id: "anthropic",
      model: CLAUDE_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    return parseDebriefResponse(text, context);
  } catch (err) {
    console.error("[SessionDebrief] AI generation failed:", err);
    await supabase.from("ai_usage_log").insert({
      task_type: "session_debrief",
      source: "template",
    });
    return generateTemplateDebrief(context);
  }
}

// ---- AI Generation (batch per group) ----

/**
 * Generate debriefs for multiple Pro+ users in a single Claude call.
 * WHY: The dominant cost driver is per-request overhead and input tokens for
 * system prompt + context. By sending all members at once, we pay the system
 * prompt cost once and share the venue/session context across all members.
 * A group of 4 goes from 4 calls to 1 -- roughly 75% cost reduction.
 *
 * The model returns a JSON array with one debrief per member. We match
 * results back to user IDs by display_name (case-insensitive).
 */
async function generateBatchDebriefs(
  groupMembers: BatchMemberContext[],
  venueStats: VenueStats,
  session: { title: string; duration_hours: number },
  apiKey: string,
  supabase: any,
  profileMap: Record<string, any>,
  userToGroupmates: Map<string, string[]>
): Promise<Map<string, DebriefResult>> {
  const results = new Map<string, DebriefResult>();

  // Build a single prompt with all member contexts.
  const parts: string[] = [];
  parts.push(`Session: "${session.title}" (${session.duration_hours} hours)`);
  parts.push(`Venue: ${venueStats.name}`);
  if (venueStats.avg_noise !== null) parts.push(`  Avg noise: ${venueStats.avg_noise.toFixed(1)}/5`);
  if (venueStats.avg_wifi !== null) parts.push(`  Avg wifi: ${venueStats.avg_wifi.toFixed(1)}/5`);
  if (venueStats.avg_vibe) parts.push(`  Overall vibe: ${venueStats.avg_vibe}`);
  parts.push("");
  parts.push("Group members:");

  // Build a name -> userId lookup for matching results back.
  const nameToUserId = new Map<string, string>();

  for (const m of groupMembers) {
    const name = m.profile.display_name || "Member";
    nameToUserId.set(name.toLowerCase(), m.userId);

    parts.push(`\n--- ${name} ---`);
    parts.push(`Work vibe: ${m.profile.work_vibe || "not set"}`);
    if (m.profile.looking_for?.length) {
      parts.push(`Looking for: ${m.profile.looking_for.join(", ")}`);
    }
    if (m.profile.can_offer?.length) {
      parts.push(`Can offer: ${m.profile.can_offer.join(", ")}`);
    }
    if (m.propsReceived.length > 0) {
      parts.push(
        `Props received: ${m.propsReceived.map((p) => `"${p.prop_type}" from ${p.name}`).join(", ")}`
      );
    }
  }

  parts.push("");
  parts.push(`Generate a personalized debrief for EACH of the ${groupMembers.length} members above.`);

  const userPrompt = parts.join("\n");

  try {
    const resp = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS_BATCH,
        temperature: 0.7,
        system: BATCH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      console.error("[SessionDebrief] Batch Claude API error:", resp.status, await resp.text());
      // Fall back to template for all members in this group.
      return generateBatchTemplateFallback(groupMembers, venueStats, session, supabase, profileMap, userToGroupmates);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    // Log as a single AI call -- the key cost metric.
    await supabase.from("ai_usage_log").insert({
      task_type: "session_debrief",
      source: "ai",
      provider_id: "anthropic",
      model: CLAUDE_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { batch_size: groupMembers.length },
    });

    // Parse the JSON array response from Claude.
    const parsed = parseBatchResponse(text);

    if (!parsed || parsed.length === 0) {
      // Model returned unparseable output -- fall back to template for all.
      console.error("[SessionDebrief] Batch response parse failed, falling back to template");
      return generateBatchTemplateFallback(groupMembers, venueStats, session, supabase, profileMap, userToGroupmates);
    }

    // Match each parsed debrief back to a user ID by name.
    for (const entry of parsed) {
      const entryName = (entry.user_name || "").toLowerCase();
      const matchedUserId = nameToUserId.get(entryName);

      if (matchedUserId) {
        results.set(matchedUserId, {
          summary: entry.summary || "",
          member_insights: Array.isArray(entry.member_insights) ? entry.member_insights : [],
          venue_note: entry.venue_note || "",
          motivation: entry.motivation || "",
        });
      }
    }

    // Any Pro+ member not matched (e.g., name mismatch) gets a template debrief.
    for (const m of groupMembers) {
      if (!results.has(m.userId)) {
        const context = buildContextForMember(m, venueStats, session, profileMap, userToGroupmates);
        results.set(m.userId, generateTemplateDebrief(context));
        await supabase.from("ai_usage_log").insert({
          task_type: "session_debrief",
          source: "template",
          metadata: { reason: "batch_name_mismatch" },
        });
      }
    }

    return results;
  } catch (err) {
    console.error("[SessionDebrief] Batch AI generation failed:", err);
    return generateBatchTemplateFallback(groupMembers, venueStats, session, supabase, profileMap, userToGroupmates);
  }
}

/**
 * Parse a batch JSON array response from Claude. Handles markdown code fences
 * and returns null if parsing fails entirely.
 */
function parseBatchResponse(text: string): any[] | null {
  try {
    const cleaned = text
      .replace(/^```json?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * When a batch AI call fails, generate template debriefs for all members
 * in the group so no user is left without a debrief.
 */
async function generateBatchTemplateFallback(
  groupMembers: BatchMemberContext[],
  venueStats: VenueStats,
  session: { title: string; duration_hours: number },
  supabase: any,
  profileMap: Record<string, any>,
  userToGroupmates: Map<string, string[]>
): Promise<Map<string, DebriefResult>> {
  const results = new Map<string, DebriefResult>();

  for (const m of groupMembers) {
    const context = buildContextForMember(m, venueStats, session, profileMap, userToGroupmates);
    results.set(m.userId, generateTemplateDebrief(context));
    await supabase.from("ai_usage_log").insert({
      task_type: "session_debrief",
      source: "template",
    });
  }

  return results;
}

/**
 * Build a DebriefContext for a single member, used when falling back to
 * template generation from the batch path.
 */
function buildContextForMember(
  member: BatchMemberContext,
  venueStats: VenueStats,
  session: { title: string; duration_hours: number },
  profileMap: Record<string, any>,
  userToGroupmates: Map<string, string[]>
): DebriefContext {
  const groupmates = userToGroupmates.get(member.userId) || [];
  const memberProfiles: GroupMemberProfile[] = groupmates
    .map((gid) => profileMap[gid])
    .filter(Boolean)
    .map((p: any) => ({
      display_name: p.display_name || "A coworker",
      work_vibe: p.work_vibe,
      can_offer: p.can_offer,
      looking_for: p.looking_for,
    }));

  return {
    user: {
      display_name: member.profile.display_name || "Coworker",
      work_vibe: member.profile.work_vibe,
      looking_for: member.profile.looking_for,
      can_offer: member.profile.can_offer,
    },
    group_members: memberProfiles,
    props_received: member.propsReceived,
    props_given: member.propsGiven,
    venue: venueStats,
    session,
  };
}

/**
 * Parse the JSON response from Claude. The model should return valid JSON,
 * but we guard against malformed output by falling back to the template.
 */
function parseDebriefResponse(text: string, context: DebriefContext): DebriefResult {
  try {
    // Claude sometimes wraps JSON in markdown code fences -- strip them.
    const cleaned = text
      .replace(/^```json?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary || generateTemplateDebrief(context).summary,
      member_insights: Array.isArray(parsed.member_insights) ? parsed.member_insights : [],
      venue_note: parsed.venue_note || "",
      motivation: parsed.motivation || "",
    };
  } catch {
    // If JSON parsing fails, use the raw text as the summary and fill in
    // the rest with template values so the user still gets something useful.
    const fallback = generateTemplateDebrief(context);
    return {
      ...fallback,
      summary: text.slice(0, 300) || fallback.summary,
    };
  }
}

// ---- Template Fallback ----

/**
 * Generate a deterministic debrief without calling any AI API.
 * Used when:
 * - The user is on Free/Plus tier (not eligible for AI debriefs)
 * - ANTHROPIC_API_KEY is not set (dev/staging)
 * - The AI API call fails (graceful degradation)
 *
 * The template is intentionally simple but still personalized using the
 * context data we already fetched from the database.
 */
function generateTemplateDebrief(context: DebriefContext): DebriefResult {
  const { user, group_members, props_received, venue, session } = context;
  const firstName = (user.display_name || "there").split(" ")[0];
  const memberCount = group_members.length;

  // Build a summary that references the session and group size
  let summary: string;
  if (memberCount > 0) {
    summary = `Great session, ${firstName}! You coworked with ${memberCount} ${memberCount === 1 ? "person" : "people"} during "${session.title}".`;
  } else {
    summary = `Nice work, ${firstName}! You completed "${session.title}".`;
  }

  // Add a note about props if the user received any
  if (props_received.length > 0) {
    const propTypes = [...new Set(props_received.map((p) => p.prop_type))];
    summary += ` You were recognized for being ${propTypes.join(", ")}.`;
  }

  // Build member insights from profile overlap
  const memberInsights: MemberInsight[] = group_members.slice(0, 3).map((m) => {
    const memberFirst = (m.display_name || "A coworker").split(" ")[0];
    const sharedSkill = findOverlap(user.looking_for, m.can_offer);
    const sharedGoal = findOverlap(user.looking_for, m.looking_for);

    if (sharedSkill) {
      return {
        name: memberFirst,
        insight: `${memberFirst} can offer ${sharedSkill}, which aligns with what you are looking for.`,
        action: `Reach out to ${memberFirst} to discuss ${sharedSkill}.`,
      };
    }
    if (sharedGoal) {
      return {
        name: memberFirst,
        insight: `You and ${memberFirst} are both looking for ${sharedGoal}.`,
        action: `Team up with ${memberFirst} at your next session to work on ${sharedGoal} together.`,
      };
    }
    return {
      name: memberFirst,
      insight: `${memberFirst} was in your group and could be a great future collaborator.`,
      action: `Say hi to ${memberFirst} at your next session.`,
    };
  });

  // Venue note based on average ratings
  let venueNote = "";
  if (venue.avg_noise !== null && venue.avg_noise <= 2) {
    venueNote = `${venue.name} scored well on noise levels -- a solid pick for focused work.`;
  } else if (venue.avg_wifi !== null && venue.avg_wifi >= 4) {
    venueNote = `${venue.name} had great wifi ratings from the group.`;
  } else if (venue.name !== "the venue") {
    venueNote = `Thanks for rating ${venue.name} -- your feedback helps the community.`;
  }

  const motivation =
    session.duration_hours >= 4
      ? `A ${session.duration_hours}-hour session is no small feat. Keep the momentum going!`
      : "Every session builds your network. See you at the next one!";

  return {
    summary,
    member_insights: memberInsights,
    venue_note: venueNote,
    motivation,
  };
}

// ---- Prompt Builder (single user) ----

function buildUserPrompt(context: DebriefContext): string {
  const { user, group_members, props_received, props_given, venue, session } = context;

  const parts: string[] = [];

  parts.push(`Session: "${session.title}" (${session.duration_hours} hours)`);
  parts.push(`User: ${user.display_name}, work vibe: ${user.work_vibe || "not set"}`);

  if (user.looking_for?.length) {
    parts.push(`Looking for: ${user.looking_for.join(", ")}`);
  }
  if (user.can_offer?.length) {
    parts.push(`Can offer: ${user.can_offer.join(", ")}`);
  }

  if (group_members.length > 0) {
    parts.push("");
    parts.push("Group members:");
    for (const m of group_members) {
      const skills = [
        m.work_vibe ? `vibe: ${m.work_vibe}` : null,
        m.can_offer?.length ? `offers: ${m.can_offer.join(", ")}` : null,
        m.looking_for?.length ? `looking for: ${m.looking_for.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      parts.push(`- ${m.display_name}${skills ? ` (${skills})` : ""}`);
    }
  }

  if (props_received.length > 0) {
    parts.push("");
    parts.push("Props received:");
    for (const p of props_received) {
      parts.push(`- ${p.name} gave "${p.prop_type}"`);
    }
  }

  if (props_given.length > 0) {
    parts.push("");
    parts.push("Props given:");
    for (const p of props_given) {
      parts.push(`- Gave "${p.prop_type}" to ${p.name}`);
    }
  }

  if (venue.name !== "the venue") {
    parts.push("");
    parts.push(`Venue: ${venue.name}`);
    if (venue.avg_noise !== null) parts.push(`  Avg noise: ${venue.avg_noise.toFixed(1)}/5`);
    if (venue.avg_wifi !== null) parts.push(`  Avg wifi: ${venue.avg_wifi.toFixed(1)}/5`);
    if (venue.avg_vibe) parts.push(`  Overall vibe: ${venue.avg_vibe}`);
  }

  parts.push("");
  parts.push("Generate a personalized debrief for this user.");

  return parts.join("\n");
}

// ---- Helpers ----

/**
 * Compute average numeric ratings and the most common overall_vibe text
 * from all venue_vibes rows for this session.
 */
function computeVenueStats(
  venueName: string,
  ratings: Array<{
    noise_level: number | null;
    wifi_quality: number | null;
    coffee_quality: number | null;
    seating_comfort: number | null;
    overall_vibe: string | null;
  }>
): VenueStats {
  if (ratings.length === 0) {
    return { name: venueName, avg_noise: null, avg_wifi: null, avg_vibe: null };
  }

  const avg = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };

  // Mode for overall_vibe -- pick the most frequently occurring text value.
  const vibeCounts: Record<string, number> = {};
  for (const r of ratings) {
    if (r.overall_vibe) {
      vibeCounts[r.overall_vibe] = (vibeCounts[r.overall_vibe] || 0) + 1;
    }
  }
  const topVibe = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    name: venueName,
    avg_noise: avg(ratings.map((r) => r.noise_level)),
    avg_wifi: avg(ratings.map((r) => r.wifi_quality)),
    avg_vibe: topVibe,
  };
}

/**
 * Parse start_time and end_time (HH:MM strings) into a duration in hours.
 * Falls back to 2 hours if times are missing or unparseable.
 */
function computeDurationHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 2;

  try {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const diff = endMins - startMins;
    // Guard against negative durations (e.g., overnight sessions or bad data)
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 2;
  } catch {
    return 2;
  }
}

/**
 * Find the first overlapping element between two string arrays.
 * Used to find skill/goal matches between group members.
 */
function findOverlap(
  listA: string[] | null | undefined,
  listB: string[] | null | undefined
): string | null {
  if (!listA?.length || !listB?.length) return null;
  const setB = new Set(listB.map((s) => s.toLowerCase()));
  for (const item of listA) {
    if (setB.has(item.toLowerCase())) return item;
  }
  return null;
}
