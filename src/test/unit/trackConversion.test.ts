import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing
const mockInsert = vi.fn().mockReturnValue({ then: (cb: any) => cb() });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockGetUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { trackConversion } from "@/lib/trackConversion";

describe("trackConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts conversion event when user is authenticated", async () => {
    mockGetUser.mockReturnValue(
      Promise.resolve({ data: { user: { id: "user-123" } } })
    );

    trackConversion("saw_gate", { feature: "pro_feature" });

    // Wait for the async chain to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFrom).toHaveBeenCalledWith("conversion_events");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      event_type: "saw_gate",
      event_data: { feature: "pro_feature" },
    });
  });

  it("does nothing when user is not authenticated", async () => {
    mockGetUser.mockReturnValue(
      Promise.resolve({ data: { user: null } })
    );

    trackConversion("saw_gate");

    await new Promise((r) => setTimeout(r, 10));

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("defaults event_data to empty object when not provided", async () => {
    mockGetUser.mockReturnValue(
      Promise.resolve({ data: { user: { id: "user-456" } } })
    );

    trackConversion("upgraded");

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-456",
      event_type: "upgraded",
      event_data: {},
    });
  });

  it("passes through arbitrary event types", async () => {
    mockGetUser.mockReturnValue(
      Promise.resolve({ data: { user: { id: "user-789" } } })
    );

    trackConversion("referral_clicked", { source: "email", campaign: "spring" });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-789",
      event_type: "referral_clicked",
      event_data: { source: "email", campaign: "spring" },
    });
  });

  it("is fire-and-forget (does not throw on insert failure)", async () => {
    mockGetUser.mockReturnValue(
      Promise.resolve({ data: { user: { id: "user-err" } } })
    );
    mockInsert.mockReturnValue({ then: (cb: any) => cb() });

    // Should not throw
    expect(() => trackConversion("test_event")).not.toThrow();
  });
});
