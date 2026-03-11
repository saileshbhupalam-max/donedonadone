import { describe, it, expect } from 'vitest';
import {
  getEventShareMessage,
  getPromptShareMessage,
  getProfileShareMessage,
  getBadgeShareMessage,
} from '@/lib/sharing';

describe('sharing', () => {
  describe('getEventShareMessage', () => {
    it('includes event title', () => {
      const msg = getEventShareMessage(
        { title: 'Morning Focus', date: '2026-03-15', id: 'evt-1' },
        0,
      );
      expect(msg).toContain('Morning Focus');
    });

    it('includes formatted date', () => {
      const msg = getEventShareMessage(
        { title: 'Session', date: '2026-03-15', id: 'evt-1' },
        0,
      );
      // March 15 2026 is a Sunday
      expect(msg).toContain('Sunday');
      expect(msg).toContain('Mar 15');
    });

    it('includes venue name and neighborhood', () => {
      const msg = getEventShareMessage(
        {
          title: 'Session',
          date: '2026-03-15',
          id: 'evt-1',
          venue_name: 'Third Wave Coffee',
          neighborhood: 'HSR Layout',
        },
        0,
      );
      expect(msg).toContain('Third Wave Coffee');
      expect(msg).toContain('HSR Layout');
    });

    it('includes start time when provided', () => {
      const msg = getEventShareMessage(
        { title: 'Session', date: '2026-03-15', start_time: '10:00 AM', id: 'evt-1' },
        0,
      );
      expect(msg).toContain('10:00 AM');
    });

    it('includes event link', () => {
      const msg = getEventShareMessage(
        { title: 'Session', date: '2026-03-15', id: 'evt-123' },
        0,
      );
      expect(msg).toContain('/events/evt-123');
    });

    it('includes going count when positive', () => {
      const msg = getEventShareMessage(
        { title: 'Session', date: '2026-03-15', id: 'evt-1' },
        5,
      );
      expect(msg).toContain('5 people going');
    });

    it('appends referral code to link', () => {
      const msg = getEventShareMessage(
        { title: 'Session', date: '2026-03-15', id: 'evt-1' },
        0,
        'ABC123',
      );
      expect(msg).toContain('?ref=ABC123');
    });
  });

  describe('getPromptShareMessage', () => {
    it('includes question and answer', () => {
      const msg = getPromptShareMessage('What motivates you?', 'Building things');
      expect(msg).toContain('What motivates you?');
      expect(msg).toContain('Building things');
    });

    it('truncates long answers to 100 chars with ellipsis', () => {
      const longAnswer = 'A'.repeat(150);
      const msg = getPromptShareMessage('Question?', longAnswer);
      expect(msg).toContain('A'.repeat(100) + '...');
      expect(msg).not.toContain('A'.repeat(101));
    });

    it('does not truncate short answers', () => {
      const msg = getPromptShareMessage('Q?', 'Short answer');
      expect(msg).toContain('"Short answer"');
    });

    it('appends referral code', () => {
      const msg = getPromptShareMessage('Q?', 'A', 'REF99');
      expect(msg).toContain('?ref=REF99');
    });
  });

  describe('getProfileShareMessage', () => {
    it('includes profile link with profile id', () => {
      const msg = getProfileShareMessage('Alice', 'user-123');
      expect(msg).toContain('/profile/user-123');
    });

    it('mentions FocusClub and Bangalore', () => {
      const msg = getProfileShareMessage('Alice', 'user-123');
      expect(msg).toContain('FocusClub');
      expect(msg).toContain('Bangalore');
    });

    it('appends referral code', () => {
      const msg = getProfileShareMessage('Alice', 'user-123', 'MYREF');
      expect(msg).toContain('?ref=MYREF');
    });
  });

  describe('getBadgeShareMessage', () => {
    it('includes badge name and emoji', () => {
      const msg = getBadgeShareMessage('🌱', 'Early Adopter', 'Joined early');
      expect(msg).toContain('🌱');
      expect(msg).toContain('Early Adopter');
    });

    it('includes badge description', () => {
      const msg = getBadgeShareMessage('🌱', 'Early Adopter', 'Joined FocusClub early');
      expect(msg).toContain('Joined FocusClub early');
    });

    it('appends referral code to link', () => {
      const msg = getBadgeShareMessage('🌱', 'Early Adopter', 'Desc', 'BADGEREF');
      expect(msg).toContain('?ref=BADGEREF');
    });

    it('includes join link', () => {
      const msg = getBadgeShareMessage('🌱', 'Early Adopter', 'Desc');
      expect(msg).toContain('Join us:');
    });
  });
});
