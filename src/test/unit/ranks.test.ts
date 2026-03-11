import { describe, it, expect } from 'vitest';
import { getRankForHours, getNextRank, getRankProgress, calculateSessionHours, RANK_TIERS } from '@/lib/ranks';

describe('getRankForHours', () => {
  it('returns Newcomer for 0 hours', () => {
    expect(getRankForHours(0).name).toBe('Newcomer');
  });

  it('returns Getting Started for 5 hours', () => {
    expect(getRankForHours(5).name).toBe('Getting Started');
  });

  it('returns Regular for 15 hours', () => {
    expect(getRankForHours(15).name).toBe('Regular');
  });

  it('returns Deep Worker for 35 hours', () => {
    expect(getRankForHours(35).name).toBe('Deep Worker');
  });

  it('returns Elite for 75 hours', () => {
    expect(getRankForHours(75).name).toBe('Elite');
  });

  it('returns Grandmaster for 150 hours', () => {
    expect(getRankForHours(150).name).toBe('Grandmaster');
  });

  it('returns Grandmaster for very high hours', () => {
    expect(getRankForHours(1000).name).toBe('Grandmaster');
  });
});

describe('getNextRank', () => {
  it('returns Getting Started for Newcomer', () => {
    expect(getNextRank(0)?.name).toBe('Getting Started');
  });

  it('returns Regular for Getting Started', () => {
    expect(getNextRank(5)?.name).toBe('Regular');
  });

  it('returns null for Grandmaster (max rank)', () => {
    expect(getNextRank(150)).toBeNull();
  });
});

describe('getRankProgress', () => {
  it('returns 0% progress at start of tier', () => {
    const result = getRankProgress(0);
    expect(result.current.name).toBe('Newcomer');
    expect(result.progress).toBe(0);
  });

  it('returns 100% progress at max tier', () => {
    const result = getRankProgress(150);
    expect(result.progress).toBe(100);
    expect(result.next).toBeNull();
  });

  it('calculates mid-tier progress correctly', () => {
    // Newcomer: 0-5hrs. At 2.5hrs = 50%
    const result = getRankProgress(2.5);
    expect(result.progress).toBe(50);
    expect(result.hoursToNext).toBe(2.5);
  });
});

describe('calculateSessionHours', () => {
  it('returns 3 for structured_4hr format', () => {
    expect(calculateSessionHours(null, null, 'Test', 'structured_4hr')).toBe(3);
  });

  it('returns 1.33 for structured_2hr format', () => {
    expect(calculateSessionHours(null, null, 'Test', 'structured_2hr')).toBe(1.33);
  });

  it('returns 3 for title containing 4hr', () => {
    expect(calculateSessionHours(null, null, 'Deep Work 4hr Session', null)).toBe(3);
  });

  it('returns 1.33 for title containing 2hr', () => {
    expect(calculateSessionHours(null, null, 'Quick 2hr Focus', null)).toBe(1.33);
  });

  it('calculates from start/end time', () => {
    expect(calculateSessionHours('10:00', '13:00', 'Session', null)).toBe(3);
  });

  it('defaults to 2 hours when no info available', () => {
    expect(calculateSessionHours(null, null, 'Session', null)).toBe(2);
  });
});

describe('RANK_TIERS', () => {
  it('has 6 tiers', () => {
    expect(RANK_TIERS).toHaveLength(6);
  });

  it('tiers are in ascending order of minHours', () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i].minHours).toBeGreaterThan(RANK_TIERS[i - 1].minHours);
    }
  });

  it('last tier has Infinity maxHours', () => {
    expect(RANK_TIERS[RANK_TIERS.length - 1].maxHours).toBe(Infinity);
  });
});
