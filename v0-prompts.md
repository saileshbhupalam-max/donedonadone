# donedonadone — v0 Prompt Series (v2 — Updated for v0 Git Import)

## Strategy Change (Based on Research)

v0 now supports **Git Import** — you can import a GitHub repo into v0 and work on it as a persistent project. Each prompt in a chat session builds on ALL previous code. This is far better than 8 disconnected generations.

### New Workflow
1. **This GitHub repo** has been created with a PRODUCT.md and research docs
2. **Import this repo into v0** via Git Import (v0.app → New Chat → Import GitHub Repo)
3. **Work in ONE v0 project chat** — paste prompts sequentially, each builds on the last
4. **v0 auto-pushes to GitHub** — every change is committed
5. **Connect Supabase** — when v0 prompts you, create a Supabase project (one-click)
6. **Deploy to Vercel** — one-click from v0

### Credit Budget ($15)
- Use the **standard model** (not advanced) for all prompts
- ~5 focused prompts, each generating significant code
- Iterate with small follow-ups ("make X more compact", "fix Y") which cost less
- Total estimated: $10-15 depending on iteration

---

## Step 0: Import into v0

Go to https://v0.app, start a new chat, and import this GitHub repository. Once imported, v0 will have context of PRODUCT.md and all files. Then paste the prompts below one by one.

---

## Prompt 1: Foundation — Full App Scaffold + Landing Page + Supabase Schema

This is the biggest prompt. It scaffolds the entire application structure.

