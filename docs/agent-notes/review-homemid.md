# review — homemid: seasons strip + workshops + forest map (home) + the map picker in /plant

Files touched: `src/sections/home/seasons.ts`, `seasons.css`, `src/sections/home/map.css`,
`src/components/forest-map.ts`, `forest-map.css`, `forest-map/spots.ts`, `forest-map/data.ts`.
Scripts and screenshots: `scratchpad/agents/homemid/` (`run.mjs <script>`, PNGs in `shots/`).

## Fixed
- **Workshops list was invisible (critical).** `pages/home.ts` now starts the below-the-fold sections after
  the chrome's first reveal scan, so the rows that `seasons-workshops.ts` builds (with `data-reveal="fade"`)
  were never registered and stayed at `opacity: 0` on desktop and phones. `seasons.ts` now hands them
  to the reveal system with `refreshChrome(rows)`, after the pin exists.
- **Branch over the photos.** The pinned stage now starts under the branch's lowest leaf
  (`--stage-top = branch-h × 0.92 + 24px`). The photo height is whatever is left after the card text and
  the ruler (`--img-h` is a clamp of `100svh − stage − ruler − body`). The card stagger now only goes
  downwards. Measured gap from branch to photo: 8–14 px at 1280×720, 1366×768, 1440×900, 1536×864 and
  1920×1080; cards never reach the ruler (18–74 px). Winter's falling leaves still drift over the
  cards. That is the effect, and they fade out.
- **Contrast in the seasons.** At every one of the four season colours:
  - ruler names (2.3:1 → 5.2:1 or more);
  - "עכשיו" and the "01/02/03" indices (3.5:1 → 5.6:1 or more);
  - `--ink-soft` (4.6:1 → 5.1:1 or more);
  - prices: a deeper ripe fruit (`color-mix(fruit 74%, soil)`, at least 4.2:1). Every price is ≥ 24px
    (large text); the phone workshop price went from 22 to 24px.
- **Mode rebuilds keep the reader in place.** Switching "stop animations" on or off, or crossing 768px,
  rebuilt the strip, and the pin spacer appeared or disappeared under the reader. They landed screens
  away. Now the section is re-anchored after every ScrollTrigger refresh in that moment, including the
  refreshes of other pinned sections. Checked in both directions on desktop and on a phone.
- **A phone turned sideways (844×390)** used to get the desktop pinned stage, which cannot fit. It now gets
  the swipe carousel (JS and CSS both use touch + height < 600px), with the branch capped at 30svh. A short
  desktop window (< 600px high) gets the static grid. The map is one screen high on short touch screens.
- **Map numbers are consistent everywhere.**
  - Legend and screen-reader summary: כבר ניטע 100 · שמור 20 · מחכה לכם 48.
  - List: כבר ניטע 100, a separate group "נגרות עם הקדשה" with 2 built benches, שמור 20 and מחכה לכם 48.
  - Built benches in the list read "ספסל · מקום מס׳ …" and show their date. Before, it was "נבנה עץ מס׳ …".
  - The "N עצים מתאימים" announcement counts trees only.
