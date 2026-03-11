# donedonadone — Comprehensive Test Plan

## Status Tracker

| Suite | Tests | File | Status |
|-------|-------|------|--------|
| **Lib: Utils** | 13 tests — isValidUUID, cn | `tests/unit/lib/utils.test.ts` | DONE |
| **Lib: Config** | 28 tests — platformFee, priceWithGST, gstAmount, trust tiers, constants | `tests/unit/lib/config.test.ts` | DONE |
| **Lib: Payments** | 14 tests — generateUPILink, generateQRDataUrl, formatPaymentAmount | `tests/unit/lib/payments.test.ts` | DONE |
| **Lib: Moderation** | 18 tests — moderateText, sanitizeDisplayName, consecutive calls | `tests/unit/lib/moderation.test.ts` | DONE |
| **Lib: Format** | 7 tests — formatTime, formatCurrency | `tests/unit/lib/format.test.ts` | DONE |
| **API: Auth Flow** | signup, login, logout, forgot-password, email verify | — | Needs Supabase integration test |
| **API: Bookings** | create, cancel, duplicate check, booking limit, overlap check | — | Needs Supabase integration test |
| **API: Payments** | 13 tests — UPI link, amount validation, state transitions | `tests/unit/api/payments.test.ts` | DONE |
| **API: Sessions** | list, filter by date/area/vibe | — | Needs Supabase integration test |
| **API: Check-in** | 7 tests — haversine math, distance validation | `tests/unit/api/checkin.test.ts` | DONE |
| **API: Feedback** | 24 tests — ratings, venue keys, self-rating, time window, moderation | `tests/unit/api/feedback.test.ts` | DONE |
| **API: Partner** | 6 tests — field whitelist, prototype pollution | `tests/unit/api/partner-sessions.test.ts` | DONE |
| **API: Admin** | financials, user management, session overview | — | Needs Supabase integration test |
| **API: Cron** | 10 tests — timing-safe auth, Bearer token validation | `tests/unit/api/cron.test.ts` | DONE |
| **API: Reports** | 10 tests — reason whitelist, self-report, UUID, truncation | `tests/unit/api/reports.test.ts` | DONE |
| **API: Account** | deletion flow | — | Needs Supabase integration test |
| **API: Referrals** | credit cap, max_uses | — | Needs Supabase integration test |
| **API: Onboarding** | save quiz, content moderation | — | Needs Supabase integration test |
| **Security: RLS** | role escalation, booking mutation, subscription mutation | — | Needs live Supabase |
| **Security: Input** | 48 tests — UUID injection, moderation bypass, key whitelist | `tests/security/input-validation.test.ts` | DONE |
| **Security: Auth** | 16 tests — auth guards, admin/partner/cron/ownership | `tests/security/auth-guards.test.ts` | DONE |
| **Security: Headers** | 12 tests — CSP, HSTS, X-Frame, robots.txt | `tests/security/headers.test.ts` | DONE |
| **Integration: Booking→Payment→Checkin→Feedback** | Full user journey | — | Needs Playwright E2E |
| **Integration: Partner→Session→Booking** | Partner creates, user books | — | Needs Playwright E2E |

**Total: 226 tests passing across 14 files** (as of latest run)

---

## 1. Testing Stack

- **Unit/Integration:** Vitest (fast, ESM-native, TypeScript-first)
- **API Route Testing:** Vitest + custom Next.js route handler mocks
- **Component Testing:** Vitest + React Testing Library (future phase)
- **E2E Testing:** Playwright (future phase — requires running app)

### Why Vitest over Jest
- Native ESM support (Next.js App Router uses ESM)
- TypeScript out of the box
- Faster execution (Vite-based)
- Compatible API (drop-in Jest replacement)

---

## 2. Test Infrastructure

### Directory Structure
```
tests/
├── unit/
│   ├── lib/
│   │   ├── utils.test.ts
│   │   ├── config.test.ts
│   │   ├── payments.test.ts
│   │   ├── moderation.test.ts
│   │   └── format.test.ts
│   └── api/
│       ├── helpers/
│       │   └── mock-supabase.ts      # Shared Supabase mock
│       ├── bookings.test.ts
│       ├── payments.test.ts
│       ├── sessions.test.ts
│       ├── checkin.test.ts
│       ├── feedback.test.ts
│       ├── partner-sessions.test.ts
│       ├── cron.test.ts
│       ├── reports.test.ts
│       ├── account-delete.test.ts
│       ├── referrals.test.ts
│       └── onboarding.test.ts
├── security/
│   ├── input-validation.test.ts
│   ├── auth-guards.test.ts
│   └── headers.test.ts
├── integration/
│   ├── booking-journey.test.ts
│   └── partner-journey.test.ts
└── setup.ts                          # Global test setup
```

### Config Files
- `vitest.config.ts` — Vitest configuration with path aliases
- `tests/setup.ts` — Global mocks (Supabase, NextRequest/NextResponse)

---

## 3. Test Priority (Ordered by Risk)

