# Technical Research: UPI, WhatsApp, Supabase

## 1. UPI QR Code Payment (MVP)

### The Simple Flow (No Payment Gateway Needed)
For MVP, we use direct UPI QR code generation — no Razorpay/Stripe needed.

```
User books session → App generates UPI QR → User scans with any UPI app →
User pays → User clicks "I've paid" → App records booking as "payment pending" →
Admin verifies (or auto-verify later)
```

### UPI Deep Link Format (NPCI Standard)
```
upi://pay?pa=merchant@upi&pn=donedonadone&am=349&cu=INR&tn=Session-ABC123
```

Parameters:
- `pa` — Payee VPA (your UPI ID, e.g., donedonadone@okicici)
- `pn` — Payee Name
- `am` — Amount (fixed, not editable by user)
- `cu` — Currency (INR)
- `tn` — Transaction Note (use booking ID for tracking)

### Best npm Library: `upiqr`
```bash
npm install upiqr
```

```typescript
import upiqr from 'upiqr';

const { qr, intent } = await upiqr({
  payeeVPA: 'donedonadone@okicici',
  payeeName: 'donedonadone',
  amount: '349',
  transactionNote: `Session booking #${bookingId}`,
  currency: 'INR',
});
// qr = Base64 PNG image of QR code
// intent = UPI deep link URL (for mobile "Pay Now" button)
```

Alternative: `@adityavijay21/upiqr` — more modern, supports SVG output, React Native compatible.

### Verification Strategy (MVP → Production)
**MVP (Day 1-30):**
- Generate QR with unique transaction note (booking ID)
- User pays, clicks "I've paid" button
- Admin manually checks UPI app for incoming payments matching the amount + note
- Admin confirms in admin dashboard → booking status → "paid"

**Phase 2 (Month 2+):**
- Add Razorpay for proper payment verification with webhooks
- Razorpay UPI Autopay for subscriptions

### Implementation Plan
1. Create a `PaymentQR` component that generates QR on-the-fly
2. Show QR code + "Pay ₹X via any UPI app" instruction
3. Below QR: "Pay Now" button (opens UPI intent on mobile)
4. After payment: "I've completed the payment" button
5. Booking moves to "Payment Pending Verification" state
6. Admin dashboard shows pending verifications

## 2. WhatsApp Group Automation

### Options Evaluated

| Solution | Cost | Can Create Groups? | Complexity | Verdict |
|----------|------|-------------------|------------|---------|
| WhatsApp Business API (Meta) | $0.05-0.08/msg | No (only broadcast) | High | Overkill for MVP |
| whatsapp-web.js | Free | Yes | Medium | **Best for MVP** |
| Green-API | $0.01/msg | Yes | Low | Good alternative |
| Whapi.cloud | $0.02/msg | Yes | Low | Managed, reliable |
| Manual WhatsApp groups | Free | Manual | None | **Simplest start** |

### Recommended: Two-Phase Approach

**Phase 1 (MVP): Semi-Automated with WhatsApp Links**
- When groups are assigned (1hr before session), generate a WhatsApp group invite link
- Use a pre-created WhatsApp group for each session
- Admin creates groups manually (takes 2 min per session)
- Platform shares the invite link to each group member via email/SMS/in-app
- Members click link to join the group

**Phase 2: Automated with whatsapp-web.js**
```typescript
import { Client } from 'whatsapp-web.js';

const client = new Client();
client.on('ready', async () => {
  // Create group
  const group = await client.createGroup(
    'donedonadone: Session at Third Wave 10AM',
    ['919876543210@c.us', '919876543211@c.us'] // phone numbers
  );

  // Get invite link
  const inviteCode = await group.getInviteCode();
  const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

  // Send welcome message
  await client.sendMessage(group.id._serialized,
    `Welcome to your donedonadone coworking session! 🎉\n\n` +
    `📍 Venue: Third Wave Coffee, HSR Layout\n` +
    `🕐 Time: 10:00 AM - 12:00 PM\n` +
    `👥 Group: You + 3 others\n\n` +
    `See you there!`
  );
});
```

**Important caveats for whatsapp-web.js:**
- Runs on a real WhatsApp Web session (needs QR scan once)
- Risk of WhatsApp banning the number if overused
- Run on a separate server/process, not in the Next.js app
- Use a dedicated WhatsApp number for the business

### Simplest MVP (recommended to start)
1. Admin pre-creates WhatsApp groups for each day's sessions
2. When groups are assigned, admin adds members or shares invite link
3. Platform sends invite link via email notification
4. Later automate with whatsapp-web.js or Whapi.cloud

## 3. Supabase Architecture (1000 bookings/day)

### Supabase Pro Plan ($25/month)
- 8GB database storage
- 250GB bandwidth
- 500MB file storage
- 100K monthly active users
- 2M Edge Function invocations
- 100 concurrent Realtime connections
- **More than enough for 1000 bookings/day**

### Key Architecture Decisions

**Authentication:**
- Supabase Auth with Google OAuth + Email magic link
- Phone OTP for Indian users (via Supabase's Twilio integration)

**Realtime:**
- Use Supabase Realtime for:
  - Live spots_filled counter on session cards
  - Group assignment notifications
  - Check-in status updates during sessions

**Edge Functions:**
- Group assignment cron: runs 1hr before each session
- Waitlist promotion: when a booking is cancelled
- Session status transitions: upcoming → in_progress → completed

**Cron Jobs (pg_cron):**
```sql
-- Run group assignment every 15 minutes
SELECT cron.schedule(
  'assign-groups',
  '*/15 * * * *',
  $$SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/assign-groups',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))]
  )$$
);
```

**Overbooking Prevention (Atomic Booking):**
```sql
CREATE OR REPLACE FUNCTION book_session(p_session_id UUID, p_user_id UUID)
RETURNS bookings AS $$
DECLARE
  v_booking bookings;
  v_session sessions;
BEGIN
  -- Atomic increment with check
  UPDATE sessions
  SET spots_filled = spots_filled + 1
  WHERE id = p_session_id
    AND spots_filled < max_spots
    AND status = 'upcoming'
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session is full or unavailable';
  END IF;

  -- Create booking
  INSERT INTO bookings (user_id, session_id, payment_amount, payment_status)
  VALUES (p_user_id, p_session_id, v_session.total_price, 'pending')
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$ LANGUAGE plpgsql;
```

**Storage:**
- Venue photos in Supabase Storage (public bucket)
- User avatars in Supabase Storage (public bucket)
- Max 5MB per image, auto-resize with Supabase Image Transformations

### Performance at Scale
- 1000 bookings/day = ~42/hour = ~0.7/minute (trivial load)
- Biggest concurrent spike: evening sessions (maybe 50-100 simultaneous bookings)
- PostgreSQL handles this easily with proper indexes
- Connection pooling via Supabase's built-in PgBouncer

## Sources
- https://github.com/bhar4t/upiqr
- https://www.npmjs.com/package/upiqr
- https://whapi.cloud/how-to-automate-whatsapp-groups-api
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/modules/cron
- https://supabase.com/docs/guides/cron
