/**
 * @module neighborhood-growth-manager Edge Function
 * @description Daily AI-driven neighborhood activation automation. Runs via cron
 * (or manual POST) and proactively drives pre-unlock neighborhoods toward the
 * 10-member activation threshold by sending targeted nudge notifications.
 *
 * Tasks:
 *   1. **Milestone nudges** — Scans all pre-unlock neighborhoods. When a member
 *      count crosses an activation milestone (3, 5, 7, 9), generates and sends
 *      AI-crafted nudge notifications to all members in that neighborhood.
 *
 *   2. **Ambassador nudges** — For each pre-unlock neighborhood, identifies the
 *      top referrer ("power inviter") and sends them a personalized nudge
 *      encouraging them to keep inviting.
 *
 *   3. **Unlock celebrations** — When a neighborhood crosses the 10-member
 *      threshold, sends celebration notifications to ALL members, awards pioneer
 *      bonus FC to all existing members, and awards an extra unlock trigger bonus
 *      to the member whose invite caused the crossing.
 *
 * **Template graduation:** After generating 5 AI messages per milestone level,
 * caches the best one and reuses with name/neighborhood substitution. Same
 * pattern as ai-community-manager — progressively reduces AI cost to zero.
 *
 * @key-exports None (Edge Function entry point)
 * @dependencies Anthropic Messages API (claude-haiku-4-5-20251001)
 * @tables profiles, notifications, notification_log, neighborhood_stats,
 *         focus_credits (via server_award_credits RPC), ai_usage_log, ai_cache
 *
 * @accepts POST { action?: "milestones" | "ambassadors" | "unlocks" | "all" }
 *          Defaults to "all" if action is omitted.
 * @returns { milestone_nudges: number, ambassador_nudges: number, unlocks: number, fc_awarded: number }
 *
 * @cron-schedule
 * -- Run daily at 9am UTC (2:30pm IST — afternoon in Bangalore, good time for nudges):
 * -- select cron.schedule(
 * --   'neighborhood-growth-manager',
 * --   '0 9 * * *',
 * --   $$SELECT net.http_post(
 * --     url := 'https://cdybdawcyptgqmjlmrpx.supabase.co/functions/v1/neighborhood-growth-manager',
 * --     headers := jsonb_build_object(
 * --       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
 * --       'Content-Type', 'application/json'
 * --     ),
 * --     body := '{"action":"all"}'::jsonb
 * --   )$$
 * -- );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---- Types -----------------------------------------------------------------

interface NeighborhoodRow {
  neighborhood: string;
  member_count: number;
  is_unlocked: boolean;
  is_bootstrapped: boolean;
  last_member_count_seen: number | null;
}

interface MemberProfile {
  id: string;
  display_name: string | null;
  neighborhood: string | null;
  referral_code: string | null;
  created_at: string;
}

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface CachedTemplate {
  cache_value: {
    text: string;
    neighborhood: string;
  };
}

interface TaskCounts {
  milestone_nudges: number;
  ambassador_nudges: number;
  unlocks: number;
  fc_awarded: number;
}

// ---- Constants -------------------------------------------------------------

/**
 * WHY these milestones: they map to 30%, 50%, 70%, 90% of the 10-member threshold.
 * Each crossing creates an escalating urgency arc:
 *   3 = "starting!" (social proof)
 *   5 = "halfway!" (momentum)
 *   7 = "almost!" (urgency)
 *   9 = "ONE MORE!" (FOMO)
 * Matches activationMilestones in growthConfig.ts.
 */
const ACTIVATION_MILESTONES = [3, 5, 7, 9];
const UNLOCK_THRESHOLD = 10;

/**
 * FC rewards from growthConfig.activation.
 * Hardcoded here because edge functions can't import client-side growthConfig
 * (it uses the browser Supabase client). These values MUST stay in sync with
 * DEFAULT_GROWTH_CONFIG.activation in src/lib/growthConfig.ts.
 */
const PIONEER_BONUS_FC = 20;
const UNLOCK_TRIGGER_BONUS_FC = 50;

/**
 * WHY 5: same reasoning as ai-community-manager. Below 5 templates, reuse
 * feels repetitive. At 5+, random selection gives reasonable diversity.
 */
const TEMPLATE_GRADUATION_THRESHOLD = 5;

/**
 * WHY 90 days: templates stay relevant for roughly a quarter. After 90 days
 * they expire, forcing fresh AI generation to keep messaging current.
 */
const TEMPLATE_TTL_DAYS = 90;

