# desktop — /plant (configurator, done view)

## Desktop polish

Audited 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×1080, 1920×940, 2560×1440, 1024×768 and 1180×820, across:
- all 8 steps, including the open map;
- bench, workshop and corner;
- the plaque focus;
- the done view.

Every fix is in `src/plant/plant.css` (one block at the end, `min-width: 769px` or wider, every height-dependent rule with `min-height: 581px`) plus the desktop branch of the map reveal in `src/plant/steps-choose.ts`. Global tokens are unchanged.

Before/after pairs (same viewport, same position; left = before, right = after) are in `scratchpad/agents/desk-plant/pairs/`. The single shots are in `d0/` (before) and `d1/`, `d2/` (after).

| what was wrong | where | fix | pair |
|---|---|---|---|
| The stage card ended 8 px above the window bottom, glued to the edge | every window 768–1000 px tall (1366×768, 1440×900, **1768×900**) | Stage height leaves `clamp(24px, 3.2vh, 40px)` below it (29 px at 900 px tall) | `stage-gap-1768x900-before-after.png` |
| The configurator floated in the top two thirds: the stage stopped at 900 px, the tree at 443 px, and 440 px of empty cream sat below | 2560×1440 | `max-height: clamp(900px, 46vw, 1180px)` (unchanged up to ≈ 1950 px wide, 1178 px at 2560); the art can grow to `clamp(443px, 21vw, 540px)`; the map picker gets `clamp(380px, 36vh, 520px)` on windows ≥ 1200 px tall | `stage-2560x1440-before-after.png` |
| Captions too small on big screens: rail labels 13 px, the season line 13.5 px, the stage's recap labels 13.5 px, card and extra texts 14.5 px, the seats / count / demo note at 14 px | 1920 and up | `clamp(…, ~0.8vw, 15–16.5px)` from 1280 px, so they grow with the window: rail 15 px and recap 16 px at 1920. The season line may use 90 % of the stage so it stays on one line. Card texts use `text-wrap: balance` (no lone last word) | `type-1920x1080-before-after.png` |
| The gift's fields column was too narrow: the "מתי לשלוח?" chips broke 2 + 1 | 1366–1920 | From 1280 px the grid is `1fr / minmax(240px, .66fr)`: the fields get the room and the envelope stays a postcard. The three chips sit on one row | `gift-1920x1080-before-after.png` |
| Payment: "משלמים 540 ₪" and "חזרה" were stacked on the right, one under the other, while every other step has back on the right and the primary action on the left of one row | ≥ 1024 | The pay button sits at the row's end (left), and the nav rises into its row (`margin-block-start: -68px`, its empty alert hidden). Same order, same buttons, same focus behaviour | `checkout-1920x1080-before-after.png`, `checkout-1366x768-before-after.png` |
| After "בוחרים על המפה", the page scrolled the options to just under the header — past the end of the steps. The sticky stage was pushed up, its top cut by the window, and the step title cut too | 1366×768, 1024×768 (any window too short for the map) | The reveal scrolls only as far as the map and the step's buttons need: `min(options under the header, nav end + 24 − window)`. A landscape phone keeps the old move | `map-reveal-1366x768-before-after.png` |
| The done view was 1240 px wide inside the 1440 px column: its title ended 100 px short of the header's right edge | 1920 and up | `width: min(100% − 2 × gutter, var(--maxw))` — the title now lines up with the header | `done-1920x1080-before-after.png` |

### Checked
- **Phones unchanged.** iPhone 13 at 390×844, all 8 steps plus workshop, bench, corner, the open map and the done view: sheet top and end, against e9cdfc7. The worst diff is 36/255 over 0.02 % of pixels (text antialiasing), apart from animation timing and the 1 px plaque-step scroll end, which comes from the perf change (perf-plant.md). A landscape phone at 844×390 is identical (max 25/255).
- **No horizontal overflow and no console errors** at any of the listed sizes. Reduced motion at 1920 (steps and the done view) is fine.
- **Purchase flows still complete** (`buy.mjs`) on desktop and phone, with reduced motion, with a map spot, and for bench and workshop.
- `npx tsc --noEmit` is clean.

