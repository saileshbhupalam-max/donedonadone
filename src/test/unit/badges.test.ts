import { describe, it, expect } from 'vitest';
import { BADGE_DEFINITIONS, getBadgeDef } from '@/lib/badges';
import type { BadgeDef } from '@/lib/badges';

describe('badges', () => {
  describe('BADGE_DEFINITIONS', () => {
    it('has 17 badges', () => {
      expect(BADGE_DEFINITIONS).toHaveLength(17);
    });

    it('each badge has required fields', () => {
      BADGE_DEFINITIONS.forEach((badge: BadgeDef) => {
        expect(badge.type).toBeTruthy();
        expect(badge.emoji).toBeTruthy();
        expect(badge.name).toBeTruthy();
        expect(badge.description).toBeTruthy();
        expect(badge.hint).toBeTruthy();
      });
    });

    it('all badge types are unique', () => {
      const types = BADGE_DEFINITIONS.map(b => b.type);
      expect(new Set(types).size).toBe(types.length);
    });

    it('includes known badge types', () => {
      const types = BADGE_DEFINITIONS.map(b => b.type);
      expect(types).toContain('early_adopter');
      expect(types).toContain('complete_profile');
      expect(types).toContain('first_event');
      expect(types).toContain('connector');
      expect(types).toContain('beloved');
    });
  });

  describe('getBadgeDef', () => {
    it('returns correct badge for early_adopter', () => {
      const badge = getBadgeDef('early_adopter');
      expect(badge).toBeDefined();
      expect(badge!.name).toBe('Early Adopter');
      expect(badge!.emoji).toBe('\u{1F331}');
    });

    it('returns correct badge for complete_profile', () => {
      const badge = getBadgeDef('complete_profile');
      expect(badge).toBeDefined();
      expect(badge!.name).toBe('Complete Profile');
    });

    it('returns correct badge for connector', () => {
      const badge = getBadgeDef('connector');
      expect(badge).toBeDefined();
      expect(badge!.name).toBe('Connector');
    });

    it('returns correct badge for beloved', () => {
      const badge = getBadgeDef('beloved');
      expect(badge).toBeDefined();
      expect(badge!.description).toContain('50+ total props');
    });

    it('returns undefined for unknown type', () => {
      expect(getBadgeDef('nonexistent_badge')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getBadgeDef('')).toBeUndefined();
    });
  });
});