- **Deep link `/?spot=0427#map`.**
  - Desktop: centres the tree and pins its card. Before, the pin blocked every other hover card and Esc did
    nothing until you clicked. Now it is a soft pin: hovering another place replaces it, and Esc closes a
    pinned card even when focus is on the page.
  - Phones: before, it only moved the camera, and the tree stayed hidden inside its cluster. Now it opens
    the tree the way a tap does (the map goes full screen, the sheet opens, focus goes to the sheet's link).
- **Clusters never swallow benches and corners.** Benches, tables, fire nooks and corners no longer shrink
  or turn unclickable when the trees gather into groves. They also grow a little more when zoomed out
  (`--fm-ms2`, capped at 2.2). The picker does not cluster at all when only benches or corners can be chosen.
  Before, the phone bench and corner pickers were clustered, with 10px untappable targets.
- **Thumb targets.** On touch, every hit circle grows so the target is at least 46px at any zoom. The circle
  is invisible: CSS `scale(max(1, 23 / (r × k × ms)))` with `--h` per circle. Measured in `/plant` on a phone:
  free tree 60px, bench and corner 46px. In-section free spots measure 57px.
- **The picker on phones** no longer opens the floating card on a tap. It covered half of the 338px map, and
  for corners it was clipped. The tap gives the check mark plus the configurator's line. Mouse and keyboard
  still get the card. The card never leaves a small frame now: it goes to the roomier side, clamped inside.
- **The picker survives its host.** When the configurator rebuilds its steps (product switch), the map
  destroys itself once its element leaves the document. Before, it leaked document listeners. Verified
  tree → bench in `/plant`: one map, 6 radios, not clustered.
- **Map intro.**
  - Views that start zoomed out (phones) get a lighter, shorter intro (~1.8 s): the plan draws itself, the
    groves and places fade in, and the clusters settle. Before, ~170 single tree tweens ran under the
    clusters.
  - Throttled 4× in software GL: long frames during the phone intro went from 15 to 5, p90 from 50 to 17 ms.
  - The `.is-pre` state hides places, groves and clusters. Before, they flashed on blank paper before the
    intro started.
  - A thumb that only scrolls the page over the map, or a wheel over an inactive map, no longer cuts the
    intro to its end. A press, a tap, a key, or a gesture on the active map still ends it at once.
  - The desktop planting wave is unchanged; I checked it mid-way (0.9 s and 1.5 s).
- **Focus after full screen.** When a tap or a deep link opens a sheet, focus goes to the sheet, not to "סיום".

## Decisions
- **Desktop click on a free place goes straight to the configurator.** This is the brief's concept line
  (Клик по месту открывает конфигуратор). The card with "המקום הזה מחכה לעץ שלכם" and its button shows on
  hover before any click. Keyboard focus on a place shows the same card, Tab reaches its button, and Enter on
  the place goes to the configurator. Touch shows the sheet first.

## Verified (dev server :5202, Playwright; screenshots looked at)
- Desktop 1440×900, also 1280×720, 1366×768, 1536×864 and 1920×1080, through the pinned strip
  (spring → winter).
- Workshops: the rows show and the hover photo follows the cursor.
- Map: idle, the intro mid-way, a planted card, a free card, keyboard Tab → place → card button, arrow
  keys, zoom-out clusters, list view, and the deep link (desktop and phone).
- Phone 390×844:
  - carousel slides with dots and the season name, the workshops;
  - map in the section, the full-screen clip mid-way in both directions, tap tree → sheet, tap free → sheet
    with "בוחרים את המקום", exit;
  - landscape 844×390, and rotating back.
- `/plant` location step with my map at tree, bench and corner, on desktop and phone: tap or click picks,
  `initialSpotId` is honoured, keyboard (Tab, arrows, Space) updates the URL `spot`, product switch.
- axe-core (wcag2a/aa, 21a/aa): 0 violations in `#seasons` and `#map`, both with motion and reduced, on
  desktop and phone. Also 0 in list view, with a hover card open, with the phone full screen + sheet, and
  in the `/plant` picker.
- Runtime "stop animations": the strip becomes the grid, the map intro finishes, and it goes back again.
  The section stays in view.
- No console errors or warnings from my code. No horizontal overflow on desktop, phone or landscape
  (see the gl note below). `tsc` is clean for my files. `vite build` to scratch passes.

## Remaining / honest
- Smoothness was judged with headless software GL at 4× CPU throttling. I have not run it on a real
  mid-range Android or iPhone. The desktop intro is still ~3 s of whole-SVG repaints (the planting wave).
- **Ripple (src/gl, not mine).** The canvas lands exactly on the hovered card photo. Once, a fast pointer
  path crossed the gift photo on its way to the teams photo, and the shared canvas stayed on the gift card.
  With a clean path it is correct. That same run, the hero's GL canvas (1642px wide at −101px) gave the
  document 101px of RTL-scrollable horizontal overflow after the ripple handed the canvas back, and a
  `scrollIntoView` slid the whole page sideways. I could not reproduce it a second time.
- When the map becomes active under a still mouse, the custom cursor keeps "גלו" until the pointer
  re-enters. The chrome cursor does not re-read a changed `data-cursor`.
- Workshop dates come from `workshopDates()`: the next Fridays and Saturdays from today (12.11.2026).
  Today they show:
  - 13.11.2026 (Fri): carpentry, 6 places
  - 14.11.2026 (Sat): garden, 8 places
  - 20.11.2026 (Fri): dogs, 4 places
  - 27.11.2026 (Fri): carpentry, 3 places

  /business Event structured data uses fixed dates; the lead reconciles.

## Requests to other owners
- **plant / `src/plant/steps-choose.ts`:**
  - Pass `kinds` explicitly from the store's product: bench → `['bench','table','fire']`,
    corner → `['corner']`, else `['tree']`. It still defaults from `?product=`.
  - The selected-place line `he.map.free + ' · ' + id` reads "המקום הזה מחכה לעץ שלכם" for a bench or a
    corner. For non-tree products use something like `מקום מס׳ ${id}`.
- **home / `src/pages/home.ts` (lead):** sections now start after the chrome's reveal scan. Any section that
  adds `data-reveal` while it initialises must call `refreshChrome(scope)`. Workshops is fixed. Please check
  companies, wall and contact for the same.
- **gl:** the ripple race and the hero-canvas overflow above, in `src/gl/index.ts` `over()` / `stage.place()`.
- **chrome (FYI):**
  - Re-read `data-cursor` on attribute change, or expose a refresh.
  - On a mobile navigation in a test I saw an uncaught "Transition was aborted because of invalid state.
    Viewport size changed" (View Transitions).

## Note on a false alarm
In the dev server, a phone viewport can briefly show about 888px of horizontal overflow in its first
~200ms. The cause is `.companies__img` and the hero picture before Vite injects the CSS (dev only: the
build links the CSS in `<head>`). After that, a full scroll of the page shows 0 overflow on desktop and
on phones.

---

# review — homemid, pass 2 (answers to the critic)

Scripts for this pass: `scratchpad/agents/homemid/r2/*.mjs` (run with `node run.mjs r2/<x>.mjs`), PNGs in `shots/r2-*`.

## Fixed
- **Chrome read the seasons strip as dark (high).** The section's background is a `color-mix()`, which computes
  to `oklab(…)`, and the chrome's `parseRGB()` only reads `rgb()`. It fell back to `html[data-theme]`, still
  "dark" from the roots section. Fixed in my CSS: `.seasons` now paints the season as an image layer
  (`linear-gradient(var(--season-bg), var(--season-bg))`) over a plain `background-color: var(--sand)`. The chrome
  now reads a light rgb colour everywhere in the section, also mid-scroll before the bg system switches.
  - Measured: over the strip the cursor is the dark ring (it was a cream ring that disappeared on sage).
  - The header is the light band when it comes back over the strip (it was a dark olive band).
  - The focus ring is `--fruit` (it was cream). Photos still count as dark: over a photo the cursor stays cream.
  - I did not use the suggested `data-tone-hint`: the hint on a `[data-bg]` section only counts once the page
    bg is 'season', so the phone bar and the cursor would stay wrong while the section enters from below.
- **Focus ring on the ticks and the plaque (high).** The same fix makes the ring `--fruit`. That is 3.1–4.0:1 on
  the four season colours (computed: spring 4.03, summer 3.30, autumn 3.23, winter 3.09), so it meets 1.4.11.
  The ruler ticks also underline their name on `:focus-visible`, so the ring is not their only indicator.
- **Phone deep link lost focus (medium).** The cause is the browser's own fragment scroll for `#map`: on load
  it clears focus. There is no JS stack, and the time varies between runs. Fixes in `forest-map.ts`:
  - `select()` on phones now calls `holdSheetFocus()`. After `load` (+100/260/520 ms), and on any focusout to
    nothing, focus goes back to the sheet's link while the sheet is open and nobody else took focus.
  - A document keydown guard: while the full-screen dialog is open and focus sits on `<body>`, Tab enters
    the dialog and Esc closes the sheet, then the full screen.
  - `trapTab` also pulls focus back in from outside.
  - Closing the sheet (Esc, ✕, swipe) now moves focus to "סיום". Before, focus fell to `<body>` when the
    focused link was hidden.
  - Verified with motion and with reduced motion: focus ends on `fmc__link`, Tab stays in the frame,
    Esc → "סיום", Esc → back in the section with focus on the frame.
- **aria-current (medium).** Ticks and dots use `aria-current="true"` and remove it when inactive
  (`setCurrent()`); the CSS selector follows. The phone carousel has more semantics now:
  - `.seasons__viewport` is `role=region`, `aria-roledescription="קרוסלה"`, labelled by the section title.
  - The cards are `aria-roledescription="שקופית"`. The plaque slide stays a link.
  - The dots read e.g. "ימי גיבוש לחברות, 2 מתוך 4".
  - All of this is removed when the mode changes. axe: 0 violations in `#seasons` and `#map` (phone and
    desktop, motion and reduced).
- **iPad portrait (medium).** A touch screen held upright (height ≥ width) now gets the swipe carousel, in JS
  (`wantMode`) and in CSS (`(orientation: portrait) and (pointer: coarse)`). A tablet in landscape keeps the
  pinned strip; at 1180×820 there is 19 px between the lowest CTA and the ruler. The carousel title can grow to
  64px on a tablet (`clamp(38px, min(11vw, 12svh), 64px)`), so phones and a phone held sideways are unchanged.
- **Hint over the legend (medium).**
  - Up to 1100 px wide, or on touch, the hint moves to the other bottom corner, away from the legend. In the
    section it is also offset from the leaf's rounded corner. Phones keep it at the top centre, and so
    does the picker.
  - In full screen the legend is max-content in its corner instead of spanning the width.
  - The plan's fit now keeps room for the legend at the bottom, and on phones for the hint at the top:
    `fitPlan()`, which uses `Camera.fitState(r, pad, kCap, padBottom, padTop)`.
  - On phones, the fit follows `html.mbar-on`, which lifts the legend.
  - Checked at 1024×768, 844×390 (in the section and full screen), 820×1180 and 390×844. Nothing overlaps
    any more, and "כיתת חוץ", "כניסה" and the dog yard stay clear of the legend.
- **Dots 28×44 → 44×44 (low).** The visual dot is unchanged.
- **List scroll trap (low).**
  - On touch screens and at 768 px or less, the list frame is `min(--fm-h, 62svh)` high, so a good part of the
    screen is always the page.
  - `overscroll-behavior` is now `auto`, so the page carries on scrolling at either end of the list (checked:
    a wheel up at the list's top scrolls the page).
  - The map frame gets its full height back when you switch to "מפה".
- **Workshop links (low).** Each "שומרים מקום" link has a visually hidden suffix with the workshop, the weekday
  and the date. Example name: "שומרים מקום, סדנת נגרות: בונים ספסל ליער, יום שישי, 13.11.2026".
- **1024×768: the CTA touched the ruler (low).** `seasons.ts` measures the tallest card body plus its stagger before every
  ScrollTrigger refresh (`refreshInit`) and sets `--body-h` / `--stagger-h: 0px`. The photos take what is left.
  - The photo minimum went from 220 to 150 px. Short laptop windows overlapped too: 1280×620 by 25 px, and
    1366×657, a 768-px screen with browser bars, touched.
  - On short photos the leaf corner radius scales with the photo (`min(--leaf-r, 0.36 × img-h)`).
  - Measured gap between the lowest CTA and the ruler:

    | Window | Gap |
    |---|---|
    | 1024×768 | 21 px |
    | 1280×600 | 27 px |
    | 1280×620 | 25 px |
    | 1366×657 | 24 px |
    | 1280×720 | 22 px |
    | 1440×900 | 29 px |
    | 1536×864 | 31 px |
    | 1920×1080 | 29 px |

## Verified (dev :5202, screenshots looked at)
- Tone script: header, cursor, focus ring and phone bar over the strip, before and after the fix.
- Seasons sizes script at 1024×768, 1280×600/620/720, 1366×657/680, 1440×900, 1536×864, 1920×1080 and
  touch 820×1180 / 1180×820.
- "Stop animations" toggled inside the strip, both ways, desktop and phone: the reader stays in the section.
- Phone deep link focus trace, with motion and reduced. Desktop deep link: soft-pinned card, Esc closes it.
- `/plant` picker on desktop and phone: `?spot=0105` preselected, hint centred at the top, one map.
- No horizontal overflow at 390×844, 820×1180, 844×390 or 1024×768. No console errors from my code.
- `tsc --noEmit` is clean. `vite build` to scratch passes.

## Remaining / honest
- The real fix for the tone issue belongs in chrome. `parseRGB()` should normalise any CSS colour (paint it on
  a 1×1 canvas, or read it through `color-mix(in srgb …)`), or `bg.ts` should set `data-theme` for
  'season'. My CSS works around it for this section only.
- The phone deep link's focus fix waits for `load`. On a very slow load, a screen reader may announce the
  sheet link twice (once at open, once after the browser clears focus).
- The full-screen "סיום" pill on a tablet sits over the plan's north arrow. That is cosmetic.
- The list's group order is unchanged (planted 100 → benches → reserved → free). For a checkout, "free" first
  might serve screen-reader buyers better. I left it; it is a content decision.
- On a tablet held upright, the workshop rows use the phone's three-line layout. The desktop row needs about
  850px and does not fit at 820.
