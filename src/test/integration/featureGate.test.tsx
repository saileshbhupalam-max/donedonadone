import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock all hooks and dependencies
const mockIsEnabled = vi.fn().mockReturnValue(true);
const mockUseFeatureFlags = vi.fn().mockReturnValue({
  isEnabled: mockIsEnabled,
  loading: false,
});

const mockUseUserContext = vi.fn().mockReturnValue({
  level: "regular",
  currentState: "checked_in",
  dnaComplete: 80,
  loading: false,
});

const mockUseSubscription = vi.fn().mockReturnValue({
  tierOrder: 20,
  allTiers: [
    { id: "free", name: "Explorer", sort_order: 0 },
    { id: "plus", name: "Plus", sort_order: 10 },
    { id: "pro", name: "Pro", sort_order: 20 },
    { id: "max", name: "Max", sort_order: 30 },
  ],
  loading: false,
});

const mockTrackConversion = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

vi.mock("@/hooks/useUserContext", () => ({
  useUserContext: () => mockUseUserContext(),
  LEVEL_ORDER: { new_user: 0, explorer: 1, regular: 2, core: 3, power_user: 4 },
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("@/lib/trackConversion", () => ({
  trackConversion: (...args: any[]) => mockTrackConversion(...args),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { FeatureGate } from "@/components/FeatureGate";

describe("FeatureGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Reset to defaults (pro user, regular level, checked in, DNA 80%)
    mockUseFeatureFlags.mockReturnValue({ isEnabled: mockIsEnabled, loading: false });
    mockIsEnabled.mockReturnValue(true);
    mockUseUserContext.mockReturnValue({ level: "regular", currentState: "checked_in", dnaComplete: 80, loading: false });
    mockUseSubscription.mockReturnValue({
      tierOrder: 20,
      allTiers: [
        { id: "free", name: "Explorer", sort_order: 0 },
        { id: "plus", name: "Plus", sort_order: 10 },
        { id: "pro", name: "Pro", sort_order: 20 },
        { id: "max", name: "Max", sort_order: 30 },
      ],
      loading: false,
    });
  });

  describe("renders children when unlocked", () => {
    it("shows children when no gates are set", () => {
      render(
        <FeatureGate>
          <div>Unlocked content</div>
        </FeatureGate>
      );
      expect(screen.getByText("Unlocked content")).toBeInTheDocument();
    });

    it("shows children when feature flag is enabled", () => {
      mockIsEnabled.mockReturnValue(true);
      render(
        <FeatureGate featureFlag="cool_feature">
          <div>Flag enabled</div>
        </FeatureGate>
      );
      expect(screen.getByText("Flag enabled")).toBeInTheDocument();
    });

    it("shows children when user tier meets required tier", () => {
      // Pro user (tierOrder=20) meets pro requirement (sort_order=20)
      render(
        <FeatureGate requiredTier="pro">
          <div>Pro content</div>
        </FeatureGate>
      );
      expect(screen.getByText("Pro content")).toBeInTheDocument();
    });

    it("shows children when user level meets min level", () => {
      render(
        <FeatureGate minLevel="regular">
          <div>Level content</div>
        </FeatureGate>
      );
      expect(screen.getByText("Level content")).toBeInTheDocument();
    });
  });

  describe("gates content when locked", () => {
    it("hides children when feature flag is disabled", () => {
      mockIsEnabled.mockReturnValue(false);
      render(
        <FeatureGate featureFlag="disabled_feature">
          <div>Hidden content</div>
        </FeatureGate>
      );
      expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
    });

    it("shows teaser when feature flag is disabled and teaser provided", () => {
      mockIsEnabled.mockReturnValue(false);
      render(
        <FeatureGate featureFlag="disabled_feature" teaser={<div>Teaser content</div>}>
          <div>Hidden content</div>
        </FeatureGate>
      );
      expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
      expect(screen.getByText("Teaser content")).toBeInTheDocument();
    });

    it("shows upgrade prompt when user tier is below required tier", () => {
      // Pro user (tierOrder=20) below Max (sort_order=30)
      render(
        <FeatureGate requiredTier="max">
          <div>Max only</div>
        </FeatureGate>
      );
      expect(screen.queryByText("Max only")).not.toBeInTheDocument();
      expect(screen.getByText(/Upgrade to Max/)).toBeInTheDocument();
      expect(screen.getByText("See plans")).toBeInTheDocument();
    });

    it("shows session prompt when user level is below min level", () => {
      // Regular user (level=2) below core (level=3)
      render(
        <FeatureGate minLevel="core">
          <div>Core only</div>
        </FeatureGate>
      );
      expect(screen.queryByText("Core only")).not.toBeInTheDocument();
      expect(screen.getByText(/Attend.*more session/)).toBeInTheDocument();
    });

    it("shows check-in prompt when user is offline and requireCheckIn is set", () => {
      mockUseUserContext.mockReturnValue({ level: "regular", currentState: "offline", dnaComplete: 80, loading: false });
      render(
        <FeatureGate requireCheckIn>
          <div>Checked in only</div>
        </FeatureGate>
      );
      expect(screen.queryByText("Checked in only")).not.toBeInTheDocument();
      expect(screen.getByText("Check in to see this")).toBeInTheDocument();
    });

    it("shows DNA prompt when dnaComplete is below threshold", () => {
      mockUseUserContext.mockReturnValue({ level: "regular", currentState: "checked_in", dnaComplete: 30, loading: false });
      render(
        <FeatureGate requireDnaComplete={50}>
          <div>DNA content</div>
        </FeatureGate>
      );
      expect(screen.queryByText("DNA content")).not.toBeInTheDocument();
      expect(screen.getByText(/Complete your DNA profile/)).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("returns null when loading and no fallback", () => {
      mockUseFeatureFlags.mockReturnValue({ isEnabled: mockIsEnabled, loading: true });
      const { container } = render(
        <FeatureGate featureFlag="test">
          <div>Content</div>
        </FeatureGate>
      );
      expect(container.innerHTML).toBe("");
    });

    it("shows fallback when loading", () => {
      mockUseFeatureFlags.mockReturnValue({ isEnabled: mockIsEnabled, loading: true });
      render(
        <FeatureGate featureFlag="test" fallback={<div>Loading...</div>}>
          <div>Content</div>
        </FeatureGate>
      );
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("conversion tracking", () => {
    it("tracks saw_gate when content is gated by tier", () => {
      render(
        <FeatureGate requiredTier="max">
          <div>Max only</div>
        </FeatureGate>
      );
      expect(mockTrackConversion).toHaveBeenCalledWith("saw_gate", { feature: "max" });
    });

    it("tracks saw_gate with feature flag name when gated by flag", () => {
      mockIsEnabled.mockReturnValue(false);
      render(
        <FeatureGate featureFlag="cool_feature">
          <div>Hidden</div>
        </FeatureGate>
      );
      expect(mockTrackConversion).toHaveBeenCalledWith("saw_gate", { feature: "cool_feature" });
    });

    it("stores last gated feature in sessionStorage", () => {
      render(
        <FeatureGate requiredTier="max">
          <div>Max only</div>
        </FeatureGate>
      );
      expect(sessionStorage.getItem("last_gate_feature")).toBe("max");
    });

    it("does not track when content is unlocked", () => {
      render(
        <FeatureGate requiredTier="pro">
          <div>Pro content</div>
        </FeatureGate>
      );
      expect(mockTrackConversion).not.toHaveBeenCalled();
    });
  });

  describe("tier hierarchy", () => {
    it("free user (tierOrder=0) is gated from plus content", () => {
      mockUseSubscription.mockReturnValue({
        tierOrder: 0,
        allTiers: [
          { id: "free", name: "Explorer", sort_order: 0 },
          { id: "plus", name: "Plus", sort_order: 10 },
          { id: "pro", name: "Pro", sort_order: 20 },
          { id: "max", name: "Max", sort_order: 30 },
        ],
        loading: false,
      });
      render(
        <FeatureGate requiredTier="plus">
          <div>Plus content</div>
        </FeatureGate>
      );
      expect(screen.queryByText("Plus content")).not.toBeInTheDocument();
      expect(screen.getByText(/Upgrade to Plus/)).toBeInTheDocument();
    });

    it("max user (tierOrder=30) can access all tier-gated content", () => {
      mockUseSubscription.mockReturnValue({
        tierOrder: 30,
        allTiers: [
          { id: "free", name: "Explorer", sort_order: 0 },
          { id: "plus", name: "Plus", sort_order: 10 },
          { id: "pro", name: "Pro", sort_order: 20 },
          { id: "max", name: "Max", sort_order: 30 },
        ],
        loading: false,
      });
      render(
        <FeatureGate requiredTier="max">
          <div>Max content</div>
        </FeatureGate>
      );
      expect(screen.getByText("Max content")).toBeInTheDocument();
    });
  });

  describe("custom teaser overrides default", () => {
    it("shows custom teaser instead of default upgrade prompt", () => {
      render(
        <FeatureGate requiredTier="max" teaser={<div>Custom upgrade teaser</div>}>
          <div>Max only</div>
        </FeatureGate>
      );
      expect(screen.getByText("Custom upgrade teaser")).toBeInTheDocument();
      expect(screen.queryByText(/Upgrade to Max/)).not.toBeInTheDocument();
    });
  });
});
