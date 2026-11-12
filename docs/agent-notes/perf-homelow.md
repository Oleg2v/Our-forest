# perf — homelow (home: companies, wall, contact · site footer · dog)

Scope: phone scroll smoothness in `src/sections/home/{companies,wall,contact}.*`, `src/components/{footer,dog}.*`
and their partials. Nothing visible was changed on purpose. Scripts and screenshots are in
`scratchpad/agents/perf-homelow/`.

## Mobile scroll performance

### What was slow
- **Wall: giant marquee layers and colour transitions.**
  - Each row was one track with the full list plus copies. On the phone the tracks were 13 045×46 and 14 821×26 px; on desktop they were 21 809×78 and 19 921×36. Each had `will-change`.
  - About 150 dedication and signature spans each had their own 0.9 s colour transition.
  - Every page-colour change (`data-bg`, at least two in this range) restyled them on every frame for 0.9 s, even off screen. One pass through the range showed 1 585–1 728 restyles of `.wall__ded` and 1 585–1 728 of `.wall__by`.
- **Companies.**
  - On the phone the scrub was script per frame: `clip-path` plus a new `scale()` on a full-screen photo layer.
  - DrawSVG measured the 42 icon and logo paths inside scroll frames (`getTotalLength`/`getBBox` plus forced style). Its cleanup used `clearProps:'all'` on SVG paths, which ran as one 84 ms task at 4× CPU.
  - The section inherited body's colour, so the whole subtree was restyled on every frame of body's 0.9 s colour transition.
  - The four title lines kept permanent `will-change` layers.
  - The 2400w photo was fetched and decoded only when it scrolled into view.
- **Footer (every page).**
  - A window `scroll` listener ran on every page and read `scrollY` on every event, which forced a style recalc in traces.
  - The seed's endless bob kept running off screen.
  - The intro's 21 root paths were measured by DrawSVG inside a scroll frame.
  - A finger moving over the letters called `getBoundingClientRect` on every `touchmove`.
- **Contact:** nothing runs during scroll, so nothing changed.
- **Dog:** costs nothing on phones and was not changed. `mountDog` returns a no-op on touch, and the footer imports it only on desktop.

### What changed
- **Wall** (`wall.ts`, `wall.css`): a row is now an endless strip, but only the dedications on screen exist in the DOM (a window list of about 2–5 items).
  - One transform moves a layer about the size of the viewport (400–966 px on the phone).
  - An item is added or dropped at an edge only when it enters or leaves, every few seconds.
  - The full list stays for screen readers (visually hidden). It is still the wrapped static list with reduced motion.
  - The dedications' colour transition is on only while the band can be seen (`.is-near`). The hidden list never transitions.
- **Companies** (`companies.ts`, `companies.css`):
  - **Touch devices** (phone scrub, and touch tablets in the pinned layout): the opening is a scroll-driven animation, a `ViewTimeline` (iOS 26 WebKit, Chrome 115+). It uses the same keyframes, sampled from the same easing, and is placed in the `cover` range with keyframe offsets. No script runs per frame.
  - **Fallback:** desktop, and any engine without `ViewTimeline`, keep the GSAP scrub.
  - The DrawSVG tweens are built and initialised at init and only play on enter. The cleanup is two `removeProperty` calls.
  - The section sets `color: var(--ink)` on itself, so body's colour transition stops at the section. Nothing in it paints the inherited colour; I checked this.
  - The title lines have no permanent `will-change`. GSAP promotes them only while they rise.
  - The photo is set to eager and `decode()`d in the idle init slot after the intro.
- **Footer** (`footer.ts`, `footer.css`):
  - No scroll listener. The breeze takes `self.scroll()` from one page-long ScrollTrigger (`start:0, end:1e7`), which is ScrollTrigger's cached read for that frame.
  - The brush reads the field box at most once per frame.
  - The seed bob is paused while the footer is off screen (`.site-footer--inview`).
  - The roots tween is built and initialised up front, with the same cheap cleanup.

### Numbers
**Setup:** production build and `vite preview`. A is the same tree with only my files reverted. A and B ran interleaved, back to back. `jank.mjs`: iPhone 13, DPR 3, 4× CPU, 900 px/s.

