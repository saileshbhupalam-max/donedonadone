# Prompt 25: Payment Integration with Razorpay

## Context
FocusClub has no payment system. The pricing model is: platform fee of Rs 100 (2hr session) or Rs 150 (4hr session) goes to FocusClub, plus a venue price set per event that goes to the venue partner. Users currently RSVP for free. We need to gate RSVPs behind payment.

The `events` table exists with columns: id, title, date, start_time, end_time, venue_name, session_format (structured_4hr, structured_2hr, casual). The `event_rsvps` table exists. The `venue_partners` table has `revenue_share_pct`. The `profiles` table has user info.

Razorpay API keys will be stored as Supabase secrets: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. The frontend key will be exposed as `VITE_RAZORPAY_KEY_ID`.

## What to Build

### Part 1: Database Schema

Create a `payments` table:
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles)
- `event_id` (uuid, references events)
- `razorpay_order_id` (text, unique)
- `razorpay_payment_id` (text, nullable — filled after capture)
- `razorpay_signature` (text, nullable — for verification)
- `amount` (integer — in paise, so Rs 250 = 25000)
- `platform_fee` (integer — in paise)
- `venue_share` (integer — in paise)
- `currency` (text, default 'INR')
- `status` (text — 'created', 'authorized', 'captured', 'failed', 'refunded')
- `refund_id` (text, nullable)
- `refund_reason` (text, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

RLS: Users can read their own payments. Only system functions can insert/update.

Add columns to `events`:
- `platform_fee` (integer, default 10000 — Rs 100 in paise)
- `venue_price` (integer, default 15000 — Rs 150 in paise)
- `total_price` as a generated column: `platform_fee + venue_price`
- `is_free` (boolean, default false) — for promotional free sessions

When an admin creates an event, auto-set `platform_fee` based on `session_format`: structured_4hr = 15000, structured_2hr = 10000, casual = 10000. The `venue_price` should be editable by admin when creating/editing the event.

### Part 2: Create Order Edge Function

Create a Supabase Edge Function `create-payment-order` that:
- Accepts: `event_id` and `user_id` (from auth)
- Validates: user is authenticated, event exists, event is not full (rsvp_count < max_spots), user hasn't already RSVP'd, event date is in the future, user is not suspended
- If event `is_free` is true: skip Razorpay, directly create RSVP and payment record with status 'captured' and amount 0, return success
- Calculates amount: `events.total_price` (platform_fee + venue_price)
- Calls Razorpay Orders API (POST `https://api.razorpay.com/v1/orders`) with: amount, currency INR, receipt as `fc_{event_id}_{user_id}` truncated to fit
- Creates a payment record with status 'created' and the razorpay_order_id
- Returns: `{ order_id, amount, currency, key_id (the public Razorpay key), user_email, user_name, event_title }`

### Part 3: Verify Payment Edge Function

Create a Supabase Edge Function `verify-payment` that:
- Accepts: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
- Verifies the payment signature using HMAC SHA256: `hmac_sha256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)` must equal the signature
- If valid: update payment status to 'captured', set razorpay_payment_id and razorpay_signature, create the RSVP in event_rsvps, increment events.rsvp_count
- If invalid: update payment status to 'failed', return error
- Calculate venue_share: `(venue_price / total_price) * amount` — store on the payment record
- Calculate platform_fee portion similarly
- Return: `{ success: true, rsvp_id }` or `{ success: false, error }`

### Part 4: Checkout UI

Modify the RSVP flow in the event detail page. Currently, the RSVP button directly inserts into event_rsvps. Change it to:

1. User taps "Book Session — Rs [total_price/100]" button (show the formatted price)
2. Button calls the `create-payment-order` Edge Function
3. On success, open the Razorpay checkout popup using the Razorpay.js SDK:
   - Load `https://checkout.razorpay.com/v1/checkout.js` dynamically (script tag injection)
   - Create Razorpay instance with: key, amount, currency, order_id, name "FocusClub", description "[Event Title]", prefill (email, name from profile), theme color "#7c3aed"
   - On payment success callback: call `verify-payment` Edge Function with the response
   - On payment failure: show toast "Payment failed. Please try again."
4. After successful verification: show success state, navigate to the event page or show confirmation

For free events (is_free = true): Skip the Razorpay popup entirely. The button should say "Book Session — Free" and directly call the create-payment-order function which handles free events.

Show a price breakdown below the button:
- "Platform fee: Rs [platform_fee/100]"
- "Venue: Rs [venue_price/100]"
- "Total: Rs [total_price/100]"

### Part 5: Cancellation & Refunds

When a user cancels their RSVP (existing cancel flow):
- If the event is more than 24 hours away: auto-refund via Razorpay Refunds API (POST `https://api.razorpay.com/v1/payments/{payment_id}/refund`)
- If within 24 hours: no refund (show a warning before cancelling: "Cancellations within 24 hours are not eligible for refund")
- Update payment status to 'refunded', store refund_id
- For free events: just cancel the RSVP, no refund logic needed

Create a Supabase Edge Function `process-refund` for this.

### Part 6: Admin Payments Tab

Add a "Payments" tab to the Admin dashboard with:
- Summary cards: Total Revenue (sum of captured payments), Platform Revenue (sum of platform_fee), Venue Payouts Due (sum of venue_share where not yet paid out), Refunds (count and total), Today's Revenue
- A table of recent payments: date, user name, event title, amount, platform fee, venue share, status (with colored badges: green for captured, red for failed, yellow for refunded)
- Filter by: date range, status, event
- Total at bottom of filtered results

### Part 7: Partner Earnings View

On the Partners page or in a new partner-facing section, show earnings per venue partner:
- Query payments joined with events joined with venue_partners
- Group by venue partner: total venue_share earned, count of paid sessions, average per session
- This is read-only for now (admin manages payouts manually)
- Show in the PartnersTab as an "Earnings" column or expandable section per partner

### Important
- All amounts in the database should be in PAISE (integer, not float). Display as Rs by dividing by 100.
- Razorpay test mode keys start with `rzp_test_`. The system should work identically in test and live mode — the only difference is the API keys.
- The payment verification MUST happen server-side (Edge Function), never client-side. The signature verification is the critical security step.
- If the Edge Function for payment creation fails, the user should see a clear error and be able to retry.
- Add an index on `payments(razorpay_order_id)` and `payments(user_id, event_id)`.
- The RSVP should ONLY be created after payment verification succeeds — never before. This prevents "RSVP without paying" race conditions.
- For the Razorpay SDK loading: use dynamic script injection, not an npm package. Add `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>` dynamically when the checkout flow starts.