```
I've imported my GitHub repo for "donedonadone" — a group coworking platform. Read the PRODUCT.md file for full product requirements.

Build the complete foundation for this app:

## 1. Project Setup
- Next.js 14 App Router with TypeScript
- Tailwind CSS with the design system from PRODUCT.md (amber-500 primary, teal-600 secondary, stone-50 bg, violet-500 accent)
- shadcn/ui components (install Button, Card, Badge, Input, Select, Dialog, Sheet, Tabs, Avatar, Progress, Calendar, DropdownMenu, Separator, Textarea, Label, RadioGroup, Checkbox, Slider, Toast)
- Set up Supabase integration (connect via Vercel Marketplace)
- Configure Supabase client (lib/supabase/client.ts for browser, lib/supabase/server.ts for server components)

## 2. Database Schema (execute SQL in Supabase)
Create ALL tables from PRODUCT.md. Here's the complete schema:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_type AS ENUM ('coworker', 'partner', 'admin');
CREATE TYPE work_type AS ENUM ('freelancer', 'startup_founder', 'remote_employee', 'student', 'creator', 'other');
CREATE TYPE work_vibe AS ENUM ('deep_focus', 'casual_social', 'balanced');
CREATE TYPE noise_pref AS ENUM ('silent', 'ambient', 'lively');
CREATE TYPE break_freq AS ENUM ('pomodoro', 'hourly', 'deep_stretch', 'flexible');
CREATE TYPE comm_style AS ENUM ('minimal', 'moderate', 'chatty');
CREATE TYPE venue_type AS ENUM ('cafe', 'coworking_space', 'other');
CREATE TYPE venue_status AS ENUM ('pending', 'active', 'inactive');
CREATE TYPE session_status AS ENUM ('upcoming', 'in_progress', 'completed', 'cancelled');
CREATE TYPE booking_status AS ENUM ('pending', 'payment_pending', 'paid', 'confirmed', 'refunded', 'cancelled');
CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'expired');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  user_type user_type DEFAULT 'coworker',
  work_type work_type,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coworker Preferences (quiz answers)
CREATE TABLE coworker_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  work_vibe work_vibe,
  noise_preference noise_pref,
  break_frequency break_freq,
  productive_times TEXT[] DEFAULT '{}',
  social_goals TEXT[] DEFAULT '{}',
  introvert_extrovert INTEGER CHECK (introvert_extrovert BETWEEN 1 AND 5),
  communication_style comm_style,
  bio TEXT CHECK (char_length(bio) <= 200),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'HSR Layout',
  lat DECIMAL,
  lng DECIMAL,
  venue_type venue_type DEFAULT 'cafe',
  amenities TEXT[] DEFAULT '{}',
  included_in_cover TEXT,
  venue_rules TEXT,
  max_capacity INTEGER NOT NULL DEFAULT 20,
  photos TEXT[] DEFAULT '{}',
  status venue_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (time slots at venues)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours INTEGER NOT NULL CHECK (duration_hours IN (2, 4)),
  platform_fee INTEGER NOT NULL,
  venue_price INTEGER NOT NULL,
  total_price INTEGER GENERATED ALWAYS AS (platform_fee + venue_price) STORED,
  max_spots INTEGER NOT NULL DEFAULT 20,
  spots_filled INTEGER NOT NULL DEFAULT 0,
  group_size INTEGER NOT NULL DEFAULT 4 CHECK (group_size BETWEEN 3 AND 5),
  status session_status DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_date_status ON sessions(date, status);
CREATE INDEX idx_sessions_venue ON sessions(venue_id, date);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  table_assignment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, group_number)
);

-- Group Members
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  group_id UUID REFERENCES groups(id),
  payment_amount INTEGER NOT NULL,
  payment_status booking_status DEFAULT 'pending',
  payment_reference TEXT,
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Session Feedback
CREATE TABLE session_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE REFERENCES bookings(id),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member Ratings
CREATE TABLE member_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user UUID REFERENCES profiles(id),
  to_user UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  would_cowork_again BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user, to_user, session_id)
);

-- Waitlist
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  position INTEGER NOT NULL,
  status waitlist_status DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Atomic booking function (prevents overbooking)
CREATE OR REPLACE FUNCTION book_session(p_session_id UUID, p_user_id UUID)
RETURNS bookings AS $$
DECLARE
  v_booking bookings;
  v_session sessions;
BEGIN
  UPDATE sessions
  SET spots_filled = spots_filled + 1, updated_at = NOW()
  WHERE id = p_session_id AND spots_filled < max_spots AND status = 'upcoming'
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session is full or unavailable';
  END IF;

  INSERT INTO bookings (user_id, session_id, payment_amount, payment_status)
  VALUES (p_user_id, p_session_id, v_session.total_price, 'pending')
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coworker_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Profiles: read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Preferences: own only
CREATE POLICY "Users can view own preferences" ON coworker_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own preferences" ON coworker_preferences FOR ALL USING (auth.uid() = user_id);

-- Venues: read active, partners manage own
CREATE POLICY "Active venues viewable by all" ON venues FOR SELECT USING (status = 'active' OR partner_id = auth.uid());
CREATE POLICY "Partners manage own venues" ON venues FOR ALL USING (partner_id = auth.uid());

-- Sessions: read upcoming, manage own venue's sessions
CREATE POLICY "Upcoming sessions viewable by all" ON sessions FOR SELECT USING (true);

-- Bookings: own only, admins all
CREATE POLICY "Users view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 3. App Layout
Create the authenticated app shell:
- **Desktop**: Left sidebar (240px) with logo + nav items: Home, Sessions, My Bookings, Profile. User avatar + name at bottom.
- **Mobile**: Bottom tab bar with 4 tabs: Home, Sessions, Bookings, Profile (icons + labels)
- **Top bar**: "Hey, [name] 👋" greeting (left), notification bell (right)
- **Main content area**: Scrollable, max-w-6xl centered

## 4. Landing Page (/)
Public marketing page with:
- **Navbar**: "donedonadone" logo (lowercase, friendly), "How it Works", "Venues", "Pricing" links, "Sign In" (outline) and "Book a Seat" (amber filled) buttons
- **Hero**: "Stop working alone. Start working together." / "Join a small group of 3-5 people at curated cafes and coworking spaces in HSR Layout. Book a 2 or 4-hour session, show up, get stuff done." / Two CTAs: "Browse Sessions" (amber) + "How it works" (text link)
- **How It Works**: 3 steps — Pick a session (calendar icon), Get grouped (users icon), Show up & do the work (laptop icon)
- **Venue Showcase**: Horizontal scroll of 6 venue cards with realistic HSR cafe names (Third Wave Coffee, Dialogues Cafe, Blue Tokai, The Hive, JEEF Cowork, Hole in the Wall). Each card: gradient placeholder photo, name, "HSR Layout" tag, type badge, amenity icons, "View sessions →"
- **Pricing**: Two cards — "Focus Session" (2hr, ₹299-499) and "Deep Work Session" (4hr, ₹499-799)
- **Social Proof**: "Join 1,000+ coworkers in HSR Layout", overlapping avatar circles, stats (sessions hosted, groups formed, venues)
- **Footer**: About, FAQ, Partner with us, Contact. "Made with ☕ in HSR Layout"

## 5. Auth
Set up Supabase Auth:
- Sign up with Google OAuth + Email magic link
- After signup, auto-create a profile row in profiles table
- Protected routes: /dashboard, /sessions, /bookings, /profile
- Redirect unauthenticated users to /login
- Auth pages: /login and /signup with clean, branded UI

## 6. Seed Data
Insert realistic seed data:
- 8 venues in HSR Layout with realistic names, addresses, amenities
- 20+ sessions over the next 7 days across venues (mix of 2hr and 4hr, various times)
- Prices: venue_price between ₹199-649, platform_fee ₹100 or ₹150
- Varied spots_filled (some nearly full, some empty, some full with waitlist)

Make everything mobile-first responsive. Use mock/seed data for the landing page.
```

