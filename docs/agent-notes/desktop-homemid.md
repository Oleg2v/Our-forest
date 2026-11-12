# desktop-homemid — home middle on desktop (seasons strip, workshops, forest map)

Files changed: `src/sections/home/seasons.css`, `src/sections/home/map.css`, `src/components/forest-map.css`,
`src/components/forest-map.ts` (fit only), `src/components/forest-map/art.ts` (exports the road's top).
Screenshots: `/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/desk-homemid/`
(`before/` = build of the tree at the start, `after/` = build with the fixes, the same scroll positions; `S` below = that folder).

## Desktop polish

### What was wrong → what changed
1. **Seasons strip on a tall screen (2560×1440): cards stuck to the top, ~400px of empty season above the ruler.**
   The photos were capped at 520px and the cards at 400px wide.
   - Now the cap grows with the height: `min(max(520px, 46svh), 30vw)`, and the card width is `max(400px, 34svh)`.
     Up to 1080px high nothing changes.
   - Whatever room is left after the cap is split above and below the strip (`--slack`).
   - Card text is `clamp(16.5px, 1.2svh, 18px)`, which is still 16.5px up to 1375px high.
   - At 2560 the photos are now 662×490.
   - `S/before/w2560-00-pin0.png` → `S/after/w2560-00-pin0.png`
2. **End of the pin: an unbalanced or cut final frame.** The end padding was a fixed 2.4 gutters:
   - at 2560, the strip stopped with the heading half off the right edge (in the before the plaque touched the edge);
   - at 1920, the cards sat 134px from the left and 240px from the right;
   - at 1024 (also an iPad in landscape), the first card's title was cut by the right edge.

   Now the strip ends with the three cards centred in the visible width (padding in `%`, so a Windows scrollbar does not
   matter), and the heading has fully left at every width. The gap only grows at 1800px and up, as `(100vw − 3 cards) / 4`.
   The card minimum is 240px, so three fit at 1024. Measured margins at the end: 1024 60/60, 1366 110/109, 1768 142/141,
   1920 180/180, 2560 273/273.
   - `S/before/w2560-02-pin1.png` → `S/after/w2560-02-pin1.png`
   - `S/before/w1920-08-pin1.png` → `S/after/w1920-02-pin1.png`
   - `S/before/w1024-02-pin1.png` → `S/after/e1024-01-pin1.png`
3. **The lowest card button sat 19–23px above the ruler line** (1024–1366; 30px at 1920). The ruler band is now
   `bottom + 40px + clamp(28px, 3.6svh, 52px)`. Measured gaps: 36 (1024), 36 (1366), 40 (1440/1768), 47 (1920), 116 (2560).
   - `S/before/w1366-02-pin1.png` → `S/after/w1366-02-pin1.png`
4. **Ruler captions were small on a big screen.** The season names go from 14px to `clamp(14px, .78vw, 16px)`, and
   "עכשיו" from 12px to `clamp(12px, .68vw, 14px)`. Laptops are unchanged.
5. **Workshops list: the date sat 80px off the weekday above it.** The `<bdi>` of digits is an LTR box that
   stretched in the grid and ran to the left. Now it has `justify-self: start` (≥ 769px), and it also lines up in the
   reduced-motion (thumbnail) layout.
   - `S/before/w1768-03-.seasonsws300.png` → `S/after/w1768-03-.seasonsws300.png`
   - `S/before/r1920-02-.seasonsws200.png` → `S/after/r1920-02-.seasonsws200.png`
6. **Map: the zoom buttons and the legend were glued to the frame.** They sat 16px from the edge and 6px from the printed
   margin line.
   - The inset is now `clamp(16px, 1.5vw, 32px)` on desktop (29px at 1920).
   - From 1440px up, the legend reads a size up (15/18px, more padding).
   - `S/before/w1366-06-.fmapbar160.png` → `S/after/w1366-06-.fmapbar160.png`
   - `S/before/w1768-07-.mapsecparts640.png` → `S/after/w1768-07-.mapsecparts640.png`
7. **A stray wavy line along the map frame's bottom edge.** The drawn moshav road under the plot peeked in as a
   sliver. It was already there at 1366, and the bigger legend room would have brought it in at 1440–1920 too.
   - Change in `fitPlan()`, on desktop only (not touch, not the picker, not full screen): when the legend's room would
     pull the road into the frame, the fit gives back just enough of that room.
   - The legend still clears the fence and "כיתת חוץ" (it sits over the empty field at the plot's bottom-left).
   - `ROAD_TOP` comes from `art.ts`, from the same points the road is drawn with.
   - `S/before/w1366-07-.mapsecparts508.png` → `S/after/w1366-07-.mapsecparts508.png`
8. **Map frame at 2560: a 2512×920 strip of empty fields.** The frame is now `min(full width − margins, 1.3 × --maxw)`,
   which is 15% past the content column on each side. Up to 1920 nothing changes (1872px, as before).
   - `S/before/w2560-06-.fmapbar160.png` → `S/after/w2560-06-.fmapbar160.png`
9. **The four participation cards sat 20–36px inside the column**, so their icons and titles did not line up with the
   heading and the filters. The grid now hangs its inner padding (the room for the hover panel) into the gutter.
   - `S/before/w1768-07-.mapsecparts640.png` → `S/after/w1768-07-.mapsecparts640.png`
10. **Hover card and list captions were 13–13.5px at 1920.** From 1440px up:
    - the hover card is 320px wide with 18/22/20 padding, and its eyebrow and meta lines are 14px;
    - the list's numbers and dates are 14px.
    - `S/before/h1920-02-hover.fmapspot.isfree.png` → `S/after/h1920-02-hover.fmapspot.isfree.png`
    - `S/before/h1920-03-hover.fmapspot.isplanted.png` → `S/after/h1920-03-hover.fmapspot.isplanted.png`
    - `S/before/h1920-06-.fmapbar100.png` → `S/after/h1920-05-.fmapbar100.png`

Kept as they were: the lead's e988eb2 fixes (roots pan cap; the filters 28–44px above the plan).

### Checks
- **Phones are identical.** I dumped rects and computed styles of every element in `#seasons`, `#map` and `.fmap`
  (≈3400) on the before and after builds and diffed them:
  - 0 differences at 390×844 (iPhone 13), 750×342 and 844×390 (landscape, touch), and 768×1024;
  - on /plant (location step), 0 differences on the phone and at 1920 (only the animated glow dots differ, by timing);
  - the map camera matrix is the same on the phone, on the landscape phone and in the /plant picker.
  - Phone screenshots `S/ph/before-phone-*` vs `S/ph/after-phone-*` are pixel-identical apart from the branch's draw-in timing.
  - Every desktop rule is scoped to `(min-width: 769px) and (min-height: 561px)`, to `.seasons--pinned` (never on phones),
    or to `!touch` in TS.
- `npx tsc --noEmit`: clean for my files (and the whole project at the time).
- No console errors and no horizontal overflow at 1024, 1180, 1366, 1440, 1536, 1680, 1768, 1920×940, 1920×1080 or 2560.
- With reduced motion, the static grid is fine.

### Left open / notes
- A touch tablet in landscape at 1180×820 gets the desktop map inset (17.7px instead of 16), so its fit moves by about
  1px. That is intended (it is not a phone).
- **Request to the companies owner:** at 1920×1080 the empty sand between the four participation cards and the companies
  eyebrow "לחברות וארגונים" is ≈ 520px. Of that, 151px is my section's bottom padding; the rest is the companies pinned
  stage's empty top (its content sits ≈ 370px below the section top). Every other hand-over here is 150–330px.
  Screenshot: `S/before/w1920-16-.mapsecparts.png`.
- The strip's start frame on a 2560 screen keeps a wide gap (≈ 400px) between the plaque and the first photo,
  because the heading block is 680px with right-aligned text. I left it: it is the same composition as at 1920.

## Verification

Independent verifier (verify-homemid). Scratch: `/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/verify-homemid/`
(`V` below). Production builds of e9cdfc7 (start of the polish), fa9748d (live) and the working tree, served side by side.

### How
- Desktop, e9cdfc7 vs now, the same scroll positions: the hand-in from the roots, strip start / 25 / 50 / 75 / end, the
  hand-over into the workshops, the workshops, the map heading, frame and bottom, the cards and the hand-out.
  - Sizes: 1024×768, 1180×820, 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×940, 1920×1080, 2560×1440.
  - The map fit also at 1920×700, 1440×620 and 2560×1080.
  - Before-over-after pairs: `V/cmp/<W>-<H>-*.jpg`; measurements: `V/d/*-meas.json`.
- Phones: iPhone 13 (390×844) and landscape (844×390), now vs e9cdfc7 and vs fa9748d, pixel diffs (`V/ph/`, `V/fin/`).
- Perf: the lead's `jank.mjs` / `trace.mjs` (iPhone 13, 4× CPU, DPR 3, 900 px/s), 3 runs each, interleaved.

### Desktop: every claimed fix holds
| | e9cdfc7 | now |
|---|---|---|
| strip end, left / right margin, 1024 | 98 / −38 (card cut) | 60 / 60 |
| 1366 · 1536 · 1768 · 1920 | 132/87 · 134/112 · 135/148 · 135/240 | 110/109 · 123/123 · 142/141 · 180/180 |
| 2560 | 134 / 866 (heading half in) | 273 / 273 |
| lowest CTA → ruler, 1024 · 1366 · 1768 · 1920 · 2560 | 25 · 25 · 33 · 33 · 316 | 36 · 36 · 40 · 47 · 116 |
| filter chips → plan (owner complaint 2) | 28 / 33 / 34 / 37 / 41 / 43 / 44 / 44 px from 1024 to 2560 | unchanged |

- The 2560 strip is no longer top-heavy: the photos grow with the height.
- The workshop dates sit under their weekdays, in the pinned and in the reduced-motion layouts.
- The map frame at 2560 is 1872px and centred; at 1920 and below it is unchanged.
- The legend and the zoom buttons breathe.
- The road band at the frame's bottom (1366) is gone. On short or wide windows (1920×700, 1440×620, 2560×1080) the legend still clears the fence and "כיתת חוץ".
- The cards line up with the heading's edge.
- Hover cards: 320px wide, kept inside the frame at all four edges.
- Owner complaint 1 (roots → seasons): the lowest roots captions keep ≥ 80px above the seasons panel at 1768×900 and 1920×940.
- Nothing else changed or broke in the pairs.

### Phones: unchanged where the polish touched
- now vs e9cdfc7, 390×844 and 844×390: the 10 positions are identical except ≤ 0.07% of pixels in the branch's leaves
  (the pop-in's timing) and one photo's swipe parallax.
- now vs fa9748d: the same, plus anti-aliasing specks on the map (≤ 0.01%).
- The phone map intro (layers fading in, no line drawing) is the named simplification.
- `/plant` picker: the camera matrix is identical in all three builds, on the phone and at 1920 (`V/pk/`).

### Phone scroll performance (measured in headless Chromium; WebKit points by reasoning)
The machine was shared (load average 15–30 on 4 CPUs), so fps varies ±50% between runs. The CDP time totals are steadier.

- **Area only.** One snapshot of the tree, with only this area's files swapped back to fa9748d, vs the tree as it is.
  - Seasons, 1900→4100 px: fps 22.4 → 27.6; script 0.42 → 0.26 s; style 0.36 → 0.32 s; long tasks 1004 → 638 ms.
  - Map, 3900→6000 px: fps 22.1 → 30.8; style 0.31 → 0.20 s; script 0.34 → 0.28 s; long tasks 692 → 563 ms.
  - Seasons-only traces (1900→3300): JS 741 → 462 ms, rAF callbacks 624 → 312 ms, style 307 → 262 ms; layout the same (43 → 42 ms).
  - **But layout went up** in the seasons range: 0.04 → 0.16 s (and 0.05 → 0.29 s against fa9748d).
- **Found and fixed: a new 40–50 ms layout in the scroll towards the map.**
  - The map's text list (≈ 1 600 elements, visually hidden but laid out) is filled at idle while the slot is skipped
    (`content-visibility: auto`). So its style and layout ran only when the map came near: one Layout of 2 641 objects,
    38–53 ms at 4×, inside a scroll frame (traces `V/perf/tr3-*`, `tr4-*`).
  - Fix in `forest-map.ts` `fillList()`: the list is filled with the slot held awake (`awake()`) and laid out right
    there, in the idle callback.
  - After the fix, the approach range (2600→4200) has no layout above 11 ms; the layout total went from 77–112 to 42–56 ms.
  - `content-visibility` itself stays: page-wide restyles still skip the map while it is far.
- **Whole range, fa9748d (live) vs the tree with the fix** (1900→6000):
  - fps 26.1 → 36.4; p90 frame 66.7 → 49.9 ms; frames over 50 ms 20 → 9;
  - long tasks 1456 → 592 ms; script 0.72 → 0.51 s; style 0.70 → 0.56 s; layout 0.07 → 0.06 s.
- **Not measured here.** The paper raster (instead of an feTurbulence SVG), the compositor-only intro fade and the
  fixed photo background are WebKit costs that headless Chromium does not show. They still need a check on a real iPhone.
- The desktop polish adds no per-frame work: CSS only, plus ≤ 4 `fitState()` calls on fit and resize.

### Behaviour
- Keyboard at 1768: plaque → the three CTAs → the four ruler ticks → workshop rows. Each focused card is brought on screen
  with a visible ring (`V/kb/`). The map bar → spot → card CTA → zoom → cards order is unchanged.
- Map: hover cards, zoom, the species filter and the list view work at 1920. On the phone, the list is filled (170 entries)
  with no tab stops until "רשימה" is pressed (48 then), and a tap opens full screen.
- Reduced motion (1768): the static grid is fine.
- No console errors and no horizontal overflow at any size; `npx tsc --noEmit` is clean.

### Left as is (minor)
- 769–1100px (2 columns): with the cards hung into the gutter, the rule between the two rows runs ≈ 23px past the text
  column on each side (it matches the map frame's width instead).
- The workshop weekday stays 14px at 1920 (an eyebrow over a 26px date).
- The 2560 start frame keeps a ≈ 410px gap between the plaque and the first photo (noted above).

### For others
- Companies (homelow), measured at 1920×1080: the participation cards end 415px from the top of the viewport, `#map` ends at 566 (its 151px
  section padding), and the first companies text (the eyebrow) sits at 922. That is ≈ 507px of empty sand, against
  150–330px at the other hand-overs. Most of it is the companies pin's empty top (≈ 356px), so the fix belongs there.
