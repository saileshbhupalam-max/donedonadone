import { describe, it, expect } from "vitest";
import { calculateMatch, calculateProfileCompletion } from "@/lib/matchUtils";

// Helper to create a minimal valid profile with all fields null
function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id",
    autopilot_days: null,
    autopilot_enabled: null,
    autopilot_max_per_week: null,
    autopilot_prefer_circle: null,
    autopilot_times: null,
    avatar_url: null,
    bio: null,
    can_offer: null,
    captain_sessions: null,
    communication_style: null,
    created_at: null,
    current_streak: null,
    display_name: null,
    email: null,
    events_attended: null,
    events_no_show: null,
    focus_hours: null,
    focus_rank: null,
    gender: null,
    instagram_handle: null,
    intentions_completed: null,
    interests: null,
    is_table_captain: null,
    is_welcome_buddy: null,
    last_active_at: null,
    linkedin_url: null,
    looking_for: null,
    neighborhood: null,
    no_show_count: null,
    noise_preference: null,
    onboarding_completed: null,
    phone: null,
    preferred_days: null,
    preferred_latitude: null,
    preferred_longitude: null,
    preferred_neighborhoods: null,
    preferred_radius_km: null,
    preferred_session_duration: null,
    preferred_times: null,
    profile_completion: null,
    referral_code: null,
    referred_by: null,
    reliability_status: null,
    sessions_rsvpd: null,
    sessions_showed_up: null,
    show_instagram: null,
    show_linkedin: null,
    show_twitter: null,
    streak_insurance_used_at: null,
    streak_saves_total: null,
    tagline: null,
    twitter_handle: null,
    updated_at: null,
    user_type: null,
    weekly_intention: null,
    weekly_intention_set_at: null,
    what_i_do: null,
    women_only_interest: null,
    work_vibe: null,
    ...overrides,
  } as any;
}