---

## Prompt 2: Session Discovery + Booking + UPI Payment

```
Now build the core user experience — session discovery and booking with UPI QR payment.

## Session Discovery Page (/sessions)

### Filter Bar (sticky top, horizontal scroll on mobile)
- **Date**: Next 7 days as pill buttons (today highlighted), tap to open full calendar
- **Time**: "Morning (8-12)", "Afternoon (12-4)", "Evening (4-8)" toggle pills, multi-select
- **Duration**: "2 hours" / "4 hours" toggle
- **Sort**: "Price: Low to High" / "Most spots left" dropdown

### Session Cards (vertical scrollable list)
Each card shows:
- Venue thumbnail (left, square, gradient placeholder) with venue type badge overlay
- Venue name (bold) + "HSR Layout" tag
- Time: "10:00 AM - 12:00 PM" with "2 hrs" badge
- Date: "Tomorrow, Feb 10"
- Price: "₹349" with small "(₹100 platform + ₹249 venue)" breakdown
- Spots: Progress bar — "4 of 20 spots left" (amber when <5, red when <2)
- Amenity icons row (wifi, power, food, AC)
- "Book Seat" button (amber). If full: "Join Waitlist" (outline)

### Empty State
"No sessions match your filters. Try a different date or time."

## Booking Flow (bottom sheet on mobile, side panel on desktop)

Triggered by tapping "Book Seat":

1. **Session summary**: Venue name, address (with "Open in Maps" link), date, time, duration
2. **Venue details** (collapsible): Amenities, what's included in cover, rules
3. **Price breakdown**: Platform fee ₹100/150 + Venue charge ₹XXX = Total ₹XXX
4. **Group info**: "You'll be seated with 2-4 other coworkers. Groups are assigned 1 hour before the session."
5. **UPI Payment Section**:
   - "Pay ₹XXX via UPI"
   - Generate a QR code using the UPI deep link format: `upi://pay?pa=donedonadone@okicici&pn=donedonadone&am={amount}&cu=INR&tn=Session-{bookingId}`
   - Display the QR code prominently (use the `qrcode` npm package to generate from the UPI URI string)
   - Below QR: "Scan with any UPI app (GPay, PhonePe, Paytm)"
   - On mobile: "Pay Now" button that opens UPI intent link (same URI but as a clickable link)
   - Below: "I've completed the payment" button (teal)
6. **After clicking "I've paid"**:
   - Show "Payment verification pending" state with a spinner
   - "Your booking is confirmed! Our team will verify the payment shortly."
   - Session details card
   - "Your group will be revealed 1 hour before the session ✨"
   - "Add to Calendar" button (generate .ics file link)
   - "View My Bookings" link

## API Routes needed:
- `POST /api/sessions/[id]/book` — calls the book_session Postgres function, creates booking
- `POST /api/sessions/[id]/cancel` — cancels booking, decrements spots_filled
- `GET /api/sessions` — list sessions with filters (date, duration, min_spots)

Wire everything to Supabase with real data. The session cards should fetch from the sessions + venues tables.
```

---

## Prompt 3: Onboarding Quiz + User Dashboard

```
Build the onboarding quiz flow and user dashboard.

## Onboarding Quiz (/onboarding)

Show this after first signup if onboarding_completed is false. 7 screens total.

### Screen 1: Welcome
- "Welcome to donedonadone 👋"
- "Let's set up your profile so we can find your perfect coworking crew."
- Fields: Display name, Phone number (+91 prefix)
- Work type selector (visual cards with icons): Freelancer, Startup Founder, Remote Employee, Student, Creator, Other
- Industry pills: Tech, Design, Writing, Marketing, Business, Research, Other
- "Continue" button

### Screen 2: Work Vibe
- "What's your ideal coworking vibe?"
- 3 large tappable cards:
  - 🎧 "Deep Focus" — "Heads down, minimal talking, maximum output"
  - 💬 "Casual & Social" — "Chat between sprints, get to know people"
  - ⚡ "Balanced Mix" — "Some focus time, some socializing"

