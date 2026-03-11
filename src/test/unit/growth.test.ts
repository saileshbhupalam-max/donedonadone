import { describe, it, expect } from 'vitest';
import { MILESTONES } from '@/lib/growth';
import type { MilestoneDef } from '@/lib/growth';

describe('growth', () => {
  describe('MILESTONES', () => {
    const milestoneEntries = Object.entries(MILESTONES);

    it('has 22 milestones', () => {
      expect(milestoneEntries).toHaveLength(22);
    });

    it('each milestone has required fields', () => {
      milestoneEntries.forEach(([key, m]) => {
        expect(m.type).toBeTruthy();
        expect(m.emoji).toBeTruthy();
        expect(m.title).toBeTruthy();
        expect(m.description).toBeTruthy();
        expect(typeof m.shareMessage).toBe('function');
      });
    });

    it('milestone types are unique', () => {
      const types = milestoneEntries.map(([, m]) => m.type);
      expect(new Set(types).size).toBe(types.length);
    });

    it('milestone key matches its type field', () => {
      milestoneEntries.forEach(([key, m]) => {
        expect(m.type).toBe(key);
      });
    });

    it('shareMessage returns a string', () => {
      milestoneEntries.forEach(([, m]) => {
        const msg = m.shareMessage();
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      });
    });

    it('shareMessage includes referral code when provided', () => {
      milestoneEntries.forEach(([, m]) => {
        const msg = m.shareMessage('TESTREF');
        expect(msg).toContain('TESTREF');
      });
    });

    it('shareMessage includes invite link', () => {
      milestoneEntries.forEach(([, m]) => {
        const msg = m.shareMessage();
        expect(msg).toContain('/invite/');
      });
    });

    it('includes event milestones', () => {
      expect(MILESTONES.first_event).toBeDefined();
      expect(MILESTONES.events_3).toBeDefined();
      expect(MILESTONES.events_5).toBeDefined();
      expect(MILESTONES.events_10).toBeDefined();
      expect(MILESTONES.events_25).toBeDefined();
      expect(MILESTONES.events_50).toBeDefined();
    });

    it('includes streak milestones', () => {
      expect(MILESTONES.streak_3).toBeDefined();
      expect(MILESTONES.streak_5).toBeDefined();
      expect(MILESTONES.streak_10).toBeDefined();
    });

    it('includes referral milestones', () => {
      expect(MILESTONES.referral_1).toBeDefined();
      expect(MILESTONES.referral_3).toBeDefined();
      expect(MILESTONES.referral_10).toBeDefined();
    });

    it('includes membership duration milestones', () => {
      expect(MILESTONES.member_1_month).toBeDefined();
      expect(MILESTONES.member_3_months).toBeDefined();
      expect(MILESTONES.member_6_months).toBeDefined();
      expect(MILESTONES.member_1_year).toBeDefined();
    });

    it('includes props milestones', () => {
      expect(MILESTONES.first_prop_given).toBeDefined();
      expect(MILESTONES.first_prop_received).toBeDefined();
      expect(MILESTONES.props_received_25).toBeDefined();
      expect(MILESTONES.props_received_50).toBeDefined();
    });
  });
});
