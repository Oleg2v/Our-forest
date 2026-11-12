# review — home top (preloader, hero "Crown", the home WebGL stage, roots "מתחת לפני השטח")

Reviewer pass over the hero and roots areas. I read the brief sections for this area (concept 240–246, section 5 at 632–664, global interactions 1028–1083, mobile 1815–1841, tech 1842–1879, readiness 1908–1925) and checked each item in the running site.

## Fixed
- **Roots: node icons left half-drawn at rest** (desktop pinned mode).
  - Before: the ring, icon, title and caption were part of the scrubbed timeline. A scroll that stopped between ignition points left "תהליכים וסדנאות" as a tiny glyph and "עבודת אדמה" as an empty ring.
  - Now: the root's growth stays scrubbed. Each node lights with a short time-based timeline (ring → icon → title → caption) as soon as the root reaches it, and plays backwards (×1.8) when you scroll back up.
  - Checked at rest, and in reduced motion on desktop and mobile.
- **Roots: the workshops spiral icon was very small** inside the 30 px icon box. I enlarged it to use the 24-unit grid like the other icons.
- **Roots on landscape phones and very short windows** (≤ 560 px high, landscape).
  - Before: the pinned 100vh net squeezed five nodes on top of each other.
  - Now: these screens use the phone layout (one vertical root): `COMPACT_MQ` in roots.ts, mirrored in the roots.css @media. There is also a small landscape scale-down of the photo and type.
- **Roots, phone layout: a margin-collapse bug.**
  - Before: the photo's negative top margin collapsed through `.roots__story` and dragged the whole soil block up over the cream "sky". The cream band became 35 px on portrait phones and disappeared on landscape phones.
  - Now: `display: flow-root` on the story. The photo now straddles the surface as designed: sapling above ground, roots below.
- **Roots, phone layout: unreadable dim state.** Unlit nodes were at 0.2 opacity (contrast 1.8:1). They are now at 0.36, so the 26 px titles stay ≥ 3:1. The root tip runs at 76 % of the viewport (was 66 %), so few dim nodes are visible.
- **a11y: SplitText aria.** SplitText's default `aria:'auto'` put an `aria-label` on `<p class="roots__text">`, which axe flags as "serious". It also hides the split words, so the paragraph could be silent in screen readers. All SplitText calls in hero and roots now use `aria:'none'`.
- **a11y: tilt pill name.** The accessible name of the tilt pill now contains its visible label ("הטיה: …", WCAG 2.5.3).
- **Hero contrast:**
  - Counter pill: moss .34 → .6. It sits on the bright sky and sun. Measured median 4.5 → 8.1 on 1280×720.
  - Tilt pill: also moss .6.
  - Greeting: cream .86 → .95.
  - Phone shade: a little stronger around the greeting and title. Mobile greeting p95 went from 4.0 to 5.2.
- **Header tone over the hero's cream ground wave.** While scrolling back up into the hero, the header was cream text on cream (grey glass). Fix:
  - The ground's cream fill is now hit-testable (`pointer-events: visiblePainted`).
  - `.hero__ground` has `data-header="dark"`.

  The roots "sky" band already reads as light, through its painted background. Checked at 6 scroll positions on desktop and mobile.
- **Hero on landscape phones / short windows.**
  - Before: the 620 px min-height plus a content fade tied to the hero's top meant the buttons faded out before you could scroll to them.
  - Now: a designed landscape layout (title, subtitle, both buttons and the gift link in one 390 px screen).
  - The copy's scroll fade is now its own trigger that starts at `bottom bottom`. That is identical for a 100svh hero, and correct when the hero is taller than the screen.
- **Hero: runtime motion toggles.**
  - Pointer gusts were only bound when motion was on at load. They are now always bound, and check motion themselves.
  - The tilt pill now hides when motion is turned off and comes back when it is turned on. Before, it was a button that did nothing.
