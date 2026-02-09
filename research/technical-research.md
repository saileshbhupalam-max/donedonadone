# Technical Research: Coworking Booking Platform

**Date:** 2026-02-08
**Stack:** Next.js + Supabase + UPI Payments + WhatsApp Integration

---

## 1. UPI QR Code Payment (India) -- Direct UPI, No Razorpay

### 1.1 UPI Deep Link Format

The UPI deep link URL follows the NPCI (National Payments Corporation of India) specification:

```
upi://pay?pa=<VPA>&pn=<NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>&tr=<REF_ID>
```

**Parameters:**

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `pa` | Mandatory | Payee VPA (UPI ID) | `cowork@okaxis` |
| `pn` | Mandatory | Payee Name | `DoneDonaDone` |
| `am` | Optional | Amount (decimal) | `500.00` |
| `tr` | Optional | Transaction Reference ID | `BOOKING-2026-0001` |
| `tn` | Optional | Transaction Note | `Booking at Hub Andheri Feb 10` |
| `cu` | Optional | Currency (always INR) | `INR` |
| `mc` | Optional | Merchant Category Code | `5812` |
| `mam` | Optional | Minimum Amount | `100.00` |

**Example deep link:**
```
upi://pay?pa=donedonadone@okaxis&pn=DoneDonaDone%20Cowork&am=500.00&cu=INR&tn=Booking%20Hub%20Andheri%20Feb%2010&tr=BK-20260210-0042
```

When encoded as a QR code, any UPI app (Google Pay, PhonePe, Paytm, BHIM) can scan and pay.

### 1.2 QR Code Generation in JavaScript/TypeScript

**Option A: `upiqr` package (UPI-specific, simplest)**

```bash
npm install upiqr
```

```typescript
// lib/upi.ts
import upiqr from "upiqr";

interface UPIPaymentParams {
  amount: number;
  bookingId: string;
  venueName: string;
}

export async function generateUPIQR(params: UPIPaymentParams) {
  const { amount, bookingId, venueName } = params;

  const result = await upiqr({
    payeeVPA: process.env.UPI_VPA!,          // e.g. "business@okaxis"
    payeeName: process.env.UPI_PAYEE_NAME!,  // e.g. "DoneDonaDone"
    amount: amount,
    transactionId: bookingId,
    note: `Booking: ${venueName} - ${bookingId}`,
  });

  return {
    qrDataUrl: result.qr,      // data:image/png;base64,...
    intentUrl: result.intent,   // upi://pay?pa=...&pn=...&am=...
  };
}
```

The `upiqr` package (by bhar4t) is a TypeScript library that generates NPCI-compliant UPI QR codes as Base64 data URLs, along with the UPI intent link. Works on both client and server.

**Option B: Generic `qrcode` package (more control, 2M+ weekly downloads)**

```bash
npm install qrcode @types/qrcode
```

```typescript
// lib/upi-qr.ts
import QRCode from "qrcode";

interface UPIParams {
  vpa: string;
  name: string;
  amount: number;
  txnRef: string;
  note: string;
}

export function buildUPILink(params: UPIParams): string {
  const qs = new URLSearchParams({
    pa: params.vpa,
    pn: params.name,
    am: params.amount.toFixed(2),
    cu: "INR",
    tr: params.txnRef,
    tn: params.note,
  });
  return `upi://pay?${qs.toString()}`;
}