describe("calculateMatch edge cases", () => {
  it("returns score 0 and no reasons when both profiles are completely null/empty", () => {
    const a = makeProfile();
    const b = makeProfile();
    const result = calculateMatch(a, b);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it("returns partial score when one profile is full and other is empty", () => {
    const full = makeProfile({
      work_vibe: "deep_focus",
      neighborhood: "HSR Layout",
      noise_preference: "quiet",
      communication_style: "async",
      looking_for: ["design", "mentorship"],
      can_offer: ["engineering", "coffee"],
      interests: ["reading", "yoga"],
    });
    const empty = makeProfile();
    const result = calculateMatch(full, empty);
    // Viewer has fields but member has none => no matches
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it("caps score at 100 even when all fields match with many overlapping items", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const profile = makeProfile({
      work_vibe: "deep_focus",
      neighborhood: "HSR Layout",
      noise_preference: "quiet",
      communication_style: "async",
      looking_for: items,
      can_offer: items,
      interests: items,
    });
    const result = calculateMatch(profile, makeProfile({
      work_vibe: "deep_focus",
      neighborhood: "HSR Layout",
      noise_preference: "quiet",
      communication_style: "async",
      looking_for: items,
      can_offer: items,
      interests: items,
    }));
    expect(result.score).toBe(100);
  });

  it("does not exceed 100 with 10 looking_for matching 10 can_offer", () => {
    const tenItems = Array.from({ length: 10 }, (_, i) => `skill${i}`);
    const a = makeProfile({ looking_for: tenItems });
    const b = makeProfile({ can_offer: tenItems });
    // 10 items * 15 pts each = 150 raw, should be capped at 100
    const result = calculateMatch(a, b);
    expect(result.score).toBe(100);
  });

  it("matches unicode interests correctly", () => {
    const a = makeProfile({ interests: ["\u5DE5\u7A0B", "\u8BBE\u8BA1", "\u2615"] });
    const b = makeProfile({ interests: ["\u5DE5\u7A0B", "\u2615"] });
    const result = calculateMatch(a, b);
    // 2 shared interests * 5 = 10
    expect(result.score).toBe(10);
    expect(result.reasons).toContain("Shared interests: \u5DE5\u7A0B, \u2615");
  });

  it("is case-sensitive for interests (design vs Design do NOT match)", () => {
    const a = makeProfile({ interests: ["design"] });
    const b = makeProfile({ interests: ["Design"] });
    const result = calculateMatch(a, b);
    expect(result.score).toBe(0);
  });

  it("is case-sensitive for looking_for/can_offer", () => {
    const a = makeProfile({ looking_for: ["Mentorship"] });
    const b = makeProfile({ can_offer: ["mentorship"] });
    const result = calculateMatch(a, b);
    expect(result.score).toBe(0);
  });

  it("treats empty arrays the same as undefined for looking_for/can_offer", () => {
    const withEmpty = makeProfile({ looking_for: [], can_offer: [] });
    const withNull = makeProfile({ looking_for: null, can_offer: null });
    const other = makeProfile({ looking_for: ["design"], can_offer: ["engineering"] });

    const r1 = calculateMatch(withEmpty, other);
    const r2 = calculateMatch(withNull, other);
    expect(r1.score).toBe(r2.score);
    expect(r1.reasons).toEqual(r2.reasons);
  });

  it("limits reasons to 4", () => {
    const items = ["a", "b", "c", "d", "e"];
    const a = makeProfile({
      work_vibe: "deep_focus",
      neighborhood: "HSR",
      looking_for: items,
      can_offer: items,
      interests: items,
    });
    const b = makeProfile({
      work_vibe: "deep_focus",
      neighborhood: "HSR",
      looking_for: items,
      can_offer: items,
      interests: items,
    });
    const result = calculateMatch(a, b);
    expect(result.reasons.length).toBeLessThanOrEqual(4);
  });
});

describe("calculateProfileCompletion edge cases", () => {
  it("returns 10% when profile has ONLY a linkedin_url", () => {
    const p = makeProfile({ linkedin_url: "https://linkedin.com/in/test" });
    expect(calculateProfileCompletion(p)).toBe(10);
  });

  it("returns 10% when profile has ONLY an instagram_handle", () => {
    const p = makeProfile({ instagram_handle: "@test" });
    expect(calculateProfileCompletion(p)).toBe(10);
  });

  it("returns 10% when profile has ONLY a twitter_handle", () => {
    const p = makeProfile({ twitter_handle: "@test" });
    expect(calculateProfileCompletion(p)).toBe(10);
  });

  it("returns 100% when all fields are filled", () => {
    const p = makeProfile({
      display_name: "Test User",
      avatar_url: "https://example.com/avatar.png",
      tagline: "Hello",
      what_i_do: "Engineering",
      looking_for: ["mentorship"],
      can_offer: ["design"],
      work_vibe: "deep_focus",
      linkedin_url: "https://linkedin.com/in/test",
      interests: ["yoga"],
      gender: "male",
      neighborhood: "HSR",
    });
    expect(calculateProfileCompletion(p)).toBe(100);
  });

  it("treats null and empty string differently for text fields", () => {
    // Empty string is truthy-ish in JS? Actually "" is falsy
    const withNull = makeProfile({ display_name: null });
    const withEmpty = makeProfile({ display_name: "" });
    // Both should contribute 0 since "" is falsy
    expect(calculateProfileCompletion(withNull)).toBe(0);
    expect(calculateProfileCompletion(withEmpty)).toBe(0);
  });

  it("returns 0 for a completely empty profile", () => {
    const p = makeProfile();
    expect(calculateProfileCompletion(p)).toBe(0);
  });

  it("counts social links only once even if multiple are present", () => {
    const oneSocial = makeProfile({ linkedin_url: "https://linkedin.com" });
    const allSocials = makeProfile({
      linkedin_url: "https://linkedin.com",
      instagram_handle: "@test",
      twitter_handle: "@test",
    });
    // Both contribute 10% for the social links block
    expect(calculateProfileCompletion(oneSocial)).toBe(10);
    expect(calculateProfileCompletion(allSocials)).toBe(10);
  });
});