### Priority 1 — Security & Money (implement first)
These tests protect revenue and user safety.

1. **Payment flow** — QR generation, state transitions, amount validation
2. **Booking logic** — Duplicate prevention, booking limit, cancellation
3. **Auth guards** — All API routes reject unauthenticated requests
4. **Input validation** — UUID validation, venue key whitelist, content moderation
5. **Cron security** — Timing-safe secret validation
6. **Check-in geolocation** — Haversine distance calculation accuracy
7. **Feedback restrictions** — Self-rating prevention, checked_in gate, time window

### Priority 2 — Core Business Logic
8. **Session listing** — Filtering, date handling
9. **Partner operations** — Session CRUD, field whitelist, earnings calculation
10. **Referral system** — Credit cap, max_uses enforcement
11. **Onboarding** — Content moderation, bio sanitization

### Priority 3 — Admin & Edge Cases
12. **Admin routes** — Authorization, financial calculations
13. **Account deletion** — Anonymization, cascading cleanup
14. **Cron jobs** — Session transitions, booking expiry, subscription expiry

---

## 4. Detailed Test Cases

### 4.1 Lib: Utils (`tests/unit/lib/utils.test.ts`)

```
isValidUUID:
  ✓ returns true for valid v4 UUID
  ✓ returns false for empty string
  ✓ returns false for random string
  ✓ returns false for partial UUID
  ✓ returns false for UUID with wrong version
  ✓ returns false for null/undefined

cn:
  ✓ merges class names
  ✓ handles conditional classes
  ✓ deduplicates tailwind classes
```

### 4.2 Lib: Config (`tests/unit/lib/config.test.ts`)

```
platformFee:
  ✓ returns 100 for 2-hour session
  ✓ returns 150 for 4-hour session
  ✓ returns 100 for unrecognized duration (default)

priceWithGST:
  ✓ calculates 18% GST correctly
  ✓ handles zero amount
  ✓ returns number (not string)

gstAmount:
  ✓ returns just the GST portion
  ✓ handles decimal amounts

Constants:
  ✓ VIBES array is non-empty
  ✓ SESSION_STATUSES includes expected values
  ✓ PLATFORM_FEE_2HR is 100
  ✓ PLATFORM_FEE_4HR is 150
```

### 4.3 Lib: Payments (`tests/unit/lib/payments.test.ts`)

```
generateUPILink:
  ✓ returns valid upi:// URL
  ✓ includes correct amount
  ✓ includes booking ID in transaction ref
  ✓ includes payee name
  ✓ includes INR currency
  ✓ truncates long booking IDs to 20 chars
  ✓ uses custom transaction note when provided

generateQRDataUrl:
  ✓ returns a data:image/png;base64 string
  ✓ generates different QR for different inputs
  ✓ handles empty string input

formatPaymentAmount:
  ✓ formats with ₹ symbol
  ✓ rounds to integer
  ✓ handles zero
```

### 4.4 Lib: Moderation (`tests/unit/lib/moderation.test.ts`)

```
moderateText:
  ✓ returns clean:true for normal text
  ✓ flags offensive words
  ✓ catches phone numbers (10-digit)
  ✓ catches email addresses
  ✓ catches URLs
  ✓ catches WhatsApp/Telegram references
  ✓ is case-insensitive
  ✓ handles empty string
  ✓ handles very long text

sanitizeDisplayName:
  ✓ trims whitespace
  ✓ removes special characters
  ✓ truncates to max length
  ✓ handles empty input
```

### 4.5 API: Bookings (`tests/unit/api/bookings.test.ts`)

```
POST /api/bookings:
  ✓ rejects unauthenticated requests (401)
  ✓ rejects missing session_id (400)
  ✓ rejects invalid UUID session_id (400)
  ✓ rejects if user has no onboarding profile (403)
  ✓ rejects duplicate booking for same session (409)
  ✓ rejects if user has 5+ active bookings (429)
  ✓ rejects overlapping session times (409)
  ✓ creates booking on valid request
  ✓ calls book_session RPC with correct params

DELETE /api/bookings/[id]:
  ✓ rejects unauthenticated requests
  ✓ rejects booking not owned by user
  ✓ cancels booking and decrements spots
```

### 4.6 API: Payments (`tests/unit/api/payments.test.ts`)

```
POST /api/bookings/[id]/payment:
  ✓ rejects unauthenticated requests
  ✓ rejects if booking not found
  ✓ rejects if payment_status != pending
  ✓ generates UPI link and QR code
  ✓ updates status to payment_pending
  ✓ returns qrDataUrl in response

PATCH /api/bookings/[id]/payment:
  ✓ rejects unauthenticated requests
  ✓ rejects if booking not found
  ✓ rejects invalid payment state (already paid)
  ✓ updates to paid status
  ✓ stores payment reference if provided
```

### 4.7 API: Check-in (`tests/unit/api/checkin.test.ts`)

