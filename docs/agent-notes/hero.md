# hero — preloader "טבעות שנים", hero "Crown", the home WebGL stage

## Files
- `partials/home/head-hero.html`: preloads the LCP photo (AVIF, same `media`/`imagesrcset`/`imagesizes` as the `<picture>`, landscape and portrait) and Frank Ruhl 300 Latin (the counter digits).
- `partials/home/preloader.html`: inline skip script, inline critical CSS, and the inline SVG rings (16 paths, generated and seeded, about 22 KB).
- `src/sections/home/preloader.ts` (+ `.css`): decides when the ring window opens.
- `partials/home/hero.html`: a hand-written art-directed `<picture>` (portrait crop on `(max-width: 900px) and (orientation: portrait)`), copy, buttons, counter, tilt button, and inline pre-entrance CSS.
- `src/sections/home/hero.ts` (+ `.css`): the entrance, the mode choice (gl / video / still), scroll, ground wave, tilt, and touch puff.
- `src/gl/`: `index.ts` (light public API, no three import), `stage.ts` (the one renderer), `hero-wind.ts`, `ripple.ts`, `shaders.ts`, `types.ts`, and `capture.ts` (dev only: renders the video).
- `public/img/hero-mask.png` (320×200) and `hero-mask-portrait.png` (240×360): the foliage masks.
- `public/video/hero-loop.{webm,mp4}`: 720×1080, 7 s, seamless loop, 1.24 MB VP9 / 1.65 MB H.264.
- Contracts kept: `initPreloader(): Promise<void>` and `initHero(ready)`.

## Preloader
- The rings draw from the centre at first paint, with no JS. The counter 0→100 is a CSS `@property --pl-n` animation shown through `counter()`.
- JS reads the running CSS animation to know when the counter reaches 100. It then waits for:
  - the hero photo `decode()`, capped at 420 ms;
  - "beat" hooks (`onPreloaderBeat`), capped at 140 ms. WebGL compile and texture upload happen here, behind a still frame.
- The window opens over 0.9 s with power3.inOut. The hero gets `z-index` above the ring layer and `clip-path: circle()` centred on the pith. The rings scale up and the inner rings fade; the bark ring stays as the window's rim.
- The promise resolves 0.36 s into the opening. `bus.emit('preloader:done')` fires when the layer is removed. Total time is about 2.2 s.
- Skipped when:
  - it is a repeat visit in the session (`sessionStorage of:preloader`);
  - the visitor arrived through an in-site leaf transition (`__ofPT`);
  - the URL is a deep link (`#map`);
  - motion is reduced.
- A tap, a wheel or a key press during the drawing jumps straight to the opening. Scroll is locked only during the intro.
- Failsafes: the layer fades away by itself after 5 s if JS never takes over. It never shows without JS.

## Hero
- **Entrance:**
  - Letters of "היער שלנו" rise one by one from under the word's lower edge (`clip-path` mask), each with a ±5–10° turn and blur 10→0 (6 px on phones). Step 0.04 s, expo.out.
  - The subtitle and text come in line by line (SplitText masks, 0.08 s), then the buttons, the gift link and the corner.
  - Counter count-up 0→127. Greeting by Israel time (`dayPeriod()`) with a line icon for the time of day, next to "מושב פדיה".
- **Pre-entrance:**
  - First visit: the copy paints at once under the ring layer, so it is the early LCP candidate. Chrome does not count a full-viewport `<img>` as LCP. The copy is hidden only while the window opens.
  - Repeat visit: hidden until the entrance runs, with a CSS failsafe at 4.5 s.
