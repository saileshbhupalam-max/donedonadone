import { describe, it, expect } from 'vitest';
import { calculateMatch, calculateProfileCompletion } from '@/lib/matchUtils';

function makeProfile(overrides: Record<string, any> = {}): any {
  return {
    id: 'test',
    display_name: null,
    avatar_url: null,
    tagline: null,
    what_i_do: null,
    work_vibe: null,
    looking_for: [],
    can_offer: [],
    interests: [],
    neighborhood: null,
    noise_preference: null,
    communication_style: null,
    gender: null,
    linkedin_url: null,
    instagram_handle: null,
    twitter_handle: null,
    profile_completion: 0,
    created_at: '2026-03-15',
    ...overrides,
  };
}

describe('matchUtils', () => {
  describe('calculateMatch', () => {
    it('returns 0 score and no reasons for empty profiles', () => {
      const a = makeProfile();
      const b = makeProfile({ id: 'other' });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('adds +20 for same work vibe', () => {
      const a = makeProfile({ work_vibe: 'deep_focus' });
      const b = makeProfile({ id: 'b', work_vibe: 'deep_focus' });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(20);
      expect(result.reasons).toContainEqual(expect.stringContaining('Deep Focus'));
    });

    it('adds +15 for same neighborhood', () => {
      const a = makeProfile({ neighborhood: 'HSR Layout' });
      const b = makeProfile({ id: 'b', neighborhood: 'HSR Layout' });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(15);
      expect(result.reasons).toContainEqual(expect.stringContaining('HSR Layout'));
    });

    it('adds +15 per looking_for that matches can_offer', () => {
      const a = makeProfile({ looking_for: ['mentoring', 'accountability'] });
      const b = makeProfile({ id: 'b', can_offer: ['mentoring', 'accountability'] });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(30);
    });

    it('adds +10 per can_offer that matches looking_for', () => {
      const a = makeProfile({ can_offer: ['design', 'coding'] });
      const b = makeProfile({ id: 'b', looking_for: ['design', 'coding'] });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(20);
    });

    it('adds +5 per shared interest', () => {
      const a = makeProfile({ interests: ['music', 'hiking', 'coding'] });
      const b = makeProfile({ id: 'b', interests: ['music', 'hiking'] });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(10);
      expect(result.reasons).toContainEqual(expect.stringContaining('Shared interests'));
    });

    it('adds +5 for same noise preference', () => {
      const a = makeProfile({ noise_preference: 'quiet' });
      const b = makeProfile({ id: 'b', noise_preference: 'quiet' });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(5);
    });

    it('adds +5 for same communication style', () => {
      const a = makeProfile({ communication_style: 'chat' });
      const b = makeProfile({ id: 'b', communication_style: 'chat' });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(5);
    });

    it('caps score at 100', () => {
      const a = makeProfile({
        work_vibe: 'deep_focus',
        neighborhood: 'HSR Layout',
        noise_preference: 'quiet',
        communication_style: 'chat',
        looking_for: ['a', 'b', 'c', 'd'],
        can_offer: ['x', 'y', 'z'],
        interests: ['i1', 'i2', 'i3', 'i4', 'i5'],
      });
      const b = makeProfile({
        id: 'b',
        work_vibe: 'deep_focus',
        neighborhood: 'HSR Layout',
        noise_preference: 'quiet',
        communication_style: 'chat',
        can_offer: ['a', 'b', 'c', 'd'],
        looking_for: ['x', 'y', 'z'],
        interests: ['i1', 'i2', 'i3', 'i4', 'i5'],
      });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(100);
    });

    it('limits reasons to 4', () => {
      const a = makeProfile({
        work_vibe: 'deep_focus',
        neighborhood: 'HSR Layout',
        looking_for: ['a', 'b', 'c'],
        interests: ['i1'],
      });
      const b = makeProfile({
        id: 'b',
        work_vibe: 'deep_focus',
        neighborhood: 'HSR Layout',
        can_offer: ['a', 'b', 'c'],
        interests: ['i1'],
      });
      const result = calculateMatch(a, b);
      expect(result.reasons.length).toBeLessThanOrEqual(4);
    });

    it('does not match when vibes differ', () => {
      const a = makeProfile({ work_vibe: 'deep_focus' });
      const b = makeProfile({ id: 'b', work_vibe: 'casual_social' });
      const result = calculateMatch(a, b);
      expect(result.score).toBe(0);
    });
  });

  describe('calculateProfileCompletion', () => {
    it('returns 0 for empty profile', () => {
      const profile = makeProfile();
      expect(calculateProfileCompletion(profile)).toBe(0);
    });

    it('returns 100 for fully filled profile', () => {
      const profile = makeProfile({
        display_name: 'Alice',
        avatar_url: 'https://example.com/pic.jpg',
        tagline: 'Focused worker',
        what_i_do: 'Software engineer',
        looking_for: ['accountability'],
        can_offer: ['mentoring'],
        work_vibe: 'deep_focus',
        linkedin_url: 'https://linkedin.com/in/alice',
        interests: ['coding'],
        gender: 'woman',
        neighborhood: 'HSR Layout',
      });
      expect(calculateProfileCompletion(profile)).toBe(100);
    });

    it('returns partial completion for some fields', () => {
      const profile = makeProfile({
        display_name: 'Alice',
        avatar_url: 'https://example.com/pic.jpg',
        tagline: 'Hello',
      });
      // display_name: 10 + avatar_url: 10 + tagline: 10 = 30
      expect(calculateProfileCompletion(profile)).toBe(30);
    });

    it('gives 10 for any single social link', () => {
      const withLinkedin = makeProfile({ linkedin_url: 'https://linkedin.com/in/x' });
      expect(calculateProfileCompletion(withLinkedin)).toBe(10);

      const withInsta = makeProfile({ instagram_handle: '@alice' });
      expect(calculateProfileCompletion(withInsta)).toBe(10);

      const withTwitter = makeProfile({ twitter_handle: '@alice' });
      expect(calculateProfileCompletion(withTwitter)).toBe(10);
    });

    it('does not double-count multiple social links', () => {
      const profile = makeProfile({
        linkedin_url: 'https://linkedin.com/in/x',
        instagram_handle: '@alice',
        twitter_handle: '@alice',
      });
      // Social counts as one 10-point block
      expect(calculateProfileCompletion(profile)).toBe(10);
    });

    it('counts what_i_do as 15 points', () => {
      const profile = makeProfile({ what_i_do: 'Designer' });
      expect(calculateProfileCompletion(profile)).toBe(15);
    });
  });
});
