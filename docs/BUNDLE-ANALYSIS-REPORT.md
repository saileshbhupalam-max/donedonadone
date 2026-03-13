# Bundle & Performance Analysis Report

**Date:** 2026-03-13
**Build tool:** Vite 5.4.19 (production build)
**Build time:** 59.78s
**Modules transformed:** 4,340

---

## 1. Bundle Composition Breakdown

### Total Sizes

| Metric | Size |
|--------|------|
| Total dist directory | 13 MB (including source maps) |
| Total JS (raw, no maps) | 2,376 KB |
| Total JS (gzip estimate) | ~640 KB |
| Total CSS | 103 KB (16 KB gzipped) |
| PWA precache manifest | 148 entries, 2,770 KB |

### Vendor Chunks (named)

| Chunk | Raw | Gzip | Notes |
|-------|-----|------|-------|
| vendor-charts (recharts/d3) | 383.5 KB | 105.3 KB | LARGEST chunk by far |
| vendor-media (html2canvas/qrcode) | 218.5 KB | 54.2 KB | html2canvas is heavy |
| vendor-ui (Radix + styling) | 186.4 KB | 58.5 KB | 27 Radix primitives |
| vendor-supabase | 174.7 KB | 46.1 KB | Expected for Supabase |
| vendor-react (react/router) | 165.5 KB | 53.9 KB | Expected baseline |
| leaflet | 154.2 KB | 45.0 KB | Map library |
| vendor-animation (framer-motion) | 126.0 KB | 41.9 KB | Full animation lib |
| vendor-dates (date-fns) | 50.9 KB | 12.2 KB | Tree-shaking working |
| vendor-query (@tanstack) | 26.6 KB | 8.2 KB | Reasonable |
| **Vendor subtotal** | **1,486 KB** | **425 KB** | 63% of total JS |

### Unnamed Application Index Chunks

These are Vite's automatic code-split chunks for shared modules. They likely contain Sentry, shared components, contexts, hooks, and utility code that multiple pages import.

| Chunk | Raw | Gzip |
|-------|-----|------|
| index-DRXJsHTA.js | 140.3 KB | 34.6 KB |
| index-YnTa7Bwh.js | 121.2 KB | 30.2 KB |
| index-Yx7MTmI1.js | 87.0 KB | 29.1 KB |
| index-DXv4v30n.js | 68.2 KB | 22.0 KB |
| index-BTPLD5wi.js | 46.1 KB | 12.7 KB |
| index-CRKbE7ne.js | 41.1 KB | 12.8 KB |
| index-DkdkinFU.js | 16.0 KB | 4.8 KB |
| **Shared subtotal** | **520 KB** | **146 KB** |

### Page Chunks (lazy-loaded, top 10 by size)

| Page | Raw | Gzip |
|------|-----|------|
| Discover | 29.2 KB | 7.8 KB |
| EventDetail | 25.3 KB | 7.5 KB |
| Needs | 23.7 KB | 7.2 KB |
| TasteGraphBuilder | 21.8 KB | 6.2 KB |
| CompanyProfile | 19.3 KB | 5.8 KB |
| AppShell | 18.2 KB | 6.0 KB |
| Onboarding | 17.7 KB | 5.6 KB |
| SpaceInsights | 16.5 KB | 5.4 KB |
| ProfileView | 13.6 KB | 4.6 KB |
| PartnerApply | 11.1 KB | 3.5 KB |

Page chunks are well-sized. Code splitting is effective.

---

## 2. Performance Concerns

### CRITICAL

**(C1) vendor-charts is 383 KB (105 KB gzip) -- loaded for admin/insights pages only**

Recharts + D3 sub-modules form the single largest chunk. This is loaded even though charts are only used on SpaceInsights, PartnerDashboard, admin analytics, and a few growth cards. The `manualChunks` config groups all chart code into one chunk, but Vite will still load it whenever ANY page references a chart component.

**Impact:** Pages that import even one Recharts component pull in the full 383 KB chunk.

**Recommendation:** Lazy-load chart components at the component level (not just page level). Wrap chart-using components in `lazy()` so they only load when rendered. Consider lighter alternatives like `uplot` or `chart.js` for simple charts.

---

**(C2) vendor-media is 218 KB (54 KB gzip) -- html2canvas dominates**

html2canvas (used for sharing screenshots/profile cards) and qrcode.react are bundled together. html2canvas alone is approximately 190 KB raw.

**Impact:** Any page that could trigger a share/screenshot action may pull this chunk.

