import { describe, it, expect } from 'vitest';
import { createSmartGroups, getPopularityLabel } from '@/lib/antifragile';

function makeAttendee(overrides: Record<string, any> = {}): any {
  return {
    id: `user-${Math.random().toString(36).slice(2, 8)}`,
    gender: null,
    events_attended: 0,
    is_table_captain: false,
    no_show_count: 0,
    reliability_status: 'good',
    ...overrides,
  };
}

describe('antifragile', () => {
  describe('createSmartGroups', () => {
    it('returns empty array for empty input', () => {
      expect(createSmartGroups([])).toEqual([]);
    });

    it('returns single group with single person', () => {
      const person = makeAttendee({ id: 'solo' });
      const groups = createSmartGroups([person]);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(1);
      expect(groups[0][0].id).toBe('solo');
    });

    it('distributes captains across groups', () => {
      const captain1 = makeAttendee({ id: 'cap1', is_table_captain: true, events_attended: 10 });
      const captain2 = makeAttendee({ id: 'cap2', is_table_captain: true, events_attended: 8 });
      const others = Array.from({ length: 6 }, (_, i) =>
        makeAttendee({ id: `user-${i}`, events_attended: 5 }),
      );
      const groups = createSmartGroups([captain1, captain2, ...others], 4);
      // Should have 2 groups, each with a captain
      expect(groups.length).toBe(2);
      const group1Captains = groups[0].filter(m => m.is_table_captain);
      const group2Captains = groups[1].filter(m => m.is_table_captain);
      expect(group1Captains.length).toBe(1);
      expect(group2Captains.length).toBe(1);
    });

    it('distributes experienced members across groups', () => {
      const experienced = Array.from({ length: 3 }, (_, i) =>
        makeAttendee({ id: `exp-${i}`, events_attended: 5 }),
      );
      const newbies = Array.from({ length: 5 }, (_, i) =>
        makeAttendee({ id: `new-${i}`, events_attended: 0 }),
      );
      const groups = createSmartGroups([...experienced, ...newbies], 4);
      // Each group should have at least one experienced member
      groups.forEach(group => {
        const hasExperienced = group.some(m => m.events_attended >= 3);
        if (group.length > 1) {
          expect(hasExperienced).toBe(true);
        }
      });
    });

    it('spreads newbies across groups with experienced members', () => {
      const experienced = Array.from({ length: 2 }, (_, i) =>
        makeAttendee({ id: `exp-${i}`, events_attended: 10 }),
      );
      const newbies = Array.from({ length: 6 }, (_, i) =>
        makeAttendee({ id: `new-${i}`, events_attended: 0 }),
      );
      const groups = createSmartGroups([...experienced, ...newbies], 4);
      // All attendees should be distributed
      const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
      expect(totalMembers).toBe(8);
    });

    it('creates correct number of groups based on group size', () => {
      const attendees = Array.from({ length: 12 }, (_, i) =>
        makeAttendee({ id: `user-${i}`, events_attended: 5 }),
      );
      const groups = createSmartGroups(attendees, 4);
      expect(groups.length).toBe(3);
    });

    it('handles all captains gracefully', () => {
      const captains = Array.from({ length: 4 }, (_, i) =>
        makeAttendee({ id: `cap-${i}`, is_table_captain: true, events_attended: 10 }),
      );
      const groups = createSmartGroups(captains, 4);
      expect(groups.length).toBeGreaterThanOrEqual(1);
      const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
      expect(totalMembers).toBe(4);
    });

    it('handles all newbies gracefully', () => {
      const newbies = Array.from({ length: 8 }, (_, i) =>
        makeAttendee({ id: `new-${i}`, events_attended: 0 }),
      );
      const groups = createSmartGroups(newbies, 4);
      expect(groups.length).toBe(2);
      const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
      expect(totalMembers).toBe(8);
    });
  });

  describe('getPopularityLabel', () => {
    it('returns "Full" when at capacity with no waitlist', () => {
      expect(getPopularityLabel(10, 10, 0)).toBe('Full');
    });

    it('returns waitlist message when at capacity with waitlist', () => {
      expect(getPopularityLabel(10, 10, 3)).toBe('Waitlist: 3 people');
    });

    it('returns "Almost full" at 80%+ capacity', () => {
      expect(getPopularityLabel(8, 10)).toBe('Almost full');
    });

    it('returns "Filling fast" at 50-79% capacity', () => {
      expect(getPopularityLabel(5, 10)).toBe('Filling fast');
    });

    it('returns quiet session label at <30% with some attendees', () => {
      const label = getPopularityLabel(2, 10);
      expect(label).toContain('Quiet session');
    });

    it('returns spots left for 30-49% capacity', () => {
      const label = getPopularityLabel(3, 10);
      expect(label).toBe('7 spots left');
    });

    it('returns null when maxSpots is null', () => {
      expect(getPopularityLabel(5, null)).toBeNull();
    });

    it('returns null when maxSpots is 0', () => {
      expect(getPopularityLabel(0, 0)).toBeNull();
    });
  });
});
