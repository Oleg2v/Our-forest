# perf — homemid: seasons strip + workshops + forest map (home)

Files changed: `src/sections/home/seasons.ts`, `seasons.css`, `seasons-workshops.ts`, `src/sections/home/map.ts`,
`src/components/forest-map.ts`, `forest-map.css`, new `src/components/forest-map/paper.webp`.
Scripts, the A/B trees and the screenshots are in `scratchpad/agents/perf-homemid/`:
`jank.mjs`, `bench.mjs`, `trace2.mjs`, `buildtrace.mjs`, `layers2.mjs`, `shots.mjs`, `mid.mjs`, `func.mjs`
and `paper/render.mjs`.

## Mobile scroll performance

### What was slow
- **Map: the paper texture.** It was an SVG data-URI background with `feTurbulence` (3 octaves). WebKit
  renders an SVG background image again on every paint of the element, in software and at the device's
  pixel ratio. On an iPhone that means a 1920×1920 turbulence for every repaint of the map frame,
  including every frame of the intro. Headless Chromium caches it, so this is fixed by reasoning.
- **Map: the build.**
  - 170 separate zero-duration `gsap.set` calls (clusters at build, intro start and intro end) each
    read a style and then wrote one. That forced a style recalc per marker: about 190 ms at 4× CPU.
  - The screen-reader list is 1571 of the map's 3015 elements, and it was built in the same task.
  - The map is 2/3 of the page's DOM. Every page-wide style change (the chrome's page colour at each
    section boundary) restyled all 5048 elements, even with the map far off screen.
- **Map: the phones' intro.**
  - It animated the opacity of whole groups inside the SVG and `drawSVG` on long paths. The whole plan
    repainted on every frame for about 1.8 s while the page was being scrolled, and WebKit draws each
    such group into an offscreen buffer first.
  - In Chromium, the pre-intro state also made a 390×7381 overlap layer starting at `text.fmap__label-t`.
- **Map: the legend refit.** The sticky bar (`html.mbar-on`) appears when you leave the hero. At that
  moment it started a 0.65 s fit animation of the off-screen map, which restyled and laid out every
  place on each frame.
- **Seasons: the branch entrance.** The `--in` custom property, tweened on about 20 leaf and fruit
  groups, was inherited by each part's subtree. Every frame restyled about 5 elements per part with
  their `color-mix` season formulas, plus an SVG relayout.
- **Seasons: the phone carousel.** All three cards played the clip-path reveal at once, including
  the ones off screen to the side. That repainted the strip for 1.2 s.
- **Seasons: the swipe.** The card media background was a formula of `--sp`, so every swipe frame
  repainted the photos too (they cover it completely).
- **Workshops (desktop):** `elementFromPoint` ran on every scroll frame while hovering, forcing a layout
  and a hit-test of the whole page.

### What changed (looks the same; the one phone simplification is marked)
- **Paper texture.** Now a raster of the same SVG (`forest-map/paper.webp`, 20 KB, 320 px shown at 640 px).
  Against the original over cream: mean difference 0.5/255, maximum 3/255. *(by reasoning, for iOS)*
- **Bulk marker updates.** These are one multi-target tween now (`placeAll`): GSAP reads every value
  before it writes any. *(measured)*
- **The list.** The list's box is in the markup at once. Its content is filled in the next idle moment,
  or at once when "רשימה" is pressed. *(measured)*
- **Skipping the off-screen map.** The home map's slot has `content-visibility: auto`, so the browser
  skips the map while it is far off screen. It is `visible` in full screen (position: fixed inside),
  and while the script does bulk work: GSAP reads into a skipped subtree are very slow, so `awake()`
  holds it awake. *(measured)*
- **Building the map.** The IntersectionObserver that builds the map now hands the work to
  `requestIdleCallback` (250 ms timeout) instead of building inside the frame that noticed it.