export async function generateQRDataUrl(upiLink: string): Promise<string> {
  return QRCode.toDataURL(upiLink, {
    errorCorrectionLevel: "M",
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
```

**Option C: `@adityavijay21/upiqr` (fluent API, modern)**

```typescript
import { UPIQR } from "@adityavijay21/upiqr";

const qr = await new UPIQR()
  .set({ upiId: "business@okaxis", name: "DoneDonaDone" })
  .setAmount(500)
  .setNote("Booking BK-001")
  .generate();
```

**Recommendation:** Use Option B (`qrcode` + manual UPI link building). It gives full control over parameters, has 2M+ weekly npm downloads, excellent TypeScript support, and no dependency on niche UPI-specific wrappers that may go unmaintained.

### 1.3 Next.js API Route for QR Generation

```typescript
// app/api/payment/generate-qr/route.ts
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await request.json();

  // Fetch booking details
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, amount, venue:venues(name)")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .eq("payment_status", "pending")
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Build UPI deep link
  const upiParams = new URLSearchParams({
    pa: process.env.UPI_VPA!,
    pn: process.env.UPI_PAYEE_NAME!,
    am: booking.amount.toFixed(2),
    cu: "INR",
    tr: `BK-${booking.id}`,
    tn: `Booking at ${booking.venue.name}`,
  });
  const upiLink = `upi://pay?${upiParams.toString()}`;

  // Generate QR as base64 data URL
  const qrDataUrl = await QRCode.toDataURL(upiLink, {
    errorCorrectionLevel: "M",
    width: 300,
    margin: 2,
  });

  // Store payment intent in DB
  await supabase.from("payment_intents").insert({
    booking_id: bookingId,
    user_id: user.id,
    amount: booking.amount,
    upi_ref: `BK-${booking.id}`,
    status: "qr_generated",
    generated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    qrDataUrl,
    upiLink,
    amount: booking.amount,
    reference: `BK-${booking.id}`,
  });
}
```

### 1.4 React Component for Payment Screen

```tsx
// components/UPIPayment.tsx
"use client";

import { useState } from "react";

interface UPIPaymentProps {
  bookingId: string;
  amount: number;
  venueName: string;
}

export function UPIPayment({ bookingId, amount, venueName }: UPIPaymentProps) {
  const [qrData, setQrData] = useState<{
    qrDataUrl: string;
    upiLink: string;
    reference: string;
  } | null>(null);
  const [step, setStep] = useState<"generate" | "scan" | "confirm" | "done">("generate");
  const [upiTxnId, setUpiTxnId] = useState("");

  async function generateQR() {
    const res = await fetch("/api/payment/generate-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setQrData(data);
    setStep("scan");
  }

  async function confirmPayment() {
    await fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        upiTransactionId: upiTxnId,
      }),
    });
    setStep("done");
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Pay for {venueName}</h2>
      <p className="text-2xl font-mono mb-6">Rs. {amount.toFixed(2)}</p>

      {step === "generate" && (
        <button
          onClick={generateQR}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          Generate UPI QR Code
        </button>
      )}

      {step === "scan" && qrData && (
        <div className="text-center space-y-4">
          <img
            src={qrData.qrDataUrl}
            alt="UPI QR Code"
            width={300}
            height={300}
            className="mx-auto"
          />
          <p className="text-sm text-gray-600">
            Scan with any UPI app (Google Pay, PhonePe, Paytm)
          </p>
          <p className="text-xs text-gray-400">
            Reference: {qrData.reference}
          </p>

          {/* Mobile: Open UPI app directly */}
          <a
            href={qrData.upiLink}
            className="block w-full bg-green-600 text-white py-3 rounded-lg text-center"
          >
            Open UPI App to Pay
          </a>

          <button
            onClick={() => setStep("confirm")}
            className="w-full border border-blue-600 text-blue-600 py-3 rounded-lg"
          >
            I have completed the payment
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <p>Enter your UPI Transaction ID (from payment app):</p>
          <input
            type="text"
            value={upiTxnId}
            onChange={(e) => setUpiTxnId(e.target.value)}
            placeholder="e.g. 412345678901"
            className="w-full border rounded-lg p-3"
          />
          <button
            onClick={confirmPayment}
            className="w-full bg-blue-600 text-white py-3 rounded-lg"
          >
            Submit for Verification
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center space-y-2">
          <p className="text-green-600 font-bold text-lg">Payment submitted!</p>
          <p className="text-sm text-gray-600">
            Your booking will be confirmed once payment is verified by admin.
          </p>
        </div>
      )}
    </div>
  );
}
```

### 1.5 Payment Verification -- The Hard Truth

**Can we auto-verify UPI payments without a payment gateway?**

**No, not reliably.** Here is why:

- UPI is a push-based payment system. The payer initiates the payment from their app.
- There is no callback/webhook from NPCI or the payer's bank to your server.
- The QR code simply opens the UPI app with pre-filled details. You have no way to know programmatically if/when the user actually completed the payment.
- Only registered Payment Service Providers (PSPs) with NPCI integration get transaction status callbacks.
- To get webhooks, you need a payment gateway (Razorpay, Cashfree, PayU, Setu, etc.) which defeats the "no gateway" requirement.

**MVP Verification Flow (Manual):**

```
1. Generate QR with amount + unique reference (BK-20260210-0042)
2. User pays via UPI app (reference appears in their payment receipt)
3. User clicks "I've paid" and optionally enters UPI transaction ID
4. Booking status -> "payment_submitted" (user sees "awaiting verification")
5. Admin checks bank statement / UPI app for matching amount + reference
6. Admin marks booking as "payment_confirmed"
7. User gets notified (email/WhatsApp) that booking is confirmed
```

**Database schema for payment tracking:**

```sql
CREATE TABLE payment_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  upi_ref TEXT NOT NULL,               -- BK-20260210-0042
  user_upi_txn_id TEXT,                -- User-provided UPI transaction ID
  status TEXT DEFAULT 'qr_generated',  -- qr_generated | user_confirmed | admin_verified | failed
  generated_at TIMESTAMPTZ NOT NULL,
  user_confirmed_at TIMESTAMPTZ,
  admin_verified_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Future upgrade path:** When you outgrow manual verification, integrate:
