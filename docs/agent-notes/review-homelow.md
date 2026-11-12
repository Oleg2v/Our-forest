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
