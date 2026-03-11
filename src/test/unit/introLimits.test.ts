import { describe, it, expect } from "vitest";
import { computeIntroState } from "@/lib/introLimits";

describe("computeIntroState", () => {
  describe("free user (monthlyLimit=0)", () => {
    it("always blocked", () => {
      const state = computeIntroState(0, 0, 0);
      expect(state.zeroLimit).toBe(true);
      expect(state.allowed).toBe(false);
      expect(state.blocked).toBe(true);
    });

    it("blocked even with credits", () => {
      const state = computeIntroState(0, 0, 5);
      expect(state.zeroLimit).toBe(true);
      expect(state.allowed).toBe(false);
      expect(state.blocked).toBe(true);
      expect(state.useCredit).toBe(false);
    });
  });

  describe("pro user (monthlyLimit=5)", () => {
    it("3 of 5 used → allowed, 2 remaining", () => {
      const state = computeIntroState(5, 3, 0);
      expect(state.allowed).toBe(true);
      expect(state.remaining).toBe(2);
      expect(state.atLimit).toBe(false);
      expect(state.useCredit).toBe(false);
      expect(state.blocked).toBe(false);
    });

    it("5 of 5 used, 0 credits → blocked", () => {
      const state = computeIntroState(5, 5, 0);
      expect(state.atLimit).toBe(true);
      expect(state.blocked).toBe(true);
      expect(state.allowed).toBe(false);
      expect(state.remaining).toBe(0);
    });

    it("5 of 5 used, 3 credits → allowed via credit", () => {
      const state = computeIntroState(5, 5, 3);
      expect(state.atLimit).toBe(true);
      expect(state.useCredit).toBe(true);
      expect(state.allowed).toBe(true);
      expect(state.credits).toBe(3);
      expect(state.blocked).toBe(false);
    });

    it("0 of 5 used → full quota available", () => {
      const state = computeIntroState(5, 0, 0);
      expect(state.remaining).toBe(5);
      expect(state.allowed).toBe(true);
      expect(state.atLimit).toBe(false);
    });

    it("over limit (6 of 5) → blocked", () => {
      const state = computeIntroState(5, 6, 0);
      expect(state.atLimit).toBe(true);
      expect(state.blocked).toBe(true);
      expect(state.remaining).toBe(0);
    });

    it("over limit with credits → allowed via credit", () => {
      const state = computeIntroState(5, 6, 2);
      expect(state.atLimit).toBe(true);
      expect(state.useCredit).toBe(true);
      expect(state.allowed).toBe(true);
    });
  });

  describe("max user (monthlyLimit=-1, unlimited)", () => {
    it("unlimited intros", () => {
      const state = computeIntroState(-1, 0, 0);
      expect(state.unlimited).toBe(true);
      expect(state.remaining).toBe(-1);
      expect(state.allowed).toBe(true);
      expect(state.blocked).toBe(false);
    });

    it("unlimited even with many used", () => {
      const state = computeIntroState(-1, 100, 0);
      expect(state.unlimited).toBe(true);
      expect(state.allowed).toBe(true);
      expect(state.atLimit).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("exactly at limit boundary (1 of 1)", () => {
      const state = computeIntroState(1, 1, 0);
      expect(state.atLimit).toBe(true);
      expect(state.blocked).toBe(true);
      expect(state.remaining).toBe(0);
    });

    it("credits field is passed through", () => {
      const state = computeIntroState(5, 3, 7);
      expect(state.credits).toBe(7);
    });

    it("zeroLimit is false for non-zero limits", () => {
      const state = computeIntroState(1, 0, 0);
      expect(state.zeroLimit).toBe(false);
    });
  });
});