- **Setu UPI DeepLinks** (https://setu.co) -- purpose-built for UPI with webhooks, easiest to integrate
- **Cashfree UPI Collect API** -- provides webhooks for payment confirmation
- Both are simpler than full Razorpay for UPI-only flows

### 1.6 Environment Variables

```env
UPI_VPA=donedonadone@okaxis
UPI_PAYEE_NAME=DoneDonaDone Cowork
```

---

## 2. WhatsApp Group Automation

### 2.1 WhatsApp API Landscape (2025-2026)

**Official APIs from Meta:**

| Feature | WhatsApp Cloud API | WhatsApp Business API (On-Premise) |
|---------|-------------------|------------------------------------|
| Status | Active, primary offering | **Deprecated Oct 2025** |
| Hosting | Meta's servers | Self-hosted |
| Cost | Free platform (pay per message) | License fee + hosting |
| Setup | Meta Business Manager | BSP required |
| Group creation | Limited (max 8 participants, API-created only) | No |

**Key change:** Meta deprecated the on-premise Business API in October 2025 and consolidated everything to the Cloud API. All new integrations should use the Cloud API exclusively.

### 2.2 WhatsApp Cloud API -- Message Pricing (India, 2026)

| Message Type | Cost (India) | Use Case |
|-------------|-------------|----------|
| Marketing template | ~Rs. 0.88 / $0.0107 | Promotions, offers |
| Utility template | ~Rs. 0.13 / $0.0016 | Booking confirmations, updates |
| Authentication | ~Rs. 0.13 / $0.0016 | OTPs |
| Service (user-initiated) | **Free** | Replies within 24hr window |

**Volume discounts:** Automatic 7-tier pricing. Save Rs. 0.02 per message for every 10x volume increase.

**India is the cheapest region globally** -- 75% lower than global average rates.

**Cost estimate for coworking platform:** At 1000 bookings/day using utility templates:
- 1000 confirmations/day x Rs. 0.13 = Rs. 130/day
- Monthly: Rs. 3,900 (~$47/month)
- Very affordable even at scale

**Important Jan 2026 change:** Marketing template fees increased for India due to high demand. Utility and authentication rates remain low.

### 2.3 Can We Create Groups Programmatically?

**Official Cloud API (as of Oct 2025):**
- YES, but with severe limitations:
  - Maximum **8 participants** per group (including the admin/bot number)
  - Can only manage groups **created via the API** (not existing manually-created groups)
  - Cannot add participants who have not opted in
- **Too restrictive for coworking groups** (which may need 10-50 members)

**Unofficial libraries:**

| Library | Tech | RAM Usage | Risk Level | Group Support |
|---------|------|-----------|------------|---------------|
| **Baileys** | Pure WebSocket, Node.js | ~50 MB | Medium-High | Full group CRUD |
| **whatsapp-web.js** | Puppeteer-based | ~300-600 MB | Medium-High | Full group CRUD |
| **GREEN-API** | Cloud service (REST API) | N/A | Medium | Full group CRUD |
| **Whapi.Cloud** | Cloud service (REST API) | N/A | Medium | Full group CRUD |

**Baileys** is the most popular unofficial option:
- Connects via WhatsApp Web's WebSocket protocol (no browser/Puppeteer needed)
- ~50 MB RAM vs 300-600 MB for Puppeteer-based solutions
- Startup under 1 second vs 5-10 seconds
- Supports creating groups, adding/removing members, sending messages, generating invite links

**GREEN-API pricing:**
- Developer plan: Free (limited to 3 chats for testing)
- Business plan: Paid per instance (each WhatsApp number = one instance), full-feature access

**Risks of unofficial libraries (Baileys, whatsapp-web.js):**
- **Violates WhatsApp Terms of Service** -- real account ban risk
- Meta actively patches against unofficial access; features break within days
- Buttons and interactive lists were deprecated across all unofficial libraries due to Meta crackdowns
- No SLA, no support, no guarantees
- Baileys uses Linked Devices feature (not official Business API) -- not endorsed by WhatsApp
- **Should NOT be used for a production business product**

### 2.4 Recommended MVP Approach

**Approach: WhatsApp Cloud API for notifications + manual group invite links**

This is the safest, most compliant, lowest-risk approach:

```
1. Pre-create WhatsApp groups manually for each venue/date (admin task, ~2 min each)
2. Generate invite link for each group (via WhatsApp app on phone)
3. Store invite link in DB (linked to venue + date)
4. When booking is confirmed:
   a. Send WhatsApp utility template message via Cloud API with group invite link
   b. Display invite link in the booking confirmation UI
5. User clicks link to join the group themselves
```

**Why this works:**
- Zero ToS violation risk
- No account ban risk
- Users opt in by clicking the link themselves
- Works with groups of any size (up to WhatsApp's 1024 member limit)
- Cloud API handles the notification reliably; manual groups handle the community aspect
- Can scale to automated group creation later if the Cloud API lifts the 8-member limit

### 2.5 WhatsApp Cloud API -- Sending Messages (Node.js)

**Setup prerequisites:**
1. Create a Meta Business Account at business.facebook.com
2. Set up a WhatsApp Business Profile in Meta Business Manager
3. Get your Phone Number ID and permanent Access Token
4. Create and submit message templates for Meta approval (1-24 hours)

**Option A: Official Meta SDK**

```bash
npm install whatsapp
```

```typescript
// lib/whatsapp.ts
import WhatsApp from "whatsapp";

// Environment variables needed:
// WA_PHONE_NUMBER_ID - Your WhatsApp Business phone number ID
// CLOUD_API_ACCESS_TOKEN - Meta access token
// CLOUD_API_VERSION - e.g. "v21.0"

const wa = new WhatsApp(Number(process.env.WA_PHONE_NUMBER_ID));

export async function sendBookingConfirmation(
  recipientPhone: string,  // with country code, e.g. "919876543210"
  bookingDetails: {
    venueName: string;
    date: string;
    time: string;
    groupInviteLink: string;
  }
) {
  try {
    const response = await wa.messages.template(
      {
        name: "booking_confirmed",    // Pre-approved template name
        language: {
          policy: "deterministic",
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: bookingDetails.venueName },
              { type: "text", text: bookingDetails.date },
              { type: "text", text: bookingDetails.time },
              { type: "text", text: bookingDetails.groupInviteLink },
            ],
          },
        ],
      },
      recipientPhone
    );
    return { success: true, messageId: response.messages?.[0]?.id };
  } catch (error) {
    console.error("WhatsApp send failed:", error);
    return { success: false, error };
  }
}
```

**Option B: Direct HTTP call (no SDK dependency, simpler)**

```typescript
// lib/whatsapp-simple.ts
export async function sendWhatsAppMessage(
  to: string,
  templateName: string,
  bodyParams: string[]
) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      }),
    }
  );

  return response.json();
}

// Usage:
// await sendWhatsAppMessage(
//   "919876543210",
//   "booking_confirmed",
//   ["Hub Andheri", "Feb 10, 2026", "10:00 AM", "https://chat.whatsapp.com/ABC123"]
// );
```

### 2.6 Template Message for Meta Approval

Submit this template before using it. Utility templates have higher approval rates than marketing.

**Template name:** `booking_confirmed`
**Category:** Utility
**Language:** English

```
Your coworking booking is confirmed!

Venue: {{1}}
Date: {{2}}
Time: {{3}}

Join your coworking group here: {{4}}

See you there!
```

Approval typically takes 1-24 hours.

### 2.7 Alternative: Display Group Link in App (Simplest Possible MVP)

If you want to skip the WhatsApp Cloud API entirely for the very first version:

```typescript
// In your booking confirmation page/component
function BookingConfirmed({ booking }: { booking: Booking }) {
  return (
    <div>
      <h2>Booking Confirmed!</h2>
      <p>{booking.venue.name} - {booking.date}</p>

      {booking.whatsappGroupLink && (
        <a
          href={booking.whatsappGroupLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg"
        >
          Join WhatsApp Group
        </a>
      )}
    </div>
  );
}
```

Store the invite link per venue-date combination:

```sql
CREATE TABLE venue_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) NOT NULL,
  group_date DATE NOT NULL,
  whatsapp_invite_link TEXT,  -- https://chat.whatsapp.com/ABC123...
  max_members INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue_id, group_date)
);
```

### 2.8 Decision Matrix

| Approach | Complexity | Monthly Cost | Ban Risk | Best For |
|----------|-----------|-------------|----------|----------|
| Manual groups + link in app UI | Very Low | Free | None | MVP Day 1 |
| Cloud API notifications + manual groups | Low | ~$47/mo @ 1K/day | None | MVP Week 2+ |
| Cloud API groups (8 member limit) | Medium | ~$47/mo | None | Small groups only |
| Baileys / whatsapp-web.js | High | Free (infra only) | **HIGH** | Not recommended |
| GREEN-API / Whapi.Cloud | Medium | ~$50-100/mo | Medium | Only if you accept ToS risk |

**Recommendation:** Start with manual groups + link in the app UI. Add Cloud API for notifications once booking flow is stable. Never use unofficial libraries for a production business product.

---

## 3. Supabase at Scale (1000 bookings/day)

### 3.1 Supabase Pricing Tiers (2025-2026)

| Feature | Free | Pro ($25/mo) | Team ($599/mo) |
|---------|------|-------------|----------------|
| Database | 500 MB | 8 GB | 8 GB |
| File Storage | 1 GB | 100 GB | 100 GB |
| Bandwidth/Egress | 2 GB | 250 GB | 250 GB |
| Monthly Active Users (Auth) | 50,000 | 100,000 | 100,000 |
| Edge Function Invocations | 500K | 2M | 2M |
| Realtime Connections | 200 concurrent | 500 concurrent | 500 concurrent |
| Max file upload | 50 MB | 500 GB | 500 GB |
| Compute credits | -- | $10/mo included | $10/mo included |
| Daily backups | No | Yes | Yes |
| Read replicas | No | Available (add-on) | Available (add-on) |

**Overage pricing (Pro plan):**
- Database: $0.125/GB/month
- Storage: $0.021/GB/month
- Bandwidth: $0.09/GB
- MAU: $0.00325 per MAU above 100K
- Edge Functions: $2 per million invocations

**For 1000 bookings/day:**
- ~30K bookings/month = modest DB usage (~100-500 MB with all relations)
- ~30K MAU (assuming repeat users) = well within Pro 100K limit
- Storage for venue photos: depends on quantity, but 100 GB is generous
- Realtime: 500 concurrent connections is sufficient for initial scale
- Edge Functions: 2M invocations covers cron jobs + notifications comfortably

**Verdict:** The Pro plan at $25/month comfortably handles 1000 bookings/day. You may want a compute add-on ($50-100/mo) if query complexity grows. **Estimated total: $25-75/month** at this scale.

### 3.2 Row Level Security (RLS) for Multi-Tenant Coworking

**Pattern: Shared tables with tenant isolation via user context**

For a coworking platform, "multi-tenant" means:
- Users see only their own bookings
- Venue owners/admins see bookings for their venues
- Super admins see everything

**Core RLS policies:**

```sql
-- Enable RLS on all tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- BOOKINGS TABLE POLICIES
-- =============================================

-- Users can read their own bookings
CREATE POLICY "Users read own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create bookings for themselves
CREATE POLICY "Users create own bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Venue admins can read bookings for their venues
CREATE POLICY "Venue admins read venue bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_admins
      WHERE admin_user_id = auth.uid()
    )
  );

-- Venue admins can update booking status for their venues
CREATE POLICY "Venue admins update venue bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_admins
      WHERE admin_user_id = auth.uid()
    )
  );

-- Super admins can do everything (using custom claim in JWT)
CREATE POLICY "Super admin full access"
  ON bookings FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- =============================================
-- VENUES TABLE POLICIES
-- =============================================

-- Anyone authenticated can read active venues
CREATE POLICY "Anyone can read active venues"
  ON venues FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only super admins can create/update venues
CREATE POLICY "Super admin manage venues"
  ON venues FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
```

**Performance optimization -- use JWT claims instead of subqueries:**

Store `role` in `app_metadata` (not `user_metadata`) so users cannot modify it themselves. Access via JWT claim avoids a subquery on every row check:

```sql
-- Faster: reads from JWT directly, no subquery needed
CREATE POLICY "Admin access"
  ON bookings FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  );
```

**Set role on user via Supabase admin API:**

```typescript
// Server-side only (admin action)
const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { role: "admin", venue_id: "some-venue-uuid" },
});
```

**Index all columns used in RLS policies:**

```sql
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_venue_date ON bookings(venue_id, booking_date);
CREATE INDEX idx_venue_admins_admin_user_id ON venue_admins(admin_user_id);
CREATE INDEX idx_venue_admins_venue_id ON venue_admins(venue_id);
```

**Best practices:**
- Any column used in policies MUST be indexed
- Avoid complex monolithic policies -- break into smaller per-operation rules
- Store tenant/role info in `app_metadata` (immutable by user) not `user_metadata` (user-editable)
- Test policies with `supabase.auth.getUser()` to verify correct row visibility

### 3.3 Edge Functions for Cron Jobs (Group Assignment)

Supabase supports `pg_cron` (Postgres extension) combined with `pg_net` to invoke Edge Functions on a schedule.

**Use case:** Every evening at 8 PM IST, assign confirmed bookings for tomorrow into WhatsApp groups and send notifications.

**Step 1: Create the Edge Function**

```typescript
// supabase/functions/assign-groups/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Get all confirmed bookings for tomorrow that haven't been assigned to groups
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, user_id, venue_id,
      user:profiles(phone, name),
      venue:venues(name)
    `)
    .eq("booking_date", tomorrowStr)
    .eq("payment_status", "admin_verified")
    .eq("group_assigned", false);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  // Group bookings by venue
  const venueGroups = new Map<string, typeof bookings>();
  for (const booking of bookings ?? []) {
    const key = booking.venue_id;
    if (!venueGroups.has(key)) venueGroups.set(key, []);
    venueGroups.get(key)!.push(booking);
  }

  let processed = 0;

  // For each venue, get the group link and notify users
  for (const [venueId, venueBookings] of venueGroups) {
    // Get the WhatsApp group link for this venue + date
    const { data: group } = await supabase
      .from("venue_groups")
      .select("whatsapp_invite_link")
      .eq("venue_id", venueId)
      .eq("group_date", tomorrowStr)
      .single();

    if (!group?.whatsapp_invite_link) continue;

    // Mark bookings as group-assigned
    const bookingIds = venueBookings.map((b) => b.id);
    await supabase
      .from("bookings")
      .update({ group_assigned: true })
      .in("id", bookingIds);

    // Send WhatsApp notifications (via Cloud API)
    for (const booking of venueBookings) {
      if (booking.user?.phone) {
        // Call WhatsApp Cloud API here
        // await sendWhatsAppMessage(booking.user.phone, group.whatsapp_invite_link);
      }
      processed++;
    }
  }

  return new Response(
    JSON.stringify({ processed, date: tomorrowStr }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

**Step 2: Deploy the Edge Function**

```bash
supabase functions deploy assign-groups
```

**Step 3: Schedule with pg_cron**

```sql
-- Run every day at 8 PM IST (2:30 PM UTC)
SELECT cron.schedule(
  'assign-groups-daily',
  '30 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/assign-groups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  ) AS request_id;
  $$
);
```

**Cron job limitations and best practices:**
- Maximum 8 concurrent jobs recommended
- Each job should complete within 10 minutes
- Cron expressions: `* * * * *` (every minute) to `0 0 1 1 *` (once a year)
- For large batch jobs (>1000 items), use Supabase Queues with Edge Functions for chunked processing
- Always include `Authorization` header with service role key

### 3.4 Atomic Booking (Preventing Overbooking)

This is critical. With 1000 bookings/day, race conditions WILL happen if you rely on application-level checks.

**Approach: Postgres function with SELECT ... FOR UPDATE**

```sql
CREATE OR REPLACE FUNCTION book_seat(
  p_user_id UUID,
  p_venue_id UUID,
  p_booking_date DATE,
  p_seat_type TEXT DEFAULT 'hot_desk'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges, bypasses RLS
AS $$
DECLARE
  v_max_capacity INT;
  v_current_bookings INT;
  v_available_seats INT;
  v_booking_id UUID;
  v_price DECIMAL(10,2);
BEGIN
  -- Lock the capacity row for this venue+seat_type to serialize concurrent attempts
  SELECT capacity, price_per_day
  INTO v_max_capacity, v_price
  FROM venue_capacity
  WHERE venue_id = p_venue_id
    AND seat_type = p_seat_type
  FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Venue or seat type not found');
  END IF;

  -- Count current active bookings for this venue+date+seat_type
  SELECT COUNT(*)
  INTO v_current_bookings
  FROM bookings
  WHERE venue_id = p_venue_id
    AND booking_date = p_booking_date
    AND seat_type = p_seat_type
    AND status IN ('confirmed', 'pending_payment');

  v_available_seats := v_max_capacity - v_current_bookings;

  IF v_available_seats <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No seats available',
      'available', 0
    );
  END IF;

  -- Check if user already has a booking for this date+venue
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE user_id = p_user_id
      AND venue_id = p_venue_id
      AND booking_date = p_booking_date
      AND status IN ('confirmed', 'pending_payment')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You already have a booking for this date');
  END IF;

  -- Insert the booking (atomic with the capacity check)
  INSERT INTO bookings (user_id, venue_id, booking_date, seat_type, status, payment_status, amount)
  VALUES (p_user_id, p_venue_id, p_booking_date, p_seat_type, 'pending_payment', 'pending', v_price)
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'amount', v_price,
    'available_after', v_available_seats - 1
  );
END;
$$;
```

**How the locking works:**
1. `FOR UPDATE` on `venue_capacity` acquires an exclusive row-level lock
2. If two users try to book the last seat simultaneously, one transaction waits for the other to commit
3. The waiting transaction then sees the updated count and correctly rejects
4. The entire check-and-insert runs in a single transaction -- no gap for race conditions

**Call from Next.js via Supabase RPC:**

```typescript
// app/api/bookings/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { venueId, date, seatType } = await request.json();

  const { data, error } = await supabase.rpc("book_seat", {
    p_user_id: user.id,
    p_venue_id: venueId,
    p_booking_date: date,
    p_seat_type: seatType || "hot_desk",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.success) {
    return NextResponse.json(
      { error: data.error, available: data.available },
      { status: 409 }
    );
  }

  return NextResponse.json({
    bookingId: data.booking_id,
    amount: data.amount,
    availableSeats: data.available_after,
  });
}
```

**Additional safeguard -- partial unique index:**

```sql
-- Prevent duplicate bookings at the database level as a safety net
CREATE UNIQUE INDEX idx_unique_active_booking
  ON bookings(user_id, venue_id, booking_date)
  WHERE status IN ('confirmed', 'pending_payment');
```

This catches any edge case the function might miss and provides a hard database-level guarantee.

### 3.5 Supabase Realtime for Live Updates

**Use case:** Show live seat availability as users are browsing and booking.

```typescript
// hooks/useRealtimeAvailability.ts
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeAvailability(venueId: string, date: string) {
  const [bookingCount, setBookingCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    async function fetchCount() {
      const { count } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("booking_date", date)
        .in("status", ["confirmed", "pending_payment"]);

      setBookingCount(count ?? 0);
    }
    fetchCount();

    // Subscribe to real-time changes on bookings table
    const channel = supabase
      .channel(`bookings:${venueId}:${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",  // INSERT, UPDATE, DELETE
          schema: "public",
          table: "bookings",
          filter: `venue_id=eq.${venueId}`,
        },
        (_payload) => {
          // Re-fetch count on any change
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, date]);

  return bookingCount;
}
```

**Usage in component:**

```tsx
function VenueCard({ venue, date }: { venue: Venue; date: string }) {
  const bookingCount = useRealtimeAvailability(venue.id, date);
  const available = venue.capacity - bookingCount;

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold">{venue.name}</h3>
      <p className={available <= 3 ? "text-red-500 font-bold" : "text-green-600"}>
        {available} seats available
      </p>
      {available <= 3 && available > 0 && (
        <p className="text-orange-500 text-sm">Filling up fast!</p>
      )}
      {available <= 0 && (
        <p className="text-red-600 text-sm font-bold">Fully booked</p>
      )}
    </div>
  );
}
```

**Realtime scaling considerations:**

| Concern | Detail |
|---------|--------|
| Pro plan limit | 500 concurrent Realtime connections |
| Channels per connection | Up to 100 |
| RLS performance impact | Postgres Changes with RLS checks every subscriber on every change. 100 subscribers + 1 INSERT = 100 RLS checks |
| Mitigation for scale | Use a separate `availability_summary` table WITHOUT RLS, updated by triggers. Subscribe to that instead |
| Alternative for ephemeral data | Use Broadcast channels instead of Postgres Changes |
| Compute impact | DB changes are processed single-threaded; compute upgrades have limited effect on Postgres Change subscriptions |

**Performance pattern for scale -- summary table approach:**

```sql
-- Materialized availability (no RLS, fast reads)
CREATE TABLE availability_summary (
  venue_id UUID REFERENCES venues(id) NOT NULL,
  booking_date DATE NOT NULL,
  seat_type TEXT NOT NULL,
  booked_count INT DEFAULT 0,
  max_capacity INT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (venue_id, booking_date, seat_type)
);

