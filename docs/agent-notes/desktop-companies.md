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

### Left open
- Headless Chromium only. I have not checked it on a real monitor, or with a classic scrollbar, where `100vh` is still the stage height, so the formula holds.
- The formula follows the leaf. At every measured size the eyebrow is at or below the leaf's top (at 1280×640 it is 7 px below). Below ~600 px of height, a large title could put the eyebrow a few px above the leaf, which would make the gap a few px under 2 × pad. I did not measure this.
