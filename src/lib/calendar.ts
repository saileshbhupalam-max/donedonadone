/**
 * @module calendar
 * @description Google Calendar URL generation and ICS file download for session events.
 * Handles both 12hr and 24hr time format parsing with fallbacks.
 *
 * Key exports:
 * - getGoogleCalendarUrl() — Returns a Google Calendar "add event" URL with session details
 * - downloadICSFile() — Generates and triggers download of an .ics calendar file
 *
 * Dependencies: date-fns (format, parse)
 * Side effects: downloadICSFile() creates a Blob and triggers a browser download
 * Related: AddToCalendarButton.tsx (UI component that calls these functions)
 */
import { format, parse, parseISO } from 'date-fns';

export function getGoogleCalendarUrl(event: {
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
}) {
  const formatTime = (dateStr: string, timeStr: string) => {
    try {
      const parsed = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd hh:mm a', new Date());
      return format(parsed, "yyyyMMdd'T'HHmmss");
    } catch {
      // Fallback: try 24h format
      try {
        const parsed = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
        return format(parsed, "yyyyMMdd'T'HHmmss");
      } catch {
        return format(parseISO(dateStr), "yyyyMMdd'T'HHmmss");
      }
    }
  };

  const start = event.startTime ? formatTime(event.date, event.startTime) : format(parseISO(event.date), "yyyyMMdd");
  const end = event.endTime ? formatTime(event.date, event.endTime) : start;

  const location = [event.venueName, event.venueAddress].filter(Boolean).join(', ');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `DanaDone: ${event.title}`,
    dates: `${start}/${end}`,
    details: `Cowork session${event.venueName ? ` at ${event.venueName}` : ''}.\n\nCheck in with the DanaDone app when you arrive.`,
    location,
    ctz: 'Asia/Kolkata',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadICSFile(event: {
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
}) {
  const formatTime = (dateStr: string, timeStr: string) => {
    try {
      const parsed = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd hh:mm a', new Date());
      return format(parsed, "yyyyMMdd'T'HHmmss");
    } catch {
      try {
        const parsed = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
        return format(parsed, "yyyyMMdd'T'HHmmss");
      } catch {
        return format(parseISO(dateStr), "yyyyMMdd'T'HHmmss");
      }
    }
  };

  const start = event.startTime ? formatTime(event.date, event.startTime) : format(parseISO(event.date), "yyyyMMdd");
  const end = event.endTime ? formatTime(event.date, event.endTime) : start;
  const location = [event.venueName, event.venueAddress].filter(Boolean).join(', ');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//danadone//EN',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Asia/Kolkata:${start}`,
    `DTEND;TZID=Asia/Kolkata:${end}`,
    `SUMMARY:DanaDone: ${event.title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:Cowork session. Check in with the DanaDone app.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `danadone-${event.date}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