-- No RLS on this table -- it's public read data
-- Updated via trigger on bookings table

CREATE OR REPLACE FUNCTION update_availability_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO availability_summary (venue_id, booking_date, seat_type, booked_count, max_capacity)
  SELECT
    COALESCE(NEW.venue_id, OLD.venue_id),
    COALESCE(NEW.booking_date, OLD.booking_date),
    COALESCE(NEW.seat_type, OLD.seat_type),
    COUNT(*),
    (SELECT capacity FROM venue_capacity
     WHERE venue_id = COALESCE(NEW.venue_id, OLD.venue_id)
       AND seat_type = COALESCE(NEW.seat_type, OLD.seat_type))
  FROM bookings
  WHERE venue_id = COALESCE(NEW.venue_id, OLD.venue_id)
    AND booking_date = COALESCE(NEW.booking_date, OLD.booking_date)
    AND seat_type = COALESCE(NEW.seat_type, OLD.seat_type)
    AND status IN ('confirmed', 'pending_payment')
  ON CONFLICT (venue_id, booking_date, seat_type)
  DO UPDATE SET
    booked_count = EXCLUDED.booked_count,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_availability
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_availability_summary();
```

Then subscribe to `availability_summary` instead of `bookings` -- no RLS checks needed since it contains only aggregate public data.

### 3.6 Storage for Venue Photos

```typescript
// lib/storage.ts
import { createClient } from "@/lib/supabase/server";

