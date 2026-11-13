# desktop-companies — the companies section on wide screens

## Integration round

**The item.** The homemid polish and verify agents both filed it: the hand-over from the map to companies was a hole on desktop. At 1920×1080 the four cards end at 389 in the frame, but the companies leaf only starts at 870 and the eyebrow at 896. That is a 481 / 507 px band of empty sand. Every other hand-over on the page is 2 × `--section-pad`, which is 302 px at 1080.

**Cause.** The map's own bottom padding accounts for 151 px of the gap. The rest was the top of the companies pinned stage:
- The stage is one screen high (`100vh`), and its leaf and title are centred in it.
- So the first thing in it, the leaf, sits `(100vh − leaf) / 2` = `50vh − min(22vh, 210px)` below the stage's top.
- That is 215 px at 768, 330 px at 1080 and 510 px at 1440.
- Nothing above the pin start fills that space.

**Fix.** The fix is in `companies.css`, in the existing `(min-width: 769px) and (min-height: 561px)` block, and it applies only in pin mode:
- **The pull-up.** The banner gets `margin-block-start: min(0px, var(--section-pad) − 50vh + min(22vh, 210px))`. It slides up under the map's bottom padding by the part of that empty top beyond one section-pad. This puts the leaf exactly 2 × section-pad below the cards, at every height.
- **The section stays put.** `display: flow-root` on `.companies--pin` keeps the section's own box at the map's end, so the margin does not collapse through it.
- **Pointer events.** On screens taller than ~950 px, the banner's empty top now lies over the bottom of the map cards as the pin starts (28 px at 1080, 150 px at 1440). It also paints above them, because the section is positioned. So:
  - the banner gets `pointer-events: none`, and the cards stay clickable and hoverable;
  - the photo gets `pointer-events: auto`. Its clip-path is its hit area, and the header, cursor and cookie probes still find it with `elementsFromPoint`.
- **In companies.ts:** one comment on the leaf formula, so the CSS stays in step with it. `map.css` is untouched.

**What stays the same.**
- **Pin, scrub and opening.** The ScrollTrigger and the touch-tablet ViewTimeline are both measured on the banner, so the whole pinned run is the same. It just starts earlier on the page by the pull: 107 px at 768, 179 px at 1080, 330 px at 1440.
- **Reduced motion and no JS.** The static layout already had 2 × section-pad.
- **Phones.** Portrait phones use scrub mode. Landscape phones are excluded by `min-height: 561px`.

### Evidence
Builds of 6401b06 and of the change, served with `vite preview`. Everything is in `scratchpad/agents/int-companies/`: `before/`, `after/`, `cmp/`, `gaps/`, `cs/`, `hit/`, `touch/`. "Gap" means the cards' bottom edge (where the column rules end) to the top of the leaf.

| viewport | 2 × pad | gap before | gap after | to the eyebrow, before → after |
|---|---|---|---|---|
| 1024×768 | 215 | 323 | 215 | 382 → 274 |
| 1180×820 | 230 | 344 | 229 | 400 → 285 |
| 1280×640 | 192 | 276 | 192 | 282 → 199 |
| 1366×768 | 215 | 323 | 215 | 349 → 242 |
| 1440×900 | 252 | 378 | 252 | 426 → 300 |
| 1768×900 | 252 | 378 | 252 | 397 → 271 |
| 1920×940 | 263 | 394 | 263 | 417 → 285 |
| 1920×1080 | 302 | 481 | 303 | 507 → 328 |
| 2560×1440 | 360 | 690 | 360 | 715 → 385 |
| 820×1180 (pinned tablet) | 330 | 545 | 330 | — |

- **The page's rhythm** (`gaps.mjs`, last text → first content at each section boundary):
  - At 1920×1080, map → companies went 511 → 333. The others are 327 (seasons → map) and 301–303 (companies → wall → contact → footer).
  - At 2560, it went 720 → 390. The others are 360–384.
  - See `cmp/rhythm-*.png`.