### Left as is
- Short steps (occasion, plaque, summary) end around the middle of the window, while the stage runs to the bottom. That is the layout of a configurator (the stage carries the total and the buy button). Pinning "הבא" to the bottom would leave a bigger hole above it.
- At 1768×900 the species step's "הבא" is just below the fold. The stage's "ממשיכים לתשלום" is in view, so I did not change it.
- At the very end of a page scroll, the stage is pushed up by the end of the steps (normal sticky behaviour). It now rests about 8 px higher than its sticky place, never cut.

## Verification

Independent check of the desktop polish and the phone perf pass for /plant, by the area verifier. Scratch: `scratchpad/agents/verify-plant/` (pairs in `d/P` = e9cdfc7 vs polish, `d/Q` = polish vs polish + verifier fixes, phones in `m/`).

### Method
- **Desktop.** 16 states (8 steps, the open map, the plaque focus, payment with errors, card errors, the done view, bench, workshop, seats, corner), top and end of each step, at 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×1080, 1920×940, 2560×1440, 1024×768 and 1180×820.
- **Baselines.**
  - e9cdfc7 (= fa9748d for the area files).
  - An isolated worktree: e9cdfc7 plus the current plant files, so the pairs show only this area's changes.
- **Phones.** iPhone 13 at 390×844 and 844×390, DPR 1. All 8 steps plus bench, workshop, seats, corner, memorial, the open map and the done view, at the top and the end of the sheet. Compared both against e9cdfc7 and against fa9748d.
- **Perf.** Production builds, iPhone-13 emulation, DPR 3, 4× CPU. A/B runs interleaved, 3 rounds, medians. The 4 CPUs were shared (load average 17–22), so fps moves ±5 between runs.

### The polish: confirmed
- **Stage gap.** The stage is 29 px off the window bottom at 1768×900 (was 8 px).
- **2560×1440.**
  - The stage is 1178 px tall and the tree is bigger.
  - The steps column still ends near 1010 px. That is the configurator's own length, and it is acceptable.
- **Big-screen type.** Rail labels are 15 px and recap lines 16 px at 1920.
- **Gift chips.** They sit on one row from 1280 px.
- **Map reveal.** At 1366×768 and 1536×864 the stage is no longer cut at the top.
- **Done view.** Its title lines up with the header.
- **No leaks to phones or tablets.**
  - Portrait phone: every frame matches e9cdfc7 within 66/255 over ≤ 0.1 % of pixels. The only differences are animation timing (the envelope, the stamp) and the plaque step's sheet, which ends 1 px higher (from the perf rounding).
  - Landscape phone: identical, apart from the footer letters' timing.
  - Against fa9748d the result is the same: no visible change on phones.
- **Checks.** No console errors. No horizontal overflow from 769 to 2560 px.
- **The owner's two complaints** (the roots block and the map chips) are not in this area.

### Found and fixed (plant files only)
1. **The step's buttons were sliced by the bottom of the window** at the owner's sizes. This was not caught by the polish, and the bigger rail labels made it 4 px worse.
   - Where it happened:
     - 1920×940: the first step's "הבא" showed only a 6 px sliver, and the bench step's button was cut by 4 px.
     - 1366×768: the summary step.
     - 1440×900, 1768×900 and 1920×940: the payment row ("משלמים 540 ₪" + "חזרה") was cut or touching the edge.
   - Any static layout leaves some band of window heights where this row is cut, so the row is now **sticky at the bottom of the window** on desktop (`.pc__nav`, from 769 px with height ≥ 581).
     - It sits on cream, under its line.
     - Its button lines up with the stage's bottom edge (`--pc-nav-pb`).
     - Where the step fits the window it simply stays in place.
2. **Payment from 1024 px.** "משלמים" is now the row's own primary button, as on every other step and in the phone bar.
   - The form's submit is hidden from 1024 px. It stays below 1024 px and on phones.
   - The button keeps the size of `.btn--lg`.
   - While paying it shows "מעבדים את התשלום…" with `aria-disabled`.
   - This replaces the polish's −68 px overlap trick, which could not be sticky: the form's transforms during the shake and the entry animation trapped the button under the row.
   - Focus order is now back → pay, the same as the other steps.
   - Click, Enter in a field, reduced motion, and 1000 px (form button) all complete the purchase. The done view gets focus.
3. **Map reveal.** It is measured from the panel's end, not from the nav's box, which is now sticky. It now also scrolls when only the caption and the buttons are below the fold.
   - At 1768×900 and 1920×940 the caption under the map used to sit on the window edge and "הבא" was hidden.
   - Now the map, its caption and the buttons come into view.