### Screen 3: Environment
- "How do you feel about noise?" — 3 cards (🤫 Library quiet, 🎵 Ambient buzz, 🗣️ Lively energy)
- "How often do you take breaks?" — 4 options (Every 25-30 min, Every hour, 2+ hours straight, Whenever)

### Screen 4: Schedule
- "When are you most productive?" — multi-select pills: ☀️ Morning, 🌤️ Afternoon, 🌅 Evening, 🌙 Night

### Screen 5: Social Goals
- "What are you hoping to get from coworking?" — multi-select up to 3:
  - 🎯 Accountability, 🤝 Networking, 👋 Friendship, 🧩 Collaboration, 💡 Inspiration

### Screen 6: Personality
- "Introvert to extrovert?" — visual 5-point slider (🐢 to 🦋)
- "Communication style during coworking?" — 3 options (🤐 Minimal, 🙂 Moderate, 😄 Chatty)

### Screen 7: Bio + Complete
- "Anything your group should know?" — textarea, 200 chars max, placeholder: "e.g., Building a fintech startup, love filter coffee, always happy to brainstorm..."
- Submit → Celebratory animation → "You're all set! 🎉"
- Show their Coworker Card preview (name, work type, industry, top 3 trait badges, bio)
- "Browse Sessions" CTA

Progress bar at top (Step X of 7). Smooth slide transitions. Save to coworker_preferences table in Supabase on completion.

## User Dashboard (/dashboard)

### Quick Stats Row
- Sessions attended, People met, Hours focused, This month count

### Next Session Card (prominent, teal gradient)
- Venue name, date, time
- Group members (avatars + names if revealed, "Revealed 1hr before ✨" if not)
- "View Details" / "Cancel" buttons
- If no upcoming: "No upcoming sessions" + "Browse Sessions" CTA

### Recent Sessions
- Last 3 sessions as compact cards (venue, date, group size, rating or "Rate this session" prompt)

### Recommended Sessions
- 2-3 suggested session cards, "See all →" link

## My Bookings Page (/bookings)
Tabs: Upcoming | Past | Cancelled
- **Upcoming**: session cards with venue, date, time, price, group status, cancel button
- **Past**: same + star rating + "Rate & Review" expandable + group members
- **Cancelled**: with refund status

## Profile Page (/profile)
- Avatar upload, name, member since, work type badge
- Coworker Card Preview (how others see you)
- Edit preferences section (each quiz answer editable)
- Account: email, phone, notifications toggle
- Log out

All wired to Supabase. Use real data from the authenticated user's profile and bookings.
```

---

## Prompt 4: Venue Partner Dashboard

```
Build the venue partner dashboard. Partners access this at /partner routes.

## Layout
Different from coworker app: top navbar "donedonadone for Partners" with partner branding. Sidebar nav: Dashboard, My Venue, Sessions, Bookings, Earnings, Settings.

## Dashboard (/partner)
- Welcome header with partner name and venue
- 4 metric cards: Today's Bookings (count), This Week (count + ₹), This Month (count + ₹), Avg Rating (x/5)
- Today's Sessions timeline (time, spots filled/total, groups)
- Recent Reviews (last 5: stars, comment, name, date)
- Quick Actions: "Add Session Slot", "Update Venue"

## My Venue (/partner/venue)
Editable form:
- Venue photos (upload area, 4-6 slots)
- Name, address, area, venue type dropdown
- Amenities checkboxes: WiFi, Power, Food, Drinks, AC, Parking, Quiet zone, Outdoor
- Included in cover: text field
- Venue rules: text field
- Max capacity: number
- Save button

## Sessions & Availability (/partner/sessions)
- Week calendar view (Mon-Sun, 8AM-8PM grid)
- Existing slots as colored blocks (teal=active, gray=draft)
- Click empty slot → Create Session modal:
  - Date (or Recurring toggle for weekly)
  - Start time dropdown (30-min increments)
  - Duration: 2hr / 4hr toggle
  - Available spots: number
  - Venue charge: ₹ input
  - Preview: "Coworker pays: ₹[venue_charge + platform_fee]"
  - "Create" button
- List view toggle: table of upcoming sessions with edit/cancel

## Bookings (/partner/bookings)
Table: Coworker name, session date/time, group #, check-in status, payment status
Filters: date range, session, check-in status

## Earnings (/partner/earnings)
- Summary cards: This month, Last month, All-time
- Bar chart: daily earnings (last 30 days)
- Payout history table: date, amount, status