- **Screenshots of the hand-over:** `cmp/hand-<size>.png` (before | after) at 1024×768, 1180×820, 1366×768, 1440×900, 1768×900, 1920×940, 1920×1080 and 2560×1440.
- **The pin:** `cmp/pin-<size>.png`, with rows for start, mid-opening, open, end and release into the body, at 1366×768, 1768×900, 1920×1080 and 2560×1440.
  - The stage frames are the same at the same banner-relative scroll. The leaf, eyebrow, title and the body's subtitle sit at the same pixel positions.
  - The pixel diff is 0 at 1768 and 2560, and ≤ 0.7 % at 1366 and 1080. That is antialiasing, because the pull is fractional there (107.5 / 178.8 px).
  - The only intended difference: at the pin start on screens taller than ~950 px, the bottom of the map cards is still in view above the leaf (28 px at 1080, 150 px at 2560) and scrolls away during the pin.
- **Hit testing** (`hit.mjs`, 2560×1440, and 1920×1080 after a live resize from 1366×768):
  - At the pin start, `elementFromPoint` over the visible card bottoms returns `a.mapsec__card`, and hover opens the card panel.
  - Before the pointer-events rule, the banner caught these points.
  - At the open frame, the header probe's stack still starts `scrim > img`, and the header tone is the same as before ("light").
- **Live changes.** Toggling reduced motion at runtime (pin → static → pin) and resizing across 768 px both apply and remove the margin with the mode. The pin start stays at the banner's top (`clip` = the leaf's p = 0 frame), and there are no errors.
- **Touch tablet** (1180×820, hasTouch, the ViewTimeline path): the same start, mid, open and end frames as before.
- **Phones unchanged.** Computed styles of every element in `#companies` match 6401b06: 0 of 149 differ on iPhone 13 portrait and on landscape. Section tops and heights are identical.
  - The only differences inside `#map` are the forest map's own time-based transforms and opacities. A baseline-vs-baseline run shows the same 184.
  - Reduced motion: 0 differences on the phone and at 1920.
- **Desktop computed-style diff:** only the 4 intended rules. The wall, contact and footer move up by the pull.
- **Checks:** no horizontal overflow at any size (scrollWidth = clientWidth), no console errors, and `npx tsc --noEmit` is clean.

### After the container restart: re-verified, and one gap closed
**Re-verified on c5f0a07.** The fix above was committed as WIP in c5f0a07, together with the other areas' changes. I built that tree and A/B'd it against the 6401b06 build. Results are in `scratchpad/agents/int-companies/`: `now/`, `cmp-now/`, `gaps-now/`, `cs-now/` and `hit/now-*`.
- **Gap to the leaf, before → after.** 1366×768: 323 → 215. 1768×900: 378 → 252. 1920×1080: 481 → 303. 2560×1440: 690 → 360. Each new value is 2 × pad.
- **Pin frames.** start, mid, open, end and release sit at the same pixel positions.
- **Rhythm at 1920×1080.** map → companies is 333. The other hand-overs are seasons → map 327 and companies → wall → contact → footer 301–303. At 1366×768 the same hand-overs measure 245 for map → companies, against 215–245.
- **Hit tests.** Same as before: the cards win at the pin start, and the header probe finds the photo.
- **Phones.** In `#companies`, 2 of 149 computed styles differ. Both are `.rv-line` going from an identity matrix to `none`. That comes from the chrome agent's `clearProps` in `reveal.ts`, not from this section. Section tops are identical.
- **Reduced motion.** 0 differences.

**The "left open" case was real, and is now fixed in `companies.css`.**
- **The problem.** In short, wide windows the centred copy block is taller than the leaf, so the eyebrow comes first, above the leaf. The leaf-only pull then left the eyebrow too close to the cards. Against a target of 2 × pad = 192:
  - 1920×600: 139
  - 1920×680: 157
  - 1600×620: 165
  - 1366×580: 177
  - 2560×700: 165 (target 196)
- **The change.** The pull now uses the higher of two tops:
  - the leaf's top (unchanged);
  - the copy block's top: `50vh − (1.6 × eyebrow size + stage copy gap + 1.96 × title size) / 2`. The two-line title's box measures 1.96 × its font size.
- **Short windows now.** All five sizes come out at exactly 192 (196 at 2560×700). The leaf sits 220–244 below the cards. See `cmp-now/short-*.png`.
- **Everywhere else, unchanged.** Computed `margin-top` is identical to the leaf-only formula at 769×561, 900×700, 1024×768, 1180×820, 1280×640, 1366×768, 1440×900, 1536×730, 1768×900, 1920×940, 1920×1080, 2560×1440 and 3840×2160. The c5f0a07 and refined screenshots differ by 0.00 % of pixels for every frame at 1366, 1768, 1920 and 2560.
- **Other checks.** Phones and reduced motion are unchanged (`cs-fix/`). `tsc` is clean. No horizontal overflow and no console errors.

