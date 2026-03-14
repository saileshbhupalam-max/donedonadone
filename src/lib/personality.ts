/**
 * @module personality
 * @description donedonadone brand voice and UI copy library. "The poet in the machine."
 * All user-facing text should come from this file to maintain consistent brand voice.
 * Covers: loading states, empty states, error messages, confirmations, contextual greetings,
 * celebrations, notifications, onboarding conversation, community language mappings, and page titles.
 *
 * Key exports:
 * - getContextualGreeting() — Time-of-day + context-aware greeting (first visit, returning, day of week, streak)
 * - EMPTY_STATES / ERROR_STATES / CONFIRMATIONS — Branded copy for all UI states
 * - LOADING_MESSAGES / REFRESH_MESSAGES — Rotating witty messages
 * - NOTIFICATION_COPY — Templates for all notification types
 * - ONBOARDING — Full onboarding conversation flow text
 * - COMMUNITY_LANG — Terminology mappings ("session" not "event", "table" not "group")
 * - PAGE_TITLES — Document titles per route
 * - getGenderBalanceIndicator() — Group gender balance label
 *
 * Dependencies: None (pure data + functions)
 * Related: PersonalityContext.tsx (React context wrapper), all UI components (consume copy)
 */
// ─── donedonadone Platform Personality ──────────────────────
// The poet in the machine. Rumi meets Seinfeld meets your coolest friend.

// ─── Loading States (rotate randomly) ──────────────────
export const LOADING_MESSAGES = [
  "Patience, grasshopper...",
  "Good things take a sec.",
  "Shuffling humans...",
  "Hold tight. Magic in progress.",
  "Sip your coffee. We're almost done.",
  "Finding folks who match your frequency.",
  "The WiFi's fine. We're just thinking.",
];

export function getLoadingMessage(): string {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}

// ─── Empty States ──────────────────────────────────────
export const EMPTY_STATES = {
  noSessions: "No sessions near you yet. Request one — we'll match you when others want the same slot.",
  noMatches: "We need a bit more to find your people. Answer a prompt or attend a session.",
  noProps: "No props yet. Keep showing up — they'll notice.",
  noPromptAnswers: "Answer a prompt — your words help us find your people.",
  noBookmarks: "Nothing saved yet. Bookmark sessions you're interested in.",
  noNotifications: "You're all caught up.",
  noEventsAttended: "You haven't been to a session yet. Your first one is waiting.",
  profileIncomplete: "Members with complete profiles get better matches. Finish yours.",
  noSearchResults: (q: string) => `No one matched "${q}". Try different words — your people are here somewhere.`,
  noFilterResults: "No members found with these filters. Broaden the search — great people come in all vibes.",
};

// ─── Error States ──────────────────────────────────────
export const ERROR_STATES = {
  network: "The internet took a coffee break. Try again in a sec.",
  generic: "Well, that didn't go as planned. Neither did my morning. Try again?",
  notFound: "You've wandered off the map. Happens to the best of us.",
  notFoundPhilosophical: "You're lost. But you're not alone. We're all a little lost. — DoneDonaDone, accidentally philosophical",
  sessionFull: "Standing room only. This one's packed — but the next one has your name on it.",
  alreadyRsvpd: "You're already on the list. Relax. We remember.",
  pastEvent: "That ship has sailed, that session has sessioned. Let's find the next one.",
  uploadTooLarge: "That file is ambitious. Keep it under 5MB.",
  rateLimit: "Easy, tiger. One thing at a time.",
  permissionDenied: "Nice try. That door's locked.",
};

// ─── Confirmation Moments ──────────────────────────────
export const CONFIRMATIONS = {
  rsvpSuccess: (day: string, venue: string | null) =>
    `You're in.${day ? ` ${day}` : ""}${venue ? `, ${venue}` : ""}. We'll sort your table — you just show up.`,
  profileSaved: "Saved. You look good on paper. Even better in person.",
  promptAnswered: "Noted. Filed. Appreciated. Your words shape your matches.",
  feedbackSubmitted: "Honest feedback makes honest sessions. Thank you.",
  propsSent: "Delivered. You just made someone's day without even knowing it.",
  photoUploaded: "Framed. That one's going in the session scrapbook.",
  intentionSet: "Locked in. Now go make it happen. 🎯",
  onboardingComplete: "And just like that — you're one of us.",
  checkedIn: "You're in! Welcome to today's session. ☕",
  flagSubmitted: "Submitted privately. Thank you for keeping the community safe.",
  venueReviewed: "Thanks for rating! Your feedback helps everyone find great spots.",
  rsvpCancelled: "No worries, see you next time!",
  locationPrefsSaved: "Location locked in. We'll find sessions near you.",
  sessionPrefsSaved: "Session preferences saved. Your feed just got smarter.",
};

