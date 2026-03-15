/**
 * Tests for BottomNav ensuring map is a first-class navigation item.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const NAV_FILE = path.resolve(__dirname, "../../components/layout/BottomNav.tsx");

describe("BottomNav", () => {
  const content = fs.readFileSync(NAV_FILE, "utf-8");

  it("includes Map as a navigation item", () => {
    expect(content).toContain('"Map"');
    expect(content).toContain('"/map"');
  });

  it("has 5 base navigation items", () => {
    // baseItems array should contain Home, Discover, Map, Sessions, You
    const items = ["Home", "Discover", "Map", "Sessions", "You"];
    for (const item of items) {
      expect(content).toContain(`"${item}"`);
    }
  });

  it("imports Map icon from lucide-react", () => {
    expect(content).toMatch(/import\s+\{[^}]*Map[^}]*\}\s+from\s+["']lucide-react["']/);
  });
});
