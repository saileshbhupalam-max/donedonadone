import { describe, it, expect } from "vitest";
import { tryTemplateMatch, fillTemplate } from "@/lib/matchTemplates";
import type { MatchProfile, MatchTemplate } from "@/lib/matchTemplates";

// Templates sorted by priority desc (same as DB query)
const TEMPLATES: MatchTemplate[] = [
  { match_type: "complementary_skills", template: "{{user_name}} is looking for {{user_need}} — {{match_name}} can offer exactly that.", icebreaker_template: "Ask about their experience with {{match_skill}}", priority: 10, is_active: true },
  { match_type: "skill_swap", template: "{{user_name}} can help with {{user_skill}} and {{match_name}} brings {{match_skill}} — a natural skill swap.", icebreaker_template: "What skill are you most excited to learn?", priority: 9, is_active: true },
  { match_type: "same_industry", template: "You're both in {{industry}} — plenty of shared context.", icebreaker_template: "What's the most interesting problem in {{industry}}?", priority: 8, is_active: true },
  { match_type: "cross_industry", template: "Different industries, fresh perspectives.", icebreaker_template: "What does a typical workday look like in your field?", priority: 7, is_active: true },
  { match_type: "same_goals", template: "You're both here to {{goal}} — great accountability partners.", icebreaker_template: "Share what you're working on today", priority: 6, is_active: true },
  { match_type: "same_vibe", template: "You both thrive in {{vibe}} environments.", icebreaker_template: "Compare your favorite focus playlists", priority: 5, is_active: true },
  { match_type: "repeat_match", template: "You've worked together before — familiar faces.", icebreaker_template: "Catch up on what's changed", priority: 4, is_active: true },
  { match_type: "new_member", template: "{{match_name}} is new to DoneDonaDone — help them feel welcome!", icebreaker_template: "Share your favorite thing about coworking sessions", priority: 3, is_active: true },
];

const baseUser: MatchProfile = {
  display_name: "Alice",
  work_vibe: null,
  looking_for: null,
  can_offer: null,
  events_attended: 5,
};

const baseMatch: MatchProfile = {
  display_name: "Bob",
  work_vibe: null,
  looking_for: null,
  can_offer: null,
  events_attended: 10,
};

describe("fillTemplate", () => {
  it("replaces single placeholder", () => {
    expect(fillTemplate("Hello {{name}}", { name: "World" })).toBe("Hello World");
  });

  it("replaces multiple placeholders", () => {
    expect(fillTemplate("{{a}} and {{b}}", { a: "X", b: "Y" })).toBe("X and Y");
  });

  it("leaves placeholder key when no replacement found", () => {
    expect(fillTemplate("Hello {{missing}}", {})).toBe("Hello missing");
  });

  it("handles template with no placeholders", () => {
    expect(fillTemplate("No placeholders here", { a: "b" })).toBe("No placeholders here");
  });

  it("handles empty template", () => {
    expect(fillTemplate("", { a: "b" })).toBe("");
  });
});

