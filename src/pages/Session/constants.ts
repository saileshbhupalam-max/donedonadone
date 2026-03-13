export const PHASE_EMOJIS: Record<string, string> = {
  icebreaker: "\u{1F44B}",
  deep_work: "\u{1F3AF}",
  mini_break: "\u2615",
  social_break: "\u{1F5E3}\uFE0F",
  wrap_up: "\u{1F389}",
};

export const STATUS_CONFIG = {
  red: { label: "Deep Focus", emoji: "\u{1F534}", ringClass: "ring-destructive" },
  amber: { label: "Open to Chat", emoji: "\u{1F7E1}", ringClass: "ring-[hsl(40,80%,55%)]" },
  green: { label: "Free", emoji: "\u{1F7E2}", ringClass: "ring-secondary" },
};
