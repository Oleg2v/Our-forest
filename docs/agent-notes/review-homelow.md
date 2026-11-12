# review — homelow (home: companies, wall, contact + the site footer on every page)

Reviewer pass over the "lower" agent's work (`docs/agent-notes/lower.md` still describes how each block works).
Brief areas: concept 254–258, §5 items 6–9 (684–698), §9 global interactions (dog, cursor, reveals), §11 mobile, §13 a11y, §15 readiness.
Every item below was checked in the running dev site (:5203) with Playwright, on desktop 1440×900, tablet 1024×768 and phone 390×844, plus reduced motion. I looked at the PNGs. Scripts are in `scratchpad/agents/homelow/`.

## Spec checklist (all present in the running site)
- **Companies:** the banner photo opens from a small leaf to the full screen. On desktop this runs under a CSS-sticky stage; on phones it is scrubbed in place. There are 3 packages with `ils()` prices and «החל מ־», the placeholder partner marks, «בואו להיות שותפים» and WhatsApp.
- **Wall:** the title and texts are from he.ts. There are two running rows of map dedications: the big row runs right → left, the small one the other way. Hover (desktop) or a touch (phones) stops them, and there is a visible pause button. There are 3 empty story slots (2 on phones), and the buttons «דברו איתנו» and «נוטעים עץ משלכם».
- **Contact:** the form has the dropdown «מה מעניין אתכם?» (options from he.ts), WhatsApp and «מושב פדיה». After sending, the seed falls into the ground and sprouts, and `generate_lead` is tracked.
- **Footer:** «בואו לנטוע» spans the full width. Each letter turns on its own base, swayed by the cursor, a finger or scrolling. The seed can be dragged into the soil (or pressed: keyboard / tap), and then a sprout and «נוטעים עץ משלכם» appear. Links, the legal row and the credit are there.
- **Dog:** it runs across the footer once, on desktop only, when ≥30% of the field is visible. Verified on `/` and `/legal/terms`: it runs in from the right, sits at the middle, then runs off to the left. It does not run on phones or with reduced motion.

## Fixed
- **Footer letters are CLS-free.**
  - **Before:** the fit was measured from the glyphs on screen, so when Frank Ruhl replaced the fallback, the font size, the field height and everything below it jumped.
  - **Now:** the font size, descender and gap position come from Frank Ruhl 400 metrics measured once (`FRL_ADV`, `FRL_DESC` in footer.ts). Each letter box is given its Frank Ruhl advance (`width: …em`), and footer.css computes the same fit before JS runs (`--big-fs` on the field).
  - After `document.fonts.load()` of that exact face, `calibrate()` checks the table on an offscreen probe. Normally this changes nothing. If another font is really in use, it re-measures once.
  - **Measured:** I held the font back for 3 s while the footer was on screen. The footer's layout shift went from 0.0091 to 0.0004 (desktop) and from 0.0011 to 0 (phone). Font size, field height and soil top are identical before and after the swap.