**Recommendation:** html2canvas is already dynamically imported in most call sites (good). Verify the chunk is truly lazy and not eagerly loaded. If qrcode.react is only used in admin (PartnersTab), ensure it stays lazy too.

---

**(C3) Sentry SDK loaded synchronously on every page load**

`src/main.tsx` calls `initSentry()` synchronously before render. The `@sentry/react` package with browser tracing + replay integrations is approximately 80-100 KB raw. This is bundled into one of the unnamed index chunks and loaded on first paint for ALL users.

**Impact:** Adds 25-30 KB gzip to the critical path for every user, even when VITE_SENTRY_DSN is not set.

**Recommendation:** Lazy-load Sentry. Use dynamic `import()` for the Sentry init call, or at minimum defer it with `requestIdleCallback`. The DSN check happens inside `initSentry()` but the module is already parsed and loaded.

---

### HIGH

**(H1) No og-image.png exists but is referenced in index.html meta tags**

`<meta property="og:image" content="/og-image.png" />` points to a missing file. Social media shares will show no preview image.

**Impact:** Broken social sharing previews (Twitter, WhatsApp, LinkedIn).

**Recommendation:** Create and add `public/og-image.png` (1200x630px recommended).

---

**(H2) react-leaflet requires React 19 but project uses React 18**

`npm ls` shows `react@18.3.1 invalid: "^19.0.0" from node_modules/react-leaflet`. This is a peer dependency mismatch. The `.npmrc` with `legacy-peer-deps=true` masks this, but it may cause runtime issues.

**Impact:** Potential subtle bugs or crashes in map features. react-leaflet v5 is designed for React 19.

**Recommendation:** Either downgrade to `react-leaflet@4.x` (supports React 18) or upgrade to React 19 when ready.

---

**(H3) framer-motion is 126 KB (42 KB gzip) loaded as a vendor chunk**

framer-motion is used across many components (page transitions, animations). Because it is in a shared vendor chunk and used broadly, it loads on basically every page navigation.

**Impact:** Significant weight for animations. Gzip alone is 42 KB.

**Recommendation:** Evaluate whether `framer-motion/m` (the minimal API) would suffice. Alternatively, replace simple fade/slide animations with CSS transitions and reserve framer-motion for complex gesture-based interactions.

---

**(H4) leaflet (154 KB / 45 KB gzip) is in a separate chunk but not lazy enough**

Leaflet is only used on MapView, SessionMap (inside Events), and LocationPicker (inside Profile/ProfilePromptCard). However, because SessionMap and LocationPicker are lazy-loaded at the component level within those pages, Leaflet should only load when those components render. Verify this is actually happening.

**Recommendation:** Confirm leaflet chunk is not eagerly pulled in. If it is, ensure all `react-leaflet` imports go through `lazy()` wrappers.

---

### MEDIUM

**(M1) 27 Radix UI primitives installed -- likely not all used**

The vendor-ui chunk (186 KB / 59 KB gzip) includes all Radix primitives. Some may be unused: `react-context-menu`, `react-hover-card`, `react-menubar`, `react-navigation-menu`, `react-aspect-ratio`, `react-resizable-panels`.

**Impact:** Moderate bundle bloat from unused UI primitives.

**Recommendation:** Audit actual usage of each Radix primitive. Remove unused ones from `package.json`. Tree-shaking helps but unused primitives still add to install size and manualChunks bundling.

---

**(M2) `next-themes` imported for Sonner toast theming only**

The `next-themes` package (designed for Next.js) is a dependency used solely in `src/components/ui/sonner.tsx` for `useTheme`. This is a Next.js-specific package in a Vite SPA.

**Impact:** Small size but conceptually wrong. May not work correctly without Next.js context provider.

**Recommendation:** Replace with a simple theme context or read the theme from document class/data attribute directly. Remove `next-themes` from dependencies.

---

**(M3) date-fns imported from barrel in 50 files**

All imports use `from "date-fns"` barrel import (e.g., `import { format, parseISO } from "date-fns"`). Vite/Rollup tree-shaking handles this well (chunk is 51 KB), but the 50 KB vendor-dates chunk could be smaller with direct subpath imports.

**Impact:** date-fns tree-shaking is working (51 KB is reasonable for the functions used). Low priority.

**Recommendation:** No immediate action needed. If optimizing further, switch to `date-fns/format`, `date-fns/parseISO` etc. for slightly better tree-shaking.

---

**(M4) lucide-react used across 132 files with individual icon imports**

lucide-react icons are tree-shakeable and Vite appears to be splitting them into individual tiny chunks (0.3-0.7 KB each). This is working correctly. However, 132 files importing from lucide-react means many small chunks in the build output.