const LOG_PREFIX = "[NeighborhoodGrowthManager]";

// ---- Claude helper ---------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Sends a single prompt to Claude and returns text + token counts.
 * Returns null on any failure so callers can skip gracefully.
 *
 * WHY max_tokens 200: milestone nudges are short notification messages (1-2
 * sentences). Keeping it tight controls cost on a daily cron that may process
 * dozens of neighborhoods.
 */
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 200,
): Promise<{ text: string; inputTokens: number; outputTokens: number } | null> {
  try {
    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      console.error(
        `${LOG_PREFIX} Claude API error: ${resp.status} ${resp.statusText}`,
      );
      return null;
    }

    const data: ClaudeResponse = await resp.json();
    const text = data.content?.[0]?.text || "";
    if (!text) return null;

    return {
      text,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} Claude call failed:`, err);
    return null;
  }
}

// ---- AI usage + template helpers -------------------------------------------

/**
 * Logs an AI usage row for cost tracking and audit.
 * Source field distinguishes live AI calls from template cache hits.
 */
async function logAiUsage(
  supabase: ReturnType<typeof createClient>,
  taskType: string,
  inputTokens: number,
  outputTokens: number,
  source: "ai" | "template_cache" = "ai",
): Promise<void> {
  await supabase.from("ai_usage_log").insert({
    task_type: taskType,
    source,
    provider_id: source === "ai" ? "anthropic" : "template_cache",
    model: source === "ai" ? MODEL : "cached",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}

/**
 * Attempts to serve a message from the template cache instead of calling Claude.
 *
 * WHY: same pattern as ai-community-manager. Once we have 5+ good AI-generated
 * nudges for a given milestone level, we reuse them with neighborhood name
 * substitution. The messages were already AI-crafted per milestone, so swapping
 * the neighborhood name preserves quality at zero marginal cost.
 */
async function tryTemplateGraduation(
  supabase: ReturnType<typeof createClient>,
  cacheType: string,
  milestoneKey: string,
  neighborhoodDisplay: string,
): Promise<string | null> {
  const nowIso = new Date().toISOString();

  const { count, error: countErr } = await supabase
    .from("ai_cache")
    .select("id", { count: "exact", head: true })
    .eq("cache_type", cacheType)
    .like("cache_key", `${milestoneKey}:%`)
    .gt("expires_at", nowIso);

  if (countErr || !count || count < TEMPLATE_GRADUATION_THRESHOLD) {
    return null;
  }

  // Pick a random template from up to 10 candidates
  const { data: templates, error: fetchErr } = await supabase
    .from("ai_cache")
    .select("cache_value")
    .eq("cache_type", cacheType)
    .like("cache_key", `${milestoneKey}:%`)
    .gt("expires_at", nowIso)
    .limit(10);

  if (fetchErr || !templates || templates.length === 0) {
    return null;
  }

  const picked = templates[
    Math.floor(Math.random() * templates.length)
  ] as CachedTemplate;

  const templateText: string = picked.cache_value?.text;
  if (!templateText) return null;

  // Replace the original neighborhood name with the new one
  const originalNeighborhood: string =
    picked.cache_value?.neighborhood || "your neighborhood";
  const newText = templateText.replace(
    new RegExp(escapeRegExp(originalNeighborhood), "gi"),
    neighborhoodDisplay,
  );

  console.log(
    `${LOG_PREFIX} Template graduation: served ${cacheType} for milestone "${milestoneKey}" from cache (${count} templates available)`,
  );

  return newText;
}

/**
 * Stores a freshly AI-generated message as a reusable template.
 * Timestamp suffix makes each key unique while preserving the milestone prefix
 * for LIKE queries. Same pattern as ai-community-manager.
 */
async function storeTemplate(
  supabase: ReturnType<typeof createClient>,
  cacheType: string,
  milestoneKey: string,
  text: string,
  neighborhoodDisplay: string,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + TEMPLATE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    await supabase.from("ai_cache").insert({
      cache_type: cacheType,
      cache_key: `${milestoneKey}:${Date.now()}`,
      cache_value: { text, neighborhood: neighborhoodDisplay },
      hit_count: 0,
      expires_at: expiresAt,
    });
  } catch {
    // Silently ignore — template storage is a best-effort optimization
  }
}

/** Escape special regex characters in a string for use in new RegExp(). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- Display name helper ---------------------------------------------------

/**
 * Convert a normalized neighborhood slug back to display form.
 * "hsr-layout" → "HSR Layout" (checks known seeds first, then title-cases).
 *
 * WHY duplicated from src/lib/neighborhoods.ts: edge functions run in Deno and
 * cannot import React/browser modules. This is a lightweight server-side copy.
 */
const KNOWN_DISPLAY_NAMES: Record<string, string> = {
  "hsr-layout": "HSR Layout",
  "koramangala": "Koramangala",
  "indiranagar": "Indiranagar",
  "btm-layout": "BTM Layout",
  "jp-nagar": "JP Nagar",
  "jayanagar": "Jayanagar",
  "whitefield": "Whitefield",
  "electronic-city": "Electronic City",
  "marathahalli": "Marathahalli",
  "sarjapur-road": "Sarjapur Road",
};

function displayNeighborhood(slug: string): string {
  if (KNOWN_DISPLAY_NAMES[slug]) return KNOWN_DISPLAY_NAMES[slug];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---- Task 1: Milestone nudges ----------------------------------------------

/**
 * Scans all pre-unlock neighborhoods and sends AI-generated nudge notifications
 * when a member count crosses an activation milestone.
 *
 * WHY we track last_member_count_seen: to detect milestone crossings between
 * runs. If a neighborhood was at 2 members yesterday and is at 5 today, it
 * crossed milestones 3 and 5. We only notify for the HIGHEST newly-crossed
 * milestone to avoid notification spam.
 *
 * WHY we skip bootstrapped neighborhoods: they are already unlocked (e.g.
 * "hsr-layout" for launch). No activation nudges needed.
 */
async function runMilestoneNudges(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<{ nudges: number; fcAwarded: number }> {
  // Fetch all neighborhoods with their current member counts
  const { data: statsRows, error: statsErr } = await supabase
    .from("neighborhood_stats")
    .select("neighborhood, member_count, is_unlocked, is_bootstrapped, last_member_count_seen");

  if (statsErr) {
    console.error(`${LOG_PREFIX} Milestone: stats query error:`, statsErr);
    return { nudges: 0, fcAwarded: 0 };
  }

  if (!statsRows || statsRows.length === 0) {
    console.log(`${LOG_PREFIX} Milestone: no neighborhoods in stats table`);
    return { nudges: 0, fcAwarded: 0 };
  }

  let totalNudges = 0;
  let totalFcAwarded = 0;

  for (const row of statsRows as NeighborhoodRow[]) {
    // Skip already-unlocked and bootstrapped neighborhoods
    if (row.is_unlocked || row.is_bootstrapped) continue;

    const currentCount = row.member_count || 0;
    const lastSeen = row.last_member_count_seen ?? 0;

    // Find the highest milestone that was crossed since last run
    // WHY highest only: if count jumped from 2→7, sending notifications for
    // milestones 3, 5, AND 7 would spam users. The "7 members — almost there!"
    // message subsumes the earlier ones.
    const newlyCrossed = ACTIVATION_MILESTONES.filter(
      (m) => currentCount >= m && lastSeen < m,
    );

    if (newlyCrossed.length === 0) {
      // Update last_member_count_seen even with no milestone crossing,
      // so next run has accurate baseline
      await supabase
        .from("neighborhood_stats")
        .update({ last_member_count_seen: currentCount })
        .eq("neighborhood", row.neighborhood);
      continue;
    }

    const highestMilestone = Math.max(...newlyCrossed);
    const remaining = UNLOCK_THRESHOLD - currentCount;
    const progressPercent = Math.round((currentCount / UNLOCK_THRESHOLD) * 100);
    const neighborhoodDisplay = displayNeighborhood(row.neighborhood);

    // Get all members in this neighborhood for notification delivery
    const { data: members } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("neighborhood", row.neighborhood);

    if (!members || members.length === 0) continue;

    // Generate or retrieve cached nudge message
    const milestoneKey = `milestone_${highestMilestone}`;
    const cachedText = await tryTemplateGraduation(
      supabase,
      "neighborhood_milestone",
      milestoneKey,
      neighborhoodDisplay,
    );

    let messageText: string;

    if (cachedText) {
      messageText = cachedText;
      await logAiUsage(supabase, "neighborhood_milestone", 0, 0, "template_cache");
    } else {
      const systemPrompt = `You are a community manager for DanaDone, a social coworking platform where solo workers meet at cafes. Write a short, energizing notification message (2-3 sentences) about a neighborhood's progress toward unlocking coworking sessions. Be specific about the numbers. Create urgency without being pushy. Do not use placeholder brackets. Do not include a subject line — just the message body.`;

      const userPrompt = `Neighborhood: ${neighborhoodDisplay}
Current members: ${currentCount}
Milestone just crossed: ${highestMilestone} out of ${UNLOCK_THRESHOLD} needed
Remaining to unlock: ${remaining}
Progress: ${progressPercent}%

Context for tone:
- At 3 members (30%): Emphasize pioneering spirit, social proof that others are joining
- At 5 members (50%): Emphasize momentum, halfway celebration
- At 7 members (70%): Emphasize urgency, "almost there" energy
- At 9 members (90%): Maximum urgency, "just ONE more person" FOMO

Write a notification message for the ${highestMilestone}-member milestone.`;

      const result = await callClaude(apiKey, systemPrompt, userPrompt);
      if (!result) {
        // Fallback to a static message if Claude fails
        messageText = getFallbackMilestoneMessage(
          highestMilestone,
          neighborhoodDisplay,
          currentCount,
          remaining,
        );
        await logAiUsage(supabase, "neighborhood_milestone", 0, 0, "template_cache");
      } else {
        messageText = result.text;
        await storeTemplate(
          supabase,
          "neighborhood_milestone",
          milestoneKey,
          result.text,
          neighborhoodDisplay,
        );
        await logAiUsage(
          supabase,
          "neighborhood_milestone",
          result.inputTokens,
          result.outputTokens,
        );
      }
    }

    // Build title based on milestone level for notification subject
    const title = getMilestoneTitle(highestMilestone, neighborhoodDisplay);

    // Batch-insert notifications for all members in this neighborhood
    const notifications = members.map(
      (m: { id: string; display_name: string | null }) => ({
        user_id: m.id,
        type: "neighborhood_activation",
        title,
        body: messageText,
        link: `/neighborhood/${row.neighborhood}`,
      }),
    );

    const { error: insertErr } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertErr) {
      console.error(
        `${LOG_PREFIX} Milestone: notification insert error for ${row.neighborhood}:`,
        insertErr,
      );
    } else {
      totalNudges += members.length;
    }

    // Batch-insert notification_log entries for dedup tracking
    const logEntries = members.map(
      (m: { id: string; display_name: string | null }) => ({
        user_id: m.id,
        channel: "in_app",
        category: "neighborhood_milestone",
        title,
        body: messageText,
        status: "sent",
        metadata: {
          neighborhood: row.neighborhood,
          milestone: highestMilestone,
          member_count: currentCount,
          progress_percent: progressPercent,
          ai_generated: !cachedText,
          template_cached: !!cachedText,
        },
      }),
    );

    await supabase.from("notification_log").insert(logEntries);

    // Update last_member_count_seen so next run knows the baseline
    await supabase
      .from("neighborhood_stats")
      .update({ last_member_count_seen: currentCount })
      .eq("neighborhood", row.neighborhood);

    console.log(
      `${LOG_PREFIX} Milestone: ${neighborhoodDisplay} crossed ${highestMilestone}-member milestone (${currentCount}/${UNLOCK_THRESHOLD}), notified ${members.length} members`,
    );
  }

  return { nudges: totalNudges, fcAwarded: totalFcAwarded };
}

