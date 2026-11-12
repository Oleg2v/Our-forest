# desktop-global — global chrome on wide screens

Area: header, menu overlay, cookie card, a11y panel, custom cursor, focus ring, skip link, page transition,
reveals, base typography. Files touched: `src/chrome/chrome.css`, `src/chrome/cookies.ts`, `src/chrome/cursor.ts`,
`src/chrome/focus.ts`, `src/styles/base.css` (skip link only). No tokens changed.

## Desktop polish

Every rule is behind `@media (min-width: 769px) and (min-height: 561px)`. Each TS change is behind the same
`matchMedia` check, or runs only for a fine pointer (the cursor). So portrait phones (≤ 768) and landscape phones
(≤ 560 tall) do not change.

Screenshots are in `/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/desk-global/`.
Below, `before/` and `after/` mean folders inside it.

### What was wrong → what changed

1. **The cookie card covered or touched the home hero text.**
   - At 1366×768 it covered the last line of the hero paragraph («ערך אמיתי.»).
   - At 1768×900 (the owner's screen) it sat 2 px under that paragraph. At 1920×1080 the gap was 15 px.
   - It also hugged the screen corner (56 px in, 20 px up) instead of the content column. At 2560 it sat 500 px outside the column.
   - Its text was 13 px and its padding was 10 px.

   What changed (`cookies.ts`, wide screens only):
   - Running text near a slot now costs a little. A block next to the card costs 0.1. On top of that, it costs up to 2 more, depending on how much of the block the card hides.
   - Text is measured where the text actually is (a Range over the block), not by its block box.
   - A top slot with nothing under it now costs 0.05 instead of 1.5.
   - A corner over a link still costs more than a corner next to text. So pages where the card was fine keep their slot: terms/privacy/accessibility keep the bottom-left corner, /plant and 404 keep the bottom-right.
   - On the home hero, at every width from 1180 to 2560, the card now rests under the header at the reading start, over the sky.
   - /credits now uses the top slot (it covers the breadcrumb, not the photo credits).
   - On /business the card now sits bottom-left under the photo, not on the paragraph.

   CSS:
   - The card lines up with the header's content column: `max(gutter, (100% − maxw)/2)`.
   - It sits `clamp(24px, 2vw, 36px)` above the bottom edge.
   - Text is 14 px (`text-wrap: balance`), padding 13/20/14, gap 18, leaf radius 24.

   Before: `before/cookie-home-{1366x768,1440x900,1768x900,2560x1440}.png`, `before/cookie-{terms,404,plant}-1768x900.png`, `before/cookie-terms-2560x1440.png`.
   After: `after/cookie-home-{1024x768,1180x820,1366x768,1440x900,1768x900,1920x1080,2560x1440}-x.png`, `after/cookie-{terms,404,plant,credits,biz,tree}-1768x900-x.png`, `after/cookie-terms-2560x1440-x.png`, `after/cookie-{biz,credits,privacy,plant}-1366x768-x.png`.

2. **The custom cursor went invisible after a wheel scroll.** Its colour was re-probed only on pointer move.
   - Hover the hero, then scroll the wheel: the ring stayed cream on every cream/sand section.
   - Home 1920 sweep: 35 of 60 wheel steps had a ring the same tone as the background. Example: `before/cursor-after-wheel-1920.png` is an empty crop where the cursor should be.
   - It also stayed dark over the moss menu when the menu was opened with a click.

   What changed (`cursor.ts`):
   - The tone is re-probed on scroll (at most every 240 ms, plus once when the scroll settles).
   - It is also re-probed after `menu:*`, `modal:*` and `theme:section`.
   - After: in the same sweep, no plain ring was left that matched the background. The only mismatches the probe still flagged are the cream-filled «גלו» label over photos, which is visible, and one probe taken while the smooth scroll was still moving.
   - The ring is cream over the open menu: `after/menu-biz-1024x768-x.png`.

3. **The a11y panel was detached from its button.** On a 1920 screen it opened 56 px from the screen edge, about 470 px away from the a11y icon, which is on the column edge.
   - It now hangs from the column edge, under the header tools.
   - It is 412 px wide with 26/30/22 padding and a little more room between rows.
   - Before: `before/a11y-biz-1920x1080.png`. After: `after/a11y-biz-1920x1080-x.png`, `after/a11y-terms-{1024x768,1366x768,2560x1440}-x.png`.

4. **The header's buttons were glued together.** There was a 6 px gap between «צרו קשר» and «נוטעים עץ משלכם» (and the icons).
   - The gap is now `clamp(8px, 0.7vw, 14px)`.
   - From 1680 up, the nav is 16 px (17 px from 2200) and the header pills are 15.5 px (16 px from 2200), because the type was small against a 1920–2560 screen.
   - Tooltips are 14 px with more padding.
   - A check with larger a11y text (levels 1 and 2) at 1380–2560 found no overlaps.
   - Before: `before/header-{top,compact}-allwidths.png` (1024 → 2560, stacked). After: `after/header-{top,compact}-allwidths.png`.

5. **The compact header was a moss strip over the soil roots.** Over dark sections the glass now takes the section's own colour: `color-mix(page-bg 86%)`, fine pointers only, not in high contrast. Over photos and light pages it keeps the moss/cream glass.
   - Before: `before/header-over-roots-1920.png`. After: `after/header-over-roots-1920.png`, `after/header-sweep-home1920-{a,b}.png`.

6. **The focus ring hugged nav and text links.** It had 5 px of air left and right but about 20 px above and below.
   - Text links with no box of their own (no border or background, inline padding < 4) now get 6 px more on each side.
   - Icon buttons keep their circle. Pills are unchanged.
   - Before: `before/focus-header-1920.png`. After: `after/focus-header-1920.png`.

7. **The menu foot sat 22 px from the bottom edge.** This is the menu on tablets and small laptops, and with larger a11y text.
   - Bottom padding is now `clamp(28px, 5vh, 56px)`, the foot gap is 22, and «יער מאכל · מושב פדיה» is 14 px.
   - Before: `before/menu-biz-{1024x768,1180x820}.png`. After: `after/menu-biz-{1024x768,1180x820}-x.png`.

8. **The skip link sat 16 px from the screen corner.** On wide screens it now sits on the gutter.

### Checked
- `tsc` is clean for `src/chrome`, `src/core` and `src/styles`. A production build into scratch succeeds, and the new rules are in the output CSS.
- No horizontal overflow and no console errors on /, /plant, /business, /tree/0427, terms, privacy, accessibility, /credits and 404, at 1024, 1180, 1366, 1536, 1768, 1920×940 and 2560 (full scroll each). Script: `overflow.mjs`.
- Reduced motion on desktop looks right: `after/reduced-*`.
- The page transition (leaf from the click point, moss cover, arrival) is unchanged: `m-pt.png`.
- **Phones did not change.**
  - Computed styles of every element under the header, menu, phone bar, a11y panel, cookie and body (menu and a11y panel opened) were compared against e9cdfc7, on iPhone 13 portrait and landscape.
  - terms and 404: 0 differences.
  - home and business: the only differences are in other owners' sections (roots, biz gallery), plus the home cookie card's timing-dependent floor while it is still waiting. The phone code path in `cookies.ts` is unchanged.
  - Phone screenshots `phone-before/` vs `phone-after/`: the header region is identical. The full-page pixel differences come from the hero video, the falling leaf on 404, and the tree page's own changes.
  - Scripts: `styledump.mjs`, `stylediff.mjs`, `stylediff2.mjs`, `sd/`.

### Not changed (on purpose)
- Over photo cards on light sections (the seasons workshops), the header still turns to the moss glass ("media → light"). It is readable and was by design.
- Tokens (`--header-h`, `--gutter`, `--maxw`, the type scale) are untouched.

## Verification

Independent check of the desktop polish (vs e9cdfc7) and of the phone scroll-perf pass for this area (vs fa9748d, the live site).
Scripts and screenshots: `/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/verify-global/`.
- `mix/` is the current tree with only this area's files put back to e9cdfc7. It isolates the polish.
- `nog/` is the current tree with this area's perf files put back to fa9748d (`core/scroll.ts` is kept, because `/plant` imports it). It isolates the perf work.

### What held up
- **Header type and gaps at 1366–2560.** These are better.
  - The pills no longer read as one block, and the nav is 16/17 px on big screens.
  - At 1240–2200, with a11y text levels 0, 1 and 2, there is no crowding or wrapping. The nav is at least 139 px from the logo (`hgap.mjs`).
- **A11y panel.** It now hangs from the column edge under the tools. This is better.
- **Menu foot.** It is 38–41 px off the bottom at 1024–1366. This is better.
- **Focus ring on text links.** It has more room at the sides. Pills and icon buttons are unchanged.
- **Custom cursor after a wheel scroll.** In a home sweep at 1920 (40 wheel steps, `cur.mjs`), the ring matched the background colour 17 times before and 0 times now.
- **Phones did not change.**
  - Computed styles and rects of the header, menu, phone bar, a11y panel, cookie card, focus ring and cursor were compared now against `mix/`. This covered iPhone 13 portrait and 844×390 landscape, on 7 pages, in four states (first screen, scrolled, menu, a11y).
  - The only differences are tween residue: the menu items' entrance transforms, and the cookie card caught mid-entrance.
  - Now against fa9748d, the only differences are the planned ones. The focus ring is `visibility: hidden` while unused. The phone bar's `data-tone` is not probed while the bar is hidden (/plant, tree).
  - Header-region pixels are the same.
- **No horizontal overflow and no console errors.**
  - Checked at 1024, 1366, 1768, 1920×940 and 2560, with full scrolls of 9 routes, motion on and reduced (`ovf.mjs`).
  - `tsc --noEmit` is clean for the whole project.

### Regressions and misses found, and fixed
1. **The cookie card collided with page controls on the sales pages.** The polish made it bigger (640×72, 36 px up) and moved it to the column edge. The before/after shots are in `s/`: `ck-A-*` is before, `ck-B-*` is the polish, `ck-E-*`/`ck-F-*` are with my fix.
   - **/plant at 1680×1050:** it half-covered the configurator's «הבא · לכבוד מה?» button.
   - **/plant at 1920×1080:** it straddled the bottom of the summary panel.
   - **/business at 1366×768:** it covered the scroll arrow.
   - **/business at 1440×900:** it touched the arrow (0 px).
   - **/business at 1536/1768:** it sat 3 px under the photo caption.
   - **/credits:** it covered the breadcrumb. The legal pages at 1366–1920 put it next to or over the first H2.

   What I changed (wide screens only, `cookies.ts` + `chrome.css`):
   - The card is 560 px wide. It still breaks into 2 lines at 14 px, and the height stays 72.
   - The bottom corners have fallbacks when the column spot is busy:
     - `:low` keeps the column edge but sits 20 px up.
     - `:corner` is the screen corner, 20 px up. Beyond 1920 it sits at most 184 px outside the column.
   - There is a new `top-end` slot, under the header on the far side.
   - A neighbour within 16 px counts as touching, and text costs more the closer it is.
   - A photo/video/canvas that is actually visible and that the card would half-cover costs as much as a button. Media occluded by the hero does not count.

   Results:
   - /plant uses the corner and clears the button.
   - /business sits under the photo, aligned with it, 13–15 px under the caption and clear of the arrow.
   - /credits and most legal widths use the empty top-left.
   - Home and 404 keep their slots.
   - Phones and landscape phones take the old code path exactly. This was checked with the style dump.
   - Idle cost while the card waits on desktop is about 5 ms per 1.5 s re-check (measured).
2. **The compact header turned soil-brown over the hero video and the seasons photos.** The polish keyed it on `html[data-theme=dark]`, which turns at the 55 % reading line. At 1920 that meant about 500 px of scroll with a brown band over the green video (`hs/sweep.png`).
   - `header.ts` now sets `data-under` from what is actually under the header: a soil/moss section's own colour, not media. This is done only on wide screens with a fine pointer, and it is one extra hit test per tone probe.
   - `chrome.css` keys the soil/moss glass on it.
   - Result: the glass is soil over the roots and the /business soil, moss 0.86 over the wall and the /business moss, and the original moss glass over the hero video and the seasons photos (`hs/c-stack.png`).

### Phone scroll performance (measured, headless Chromium, iPhone 13, DPR 3, 4× CPU, 900 px/s, production builds)
The runs were interleaved, 3 each, with medians reported. The machine was at load 18–29 on 4 CPUs, so single runs are noisy.

| | home 0→9000: fps / long tasks / style s | /business 0→6000: fps / long tasks / style s |
|---|---|---|
| live fa9748d | 20.1 / 61 / 2.60 | 33.6 / 28 / 2.40 |
| now minus this area's perf work (`nog`) | 27.7 / 32 / 2.18 | 35.6 / 18 / 1.79 |
| now | 32.5 / 23 / 1.84 | 41.5 / 10 / 1.20 |

The live row and the other two rows come from two separate sets of runs. In the set with the live build, the current tree measured 31.9 fps on home and 45.7 fps on /business.

- The claimed gains of the global pass hold, in the same direction in every pairing: about −15 % style time on home, −33 % on /business, fewer long tasks, and +5–6 fps.
- The desktop polish and my fixes add nothing on phones: the extra work is behind the wide matchMedia or a fine pointer.

Not fixed (reasoning, not measured):
- In Chromium the header's composited layer is about the full viewport (390×729). It is the same on live, where it is reported as `site-header__icon-btn` at 390×718. It is not a regression, and on WebKit it is likely the hidden-header translate's bounds. Worth a look on a real iPhone.

### Still open
- On /tree/0427 (first visit, wide screens) the card takes the empty top-left. It partly covers the scene's moon and the `דמו` button. Every other slot is over the timeline or side buttons that the page lays out (hidden) during the birth intro.
- /business at 1024–1180: no slot is free, so the card covers the hero's scroll arrow, as it did before.
- Skip link on wide screens: it is 56 px from the screen edge, not on the column edge. It is transient, so I left it.
- No real-device or real-monitor check.