**Impact:** Many HTTP requests for small icon chunks on first page load. HTTP/2 mitigates this, but the sheer count (40+ icon chunks) is notable.

**Recommendation:** Consider grouping frequently-used icons into a single re-export barrel file to reduce chunk count while maintaining tree-shaking for rarely-used icons.

---

**(M5) PWA precaching 148 entries (2,770 KB)**

The service worker precaches all JS, CSS, HTML, images, icons, and fonts. This is a lot for initial service worker installation.

**Impact:** First visit triggers a 2.7 MB background download. On slow networks, this competes with actual page resources.

**Recommendation:** Use `workbox.navigateFallback` for app shell, but reduce `globPatterns` to only cache critical assets. Let page-specific chunks cache on demand via `runtimeCaching` instead.

---

### LOW

**(L1) Source maps enabled in production build**

`build.sourcemap: true` in vite.config.ts generates source maps for all chunks. This is fine if deploying to Vercel (not served to users), but doubles the dist size to 13 MB.

**Impact:** Larger deploy artifacts. No runtime impact if server does not serve `.map` files.

**Recommendation:** Use `sourcemap: 'hidden'` to generate maps (for Sentry upload) without referencing them in the JS files, or upload to Sentry and strip from deploy.

---

**(L2) canvas-confetti properly lazy-loaded**

Confirmed: all `canvas-confetti` imports use dynamic `import()`. No action needed.

---

**(L3) html2canvas properly lazy-loaded in most places**

Confirmed: `html2canvas` is dynamically imported in GrowthCards, ScrapbookCard, ProfileCard, and PartnersTab. The vendor-media chunk should only load on demand.

---

## 3. Code Splitting Assessment

### What is working well

1. **Page-level code splitting:** All 25 pages use `React.lazy()` with dynamic imports. Each page gets its own chunk. This is excellent.

2. **Component-level lazy loading:** Heavy components like `SessionMap`, `LocationPicker`, and `QRCodeSVG` use `lazy()` imports within their parent pages.

3. **Dynamic imports for heavy libs:** `canvas-confetti` and `html2canvas` use `await import()` at call sites, not top-level.

4. **Named manual chunks:** The `manualChunks` config in vite.config.ts properly separates vendor code into logical groups (react, supabase, ui, charts, animation, dates, media, query).

5. **Small page chunks:** Most page chunks are 5-30 KB, indicating good component extraction and shared module deduplication.

### What could be improved

1. **Chart components not lazy at component level:** If any non-admin page imports a component that transitively imports from recharts, the 383 KB chart chunk loads for regular users.

2. **Sentry loaded eagerly:** Should be deferred or lazy-loaded.

3. **Too many micro-chunks for icons:** 40+ individual icon chunks add HTTP overhead. Consolidation would help.

4. **Unnamed shared chunks are opaque:** Six `index-*.js` chunks totaling 520 KB are hard to reason about. Adding more `manualChunks` rules (e.g., for Sentry, embla-carousel, cmdk, sonner, zod, react-hook-form) would make the bundle composition more transparent and cacheable.

---

## 4. Critical Rendering Path Analysis

### First Paint Sequence

1. **index.html** (2 KB) -- minimal, no render-blocking resources
2. **main.tsx** loaded as `type="module"` -- triggers module graph resolution
3. **Synchronous imports in main.tsx:**
   - `react-dom/client` (vendor-react chunk: 165 KB)
   - `virtual:pwa-register` (workbox-window: 6 KB)
   - `@sentry/react` via `lib/sentry.ts` (part of unnamed index chunks)
   - `ErrorBoundary` component
   - `App.tsx` and its synchronous imports
4. **Synchronous imports in App.tsx:**
   - `@tanstack/react-query` (vendor-query: 27 KB)
   - `react-router-dom` (in vendor-react)
   - `AuthContext`, `PersonalityContext`, `FeatureFlagsProvider`, `SubscriptionProvider`
   - Toaster/Sonner components
   - UI components: TooltipProvider, InstallPrompt, PersonalityLoader
5. **First paint:** Shows `<PersonalityLoader />` spinner while lazy page loads

### Estimated Critical Path JS (before first paint)

| What | Approx Gzip |
|------|-------------|
| vendor-react | 54 KB |
| vendor-ui (Radix for toasters/tooltip) | 59 KB |
| vendor-query | 8 KB |
| vendor-supabase (AuthContext) | 46 KB |
| Shared index chunks (Sentry, contexts, hooks) | ~100 KB |
| workbox-window | 2 KB |
| **Total critical path** | **~269 KB gzip** |