- **Ripple:** `max-width:none; max-height:none` on the ripple canvas, as the seasons owner asked. Verified on the seasons cards on desktop: the canvas is slipped into `.seasons__img` at 348×336 and handed back after you leave.
- **Wind** — measured, not eyeballed.
  - Method: deterministic frames through the dev handle, then phase correlation on 64 px patches at 1440×900.
  - Before: foliage moved p90 ≈ 6 px, max 8 px over half a sway period, and about 2 px per 0.5 s. Calm but faint.
  - Change: sway .0042 → .0052, flutter .0016 → .0018.
  - After: p90 7 px, max 10 px. Trunks, the rope limb and the ground stay at 0. The diff image shows only the canopy moving.
  - The phone video was rendered with the old amplitude and was not re-rendered.
- **Preloader length** (brief: no longer than 2.2 s).
  - Rings and counter now take 1.26 s (were 1.36 s). The window opening is 0.84 s (was 0.9 s).
  - Unthrottled production build: FCP → layer removed = 2.18–2.25 s on desktop and 2.2 s on mobile.
  - Added `performance.mark('of:preloader:init|100|open|done')` for RUM / DevTools.
- **First-impression main thread** (`src/pages/home.ts`). The below-the-fold sections (roots, seasons, map, companies, wall, contact) are no longer initialised during the ring drawing and the window opening. They start:
  - 0.9 s after `preloader:done` (requestIdleCallback with a 500 ms timeout), or on the first real scroll, whichever comes first;
  - 1.5 s after the entrance on a repeat visit, or on the next frame with reduced motion;
  - one section per task after a rendered frame, still in journey order. There is one `ScrollTrigger.refresh()` at the end if the page had already loaded.

  Deep links (`location.hash`) and hidden tabs still initialise everything synchronously. A section that throws no longer stops the ones after it.

  Measured on 4× CPU, 9 Mbps / 150 ms:
  - The counter reaches 100 on time; before, the inits made it 230–700 ms late.
  - The opening runs at full frame rate (rAF gaps ≤ 116 ms, mostly 16 ms; before there were 1.5 s freezes).

  An early scroll right after the intro still finds roots pinned and all nodes lit.

## Measurements (production build, `vite preview`)
| profile | LCP | CLS | preloader removed | notes |
|---|---|---|---|---|
| mobile 390×844 @3x, 4× CPU, 9 Mbps / 150 ms RTT, no WebGL (video mode) | 0.84–1.15 s (hero text) | 0.0001–0.0003 | 3.3–3.6 s from navigation (FCP ≈ 0.84 s) | TBT over 7 s is 1.1–3.0 s (mostly the deferred section inits after the intro) |
| desktop 1440×900, 1× CPU, no WebGL | 0.69–0.76 s (title) | 0.0002 | 2.93–3.05 s (FCP 0.75 s) | |
| desktop 1440×900, 4× CPU | 1.05–1.36 s | 0.0001 | 3.6–4.2 s | |

With `--use-angle=swiftshader`, headless WebGL adds a 1.5 s GPU-process stall. It comes from detect-gpu / context creation in software GL. It is a headless artefact, so I measured the no-WebGL path for the timings and checked GL separately.

