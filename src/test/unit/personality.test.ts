import { describe, it, expect } from 'vitest';
import {
  getContextualGreeting,
  getLoadingMessage,
  ERROR_STATES,
  CONFIRMATIONS,
  CELEBRATIONS,
  COMMUNITY_LANG,
  LOADING_MESSAGES,
  EMPTY_STATES,
} from '@/lib/personality';

describe('getContextualGreeting', () => {
  it('returns a greeting with first name', () => {
    const greeting = getContextualGreeting({ firstName: 'Sailesh' });
    expect(greeting).toContain('Sailesh');
  });

  it('returns first-visit greeting when isFirstVisit is true', () => {
    const greeting = getContextualGreeting({ firstName: 'Test', isFirstVisit: true });
    expect(greeting.toLowerCase()).toContain('welcome');
  });

  it('returns a greeting for Monday', () => {
    const greeting = getContextualGreeting({ firstName: 'Test', isMonday: true });
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  });

  it('returns a greeting for Friday', () => {
    const greeting = getContextualGreeting({ firstName: 'Test', isFriday: true });
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  });

  it('returns after-first-session greeting', () => {
    const greeting = getContextualGreeting({ firstName: 'Test', afterFirstSession: true });
    expect(greeting).toContain('Test');
    expect(greeting).toContain('one of us');
  });

  it('returns comeback greeting for inactive users', () => {
    const greeting = getContextualGreeting({ firstName: 'Test', daysSinceActive: 10 });
    expect(greeting).toContain('back');
  });

  it('uses "friend" when no firstName provided', () => {
    const greeting = getContextualGreeting({ firstName: '' });
    expect(greeting).toContain('friend');
  });
});

describe('getLoadingMessage', () => {
  it('returns a string from LOADING_MESSAGES', () => {
    const msg = getLoadingMessage();
    expect(LOADING_MESSAGES).toContain(msg);
  });
});

describe('ERROR_STATES', () => {
  it('has all required error types', () => {
    expect(ERROR_STATES.generic).toBeTruthy();
    expect(ERROR_STATES.network).toBeTruthy();
    expect(ERROR_STATES.sessionFull).toBeTruthy();
    expect(ERROR_STATES.alreadyRsvpd).toBeTruthy();
  });
});

describe('CONFIRMATIONS', () => {
  it('has all required confirmation types', () => {
    expect(CONFIRMATIONS.propsSent).toBeTruthy();
    expect(CONFIRMATIONS.photoUploaded).toBeTruthy();
    expect(CONFIRMATIONS.profileSaved).toBeTruthy();
    expect(CONFIRMATIONS.intentionSet).toBeTruthy();
  });
});

describe('CELEBRATIONS', () => {
  it('has streak celebrations', () => {
    expect(CELEBRATIONS.firstSession).toBeTruthy();
    expect(CELEBRATIONS.streak3).toBeTruthy();
    expect(CELEBRATIONS.streak5).toBeTruthy();
  });
});

describe('COMMUNITY_LANG', () => {
  it('maps event to session', () => {
    expect(COMMUNITY_LANG.event).toBe('session');
  });

  it('maps events to sessions', () => {
    expect(COMMUNITY_LANG.events).toBe('sessions');
  });

  it('maps group to table', () => {
    expect(COMMUNITY_LANG.group).toBe('table');
  });

  it('maps user to member', () => {
    expect(COMMUNITY_LANG.user).toBe('member');
  });
});

describe('EMPTY_STATES', () => {
  it('has all required empty state messages', () => {
    expect(EMPTY_STATES.noSessions).toBeTruthy();
    expect(EMPTY_STATES.noMatches).toBeTruthy();
    expect(EMPTY_STATES.noProps).toBeTruthy();
  });

  it('noSearchResults is a function that returns a string', () => {
    const result = EMPTY_STATES.noSearchResults('test');
    expect(result).toContain('test');
  });
});
