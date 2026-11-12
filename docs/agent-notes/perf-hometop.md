# perf — home top (preloader, hero, roots, deferred inits)

Area: `src/sections/home/{hero,roots,roots-geometry,preloader}.*`, `src/pages/home.ts`. Task: phone scrolling felt like 10–15 fps on an iPhone (Chrome for iOS = WebKit).

## Mobile scroll performance

### What was slow

1. **Deferred inits ran during the swipe.** On the first scroll, `home.ts` started the six below-the-fold inits. At the end it ran `ScrollTrigger.refresh()`.
   - Anyone who swiped right after the intro got all of this under their finger.
   - Measured: 8–9 long tasks during the swipe, worst frame 0.6–0.7 s.
2. **Roots grain was a turbulence filter at paint time.** It was an SVG `feTurbulence` used as a CSS background.
   - WebKit re-renders an SVG background image, filter included, into a new buffer on every paint of every tile it touches. (In `SVGImage::drawPatternForContainer` there is no cache.)
   - Under a root line that repainted every frame, this meant a turbulence filter per tile per frame on iPhones.
3. **The phone root line repainted every frame.** It was a scrubbed `stroke-dashoffset` on a section-tall SVG (390×1552). The soil, grain and pebbles under it were repainted with it.
4. **Forced style and layout inside scroll frames:**
   - In roots, `getBoundingClientRect()` ran in every update.
   - DrawSVG initialised lazily (getTotalLength / getBBox / computed styles) when each node, rootlet or reveal first played. This happened mid-scroll.
   - In the hero, `gsap.getProperty(opacity)` (getComputedStyle) ran on every scroll frame of the copy fade.
5. **Fireflies ran on the main thread.** They were GSAP `repeat:-1` tweens writing transform and opacity from JS every frame. Each fly also had a permanent `will-change` layer.
6. **Hero scrub layers were created and dropped.** The zoom, dim and ground were scrubbed with GSAP `force3D:auto`, so their layers were created at the start of the scroll and dropped again at the top.
7. **Wasted phone work at start-up:**
   - A throwaway WebGL probe, plus detect-gpu's own context and a benchmark fetch.
   - The wind-mask download.

   None of these can change the mode on phones, which is always video.

### What changed (looks the same)

- **`home.ts`.** On touch devices, every section init and the final `ScrollTrigger.refresh()` waits for a scroll-quiet moment: no finger down, and no scroll or momentum for 180 ms. Each one gets its own idle slot. Desktop is unchanged.
  - The helper is `whenScrollQuiet()` / `scrollQuiet()` in `preloader.ts`. If a `touchend` is lost, it stops waiting after 3 s without input.
  - Each init is measured as `of:init:<name>`.
- **Roots grain.** The same SVG is drawn once into a canvas at the device pixel ratio (in a quiet slot) and used as a blob-URL raster tile (`--roots-grain`).
  - On touch devices with JS, the SVG version is never painted.
  - The pixels are identical: max diff 0 against the SVG, in dev and in the production build.
- **Phone root.** It grows through a moving clip: a composited wrapper (`overflow:hidden`) slides with the tip, and the drawing inside slides back by the same amount.
  - Per frame, only two transforms change, so there is no repaint.
  - The layer covers only the line's own box (238×1260).
  - The geometry (world offset, viewport height) is cached at refresh and resize. The scroll position comes from ScrollTrigger's cache.
- **DrawSVG timelines are initialised ahead of time.** Node timelines, rootlets, the sapling, the story reveal, the word scrub and the net title are primed outside the scroll ("primed" = every tween initialised, then put back where it was).
  - On touch devices this runs in its own quiet slot, which keeps the roots init short.
  - On desktop the pinned timeline is primed again after each refresh, because `invalidateOnRefresh` resets it.
- **`samplePath`** flattens our own Bézier paths in JS instead of calling `getPointAtLength` a few hundred times. It deviates 0.05 px from the browser's points.
- **Fireflies** are WAAPI compositor animations with the same seeded values and timing. They have no permanent `will-change` and are paused off-screen.
- **Hero:**
  - `will-change` on `.hero__zoom` and `.hero__ground` (transform) and `.hero__dim` (opacity) when motion is on.
  - The copy-fade "ghost" check reads tween progress, not computed style.
  - Phones go straight to the video, with no GPU probes and no mask fetch.
  - The video player is created only at a scroll-quiet moment.

### Numbers

All runs: iPhone 13 emulation, DPR 3, 4× CPU, dev server. A/B was run back to back against a copy of the same tree with only my edits reverted.

| Measure | Before | After | How |
|---|---|---|---|
| Swipe right after the intro (first visit, real touch events, flicks ≈ 900 px/s): long tasks during the swipe | 8–9 (1.28–1.50 s) | 1–2 (67–156 ms) | measured |
| Same swipe: worst frame | 617–700 ms | 83–133 ms | measured |
| Same swipe: fps | 35–38 | 48–53 | measured |
| Same swipe: when inits and refresh run | during the swipe | after it | measured |
| Roots range scroll (664→2216): DrawSVG init inside scroll frames | 249 ms | 13 ms | measured |
| Same range: roots update (forced layout) | 90 ms | 28 ms | measured |
| Same range: Layout | 110 ms | 46 ms | measured |
| Same range: raster | 166–188 ms | 110–112 ms | measured |
| Roots init (one task) | 194 ms | 85–108 ms | measured; priming (≈57 ms) and the grain tile (≈57 ms) now run in separate slots; 23 ms unthrottled in production |

Headless frame rate in the roots and hero ranges is the same before and after: 55–58 fps at 4× CPU in roots; the hero range is dominated by other areas. Headless Chromium caches SVG background rasters and composites in software, so fixes 2, 3, 5 and 6 are **by reasoning** for iOS:
- 2: no turbulence render at paint time;
- 3: zero repaint per scroll frame for the root line;
- 5: fireflies on Core Animation, not the main thread;
- 6: steady hero layers.

### Visual parity

- Mobile 390×844 and desktop 1440×900 screenshots before and after differ by ≤ 0.3 %. That is antialiasing; the time-varying video, wind and fireflies differ more and are excluded.
- Reduced motion is identical (≤ 0.005 %).
- Desktop pinned node, glow and tap-root state at 6 scroll positions, down and back up, is identical.
- No console errors and no horizontal overflow. `tsc` is clean.

### Not verified / left for others

- **Not tested on a real iPhone or Android.**
- Touch tablets in landscape (wider than 900 px) still run live WebGL in the hero. The wind video exists only as a portrait crop.
- **lead, `src/core/app.ts`:** the `load` and `fonts.ready` → `ScrollTrigger.refresh()` calls, and ScrollTrigger's own auto-refresh on `load`, can still land mid-swipe on phones. They could wait for `whenScrollQuiet()` (move the helper to core if wanted).
- **lead, `src/styles/base.css`:** the global grain `body::after` is the same kind of feTurbulence SVG background. The same one-time raster tile would make any repaint of it cheap.
- **homemid:** `src/components/forest-map.css` also uses feTurbulence.
- **homelow / chrome:** in the hero range, most remaining main-thread time is elsewhere:
  - the wall's CSS animations (`wall__by` / `wall__ded`) restyle many elements every frame, even off-screen;
  - `footer.ts:388`'s scroll listener forces a style recalc;
  - the header tone probe (`elementsFromPoint`).
