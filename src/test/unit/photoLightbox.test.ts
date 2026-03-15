/**
 * Tests for PhotoLightbox component behavior.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const LIGHTBOX_FILE = path.resolve(__dirname, "../../components/ui/PhotoLightbox.tsx");

describe("PhotoLightbox", () => {
  const content = fs.readFileSync(LIGHTBOX_FILE, "utf-8");

  it("exists as a component file", () => {
    expect(fs.existsSync(LIGHTBOX_FILE)).toBe(true);
  });

  it("supports keyboard navigation (Escape, ArrowLeft, ArrowRight)", () => {
    expect(content).toContain("Escape");
    expect(content).toContain("ArrowLeft");
    expect(content).toContain("ArrowRight");
  });

  it("supports touch/swipe navigation", () => {
    expect(content).toContain("onTouchStart");
    expect(content).toContain("onTouchEnd");
  });

  it("locks body scroll when open", () => {
    expect(content).toContain("overflow");
    expect(content).toContain("hidden");
  });

  it("restores body scroll on close", () => {
    // Cleanup in useEffect return
    expect(content).toContain('overflow = ""');
  });

  it("renders at z-index high enough to cover everything", () => {
    expect(content).toContain("z-[9999]");
  });

  it("has a download button", () => {
    expect(content).toContain("Download");
    expect(content).toContain("download");
  });

  it("shows image counter for multi-image galleries", () => {
    expect(content).toContain("images.length");
  });
});

describe("PhotoLightbox integration", () => {
  it("is used in EventDetail (EventMemories)", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../../pages/EventDetail.tsx"),
      "utf-8"
    );
    expect(content).toContain("PhotoLightbox");
    expect(content).toContain("lightboxIndex");
  });

  it("is used in ScrapbookCard", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../../components/session/ScrapbookCard.tsx"),
      "utf-8"
    );
    expect(content).toContain("PhotoLightbox");
    expect(content).toContain("showLightbox");
  });

  it("EventMemories uses button (not anchor) for photo clicks", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../../pages/EventDetail.tsx"),
      "utf-8"
    );
    // Find the EventMemories function definition (not JSX usage)
    const fnStart = content.indexOf("function EventMemories(");
    expect(fnStart).toBeGreaterThan(-1);
    const memoriesSection = content.slice(fnStart);
    // Photos should open lightbox via button, not anchor with target="_blank"
    expect(memoriesSection).not.toContain('target="_blank"');
    expect(memoriesSection).toContain("setLightboxIndex");
  });
});