- **Scroll (scrub):** the photo zooms 1→1.14 and darkens (moss 0→0.62). The content lifts and fades. The bottom edge rises as a wavy earth surface: a cream fill that matches the cream band the roots section opens with, a bark edge line drawn with DrawSVG, sparse grass and three sprouts. The wave is rebuilt on every ScrollTrigger refresh.
- **Pointer:** the cursor is a gust (fast attack, smooth release over about 0.85 s, along the cursor's velocity) and plays a soft `sound.play('rustle')` at most every 4 s. Phones: a tap on the crown is a "puff".
- **Tilt (phones, off by default):** a "הטיה" pill. On iOS it calls `DeviceOrientationEvent.requestPermission()` on the tap. It moves the photo layer, the copy (xPercent/yPercent, so it never fights the scroll `y`) and the particles by depth.
- **Modes, decided after the first frame and never blocking the LCP:**
  - `gl`: desktop tier ≥ 1 (DPR 1 / 1.5 / 2 by tier; full quality from tier 2), phones tier ≥ 2 (light shader, fewer particles, DPR ≤ 2).
  - `video`: phones with tier < 2 or no WebGL. Starts 300 ms after the intro, poster = the photo, fades in on `playing`, pauses off screen and in a hidden tab. Only used with the portrait crop.
  - `still`: data saver, or no WebGL on desktop. The photo slowly "breathes" in CSS. The video and still modes get a few CSS motes or leaves.
  - Reduced motion: no preloader, no WebGL, no video, no parallax. Static copy, a small static ground wave.
- **Dev query params (dev only):**
  - `?mode=gl|video|still` and `?season=spring|summer|autumn|winter` force a path.
  - `?plpause` pauses the opening and entrance timelines (`window.__ofPreloaderTl` / `__ofHeroEntrance`) so they can be stepped frame by frame.

## WebGL stage (src/gl): one renderer for the whole home page
- One `WebGLRenderer` and one canvas. The canvas is **moved into the element of the view that needs frames**: the hero photo wrapper, or the hovered image's box. It is not a fixed full-screen layer.
- So it inherits that element's transforms, leaf clip and stacking. There is no DOM↔GL syncing and no z-order fight with text over images.
- Priority: a ripple beats the hero. The RAF runs only while a view is alive. It pauses off screen and in a hidden tab.
- The three.js chunk (about 140 KB gz, shared with /tree) loads only on demand. Desktop starts fetching it after the first frame.
- **Colours pass through:** NoColorSpace textures and no output conversion. A frame without wind is pixel-identical to the `<img>`, so the canvas can come and go invisibly.
- **Gotcha that is fixed:** a DOM `<img>` with `srcset` reports a *density-corrected* `naturalWidth` (1440 for a 1600w file). three then allocates the wrong storage, which gives a black texture and `GL_INVALID_VALUE`. `cleanImage()` re-decodes `currentSrc` (memory cache, no network) and that copy is used.
- **Wind shader:**
  - Sway: three sines travelling right→left.
  - Flutter: simplex noise sampled on a circle, so it is periodic and a loop is exact.
  - Gust: around the cursor.
  - Dappled-light brightness.
  - All of it is multiplied by the mask and by "tips move more".
- **Particles:** stateless points with depth of field (bokeh in front of and behind the focal plane).
  - Autumn (now): backlit drifting leaves in the brand leaf shape (lens + midrib), tumbling.
  - Spring and summer: golden pollen. Winter: pale motes.
- **Ripple:** water rings from where the cursor enters or moves, a soft lens under the cursor, and a 3.5 % zoom. It copies the image's `object-fit`, `object-position`, radius and live `transform`.
- **Mask:** made by `scratchpad/agents/hero/tools/make-mask.mjs` with `mask-config.json`:
  - luminance detail energy (leaves against light);
  - minus wide, smooth, dark regions;
  - minus **hand-placed trunk, limb and stone-wall strokes** (normalised polylines, checked against a grid overlay);
  - times a vertical fade, so the ground never moves;
  - then blurred.

  A frame-difference check of the video confirms that only the foliage moves; trunks, the rope limb and the ground stay still.
- **Video:** `tools/render-video.mjs` renders 210 frames at 30 fps through the same shader in loop mode, using `window.__ofGLCapture` (dev only). ffmpeg then encodes x264 CRF 26 and VP9 CRF 36. The step across the loop seam equals a normal frame step.

### API for other owners (`import { … } from '../../gl'`)
- `enableRipples({ minTier })` / `disableRipples()`. The hero calls `enableRipples` on the home page after the intro, on desktop only. Delegated, so images added later work too.
- **Seasons owner:** put `data-gl="ripple"` on the card `<img>` (`<img data-img="expTeams" data-gl="ripple" …>`) or on a wrapper that contains exactly one image. That is all.
- `preloadGL()`, `mountHeroWind(opts)`, `disposeGL()`.

## Verified
- `tsc`: clean for my files.
- Dev server on :5182, plus a production build in scratch (`build-hero`) served with `vite preview` on :5182. Server killed.
- Screenshots that I looked at:
  - desktop 1440 and mobile 390: preloader drawing, the opening (six seeked frames), the entrance (six seeked frames), the final state, scroll 250/300/500/600/800, the ground wave;
  - `--reduced` on desktop and mobile;
  - repeat visit (skip);
  - forced `?mode=gl` on mobile, and the video mode playing (WebM, `readyState` 4);
  - spring and autumn particle crops;
  - the ripple on an image marked at runtime (canvas moves into the frame and comes back).
- No console errors, no horizontal overflow.
- Production build, headless: LCP 0.4–1.0 s (text), CLS 0.00007 desktop / 0.0003 mobile. three is in its own lazy chunk.

## Known gaps / honest notes
- **The photo has no people and no bench.** The assets agent chose an olive grove at golden hour. The mask therefore protects trunks, limbs and the stone wall. If a photo with people is swapped in, regenerate the masks: edit the strokes in `mask-config.json`, then run `make-mask.mjs` with the project root, the config and `land` or `port`.
- Wind amplitude, gust feel and particle density were tuned from stills and frame diffs in headless SwiftShader (a few fps), **not watched in real time on a GPU**. Someone should look at it once on a real laptop and phone. The knobs are in `WIND_FRAG` (`.0042` sway, `.0016` flutter, `.0105` gust) and in `SEASON` in `hero-wind.ts`.
- Arriving through the leaf page transition (`__ofPT`) skips the preloader even on the first home visit of the session. That is deliberate: no moss cover followed by rings, so no double intro.
- The landscape video (phone in landscape) is not rendered. That case falls back to still mode.
- On short phones (≤ 700px high) the hero paragraph is hidden so the CTA stays on screen; the roots section carries the story.
- The video starts 300 ms after the intro. On a slow 4G phone it fades in a few seconds later (the poster is identical, so nothing jumps).

## Requests to other owners
- **Chrome:** the cookie card (bottom right, reading-start corner) covers the hero paragraph on desktop. On phones it covers the hero's primary CTA "נוטעים עץ משלכם" for its whole first view. Could it sit lower or narrower on the home hero, or wait until the first scroll?
- **Seasons:** `data-gl="ripple"` on the card images (see above).
- **Lead:** `public/video/` and `public/img/hero-mask*.png` are new static assets. The tools that produce them live in `scratchpad/agents/hero/tools/` (not in the repo). Move them into `scripts/` if you want them versioned.