/**
 * Returns a milestone-appropriate notification title.
 * WHY separate function: titles appear in notification lists and should be
 * scannable at a glance without reading the body.
 */
function getMilestoneTitle(milestone: number, neighborhood: string): string {
  switch (milestone) {
    case 3:
      return `${neighborhood} is growing!`;
    case 5:
      return `${neighborhood} is halfway to unlocking!`;
    case 7:
      return `${neighborhood} is almost unlocked!`;
    case 9:
      return `ONE MORE PERSON to unlock ${neighborhood}!`;
    default:
      return `${neighborhood} activation update`;
  }
}

/**
 * Static fallback messages when Claude is unavailable.
 * WHY: we should never silently fail to notify on a milestone crossing.
 * A decent static message is better than no message at all.
 */
function getFallbackMilestoneMessage(
  milestone: number,
  neighborhood: string,
  count: number,
  remaining: number,
): string {
  switch (milestone) {
    case 3:
      return `Your coworking scene is starting! ${neighborhood} has ${count} pioneers. Invite ${remaining} more to unlock live sessions.`;
    case 5:
      return `Halfway there! ${neighborhood} has ${count} members and the energy is building. ${remaining} more to go.`;
    case 7:
      return `Almost unlocked! ${neighborhood} is just ${remaining} members away from live coworking sessions. Spread the word!`;
    case 9:
      return `ONE MORE PERSON! ${neighborhood} is on the edge of unlocking. Share your invite link and make it happen!`;
    default:
      return `${neighborhood} now has ${count} members. ${remaining} more to unlock coworking sessions!`;
  }
}