```
GET /api/session/[id]/checkin:
  ✓ rejects unauthenticated requests
  ✓ rejects if no confirmed booking
  ✓ returns booking check-in status
  ✓ returns group members with check-in status
  ✓ returns session info

POST /api/session/[id]/checkin:
  ✓ rejects unauthenticated requests
  ✓ rejects if no confirmed booking
  ✓ checks in without coordinates (fallback)
  ✓ checks in with valid coordinates (within 500m)
  ✓ rejects check-in too far from venue (>500m)
  ✓ returns distance in error message

Haversine calculation:
  ✓ returns 0 for same point
  ✓ calculates known distance correctly (HSR Layout landmarks)
  ✓ handles antipodal points
  ✓ is symmetric (A→B == B→A)
```

### 4.8 API: Feedback (`tests/unit/api/feedback.test.ts`)

```
POST /api/session/[id]/feedback:
  ✓ rejects unauthenticated requests
  ✓ rejects if not checked in
  ✓ rejects if session older than 7 days
  ✓ rejects invalid UUID session_id
  ✓ rejects invalid venue rating keys
  ✓ filters out self-ratings from member_ratings
  ✓ validates member_ratings users are in same group
  ✓ rejects offensive comments (moderation)
  ✓ saves valid feedback
  ✓ saves venue ratings for allowed keys only
```

### 4.9 API: Partner Sessions (`tests/unit/api/partner-sessions.test.ts`)

```
PATCH /api/partner/sessions/[id]:
  ✓ rejects unauthenticated requests
  ✓ rejects non-partner users
  ✓ only allows whitelisted fields
  ✓ ignores disallowed fields (id, venue_id, platform_fee)
  ✓ updates session with valid fields
```

### 4.10 API: Cron (`tests/unit/api/cron.test.ts`)

```
GET /api/cron/notifications:
  ✓ rejects missing Authorization header (401)
  ✓ rejects wrong secret (401)
  ✓ rejects undefined CRON_SECRET (401)
  ✓ accepts correct secret (timing-safe)
  ✓ transitions upcoming→in_progress sessions
  ✓ transitions in_progress→completed sessions
  ✓ expires stale bookings (>15 min pending)
  ✓ expires overdue subscriptions
```

### 4.11 Security Tests (`tests/security/`)

```
Input Validation:
  ✓ UUID validator rejects SQL injection attempts
  ✓ UUID validator rejects XSS payloads
  ✓ Content moderation catches encoded phone numbers
  ✓ Venue key whitelist rejects prototype pollution keys (__proto__)

Auth Guards:
  ✓ Every API route returns 401 without auth
  ✓ Admin routes reject non-admin users
  ✓ Partner routes reject non-partner users
  ✓ Users cannot access other users' bookings

Headers:
  ✓ X-Frame-Options is DENY
  ✓ X-Content-Type-Options is nosniff
  ✓ Strict-Transport-Security is set
  ✓ Referrer-Policy is strict-origin-when-cross-origin
```

---

## 5. Mocking Strategy

### Supabase Mock
All API routes use `createClient()` from `@/lib/supabase/server`. We mock this at the module level:

```typescript
// tests/unit/api/helpers/mock-supabase.ts
// Provides chainable query builder mock:
// supabase.from("table").select("*").eq("col", val).single()
// Each method returns `this` for chaining, .single()/.execute() resolves the mock data
```

### NextRequest/NextResponse Mock
```typescript
// Create real NextRequest objects with custom headers, body, params
// NextResponse.json() returns actual Response objects for assertion
```

### Environment Variables
```typescript
// Set in tests/setup.ts or per-test via vi.stubEnv()
process.env.CRON_SECRET = "test-secret"
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
```

---

## 6. Running Tests

```bash
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:security       # Security tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode for development
```

---

## 7. Coverage Targets

| Category | Target | Rationale |
|----------|--------|-----------|
| Lib functions | 95%+ | Pure functions, easy to test |
| API routes (auth/payment) | 90%+ | Revenue & security critical |
| API routes (other) | 80%+ | Important but lower risk |
| Components | 50%+ | Future phase (RTL) |
| E2E flows | Key paths | Future phase (Playwright) |

---

## 8. How to Resume

If you're picking this up later:

1. Check the **Status Tracker** table at the top — it shows what's done
2. Run `npm test` to see current green/red state
3. Tests are in `tests/` directory, organized by category
4. Mocks are in `tests/unit/api/helpers/`
5. Global setup is in `tests/setup.ts`
6. Config is in `vitest.config.ts`

### Quick Start
```bash
# Run all tests
npm test

# Run a specific suite
npx vitest tests/unit/lib/payments.test.ts

# Run with coverage
npx vitest --coverage
```

---

## 9. Implementation Notes

- All API route tests mock Supabase — they don't need a running database
- Haversine tests use known coordinates (HSR Layout landmarks)
- Payment tests verify QR code output is valid base64 data URL
- Security tests are designed to catch regressions if someone removes a guard
- Cron tests verify timing-safe comparison by testing both correct and incorrect secrets