// ─── Contextual Greetings ──────────────────────────────
const MORNING = [
  (n: string) => `Rise and grind, ${n}. Your table awaits.`,
  (n: string) => `Morning, ${n}. Coffee's poured. World's unpaused. Let's go.`,
  (n: string) => `New day, new deep work. Same great you, ${n}.`,
  (n: string) => `${n}. Mornings like this were made for focus.`,
  (n: string) => `The early bird gets the... best seat at the cafe, ${n}.`,
];

const AFTERNOON = [
  (n: string) => `Afternoon, ${n}. The post-lunch slump is a myth. Prove it.`,
  (n: string) => `Still going, ${n}? Respect.`,
  (n: string) => `The afternoon belongs to the persistent. That's you, ${n}.`,
  (n: string) => `${n}. Coffee number two? No judgment.`,
  (n: string) => `Halfway through the day, ${n}. Fully through the noise.`,
];

const EVENING = [
  (n: string) => `Evening, ${n}. You showed up today. That counts.`,
  (n: string) => `${n}, winding down? Or just getting started?`,
  (n: string) => `The day's done but the week's young, ${n}.`,
  (n: string) => `Sunset mode, ${n}. Reflect, recharge, repeat.`,
];

const NIGHT = [
  (n: string) => `Burning midnight oil, ${n}? We see you.`,
  (n: string) => `${n}. Night owls write the best code. And the worst emails.`,
  (n: string) => `The city sleeps. You don't. Respect, ${n}.`,
  (n: string) => `Late night, ${n}. Tomorrow-you will thank tonight-you.`,
];

interface GreetingContext {
  firstName: string;
  isFirstVisit?: boolean;
  afterFirstSession?: boolean;
  isMonday?: boolean;
  isFriday?: boolean;
  daysSinceActive?: number;
  attendedYesterday?: boolean;
  yesterdayVenue?: string | null;
  yesterdayPeopleCount?: number;
  streak?: number;
  monthsAsMember?: number;
}

export function getContextualGreeting(ctx: GreetingContext): string {
  const n = ctx.firstName || "friend";

  // Special overrides (priority order)
  if (ctx.isFirstVisit) return `Welcome to donedonadone, ${n}. You just walked into the best room you didn't know existed.`;
  if (ctx.afterFirstSession) return `${n}. First session done. You're not new anymore — you're one of us.`;
  if (ctx.daysSinceActive && ctx.daysSinceActive >= 7) return `Look who's back. We kept your seat warm, ${n}.`;
  if (ctx.attendedYesterday) {
    const extra = ctx.yesterdayVenue ? ` ${ctx.yesterdayVenue}.` : ".";
    return `Yesterday was something, ${n}.${ctx.yesterdayPeopleCount ? ` ${ctx.yesterdayPeopleCount} people.` : ""}${extra} You were there.`;
  }
  if (ctx.isMonday) return `Monday, ${n}. Fresh slate. Clean desk energy. Let's make it count.`;
  if (ctx.isFriday) return `Friday, ${n}. One more push and then the weekend does its thing.`;

  // Time-based
  const hour = new Date().getHours();
  let pool: Array<(n: string) => string>;
  if (hour >= 5 && hour < 12) pool = MORNING;
  else if (hour >= 12 && hour < 17) pool = AFTERNOON;
  else if (hour >= 17 && hour < 21) pool = EVENING;
  else pool = NIGHT;

  return pool[Math.floor(Math.random() * pool.length)](n);
}

// ─── Celebration Copy ──────────────────────────────────
export const CELEBRATIONS = {
  firstSession: "First one done. That's the hardest part — and you nailed it.",
  firstSessionSub: "You showed up. Most people just think about it.",
  streak3: "Three for three. A habit is born.",
  streak5: "Five straight. You don't just show up — you show up.",
  streak10: "Ten sessions. Most people talk about productivity. You just do it.",
  streak25: "Twenty-five. At this point, the cafe knows your order.",
  rankUp: "New rank unlocked. You earned it with hours, not hype.",
  propsReceived: (name: string) => `${name} sees you. That's what this is about.`,
  focusHours100: "One hundred hours of deep work. That's not a number — that's a portfolio.",
};

// ─── Pull-to-Refresh Messages ──────────────────────────
export const REFRESH_MESSAGES = [
  "Refreshing your destiny...",
  "Pulling the cosmic strings...",
  "New content in 3... 2... 1...",
  "Asking the universe for updates...",
  "Shaking the magic 8-ball...",
];

export function getRefreshMessage(): string {
  return REFRESH_MESSAGES[Math.floor(Math.random() * REFRESH_MESSAGES.length)];
}

