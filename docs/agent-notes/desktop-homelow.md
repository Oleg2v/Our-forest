# desktop-homelow — home lower (companies, wall, contact) + the site footer on wide screens

## Desktop polish

**How I checked.** I compared the e9cdfc7 baseline (a build in scratch, port 5422) against the working tree (no-HMR dev server, port 5421). I scrolled gradually through every block in my area at these sizes: 1024×768, 1180×820, 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×1080, 1920×940 and 2560×1440.

- **Companies:** the pin's start, middle, open state, end and hand-over.
- **Wall:** the band, the story slots and the CTA.
- **Contact:** the form, and the thank-you after sending.
- **Footer:** the footer on `/`, `/plant`, `/business`, the 3 legal pages and `/credits`.
- **Interactions:** the card / logo chip / wall-row hovers, and the seed being planted.
- **Reduced motion:** at 1920.

I looked at every PNG. All files are under `scratchpad/agents/desk-homelow/` (`before/`, `after/`, `cmp-*.png` = before above or beside after).

### What was wrong → what changed

All changes are CSS, in blocks gated by `(min-width: 769px) and (min-height: 561px)`, the site's convention, so landscape phones are excluded. One rule is in a `(min-width: 1101px) and (min-height: 561px)` block.

1. **«הלוגו שלכם כאן?» wrapped onto two cramped lines** (1101–~1250px; seen at 1180).
   - Cause: the dashed chip had a sixth of the row.
   - Fix: above 1100px the marks grid is `repeat(5, 1fr) max-content`, and the chip is `nowrap` with viewport-scaled padding.
   - `cmp-1180-logos.png`
2. **Tablet logos (769–1100):** the label «שותפים» floated between the two rows of marks, and the chip stretched across a whole third of the row.
   - Fix: the label is now as tall as one row of marks (64px) and sits on the first row; the chip keeps its own width and is centred.
   - `cmp-1024-logos.png`
3. **The companies eyebrow «לחברות וארגונים» got lost.** It was 14px over a full-screen photo beside a ~150px title (1768 / 1920).
   - It is now `clamp(var(--fs-eyebrow), .95vw, 18px)`: 17px at 1768 and 18px at 1920. It is unchanged at ≤1470px and never falls under the a11y-scaled token. Its rule grows to 64px.
   - The «שותפים» label is `clamp(token, .82vw, 16px)`.
   - `cmp-1768-03-companies160vh.png`, `cmp-1920-eyebrow.png`