export async function uploadVenuePhoto(
  venueId: string,
  file: File,
  index: number
) {
  const supabase = await createClient();
  const ext = file.name.split(".").pop();
  const path = `venues/${venueId}/${Date.now()}-${index}.${ext}`;

  const { data, error } = await supabase.storage
    .from("venue-photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("venue-photos")
    .getPublicUrl(path);

  return publicUrl;
}

// Get optimized image URL with Supabase Image Transformations
export function getOptimizedImageUrl(
  supabase: any,
  path: string,
  width: number = 800,
  height: number = 600
) {
  const { data: { publicUrl } } = supabase.storage
    .from("venue-photos")
    .getPublicUrl(path, {
      transform: {
        width,
        height,
        resize: "cover",
        quality: 80,
      },
    });

  return publicUrl;
}
```

**Storage bucket setup (SQL):**

```sql
-- Create a public bucket for venue photos (5 MB limit per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('venue-photos', 'venue-photos', true, 5242880);

-- RLS: Anyone can read venue photos (public bucket)
CREATE POLICY "Public read venue photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'venue-photos');

-- RLS: Only admins can upload photos
CREATE POLICY "Admins upload venue photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'venue-photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- RLS: Only admins can delete photos
CREATE POLICY "Admins delete venue photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'venue-photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  );
```

**Storage pricing:**
- Pro plan includes 100 GB storage
- Overage: $0.021/GB/month
- Image transforms are included (no extra cost)
- Free plan: 1 GB storage, 50 MB max upload

### 3.7 Complete Database Schema

```sql
-- =========================================================
-- COMPLETE SCHEMA FOR COWORKING BOOKING PLATFORM
-- =========================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  city TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Venues
CREATE TABLE venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  description TEXT,
  amenities JSONB DEFAULT '[]',  -- ["wifi", "ac", "parking", "coffee"]
  photos TEXT[] DEFAULT '{}',     -- Array of storage URLs
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Venue capacity by seat type
CREATE TABLE venue_capacity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  seat_type TEXT NOT NULL,         -- 'hot_desk', 'dedicated_desk', 'meeting_room', 'phone_booth'
  capacity INT NOT NULL,
  price_per_day DECIMAL(10, 2) NOT NULL,
  UNIQUE(venue_id, seat_type)
);

-- Venue admins (who manages which venues)
CREATE TABLE venue_admins (
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT DEFAULT 'admin',       -- 'admin', 'staff'
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(venue_id, admin_user_id)
);

-- Bookings
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  venue_id UUID REFERENCES venues(id) NOT NULL,
  booking_date DATE NOT NULL,
  seat_type TEXT DEFAULT 'hot_desk',
  status TEXT DEFAULT 'pending_payment',
    -- pending_payment | confirmed | cancelled | completed | no_show
  payment_status TEXT DEFAULT 'pending',
    -- pending | user_confirmed | admin_verified | failed
  amount DECIMAL(10, 2) NOT NULL,
  group_assigned BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate active bookings at the DB level
CREATE UNIQUE INDEX idx_unique_active_booking
  ON bookings(user_id, venue_id, booking_date)
  WHERE status IN ('confirmed', 'pending_payment');

-- Payment tracking
CREATE TABLE payment_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  upi_ref TEXT NOT NULL,              -- BK-20260210-0042
  user_upi_txn_id TEXT,               -- User-provided UPI transaction ID
  status TEXT DEFAULT 'qr_generated',
    -- qr_generated | user_confirmed | admin_verified | failed
  generated_at TIMESTAMPTZ NOT NULL,
  user_confirmed_at TIMESTAMPTZ,
  admin_verified_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp groups per venue per date
CREATE TABLE venue_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  group_date DATE NOT NULL,
  whatsapp_invite_link TEXT,          -- https://chat.whatsapp.com/ABC123...
  max_members INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue_id, group_date)
);

