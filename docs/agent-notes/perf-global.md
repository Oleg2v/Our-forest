# perf — global chrome (bg system, header, phone bar, reveals, boot, base styles)

Area: `src/chrome/**`, `src/styles/**`, `src/core/**`, `partials/{header,chrome-overlays,head-common}.html`.
Task: on an iPhone (Chrome for iOS = WebKit), scrolling felt like 10–15 fps.

Files changed:
- `src/chrome/bg.ts`, `header.ts`, `sticky.ts`, `chrome.css`
- `src/core/app.ts`, `scroll.ts`
- `src/styles/base.css`

Scripts and screenshots are in `scratchpad/agents/perf-global/`:
- `ttrace.mjs`, `ttrace2.mjs` and `tjank.mjs`: scroll driven by real touch drags over CDP. Scroll events then arrive at frame start, as on a phone; scripted `scrollTo` puts them in the wrong place.
- `who2.mjs`: what triggered each page-wide restyle.
- `hit.mjs`: who hit-tests.
- `theme2.mjs`: costs at a section boundary.
- `early.mjs`: refreshes during a swipe while the page loads.
- `restart.sh`: A/B setup. `base/` is this tree minus my files, re-synced before every run.

## Mobile scroll performance

### What was slow
- **A custom property written on `<html>` restyles the whole page.** That is ≈ 1 536 elements on the home page, 50–130 ms at 4× CPU. It happened mid-scroll in three places:
  - `--page-bg` at every section boundary, even cream ↔ sand, where only the background changes.
  - `html.mbar-on { --mbar-space }` each time the phone bar came or went. That is twice per page: leaving the hero and reaching the footer.
  - The ink variables at light ↔ dark boundaries. This one is the effect itself.
- **A `var()` in `<html>`'s inline style.** In Blink, any change to it restyled the whole page. A literal colour does not (0.8 ms with a literal against 14–40 ms with `var()`).
- **Header tone probe.** It ran `3 × elementsFromPoint` plus computed styles every 450 ms during a scroll and again after it, even while the header was slid away. That was 312 hit tests per home scroll (≈ 570 ms at 4×). The phone bar did the same while hidden.
- **Header scroll read inside rAF.** It read `scrollY` there, after GSAP's tick had written the scrubs.
- **Forced refreshes at load.** `app.ts` forced a `ScrollTrigger.refresh()` on `load` on top of ScrollTrigger's own refresh.
  - ScrollTrigger's own refresh already waits for the end of a running scroll; the forced one ignored the swipe.
  - The `fonts.ready` refresh was forced too.
  - One refresh is ≈ 170 ms at 4× on the phone home page.
- **Repaints and layers on iOS (reasoning, not measured):**
  - The grain `body::after` was `position: fixed; inset: 0`. On phones its height changes whenever the toolbars collapse or return. WebKit re-renders an SVG background, feTurbulence included, on every paint. So each change of scroll direction repainted noise tiles.
  - Lazy photos sharpen with an animated `filter: blur()` on a non-composited image. That repaints a blurred photo every frame for 1 s.
  - The unused focus ring was a permanent fixed composited box on iOS.
  - `.rv-char` had a permanent `will-change`.

### What changed (nothing looks different)
- **`bg.ts`, the page colour.** It is now one non-inherited property, a literal colour (`background-color` on `<html>` and `<body>`). `<body>` still fades it over 0.9 s.
  - Ink, `data-theme` and `--page-bg` are written together, as one restyle, only when the page turns light ↔ dark. Attributes are written only on change.
  - For cream ↔ sand, `--page-bg` is written at the next scroll-quiet moment. Its only readers are hover colours, the wall's talk button (on a moss flip, so immediate) and the /business step rings (in the soil section, so immediate).
- **`--mbar-space`.** It is now set only on the boxes that read it: `.cookie`, `.fmap__legend`, `.nf__ground`, `.nf__grass` and `.nf__stage`. The values are identical (checked: legend 82 px, cookie 78 px, 404 ground 70 px).
- **Header tone.** It is not probed while the header is hidden; it is probed the moment the header comes back. The phone bar works the same way. The tone after coming back is identical at every tested position: home, /business, mobile and desktop.
- **Header scroll read.** `scrollY` is now read in the scroll event's capture phase, together with the read ScrollTrigger makes anyway. rAF only writes.
- **`core/scroll.ts`.** New `whenScrollQuiet()`, the same rule hometop uses.
  - `app.ts` on touch: `fonts.ready` → refresh at a scroll-quiet moment.
  - There is no extra forced refresh on `load`; ScrollTrigger's own is enough. Desktop is unchanged.
- **Grain.** It is now `inset: 0 0 auto 0; height: 100lvh` (with a `100vh` fallback), a constant size, painted once. I did not make a raster tile: after this, its repaints are rare (rotation, memory purge).
- **Sharpen.** `img.img-sharpen.is-loaded { will-change: filter }`. The layer exists only during the 1 s sharpen, so the GPU applies the blur. Checked: the blur still goes 16 px → 0 over 1 s, and the class drops after.
- **Focus ring.** It has `visibility: hidden` while unused (with a transition delay, so the fade-out is unchanged).
- **`.rv-char`.** `will-change` now applies only while `data-reveal="letters"` is on the element.

### Numbers
Setup: iPhone 13 emulation, DPR 3, 4× CPU, touch drags 0 → 11 200 px over the whole home page. Each figure is the median of 3 interleaved A/B runs against the same tree without my edits.

| | before | after | how |
|---|---|---|---|
| JS time (dev) | 4 193 ms | 2 799 ms (−33 %) | measured |
| JS time (production preview) | 3 981 ms | 2 861 ms (−28 %) | measured |
| Hit testing (dev) | 1 328 ms | 935 ms (−30 %) | measured |
| Header hit tests | 312 (571 ms) | 6 (10 ms) | measured |
| Style recalc (dev) | 3 402 ms | 2 886 ms (−15 %) | measured |
| Page-wide restyles (≥ 1 500 elements) per scroll | 6 | 4 (the light ↔ dark turns only) | measured |
| Long tasks > 50 ms (production) | 10 | 8 | measured |
| /business cream → sand: 878-element restyle | during the scroll | at the quiet moment (≈ 200 ms later) | measured |
| Forced refreshes during a swipe that starts while the page loads (150 ms latency) | 3 | 1 (ScrollTrigger's own, before the scroll had started) | measured |
| Headless fps (full-page touch scroll) | 47.6 | 48.0 | measured; headless is bound by Chromium's Layerize (≈ 8 of 24 s busy), from section layers |

Parity checks:
- Screenshots: home mobile 390×844 and desktop 1440×900 at 11 and 9 positions; /business mobile and desktop; reduced motion. Also /plant, /tree/0427, /legal/privacy, /credits and 404 on mobile. All differ only within the run-to-run noise (video, fireflies, intro timing).
- High contrast on a dark section: same ink values as before.
- No console errors and no horizontal overflow. `tsc` is clean for my files.

### Not fixed / left for others
- **The light ↔ dark turn is still one page-wide restyle.** That is 4 per home scroll, ≈ 60–130 ms at 4× (roughly 10–25 ms on a recent phone). Every text colour changes then, so it is the effect itself.
  - Half of it is other owners' `html[data-theme='dark'] .X { --custom: … }` rules: wall, companies and contact on home, `.biz` on /business. They restyle those whole sections at every turn, even far off-screen. The `data-theme` flip alone costs 28 ms at 4×.
- **`<body>` colour/background fade (0.9 s) is kept.** It adds a small restyle per frame during each fade.
- **Not tested on a real iPhone or Android.**
