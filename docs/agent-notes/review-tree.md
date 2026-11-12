# review-tree — /tree/0427 "העץ שלכם" (scene + UI), review & fix pass

Owner for this pass: the whole tree area (`tree/0427/index.html`, `src/tree/**`, `src/pages/tree.ts`, `src/data/tree.json`,
`public/sw.js`, `public/manifest.webmanifest`, `public/og/tree-0427.jpg`, `public/icons/**`, `partials/seo/tree.html`).

## Fixed
- **The stray "ג" at the top-left (desktop):** it was the chrome cursor's "גררו" label, centred on the pointer at (0,0).
  The full-bleed scene carried `data-cursor="גררו"`, so the label showed anywhere over the stage, including the window corner.
  The attribute is gone from the HTML. The UI now asks the scene what is under the pointer (new optional `scene.hitTest(x, y)`),
  and it sets the label (attribute + `bus 'cursor:set'`) only over the island and the tree. The empty paper gets the plain ring.
- **`poke(id)`** (new optional scene API): this gives keyboard and DOM-proxy activation the same motion as a tap.
  - A fruit swings, a greeting leaf pulses, the roots glow (ground), the trunk shakes, the crown rustles.
  - Proxies call it for fruit, greeting, ground and leaf.
  - Fruit proxies are now numbered for screen readers: "פרי 3 מתוך 8. מתי קוטפים?".
- **`mount(container, { birth: true })`**: a birth, or the gift envelope before it, now opens on empty paper and then the
  soil close-up. It never shows the grown tree first. The UI's `opacity: 0` hack is removed.
  - A pending birth pose that never plays (the presenter switches flow) settles onto the grown tree in `playVisitIntro`.
- **The birth stuttered for seconds on the SVG path.** The SVG renderer re-encoded the 1024 px plaque canvas with a synchronous
  `toDataURL('image/png')` about every 110 ms during the engraving burn. Headless profiling put 13.4 s of the first 14 s there.
  - It now encodes with `toBlob` into an object URL: asynchronous, one encode in flight, skipped while the plaque is still underground.
  - With that change the whole birth runs on time.
- **Young evergreens were almost leafless.** Example: olive 0122, 8 months, which had 164 of 1640 leaves.
  - Leaves are now generated `leafYouth`× denser (2.4 evergreen / 1.7 deciduous). `grow()` thins them back to the adult budget as growth → 1.
  - Young trees keep their foliage on their few branches. Adults show exactly the same leaf count as before.
  - Young olive: 164 → 393 leaves. The SVG stride is adjusted so the SVG adult count is unchanged.
- **Multi (swipe between trees):** after switching trees, WebGL showed a blank grey plaque and a black dot for the QR token.
  - Cause: `setModel()` rebuilt the materials, but the cached CanvasTextures were never re-bound.
  - Textures are now re-bound every frame, and the token texture is re-created when the tree id changes. The SVG token refreshes on an id change too.
- **The /plant hand-off** (`?birth=1&species=…&text=…[&mode=memorial]`) is now the visitor's own tree, planted today.
  - It is a sapling with a fresh history, and the caption "העץ שלכם נולד" shows today's date.
  - Before, it said 14.2.2026 and grew a 9-month tree.
  - The presenter's "before planting → planted" demo does the same (`ctx.replant(true)`). Any other flow restores the demo tree.
- **Memorial birth caption** (7.12, no watering game): the first button is "מדליקים נר", and it lights the candle.
  It used to be "משקים בפעם הראשונה".
