import { describe, it, expect } from 'vitest';
import '../mocks/supabase';

describe('lib/antifragile exports', () => {
  it('exports createSmartGroups', async () => {
    const mod = await import('../../lib/antifragile');
    expect(mod.createSmartGroups).toBeDefined();
    expect(typeof mod.createSmartGroups).toBe('function');
  });

  it('exports getPopularityLabel', async () => {
    const mod = await import('../../lib/antifragile');
    expect(mod.getPopularityLabel).toBeDefined();
    expect(typeof mod.getPopularityLabel).toBe('function');
  });

  it('exports CAPTAIN_NUDGES', async () => {
    const mod = await import('../../lib/antifragile');
    expect(mod.CAPTAIN_NUDGES).toBeDefined();
    expect(typeof mod.CAPTAIN_NUDGES).toBe('object');
  });
});

describe('lib/badges exports', () => {
  it('exports BADGE_DEFINITIONS', async () => {
    const mod = await import('../../lib/badges');
    expect(mod.BADGE_DEFINITIONS).toBeDefined();
    expect(Array.isArray(mod.BADGE_DEFINITIONS)).toBe(true);
  });

  it('exports getBadgeDef', async () => {
    const mod = await import('../../lib/badges');
    expect(mod.getBadgeDef).toBeDefined();
    expect(typeof mod.getBadgeDef).toBe('function');
  });

  it('exports checkAndAwardBadges', async () => {
    const mod = await import('../../lib/badges');
    expect(mod.checkAndAwardBadges).toBeDefined();
    expect(typeof mod.checkAndAwardBadges).toBe('function');
  });
});

describe('lib/calendar exports', () => {
  it('exports getGoogleCalendarUrl', async () => {
    const mod = await import('../../lib/calendar');
    expect(mod.getGoogleCalendarUrl).toBeDefined();
    expect(typeof mod.getGoogleCalendarUrl).toBe('function');
  });

  it('exports downloadICSFile', async () => {
    const mod = await import('../../lib/calendar');
    expect(mod.downloadICSFile).toBeDefined();
    expect(typeof mod.downloadICSFile).toBe('function');
  });
});

describe('lib/growth exports', () => {
  it('exports MILESTONES', async () => {
    const mod = await import('../../lib/growth');
    expect(mod.MILESTONES).toBeDefined();
    expect(typeof mod.MILESTONES).toBe('object');
  });

  it('exports checkMilestones', async () => {
    const mod = await import('../../lib/growth');
    expect(mod.checkMilestones).toBeDefined();
    expect(typeof mod.checkMilestones).toBe('function');
  });

  it('exports trackAnalyticsEvent', async () => {
    const mod = await import('../../lib/growth');
    expect(mod.trackAnalyticsEvent).toBeDefined();
    expect(typeof mod.trackAnalyticsEvent).toBe('function');
  });
});

describe('lib/icebreakers exports', () => {
  it('exports selectIcebreakerRounds', async () => {
    const mod = await import('../../lib/icebreakers');
    expect(mod.selectIcebreakerRounds).toBeDefined();
    expect(typeof mod.selectIcebreakerRounds).toBe('function');
  });
});

describe('lib/matchUtils exports', () => {
  it('exports calculateMatch', async () => {
    const mod = await import('../../lib/matchUtils');
    expect(mod.calculateMatch).toBeDefined();
    expect(typeof mod.calculateMatch).toBe('function');
  });

  it('exports calculateProfileCompletion', async () => {
    const mod = await import('../../lib/matchUtils');
    expect(mod.calculateProfileCompletion).toBeDefined();
    expect(typeof mod.calculateProfileCompletion).toBe('function');
  });
});

describe('lib/personality exports', () => {
  it('exports getContextualGreeting', async () => {
    const mod = await import('../../lib/personality');
    expect(mod.getContextualGreeting).toBeDefined();
    expect(typeof mod.getContextualGreeting).toBe('function');
  });

  it('exports getGenderBalanceIndicator', async () => {
    const mod = await import('../../lib/personality');
    expect(mod.getGenderBalanceIndicator).toBeDefined();
    expect(typeof mod.getGenderBalanceIndicator).toBe('function');
  });
});

describe('lib/ranks exports', () => {
  it('exports getRankForHours', async () => {
    const mod = await import('../../lib/ranks');
    expect(mod.getRankForHours).toBeDefined();
    expect(typeof mod.getRankForHours).toBe('function');
  });

  it('exports getRankProgress', async () => {
    const mod = await import('../../lib/ranks');
    expect(mod.getRankProgress).toBeDefined();
    expect(typeof mod.getRankProgress).toBe('function');
  });

  it('exports calculateSessionHours', async () => {
    const mod = await import('../../lib/ranks');
    expect(mod.calculateSessionHours).toBeDefined();
    expect(typeof mod.calculateSessionHours).toBe('function');
  });

  it('exports RANK_TIERS', async () => {
    const mod = await import('../../lib/ranks');
    expect(mod.RANK_TIERS).toBeDefined();
    expect(Array.isArray(mod.RANK_TIERS)).toBe(true);
  });
});

describe('lib/sessionMatch exports', () => {
  it('exports sessionMatchScore', async () => {
    const mod = await import('../../lib/sessionMatch');
    expect(mod.sessionMatchScore).toBeDefined();
    expect(typeof mod.sessionMatchScore).toBe('function');
  });
});

describe('lib/sessionPhases exports', () => {
  it('exports STRUCTURED_4HR_PHASES', async () => {
    const mod = await import('../../lib/sessionPhases');
    expect(mod.STRUCTURED_4HR_PHASES).toBeDefined();
    expect(Array.isArray(mod.STRUCTURED_4HR_PHASES)).toBe(true);
  });

  it('exports STRUCTURED_2HR_PHASES', async () => {
    const mod = await import('../../lib/sessionPhases');
    expect(mod.STRUCTURED_2HR_PHASES).toBeDefined();
    expect(Array.isArray(mod.STRUCTURED_2HR_PHASES)).toBe(true);
  });

  it('exports getFormatPhases', async () => {
    const mod = await import('../../lib/sessionPhases');
    expect(mod.getFormatPhases).toBeDefined();
    expect(typeof mod.getFormatPhases).toBe('function');
  });
});

describe('lib/sharing exports', () => {
  it('exports getEventShareMessage', async () => {
    const mod = await import('../../lib/sharing');
    expect(mod.getEventShareMessage).toBeDefined();
    expect(typeof mod.getEventShareMessage).toBe('function');
  });

  it('exports getProfileShareMessage', async () => {
    const mod = await import('../../lib/sharing');
    expect(mod.getProfileShareMessage).toBeDefined();
    expect(typeof mod.getProfileShareMessage).toBe('function');
  });
});