// ---- Task 2: Ambassador nudges ---------------------------------------------

/**
 * For each pre-unlock neighborhood, finds the member with the most referrals
 * and sends them a personalized "ambassador" nudge encouraging continued inviting.
 *
 * WHY "power inviters": referral data shows a power law — a small number of
 * users drive the majority of invites. Rewarding and encouraging these people
 * is the highest-leverage growth action. A single ambassador nudge costs
 * ~$0.001 but can trigger 2-3 more invites.
 *
 * WHY dedup with notification_log: we check for recent ambassador nudges in the
 * last 7 days to avoid pestering the same person daily.
 */
async function runAmbassadorNudges(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<number> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Get all pre-unlock, non-bootstrapped neighborhoods
  const { data: preUnlock, error: statsErr } = await supabase
    .from("neighborhood_stats")
    .select("neighborhood, member_count")
    .eq("is_unlocked", false)
    .eq("is_bootstrapped", false);

  if (statsErr || !preUnlock || preUnlock.length === 0) {
    console.log(`${LOG_PREFIX} Ambassador: no pre-unlock neighborhoods found`);
    return 0;
  }

  let nudgesSent = 0;

  for (const ns of preUnlock) {
    const neighborhoodDisplay = displayNeighborhood(ns.neighborhood);
    const remaining = UNLOCK_THRESHOLD - (ns.member_count || 0);

    // Find members in this neighborhood
    const { data: members } = await supabase
      .from("profiles")
      .select("id, display_name, referral_code")
      .eq("neighborhood", ns.neighborhood);

    if (!members || members.length === 0) continue;

    const memberIds = members.map((m: MemberProfile) => m.id);

    // Find the top referrer among these members by counting referred_by
    // WHY we query profiles.referred_by: each member who was referred has
    // referred_by set to the referrer's profile id
    const { data: referrals } = await supabase
      .from("profiles")
      .select("referred_by")
      .eq("neighborhood", ns.neighborhood)
      .not("referred_by", "is", null);

    if (!referrals || referrals.length === 0) continue;

    // Count referrals per referrer
    const referralCounts: Record<string, number> = {};
    for (const r of referrals) {
      const refId = r.referred_by as string;
      // Only count referrers who are themselves in this neighborhood
      if (memberIds.includes(refId)) {
        referralCounts[refId] = (referralCounts[refId] || 0) + 1;
      }
    }

    if (Object.keys(referralCounts).length === 0) continue;

    // Find the top referrer
    const topReferrerId = Object.entries(referralCounts).sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    const topReferralCount = referralCounts[topReferrerId];

    // Check if this person was already nudged in the last 7 days
    const { data: recentNudges } = await supabase
      .from("notification_log")
      .select("id")
      .eq("user_id", topReferrerId)
      .eq("category", "neighborhood_ambassador")
      .gte("created_at", sevenDaysAgo)
      .limit(1);

    if (recentNudges && recentNudges.length > 0) continue;

    // Get the referrer's profile for personalization
    const topReferrer = members.find(
      (m: MemberProfile) => m.id === topReferrerId,
    );
    if (!topReferrer) continue;

    const referrerName = topReferrer.display_name || "Community Builder";

    // Generate personalized ambassador nudge
    const systemPrompt = `You are a community manager for DanaDone, a social coworking platform. Write a short, appreciative message (2-3 sentences) to a member who has been actively inviting people to their neighborhood. Acknowledge their effort specifically. Encourage them to keep going with a concrete ask. Do not use placeholder brackets. Do not include a subject line.`;

    const userPrompt = `Ambassador: ${referrerName}
Neighborhood: ${neighborhoodDisplay}
Referrals they've made: ${topReferralCount}
Current neighborhood members: ${ns.member_count || 0}
Members needed to unlock: ${remaining}

Write a personalized ambassador appreciation nudge.`;

    let messageText: string;

    const result = await callClaude(apiKey, systemPrompt, userPrompt);
    if (!result) {
      // Fallback static message
      messageText = `Thanks for being ${neighborhoodDisplay}'s top recruiter, ${referrerName}! Your ${topReferralCount} invites are making a real difference. Just ${remaining} more members and coworking goes live in your area.`;
      await logAiUsage(supabase, "neighborhood_ambassador", 0, 0, "template_cache");
    } else {
      messageText = result.text;
      await logAiUsage(
        supabase,
        "neighborhood_ambassador",
        result.inputTokens,
        result.outputTokens,
      );
    }

    const title = `You're ${neighborhoodDisplay}'s top inviter!`;

    await supabase.from("notifications").insert({
      user_id: topReferrerId,
      type: "neighborhood_activation",
      title,
      body: messageText,
      link: `/neighborhood/${ns.neighborhood}`,
    });

    await supabase.from("notification_log").insert({
      user_id: topReferrerId,
      channel: "in_app",
      category: "neighborhood_ambassador",
      title,
      body: messageText,
      status: "sent",
      metadata: {
        neighborhood: ns.neighborhood,
        referral_count: topReferralCount,
        member_count: ns.member_count,
        remaining,
      },
    });

    nudgesSent++;
    console.log(
      `${LOG_PREFIX} Ambassador: nudged ${referrerName} in ${neighborhoodDisplay} (${topReferralCount} referrals)`,
    );
  }

  console.log(`${LOG_PREFIX} Ambassador: sent ${nudgesSent} nudges`);
  return nudgesSent;
}

