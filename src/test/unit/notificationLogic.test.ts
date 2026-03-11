import { describe, it, expect } from "vitest";
import { isInQuietHours, isCategoryEnabled, resolveChannels } from "@/lib/notificationLogic";
import type { NotificationPrefs } from "@/lib/notificationLogic";

describe("isInQuietHours", () => {
  describe("overnight range (22:00 - 08:00)", () => {
    it("23:00 → in quiet hours", () => {
      expect(isInQuietHours(23 * 60, "22:00", "08:00")).toBe(true);
    });

    it("01:00 → in quiet hours", () => {
      expect(isInQuietHours(1 * 60, "22:00", "08:00")).toBe(true);
    });

    it("07:59 → in quiet hours", () => {
      expect(isInQuietHours(7 * 60 + 59, "22:00", "08:00")).toBe(true);
    });

    it("08:00 → NOT in quiet hours (boundary)", () => {
      expect(isInQuietHours(8 * 60, "22:00", "08:00")).toBe(false);
    });

    it("09:00 → NOT in quiet hours", () => {
      expect(isInQuietHours(9 * 60, "22:00", "08:00")).toBe(false);
    });

    it("12:00 → NOT in quiet hours", () => {
      expect(isInQuietHours(12 * 60, "22:00", "08:00")).toBe(false);
    });

    it("21:59 → NOT in quiet hours", () => {
      expect(isInQuietHours(21 * 60 + 59, "22:00", "08:00")).toBe(false);
    });

    it("22:00 → in quiet hours (boundary)", () => {
      expect(isInQuietHours(22 * 60, "22:00", "08:00")).toBe(true);
    });

    it("00:00 (midnight) → in quiet hours", () => {
      expect(isInQuietHours(0, "22:00", "08:00")).toBe(true);
    });
  });

  describe("same-day range (00:00 - 06:00)", () => {
    it("03:00 → in quiet hours", () => {
      expect(isInQuietHours(3 * 60, "00:00", "06:00")).toBe(true);
    });

    it("00:00 → in quiet hours (boundary)", () => {
      expect(isInQuietHours(0, "00:00", "06:00")).toBe(true);
    });

    it("06:00 → NOT in quiet hours (boundary)", () => {
      expect(isInQuietHours(6 * 60, "00:00", "06:00")).toBe(false);
    });

    it("12:00 → NOT in quiet hours", () => {
      expect(isInQuietHours(12 * 60, "00:00", "06:00")).toBe(false);
    });

    it("23:00 → NOT in quiet hours", () => {
      expect(isInQuietHours(23 * 60, "00:00", "06:00")).toBe(false);
    });
  });

  describe("edge case: same start and end", () => {
    it("any time → NOT in quiet hours when range is 0", () => {
      expect(isInQuietHours(12 * 60, "12:00", "12:00")).toBe(false);
    });
  });

  describe("custom range (14:00 - 16:00)", () => {
    it("15:00 → in quiet hours", () => {
      expect(isInQuietHours(15 * 60, "14:00", "16:00")).toBe(true);
    });

    it("13:00 → NOT in quiet hours", () => {
      expect(isInQuietHours(13 * 60, "14:00", "16:00")).toBe(false);
    });
  });
});

describe("isCategoryEnabled", () => {
  it("returns true when category is explicitly enabled", () => {
    expect(isCategoryEnabled("streak_warnings", { streak_warnings: true })).toBe(true);
  });

  it("returns false when category is explicitly disabled", () => {
    expect(isCategoryEnabled("upgrade_prompts", { upgrade_prompts: false })).toBe(false);
  });

  it("returns true when category is missing from channels (default enabled)", () => {
    expect(isCategoryEnabled("new_category", { streak_warnings: true })).toBe(true);
  });

  it("returns true when channels is null", () => {
    expect(isCategoryEnabled("anything", null)).toBe(true);
  });

  it("returns true when channels is empty object", () => {
    expect(isCategoryEnabled("anything", {})).toBe(true);
  });
});

describe("resolveChannels", () => {
  const defaultPrefs: NotificationPrefs = {
    push_enabled: true,
    email_enabled: false,
    whatsapp_enabled: false,
    whatsapp_number: null,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    channels: {
      session_reminders: true,
      streak_warnings: true,
      upgrade_prompts: false,
    },
  };

  it("always includes in_app", () => {
    const result = resolveChannels(null, "anything", 12 * 60, false);
    expect(result.inApp).toBe(true);
  });

  it("sends push when enabled + not quiet + category on + has tokens", () => {
    const result = resolveChannels(defaultPrefs, "session_reminders", 12 * 60, true);
    expect(result.push).toBe(true);
  });

  it("skips push when in quiet hours", () => {
    const result = resolveChannels(defaultPrefs, "session_reminders", 23 * 60, true);
    expect(result.push).toBe(false);
  });

  it("skips push when push_enabled is false", () => {
    const prefs = { ...defaultPrefs, push_enabled: false };
    const result = resolveChannels(prefs, "session_reminders", 12 * 60, true);
    expect(result.push).toBe(false);
  });

  it("skips push when category is disabled", () => {
    const result = resolveChannels(defaultPrefs, "upgrade_prompts", 12 * 60, true);
    expect(result.push).toBe(false);
  });

  it("skips push when no active tokens", () => {
    const result = resolveChannels(defaultPrefs, "session_reminders", 12 * 60, false);
    expect(result.push).toBe(false);
  });

  it("sends whatsapp when enabled + has number + not quiet + category on", () => {
    const prefs = { ...defaultPrefs, whatsapp_enabled: true, whatsapp_number: "+919876543210" };
    const result = resolveChannels(prefs, "session_reminders", 12 * 60, false);
    expect(result.whatsapp).toBe(true);
  });

  it("skips whatsapp when enabled but no number", () => {
    const prefs = { ...defaultPrefs, whatsapp_enabled: true, whatsapp_number: null };
    const result = resolveChannels(prefs, "session_reminders", 12 * 60, false);
    expect(result.whatsapp).toBe(false);
  });

  it("skips whatsapp when in quiet hours", () => {
    const prefs = { ...defaultPrefs, whatsapp_enabled: true, whatsapp_number: "+919876543210" };
    const result = resolveChannels(prefs, "session_reminders", 23 * 60, false);
    expect(result.whatsapp).toBe(false);
  });

  it("skips whatsapp when category disabled", () => {
    const prefs = { ...defaultPrefs, whatsapp_enabled: true, whatsapp_number: "+919876543210" };
    const result = resolveChannels(prefs, "upgrade_prompts", 12 * 60, false);
    expect(result.whatsapp).toBe(false);
  });

  it("handles null prefs gracefully (in_app only)", () => {
    const result = resolveChannels(null, "anything", 12 * 60, true);
    expect(result.inApp).toBe(true);
    expect(result.push).toBe(false);
    expect(result.whatsapp).toBe(false);
  });

  it("multiple channels can be active simultaneously", () => {
    const prefs = { ...defaultPrefs, whatsapp_enabled: true, whatsapp_number: "+919876543210" };
    const result = resolveChannels(prefs, "session_reminders", 12 * 60, true);
    expect(result.inApp).toBe(true);
    expect(result.push).toBe(true);
    expect(result.whatsapp).toBe(true);
  });
});