- **No "יש חדש" dot during a birth or the gift** (it blinked over the seed in the close-up).
- **Timeline future (7.8):** the future had shown a fully drawn adult tree.
  - Now the tree stays as it is today, and a **dashed silhouette** grows over it as the slider moves (new optional state `ghostAgeDays`).
    The camera makes room for it.
  - The caption follows the slider: "ככה הוא ייראה בעוד שנה / שנתיים …", ending on the brief's "ככה הוא ייראה בעוד 5 שנים".
  - The caption no longer re-animates on every slider step (only the date line updates).
  - The duplicate live region was removed (the slider's `aria-valuetext` speaks).
  - The timeline is hidden in the "before planting" state.
- **Hebrew:** "הזית/הרימון… מבשיל" now agrees in gender (it read "מבשילה" for every species). The herbarium "No. 0427" no longer
  flips to "0427 .No".
- **Contrast (axe, serious):** fixed the herbarium label date, "waiting" and Latin lines (3.1–3.2 : 1), and the fruit price on sand in the feed lead (4.26 : 1).
- **Mobile:**
  - Phone (`fracW` 0.9 → 0.8):
    - The "before" island no longer runs off the right edge.
    - Multi: the pager now sits under the island instead of on its soil.
  - Touch:
    - Invisible ≥ 44 px hit areas (`pointer: coarse`) for "יש חדש", "משקים בלחיצה אחת", the timeline labels, "דמו" and the pager.
    - The tree sheets (greeting form) stay above the on-screen keyboard (`visualViewport` → `--kb`), and the focused field scrolls into view.
  - Wider screens:
    - Portrait tablets (820×1180): the island used to sit under the water panel and the page overflowed sideways.
      Now the island steps to the free side of the reading column.
    - The journal grid no longer overflows on 769–1120 px.
- **OG image** `public/og/tree-0427.jpg` was regenerated from the live renderer, so it shows the fuller crown.

## Verified (dev server :5205, Playwright + SwiftShader, screenshots looked at)
- **Birth on a phone (390×844):**
  - Frames at exact timeline times (seeking the birth timeline): paper → seed pulse → three cracks → radicle and sprout with two
    seedling leaves → pull-back with the plaque rising → island → "העץ שלכם נולד" + date + buttons.
  - Also checked for the hand-off (fig, today), memorial olive (reduced and full motion), gift (envelope → letter → birth → caption)
    and before → notice → birth (sapling, today's date) → presenter back to the demo tree.
- **Watering:** real touch press-and-hold via CDP, on phone and desktop.
  - Can, water arc (≈300 drops), wet spot, counter roll to 1,285, the drop asleep with "העץ שתה היום. נתראה מחר" + time left,
    the vine leaf, and the guardians card.
  - Also a one-tap watering in reduced motion.
- **Keyboard:**
  - Tab order: header → scene (role + description) → plaque, QR, 8 fruits, 3 greeting leaves, trunk, ground → news → drop → one-tap → sides → card → timeline.
  - Enter on a fruit opens "מתי קוטפים?" with its leader line.
- **Stop animations:** the a11y panel's switch at runtime goes WebGL → SVG → WebGL.
- **axe-core** (wcag2a/aa, 21a/aa): no violations on any of these:
  - visit and memorial, mobile and desktop
  - before, gift, offline and the birth caption
  - the greeting sheet, share sheet, plaque card and presenter
  - multi
- **No horizontal overflow** at 390, 1440, 1280×720 or 820×1180. No console errors or warnings in any run.
- **Navigation and checks:** away to /plant and back (reload path; the dev server disables bfcache), plus a rotation round trip.
  `npx tsc --noEmit` is clean (whole project), and a scratch `vite build` keeps three.js and the GL renderer as lazy chunks.

## Remaining (honest)
- **Not measured on real devices:**
  - frame rate on a mid Android, shader compile time, `KHR_parallel_shader_compile`
  - iOS keyboard behaviour of the sheet fix
  - pinch zoom with real multi-touch
- **Phone landscape (844×390)** gets the desktop layout at its 640 px minimum height. It scrolls and nothing overlaps, but it is not designed.
- **Birth roots:** the "radicle" reveals along the adult tap root (the seed sits on it), so in the close-up the first roots also run up to the
  surface, not only down from the seed. It reads fine, but it is not a literal radicle.
- **The young olive:** narrow sage-silver leaves on cream are still a light, airy crown rather than a dense one; adults are dense.
- **Push notifications, payments, weather API:** still mocks or live-version-only, as the builders noted.

## Requests to others
- **footer (src/components/footer.ts / its CSS):** at 820 px wide, `.site-footer__seedbox` sticks out 18 px past the right edge
  (right 838 / viewport 820). In RTL it is clipped rather than scrollable, but it may cut its content. Measured on /tree/0427 at 820×1180.

---

# review-tree, pass 2 — answers to the independent critic

## Fixed
- **Header stuck in its "dark close-up" mode after every birth (high).** The chrome header only re-probes when told.
  `intro.ts` now sets the stage's `data-header` hint and emits `bus 'theme:section'` on every phase, after the caption,
  and in `stop()`. The new close-up framing keeps a band of paper under the header, so the header stays in the scene's
  tone through the whole birth. Checked: 5 s after `done`, `.site-header[data-tone]` = `dark` = stage hint (phone + desktop, `?state=birth` and the /plant hand-off).
- **Birth close-up had no radicle (high).** The roots are rebuilt for the birth:
  - Model: the tap root now runs straight through the seed (x = 0). New per-node metrics: `mr` (downward from the seed only) and `up` (the tap above the seed).
  - `grow()` gets `radicle` (close-up blend) and `hypocotyl` (0..1). It returns per-node `rootM` and `rootR`.
  - New `rootRuns()` cuts every chain into its contiguous revealed runs. The old "stop at the first hidden node" loop could not draw a tap root that grows both ways from the seed.
  - Both renderers use `rootRuns()`. In the close-up:
    - a thin, tapering radicle leaves the seed downward and branches
    - a pale underground stem climbs from the seed to the surface and bends into the sprout's base
    - the adult roots take over only during the pull-back
  - The GL seed fades with real alpha blending (`BLEND_ALPHA`) instead of the screen-door dither. The dither let the black hull show through as pixel noise.
  - The seed stays whole until 4.55 s. The tree only grows once the camera has stepped back, so there is no thick trunk in the close-up.
- **Birth framing on phones (medium) and the eyebrow over the leaves.** During the close-up the principal point moves toward mid-screen on phones. In the sprout phase the camera steps back (`closeD` 1 → 1.3).
  - Measured on the phone: the cotyledons sit at ≈ 31 % from the top, with the seed and radicle below them.
  - "עץ מס׳ 0427" fades at `sprout`.
  - The plaque rises at 4.95 s (it was 4.25 s, and showed up as a giant plank across the header). The burn timing was moved so that it still ends on the last letter at 6.0 s.
  - The skip button gets a soft soil backdrop over the dark strata.
- **Fig crown read as an oak (high).** `LEAF_ART.fig` is now a generated palmate leaf (`palmate()` in species.ts) with:
  - a broad central lobe, two upper and two lower lobes, deep rounded sinuses and a heart-shaped base
  - the same family of outline as the herbarium fig
  - veins from the blade's centre and a petiole

  `public/og/tree-0427.jpg` was regenerated from the live renderer.
- **"מזמינים חברים להשקות" opened the friends' payment form (high).** New `openInviteSheet()` (share.ts) shows:
  - a ready WhatsApp message, the same text as the journal's (`inviteText()`)
  - "שולחים בוואטסאפ" (wa.me), native share where available, and "מעתיקים קישור" (the `?greet=1` link)

  The stage button and the journal button both open it. The payment form stays behind "משקים במתנה ומשאירים ברכה" and the `?greet=1` link.
- **Guardians card hid the watering payoff on phones (medium).** On phones it now comes 4.2 s after the drop falls asleep (2.6 s with reduced motion).
  - It is a compact two-row strip (title, price, button, ✕) at the very bottom. It does not dim the panel.
  - The drop asleep, "העץ שתה היום. נתראה מחר", the time left, the counter and the vine leaf all stay readable.
  - Desktop is unchanged.
- **Plaque focus on desktop (medium).** In landscape, `focus('plaque')` frames the plaque in the left third. The card stands beside it on the reading side, so the plaque and QR are no longer covered.
  - A band of the scene's paper fades in under the header while the plaque is focused or the crown is pinched.
  - Portrait and phones are unchanged (card at the bottom).
- **Pinch zoom (medium).** The scene sets `data-zoomed` on its container, and the UI mirrors it on the stage. While zoomed:
  - the panel, title, caption, conditions and timeline step aside
  - a quiet "חוזרים לעץ" pill resets (double tap and a tap on the paper still reset too)
- **Small text contrast (medium).** New token `--t-quiet` (soil .74 / cream .8 at night), used by `.wp__goal-t`, `.wp__honest` (phone) and `.tree-cond__t`.
  - Removed the extra opacity on `.ttl__lab--end` and on "דמו".
  - The critic's contrast walker now finds nothing below 4.5:1 on the cream stage. Its night run reports false positives because it cannot see the canvas's moss paper.
- **Memorial timeline (medium):** no guardians link at the future end.
- **Ghost (medium).** The future silhouette is built from the adult skeleton:
  - a tapering dashed trunk outline for each stem, from the ground into the crown
  - the six longest first-order limbs as pencil lines
  - a smoother crown envelope around them, anchored at the trunk base
- **"Before" state on desktop (medium).** The camera keeps a minimum content height (52 % of the adult height) for an empty island and for saplings.
  - The island is now about the size it has under the demo tree, not 1.75× bigger.
  - The /plant hand-off sapling's caption no longer runs into the island.
  - The duplicate "הנטיעה בעוד 9 ימים" under the island is hidden in `before`; the panel already counts down.
  - Visit framing is unchanged (checked side by side).
- **Moon vs the pills at night on phones (low):** on portrait screens the moon now sits under "יש חדש" / "דמו", beside the crown.
- **Greeting proxies (low):** read "עלה ברכה מאת סבתא רותי" etc.
- **Offline banner (low).** The store keeps `syncedAt` (the last online load), and the banner says which version it shows ("מ־18:23", or the date and time if it is from another day).
  - Phones: one quiet line in the caption's place between the island and the panel, not over the island.

## Rejected / kept (with reasons)
- **Changing the demo initials to `initialsOf()`:** kept "ר" (סבתא רותי) and "ג" (הגן של נועה). A friend picks how they sign a leaf. The mechanical ס״ר / ה״נ would read worse on a leaf. The real fix was the screen-reader label, which now names the sender.

## Verified (dev server :5205, Playwright + SwiftShader; PNGs looked at)
- **Birth, seeking the birth timeline** at 0.5–5.7 s:
  - phone and desktop, WebGL and SVG-only (`--nogl`)
  - demo fig, olive hand-off (`?birth=1&species=olive&text=…`), memorial reduced motion
- **Real-time birth on the phone:** eyebrow opacity 0 after sprout, header `dark` throughout.
- **Watering:** CDP touch hold, then the strip. **Invite sheet:** text and wa.me href checked.
- **Plaque focus on desktop; pinch on the phone:** a CDP two-finger pinch, then "חוזרים לעץ" resets.
- **Timeline future:** visit and memorial. **Other states:** before, night, offline.
- **Crown crop** at DPR 2 (summer and autumn). **OG** regenerated.
- **axe** (wcag2a/aa, 21a/aa): no violations in any of these:
  - visit, offline, before, memorial, night and the birth caption
  - the invite sheet, with focus returning to the button
- **No console errors.** `npx tsc --noEmit` clean. Scratch `vite build` OK.

## Remaining (honest)
- **Birth close-up geometry:** the sprout's above-ground stem stands ≈ 0.045 units behind the cut face (≈ 13 px in the close-up). The underground stem bends across the cap's front edge to reach it. It reads as one plant, but it is not a literal cross-section.
- **Ghost crown envelope:** it is still a hull of the adult leaves. Two-lobed crowns (fig) give a softly heart-shaped outline.
- **Desktop birth in real time** under SwiftShader: the WebGL shader compile blocks the main thread for seconds, so the phases are checked by seeking. Real GPUs are not measured.
- **Unchanged from pass 1:** no real-device fps / iOS keyboard / multi-touch check.

## Requests to others
- **footer (src/components/footer.ts / CSS):** `.site-footer__seedbox` still spans 84..839 px at 820 px wide, measured again on /tree/0427 at 820×1180. The page itself does not scroll sideways.
