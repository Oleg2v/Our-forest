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
