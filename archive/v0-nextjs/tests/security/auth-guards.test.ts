import { describe, it, expect } from "vitest"

// These tests verify the auth guard PATTERNS used across all API routes.
// They test the logic flow, not actual Supabase calls.

describe("Security: Auth Guard Patterns", () => {
  describe("Standard auth guard", () => {
    // Pattern: if (!user) return 401
    function authGuard(user: { id: string } | null) {
      if (!user) return { status: 401, error: "Unauthorized" }
      return { status: 200, user }
    }

    it("returns 401 for null user", () => {
      expect(authGuard(null).status).toBe(401)
    })

    it("returns 200 for valid user", () => {
      expect(authGuard({ id: "user-1" }).status).toBe(200)
    })
  })

  describe("Admin guard", () => {
    // Pattern: check profile.user_type === 'admin'
    function adminGuard(profile: { user_type: string } | null) {
      if (!profile || profile.user_type !== "admin") {
        return { status: 403, error: "Forbidden" }
      }
      return { status: 200 }
    }

    it("rejects null profile", () => {
      expect(adminGuard(null).status).toBe(403)
    })

    it("rejects coworker", () => {
      expect(adminGuard({ user_type: "coworker" }).status).toBe(403)
    })

    it("rejects partner", () => {
      expect(adminGuard({ user_type: "partner" }).status).toBe(403)
    })

    it("accepts admin", () => {
      expect(adminGuard({ user_type: "admin" }).status).toBe(200)
    })
  })

  describe("Partner guard", () => {
    function partnerGuard(profile: { user_type: string } | null) {
      if (!profile || profile.user_type !== "partner") {
        return { status: 403, error: "Forbidden" }
      }
      return { status: 200 }
    }

    it("rejects coworker", () => {
      expect(partnerGuard({ user_type: "coworker" }).status).toBe(403)
    })

    it("accepts partner", () => {
      expect(partnerGuard({ user_type: "partner" }).status).toBe(200)
    })

    it("rejects admin (partner routes are partner-only)", () => {
      expect(partnerGuard({ user_type: "admin" }).status).toBe(403)
    })
  })

  describe("Cron auth guard", () => {
    function cronGuard(authHeader: string, cronSecret: string | undefined) {
      if (!cronSecret) return { status: 500, error: "Server misconfigured" }
      const expected = `Bearer ${cronSecret}`
      if (authHeader !== expected) return { status: 401, error: "Unauthorized" }
      return { status: 200 }
    }

    it("returns 500 if CRON_SECRET not set", () => {
      expect(cronGuard("Bearer test", undefined).status).toBe(500)
    })

    it("returns 401 for wrong token", () => {
      expect(cronGuard("Bearer wrong", "correct").status).toBe(401)
    })

    it("returns 401 for empty header", () => {
      expect(cronGuard("", "correct").status).toBe(401)
    })

    it("returns 200 for correct token", () => {
      expect(cronGuard("Bearer correct", "correct").status).toBe(200)
    })
  })

  describe("Booking ownership guard", () => {
    function bookingOwnerGuard(
      booking: { user_id: string } | null,
      requestUserId: string
    ) {
      if (!booking) return { status: 404, error: "Not found" }
      if (booking.user_id !== requestUserId) return { status: 403, error: "Not your booking" }
      return { status: 200 }
    }

    it("returns 404 if booking not found", () => {
      expect(bookingOwnerGuard(null, "user-1").status).toBe(404)
    })

    it("returns 403 if different user", () => {
      expect(bookingOwnerGuard({ user_id: "user-2" }, "user-1").status).toBe(403)
    })

    it("returns 200 if same user", () => {
      expect(bookingOwnerGuard({ user_id: "user-1" }, "user-1").status).toBe(200)
    })
  })
})