describe("tryTemplateMatch", () => {
  describe("same_vibe", () => {
    it("matches when both have same work vibe", () => {
      const user = { ...baseUser, work_vibe: "deep_focus" };
      const match = { ...baseMatch, work_vibe: "deep_focus" };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("deep focus");
      expect(result!.score).toBe(65);
    });

    it("does not match when vibes differ", () => {
      const user = { ...baseUser, work_vibe: "deep_focus" };
      const match = { ...baseMatch, work_vibe: "casual_social" };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result).toBeNull();
    });

    it("uses human-readable vibe labels", () => {
      const user = { ...baseUser, work_vibe: "casual_social" };
      const match = { ...baseMatch, work_vibe: "casual_social" };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result!.explanation).toContain("social");
    });
  });

  describe("complementary_skills", () => {
    it("matches when user needs what match offers", () => {
      const user = { ...baseUser, looking_for: ["design"] };
      const match = { ...baseMatch, can_offer: ["design", "marketing"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("Alice");
      expect(result!.explanation).toContain("design");
      expect(result!.explanation).toContain("Bob");
    });

    it("does not match when no skill overlap", () => {
      const user = { ...baseUser, looking_for: ["funding"] };
      const match = { ...baseMatch, can_offer: ["design"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result).toBeNull();
    });
  });

  describe("same_industry", () => {
    it("matches when shared industry", () => {
      const result = tryTemplateMatch(baseUser, baseMatch, ["SaaS"], ["SaaS", "FinTech"], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("SaaS");
    });

    it("does not match when no shared industry", () => {
      const result = tryTemplateMatch(baseUser, baseMatch, ["SaaS"], ["Healthcare"], 0, TEMPLATES);
      // Should match cross_industry instead
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("Different industries");
    });
  });

  describe("cross_industry", () => {
    it("matches when industries are different", () => {
      const result = tryTemplateMatch(baseUser, baseMatch, ["SaaS"], ["Healthcare"], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("Different industries");
    });

    it("does not match when no industries at all", () => {
      const result = tryTemplateMatch(baseUser, baseMatch, [], [], 0, TEMPLATES);
      expect(result).toBeNull();
    });
  });

  describe("same_goals", () => {
    it("matches when shared goals", () => {
      const user = { ...baseUser, looking_for: ["networking", "accountability"] };
      const match = { ...baseMatch, looking_for: ["accountability", "learning"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("accountability");
    });
  });

  describe("repeat_match", () => {
    it("matches when interactions >= 2", () => {
      const result = tryTemplateMatch(baseUser, baseMatch, [], [], 2, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("worked together before");
    });

    it("does not match when interactions < 2", () => {
      const result = tryTemplateMatch(baseUser, baseMatch, [], [], 1, TEMPLATES);
      expect(result).toBeNull();
    });
  });

  describe("new_member", () => {
    it("matches when match has <= 1 events attended", () => {
      const match = { ...baseMatch, events_attended: 0 };
      const result = tryTemplateMatch(baseUser, match, [], [], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("Bob");
      expect(result!.explanation).toContain("new to DoneDonaDone");
    });

    it("does not match when match is experienced", () => {
      const match = { ...baseMatch, events_attended: 5 };
      const result = tryTemplateMatch(baseUser, match, [], [], 0, TEMPLATES);
      expect(result).toBeNull();
    });
  });

  describe("skill_swap", () => {
    it("matches when both can offer skills", () => {
      const user = { ...baseUser, can_offer: ["design"] };
      const match = { ...baseMatch, can_offer: ["engineering"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result).not.toBeNull();
      expect(result!.explanation).toContain("design");
      expect(result!.explanation).toContain("engineering");
    });
  });

  describe("priority ordering", () => {
    it("picks highest priority template when multiple match", () => {
      // This user+match qualifies for both complementary_skills (p=10) and same_vibe (p=5)
      const user = { ...baseUser, work_vibe: "deep_focus", looking_for: ["design"] };
      const match = { ...baseMatch, work_vibe: "deep_focus", can_offer: ["design"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      // complementary_skills has higher priority
      expect(result!.explanation).toContain("looking for");
    });
  });

  describe("no match", () => {
    it("returns null when no templates apply", () => {
      // Two users with nothing in common, no industries, no interactions
      const result = tryTemplateMatch(baseUser, baseMatch, [], [], 0, TEMPLATES);
      expect(result).toBeNull();
    });
  });

  describe("icebreaker generation", () => {
    it("includes icebreaker when template has one", () => {
      const user = { ...baseUser, work_vibe: "balanced" };
      const match = { ...baseMatch, work_vibe: "balanced" };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result!.icebreaker).not.toBeNull();
      expect(result!.icebreaker).toContain("playlist");
    });

    it("returns null icebreaker when template has none", () => {
      const noIcebreakerTemplates: MatchTemplate[] = [
        { match_type: "same_vibe", template: "Same vibe {{vibe}}", icebreaker_template: null, priority: 5, is_active: true },
      ];
      const user = { ...baseUser, work_vibe: "deep_focus" };
      const match = { ...baseMatch, work_vibe: "deep_focus" };
      const result = tryTemplateMatch(user, match, [], [], 0, noIcebreakerTemplates);
      expect(result!.icebreaker).toBeNull();
    });
  });

  describe("display name fallbacks", () => {
    it("uses 'You' when user has no display name", () => {
      const user = { ...baseUser, display_name: null, looking_for: ["design"] };
      const match = { ...baseMatch, can_offer: ["design"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result!.explanation).toContain("You");
    });

    it("uses 'Your match' when match has no display name", () => {
      const user = { ...baseUser, looking_for: ["design"] };
      const match = { ...baseMatch, display_name: null, can_offer: ["design"] };
      const result = tryTemplateMatch(user, match, [], [], 0, TEMPLATES);
      expect(result!.explanation).toContain("Your match");
    });
  });
});