### Left open
- Headless Chromium only. I have not checked it on a real monitor or with a classic scrollbar. `100vh` is still the stage height there, so the formula should hold.
- The copy term copies three sizes from this file: the eyebrow's clamp, the stage copy gap and the title's clamp. If any of them changes, update `--cp-copy-top` too. The comment says so.

## Verification (integration round)
An independent verifier checked HEAD dd59afd against 6401b06. The area diff is `companies.css` +25 and one comment line in `companies.ts`; `map.css` and `companies.html` are untouched. Both trees were built into scratch folders and served with `vite preview` (6401b06 on :5636, the current tree on :5637). Every pair below was looked at. Evidence is in `scratchpad/agents/fin-v-companies/`: `cmp/` (before | after pairs), `hand/`, `gaps/`, `hit/`, `cs/` and `phone/`.

**The item is solved.** "Gap" means the cards' bottom to the leaf's top, then to the eyebrow, measured with the hand-over frame (the cards' bottom at 36 % of the screen).

| viewport | to the leaf, before → after | to the eyebrow, before → after | 2 × pad |
|---|---|---|---|
| 1366×768 | 323 → 215 | 349 → 242 | 215 |
| 1768×900 | 378 → 252 | 397 → 271 | 252 |
| 1920×1080 | 481 → 303 | 507 → 328 | 302 |
| 2560×1440 | 690 → 360 | 715 → 385 | 360 |
| 1920×600 | 264 → 244 | 212 → 192 | 192 |
| 900×700 | 294 → 196 | 350 → 252 | 196 |
| 800×600 | 264 → 192 | 308 → 236 | 192 |
| 1180×820, touch | 345 → 230 | 400 → 285 | 230 |

- **Rhythm.** `gaps.mjs`, last content to first content at each section boundary, on the current build:
  - 1366×768: map → companies is 245; the other hand-overs are 215–245.
  - 1768×900: 282, against 252–276.
  - 1920×1080: 333, against 301–327.
  - It now reads as the page's normal spacing.
- **Pin, opening and scrub are unchanged.** The start, mid, open, end and release frames at 1366, 1920 and 2560 put the leaf, eyebrow, title and the body's subtitle at the same pixels as 6401b06. The same holds for the start and open frames at 1768 and 1920×600, and for the start, mid and open frames on the 1180×820 touch tablet. The run only starts earlier on the page.
  - The one visible difference is intended. At the pin start on tall screens, the bottom of the map cards is still in view above the stage: 27 px at 1080 and 150 px at 1440.
- **Hit testing** (`hit.mjs`).
  - At 2560×1440, and at 1920×1080 after a live resize from 1366×768, the visible card bottoms at the pin start return `a.mapsec__card`, and hovering opens the card panel.
  - At the open frame, the header probe's stack is `scrim > img`, with tone "light", the same as before.
  - `.companies__copy` was already `pointer-events: none` in 6401b06, so no text or control lost input. `#map` and `#companies` are both `data-bg="sand"`, so the header tone is the same over the overlap.
- **Nothing else changed on desktop.** The computed-style diff of `#map` and `#companies` at 1920×1080 shows only the intended changes:
  - `display: flow-root` on the section;
  - the banner's `margin-top: -178.8px` and `pointer-events: none`, which the stage inherits;
  - the section is 179 px shorter, and the wall, contact and footer move up by that amount.
  - The `.rv-line` matrix → `none` changes come from the chrome area's `reveal.ts`.
  - Reduced motion at 1920×1080 is identical: there is no pin class, and the eyebrow sits 302 below the cards in both builds.
- **Phones are identical.**
  - Screenshots around `#companies` at 390×844 and 844×390 (isMobile, touch) differ by 0 px from 6401b06.
  - 844×390 does get `companies--pin`, but the rule's `min-height: 561px` excludes it.
  - Computed styles on iPhone 13 portrait and landscape show only the chrome `.rv-line` change and the forest map's time-based label opacities. Section tops and heights are equal.
- **Checks.** No console errors in any run. No horizontal overflow (scrollWidth = clientWidth everywhere). `npx tsc --noEmit` is clean. This area does not touch `/plant`, so the purchase flow was not re-run.
- **Fixes:** none needed.
