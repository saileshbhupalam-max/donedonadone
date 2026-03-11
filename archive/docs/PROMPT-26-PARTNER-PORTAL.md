# Prompt 26: Partner Self-Service Portal

## Context
Currently, venue partners are managed entirely by admins via the PartnersTab in the admin dashboard. Partners have no way to sign up, manage their venue, create sessions, or view earnings. For FocusClub to scale beyond manually-added venues, partners need a self-service portal.

The `venue_partners` table exists with: id, venue_name, venue_address, neighborhood, contact_name, contact_phone, contact_email, google_maps_url, instagram_handle, status (lead/contacted/interested/active/declined/churned), partnership_type, revenue_share_pct, events_hosted, members_acquired. The `profiles` table has `user_type` which can be 'coworker', 'partner', or 'admin'. The `events` table has session data. The `payments` table (from Prompt 25) will have venue_share data.

## What to Build

### Part 1: Partner Registration Flow

Create a `/partner/register` page accessible from the Partners public page. The flow:

**Step 1: Account Creation**
- If already logged in: skip to Step 2
- If not logged in: standard Supabase auth sign-up, but with a note "Registering as a venue partner"
- After auth, set `profiles.user_type` to 'partner' (or add a flag — be careful not to override existing coworker accounts. If someone already has a coworker account, add a `is_also_partner` boolean rather than changing user_type. Actually, simpler: let user_type remain as-is and create a separate `partner_profiles` table linked to the user)

**Actually, create a `partner_profiles` table:**
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles, unique)
- `venue_partner_id` (uuid, references venue_partners, nullable — linked after admin approval)
- `status` (text: 'pending_review', 'approved', 'rejected')
- `submitted_at` (timestamptz)
- `reviewed_at` (timestamptz)
- `reviewed_by` (uuid, references profiles, nullable)
- `rejection_reason` (text, nullable)

**Step 2: Venue Details Form**
- Venue name (required)
- Venue address (required)
- Neighborhood (dropdown: HSR Layout, Koramangala, Indiranagar, JP Nagar, Whitefield, Other)
- Google Maps URL (required)
- Instagram handle (optional)
- Contact name (auto-filled from profile)
- Contact phone (required)
- Contact email (auto-filled from auth email)
- Amenities checklist: WiFi, Power outlets, AC, Parking, Food/drinks, Projector, Whiteboard, Outdoor seating
- Venue photos (up to 5, uploaded to Supabase Storage)
- Seating capacity for co-working groups (number)
- Preferred session times (multi-select: Morning 9-12, Afternoon 12-3, Evening 3-6, Flexible)
- A text field: "Why do you want to host FocusClub sessions?" (helps admin evaluate fit)

**Step 3: Submission Confirmation**
- "Thanks! We'll review your venue within 48 hours."
- Show a status tracker: Submitted → Under Review → Approved/Rejected
- Create an admin notification: "New partner application: [Venue Name] in [Neighborhood]"

This form creates a `venue_partners` entry with status 'lead' and a `partner_profiles` entry with status 'pending_review'.

### Part 2: Admin Approval Workflow

In the admin PartnersTab, add a "Pending Applications" section at the top:
- List all partner_profiles with status 'pending_review'
- Show venue details, photos, the "why" text
- Two buttons: "Approve" and "Reject" (with rejection reason text input)
- On approve: set venue_partners.status to 'active', partner_profiles.status to 'approved', link partner_profiles.venue_partner_id. Send notification to the partner: "Your venue has been approved! Set up your first session."
- On reject: set partner_profiles.status to 'rejected', fill rejection_reason. Send notification: "We weren't able to approve your venue at this time. Reason: [reason]"

### Part 3: Partner Dashboard

Create a `/partner` dashboard page that is shown to users who have an approved partner_profile. This is a separate layout from the coworker dashboard with its own navigation.

**Partner dashboard tabs:**

**Overview tab:**
- Welcome message: "Welcome, [venue_name]"
- Stats cards: Total Sessions Hosted, Total Attendees (sum of rsvp_count for their events), This Month's Earnings (from payments.venue_share), Average Session Rating
- Upcoming sessions list (events for their venue in the future)
- Recent activity feed (latest RSVPs, feedback)

**Sessions tab:**
- List of all sessions (past and upcoming) at their venue
- For each session: date, time, format, spots filled/max, average rating (if past)
- "Create Session" button that opens a modal:
  - Date picker
  - Start time, end time
  - Session format (structured 4hr, structured 2hr, casual)
  - Max spots (default 20)
  - Venue price (how much the venue charges per seat, in Rs — this becomes events.venue_price)
  - Description (optional)
  - The platform_fee is auto-set based on format and shown as read-only: "FocusClub fee: Rs 100" or "Rs 150"
  - Total price shown: "Members will pay: Rs [platform_fee + venue_price]"
- Creating a session inserts into the `events` table with the venue_name, venue_address, neighborhood from their venue_partners record, and created_by set to the partner's user_id
- Sessions created by partners should have status 'pending_approval' (add this column to events if needed) — admin approves before they go live. Or if you want faster flow: auto-approve for approved partners.

**Earnings tab:**
- Monthly earnings table: month, sessions count, total attendees, total venue share earned
- Breakdown per session: date, title, attendees, venue share amount
- Running total: "Total earned with FocusClub: Rs [sum]"
- Note: "Payouts are processed monthly. Contact us for payout details." (manual payouts for MVP)

**Settings tab:**
- Edit venue details (same form as registration, pre-filled)
- Update photos
- Update amenities
- Update preferred session times

### Part 4: Partner Navigation

Partners accessing `/partner` should see a clean dashboard layout:
- Top bar with venue name and partner avatar
- Side nav or bottom nav with: Overview, Sessions, Earnings, Settings
- A "Switch to Member View" link if they also have a coworker profile (they might want to attend sessions at other venues)
- The existing coworker bottom nav should show a "Partner Dashboard" link for users who are also partners

### Part 5: RLS Policies

- `partner_profiles`: users can read/update their own. Admins can read/update all.
- Partners can only read/update events where `created_by = auth.uid()` or where the event's venue_name matches their venue_partners.venue_name
- Partners can read payments where the event's venue matches their venue (for earnings data)
- Partners cannot see other partners' data

### Important
- The partner portal should feel premium but simple — these are cafe owners, not tech people. Big buttons, clear labels, no jargon.
- Keep the partner experience completely separate from the admin experience. Partners should never see admin controls.
- The partner registration should work on mobile (cafe owners will likely fill it out on their phone).
- Photos should be compressed/resized on upload — max 1MB each, max 5 photos.
- If a user tries to access `/partner` without a partner_profile, show a "Become a Partner" CTA linking to the registration page.
- Do NOT change the existing admin PartnersTab functionality — it should continue to work as-is for manual partner management. The admin approval workflow is an addition to the existing tab.
