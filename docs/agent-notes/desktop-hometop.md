# desktop-hometop: home top on big screens (preloader, hero, roots)

## Desktop polish

I audited the area at 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900 (the owner's screen), 1920×1080, 1920×940 and 2560×1440. Secondary sizes were 1024×768, 1180×820 and 820×1180 (portrait tablet).

At each size I took slow scrolls through the hero, the story, the pinned descent (pin start, middle, all lit, end) and the hand-over into seasons. I also checked the dog following the cursor, the header coming back on scroll-up, reduced motion and the preloader (production build).

The lead's e988eb2 fixes are kept: the pan cap still leaves 62–100 px of soil under the lowest caption at every size, and the root tips are unchanged.

Screenshots are in `/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/desk-hometop/` (written `…/` below). The scripts are `shoot.mjs`, `dogprobe.mjs`, `pl.mjs` and `edges.mjs` in the same folder.

### What was wrong, and what changed

1. **Hero: the "127 families" counter was not aligned with the content column** (every width above 1552 px).
   - It sat on the window gutter, 56 px from the edge. The header CTA directly above it, and all the hero copy, sit on the `--maxw` column: 164 px in at 1768, 240 px at 1920, 560 px at 2560.
   - Change: `.hero__corner { inset-inline-end: max(var(--gutter), (100% - var(--maxw)) / 2) }` for min-width 769 px. At 1552 px and below nothing moves.
   - `hero.css`
   - Before / after: `…/a1768/s-00-0.png` → `…/after1768/s-00-0.png`; `…/b1920x940/s-00-0.png` → `…/after-1920x940/s-00-0.png`; `…/a1920/s-00-0.png` → `…/after-1920x1080/s-00-0.png`; `…/a2560/s-00-0.png` → `…/after-2560x1440/s-00-0.png`.

2. **Roots: "מה מחכה לכם ביער?" was not aligned with the content column** (above 1552 px).
   - It was the only heading on the page on the gutter: 56 px from the edge at 1920, while every other heading sits 240 px in (`edges.mjs`).
   - Change: the same `max(gutter, column)` edge. The header's "הסיפור שלנו" now lines up with it when the header comes back on scroll-up (`…/hdr/up-01-R0.82.png`).
   - `roots.css`

3. **Roots: a root ran along the underside of that heading.**
   - The first branch, out to "חיבור לטבע", left the tap root high and ran right under the letters. At 1366 and 1024 it touched the "?". On the portrait tablet it went through the "?". Once the heading sat on the column, it ran under the whole line (`…/after1768/s-03-R1.png`: an intermediate state, not shipped).
   - Change, in `roots.ts` `buildDesktop` and `roots-geometry.ts` (new `intrudes()`, `keepBelow()`):
     - The heading's box plus a margin (max(32 px, 4vh)) is a zone the branches stay out of.
     - A branch that would enter it leaves the tap root a little deeper, but never past the next branch. That gives a natural opposite pair of branches, and the curve keeps its shape.
     - Only what is still left after that is bent down.
     - The seeded jitter is drawn exactly as before, so branches that never came near the heading are unchanged.
   - Before / after:
     - 1768: `…/a1768/s-14-R1.png` → `…/after1768/u-01-R1.png`
     - 1366: `…/a1366/s-06-R1.png` → `…/after-1366x768/s-04-R1.png`
     - 1024: `…/b1024x768/s-03-R1.png` → `…/after-1024x768/s-04-R1.png`
     - 1920: `…/a1920/s-06-R1.png` → `…/after-1920x1080/s-04-R1.png`

4. **Roots on 2K+ screens: the nodes drifted out to the window edges, and the story and net stayed laptop-sized.**
   - At 2560×1440 the outer captions were 380 px from the edge (the column starts at 560). The story filled the top 40 % of the frame. The captions were 16 px.
   - Changes, all in min-width 769 px, and each only takes over above about 1100 px of height or 1800–2200 px of width (nothing changes at 1920×1080 or below):
     - `.roots__nodes` spans at most 1.25 × `--maxw`.
     - Photo: `min(26vw, max(400px, 36vh))`.
     - `--story-pad` cap: 140 px.
     - Title: up to `max(118px, 10vmin)`.
     - Text: up to `max(21px, 1.6vmin)`.
     - Net heading: up to `max(74px, 6vmin)`.
     - Dots: `max(68px, 5.2vmin)`.
     - Node titles: up to `max(32px, 2.6vmin)`.
     - Captions: `clamp(16px, .6vw + .5vh, 19px)`. That is 16 at 1768×900, 16.9 at 1920×1080 and 19 at 2560.
   - Before / after: `…/a2560/s-02-R0.png` → `…/after-2560x1440/s-01-R0.png`; `…/a2560/s-06-R1.png` → `…/after-2560x1440/s-04-R1.png`.

5. **The dog was cut off at the end of the pin.**
   - The finale pans the camera up, so the net's bottom edge (the dog's ground) went below the stage by the pan: 25 px at 1768×900 and 54 px at 1920×1080.
   - A dog following the cursor had its paws, and at 1080p everything but its ears, sliced by the stage edge or the seasons panel.
   - Change: `DogOptions.ground` may now be a function, read every frame (`dog.ts`; the footer's numeric use is unchanged). In roots, the ground is 14 px plus the current pan (clamped), so the dog always runs on the bottom of the visible frame.
   - Before / after at 1920×1080: `…/dog/end-before.png` → `…/dog/end-after.png`. At 1768: `…/dog/end-after-1768.png`.

6. **Portrait tablets (820×1180) had two problems.**
   - The tablet sizes for node titles and captions (30 / 17 px) never applied, because the base rules later in the file won. Now they are scoped with `.roots`.
   - The one-line net heading reached past the middle and the tap root ran through its "?". Now it has `max-width: 6em` on portrait tablets (two lines).
   - Before / after: `…/tab/before-02-R1.png` → `…/tab/after2-01-R1.png`.

7. **The preloader disc at 2560×1440 was 460 px, a third of the screen.**
   - Change: `min(70vmin, 80vw, max(460px, 42vmin))`, which gives 605 px at 1440 high. It is unchanged below about 1100 px of height and on phones (`partials/home/preloader.html`).
   - Before / after (production build): `…/pl/prod2560-900.png` → `…/pl/prod2560-after-900.png`, plus `-1150`.

### Checked
- **Phones unchanged.** All changes are in min-width 769 px rules, the pinned or desktop TS branch, the dog (a no-op on touch) or a `max()` that cannot win under 1100 px of height.
  - I took before and after shots of 390×844 (iPhone 13 emulation, 13 positions) and of a landscape phone (9 positions): `…/phone-before/` and `…/phone-after/`.
  - Section geometry is identical (hero 0/664, roots 664/1552; landscape 342/1517).
  - The pixel diffs are only the fireflies' random breathing phase, the hero video frame and the seasons branch's sway (`…/phone-diff-m1000.png`, `…/phone-diff-m1900.png`).
- **Reduced motion, desktop:** the static net is fine, and the counter and heading are aligned (`…/rm/after-*.png`).
- **No horizontal overflow and no console errors** at any of the 13 viewports.
  - The dev server shows a 680 px overflow in the first ~400 ms of the preloader. That is the dev-only unstyled flash (CSS arrives through JS). The production build has none (`plprobe.mjs`).
- **Types:** `npx tsc --noEmit` is clean for the whole project.

### Left as is (judgement)
- **The thin root tips beside the captions** stay as the lead finished them.
- **The empty soil under the pinned story on 1920×1080 and wider:** the root tease grows into it during the hold, and the descent needs it.
- **The 34 px between a returning header and the net heading** only shows while scrolling up.
- **The hero type at 2560:** the title is capped by the global `--fs-hero` token, and making the subtitle or copy bigger alone would unbalance it.
- **The reduced-motion net draws the glow overlays at full strength** (bright doubled lines). That is the existing "all lit" design, and I did not touch it.

## Verification

Independent check of the desktop polish above and of the phone scroll-performance work in this area (`perf-hometop.md`). Scratch: `/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/verify-hometop/` (written `…/` below).

How I compared:
- "Before" for the desktop polish: the current tree with only this area's files put back to e9cdfc7 (`w-iso`). Every other area is the same on both sides, so any difference is this area's own.
- "Live": a worktree at fa9748d.
- For an area-only phone perf A/B: the current tree with only this area's files put back to fa9748d (`w-piso`).
- Each one ran on its own no-HMR dev server.

### Desktop: the polish holds, with two things it missed (both fixed)

I compared before and after at these sizes:
- 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×1080, 1920×940 and 2560×1440;
- 1024×768, 1180×820 and 820×1180.

The positions were the hero, the story at the pin start, the descent, all five lit, the finale, the pin end and the hand-over (A150/A400/A700). The pairs are in `…/pairs/`.

**What I confirmed:**
- **Counter pill:** it is now on the column under the header CTA at 1768, 1920 and 2560, and unchanged at 1552 and below.
- **Net heading:** it is on the column.
- **The branch under the heading:** at 1366, 1024 and 820 it no longer touches the "?" (`…/pairs/1366-head.jpg`). Nothing else moved at 1440, 1536, 1680 or 1180.
- **2K:** the story and the nodes now fill the frame (`…/pairs/2560x1440-*`).
- **Portrait tablet:** the heading is on two lines, clear of the tap root, and uses 30/17 px type.
- **The dog at the pin end** is whole at 1920×1080 (y 1014–1072). Before, only its ears showed (`…/pairs/dog.jpg`).
- **Preloader disc:** 605 px at 2560×1440, unchanged below 1100 px of height.

**Owner complaint 1 is solved for good.** At the pin end the lowest caption keeps exactly 8vh of soil above the next section at all 12 sizes:
- 62 px at 1366×768 and 1024×768;
- 72 px at 1768×900;
- 87 px at 1920×1080;
- 116 px at 2560×1440.

It still holds after my caption fix (`…/endprobe-now*.txt`).

There is no horizontal overflow and no console error at any of the 12 sizes. `npx tsc --noEmit` is clean.

**Missed 1: the node titles and captions never grew on big screens (fixed).**
- The note above says the captions are 16.9 px at 1920×1080 and 19 px at 2560, and the titles go up to `max(32px, 2.6vmin)`. That was not true.
- Those rules were in the `min-width: 769px` block before the base `.roots__node-title` / `-text` rules. Those base rules win, which is the same cascade trap the agent fixed for the tablet block.
- Measured before the fix, at 2560×1440: 32 px titles and 16 px captions next to an 86 px heading.
- The fix moves the two rules into a `min-width: 769px` block right after the base rules, with the same specificity:
  - The portrait-tablet rules (`.roots`-scoped) still win.
  - The phone / landscape-phone block comes later and still wins.
- Measured after the fix:

  | Size | Titles | Captions |
  |---|---|---|
  | 2560×1440 | 37.4 px | 19 px |
  | 1920×1080 | 32 px | 16.9 px |
  | 1920×940 | 32 px | 16.2 px |
  | 1768×900 and below | unchanged | 16 px |
  | 820×1180 | 30 px | 17 px |
  | 844×390 landscape phone | 26 px | 16 px (unchanged) |

- `roots.css`.

**Missed 2: the five directions went dark after any `ScrollTrigger.refresh()` while you were in the net (fixed; this is also on the live site).**
- A refresh reverts the pinned timeline to 0 to measure. That fires its `onUpdate` with t = 0, so every node timeline reversed and the dog hid.
- Then the playhead is put back without an update. All five nodes (rings, icons, titles, captions) and the dog stayed gone until the next scroll.
- The owner meets it by:
  - resizing the window (or opening DevTools) while in the net. Measured on fa9748d: resizing 1768 → 1600 at "all lit" left all five titles at opacity 0 and the dog at 0;
  - the `load` / fonts refresh;
  - the deferred-init refresh.
- It also caught one of my own screenshot runs (`…/d/iso-1920x1080-02-R0.78.png`: the net with empty dots).
- The fix, in `roots.ts` `setupPinned`:
  - The node and dog sync is one function, `syncNodes()`.
  - The timeline's `onUpdate` skips it while `ScrollTrigger.isRefreshing`.
  - The trigger's `onRefresh` calls it once the playhead is back.
- Checked:
  - a forced refresh at R0.2, R0.5, R0.78 and R1: states unchanged (live: all dark);
  - a resize 1768 → 1600 in the net: still all lit (live: all dark);
  - scrolling down, up and down: nodes light and unlight as before;
  - the header link to #directions: all five lit.
- `refprobe.mjs`, `rsprobe.mjs`, `nodeprobe.mjs`, `dirlink.mjs`.

**Seen, not changed:**
- Above 1552 px, the net heading's soil-avoid box moved, so the seeded pebbles (and the tap-root jitter drawn after them) are a different draw than before. That is cosmetic only.
- At 1920×1080 the nodes sit 12–36 px further in (the 1.25 × column cap starts at 1800 px). The note says "nothing changes up to 1920". It is harmless.
- The agent's "left open" items stand as judged.

### Phones: unchanged by the polish, and only the named simplifications differ from live

- **Against the e9cdfc7-area baseline**, at 390×844 (iPhone emulation, DPR 1, 9–11 positions over the hero, roots and seasons) and at 844×390 landscape (7–8 positions), after my two fixes:
  - Section geometry, node boxes and all font sizes are identical. The roots are 844/1552 in portrait and 390/1564 in landscape, with no overflow.
  - The pixel diffs are only sparse, time-varying ones: motes, the breathing photo and the seasons sway. Fireflies and the video were hidden for the diff.
- **Against live (fa9748d)**, same method:
  - Geometry and sizes are identical.
  - The diffs are sparse: antialiasing along the phone root (now a composited clip, with no round cap at the moving tip, as reported) plus the time-varying things.
- **Reduced motion:** `mobile-static` on phones and `static` on desktop are fine.
- **Keyboard:** the Tab order is skip link → header → hero CTAs → gift → seasons, with a visible 2 px outline. The roots have no tab stops.

### Phone scroll performance (headless Chromium, iPhone-13 emulation, DPR 3, 4× CPU, dev servers, 3 interleaved runs, medians)

**Live → now (whole tree; the other areas' fixes are included).** Load average was 20–40 from other agents, so these are noisy.

| Measure | Live | Now |
|---|---|---|
| Hero 0→900 | 10 fps, 8 long tasks, worst frame 283 ms | 28.7 fps, 3 long tasks, worst frame 167 ms |
| Roots 664→2216 | 31.1 fps | 34.3 fps (within noise) |
| First visit, touch flicks right after the intro | 21.3 fps, 43–49 long tasks (4.5–5.4 s), worst frame 1100 ms | 41.1 fps, 7–13 long tasks (0.56–0.83 s), worst frame 233 ms |

**This area alone (area at fa9748d → now, everything else identical).** Load was lower.

| Measure | Area at fa9748d | Now |
|---|---|---|
| Hero | 40.7 fps | 46 fps |
| Roots | 58.8 fps | 57.7 fps (the same) |
| Early swipe | 37.2 fps, 7–11 long tasks (1.0–1.3 s), worst frame 300 ms | 49.5 fps, 0–1 long tasks (0–72 ms), worst frame 100 ms |

So the claimed early-swipe gain holds, measured. The steady-state roots range shows no headless difference, as the perf agent said. The raster, turbulence and compositor gains are iOS reasoning and cannot be measured here.

**Trace of the roots range (now):** nothing heavy is left in this area. DrawSVG render is about 19 ms, getBBox + getTotalLength about 8 ms, and the roots update about 2 ms. The top script cost is `header.ts` onScroll at 30–41 ms (chrome).

**Layers at y = 0:**
- 51.5 viewports now, 48.2 with this area at fa9748d, 60.6 live.
- The +3.3 is the steady hero zoom / dim / ground layers and the 238×1260 root clip. That is intended: no per-frame repaint.
- A 390×11805 overlap-squashing layer exists in all three. It is named after its first member: `hero__ground` before, `hero__content` now. It is pre-existing and cross-area (it lines up with the fixed header's overlap), not caused by this area. I am flagging it to the lead, because WebKit composites overlap differently and this cannot be judged headless.

The desktop polish adds nothing on phones: it is CSS behind `min-width: 769px` plus desktop-only TS. The dog is a no-op on touch.

### Still open
- Neither the phone gains nor the WebKit layer question have been checked on a real iPhone.
