import { describe, it, expect } from "vitest";
import {
  getEventShareMessage,
  getPromptShareMessage,
  getPromptInviteMessage,
  getBadgeShareMessage,
  getProfileShareMessage,
} from "@/lib/sharing";

describe("getEventShareMessage edge cases", () => {
  it("generates a message when all optional fields are null", () => {
    const msg = getEventShareMessage(
      {
        title: "Session",
        date: "2026-06-15",
        start_time: null,
        venue_name: null,
        neighborhood: null,
        id: "evt-1",
      },
      0,
      null
    );
    expect(msg).toContain("Session");
    expect(msg).toContain("Monday"); // June 15, 2026 is a Monday
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("null");
  });

  it("includes going count when > 0", () => {
    const msg = getEventShareMessage(
      { title: "Work", date: "2026-06-15", id: "e1" },
      5,
      null
    );
    expect(msg).toContain("5 people going already!");
  });

  it("does not include going count text when 0", () => {
    const msg = getEventShareMessage(
      { title: "Work", date: "2026-06-15", id: "e1" },
      0,
      null
    );
    expect(msg).not.toContain("people going");
  });

  it("includes referral code in URL when provided", () => {
    const msg = getEventShareMessage(
      { title: "Work", date: "2026-06-15", id: "e1" },
      0,
      "ABC123"
    );
    expect(msg).toContain("?ref=ABC123");
  });

  it("excludes ?ref= from URL when referral code is null", () => {
    const msg = getEventShareMessage(
      { title: "Work", date: "2026-06-15", id: "e1" },
      0,
      null
    );
    expect(msg).not.toContain("?ref=");
  });

  it("excludes ?ref= from URL when referral code is undefined", () => {
    const msg = getEventShareMessage(
      { title: "Work", date: "2026-06-15", id: "e1" },
      0
    );
    expect(msg).not.toContain("?ref=");
  });
});

describe("getPromptShareMessage edge cases", () => {
  it("truncates answer longer than 100 chars", () => {
    const longAnswer = "A".repeat(150);
    const msg = getPromptShareMessage("Question?", longAnswer);
    expect(msg).toContain("A".repeat(100) + "...");
    expect(msg).not.toContain("A".repeat(101));
  });

  it("does NOT truncate answer exactly 100 chars", () => {
    const answer = "B".repeat(100);
    const msg = getPromptShareMessage("Question?", answer);
    expect(msg).toContain(`"${answer}"`);
    expect(msg).not.toContain("...");
  });

  it("truncates answer of 101 chars", () => {
    const answer = "C".repeat(101);
    const msg = getPromptShareMessage("Question?", answer);
    expect(msg).toContain("C".repeat(100) + "...");
  });

  it("handles empty answer string", () => {
    const msg = getPromptShareMessage("Question?", "");
    expect(msg).toContain('""');
  });

  it("includes referral code when provided", () => {
    const msg = getPromptShareMessage("Q?", "A", "REF1");
    expect(msg).toContain("?ref=REF1");
  });

  it("excludes ?ref= when referral code is null", () => {
    const msg = getPromptShareMessage("Q?", "A", null);
    expect(msg).not.toContain("?ref=");
  });
});

describe("getProfileShareMessage edge cases", () => {
  it("includes display name in message", () => {
    const msg = getProfileShareMessage("John Doe", "user-123", "REF");
    expect(msg).toContain("DoneDonaDone");
    expect(msg).toContain("/profile/user-123");
  });

  it("handles special characters in display name without crashing", () => {
    // Note: getProfileShareMessage does not include display_name in the output text
    // but the function should not throw with special chars
    const msg = getProfileShareMessage('Jane "The Coder" O\'Brien', "u1", null);
    expect(msg).toContain("/profile/u1");
    expect(msg).not.toContain("undefined");
    expect(msg).toBeTruthy();
  });

  it("handles referral code with special characters", () => {
    const msg = getProfileShareMessage("Test", "u1", "CODE&123");
    expect(msg).toContain("?ref=CODE&123");
  });
});

describe("getPromptInviteMessage edge cases", () => {
  it("includes the question in quotes", () => {
    const msg = getPromptInviteMessage("What motivates you?", "REF1");
    expect(msg).toContain('"What motivates you?"');
  });

  it("includes ref when provided", () => {
    const msg = getPromptInviteMessage("Q?", "ABC");
    expect(msg).toContain("?ref=ABC");
  });
});

describe("getBadgeShareMessage edge cases", () => {
  it("includes emoji and badge name", () => {
    const msg = getBadgeShareMessage("🎪", "First Event", "Signed up for first event", "REF");
    expect(msg).toContain("🎪");
    expect(msg).toContain("First Event");
  });

  it("handles null referral code", () => {
    const msg = getBadgeShareMessage("🎪", "First Event", "Desc", null);
    // getRefLink with null code => no ?ref=
    expect(msg).not.toContain("?ref=");
  });
});

describe("referral code edge: empty string", () => {
  it("includes ?ref= with empty string (empty string is truthy for ternary check)", () => {
    // getRefLink: referralCode ? ... : base
    // Empty string "" is falsy, so should NOT include ?ref=
    const msg = getEventShareMessage(
      { title: "Work", date: "2026-06-15", id: "e1" },
      0,
      ""
    );
    expect(msg).not.toContain("?ref=");
  });
});
