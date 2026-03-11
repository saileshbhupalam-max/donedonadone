import { describe, it, expect } from 'vitest';
import { getPopularityLabel, CAPTAIN_NUDGES } from '@/lib/antifragile';
import { getGenderBalanceIndicator } from '@/lib/personality';
import { createSmartGroups } from '@/lib/antifragile';

describe('getPopularityLabel', () => {
  it('returns Full when at capacity', () => {
    expect(getPopularityLabel(10, 10)).toBe('Full');
  });

  it('returns waitlist info when full with waitlist', () => {
    expect(getPopularityLabel(10, 10, 3)).toBe('Waitlist: 3 people');
  });

  it('returns Almost full at 80%+', () => {
    expect(getPopularityLabel(8, 10)).toBe('Almost full');
  });

  it('returns Filling fast at 50%+', () => {
    expect(getPopularityLabel(5, 10)).toBe('Filling fast');
  });

  it('returns spots left below 50%', () => {
    expect(getPopularityLabel(4, 10)).toContain('spots left');
  });

  it('returns quiet session message below 30%', () => {
    const label = getPopularityLabel(1, 10);
    expect(label).toContain('Quiet session');
  });

  it('returns null when maxSpots is null', () => {
    expect(getPopularityLabel(5, null)).toBeNull();
  });
});

describe('CAPTAIN_NUDGES', () => {
  it('has icebreaker nudge', () => {
    expect(CAPTAIN_NUDGES.icebreaker).toBeTruthy();
  });

  it('has wrap_up nudge', () => {
    expect(CAPTAIN_NUDGES.wrap_up).toBeTruthy();
  });

  it('has deep_work nudge', () => {
    expect(CAPTAIN_NUDGES.deep_work).toBeTruthy();
  });
});

describe('createSmartGroups', () => {
  const makeAttendee = (id: string, gender: string) => ({
    id, gender, events_attended: 0, is_table_captain: false, no_show_count: 0, reliability_status: 'good',
  });

  it('returns empty array for no attendees', () => {
    expect(createSmartGroups([])).toEqual([]);
  });

  it('creates single group for small attendee list', () => {
    const attendees = [
      makeAttendee('1', 'male'),
      makeAttendee('2', 'female'),
      makeAttendee('3', 'male'),
    ];
    const groups = createSmartGroups(attendees, 4);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('creates multiple groups for larger lists', () => {
    const attendees = Array.from({ length: 12 }, (_, i) => makeAttendee(String(i), i % 2 === 0 ? 'male' : 'female'));
    const groups = createSmartGroups(attendees, 4);
    expect(groups).toHaveLength(3);
  });
});

describe('getGenderBalanceIndicator', () => {
  it('returns balanced for empty group', () => {
    expect(getGenderBalanceIndicator([]).balanced).toBe(true);
  });

  it('returns balanced for well-mixed group', () => {
    const attendees = [
      { id: '1', gender: 'female' },
      { id: '2', gender: 'male' },
      { id: '3', gender: 'female' },
      { id: '4', gender: 'male' },
    ];
    const result = getGenderBalanceIndicator(attendees);
    expect(result.balanced).toBe(true);
  });

  it('returns unbalanced for heavily skewed group', () => {
    const attendees = [
      { id: '1', gender: 'male' },
      { id: '2', gender: 'male' },
      { id: '3', gender: 'male' },
      { id: '4', gender: 'male' },
      { id: '5', gender: 'female' },
    ];
    const result = getGenderBalanceIndicator(attendees);
    expect(result.balanced).toBe(false);
  });
});
