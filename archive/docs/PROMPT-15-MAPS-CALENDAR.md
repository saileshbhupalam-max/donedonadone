# Prompt 15 — Map View, Location Preferences & Google Calendar Integration

Pull the codebase from: `https://github.com/saileshbhupalam-max/focusclub-find-your-people.git`

This is a React + Vite + Supabase coworking platform. The database is on Supabase, auth is Google OAuth, and the UI uses Tailwind + shadcn/ui + Radix. The app matches solo workers into groups at partner cafes in Bangalore.

---

## PART 1 — INTERACTIVE MAP VIEW (Leaflet + OpenStreetMap — free, no API key needed)

### 1.1 Install Leaflet

```bash
npm install leaflet react-leaflet @types/leaflet
```

### 1.2 Create `src/components/map/SessionMap.tsx`

Build a full-page interactive map showing:
- **Venue markers** for all active venue_partners (use `venue_partners.latitude` and `venue_partners.longitude` columns — already exist in the DB)
- **Session markers** for upcoming events at those venues (larger, colored markers)
- **User's location** as a blue pulsing dot (use `navigator.geolocation`)
- **Marker popups** showing: venue name, session date/time, spots remaining, RSVP button
- **Distance labels** showing "X.X km away" from user's location on each marker
- **Filter controls**: date range, distance radius (1km/3km/5km/10km), vibe type (deep_focus/casual_social/balanced)
- **"Sessions near me"** default view centered on user's location, zoomed to show nearest 5 venues
- **Cluster markers** when zoomed out (use `react-leaflet-cluster` or manual grouping)

Map styling:
- Use OpenStreetMap tiles (free, no API key): `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Custom marker icons: coffee cup icon for venues, colored circles for sessions (green = spots available, amber = almost full, red = full)
- Dark mode support: use dark tile layer `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png` when theme is dark (free tier available)

Default center: HSR Layout, Bangalore (12.9141, 77.6389)

### 1.3 Create `src/pages/MapView.tsx`

Full-screen map page accessible via `/map` route. Add it to App.tsx routes (protected, requires auth).

Layout:
- Map takes full viewport height minus bottom nav
- Floating search bar at top with area filter
- Bottom sheet (draggable up) showing list of nearby sessions sorted by distance
- Toggle button: "Map" / "List" to switch between map and list views

### 1.4 Add Map to bottom navigation

In the bottom nav (`src/components/layout/BottomNav.tsx`), add a Map icon between Events and Discover:
```tsx
{ to: "/map", icon: MapPin, label: "Map" }
```

Use `MapPin` from lucide-react.

### 1.5 Add "View on Map" to event cards

In the event card component (used in Events.tsx), add a small "View on Map" link/button that navigates to `/map?event={eventId}` — the map page should center on that event's venue when opened with this query param.

---

## PART 2 — LOCATION PREFERENCES

### 2.1 Create migration for location preferences

```sql
-- User location preferences
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_latitude double precision,
  ADD COLUMN IF NOT EXISTS preferred_longitude double precision,
  ADD COLUMN IF NOT EXISTS preferred_radius_km integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS preferred_neighborhoods text[] DEFAULT '{}';

-- Create index for proximity queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(preferred_latitude, preferred_longitude);

