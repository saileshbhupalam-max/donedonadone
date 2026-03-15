/**
 * @module sharing
 * @description Share message generators for events, prompts, badges, and profiles.
 * All messages include referral codes when available for viral growth tracking.
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
 * Key exports:
 * - getEventShareMessage() — Formatted event share text with date, venue, going count, and referral link
 * - getPromptShareMessage() — Share a prompt answer with truncated text
 * - getPromptInviteMessage() — Invite someone to answer a prompt
 * - getBadgeShareMessage() — Share a newly earned badge
 * - getProfileShareMessage() — Share own profile with referral link
 *
 * Dependencies: date-fns (format, parseISO)
 * Related: RsvpSharePrompt.tsx, PostEventShare.tsx, WhatsAppButton.tsx (UI components that use these generators)
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

export function getProfileShareMessage(displayName: string, profileId: string, referralCode?: string | null) {
  const link = getRefLink(`/profile/${profileId}`, referralCode);
  return `Hey! I'm on DanaDone — a community for people who cowork in Bangalore. Check out my profile and join: ${link}`;
}