// ─── Notification Personality ──────────────────────────
export const NOTIFICATION_COPY = {
  eventAvailable: (title: string, venue: string | null, day: string) =>
    `New session dropped. ${title}${venue ? ` · ${venue}` : ""} · ${day}. Spots won't last.`,
  groupAssigned: (names: string[], venue: string | null, day: string) =>
    `Your table's set. ${names.join(", ")} at ${venue || "the venue"}. ${day}.`,
  propsReceived: (name: string, propType: string) =>
    `${name} just propped you. Apparently you're ${propType}. We agree.`,
  newPrompt: (question: string) =>
    `This week's question will make you think: "${question}" — go.`,
  eventReminderDay: (venue: string | null, time: string | null) =>
    `Tomorrow. ${venue || "Your session"}. ${time || "Check the time"}. Your table's waiting.`,
  eventReminder1hr: (venue: string | null) =>
    `One hour. ${venue || "Your session"}. Your people are heading there now.`,
  feedbackRequest: "How was it? Quick honest take — helps us make the next one better.",
  streakAtRisk: (streak: number) =>
    `Your ${streak}-session streak called. It misses you. Show up this week.`,
  welcomeBack: (sessionCount: number, day: string) =>
    `There you are. ${sessionCount} sessions happened while you were gone. Next one's on ${day}.`,
  referralJoined: (name: string) =>
    `${name} just joined through your link. Your taste in people? Impeccable.`,
  newMemberNearby: (name: string, neighborhood: string) =>
    `${name} just joined from ${neighborhood}. Fresh face at the next session.`,
};

// ─── Onboarding Conversation ──────────────────────────
export const ONBOARDING = {
  welcome: {
    headline: "donedonadone. Where strangers become\ncoworkers become friends.",
    subline: "We match you with 3-5 people at great cafes. You focus. You connect. You come back.",
    button: "Sounds like my kind of thing",
  },
  step1: {
    title: "First things first. What do people call you?",
    placeholder: "The name your friends use",
    afterEntry: (name: string) => `Nice to meet you, ${name}. Genuinely.`,
  },
  step2Gender: {
    title: "One quick thing —",
    subtitle: "This helps us build balanced tables. Diverse groups have better conversations. Science, not opinion.",
    afterSelect: "Got it.",
  },
  step3Photo: {
    title: "Show us your face.",
    subtitle: "People connect faster when they can picture you. Coffee stains on shirt optional.",
    skip: "I'm camera-shy. Later.",
  },
  step4Work: {
    title: "What's your deal?",
    afterSelect: (vibe: string) => {
      const map: Record<string, string> = {
        deep_focus: "Deep Focus. We've got a bunch of those. You'll fit right in.",
        casual_social: "Casual Social. We've got a bunch of those. You'll fit right in.",
        balanced: "Balanced. We've got a bunch of those. You'll fit right in.",
      };
      return map[vibe] || "Good taste.";
    },
  },
  step5Vibe: {
    title: "How do you like to work?",
    options: {
      deep_focus: { label: "Deep Focus", desc: "Headphones on. World off." },
      casual_social: { label: "Casual Social", desc: "Work a bit. Chat a bit. Live a bit." },
      balanced: { label: "Balanced", desc: "Best of both. You're versatile." },
    },
    afterSelect: "Good taste.",
  },
  step6Noise: {
    title: "Your ideal volume?",
    options: {
      silent: "Library energy",
      low_hum: "Cafe hum",
      dont_care: "Bring the buzz",
    },
    afterSelect: "Noted. We'll seat you accordingly.",
  },
  step7Interests: {
    title: "What gets you talking?",
    subtitle: "Pick a few. These help us match you with people you'll actually click with.",
  },
  completion: {
    title: (name: string) => `${name}, you're officially in.`,
    lines: [
      "1. We find sessions at great cafes near you.",
      "2. We match you with people who work like you.",
      "3. You show up. That's literally it.",
    ],
    button: "Find my first session",
  },
};

// ─── Community Language ──────────────────────────────
// Use these mappings everywhere in user-facing copy
export const COMMUNITY_LANG = {
  event: "session",
  events: "sessions",
  group: "table",
  groups: "tables",
  attending: "showing up",
  attended: "showed up",
  activeMembers: "regulars",
  user: "member",
  users: "members",
  streak: "on a roll", // but keep 🔥 counter
  platform: "the club",
  app: "the club",
};

// ─── Page Titles ──────────────────────────────────────
export const PAGE_TITLES = {
  home: "Home — DoneDonaDone",
  discover: "Find Your People — DoneDonaDone",
  events: "Sessions — DoneDonaDone",
  prompts: "The Question — DoneDonaDone",
  profile: "You — DoneDonaDone",
  admin: "Mission Control — DoneDonaDone",
  session: "Session — DoneDonaDone",
};

// ─── Gender-Balanced Group Indicator ──────────────────
interface Attendee {
  id: string;
  gender: string | null;
}

export function getGenderBalanceIndicator(attendees: Attendee[]): { label: string; balanced: boolean } {
  if (attendees.length < 2) return { label: "", balanced: true };
  
  const women = attendees.filter(a => a.gender === "woman" || a.gender === "female").length;
  const men = attendees.filter(a => a.gender === "man" || a.gender === "male").length;
  const total = women + men;
  
  if (total === 0) return { label: "", balanced: true };
  
  const ratio = Math.min(women, men) / total;
  if (ratio >= 0.4) return { label: "👥 Balanced table", balanced: true };
  if (ratio < 0.3) return { label: "More voices welcome", balanced: false };
  return { label: "", balanced: true };
}
