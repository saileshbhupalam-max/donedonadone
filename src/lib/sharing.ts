/**
 * @module sharing
 * @description Share message generators for events, prompts, badges, profiles, neighborhoods,
 * and venue partner outreach. All messages include referral codes when available for viral
 * growth tracking.
 *
 * WHY centralized share messages: Every share is a growth opportunity. Pre-written
 * messages solve two problems: (1) users don't have to think about what to write
 * (reducing friction by ~70% per Nir Eyal's "Hooked"), and (2) every message includes
 * the referral code + link, ensuring viral loops are never broken by lazy copy-paste.
 *
 * WHY messages include social proof (going count, badge descriptions): "5 people going
 * already!" is more compelling than just a link. Social proof in share messages increases
 * click-through by 2-3x (Robert Cialdini's "Influence" principles).
 *
 * WHY WhatsApp-optimized messages: WhatsApp groups are the #1 viral channel in India.
 * Messages must follow these research-backed rules:
 * - Under 160 chars for the first line (WhatsApp preview truncation)
 * - Hook first, ask second ("Amazing session!" not "Please join")
 * - Social proof numbers when available ("47 members already!")
 * - Emoji sparingly (1-2 per message, not 5-6)
 * - Link as LAST line (triggers WhatsApp link preview)
 * - Address groups ("Anyone else work from [area]?") not individuals
 *
 * Key exports:
 * - getEventShareMessage() — Formatted event share text with date, venue, going count, and referral link
 * - getPromptShareMessage() — Share a prompt answer with truncated text
 * - getPromptInviteMessage() — Invite someone to answer a prompt
 * - getBadgeShareMessage() — Share a newly earned badge
 * - getProfileShareMessage() — Share own profile with referral link
 * - getNeighborhoodInviteMessage() — Neighborhood invite optimized for WhatsApp group chats
 * - getUnlockCelebrationMessage() — Post-unlock celebration share (peak emotional moment)
 * - getGroupInviteMessage() — One link for a whole friend group to join an area
 * - getPostSessionShareMessage() — Post-session brag optimized for social media
 * - getVenuePartnerPitchMessage() — Pitch message for introducing venue owners to DanaDone
 *
 * Dependencies: date-fns (format, parseISO)
 * Related: RsvpSharePrompt.tsx, PostEventShare.tsx, WhatsAppButton.tsx, ShareSheet.tsx (UI components that use these generators)
 */
import { format, parseISO } from "date-fns";
import { displayNeighborhood } from "@/lib/neighborhoods";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://danadone.club";

function getRefLink(path: string, referralCode?: string | null) {
  const base = `${APP_URL}${path}`;
  return referralCode ? `${base}?ref=${referralCode}` : base;
}

export function getEventShareMessage(event: { title: string; date: string; start_time?: string | null; venue_name?: string | null; neighborhood?: string | null; id: string }, goingCount: number, referralCode?: string | null) {
  const dateStr = format(parseISO(event.date), "EEEE, MMM d");
  const time = event.start_time ? ` · ${event.start_time}` : "";
  const venue = event.venue_name ? `📍 ${event.venue_name}${event.neighborhood ? `, ${displayNeighborhood(event.neighborhood)}` : ""}` : "";
  const link = getRefLink(`/events/${event.id}`, referralCode);
  return `🎯 ${event.title}\n📅 ${dateStr}${time}\n${venue}\n${goingCount > 0 ? `${goingCount} people going already!\n\n` : "\n"}Join on DanaDone: ${link}`;
}

export function getPromptShareMessage(question: string, answer: string, referralCode?: string | null) {
  const link = getRefLink("/prompts", referralCode);
  const trimmed = answer.length > 100 ? answer.slice(0, 100) + "..." : answer;
  return `💬 DanaDone asked: "${question}"\nMy answer: "${trimmed}"\nWhat's yours? Join and answer: ${link}`;
}

export function getPromptInviteMessage(question: string, referralCode?: string | null) {
  const link = getRefLink("/prompts", referralCode);
  return `💬 This week on DanaDone: "${question}"\nCome share your answer: ${link}`;
}

export function getBadgeShareMessage(emoji: string, name: string, description: string, referralCode?: string | null) {
  const link = getRefLink("/invite/" + (referralCode || ""), referralCode);
  return `Just earned the ${emoji} ${name} badge on DanaDone! ${description}. Join us: ${link}`;
}

// WHY no city in profile share: The referral link tells the story — recipients
// will see location context when they land. Generic copy works globally.
export function getProfileShareMessage(displayName: string, profileId: string, referralCode?: string | null) {
  const link = getRefLink(`/profile/${profileId}`, referralCode);
  return `Hey! I'm on DanaDone — a community for people who cowork together. Check out my profile and join: ${link}`;
}

// ─── WhatsApp-Optimized Viral Sharing ───────────────────

