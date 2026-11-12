# perf — /plant (configurator, map picker, payment, done view)

Files: `src/plant/index.ts`, `src/plant/stage.ts`, `src/plant/draw.ts` (new), `src/plant/plant.css`, `src/plant/steps-choose.ts` (desktop map reveal only, see desktop-plant.md).

## Mobile scroll performance

### What was measured
- Harnesses (copies in `scratchpad/agents/desk-plant/`):
  - `pjank.mjs`: the phone sheet (`.pc__scroll`) scrolled at 900 px/s, 4 sweeps.
  - `pseq.mjs`: a tap (next / species / map / pay) followed by a sheet scroll that starts while it runs.
  - `pload.mjs`: the first 7 s after load.
  - `woodlog.mjs`: logs every plaque wood texture that is generated.
- Setup: iPhone-13 emulation, DPR 3, 4× CPU.
- A/B method: A is a snapshot of the tree with my files as at fa9748d (= e9cdfc7). B is the same snapshot plus my files. Each test ran 3× A/B back to back; the tables give medians. The headless CPU is shared with other agents, so fps moves ±10 between runs.

### What was slow
1. **The sheet scroll itself is cheap.** At A, every step scrolls at 57–59 fps with the main thread almost idle: no layout, about 0.1 s of script per 4 sweeps. The sheet is a composited overflow scroller with only small layers. On iOS the sheet scrolls in the UI process, so a busy main thread does not stop it. What a visitor feels is main-thread work that lands **while** they swipe: the step change, the tree growing, the payment.
2. **The plaque's wood texture was rebuilt at the worst moments.** The engraver sizes its canvas from its CSS size. It builds a wood texture (pure JS, per pixel) for each new size bucket. This happened in three places:
   - **Every page load.** The engraver drew once while its canvas was still detached. A detached canvas reads as 480 px wide, so a 1600×667 texture was made and thrown away (≈ 1 s at 4×).
   - **Entering the plaque step on a phone.** The canvas moves into the big slot above the input, so a 1440×599 texture was built inside the step change: a **1.05 s long task at 4×** (≈ 250–300 ms on a mid phone) right in the slide-in.
   - **The payment.** `toDataURL()` built a 960 px plank and encoded a PNG in the same task as the done view and the cross-fade.
   - Also, when the phone stage folds to 0 px (map open, full sheet), the canvas measured 0 and fell back to 480 px. That was invisible only because the texture from the first problem was still cached.
3. **DrawSVG re-measured every frame.** Every stage line has `vector-effect="non-scaling-stroke"`, which GSAP's DrawSVG treats as "live". On each frame of a draw (the roots growing, an extra appearing, carpentry drawing itself) it writes the dash, then reads `getScreenCTM()` and `getTotalLength()`. That is a forced style + layout per path per frame: **108–196 ms of forced measuring** per species change at 4×.
4. Not mine (see Requests):
   - The header's tone probe runs on every scroll of the sheet.
   - The cookie banner's placement survey runs during sheet scrolls.

### What changed (no visual change)
- **`src/plant/draw.ts`: a `plantDraw` GSAP plugin.** It uses DrawSVG's value syntax and dash maths, but measures once, when the tween starts; frames only write. A full draw ends by clearing the dash, so the line stays solid at any later size.
  - Used for the roots, extras, corner parts and carpentry pieces (`stage.ts`).
  - The summary-step icons keep DrawSVG; they are not non-scaling, so they are not "live".
  - Mid-draw and final frames compare equal to A (extras mid-draw: max diff 0).
- **The canvas is placed before the engraver's first draw** (`index.ts`). No more throw-away 1600 px texture on load.
- **A workshop parks the canvas** in a hidden 80 px `.pc__park` instead of detaching it. Detaching made the engraver fall back to its 480 px size.
- **`.pc-plaque { min-width: 1px }`.** The folded phone stage now gives the canvas a 1 px width (a tiny texture) instead of 0, which triggered the 480 px fallback.
- **The phone plaque step's texture is made ahead.** About 4 s after load, at a scroll-quiet idle moment (`whenScrollQuiet`, never within 2.4 s of a change), we render once at exactly the slot's size, which fills the plaque component's cache. The slot's canvas gets a whole-pixel height (`round(down, 100cqw / 2.4, 1px)`, phones only, `@supports`-guarded) so the size is known in advance. That height is 0.17 px shorter than before: the plaque step's sheet ends 1 px higher at the bottom of its scroll. Nothing else differs (screenshots below).
- **The payment does its heavy work during the 1.5 s mock "payment".** After "מעבדים את התשלום…" has painted, the certificate's plaque PNG is made in one task and the done view's DOM (QR, certificate) in another. Only append + cross-fade happen after the wait. `engraver.destroy()` runs before the form is hidden, so hiding it does not trigger a re-render.
- **`--vvh` and `.is-typing` are written only when they change.** They are set on keyboard resize events, and `--vvh` on `.pc` restyles the whole configurator.

