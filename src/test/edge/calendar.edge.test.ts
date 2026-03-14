import { describe, it, expect } from "vitest";
import { getGoogleCalendarUrl } from "@/lib/calendar";

describe("getGoogleCalendarUrl edge cases", () => {
  it("returns a valid URL when startTime and endTime are null", () => {
    const url = getGoogleCalendarUrl({
      title: "Test Session",
      date: "2026-06-15",
      startTime: null,
      endTime: null,
    });
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    // Should use date-only format (no T)
    expect(url).toContain("20260615");
  });

  it("encodes a very long title (200 chars) correctly", () => {
    const longTitle = "A".repeat(200);
    const url = getGoogleCalendarUrl({
      title: longTitle,
      date: "2026-06-15",
    });
    // URLSearchParams encodes spaces as + not %20
    expect(url).toContain("DoneDonaDone");
    expect(url).toContain("A".repeat(50)); // title is present in full
    // URL should be valid (no unencoded special chars breaking it)
    expect(() => new URL(url)).not.toThrow();
  });

  it("encodes special characters in venue name (& \" ' < >)", () => {
    const url = getGoogleCalendarUrl({
      title: "Session",
      date: "2026-06-15",
      venueName: 'Cafe & Bar "The <Best>"',
      venueAddress: "123 Main St",
    });
    // URLSearchParams handles encoding automatically
    expect(url).toContain("calendar.google.com");
    // The special chars should be encoded in the URL
    expect(url).not.toContain("&Bar"); // & should be encoded as %26 in the value
  });

  it("parses date '2026-12-31' correctly", () => {
    const url = getGoogleCalendarUrl({
      title: "NYE Session",
      date: "2026-12-31",
      startTime: "10:00 AM",
      endTime: "12:00 PM",
    });
    expect(url).toContain("20261231");
  });

  it("parses startTime '12:00 PM' as noon (not midnight)", () => {
    const url = getGoogleCalendarUrl({
      title: "Lunch Session",
      date: "2026-06-15",
      startTime: "12:00 PM",
      endTime: "02:00 PM",
    });
    // 12:00 PM should produce T120000
    expect(url).toContain("T120000");
  });

  it("parses startTime '12:00 AM' as midnight", () => {
    const url = getGoogleCalendarUrl({
      title: "Late Night",
      date: "2026-06-15",
      startTime: "12:00 AM",
      endTime: "02:00 AM",
    });
    // 12:00 AM = midnight = T000000
    expect(url).toContain("T000000");
  });

  it("uses date-only format when both times are null", () => {
    const url = getGoogleCalendarUrl({
      title: "All Day",
      date: "2026-06-15",
      startTime: null,
      endTime: null,
    });
    // Should contain just the date without T
    const datesParam = decodeURIComponent(url.split("dates=")[1]?.split("&")[0] || "");
    // Both start and end should be date-only format
    expect(datesParam).toMatch(/^\d{8}\/\d{8}$/);
  });

  it("handles event at midnight spanning to 2 AM", () => {
    const url = getGoogleCalendarUrl({
      title: "Night Owl",
      date: "2026-06-15",
      startTime: "12:00 AM",
      endTime: "02:00 AM",
    });
    expect(url).toContain("T000000");
    expect(url).toContain("T020000");
  });

  it("handles missing venue fields gracefully", () => {
    const url = getGoogleCalendarUrl({
      title: "No Venue",
      date: "2026-06-15",
      venueName: null,
      venueAddress: null,
    });
    // location param should be empty string
    expect(url).toContain("location=");
  });

  it("combines venueName and venueAddress with comma", () => {
    const url = getGoogleCalendarUrl({
      title: "Session",
      date: "2026-06-15",
      venueName: "Cool Cafe",
      venueAddress: "HSR Layout",
    });
    // URLSearchParams encodes spaces as + signs
    expect(url).toContain("Cool+Cafe");
    expect(url).toContain("HSR+Layout");
  });
});
