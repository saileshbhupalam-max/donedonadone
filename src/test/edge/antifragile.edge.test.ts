import { describe, it, expect } from "vitest";
import { createSmartGroups, getPopularityLabel } from "@/lib/antifragile";

function makeAttendee(overrides: Partial<{
  id: string;
  gender: string | null;
  events_attended: number;
  is_table_captain: boolean;
  no_show_count: number;
  reliability_status: string;
}> = {}) {
  return {
    id: overrides.id ?? `user-${Math.random().toString(36).slice(2, 8)}`,
    gender: overrides.gender ?? null,
    events_attended: overrides.events_attended ?? 0,
    is_table_captain: overrides.is_table_captain ?? false,
    no_show_count: overrides.no_show_count ?? 0,
    reliability_status: overrides.reliability_status ?? "good",
  };
}

function makeAttendees(count: number, overrides: Partial<Parameters<typeof makeAttendee>[0]> = {}) {
  return Array.from({ length: count }, (_, i) =>
    makeAttendee({ id: `user-${i}`, ...overrides })
  );
}

describe("createSmartGroups edge cases", () => {
  it("returns empty array for 0 attendees", () => {
    expect(createSmartGroups([])).toEqual([]);
  });

  it("returns 1 group with 1 person for single attendee", () => {
    const groups = createSmartGroups([makeAttendee({ id: "solo" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
  });

  it("returns 1 group for 5 attendees with groupSize=5", () => {
    const groups = createSmartGroups(makeAttendees(5), 5);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(5);
  });

  it("returns 2 groups for 5 attendees with groupSize=4", () => {
    const groups = createSmartGroups(makeAttendees(5), 4);
    expect(groups).toHaveLength(2);
    const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
    expect(totalMembers).toBe(5);
  });

  it("handles all captains with no regular members", () => {
    const attendees = makeAttendees(4, { is_table_captain: true, events_attended: 10 });
    const groups = createSmartGroups(attendees, 4);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(4);
  });

  it("handles all newbies (events_attended=0) with no experienced members", () => {
    const attendees = makeAttendees(8, { events_attended: 0 });
    const groups = createSmartGroups(attendees, 4);
    expect(groups).toHaveLength(2);
    const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
    expect(totalMembers).toBe(8);
  });

  it("does not crash when all attendees have the same gender", () => {
    const attendees = makeAttendees(8, { gender: "male" });
    const groups = createSmartGroups(attendees, 4);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
    expect(totalMembers).toBe(8);
  });

  it("creates 25 groups for 100 attendees with groupSize=4", () => {
    const attendees = makeAttendees(100);
    const groups = createSmartGroups(attendees, 4);
    expect(groups).toHaveLength(25);
    const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
    expect(totalMembers).toBe(100);
  });

  it("handles attendees with null gender gracefully", () => {
    const attendees = [
      makeAttendee({ id: "a", gender: null }),
      makeAttendee({ id: "b", gender: "male" }),
      makeAttendee({ id: "c", gender: null }),
      makeAttendee({ id: "d", gender: "female" }),
    ];
    const groups = createSmartGroups(attendees, 4);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(4);
  });

  it("handles mixed reliability statuses without affecting grouping", () => {
    const attendees = [
      makeAttendee({ id: "a", reliability_status: "good" }),
      makeAttendee({ id: "b", reliability_status: "warning" }),
      makeAttendee({ id: "c", reliability_status: "flagged" }),
      makeAttendee({ id: "d", reliability_status: "good" }),
    ];
    const groups = createSmartGroups(attendees, 4);
    const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
    expect(totalMembers).toBe(4);
  });

  it("distributes captains across groups", () => {
    const attendees = [
      makeAttendee({ id: "cap1", is_table_captain: true, events_attended: 10 }),
      makeAttendee({ id: "cap2", is_table_captain: true, events_attended: 10 }),
      makeAttendee({ id: "m1", events_attended: 1 }),
      makeAttendee({ id: "m2", events_attended: 1 }),
      makeAttendee({ id: "m3", events_attended: 1 }),
      makeAttendee({ id: "m4", events_attended: 1 }),
    ];
    const groups = createSmartGroups(attendees, 3);
    // With 6 people and groupSize 3, expect 2 groups
    expect(groups).toHaveLength(2);
    // Each group should have at least one captain
    for (const group of groups) {
      const hasCaptain = group.some(m => m.is_table_captain);
      expect(hasCaptain).toBe(true);
    }
  });
});

describe("getPopularityLabel edge cases", () => {
  it("returns '10 spots left' for goingCount=0, maxSpots=10", () => {
    expect(getPopularityLabel(0, 10)).toBe("10 spots left");
  });

  it("returns null for maxSpots=0 (falsy)", () => {
    // !maxSpots when maxSpots=0 is truthy, so returns null
    expect(getPopularityLabel(0, 0)).toBeNull();
  });

  it("returns 'Full' for goingCount=1, maxSpots=1 with no waitlist", () => {
    expect(getPopularityLabel(1, 1)).toBe("Full");
  });

  it("returns waitlist message when full with waitlist", () => {
    expect(getPopularityLabel(10, 10, 3)).toBe("Waitlist: 3 people");
  });

  it("returns null for maxSpots=null", () => {
    expect(getPopularityLabel(5, null)).toBeNull();
  });

  it("handles negative goingCount", () => {
    // -5/10 = -0.5, doesn't match any >=0.8, >=0.5, or <0.3 with >0 check
    // goingCount is -5 which is < 0, so < 0.3 is true but > 0 is false
    // Falls to default: maxSpots - goingCount = 10 - (-5) = 15
    const result = getPopularityLabel(-5, 10);
    expect(result).toBe("15 spots left");
  });

  it("handles very large numbers", () => {
    expect(getPopularityLabel(1000, 1000)).toBe("Full");
  });

  it("returns 'Almost full' at exactly 80%", () => {
    expect(getPopularityLabel(8, 10)).toBe("Almost full");
  });

  it("returns 'Filling fast' at exactly 50%", () => {
    expect(getPopularityLabel(5, 10)).toBe("Filling fast");
  });

  it("returns 'Quiet session' for low attendance with at least 1 going", () => {
    // 1/10 = 0.1, < 0.3 && > 0
    expect(getPopularityLabel(1, 10)).toBe("Quiet session \u2014 great for focused work");
  });
});