| range | fps A → B | worst frame | frames > 50 ms | long tasks | style |
|---|---|---|---|---|---|
| wall 7500→9400 | 32.4–38.3 (med 37.3) → **44.4–54.8 (med 47.7)** | 117–267 → 83–117 ms | 2–7 → 2–4 | 234–755 → 158–361 ms | 0.80–0.91 → 0.57–0.73 s |
| companies 5300→7400 | 58.7–59.6 → 58.3–59.6 | 33 → 33 ms | 0 → 0 | 0 → 0 | layout 0.03–0.04 → 0.01 s |
| contact + footer 9400→11224 | 57.5–58.5 → 58.0–59.0 | 67 → 50–83 ms | 1 → 0–1 | 69–81 → 0–97 ms | layout 0.02 → 0.01 s |

**Traces** (dev, 4×), wall range:
- Restyles of the dedication spans per pass (each of `.wall__ded` and `.wall__by`): 1 585–1 728 → 80–88.
- Worst restyle per frame during a page-colour change: 38–42 ms (307–372 elements) → 16–22 ms (150–198).
- Full-page restyle at the colour flip: 1 696 → 1 536 elements.
- Elements restyled per pass: 12 451–13 287 → 10 685–10 835.

**DrawSVG measuring during scroll** (`getBBox` calls per pass):
- companies range: 35 → 0
- wall range: 76 → 0
- footer range: 97 → 0

**Layers** (phone, CDP LayerTree, y = 8400):
- 56 → 51 layers, 58.7 → 54.0 viewports of area.
- Wall tracks: 13 045 / 14 821 px wide → 400–966 px (desktop: 21 809 / 19 921 → 1 800–2 300 px).

**By reasoning only** (headless Chromium cannot show iOS raster or GPU costs):
- the scroll-driven opening (no per-frame `scale()` writes for WebKit to re-rasterize; Chrome runs the zoom on the compositor)
- the paused seed bob
- the early photo decode
- no title-line layers at rest

### Visual parity and checks
- **Screenshots, A vs B, same scroll positions:** phone 390 wide (12 positions), desktop 1440×900 (10), iPad landscape (8), and reduced motion (5 phone, 3 desktop).
  - Reduced motion is pixel-identical.
  - Elsewhere at most 0.9% of pixels differ. The causes are text antialiasing on the title lines, the clip edge mid-scrub and the letters' sway phase.
  - The marquee rows differ only by the strip's position in time. Row heights and item widths are identical: 76.59 / 55.00 px on the phone, 136.20 / 76.56 px on desktop.
- **Wall coverage:** 60 samples on the phone and 60 on desktop show no gap and full coverage of each row.
- **Reduced motion toggled at runtime:** wall live → static → live, and companies stage → static → stage, with no errors.
- **Footer on all page types** (`/`, `/plant`, `/tree/0427`, `/business`, legal, `/credits`, 404), on the phone and on desktop:
  - no console errors and no horizontal overflow;
  - tap-plant on the phone and drag-plant on desktop both work;
  - the dog runs on desktop only.
- **Scroll breeze, A vs B:** the phone gives 6.9° vs 6.9°. Desktop with a Lenis wheel gives 3.0° vs 3.1°.
- `tsc --noEmit` is clean.
- **Behaviour change:** on touch devices the opening follows the scroll directly instead of catching up over 0.35 s (0.6 s on tablets). Frames at rest are the same.

### Not verified / left for others
- **Not tested on a real iPhone or Android.**
- **The biggest remaining cost in the wall and contact range is not in my files:**
  - Every `data-bg` flip changes `--ink`/`--page-bg` on `:root`. That restyles the whole page: 1 536 elements, 75–115 ms tasks at 4×.
  - body's 0.9 s `color`/`background-color` transition then restyles about 150–200 inheriting elements on every frame.
  - With `body{transition:none}` injected, the wall range goes from 40 to 47–53 fps and style time from 0.77 to 0.52 s.
- **The 390×5923 "Overlap" squashing layer** in Chromium, from `.companies__copy` to the end of the page, is not caused by my layers. Removing all my `will-change` layers left it in place. It continues an overlap chain that starts in the hero.
