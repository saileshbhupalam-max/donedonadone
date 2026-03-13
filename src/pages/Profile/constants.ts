export const vibeOptions = [
  { value: "deep_focus", label: "Deep Focus", emoji: "🎯", desc: "Heads-down, get stuff done" },
  { value: "casual_social", label: "Casual Social", emoji: "☕", desc: "Here for vibes and conversation" },
  { value: "balanced", label: "Balanced", emoji: "⚖️", desc: "Depends on the day" },
];
export const genderOptions = [
  { value: "woman", label: "Woman" }, { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" }, { value: "prefer_not_to_say", label: "Prefer not to say" },
];
export const noiseOptions = [
  { value: "silent", emoji: "🤫", label: "Silent" },
  { value: "low_hum", emoji: "🎵", label: "Low Hum" },
  { value: "dont_care", emoji: "🤷", label: "Don't Care" },
];
export const commOptions = [
  { value: "minimal", emoji: "🧘", label: "Minimal" },
  { value: "moderate", emoji: "⚡", label: "Moderate" },
  { value: "chatty", emoji: "💬", label: "Chatty" },
];
export const neighborhoods = ["HSR Layout", "Koramangala", "Indiranagar", "BTM Layout", "JP Nagar", "Jayanagar", "Whitefield", "Electronic City", "Marathahalli", "Sarjapur Road", "Other"];
export const lookingSuggestions = ["co-founder", "accountability buddy", "clients", "friends", "mentorship", "design feedback", "tech help", "investment", "workout buddy", "coffee chats", "hiring", "networking"];
export const offerSuggestions = ["design help", "code reviews", "intro to investors", "marketing advice", "content writing", "career advice", "hiring help", "startup advice", "photography", "fitness tips", "legal advice", "fundraising help"];
export const interestSuggestions = ["startups", "design", "coding", "fitness", "reading", "gaming", "music", "photography", "travel", "food", "investing", "AI/ML", "crypto", "writing", "yoga", "running", "meditation", "cooking", "parenting", "books"];

export const VIBE_LABELS: Record<string, string> = { deep_focus: "🎯 Deep Focus", casual_social: "☕ Casual Social", balanced: "⚖️ Balanced" };
export const PROP_EMOJIS: Record<string, string> = { energy: "⚡", helpful: "🤝", focused: "🎯", inspiring: "💡", fun: "🎉", kind: "💛" };

export interface EarnedBadge { badge_type: string; earned_at: string | null; }