-- RPC function to find sessions near a user
CREATE OR REPLACE FUNCTION find_nearby_sessions(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km integer DEFAULT 5,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  event_id uuid,
  title text,
  date date,
  start_time text,
  end_time text,
  venue_name text,
  venue_address text,
  neighborhood text,
  venue_latitude double precision,
  venue_longitude double precision,
  max_spots integer,
  rsvp_count integer,
  distance_km double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as event_id,
    e.title,
    e.date,
    e.start_time,
    e.end_time,
    e.venue_name,
    e.venue_address,
    e.neighborhood,
    e.venue_latitude,
    e.venue_longitude,
    e.max_spots,
    e.rsvp_count,
    (6371 * 2 * asin(sqrt(
      sin(radians((e.venue_latitude - p_latitude) / 2)) ^ 2 +
      cos(radians(p_latitude)) * cos(radians(e.venue_latitude)) *
      sin(radians((e.venue_longitude - p_longitude) / 2)) ^ 2
    ))) as distance_km
  FROM events e
  WHERE e.date >= CURRENT_DATE
    AND e.venue_latitude IS NOT NULL
    AND e.venue_longitude IS NOT NULL
    AND (6371 * 2 * asin(sqrt(
      sin(radians((e.venue_latitude - p_latitude) / 2)) ^ 2 +
      cos(radians(p_latitude)) * cos(radians(e.venue_latitude)) *
      sin(radians((e.venue_longitude - p_longitude) / 2)) ^ 2
    ))) <= p_radius_km
  ORDER BY distance_km
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 2.2 Add location preference to onboarding

In the onboarding flow (Step3Preferences or a new step), add:
1. A mini map where users can tap/drag to set their preferred location
2. OR a "Use my current location" button that auto-fills
3. A radius slider: "How far are you willing to travel?" — 1km, 3km, 5km, 10km
4. Neighborhood multi-select checkboxes for: HSR Layout, Koramangala, Indiranagar, Jayanagar, Whitefield, Electronic City

Save to `profiles.preferred_latitude`, `profiles.preferred_longitude`, `profiles.preferred_radius_km`, `profiles.preferred_neighborhoods`.

### 2.3 Add location preference to Profile settings

In the Profile page (src/pages/Profile.tsx), add a "Location Preferences" section:
- Mini map showing saved preferred location
- "Update location" button
- Radius slider
- Neighborhood checkboxes
- Save button

### 2.4 Use preferences in session recommendations

On the Home page, use the `find_nearby_sessions` RPC to show "Sessions near you" section:
```typescript
const { data: nearby } = await supabase.rpc('find_nearby_sessions', {
  p_latitude: profile.preferred_latitude,
  p_longitude: profile.preferred_longitude,
  p_radius_km: profile.preferred_radius_km || 5,
  p_limit: 5,
});
```

Show these as a horizontal scrollable card list: "Sessions within {radius}km" with distance badges on each card.

---

## PART 3 — GOOGLE CALENDAR INTEGRATION

### 3.1 "Add to Google Calendar" button

After a user RSVPs to a session, show an "Add to Calendar" button. When clicked, open a Google Calendar event creation URL:

```typescript
function getGoogleCalendarUrl(event: {
  title: string;
  date: string;      // YYYY-MM-DD
  startTime: string;  // "10:00 AM"
  endTime: string;    // "12:00 PM"
  venue: string;
  venueAddress: string;
  description?: string;
}) {
  const start = formatToGCalDate(event.date, event.startTime); // YYYYMMDDTHHmmss
  const end = formatToGCalDate(event.date, event.endTime);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `FocusClub: ${event.title}`,
    dates: `${start}/${end}`,
    details: event.description || `Cowork session at ${event.venue}. Check in with FocusClub app when you arrive.`,
    location: `${event.venue}, ${event.venueAddress}`,
    ctz: 'Asia/Kolkata',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

This uses NO API key — it's just a URL that opens Google Calendar with pre-filled fields.

### 3.2 Add the button in these locations:

1. **EventDetail.tsx** — After successful RSVP, show "Add to Google Calendar" button with Calendar icon
2. **Home.tsx** — Next to upcoming RSVP'd sessions, show a small calendar icon that opens the same URL
3. **RSVP confirmation toast** — Include a "📅 Add to Calendar" link in the success toast after RSVPing

### 3.3 Create the calendar utility

Create `src/lib/calendar.ts`:

```typescript
import { format, parse } from 'date-fns';

export function getGoogleCalendarUrl(event: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
}) {
  const formatTime = (dateStr: string, timeStr: string) => {
    const parsed = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd hh:mm a', new Date());
    return format(parsed, "yyyyMMdd'T'HHmmss");
  };

  const start = formatTime(event.date, event.startTime);
  const end = formatTime(event.date, event.endTime);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `FocusClub: ${event.title}`,
    dates: `${start}/${end}`,
    details: `Cowork session at ${event.venueName}.\n\nCheck in with the FocusClub app when you arrive.\nVenue: ${event.venueName}, ${event.venueAddress}`,
    location: `${event.venueName}, ${event.venueAddress}`,
    ctz: 'Asia/Kolkata',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Also support Apple Calendar via .ics file download
export function downloadICSFile(event: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
}) {
  const formatTime = (dateStr: string, timeStr: string) => {
    const parsed = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd hh:mm a', new Date());
    return format(parsed, "yyyyMMdd'T'HHmmss");
  };

  const start = formatTime(event.date, event.startTime);
  const end = formatTime(event.date, event.endTime);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Asia/Kolkata:${start}`,
    `DTEND;TZID=Asia/Kolkata:${end}`,
    `SUMMARY:FocusClub: ${event.title}`,
    `LOCATION:${event.venueName}, ${event.venueAddress}`,
    `DESCRIPTION:Cowork session. Check in with FocusClub app.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `focusclub-${event.date}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### 3.4 Create AddToCalendarButton component

Create `src/components/session/AddToCalendarButton.tsx`:

A dropdown button with two options:
- "Google Calendar" — opens URL in new tab
- "Apple / Other Calendar" — downloads .ics file

Use shadcn DropdownMenu. Icon: `CalendarPlus` from lucide-react.

---

## PART 4 — PREFERENCE-BASED SESSION MATCHING

### 4.1 Create migration for preference collection

```sql
-- Session preferences for smart matching
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_days text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_times text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_session_duration integer DEFAULT 2;

-- preferred_days: ['monday', 'wednesday', 'friday', 'saturday']
-- preferred_times: ['morning', 'afternoon', 'evening']
-- preferred_session_duration: 2 or 4 (hours)
```

### 4.2 Add preference collection to onboarding

In the onboarding flow, add a step (or extend an existing step) that asks:

**"When do you like to work?"**
- Day chips (multi-select): Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Time chips (multi-select): Morning (8-12), Afternoon (12-5), Evening (5-9)
- Duration toggle: 2 hours / 4 hours

Save to `profiles.preferred_days`, `profiles.preferred_times`, `profiles.preferred_session_duration`.

### 4.3 Add preference editor to Profile page

In Profile settings, add a "Session Preferences" card with:
- Day picker (same chips as onboarding)
- Time picker
- Duration toggle
- Location preferences (from Part 2)
- Save button

### 4.4 Smart session recommendations on Home page

On the Home page, combine all preferences to show:
1. **"Perfect for you"** — sessions matching day + time + location + vibe preferences
2. **"Nearby this week"** — sessions within radius, this week
3. **"Try something new"** — sessions outside normal preferences (for discovery)

Use a scoring function:
```typescript
function sessionMatchScore(session, profile): number {
  let score = 0;
  // +30 if within preferred radius
  // +25 if on preferred day
  // +25 if during preferred time
  // +10 if matching vibe
  // +10 if matching duration
  return score;
}
```

Sort sessions by score descending.

---

## Implementation Notes

- **Leaflet is free** — uses OpenStreetMap tiles, no API key needed
- **Google Calendar URL** is free — no API key, no OAuth, just a URL redirect
- **ICS files** are free — just text file generation
- **All location data** uses the existing `venue_latitude` and `venue_longitude` columns (already added in a previous migration)
- Add Leaflet CSS in the component: `import 'leaflet/dist/leaflet.css'`
- Leaflet has a known issue with default marker icons in bundlers — fix with:
  ```typescript
  import L from 'leaflet';
  import markerIcon from 'leaflet/dist/images/marker-icon.png';
  import markerShadow from 'leaflet/dist/images/marker-shadow.png';
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow });
  ```