This is on the higher side for first meaningful paint. Target should be under 150 KB gzip for the critical path.

### Font Loading

No custom fonts detected. The app relies on system fonts via Tailwind's default font stack. This is optimal -- zero font loading delay.

---

## 5. PWA Analysis

### Service Worker Configuration

- **Plugin:** vite-plugin-pwa v1.2.0 with `generateSW` mode
- **Register type:** `autoUpdate` -- good, auto-activates new SW
- **Skip waiting:** true, **Client claim:** true -- immediate takeover
- **Cleanup outdated caches:** true

### Manifest

- Configured inline in vite.config.ts (not a separate file)
- Name: "FocusClub", standalone display, portrait orientation
- Icons: 192px and 512px (same file used for regular + maskable)
- Start URL: `/home` (protected route -- will redirect to login if unauthenticated)

### Offline Support

- `navigateFallback: "/index.html"` -- SPA fallback works
- `offline.html` exists in public/ but is listed in `includeAssets` not as the navigateFallback
- Supabase API: NetworkFirst with 5s timeout, 50 entries, 5min expiry
- Map tiles: CacheFirst, 200 entries, 7-day expiry
- Images: CacheFirst, 100 entries, 30-day expiry
- Fonts: CacheFirst, 20 entries, 365-day expiry

### PWA Issues

1. **Missing og-image.png** -- referenced in includeAssets implicitly via globPatterns
2. **Start URL is protected** -- `/home` requires auth. Offline launch after auth expiry will fail. Consider `/` as start_url.
3. **Maskable icon reuses same file** -- Maskable icons need safe zone padding. Using the same 512px icon likely clips content.

---

## 6. Image/Asset Audit

| Asset | Size | Notes |
|-------|------|-------|
| public/icons/icon-512.png | 107 KB | Could be optimized with WebP |
| public/icons/icon-192.png | 84 KB | Could be optimized with WebP |
| public/apple-touch-icon.png | 73 KB | Standard iOS icon |
| public/favicon.ico | 20 KB | Large for a favicon (usually <5 KB) |
| public/placeholder.svg | 3 KB | Fine |
| public/og-image.png | MISSING | Referenced in meta tags |

**No images in src/.** The app appears to use icons (lucide-react) and CSS for all UI graphics. No unoptimized photographs or large raster images found.

---

## 7. Summary of Recommendations (prioritized)

### Quick Wins (< 1 hour each)

1. **Lazy-load Sentry** -- defer `initSentry()` with `requestIdleCallback` or dynamic import. Saves ~25-30 KB gzip from critical path.
2. **Add og-image.png** -- fix broken social sharing.
3. **Remove `next-themes`** -- replace single usage in sonner.tsx with direct theme reading.
4. **Change `sourcemap: 'hidden'`** -- same debugging benefit, cleaner deploys.
5. **Fix PWA start_url** -- change from `/home` to `/` for unauthenticated offline launch.

### Medium Effort (1-4 hours)

6. **Lazy-load chart components** -- wrap all Recharts usage in `lazy()` to prevent 383 KB from loading on non-chart pages.
7. **Add more manualChunks rules** -- name Sentry, framer-motion subsets, and other shared modules for better cache granularity.
8. **Reduce PWA precache scope** -- only precache app shell + critical vendor chunks. Let page chunks cache at runtime.
9. **Audit Radix primitives** -- remove unused packages.

### Larger Efforts (4+ hours)

10. **Replace framer-motion with CSS transitions** where possible -- saves up to 42 KB gzip.
11. **Downgrade react-leaflet to v4** or upgrade React to 19 -- fix peer dependency mismatch.
12. **Evaluate recharts alternatives** -- lighter chart libraries could cut 383 KB to under 100 KB.
13. **Consider Sentry lazy replay** -- load replay integration only when needed (error occurs), not upfront.

---

## 8. Overall Assessment

The bundle architecture is **good for an early-stage product**. Key positives:

- All pages are lazy-loaded (code splitting works)
- Heavy libraries (html2canvas, canvas-confetti) are dynamically imported
- Manual chunks provide logical vendor separation
- No custom fonts (system stack)
- PWA configured with reasonable caching strategies

The main areas for improvement are the **critical path weight (~269 KB gzip)** and the **383 KB chart chunk** that could load for non-admin users. Implementing the quick wins above would reduce the critical path to ~240 KB gzip. The medium-effort items could bring it closer to 180 KB gzip.

For a mobile-first PWA targeting users in Bangalore (variable network quality), keeping the critical path under 200 KB gzip should be a goal before scaling to 1000 bookings/day.