4. **Keyboard focus.** Tab's own scroll stops at the window edge, which is under the sticky row. A small `focusin` handler moves a control that lands under the row up above it. I measured it at 1366×768 on the species, gift and checkout steps.
   - A `scroll-padding` attempt made Chrome jump the page when tabbing onto the sticky button, so it was dropped.
5. **Cookie banner.** On a first visit at 1366×768 it covered the sticky "הבא". `.pc__next` now has `data-cookie-avoid`, so the banner sits above the row. Phone placement is unchanged.
6. **Tablet edge, 769–790 px.** "הבא · מה מקבלים" did not fit beside "חזרה": it stuck out 28 px, against the stage. This predates the polish. Up to 900 px the button now says "הבא" only, and the rail names the next step.
7. **Species card text at 16 px** (≥ 2000 px wide) wrapped the fig card onto 2 lines. That made the first row 23 px taller than the second. It is now capped at 15.4 px, and the rows are equal again (222 px).
8. **Memorial (perf).** The plaque step's wood texture is made ahead for the warm tone only.
   - Picking "לזכר" on the occasion step brought back the 1440×599 texture build inside the step change. I confirmed this by logging every texture made, at step "plaque".
   - It is now made ahead again whenever memorial switches on or off, and the texture-making log shows it at idle.

### Perf: fa9748d (live) → now, production builds, medians of 3
| scenario | A live | B now |
|---|---|---|
| Sheet scroll, species step (4 sweeps) | 55.3 fps, worst 67 ms, script 0 | 51.4 fps, worst 117 ms, script 0.1 s |
| Map open, then sheet scroll | 52.5 fps, long tasks 76 ms | 56.0 fps, none |
| Occasion → plaque while swiping | 35.2 fps, worst 1117 ms, longest task 1076 ms | 52.9 fps, worst 83 ms, longest 80 ms |
| Species change while swiping | 49.5 fps, worst 100 ms; style/layout/JS 185/62/617 ms | 47.1 fps, worst 167 ms; 126/45/416 ms |
| Pay → done, scrolling | worst 833 ms, longest 770 ms; after the wait: worst 833, dropped 119 | worst 617 ms, longest 558 ms; after the wait: worst 150, dropped 47 |
| First 7 s after load | longest task 1595 ms, sum 1918 ms | longest 891 ms, sum 2418 ms (the plaque-step texture made ahead at about 4–5 s) |

- Sheet scroll is noise: neither version does page work during it.
- **Plant-only builds** (e9cdfc7 vs e9cdfc7 + plant files), species change:
  - forced `getScreenCTM` 34–70 ms → 0;
  - fps 38.8 / 44.6 → 46.3 / 51.4.
  - The plantDraw plugin is a real gain. The lower species fps in the live-vs-now table comes from outside this area or from noise; the area's own work went down.
- **Claims:**
  - Plaque step and plantDraw: confirmed.
  - Payment: partly. The worst frame after the wait improved, but the PNG is still a 0.5 s task at 4×, now inside the "processing" wait.
  - Load: the longest task halved, but the total long-task time in the first 7 s is about 0.5 s higher, because the texture made ahead runs then. It is an idle-time task that a tap can collide with.
- **Not measured on a real iPhone.** The claim that WebKit scrolls the sheet in the UI process, so only main-thread work under the finger matters, is reasoning.

### Still open
- On a step taller than the window, the sticky row covers the bottom of that step's content until you scroll. Examples: the second row of species at 1366×768, the payment's WhatsApp line at 1440×900. That is how a sticky bar behaves, but it is a design change from the old in-flow row, so it is for the lead to judge. To undo it, remove the `.pc__nav` sticky rules in plant.css; the payment button change does not depend on them.
- The phone plaque-step texture made ahead costs about 1 s at 4× CPU (about 250 ms on a mid Android), about 4 s after load. It runs again once more if memorial is chosen. A visitor who never reaches the plaque step pays for it anyway.
- **forest-map** (not this area): in the picker, "לוחצים על המפה כדי לטייל בה" sits on top of the map's title "היער שלנו · מושב פדיה". This shows at every desktop size while the pointer is over the map, and the legend chip covers the "כיתת חוץ" label.
- Tablet 769–1023: the payment step keeps the stacked pay / back buttons, as before. They are not sticky there.