## Verified, and how
- `npx tsc --noEmit`: no errors in my files.
- Dev servers: :5201 (HMR) and :5291 (my no-HMR config, so other agents' edits did not reload my runs). Production build in `scratchpad/build-hometop`, served on :5211. All three are killed.
- Screenshots I looked at:
  - desktop 1440×900, 1280×620, and mobile 390×844 at 0 / 700–1000 / 1300–2600 / 2800–3800;
  - reduced motion on desktop and mobile;
  - landscape 844×390, and rotating portrait ↔ landscape;
  - header crops at 6 scroll positions, focus rings, dog follow and sit, ripple hover frames.
  - No horizontal overflow and no console errors (only the headless "GPU stall due to ReadPixels" driver warnings).
- Preloader: real-time video recordings, dev and production, sampled at 4–6 fps. Rings draw from the centre, the counter goes 0→100, the circular window opens and the letters rise. `[data-preloader]` is present. The layer is removed, the chrome hold releases, and the header appears after the reveal.
- axe-core (wcag2a/aa, 21a/aa) on `.hero` and `.roots` (story and net): desktop, mobile, and reduced motion on both, all with **0 violations**. Remaining "incomplete" color-contrast items are photo, gradient or overlap backgrounds; I measured those by hand (see above).
- Keyboard: skip link → header → hero CTA → "הכירו" → gift link → seasons. Focus rings are visible, and leaf-shaped on the gift link.
- Deep links `/#directions /#story /#map /?spot=0427#map` land correctly on desktop and mobile. `/#contact` lands correctly on mobile but not on desktop (see requests).
- Runtime reduced-motion toggle (media emulation) on desktop GL and mobile video, both at the hero and mid-roots:
  - on → off → on: GL, video, pin and tilt come and go, with no errors;
  - the roots section returns to exactly the same height.

## Remaining (honest)
- The wind, gust and ripple feel was measured numerically and in frames, **not watched on a real GPU or phone**. Same for 60 fps on a mid Android.
- On a 4× throttled phone the first ~0.4 s of ring drawing still stutters. That is the bundle's own parse and eval (gsap, chrome, hero), not section inits. Further gains would need a smaller first bundle: chrome/gsap code splitting, which is shared foundation.
- The deferred inits plus one `ScrollTrigger.refresh()` make a 0.3–0.7 s main-thread burst about 1–2 s after the reveal on a throttled phone. It lands after the letters and lines and near the end of the counter count-up. On desktop it is about 60 ms.
- The phone video (`public/video/hero-loop.*`) still has the earlier, slightly smaller sway. It can be re-rendered with `scratchpad/agents/hero/tools/render-video.mjs`.
- Roots on touch tablets wider than 768 px (pinned, native scroll) is still untested on hardware.

## Requests to other owners
- **chrome (`src/chrome/transition.ts` deepLink) / lower sections:** `/#contact` on desktop 1440×900 lands at scrollY 11072, but `#contact` is at 13800. The section is 2.7k px below the viewport and stays there. It reproduces with the original `home.ts` too, and mobile is correct. The likely cause: companies (3490 px tall, pinned) or wall pin spacing is not in place yet, or not measured, when `deepLink()` scrolls at load + 60 ms. Possible fixes: land after a second `ScrollTrigger.refresh()` on the next frame, or re-land once if `getBoundingClientRect().top` is not ≈ 0 after 300 ms.
- ~~chrome (a11y panel): two `[data-a11y-motion]` elements~~ — withdrawn (second pass). The second match is `<html data-a11y-motion="off">`, the CSS kill-switch flag set by head-common.html and `syncEnvClasses()`. There is only one switch; query `button[data-a11y-motion]`.
- **seasons / map / companies / wall:** after reduced motion is toggled off → on at runtime, the document is about 260 px shorter than at load (mapsec −9, companies −6, wall −10, …). Roots and hero restore exactly. Worth checking that each teardown → rebuild returns to the same layout.

---

# Second pass — after the independent critic (13 findings)

All verified on the production build (`scratchpad/build-hometop`, `vite preview` :5211) and the dev server (:5201).
Scripts: `scratchpad/agents/hometop/{intro-cast,raf,loaf,glrep,toggle,rotate,ghost,plshot,seam,axe}.mjs`, frames in `…/hometop/r2/`.

## Fixed
- **LCP on repeat visits / transitions back to / (high).** The entrance split `.hero__text` into lines and reverted the split when it ended, so the paragraph repainted as one new, larger LCP entry at ≈ 3 s (4.75 s on a 4× phone).
  - The paragraph is now revealed as one block (opacity / y, from 0.46 s into the entrance). It paints once, whole, early.
  - The subtitle keeps its line-by-line rise. Its split (`tag: 'span'`, valid inside `<p>`) is not reverted when the entrance ends, so there is no late repaint. It is reverted on a width change or when motion is turned off.
  - Measured, repeat visit: desktop LCP 448 / 1340 ms (title), with no later entry. 4× phone: 1.39 s (`P.hero__text`), with no later entry. Before: 3.0 s and 4.75 s. First visit is unchanged: 0.24–0.56 s.
- **WebGL first draw landing in the ring window's opening (medium).**
  - `createHeroWind` now does the GPU work in steps: compile (`compileAsync` where `KHR_parallel_shader_compile` exists, a plain `compile` otherwise, so three's console warning is gone), then texture upload (`initTexture`; photo and mask are decoded off-thread first, and the mask no longer goes through TextureLoader), then the first draw. Each step waits for `opts.gate()`. The promise resolves after the first frame has been presented, and only then does `.is-on` cross-fade the canvas in.
  - The hero's gate is `preloaderQuiet()` (new export of preloader.ts: true at the beat or once the layer is gone, never while drawing or opening) plus "the title's letters have landed" (entrance time ≥ 1.6 s). A hitch can no longer land in the opening, or under the letters on a repeat visit.
  - Preparation (chunk, decode) starts as soon as the mode is GL, and the beat hook waits for the first frame (capped).
  - Marks: `of:gl:compile|upload|draw|shown`.
  - SwiftShader run: compile, upload and draw happen at the beat, before `open`. There are no long tasks during the opening (`raf.mjs`, 16–17 ms frames). When the beat is too short, the work goes after the letters land.
- **Preloader: dead beat at "100" and over 2.2 s (medium).**
  - The JS used the counter's end time, but the eased integer counter shows 100 at 91.5 % of its duration (≈ 100 ms earlier). The opening now starts the moment 100 shows (`hundredAt()`, mark `of:preloader:shows100`).
  - Beat hooks start 110 ms before that, during the last digit ticks, and may hold the opening at most 120 ms after 100. The photo-decode cap is 420 ms after 100.
  - New opening ease `CustomEase 'M0,0 C0.5,0.04 0.2,1 1,1'`: about power2 for the first 100 ms, 75 % open by half time, long soft settle. OPEN is now 0.8 s and the layer is removed at 0.82 s.
  - rAF log: window radius 2 px at +21 ms, 16 px at +87 ms, 52 px at +154 ms after open.
  - FCP → layer removed: desktop 1.8–2.07 s (was 2.28). 4× phone: 2.08–2.40 s (was 2.5). From the moment the rings start moving it is 1.98–2.0 s; the rest on the throttled phone is the delay between FCP and the first animation frame (bundle evaluation).
- **Roots: "stop animations" threw the reader out of the section (medium).**
  - On `motion:change`, roots records the reading position before any section re-lays out (`capturePlace`). Inside the pinned roots: story (with timeline time) or net. In the unpinned layouts: copy, net title or nearest node. Below roots: the outermost `<section>` across the reading line, found by geometry, because the a11y dialog makes the page inert to hit-testing.
  - After the rebuild and refresh (and again two frames later) it scrolls immediately, through lenis if present, to the same place. Pinned targets map to "story with words read" or to the all-lit `#directions` time.
  - `toggle.mjs`, desktop: at roots +1.8 vh the net title stays at 90 px off → on; at +0.5 vh the story copy stays at 71 → 72 px; in seasons the section top stays at −630 → −630 → −630; in the map, −44 → −44. Mobile: stable.
- **Phone video soft (medium).** I re-rendered the loop at 1080×1620 from `heroPortrait-1200.jpg`, through the current shader, so it now has the stronger sway (`scratchpad/agents/hometop/render-video.mjs` → `vid2/`).
  - VP9 2-pass CRF 33: **2.39 MB**, SSIM 0.994.
  - x264 slower CRF 23: **2.18 MB**, SSIM 0.990. Both are under the brief's 3 MB per format.
  - Mean gradient on a foliage crop: source frame 8.19, new WebM 8.06, old video (upscaled) 5.88.
- **Rotation while the video plays (medium).** The `<img>` load listener now runs `onCropChange()`. If the device wants video (`videoWanted`) and the crop is landscape, it switches to still and removes the video. Back in portrait, the video restarts. `rotate.mjs`: video → still (`hero-2400`) → video playing.
- **Double horizon hero → roots (medium).** There is now one horizon: the roots' soil line.
  - The hero's rising edge is a plain cream wave, with no bark line, grass or sprouts. It flows into the roots' cream band.
  - The band is shorter: desktop `clamp(88px, 11vh, 124px)` (was 30vh), phones 92 px (was 112), landscape 84.
  - The hero wave is lower: `clamp(90px, 14vh, 150px)` (was 20vh).
  - The sapling photo still crosses the soil line. Its overhang is now tied to the band, and the copy sits lower in the pinned story frame (`--story-pad`).
  - Cream between the darkened photo and the soil at desktop 1440×900: ≈ 120 px at scroll 450 and ≈ 160 px at 675 (was ≈ 320).
- **Reduced-motion static wave (medium).** `translate3d(0, 38%, 0)` (was 76 %), so the whole wavy edge shows. Phones use 50 % and landscape 55 %, so the crests stay clear of the buttons. Checked in screenshots.
- **Ghost CTA (low).** The copy fade uses `autoAlpha` (visibility hidden at 0), and pointer-events are off below opacity .35. Shift+Tab back into a faded hero scrolls to the top. `ghost.mjs`: hits at scroll 450 and 560 now land on the photo, not the CTA.
- **Preloader on landscape phones (low).** `@media (max-height: 520px) and (orientation: landscape)`: the disc is centred and the counter sits beside it (844×390: disc x 275–573, meta x 720–793).
- **Roots finale (low).**
  - New `riseAt` phase: after the light has gathered into the tap root, the branch glows dim to .16 and the node glows to .3.
  - The tap-root glow carries on up beyond the top of the screen while the camera follows it up by 24 vh.
  - The last frame is one bright line leaving the top of the screen (`e-fin.png`). `TL.end` is now 11.5 (the pin length is unchanged).
- **Critic's false positive about the a11y panel (low):** agreed. The request is withdrawn (struck through above).
- **Portrait tablets (low).** I kept the pinned version (it is the stronger experience on an iPad) and tuned it for a tall stage: photo 35vw, dots 80 px, larger type, and the five nodes spread over 0.3–0.8 of the stage. Net screenshots at 820×1180 fill the screen (`d-tab-strip.png`).
- Also: `src/gl/index.ts` asks `hasWebGL()` once per page (`webglAvailable()`). The env helper creates a throwaway WebGL context on every call.

## Verified
- `npx tsc --noEmit`: 0 errors in the whole project.
- axe (wcag2a/aa, 21a/aa) on `.hero` and `.roots` (story and net): desktop, mobile, and reduced motion on both. **0 violations.**
- No console errors in any run (the three warning is gone).
- Screenshots I looked at:
  - seam at 0.5 / 0.75 / 1 vh on desktop, laptop 1280×620, mobile, tablet 820×1180 and landscape 844×390;
  - roots finale frames;
  - reduced motion on desktop and mobile;
  - hero after the entrance on desktop and mobile;
  - preloader at 844×390, 360×640 and 390×844.

## Remaining (honest)
- **Headless WebGL is SwiftShader.** It starves timers for 2–4 s at start-up (the beat fires late), so whether the GL warm-up fits inside the 230 ms beat on a real GPU is reasoned, not measured. In every case no GPU step lands in the opening, and when the beat is too short the wind arrives after the letters land.
- **Software-raster frames late in the opening.** In headless runs (no GPU raster), frames in the second half of the opening are 60–90 ms (LoAF: not script, not style). The cause is the clip-path repaint of the whole hero plus the blurred letters. Real GPU raster should handle it, but that is not verified. A compositor-only window (a scaled ring with a box-shadow) would remove the repaint entirely. That is a bigger rework.
- **4× phone FCP → done is 2.08–2.40 s**, depending on when the first animation frame lands after the bundle evaluates. The intro itself is 2.0 s.
- **Video data cost.** The loop is now 2.4 MB (WebM) / 2.2 MB (MP4), within the brief's 3 MB per format but about 1 MB more than before, for mid-tier phones.
- **Not checked on real hardware or by feel:** the roots finale pan and the place-keeping were checked in frames and positions, not by scrolling.

## Requests (second pass)
- **Lead / foundation (`src/core/env.ts`):** please memoise `hasWebGL()` and free its probe context (`WEBGL_lose_context`). Every call creates a new WebGL context. Callers outside `src/gl` (e.g. `src/tree/**`, if they use it) pay for it too.
- **chrome (`src/chrome/a11y.ts`), optional:** roots now keeps the reader's place for itself and for every section below it, provided their rebuilds are synchronous (seasons, companies and wall are today). A page-wide version belongs in the switch handler: record the section at the reading line before `setUserMotionOff()`, and restore it two frames after. If you add it, tell me and I will drop the roots copy, so the two do not fight.
- **Lead:** `public/video/hero-loop.{webm,mp4}` were replaced (1080×1620). The render tool is in `scratchpad/agents/hometop/render-video.mjs` (port-adjusted copy of the hero agent's tool), and the encode commands are in `vid2/enc3.sh`.