- **The dog's code is lazy.** footer.ts now does `import('./dog')` only on desktop, with motion on, when the footer is in view. `/business`, the legal pages, `/plant`, `/tree` and 404 no longer load the 10.9 kB chunk (home still preloads it because `roots.ts` imports it statically).
- **Theme-aware colours while the page background tweens** (the wall turns the page moss while the end of companies is still on screen, and the contact title enters while the page is still moss):
  - companies: `--cp-head / --cp-accent / --cp-price / --cp-card`. On moss, «מידע נוסף» and «הלוגו שלכם כאן?» were 2.3:1, and prices were 2.7:1. On moss, prices use a lightened fruit (#E8957A, 6:1).
  - contact: `--ct-head` for the title and subtitle (bark on moss was about 2:1).
  - footer brand name: the global reviewer's request.
- **The companies photo was soft on phones.** `sizes="100vw"` picked the 480w file, but the 16:9 photo is cropped to cover a portrait stage, so it needs about 1.5 screen heights of width. It now uses `(max-width:768px) 150vh, (max-aspect-ratio:16/9) 178vh, 100vw`, so a DPR2 phone now gets the 2400w AVIF (128 kB, lazy).
- **Text over the open companies photo.** The scrim is a little denser (flat moss .16 → .27). For cream type I measured 95% of the background pixels at ≥ 5:1 (eyebrow 5.1–5.7, title 5.0). Before, it was 4.4. The scrim now has `will-change: opacity`, because it is scrubbed every frame.
- **Contact send, on phones and desktop.**
  - The seed waited visibly above the panel (outside the sand) for about 1 s, and the two leaf fills showed as pale blobs before the stem drew. Now the seed fades in inside the panel as it falls, and the leaves stay hidden until their outline draws.
  - If the panel's top is off screen after the form collapses into the shorter thank-you (phones), it scrolls back under the header (`revealDone()`, via `scrollTo()`).
- **Contact a11y / UX.**
  - `.contact__note` was 4.17:1 (an axe "serious" issue), and `.contact__done-demo` was 4.18:1. Both are now 0.74 soil.
  - The empty select («בחרו נושא») was 0.55 alpha and is now 0.7.
  - Fields have `scroll-margin-block`, so a focused field or the first error never lands under the header or the phone bar.
  - The consent text uses `text-wrap: pretty`, so there is no orphan «קשר.».
- **Wall.**
  - It reads the dedications through the map module: `SPOTS`, `KIND_LABEL` and `speciesName` from `components/forest-map/data`, filtered to `status==='planted' && public`. No invented names.
  - A dash never opens a line (the space before «–» is an NBSP). This happened on phones.
  - The rows really stop on hover or pause, instead of endless sub-pixel repaints.
  - The «מפת היער» link has a 44 px tall target.
- **Touch targets (phones).** The footer legal links and credit are now ≥ 44×44 (they were 40 high, and «תקנון» was 32 wide), and the footer brand link is 44 high. The automated check of my four blocks now lists nothing under 44 px except text labels of 50 px fields.

## Verified (how)
- `npx tsc --noEmit`: 0 errors overall.
- **axe-core** (wcag2a/aa, 21a/aa), with each block brought to the reading line after scrolling the whole page:
  - desktop: 0 violations in `#companies`, `#wall`, `#contact` and `#footer`;
  - reduced motion: 0;
  - phone: 0 in companies, contact and footer. Wall: see "Remaining".
- **Footer on every page,** phone and desktop: `/`, `/plant`, `/tree/0427`, `/business`, the 3 legal pages, `/credits` and 404.
  - No horizontal overflow and no console errors.
  - The sticky bar is hidden over the footer and covers 0 legal links.
  - The letters fit is identical everywhere (335 px at 1440, 92 px at 390).
- **Footer interactions:**
  - mouse drag into the soil: hole → sprout → CTA focused, live status;
  - keyboard Enter with reduced motion: sprout, CTA focused;
  - phone tap;
  - the sprout persists after a reload;
  - the dog runs on desktop and is absent on phones and with reduced motion.
- **Contact:**
  - an empty submit gives 3 Hebrew errors, focus on the name field, and the status «יש 3 שדות לתיקון»;
  - a bad email gives its message, and the phone number is formatted 050-1234567;
  - a valid send gives `generate_lead {form:'contact', interest:'יום גיבוש'}` in dataLayer, focus on the thank-you, and the status «הפנייה נשלחה. תודה, נועה!»;
  - «שולחים פנייה נוספת» brings back the form and focuses the name field.
  - Tested on phone, desktop and reduced motion.
- **Runtime reduced-motion toggle** (emulated media, which fires the same `motion:change` as the a11y panel):
  - companies → static, then back to pin;
  - wall → static wrapped rows, the pause button hidden, then live and moving again;
  - no errors.
- **Keyboard Tab walk,** companies → footer: 35 stops in a logical order, all with the visible focus ring. The footer CTA is skipped while the seed waits. The companies title twin has no focusables and no second heading.
- **Production build** into scratch: the dog is its own chunk and is not in the legal or business HTML preloads.

## Remaining (honest)
- **Deep link `/#contact` lands in the wrong place (chrome; see the request).** It ends ~150–2600 px above the section, at the end of the companies banner. Cause: `land()` → `scrollTo(el)` → `lenis.scrollTo(element)` uses Lenis's stale `animatedScroll` after `ScrollTrigger.refresh()` restored the native scroll. In one trace, the target was 13913 while contact was at 13800; in other runs it landed at 11156. The `id` is on the section, and nothing in my files scrolls at load.
- **Wall on phone axe:** 3 `color-contrast` nodes are `.rv-w` words in the middle of the chrome's "words being read" reveal (2.1–4.3:1 while scrolling). They become full colour once read. This is the brief's own effect, owned by the chrome.
- **Companies clip-path scrub:** `inset() round` is a rounded-rect clip, the photo and the scrim are their own layers, and only the clip changes per frame. It is still untested on a real mid-range Android or iPhone (headless uses software GL). If it is heavy there, the fallback is a transform-scrubbed pre-rounded mask.
- **No-JS footer:** the letters are sized by the CSS fit, but before JS the letter boxes are the plain text run, so a late font swap could still move the glyphs inside the line. The boxes and the height do not move.
- The 2400w companies photo on DPR ≥ 2 phones is 128 kB AVIF. It is lazy, but the sharper image costs that.
- The WhatsApp number is still the placeholder in `format.ts`, used through `data-wa` → `waLink()`. The address is only «מושב פדיה» (a maps search link).

## Requests to other owners
- **Lead / chrome — `src/core/scroll.ts` `scrollTo()`, used by `src/chrome/transition.ts` `deepLink()`.** When `lenis` exists and the target is an element or selector, resolve it to a number from the native scroll: `y = el.getBoundingClientRect().top + window.scrollY + offset`. Then call `lenis.scrollTo(y, { immediate, duration: 1.2, force: true })` instead of passing the element.
  Why: after `ScrollTrigger.refresh()` sets `window.scrollY` natively, Lenis's `animatedScroll` is stale and element targets land off by that difference. `/#contact` (and the footer link «צרו קשר» from other pages) lands at the end of the companies banner instead of the contact title.
- **Hometop (`src/sections/home/roots.ts`):** nothing required. The footer now loads `./dog` lazily; home still ships it up front because roots imports it statically. That is fine on home, but if roots ever lazy-loads it too, the chunk leaves the home critical path as well.

---

# Pass 2 — the critic's findings (verified one by one)

All checks ran on my dev server (:5203) with Playwright; the no-JS check ran on a scratch production build (`vite preview` on :5213). I looked at the PNGs. Scripts and shots are in `scratchpad/agents/homelow/` (`*.mjs`, `s3/`).

## Fixed
- **The seed was hidden while you dragged it (desktop).** The chrome cursor's 78 px cream «גררו» disc sat right on top of the seed for the whole drag.
  - footer.ts now sets `html.sf-seed-drag` while the seed is being carried.
  - footer.css then drops the disc's fill and label for that time. The cursor becomes a thin ring in the cursor's own colour (soil on cream, cream over the soil), so the seed shows inside it.
  - Before you press, the «גררו» label still shows on hover.
  - I scoped this to the footer. The other «גררו» user is the map's pan view, where the disc does no harm.
  - Shot: `s3/foot-desktop-drag-b-drag.png` (seed visible at the soil line, ring around it).
- **The wall's by-line was ambiguous.**
  - The species always carries its noun now, through the map's own `speciesTitle()`: «עץ רימון», «עץ שקד». So «צוות הגינה של בית הספר · עץ רימון» no longer reads as "the Rimon school", and «כיתה ה׳ 2, באהבה · עץ שקד» no longer reads as "with love, Shaked".
  - If the signature already appears in the dedication, it is dropped. Bench 0922 now reads «מקום לנוח, מהחבר׳ה מהמושב · ספסל».
  - Screen readers get a visually hidden «, » between the dedication and the by-line. Checked from the DOM: «כיתה ה׳ 2, באהבה, עץ שקד» and «לכבוד הולדת נועה, משפחת כהן · עץ תאנה».
- **The companies photo on phones showed a man's back and grass.**
  - The fix is `object-position: 94% 50%` at ≤ 768 px. When fully open, the stage now shows the girl with the seedling and the boy planting beside her. The reduced-motion 4:5 leaf shows three people planting.
  - The zoom's `transform-origin` stays at the stage centre. That origin is in stage coordinates, so it is already the centre of the new crop.
  - Contrast of the cream title over the new crop (95% of pixels behind the glyphs): eyebrow ≥ 7.2:1, title lines ≥ 7.0:1 (`contrast.mjs`).
- **Contact send moved the footer without input (desktop).**
  - When the form sits beside the title (two grid columns, measured from the computed grid), the panel now keeps the form's height (`min-height`, `.contact__panel--held`). The thank-you sits centred in it. «שולחים פנייה נוספת» releases it.
  - In one column (tablet and phone) the panel still eases to the shorter thank-you. There the footer is below the fold, and on phones `revealDone()` brings the panel back.
  - CLS after a valid send, without recent input: desktop 0.0076 → **0** (footer top 888 → 888). Tablet 0. Phone 0.
- **Letters stayed frozen at a tilt** after «עצירת אנימציות», or after reduced motion turned on while the footer was off screen. Now `motion:change` always resets them. Checked with the a11y-panel flow: all `.site-footer__ch` transforms are empty.
- **The dog ran on every page view.** It now runs once per visit: a session flag `footer:dog` is set when it mounts.
  - Checked in one session: `/business` shows the dog. `/legal/terms` and a second `/business` show no dog and request 0 dog modules.
- **The footer word is now big on phones.** At ≤ 520 px «בואו» stands over «לנטוע», and each line is fitted to the full width. The longer word, 2.102 em in Frank Ruhl, sets the size: **171 px at 390** (it was 92 px), 157 px at 360 and 232 px at 520. From 521 px up it stays one line.
  - **CSS:** `--big-lines: 2`, the matching pre-JS fit `(100vw − 24px) × 0.4686`, and the space becomes the line break. The lower word sits 0.1 em closer, and its tall ל still clears the upper baseline.
  - **Without JS** the plain text breaks into the same two lines (checked on the build with JS off).
  - **JS:**
    - Each letter knows its own baseline (`ch.base`), so the brush only moves the letters of the line being touched.
    - Only the lower word has roots in the soil.
    - In the intro, the upper word rises a little and fades in, because it cannot hide in the soil.
    - A tap or keyboard press plants at the letter joint of the lower word nearest the centre. The sprout grows in front of the letters with its cream halo, as a desktop drag can already do.
    - The seed and the CTA are centred.
  - Late-font CLS on the phone footer is still 0. The desktop footer is unchanged: 335 px, one line, footer-attributed shift 0.0004.
  - Phone tap, phone touch-drag, desktop drag, and reduced-motion keyboard all plant, show the CTA and focus it. Checked with no overflow on `/`, `/plant`, `/tree/0427`, `/legal/terms`, `/business` and 404.
- An empty `gsap.set([])` on desktop (no upper line) printed "GSAP target not found". It is now guarded.

## Rejected / not mine
- **The high one: `/#contact` lands in the companies packages (desktop).** I traced it, and the cause is not the one in my earlier note.
  - Lenis clamps every `scrollTo` to its cached `limit`. That limit comes from a ResizeObserver that is debounced by 250 ms. On a deep link, the sections are built and the page keeps growing while `land()` runs, so the cached limit is stale and the target gets clamped. In the trace, `Lenis.setScroll(11156)` was called while contact sat at 13800, and 11156 was the old limit.
  - Resolving the element to a number (my earlier request and the critic's fix) does **not** help. With that patch, 3 of 4 runs still landed at 11156.
  - Calling `lenis.resize()` right before `lenis.scrollTo()` fixes it. I tested it by patching `scroll.ts` in flight (Playwright route): direct `/?mode=still#contact` 5/5 at top = 38, and footer «צרו קשר» from `/business` 3/3. Unpatched, from `/business`, 1 of 2 failed.
  - See the request below. Same-page anchors that go through `scrollTo()` get the same fix (for example the wall's «דברו איתנו» → `#contact`).

## Remaining (honest)
- `/#contact` (and any deep link that goes through Lenis) stays wrong on desktop until the one-line `scroll.ts` change is applied.
- On phones, axe still flags the same 3 `.rv-w` words of the wall text, part-way through chrome's "words being read" reveal. Desktop and reduced motion have 0 violations in all four blocks, and on phones companies, contact and footer have 0 too.
- In one-column layouts (tablet and phone), contact still tweens the panel `height` once after sending, for 0.9 s. It measures 0 CLS there, but it is a height tween, not transform/opacity.
- The stacked footer word on phones has not been checked on a real device (only in headless Chromium with touch emulation).

## Requests to other owners
- **Lead / chrome — `src/core/scroll.ts`, `scrollTo()`:** in the `if (lenis)` branch, call `lenis.resize();` before `lenis.scrollTo(target, { offset, immediate, duration: 1.2 })`. That makes Lenis recompute its `limit` and sync `animatedScroll` before it clamps. The scroll target can stay an element. This replaces my earlier request (numeric target), which I measured as insufficient. Verify with `scratchpad/agents/homelow/deep3.mjs http://localhost:<port>/?mode=still#contact 5` and `deepfrom.mjs /business 3`.