- **The phones' intro (zoomed-out start)** — the one phone simplification.
  - The plan and the groves are now two `<svg>` layers (art below, places, clusters and labels above).
  - Each fades in through a CSS opacity animation, which runs on the compositor. The plan comes first,
    the groves at 0.45 s.
  - The clusters and labels still settle in one by one; those are small areas.
  - The ink no longer draws itself on phones.
  - The desktop wave intro is unchanged. *(by reasoning; intro bench measured)*
- **Legend refit.** When the sticky bar comes or goes while the map is far away, the refit waits until
  the map is near. It is applied without animation unless the map is on screen. *(measured)*
- **Branch entrance.** Each part pops in through a GSAP `scale` on its own transform attribute, around
  its stalk point (`svgOrigin`). That restyles one element, not a subtree, and nothing per frame
  touches the season formulas. Frames at 0.5–3.5 s are pixel-equivalent to before
  (`sa/cmp-branch2.png`). *(by trace)*
- **Carousel entrance.** Only the slides on screen play their entrance. The others are set to their
  final state; they are off screen, so nobody saw that animation. *(measured)*
- **Card media background.** It is a fixed tone now, and it is always covered by the photo.
  *(by reasoning, for iOS)*
- **Workshops hit-test.** Row positions are cached as layout boxes and remeasured on refresh and on
  resize. Each scroll frame does arithmetic with the Lenis scroll value. *(by reasoning)*

### Numbers
iPhone-13 emulation, CPU ×4, DPR 3, a 900 px/s programmatic scroll. Medians of 3 runs, back to back.
Baseline = the snapshot before my changes; after = the same snapshot plus my files only (production builds).

| range | fps | p90 frame | worst frame | long tasks | main-thread busy |
|---|---|---|---|---|---|
| whole home 0→11000 | 35.0 → **45.2** | 50 → **33** ms | 217 → 183 ms | 3165 → **1372** ms | 12.3 → 10.9 s |
| seasons 1800→4100 | 31.3 → **39.3** | 50 → 50 ms | 233 → 183 ms | 905 → **482** ms | 2.67 → 2.47 s |
| map 3900→6000 | 45.9 → **53.1** | 33 ms | 50 → 50 ms | 0 → 0 | 2.22 → 2.10 s |
| map intro (no scroll) | 51.6 → **55.8** | 33 → 17 ms | | | 2.11 → **1.60** s |
| carousel swipe | 54.6 → **58.1** | | | | 2.10 → **1.59** s |

- Map build (dev, 4×): the build task went from 193–227 ms to 127–140 ms, and the next frame from
  111–159 ms to 72–104 ms.
- Page-wide style recalc with the map off screen: 5048 → 1698 elements, 124–244 → 80–104 ms.
- Composited layers on the phone at y=2600: 56 → 40, and 62 → 52 viewports of area. The map's
  pre-intro layers (canopy, hit and label layers, including the 390×7381 one) are gone.
- Visual parity: mobile (390×844) and desktop (1440×900) screenshots at 6–8 positions, before and after.
  At most 0.4% of pixels differ by more than 8/255. That is subpixel text and the phase of the pulses.
  Reduced motion on the phone is pixel-identical.

### Checked
- No console errors.
- No horizontal overflow.
- `tsc` is clean for my files.
- The `/plant` map picker on phone and desktop looks identical, with 38 radios.
- On the phone: tap → full screen (fixed, `content-visibility: visible`) → tap a place → sheet → close
  → "סיום". "רשימה" shows the list (170 entries; tab stops only in list mode).
- On desktop: the `?spot=0427` deep link (pinned card) and the fig filter (list counts and the
  announcement).
- The phone deep link opens the sheet.

### Not done / known
- The phone intro no longer draws the ink (see above).
- The desktop pinned strip still writes `--sp` on every frame. That restyles the section and
  repaints its background across the viewport. It is fine on desktop GPUs, and nothing was changed there.
- Headless Chromium cannot show iOS raster costs. The paper texture, the compositor intro and the
  static media background are fixes by reasoning; an iPhone check is still needed.