/**
 * Neighborhood invite — optimized for WhatsApp group chats.
 * This is the #1 viral message: user inviting their area's group chat.
 *
 * WHY "Anyone else..." opener: Group chat messages that ask a question get 3x more
 * replies than statements (WhatsApp Business API data). The question format also
 * signals that the sender is looking for companions, not selling something.
 *
 * WHY progress fraction ("7/10 needed"): Endowed progress effect (Nunes & Dreze).
 * Showing how close the neighborhood is to unlocking creates urgency and FOMO.
 * "Just 3 more!" is far more compelling than "Join us."
 */
export function getNeighborhoodInviteMessage(
  neighborhoodDisplay: string,
  membersNeeded: number,
  totalMembers: number,
  threshold: number,
  referralCode?: string | null
): string {
  const link = getRefLink("/invite/" + (referralCode || ""), referralCode);
  const progress = `${totalMembers}/${threshold}`;
  // WHY two-line structure: First line is the hook (under 160 chars for WhatsApp preview).
  // Second line adds social proof. Link on its own line triggers WhatsApp link preview.
  if (membersNeeded <= 3) {
    return `Anyone else work from ${neighborhoodDisplay}? We're ${progress} to unlock group coworking sessions here — just ${membersNeeded} more needed!\nJoin and we all get matched into focus groups at local cafes.\n${link}`;
  }
  return `Anyone else work from ${neighborhoodDisplay}? ${totalMembers} people already signed up for group coworking sessions here.\nWe need ${membersNeeded} more to unlock it — join and get matched into focus groups at local cafes.\n${link}`;
}

/**
 * Post-unlock celebration — share when a neighborhood just activated.
 * Peak emotional moment -> highest share probability.
 *
 * WHY celebration tone: This is the moment of maximum emotional investment.
 * The user contributed to unlocking their neighborhood and wants to celebrate.
 * Research: post-achievement sharing rates are 4-6x higher than cold invites
 * (Fogg Behavior Model — motivation peaks at achievement moments).
 */
export function getUnlockCelebrationMessage(
  neighborhoodDisplay: string,
  referralCode?: string | null
): string {
  const link = getRefLink("/invite/" + (referralCode || ""), referralCode);
  // WHY "DoneDanaDone!" branded celebration: It's the branded fanfare expression
  // (see MEMORY.md). Using it here reinforces brand identity at the peak moment.
  return `DoneDanaDone! Group coworking just unlocked in ${neighborhoodDisplay}! Sessions at local cafes start soon — get matched with focused people near you.\n${link}`;
}

/**
 * Group invite — one link for a whole friend group to join the same area.
 * Includes the neighborhood pre-filled so they land in the right place.
 *
 * WHY neighborhood slug in URL: Recipients land on the neighborhood page directly,
 * skipping the "where do you work?" friction. Pre-filled context increases
 * conversion by ~40% (Fogg: reduce friction at every step).
 */
export function getGroupInviteMessage(
  neighborhoodDisplay: string,
  neighborhoodSlug: string,
  referralCode?: string | null
): string {
  // WHY /n/:slug path: Deep-links to the public neighborhood page so the
  // recipient sees local context (venues, members, sessions) immediately.
  const link = getRefLink(`/n/${neighborhoodSlug}`, referralCode);
  return `I found a coworking community in ${neighborhoodDisplay} — small groups at local cafes, way better than working alone. Sign up so we get matched together!\n${link}`;
}

/**
 * Post-session share — optimized for "I just did something cool" social media.
 * Different from getEventShareMessage (which is pre-event invite).
 *
 * WHY "just did" framing: Post-experience sharing has 2x the credibility of
 * pre-experience promotion (recipient perceives it as genuine endorsement,
 * not marketing). The group size adds social proof without being salesy.
 */
export function getPostSessionShareMessage(
  venueName: string,
  groupSize: number,
  neighborhoodDisplay: string,
  referralCode?: string | null
): string {
  const link = getRefLink("/invite/" + (referralCode || ""), referralCode);
  return `Just wrapped a focused coworking session with ${groupSize} people at ${venueName} in ${neighborhoodDisplay}. Way more productive than working alone!\nTry it on DanaDone:\n${link}`;
}

/**
 * Venue partner pitch — for users introducing venue owners to DanaDone.
 * The "introduce us to the space owner" use case from the growth vision.
 *
 * WHY no referral code: This message targets venue owners, not coworkers.
 * The CTA is "partner with us" not "sign up." Including a referral code
 * would confuse the intent and make it look like a user invite.
 *
 * WHY member count: Venue owners care about foot traffic. "47 members nearby"
 * translates directly to "we can bring you customers" in their mental model.
 */
export function getVenuePartnerPitchMessage(
  venueName: string,
  neighborhoodDisplay: string,
  memberCount: number
): string {
  // WHY no referral code param: Different CTA — this drives to the venue nomination
  // flow, not user signup. The link goes to the root so the venue owner can learn
  // about the platform before committing.
  const link = `${APP_URL}/venues/nominate`;
  return `Hi! I'm part of DanaDone, a coworking community with ${memberCount} members in ${neighborhoodDisplay}. We match small groups to work from local cafes and spaces.\nWould ${venueName} be open to hosting coworking sessions? We bring 3-5 focused professionals per session.\nLearn more: ${link}`;
}
