import { describe, it, expect } from 'vitest';
import { sessionMatchScore } from '@/lib/sessionMatch';

describe('sessionMatch', () => {
  describe('sessionMatchScore', () => {
    it('returns 0 with no preferences', () => {
      const session = { date: '2026-03-15', start_time: '10:00 AM' };
      const prefs = {};
      expect(sessionMatchScore(session, prefs)).toBe(0);
    });

    it('adds +30 when within preferred radius', () => {
      const session = { date: '2026-03-15', distance_km: 2 };
      const prefs = { preferred_radius_km: 5 };
      expect(sessionMatchScore(session, prefs)).toBe(30);
    });

    it('does not add radius score when beyond preferred radius', () => {
      const session = { date: '2026-03-15', distance_km: 10 };
      const prefs = { preferred_radius_km: 5 };
      expect(sessionMatchScore(session, prefs)).toBe(0);
    });

    it('adds +25 for preferred day', () => {
      // 2026-03-15 is a Sunday
      const session = { date: '2026-03-15' };
      const prefs = { preferred_days: ['sunday'] };
      expect(sessionMatchScore(session, prefs)).toBe(25);
    });

    it('does not add day score for non-preferred day', () => {
      // 2026-03-15 is a Sunday
      const session = { date: '2026-03-15' };
      const prefs = { preferred_days: ['monday', 'tuesday'] };
      expect(sessionMatchScore(session, prefs)).toBe(0);
    });

    it('adds +25 for preferred morning time (AM)', () => {
      const session = { date: '2026-03-15', start_time: '9:00 AM' };
      const prefs = { preferred_times: ['morning'] };
      expect(sessionMatchScore(session, prefs)).toBe(25);
    });

    it('adds +25 for preferred afternoon time (PM)', () => {
      const session = { date: '2026-03-15', start_time: '2:00 PM' };
      const prefs = { preferred_times: ['afternoon'] };
      expect(sessionMatchScore(session, prefs)).toBe(25);
    });

    it('adds +25 for preferred evening time', () => {
      const session = { date: '2026-03-15', start_time: '6:00 PM' };
      const prefs = { preferred_times: ['evening'] };
      expect(sessionMatchScore(session, prefs)).toBe(25);
    });

    it('classifies 12 PM as afternoon', () => {
      const session = { date: '2026-03-15', start_time: '12:00 PM' };
      const prefs = { preferred_times: ['afternoon'] };
      expect(sessionMatchScore(session, prefs)).toBe(25);
    });

    it('classifies 12 AM as evening (hour 0)', () => {
      const session = { date: '2026-03-15', start_time: '12:00 AM' };
      const prefs = { preferred_times: ['evening'] };
      expect(sessionMatchScore(session, prefs)).toBe(25);
    });

    it('adds +10 for matching vibe (deep_focus -> structured_4hr)', () => {
      const session = { date: '2026-03-15', session_format: 'structured_4hr' };
      const prefs = { work_vibe: 'deep_focus' };
      expect(sessionMatchScore(session, prefs)).toBe(10);
    });

    it('adds +10 for matching vibe (casual_social -> casual)', () => {
      const session = { date: '2026-03-15', session_format: 'casual' };
      const prefs = { work_vibe: 'casual_social' };
      expect(sessionMatchScore(session, prefs)).toBe(10);
    });

    it('adds +10 for matching duration (2hr)', () => {
      const session = { date: '2026-03-15', session_format: 'structured_2hr' };
      const prefs = { preferred_session_duration: 2 };
      expect(sessionMatchScore(session, prefs)).toBe(10);
    });

    it('adds +10 for matching duration (4hr)', () => {
      const session = { date: '2026-03-15', session_format: 'structured_4hr' };
      const prefs = { preferred_session_duration: 4 };
      expect(sessionMatchScore(session, prefs)).toBe(10);
    });

    it('casual format matches 2hr duration preference', () => {
      const session = { date: '2026-03-15', session_format: 'casual' };
      const prefs = { preferred_session_duration: 2 };
      expect(sessionMatchScore(session, prefs)).toBe(10);
    });

    it('returns 100 for full match', () => {
      // 2026-03-16 is Monday
      const session = {
        date: '2026-03-16',
        start_time: '10:00 AM',
        session_format: 'structured_4hr',
        distance_km: 1,
      };
      const prefs = {
        preferred_radius_km: 5,
        preferred_days: ['monday'],
        preferred_times: ['morning'],
        work_vibe: 'deep_focus',
        preferred_session_duration: 4,
      };
      expect(sessionMatchScore(session, prefs)).toBe(100);
    });

    it('handles null start_time gracefully', () => {
      const session = { date: '2026-03-15', start_time: null };
      const prefs = { preferred_times: ['morning'] };
      expect(sessionMatchScore(session, prefs)).toBe(0);
    });
  });
});