// ---- Task 3: Unlock celebrations -------------------------------------------

/**
 * Handles neighborhoods that have crossed the unlock threshold.
 *
 * For each newly-unlocked neighborhood:
 *   1. Sends "DoneDanaDone!" celebration notification to ALL members
 *   2. Awards pioneer bonus FC (20) to every existing member
 *   3. Awards unlock trigger bonus FC (50) to the member whose referral
 *      most recently caused the threshold to be met
 *   4. Marks the neighborhood as unlocked in neighborhood_stats
 *
 * WHY we check member_count >= threshold AND is_unlocked = false: this catches
 * neighborhoods that crossed the threshold since the last run of
 * update_neighborhood_stats(). The SQL function may not have fired yet if no
 * profile update triggered it, so we handle it here as a sweep.
 *
 * WHY "DoneDanaDone!": it's the branded celebration expression (see MEMORY.md).
 * Creates an emotional peak moment that users share — the unlock is the
 * single most shareable event in the neighborhood growth loop.
 */
async function runUnlockCelebrations(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<{ unlocks: number; fcAwarded: number }> {
  // Find neighborhoods that should be unlocked but aren't yet
  const { data: readyToUnlock, error: statsErr } = await supabase
    .from("neighborhood_stats")
    .select("neighborhood, member_count")
    .eq("is_unlocked", false)
    .eq("is_bootstrapped", false)
    .gte("member_count", UNLOCK_THRESHOLD);

  if (statsErr || !readyToUnlock || readyToUnlock.length === 0) {
    console.log(`${LOG_PREFIX} Unlock: no neighborhoods ready to unlock`);
    return { unlocks: 0, fcAwarded: 0 };
  }

  let totalUnlocks = 0;
  let totalFcAwarded = 0;

  for (const ns of readyToUnlock) {
    const neighborhoodDisplay = displayNeighborhood(ns.neighborhood);

    // Mark as unlocked FIRST to prevent duplicate processing on retry
    const { error: updateErr } = await supabase
      .from("neighborhood_stats")
      .update({
        is_unlocked: true,
        unlocked_at: new Date().toISOString(),
        last_member_count_seen: ns.member_count,
      })
      .eq("neighborhood", ns.neighborhood);

    if (updateErr) {
      console.error(
        `${LOG_PREFIX} Unlock: failed to mark ${ns.neighborhood} as unlocked:`,
        updateErr,
      );
      continue;
    }

    // Get all members in this neighborhood
    const { data: members } = await supabase
      .from("profiles")
      .select("id, display_name, referred_by, created_at")
      .eq("neighborhood", ns.neighborhood);

    if (!members || members.length === 0) continue;

    // Generate celebration message
    const systemPrompt = `You are the community manager for DanaDone, a social coworking platform. Write a short, jubilant celebration message (2-3 sentences) for a neighborhood that just unlocked coworking sessions. Start with "DoneDanaDone!" (the brand's celebration catchphrase). Mention that live sessions are now available. Create excitement about what's next. Do not use placeholder brackets. Do not include a subject line.`;

    const userPrompt = `Neighborhood: ${neighborhoodDisplay}
Total members: ${ns.member_count}
Threshold reached: ${UNLOCK_THRESHOLD}

Write a celebration notification for the neighborhood unlock.`;

    let celebrationText: string;

    const result = await callClaude(apiKey, systemPrompt, userPrompt);
    if (!result) {
      celebrationText = `DoneDanaDone! Coworking is now LIVE in ${neighborhoodDisplay}! With ${ns.member_count} members strong, your neighborhood has unlocked real coworking sessions at partner cafes. Time to book your first session!`;
      await logAiUsage(supabase, "neighborhood_unlock", 0, 0, "template_cache");
    } else {
      celebrationText = result.text;
      await logAiUsage(
        supabase,
        "neighborhood_unlock",
        result.inputTokens,
        result.outputTokens,
      );
    }

    const title = `DoneDanaDone! ${neighborhoodDisplay} is LIVE!`;

    // Batch-insert celebration notifications to all members
    const notifications = members.map(
      (m: { id: string }) => ({
        user_id: m.id,
        type: "neighborhood_activation",
        title,
        body: celebrationText,
        link: `/discover`,
      }),
    );

    await supabase.from("notifications").insert(notifications);

    // Batch-insert notification_log entries
    const logEntries = members.map(
      (m: { id: string }) => ({
        user_id: m.id,
        channel: "in_app",
        category: "neighborhood_unlock",
        title,
        body: celebrationText,
        status: "sent",
        metadata: {
          neighborhood: ns.neighborhood,
          member_count: ns.member_count,
        },
      }),
    );

    await supabase.from("notification_log").insert(logEntries);

    // Award pioneer bonus FC to ALL members in the neighborhood
    // WHY server_award_credits: this is a backend function with service_role access.
    // The server RPC handles cap enforcement, idempotency, and expiry.
    for (const member of members) {
      const idempotencyKey = `pioneer_${ns.neighborhood}_${member.id}`;
      await supabase.rpc("server_award_credits", {
        p_user_id: member.id,
        p_action: "welcome_bonus",
        p_amount: PIONEER_BONUS_FC,
        p_metadata: {
          neighborhood: ns.neighborhood,
          reason: "neighborhood_pioneer_bonus",
          idempotency_key: idempotencyKey,
        },
        p_idempotency_key: idempotencyKey,
      });
      totalFcAwarded += PIONEER_BONUS_FC;
    }

    // Find the unlock trigger — the most recently joined member
    // WHY most recent: the last person to join is the one whose presence
    // tipped the count over the threshold. They get extra recognition.
    const sortedByRecency = [...members].sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const triggerMember = sortedByRecency[0] as MemberProfile;

    if (triggerMember) {
      const triggerIdempotencyKey = `unlock_trigger_${ns.neighborhood}_${triggerMember.id}`;
      await supabase.rpc("server_award_credits", {
        p_user_id: triggerMember.id,
        p_action: "welcome_bonus",
        p_amount: UNLOCK_TRIGGER_BONUS_FC,
        p_metadata: {
          neighborhood: ns.neighborhood,
          reason: "neighborhood_unlock_trigger_bonus",
          idempotency_key: triggerIdempotencyKey,
        },
        p_idempotency_key: triggerIdempotencyKey,
      });
      totalFcAwarded += UNLOCK_TRIGGER_BONUS_FC;

      // Send a special notification to the unlock trigger member
      const triggerName = triggerMember.display_name || "Pioneer";
      const triggerTitle = `You unlocked ${neighborhoodDisplay}!`;
      const triggerBody = `DoneDanaDone! ${triggerName}, you were the person who made coworking happen in ${neighborhoodDisplay}. You've earned ${UNLOCK_TRIGGER_BONUS_FC} bonus Focus Credits as the one who tipped the scales!`;

      await supabase.from("notifications").insert({
        user_id: triggerMember.id,
        type: "neighborhood_activation",
        title: triggerTitle,
        body: triggerBody,
        link: "/discover",
      });

      await supabase.from("notification_log").insert({
        user_id: triggerMember.id,
        channel: "in_app",
        category: "neighborhood_unlock_trigger",
        title: triggerTitle,
        body: triggerBody,
        status: "sent",
        metadata: {
          neighborhood: ns.neighborhood,
          trigger_bonus_fc: UNLOCK_TRIGGER_BONUS_FC,
          pioneer_bonus_fc: PIONEER_BONUS_FC,
        },
      });

      console.log(
        `${LOG_PREFIX} Unlock: ${triggerName} triggered unlock of ${neighborhoodDisplay}, awarded ${UNLOCK_TRIGGER_BONUS_FC} bonus FC`,
      );
    }

    totalUnlocks++;
    console.log(
      `${LOG_PREFIX} Unlock: ${neighborhoodDisplay} UNLOCKED! ${members.length} members notified, ${totalFcAwarded} FC awarded`,
    );
  }

  return { unlocks: totalUnlocks, fcAwarded: totalFcAwarded };
}

// ---- Main handler ----------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
    if (!apiKey) {
      console.error(`${LOG_PREFIX} ANTHROPIC_API_KEY not configured`);
      // Continue anyway — we have static fallback messages for all tasks
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // First, refresh neighborhood member counts from profiles
    // WHY: the update_neighborhood_stats() trigger fires on profile changes,
    // but it may miss bulk imports or edge cases. This sweep ensures counts
    // are accurate before we check milestones.
    await refreshNeighborhoodCounts(supabase);

    // Parse requested action; default to running all tasks
    let action = "all";
    try {
      const body = await req.json();
      if (body?.action) {
        action = body.action;
      }
    } catch {
      // No body or invalid JSON — run all tasks
    }

    const counts: TaskCounts = {
      milestone_nudges: 0,
      ambassador_nudges: 0,
      unlocks: 0,
      fc_awarded: 0,
    };

    // Run unlock celebrations FIRST so milestone nudges don't fire for
    // neighborhoods that are about to unlock in the same run
    if (action === "unlocks" || action === "all") {
      const unlockResult = await runUnlockCelebrations(supabase, apiKey);
      counts.unlocks = unlockResult.unlocks;
      counts.fc_awarded += unlockResult.fcAwarded;
    }

    if (action === "milestones" || action === "all") {
      const milestoneResult = await runMilestoneNudges(supabase, apiKey);
      counts.milestone_nudges = milestoneResult.nudges;
      counts.fc_awarded += milestoneResult.fcAwarded;
    }

    if (action === "ambassadors" || action === "all") {
      counts.ambassador_nudges = await runAmbassadorNudges(supabase, apiKey);
    }

    console.log(`${LOG_PREFIX} Complete:`, JSON.stringify(counts));

    return new Response(JSON.stringify(counts), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} Error:`, err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// ---- Count refresh helper --------------------------------------------------

/**
 * Refreshes member counts in neighborhood_stats from profiles table.
 *
 * WHY: the update_neighborhood_stats() SQL trigger fires on individual profile
 * changes, but may miss cases like:
 *   - Bulk profile imports
 *   - Manual DB edits
 *   - Race conditions where multiple signups happen between trigger executions
 *
 * This sweep runs once at the start of each cron execution to ensure milestone
 * detection works against accurate numbers. It also discovers new neighborhoods
 * that don't have a neighborhood_stats row yet.
 */
async function refreshNeighborhoodCounts(
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // Get distinct neighborhoods and their member counts from profiles
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("neighborhood")
    .not("neighborhood", "is", null)
    .not("neighborhood", "eq", "");

  if (profileErr || !profiles) {
    console.error(`${LOG_PREFIX} Refresh: profile query error:`, profileErr);
    return;
  }

  // Count members per neighborhood
  const counts: Record<string, number> = {};
  for (const p of profiles) {
    const hood = p.neighborhood as string;
    counts[hood] = (counts[hood] || 0) + 1;
  }

  // Upsert each neighborhood's count
  for (const [neighborhood, memberCount] of Object.entries(counts)) {
    const { data: existing } = await supabase
      .from("neighborhood_stats")
      .select("neighborhood, member_count, last_member_count_seen")
      .eq("neighborhood", neighborhood)
      .maybeSingle();

    if (existing) {
      // Only update member_count, preserve other fields
      await supabase
        .from("neighborhood_stats")
        .update({
          member_count: memberCount,
          last_updated: new Date().toISOString(),
        })
        .eq("neighborhood", neighborhood);
    } else {
      // New neighborhood discovered — insert with last_member_count_seen = 0
      // so the first milestone crossing is detected on the next run
      await supabase.from("neighborhood_stats").insert({
        neighborhood,
        member_count: memberCount,
        active_venues: 0,
        is_unlocked: false,
        last_member_count_seen: 0,
        last_updated: new Date().toISOString(),
      });

      console.log(
        `${LOG_PREFIX} Refresh: discovered new neighborhood "${neighborhood}" with ${memberCount} members`,
      );
    }
  }

  console.log(
    `${LOG_PREFIX} Refresh: updated counts for ${Object.keys(counts).length} neighborhoods`,
  );
}