All wired to Supabase. Partners should only see data for their own venue(s). Use RLS.
```

---

## Prompt 5: Admin Dashboard + Session Day Experience

```
Build the admin dashboard and the session-day experience.

## Admin Dashboard (/admin)

### Layout
Dark sidebar, donedonadone logo. Nav: Overview, Users, Venues, Sessions, Bookings, Groups, Financials.

### Overview
- 6 KPI cards: Total Users, Active Venues, Today's Sessions, Today's Bookings, Revenue (month), Avg Rating
- 2 charts: Daily bookings (line, 30 days) + Revenue split (stacked bar: platform vs venue)
- Alerts: low-fill sessions, pending refunds, new venue applications

### Users (/admin/users)
Data table: Name, email, phone, type, joined, sessions attended, status. Search + filter. Click row for detail.

### Venues (/admin/venues)
Data table: Venue name, partner, area, type, capacity, rating, status. "Pending Approval" tab with approve/reject.

### Sessions (/admin/sessions)
Table + calendar toggle. Date, venue, time, spots filled, groups, revenue, status.

### Groups (/admin/groups)
For each upcoming session: show formed groups, members with trait badges, compatibility indicators.
"Auto-assign groups" button that:
1. Fetches all bookings for the session
2. Loads each user's coworker_preferences
3. Scores compatibility: same work_vibe (3pts), same noise_pref (2pts), same comm_style (2pts), overlapping social_goals (1pt), similar introvert_extrovert within 1 (1pt)
4. Groups users into clusters of [group_size] by similarity
5. Creates group rows and group_member rows
Manual drag-and-drop to reassign members between groups.

### Financials (/admin/financials)
- Revenue dashboard: collected, platform fees, venue payouts, net
- Transaction table: every booking's financial detail
- Pending payouts to venues
- Refund queue with approve/reject

### Payment Verification (/admin/payments)
- List of bookings with payment_status = 'payment_pending'
- Each shows: user name, amount, booking ID, timestamp
- "Verify Payment" button → changes status to 'paid'
- "Reject" button → changes status to 'pending' with notification

## Session Day Experience

### Group Reveal (/session/[id]/group)
Available 1hr before session. Before: countdown timer + "Your group reveals at [time] ✨"

When revealed:
- Group member cards (3-5): Avatar, first name, work type + industry, top 2 trait badges, bio, compatibility note ("You both prefer: Deep Focus")
- Table assignment: "Table 3" or "Ask at counter for donedonadone section"
- "Join WhatsApp Group" button (placeholder link)
- Venue directions with "Open in Google Maps" link

### Check-in (/session/[id]/checkin)
- Large "I'm here! Check me in" button → checkmark animation → "Checked in ✓"
- Group member check-in status (green dot = checked in)
- QR code for venue staff verification

### Post-Session Feedback (/session/[id]/feedback)
- "How was it?" + 5-star rating
- Quick feedback tags (multi-select): "Great group", "Good venue", "Productive", "Fun", "Too noisy", "Group mismatch"
- Per-member: "Would you cowork with [Name] again?" thumbs up/down
- Optional textarea
- "Submit & Browse Next Session" CTA
- Shareable session summary card: "I coworked for 4 hours with 4 amazing people at Third Wave Coffee via donedonadone"

Wire everything to Supabase. Admin routes should check user_type = 'admin'.
```

---

## Iteration Prompts (Small Follow-ups)

After the 5 main prompts, use small prompts to fix and polish:

```
Make the session cards more compact on mobile — reduce padding, smaller font for the price breakdown
```

```
Add Framer Motion page transitions for the onboarding quiz screens — slide left on "Continue", slide right on "Back"
```

```
The landing page hero needs a better visual on the right side — add an abstract illustration using CSS gradients and overlapping circles in amber/teal colors representing people at a table
```

```
Add real-time spots_filled counter on session cards using Supabase Realtime subscriptions
```

---

## Post-v0 Tasks (Done locally after cloning from GitHub)

After v0 generates the app and pushes to GitHub, clone locally and add:

1. **UPI QR Code Enhancement** — Install `upiqr` package, replace QR placeholder with real UPI QR generation
2. **WhatsApp Group Links** — For MVP, manually create groups and add invite links to the group reveal page
3. **Email Notifications** — Set up Supabase email triggers for booking confirmations
4. **Supabase Edge Function** — Cron job for auto-assigning groups 1hr before sessions
5. **Analytics** — Add PostHog or Mixpanel for event tracking