4. **Small type on big screens** (the owner's bar: captions under ~14px at 1920). Each value is a `clamp()` whose minimum equals the old value, so nothing changes below ~1600–1700px.
   - Package cards (text, «החל מ־», unit, «מידע נוסף», numbers).
   - Wall signatures: 13px → 15px in row b, 14px → 16.3px in row a. Also the map note, the story-slot labels and the numbers.
   - Contact: «שדות חובה» and the demo note.
   - Footer: tagline, links, place, the seed hint and the legal row.
   - `cmp-1920-06-companiespacks-150.png`, `cmp-1920-10-wallband-150.png`, `cmp-1920-16-99999.png`
5. **Wall: the map note and the pause button sat 18px under the rows' rule**, cramped next to the band's 112–136px margins.
   - It is now `clamp(18px, 1.6vw, 30px)`: 28px at 1768.
   - `cmp-1768-10-wallband-150.png`
6. **Reduced motion: the wall's wrapped rows ran edge to edge**, ~35px from the screen sides at 1920.
   - The static track now keeps to the content column: `min(100% − 2·gutter, maxw)`, centred.
   - `cmp-r1920-wall.png`
7. **Contact: the browser's resize grip** drew two diagonal scratches on the corner of the message field's underline (every desktop width).
   - Where `field-sizing` exists, the field grows with its text instead: 101px (= rows 3, same height as before) → up to `max(220px, 36vh)`, then it scrolls. `resize: none` applies only there; in Firefox the grip stays.
   - `cmp-1920-contact-panel.png`

### Checked, no change needed
- **Companies pin:** the leaf opening, the colour flip of the title, the end of the pin and the hand-over into the body, at all sizes. Nothing is clipped, and nothing sits under the header (the eyebrow is ≥ 140px from the top).
- **Hand-overs** map → companies → wall → contact → footer. They are all two `--section-pad`s (~300px at 1080), the same rhythm as the rest of the page.
- **Contact:** the panel padding and the send button vs the leaf corner (≥ 35px clearance at 1180–2560). The thank-you is centred in the held panel.
- **Footer on every page:** CTA → letters ≥ 34px after planting. There is no horizontal overflow and there are no console errors at any size (scrollWidth = clientWidth in every log).
- `npx tsc --noEmit` is clean.

### Phones are unchanged (e9cdfc7)
- **Computed styles of every element** in `#companies #wall #contact #footer` (padding, margin, size, font, grid, gap, resize, …), after scrolling the whole page. The baseline build and the working tree have 0 differing elements:
  - iPhone 13 portrait: 0 of 455;
  - iPhone 13 landscape (844×390): 0 of 476;
  - portrait with reduced motion: 0 of 455.
  - The same check at 1920 shows 123 differences, so the check works.
- **Section tops and heights at 390×844** are identical.
- **Pixel diff** of 8 phone screenshots: 0px everywhere except the moving marquee and the swaying footer letters (time-dependent animation). See `phone/`, `cmp-phone-diffs.png`.

### Left open / for others
- **2560×1440:** every section sits in the 1440px column, with headings capped (companies 156px, wall 88px). The page reads small on a 27″ screen. That is a global `--maxw` / type-scale decision (see the request in my report). I did not change it locally, to keep the sections consistent.
- **The site header** (chrome) slides back in over the footer's link block whenever the page scrolls up at the very end on short screens (1536×864, 1920×940). This is standard hide-on-scroll behaviour, noted only.

## Verification

Independent check of the desktop polish (vs `e9cdfc7`) and of the phone scroll-perf work (vs `fa9748d`, live).
Scripts, logs and screenshots are in `scratchpad/agents/verify-homelow/`. In a `P-*.png` file, the left half is before and the right half is now.

### Desktop: the polish holds, and nothing else moved
- **What I compared.** Before/after pairs at the same scroll positions, at 1024×768, 1180×820, 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×1080, 1920×940 and 2560×1440. Each set has 12 positions: the map→companies hand-over; the pin's start, middle, open state and hand-over into the body; packs, logos, wall band, slots, contact panel, footer and page end (`d<W>x<H>/`). The footer was also checked at 1920 on /plant, /business, the 3 legal pages and /credits (`f1920-*`), and reduced motion at 1920 (`r1920/`).
- **All 7 claimed fixes are visible and correct:**
  - the one-line logo chip at 1180;
  - the tablet label on the first row, with the chip at its own width (1024);
  - the larger eyebrow at 1768/1920;
  - scaled captions (nothing under 14px at 1768/1920; the smallest at 1768 are 14.1px for the row-b signatures and «שדות חובה», and 14.5px for the legal row and «שותפים»);
  - 28–30px under the band;
  - reduced-motion rows inside the content column;
  - no resize grip. The field grows 101 → 340px, then scrolls.
- **Nothing outside these rules changed.** At 1366 the computed-style diff of every element in `#companies #wall #contact #footer` shows 18 elements, all from the intended rules: the chip width (marks columns 159.6 → 161.6px), the band-foot padding (18 → 21.9px), the label min-height and the textarea (+0.5px). Section heights move only by the type scaling (+4 to +25px at 1920–2560).
- **No overflow, no errors.** There is no horizontal overflow and there are no console errors at any size.
- **The owner's two complaints** (roots pan, map chips) are not in this area. The companies pin releases without slicing anything: the photo leaves as one piece, then the body follows after `--section-pad`.

### Missed of the same kind, fixed here (desktop rules only)
- **Wall band foot:** «עצירת התנועה» stayed 14.5px on the same row as the 16.3px map note. It is now `clamp(14.5px, .85vw, 16.5px)` (`wall.css`).
- **Footer reach:** the «וואטסאפ» button (15px) was smaller than the address under it (16.3px at 1920). It now uses the same clamp (`footer.css`).
- **Checks after the fix** (`fix1920/`, `fix1768/`, `fix-band.png`, `fix-foot.png`):
  - nothing changes at ≤ 1765px;
  - phones are still identical to e9cdfc7 (computed-style diff: 0 of 424 portrait, 0 of 422 landscape).

### Phones
- **The desktop polish does not reach phones.** Computed-style diff now vs e9cdfc7: 0 of 424 (390×844), 0 of 422 (844×390), 0 of 389 (reduced motion).
- **Now vs fa9748d:** the only computed difference is the new `site-footer--inview` class.
  - Screenshots at 12 portrait positions and 8 landscape (pinned, touch → ViewTimeline) positions differ by 0–1.3%. The differences are only the marquee position in time and the clip edge mid-scrub.
  - Row heights and the opening frames match.

### Phone scroll performance
**Setup:** `jank.mjs` with iPhone 13, DPR 3, 4× CPU and 900 px/s. Production builds were served with `vite preview`. Each comparison is 3 interleaved runs; the table shows medians. Headless Chromium shares the CPU with other agents, so compare only within a batch.

| range | A fa9748d → B now (whole tree) | C (now, this area's files at fa9748d) → B |
|---|---|---|
| companies 5600→8700 | fps 32.0 → 38.4, worst 233 → 167 ms, long tasks 934 → 553 ms, style 0.91 → 0.53 s | fps 48.9 → 55.6, worst 133 → 83, long 314 → 102, style 0.65 → 0.50, layout 0.08 → 0.04 |
| wall 8000→10200 | fps 31.6 → 44.1, worst 317 → 117, frames > 50 ms 8 → 2, long 884 → 166, style 0.75 → 0.47 | fps 44.0 → 47.0, worst 167 → 117, long 512 → 125, style 0.63 → 0.52 |
| contact + footer 10000→11850 | fps 32.1 → 52.7, worst 167 → 67, long 650 → 0, style 0.40 → 0.13 | fps 50.7 → 55.1, worst 100 → 83, script 0.23 → 0.15, layout 0.04 → 0.02 |

**Measured:**
- **The claimed gains hold in direction.** This area's own share (C → B) is smaller than in the perf report, because the rest of the tree has improved meanwhile.
- **Layers:** the 13 045 / 14 821 px wall tracks are gone. Phone layers went 65 → 50 and area 66 → 54 viewports.
- **No new costs.** In the B trace of the wall range, this area's own script is about 3 ms (`tick`, `sync`). The per-frame flush lands in `header.ts` onScroll (chrome, a deliberate shared read).
- **Marquee coverage:** 40 samples at each of 1366, 1768, 1920 and 2560, with live resizes, showed no gap at the row edges.

**By reasoning (iOS WebKit, not measurable here):**
- The ViewTimeline offsets use `innerHeight` at build. When the iOS toolbar collapses, the opening's start/end shift by a few percent: the stage is 86svh, so the ResizeObserver does not rebuild. The frames stay correct.
- The 390×5923 `companies__copy` "Overlap" squashing layer exists in A as well. It is Chromium-specific and was not chased.

### Behaviour
- **Keyboard:** the Tab order runs cards → «הלוגו שלכם כאן?» → CTAs → wall link → pause → wall CTAs → contact aside → fields → consent → send → footer links → seed → legal → credits. Every stop is in view. Links and buttons show a 2px outline; fields use their own ring.
- **Contact:** submit leads to the thank-you, centred in the held panel (`beh/t1768-thanks.png`).
- **Footer:** dragging the seed plants it and the CTA appears (`beh/b1920-planted.png`).
- **Reduced motion toggled at runtime:** the wall goes live → static → live and moves again; companies goes pin → static → pin. No errors.
- `npx tsc --noEmit` is clean.

### Still open
These are all for others, or not worth a local change:
- the 2560 column and type caps, and the `--fs-eyebrow` token (lead, as the polish report asks);
- the Firefox resize grip;
- the footer top's ~600px gap between brand and links at 1920 (a common pattern, left as is);
- on 1366–1470 laptops the companies eyebrow over the photo stays at the 14px token.
