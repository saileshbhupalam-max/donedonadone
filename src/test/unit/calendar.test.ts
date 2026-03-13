import { describe, it, expect } from 'vitest';
import { getGoogleCalendarUrl } from '@/lib/calendar';

describe('calendar', () => {
  describe('getGoogleCalendarUrl', () => {
    it('returns a valid Google Calendar URL', () => {
      const url = getGoogleCalendarUrl({
        title: 'Morning Focus',
        date: '2026-03-15',
        startTime: '10:00 AM',
        endTime: '12:00 PM',
        venueName: 'Third Wave Coffee',
        venueAddress: 'HSR Layout',
      });
      expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    });

    it('contains correct title with donedonadone prefix', () => {
      const url = getGoogleCalendarUrl({
        title: 'Deep Work Session',
        date: '2026-03-15',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('text')).toBe('donedonadone: Deep Work Session');
    });

    it('contains correct dates for AM times', () => {
      const url = getGoogleCalendarUrl({
        title: 'Morning Focus',
        date: '2026-03-15',
        startTime: '10:00 AM',
        endTime: '12:00 PM',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      const dates = params.get('dates')!;
      const [start, end] = dates.split('/');
      // 10:00 AM -> T100000
      expect(start).toContain('T100000');
      // 12:00 PM -> T120000
      expect(end).toContain('T120000');
    });

    it('handles PM times correctly', () => {
      const url = getGoogleCalendarUrl({
        title: 'Afternoon Session',
        date: '2026-03-15',
        startTime: '02:00 PM',
        endTime: '04:00 PM',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      const dates = params.get('dates')!;
      const [start, end] = dates.split('/');
      // 2:00 PM -> 14:00 -> T140000
      expect(start).toContain('T140000');
      // 4:00 PM -> 16:00 -> T160000
      expect(end).toContain('T160000');
    });

    it('contains location from venue name and address', () => {
      const url = getGoogleCalendarUrl({
        title: 'Session',
        date: '2026-03-15',
        venueName: 'Third Wave Coffee',
        venueAddress: '27th Main, HSR Layout',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('location')).toBe('Third Wave Coffee, 27th Main, HSR Layout');
    });

    it('handles missing optional fields gracefully', () => {
      const url = getGoogleCalendarUrl({
        title: 'Session',
        date: '2026-03-15',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('text')).toBe('donedonadone: Session');
      expect(params.get('location')).toBe('');
      expect(params.get('action')).toBe('TEMPLATE');
    });

    it('uses Asia/Kolkata timezone', () => {
      const url = getGoogleCalendarUrl({
        title: 'Session',
        date: '2026-03-15',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('ctz')).toBe('Asia/Kolkata');
    });

    it('handles null startTime and endTime', () => {
      const url = getGoogleCalendarUrl({
        title: 'All Day',
        date: '2026-03-15',
        startTime: null,
        endTime: null,
      });
      const params = new URLSearchParams(url.split('?')[1]);
      const dates = params.get('dates')!;
      // When no times, should use date-only format
      expect(dates).toContain('20260315');
    });

    it('includes session details in description', () => {
      const url = getGoogleCalendarUrl({
        title: 'Session',
        date: '2026-03-15',
        venueName: 'Cafe XYZ',
      });
      const params = new URLSearchParams(url.split('?')[1]);
      const details = params.get('details')!;
      expect(details).toContain('Cafe XYZ');
      expect(details).toContain('Check in with the donedonadone app');
    });
  });
});
