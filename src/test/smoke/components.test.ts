import { describe, it, expect } from 'vitest';
import '../mocks/supabase';

describe('Home components load without errors', () => {
  const homeComponents = [
    { name: 'CommunityRitualCard', path: '../../components/home/CommunityRitualCard', exportName: 'CommunityRitualCard' },
    { name: 'GratitudeEchoCard', path: '../../components/home/GratitudeEchoCard', exportName: 'GratitudeEchoCard' },
    { name: 'PrimaryActionCard', path: '../../components/home/PrimaryActionCard', exportName: 'PrimaryActionCard' },
    { name: 'ProfilePromptCard', path: '../../components/home/ProfilePromptCard', exportName: 'ProfilePromptCard' },
  ];

  homeComponents.forEach(({ name, path, exportName }) => {
    it(`${name} imports without error`, async () => {
      const mod = await import(path);
      expect(mod).toBeDefined();
      expect(mod[exportName]).toBeDefined();
      expect(typeof mod[exportName]).toBe('function');
    });
  });
});

describe('Session components load without errors', () => {
  const sessionComponents = [
    { name: 'ScrapbookCard', path: '../../components/session/ScrapbookCard', exportName: 'ScrapbookCard' },
    { name: 'CoworkAgainCard', path: '../../components/session/CoworkAgainCard', exportName: 'CoworkAgainCard' },
    { name: 'GivePropsFlow', path: '../../components/session/GivePropsFlow', exportName: 'GivePropsFlow' },
    { name: 'VenueVibeRating', path: '../../components/session/VenueVibeRating', exportName: 'VenueVibeRating' },
    { name: 'GroupReveal', path: '../../components/session/GroupReveal', exportName: 'GroupReveal' },
    { name: 'CheckInButton', path: '../../components/session/CheckInButton', exportName: 'CheckInButton' },
    { name: 'AddToCalendarButton', path: '../../components/session/AddToCalendarButton', exportName: 'AddToCalendarButton' },
    { name: 'EnergyCheck', path: '../../components/session/EnergyCheck', exportName: 'EnergyCheck' },
    { name: 'FlagMemberForm', path: '../../components/session/FlagMemberForm', exportName: 'FlagMemberForm' },
    { name: 'IcebreakerEngine', path: '../../components/session/IcebreakerEngine', exportName: 'IcebreakerEngine' },
    { name: 'PhotoMoment', path: '../../components/session/PhotoMoment', exportName: 'PhotoMoment' },
    { name: 'ScrapbookPrompt', path: '../../components/session/ScrapbookPrompt', exportName: 'ScrapbookPrompt' },
    { name: 'SessionWrapUp', path: '../../components/session/SessionWrapUp', exportName: 'SessionWrapUp' },
    { name: 'SkillSwapSuggestion', path: '../../components/session/SkillSwapSuggestion', exportName: 'SkillSwapSuggestion' },
  ];

  sessionComponents.forEach(({ name, path, exportName }) => {
    it(`${name} imports without error`, async () => {
      const mod = await import(path);
      expect(mod).toBeDefined();
      expect(mod[exportName]).toBeDefined();
      expect(typeof mod[exportName]).toBe('function');
    });
  });
});

describe('Layout components load without errors', () => {
  it('BottomNav imports without error', async () => {
    const mod = await import('../../components/layout/BottomNav');
    expect(mod).toBeDefined();
    expect(mod.BottomNav).toBeDefined();
    expect(typeof mod.BottomNav).toBe('function');
  });

  it('AppShell imports without error', async () => {
    const mod = await import('../../components/layout/AppShell');
    expect(mod).toBeDefined();
    expect(mod.AppShell).toBeDefined();
    expect(typeof mod.AppShell).toBe('function');
  });

  it('TopBar imports without error', async () => {
    const mod = await import('../../components/layout/TopBar');
    expect(mod).toBeDefined();
    expect(mod.TopBar).toBeDefined();
    expect(typeof mod.TopBar).toBe('function');
  });
});

describe('ErrorBoundary loads without errors', () => {
  it('ErrorBoundary imports without error', async () => {
    const mod = await import('../../components/ErrorBoundary');
    expect(mod).toBeDefined();
    expect(mod.ErrorBoundary).toBeDefined();
    expect(typeof mod.ErrorBoundary).toBe('function');
  });
});