### Numbers (medians of 3, 4× CPU, DPR 3)
| scenario | A (fa9748d) | B (now) |
|---|---|---|
| Step change occasion → plaque, swiping meanwhile: fps / worst frame / longest task | 38.1 / 1067 ms / 1054 ms | 55.8 / 83 ms / 70 ms |
| Species change: forced measuring (getScreenCTM + getTotalLength) / layout time | 163 ms / 100 ms | 0 / 55 ms |
| Species change: fps (noisy, dominated by the header probe) | 55.4 | 52.3 |
| Pay → done view, frames after the mock wait (cross-fade, print, receipt scroll): worst / dropped | 833 ms / 73 | 83 ms / 21 |
| First load, longest early task (init) | 1848 ms | 734 ms |
| Wood textures in a full phone flow (load → plaque → map → pay) | 1600², 320, 1440 (in the step change), 960 (in the fade) | 320, 1440 (at idle), small ones during the fold, 960 (in the mock wait) |
| Sheet scroll (4 sweeps, each step) | 57–59 fps, main thread idle | unchanged |

- The 1440 texture still costs ≈ 1 s at 4× (≈ 250 ms on a mid Android), but now it runs at an idle moment about 4 s after load. On iOS a long task there does not stop the sheet scrolling; only a tap during it waits. In the load test it shows up as one long task at ≈ 4–5 s.
- Map open: A and B measure the same (fps 43 / 40, noise). The cost there is the map component's own build and render, plus the stage fold.

### Parity
- Phone 390×844 (iPhone 13 at DPR 1), all 8 steps plus workshop, bench, corner, the open map and the done view: sheet top and end, A vs B. Every frame differs by at most 36/255 over 0.02 % of pixels (text antialiasing). The differences were three timing phases (the envelope opening, the bird, the printing) and the 1 px plaque-step scroll end.
- Landscape 844×390: identical (max 25/255).
- Final stage states after a species change, extras, carpentry and corner on desktop: identical (max 29/255 at single pixels).
- Purchase flows (`buy.mjs`):
  - desktop and phone, with and without reduced motion, with a map spot on desktop, bench, workshop;
  - the done view and certificate PNG appear, focus lands on `#pdone-t`;
  - no console errors, no horizontal overflow.
- `npx tsc --noEmit`: clean.

### Not fixed / requests (measured with a scratch copy of chrome files, not committed)
- **chrome — `src/chrome/header.ts`.** `onScroll` is a capture listener on `window`, so it also fires for every scroll of an inner scroller. That includes /plant's phone sheet, menus and lists, while the page itself does not move.
  - On /plant phones it runs the tone probe (3 × `elementsFromPoint` plus computed styles) every 450 ms of sheet scrolling, plus a style recalc every frame.
  - Measured over 4 sheet sweeps: 18–21 hit tests and 122 style recalcs. With `if (e.target !== document) return;` at the top of `onScroll`: 0 and 0.
  - During a species change the probe was the largest JS cost: 24–130 ms per 2.6 s window at 4×.
- **chrome — `src/chrome/cookies.ts`.** The banner's `place()` loop (every 1.5 s, `getBoundingClientRect` over many nodes plus a measure pass) pauses only for **window** scrolls. Its scroll listener is non-capture, so element scrolls never reach it, and on a first visit to /plant it runs in the middle of sheet swipes.
  - Measured: 14 rect reads and 4 layouts per 4 sweeps.
  - With `{ capture: true }` (add and remove): 0.
- **plaque component — `src/components/plaque/`** (no owner in this pass):
  1. `woodFor()` quantises the width but takes the height from the measured canvas. While the phone stage folds or unfolds, the canvas aspect jitters by a pixel, so every frame makes a new small texture: 6–10 of 160–320 px. Deriving the height from the quantised width / `PLAQUE_ASPECT` would make them hits.
  2. The ResizeObserver redraws the plaque on every frame of a fold. Redrawing once the size settles (or scaling the old bitmap meanwhile) would make the fold free.
  3. `sizeCanvas` falls back to 480 px when the canvas measures 0. Keeping the last size would remove the need for my park and the `min-width`.
- **Not tested on a real iPhone or Android.** The iOS reasoning (the sheet scrolls in the UI process, so only main-thread work under the finger hurts) is not measured.
