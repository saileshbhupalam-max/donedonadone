/**
 * Guard tests that prevent regressions from bugs we've already fixed.
 * These tests exist because each failure cost us multiple debugging sessions.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../..");

describe("Map tile URL guards", () => {
  // BUG: Stadia Maps dark tiles started requiring API authentication,
  // rendering QR code error images instead of map tiles. Cost: 1 debugging session.
  const AUTH_REQUIRED_PROVIDERS = [
    "tiles.stadiamaps.com",
    "api.mapbox.com",
    "maps.googleapis.com",
  ];

  const mapFiles = [
    "components/map/SessionMap.tsx",
    "components/map/LocationPicker.tsx",
  ];

  mapFiles.forEach((file) => {
    it(`${file} does not use auth-required tile providers`, () => {
      const content = fs.readFileSync(path.join(SRC, file), "utf-8");
      for (const provider of AUTH_REQUIRED_PROVIDERS) {
        expect(content).not.toContain(provider);
      }
    });

    it(`${file} uses CartoDB for dark tiles`, () => {
      const content = fs.readFileSync(path.join(SRC, file), "utf-8");
      // If the file references dark tiles, it should use CartoDB
      if (content.includes("dark")) {
        expect(content).toContain("basemaps.cartocdn.com/dark_all");
      }
    });
  });
});

describe("react-leaflet version guard", () => {
  // BUG: react-leaflet v5 imports `use` from React which doesn't exist in React 18.
  // This caused "TypeError: r is not a function" that propagated to UNRELATED pages
  // (Settings crashed even though it has nothing to do with maps).
  // Cost: 3 debugging sessions across 3 conversations.

  it("react-leaflet is pinned to v4.x (not v5+)", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(SRC, "../package.json"), "utf-8")
    );
    const version = pkg.dependencies["react-leaflet"] || "";
    // Must not start with 5, ^5, ~5, >=5
    expect(version).not.toMatch(/^[\^~>=]*5/);
    // Must be 4.x
    expect(version).toMatch(/4\./);
  });

  it("React version is 18.x (react-leaflet v5 requires React 19)", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(SRC, "../package.json"), "utf-8")
    );
    const reactVersion = pkg.dependencies["react"] || "";
    // If React is upgraded to 19+, react-leaflet 5 becomes safe and this test
    // should be updated. Until then, this guard prevents the v5 upgrade.
    expect(reactVersion).toMatch(/18\./);
  });
});

describe("Vite config guards", () => {
  // BUG: Without keepNames, production errors show minified names like "gs"
  // instead of "MapContainerComponent". Cost: 2 extra debugging sessions.

  it("esbuild.keepNames is enabled in vite.config.ts", () => {
    const config = fs.readFileSync(
      path.resolve(SRC, "../vite.config.ts"),
      "utf-8"
    );
    expect(config).toContain("keepNames");
    expect(config).toContain("true");
  });

  it("sourcemap is enabled for debugging", () => {
    const config = fs.readFileSync(
      path.resolve(SRC, "../vite.config.ts"),
      "utf-8"
    );
    expect(config).toContain("sourcemap: true");
  });
});