-- Availability summary (denormalized for fast reads + Realtime)
CREATE TABLE availability_summary (
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  booking_date DATE NOT NULL,
  seat_type TEXT NOT NULL,
  booked_count INT DEFAULT 0,
  max_capacity INT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (venue_id, booking_date, seat_type)
);

-- =========================================================
-- INDEXES FOR PERFORMANCE
-- =========================================================

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_venue_date ON bookings(venue_id, booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_group_assigned ON bookings(group_assigned) WHERE group_assigned = false;
CREATE INDEX idx_payment_intents_booking ON payment_intents(booking_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_venue_groups_venue_date ON venue_groups(venue_id, group_date);
CREATE INDEX idx_venue_admins_admin ON venue_admins(admin_user_id);
CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_active ON venues(is_active) WHERE is_active = true;
CREATE INDEX idx_profiles_phone ON profiles(phone);
```

### 3.8 Supabase Scale Checklist for 1000 Bookings/Day

| Concern | Solution | Notes |
|---------|----------|-------|
| Overbooking | Postgres function with `FOR UPDATE` + partial unique index | Serializes concurrent booking attempts at the DB level |
| RLS performance | Use JWT `app_metadata` claims; index all policy columns | Avoids N+1 subqueries on every request |
| Realtime at scale | Use `availability_summary` table without RLS | Reduces per-event RLS checks from O(subscribers) to O(1) |
| Cron jobs | `pg_cron` + `pg_net` to invoke Edge Functions | Max 8 concurrent, 10 min timeout each |
| File uploads | Supabase Storage, 5 MB limit per photo | Built-in image transforms for thumbnails |
| Connection pooling | Built-in Supavisor (PgBouncer replacement) | Use pooled connection string for API routes |
| Monitoring | Supabase Dashboard + `pg_stat_statements` | Watch for slow queries, high RLS overhead |
| Backups | Pro plan = daily backups | Add PITR ($100/mo add-on) for point-in-time recovery |
| Auth | Supabase Auth with Google + email magic link | Phone OTP available via Twilio integration |

---

## Summary: MVP Build Order

**Week 1: Core Booking**
- Supabase project on Pro plan ($25/mo)
- Auth setup (Supabase Auth with Google OAuth + email magic link)
- Venues + venue_capacity tables with RLS
- Atomic booking function (`book_seat` with `FOR UPDATE`)
- Basic venue listing and booking UI in Next.js

**Week 2: Payments**
- UPI QR generation (`qrcode` npm package + UPI deep link builder)
- Payment screen component with QR display + "Open UPI App" button
- Payment intent tracking in DB
- Admin dashboard for manual payment verification
- Booking status flow: pending -> user_confirmed -> admin_verified

**Week 3: WhatsApp + Polish**
- Manual WhatsApp groups + invite links stored in DB
- Display group invite link on booking confirmation page
- (Optional) WhatsApp Cloud API for sending confirmation messages
- Realtime seat availability via `availability_summary` table
- Venue photo uploads to Supabase Storage

**Week 4: Automation + Scale**
- `pg_cron` daily job for group assignment notifications
- Edge Function for batch WhatsApp notifications
- Admin dashboard improvements (payment verification queue, analytics)
- Load testing the atomic booking function
- Error handling and edge case coverage

---

## Sources

### UPI QR Code
- [NPCI UPI Linking Specifications](https://www.labnol.org/files/linking.pdf)
- [upiqr TypeScript library (GitHub)](https://github.com/bhar4t/upiqr)
- [@adityavijay21/upiqr (npm)](https://www.npmjs.com/package/@adityavijay21/upiqr)
- [qrcode npm package](https://www.npmjs.com/package/qrcode)
- [next-qrcode for Next.js](https://next-qrcode.js.org/)
- [Setu UPI DeepLinks](https://docs.setu.co/payments/upi-deeplinks/quickstart)
- [UPI Deep Link Builder (GitHub)](https://github.com/vivekkushwaha66/upi-deeplink-builder)

### WhatsApp
- [WhatsApp Cloud API Pricing 2026](https://respond.io/blog/whatsapp-business-api-pricing)
- [WhatsApp Business Platform Pricing (Official)](https://business.whatsapp.com/products/platform-pricing)
- [WhatsApp Cloud API Groups Support 2025](https://whatsboost.in/blog/whatsapp-cloud-api-groups-support-in-2025-the-complete-business-guide)
- [WhatsApp Groups API Overview (Sanuker)](https://sanuker.com/whatsapp-groups-api-en/)
- [Baileys WhatsApp Library](https://baileys.wiki/docs/intro/)
- [Official Meta WhatsApp Node.js SDK](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK)
- [WhatsApp API Pricing India 2026](https://wanotifier.com/whatsapp-api-pricing/)
- [WhatsApp Cloud API Setup Guide 2026 (Chatarmin)](https://chatarmin.com/en/blog/whatsapp-cloudapi)
- [GREEN-API Pricing](https://green-api.com/en/docs/about-tariffs/)
- [Baileys 2025 Complete Guide](https://blog.pallysystems.com/2025/12/04/whatsapp-automation-using-baileys-js-a-complete-guide/)

### Supabase
- [Supabase Pricing (Official)](https://supabase.com/pricing)
- [Supabase Pricing 2026 Complete Breakdown](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)
- [Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Multi-Tenant RLS on Supabase (AntStack)](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron Module](https://supabase.com/docs/guides/cron)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing)
- [Supabase Storage Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase Storage Pricing](https://supabase.com/docs/guides/storage/pricing)
- [PostgreSQL Explicit Locking (FOR UPDATE)](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Preventing Double Booking with Two-Phase Locking](https://medium.com/@oyebisijemil_41110/preventing-double-booking-in-databases-with-two-phase-locking-9a4538650496)
- [Solving Double Booking with PostgreSQL](https://jsupskills.dev/how-to-solve-the-double-booking-problem/)
- [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
