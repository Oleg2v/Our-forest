# review — /plant (configurator, mock payment, certificate)

Reviewer of `plant/index.html`, `src/plant/**`, `src/pages/plant.ts`, `src/components/plaque/**`, `partials/seo/plant.html`.

## Fixed
- **Real forest map in the location step (picker), end to end.**
  - The map renders in the step. Free spots call `onSelect`. `initialSpotId` and `select()` are honoured.
  - The picker gets explicit `kinds` from the order, through the new `src/plant/spots.ts`: a tree gets tree spots, a corner gets corner spots, and carpentry gets the chosen item's kind (bench, table or fire place), or all three for a kitchen or an outdoor class. When the carpentry item changes, the picker is rebuilt. A spot that no longer fits is cleared.
  - Phones (390×844): choosing "בוחרים על המפה" folds the stage away (`.pc.is-map`) and gives the map a frame of `clamp(320px, 56svh, 520px)`. The sheet then scrolls so both options and the whole map are in view. Before this, only about 150 px of the map showed at the bottom of the sheet. Tapping the sheet handle brings the stage back.
  - The map module and its CSS (about 60 kB JS + 23 kB CSS) are now **lazy**. They load when the map is opened, and are warmed up 0.9 s after the location step appears. `spots.ts` reads `src/data/trees.json` directly. The old MutationObserver and stub fallback path are gone. The mini plan is still used if the import fails or the map renders nothing.
- **`?spot=` deep links are validated.** The spot must exist, be free and be of the right kind. Otherwise the order falls back to "תבחרו בשבילנו", and the location step says why, in one line: «המקום 0612 כבר לא פנוי. נבחר לכם מקום טוב, או שתבחרו אחר במפה.» (micro-copy).
  - `0612` (the example in BUILD.md) is not in `trees.json`, so it now degrades gracefully.
  - Real links from the home map (`?species=…&spot=0101`, `?product=bench&item=table&spot=0912`, `?product=corner&spot=0962`) restore and highlight the spot.
  - Switching product (tree ↔ bench ↔ corner) drops a spot that does not fit the new product.
- **Corner mode overlap.**
  - The corner's own parts now sit left of the plaque: the bench and two herb pots.
  - The lantern hangs in front of the crown's lower left, mirroring the gift tag.
  - The extras have their own corner layout (`PROPS_CORNER`): the watering can is on the left, and the certificate, box and family are on the right. Nothing overlaps for any of the 6 species, with all 4 extras and the gift tag.
  - Switching between tree and corner re-places the extras that are already shown.
- **Done view and certificate.**
  - The stamp moved up so it no longer covers the "היער שלנו" signature label in print.
  - Workshop tickets: the QR code and WhatsApp share now open the same workshop session. Before, they opened `/tree/0427?birth=1`.
  - Carpentry:
    - The title is «נגרות עם הקדשה», not «העץ שלכם בדרך לאדמה».
    - There is no "צפו בעמוד העץ" button.
    - The certificate shows the item icon, not an olive tree.
    - The number reads «מקום מס׳ 0912», or the item name when the place is auto, instead of «עץ מס׳».
    - The QR code and share open `/#map`.
  - The certificate module (with `qrcode-generator`, about 33 kB) now loads during the 1.5 s mock payment instead of on page load.
- **a11y** (axe wcag2a/aa/21a/aa: now **0 violations** on every step of tree, memorial, bench, workshop and corner, desktop and mobile, including the open map and the done view):
  - The rail buttons had an aria-label that did not contain their visible text (label-in-name). They now use visible text plus an sr-only title.
  - The desktop "next" button no longer has an aria-label that did not match its visible "הבא · …" text. The bullet is `content: '·' / ''`.
  - " / 08" was at 3.11:1 and is now ink-soft. The next-step hint on the olive button was at 4.01:1 and is now at 92 % opacity.
  - Small `--fruit` prices on the sand surfaces (stage, chosen card or extra) were at 4.26:1. They now use the same fruit, a shade deeper (`color-mix` 86 % with soil).
  - **Keyboard focus loss**: on the payment step the next button hides. Pressing Enter on "ממשיכים לתשלום" used to drop focus to `<body>`. Focus now moves to the "תשלום" heading.
  - Headings focused from script (step titles, done title) no longer show the fruit focus outline (`data-focus-ring="none"`).
- **Hebrew/RTL**: "משלמים 540 ₪" on the pay buttons (bar, desktop next, form submit) now isolates the price in `<bdi>` (`isoPrices()`). The ₪ sits in the same place as in every other price on the site. Checked by measuring glyph positions.
- **Design rule**: "נשארו N מקומות" on the workshop dates used `--fruit` for low counts. It now matches the home list: ink-soft, and bark 500 when 3 or fewer seats are left.
- **Short screens**:
  - Desktop windows ≤ 760 px tall (e.g. 1366×650): the stage hides the season line and the recap lines. Before, the tree shrank to about 80 px and the CTA was cut off at the bottom. The minimum stage height is 500 instead of 620.
  - ≤ 580 px tall (a phone in landscape, 844×390): the stage scrolls with the page instead of sticking taller than the viewport.
- **Phones**: the sheet no longer tucks 24 px under the header when the stage is folded (map, typing, full).
- **WhatsApp inside the flow**: on phones the site-wide sticky bar (נוטעים עץ + WhatsApp) is hidden on /plant. A quiet 44 px link «שאלה לפני שמשלמים? כתבו לנו בוואטסאפ» (micro-copy) now sits on the summary and payment steps.

## Measured
- **Hero → paid on a phone (390×844, touch)**, script `scratchpad/agents/plant/m.mjs --from-home`:
  - The fastest path takes **11 taps** plus typing a name and a phone: the hero CTA, 7 × "הבא" (all optional steps keep their defaults, place = "תבחרו בשבילנו"), name, phone, then pay.
  - Scripted time is **14.5 s** with 350 ms between taps, the page transition and the 1.5 s mock payment. A human, one-handed, should take about 30–40 s: every "הבא" is at the same thumb spot in the bar.
  - On desktop the stage's "ממשיכים לתשלום" jumps straight to payment, so it takes 5 actions.
- **Print**: `page.pdf({format:'A4'})` gives **1 page** for the tree, memorial, carpentry and workshop orders. I looked at the PNG renders.
- Workshop dates and prices: `/plant`, the home list (`seasons-workshops.ts` imports `WORKSHOPS` and `workshopDates()`) and the Event JSON-LD in `partials/seo/home.html` all agree on the demo date: carpentry 13.11 at 280 ₪, garden 14.11 at 150 ₪, dogs 20.11.2026 at 216 ₪. The 27.11 / 4.12 / 12.12 dates in the task brief came from an older `business.md`. The global reviewer has since aligned the JSON-LD with the list (see `review-global.md`), so I changed nothing. Carpentry 27.11, dogs 4.12 and garden 12.12 are still offered as the 2nd/2nd/3rd sessions.

## Verified (how)
- Playwright scripts in `scratchpad/agents/plant/`:
  - `m.mjs`: the mobile flow from `/`.
  - `map-sel.js`: desktop click and mobile touch on the real map.
  - `lost.js`: spot deep links, product switch and item switch.
  - `corner.js`: 6 species × all extras.
  - `print.js`: done view + A4 PDF.
  - `axe.js`: every step + done, all products.
  - `motion.js`: the a11y panel's "stop animations" toggled mid-grow and mid-burn. Final states are shown and there are no errors.
  - `keys.js`: keyboard-only purchase.
  - `nav2.js`: back/forward, rotation to landscape and back, phone ↔ desktop width on the plaque step.
  - `kb2.mjs`: simulated on-screen keyboard. The plaque stays fully above the field.
  - `vp.js`: 1366×650, 844×390, 1024×768.
  - `bidi.js`: where the ₪ sits.
- No console errors or warnings and no horizontal overflow in any of these runs. `npx tsc --noEmit` gives 0 errors in the whole project.

## Remaining (honest)
- Phone picker: zoomed out, the map shows clusters, so picking a tree spot takes 2 taps (cluster, then spot). The selected spot's mark is subtle (a small check in the ring). Both are the map's design, owned by the map reviewer.
- "צפו בעמוד העץ" always opens the demo tree 0427, and the certificate number is the chosen spot or 0427. This is unchanged and is a demo limitation.
- A link with a taken spot keeps `spot=` in the address bar until the next change rewrites the URL. The notice shows again on reload, which is harmless.
- On phones the stage (31svh) stays above the payment form. The payment methods are one short scroll below the email field.
- Keyboard behaviour is still simulated (a viewport resize), not tested on a real iOS or Android device.

## Pass 2: the critic's findings (all 14 checked, all were real, all fixed)

### Fixed
- **(high) Phone sheet scrolled the page.** `initPlant` adds `html.pc-sheet`. At ≤ 768 px this sets `overflow: hidden; overscroll-behavior: none` on `<html>`, so the document no longer scrolls under the sheet. Only `.pc__scroll` scrolls, which also stops pull-to-refresh and bounce. The class is removed when the done view appears, so the receipt and footer scroll normally. Turning to portrait resets `scrollY` to 0.
  - CDP touch swipes on the stage, the bar and the sheet now leave `scrollY` at 0 and the bar top at 771 (before: 205 / 590). Script: `scratchpad/agents/plant/swipe.mjs`.
- **(high) Done view.**
  - The copy (eyebrow, title, a new summary line, lead, buttons) now appears 0.1 s into the timeline, while the paper prints. Before, it waited about 3 s for the stamp.
  - New phone layout: the title, then the printer, then the details. `.pdone__copy` uses `display: contents` and the children are ordered.
  - The certificate is capped at `(100svh − header − 260px) / 1.414`, so the whole sheet and the stamp land above the action bar. At 390×844 the stamp is at y 549–628 and the bar starts at 771.
  - The actions are a sticky bottom bar where "pay" was: «צפו בעמוד העץ» plus «שתפו». The full «שתפו בוואטסאפ» stays the accessible name. Bench and workshop show only «שתפו בוואטסאפ», full width.
  - Print is a quiet link under the lead.
- **(low) Certificate legible on a phone.** A summary line «עץ זית · 12.11.2026 · המקום: תבחרו בשבילנו» now sits under the done title on both layouts. Workshops show the title, date with 09:00, and N משתתפים. The certificate itself stays a true-to-scale picture of the A4.
- **(medium) Back after paying.** History entries of /plant are now numbered (`pi` in `history.state`; `store.ts` pushes `pi+1`). `purchase()` stops the store from writing the URL and replaces the done entry with the order URL without `step` (a reload opens step 1 with the same choices, not the payment form). Back from the done view:
  - If the visitor came from another page: `history.go(-(pi+1))`, straight back there.
  - If /plant was opened directly: back to the first /plant entry, then a fresh configurator.
  - Script `back.mjs`: one Back goes from the done view to `/`.
- **(medium) Stage art cropped at 769–1000 px.** `.pst__scene` is now a size container. The art is `width: min(100cqw, 100cqh·240/260, 443px)` with the aspect ratio kept. `clip.mjs` covers 11 viewports, including 820×1180 and 900×1100, and all are OK. The 844×390 short-screen rule turns the container off.
- **(medium) Enter in the engraving field.** `Ctx.next({ focus: true })` now moves focus to the next step's h2. The field still blurs, so the phone keyboard closes. Checked on desktop and phone: Enter → `H2#pcs-location-t`, then Tab → the first option. The bar and next buttons no longer pass the click event into `next()`.
- **(medium) Gift postcard on phones.**
  - The paper was clipped because GSAP read the CSS `translateY(-58%)` back as `y` px and then added `yPercent: -58` on top (double rise). Every set now passes `y: 0`.
  - On phones the fields come first («למי?» is at y 602, above the bar). The envelope sits under them and opens when it scrolls into view (IntersectionObserver on `.pc__scroll`).
- **(medium) Season line** («…והעץ נכנס לאדמה…») now shows only for tree and corner, on the stage and in the phone summary.
- **(medium) Carpentry and workshop stage.**
  - Carpentry: each piece (bench, table, fire place, kitchen, outdoor class) is drawn in the stage's own coordinates, in the same line style with a light wood fill. The olive steps back and to the side (`.pst__grove`: translate 34, scale .82, a 1 s transition). Nothing shows through the piece.
  - The plaque is mounted on the piece: the backrest, under the tabletop, the counter front, under the pergola beam, or on a stake beside the fire. Positions are in `plant.css` `[data-item]`.
  - The old 24 px icon overlay (`.pst__item`) is gone.
  - Workshop: the session's photo (`wsCarpentry` / `wsDogs` / `wsGarden`) fills the scene in a leaf, with cream chips for the weekday, date, 09:00 and N משתתפים. It crossfades when the workshop changes.
- **(low) `2 × 280 ₪`.** The seats line is one isolate, as in the summary row. Measured glyph order matches the summary row: `3×280₪`.
- **(low) Recap buttons on the stage.** The name is now «שינוי <label>: <value>» (sr-only prefix). A pencil shows on hover and focus.
- **(low) Phone touch targets.** The product tabs and rail nodes are now 44 px tall. The rail dot stays 13 px, and the rail line moved to match.
- **(low) Desktop map.** After «בוחרים על המפה», if the map's bottom is below the window, the page scrolls the options to just under the header. At 1366×700 the map ends at y 196–496. The pan and zoom on select belong to the map (see requests).
- **(low) Stamp versus six facts.** The stamp is anchored to the footer row, between the QR note and the signature, at a position that does not depend on how many facts there are. A4 PDFs for memorial + gift (6 facts), workshop and tree with a spot: 1 page each, and the stamp is clear of every fact.
- Also: the gift row of the summary no longer starts with « · » when «למי?» is empty.

### Remaining (honest)
- The phone sheet lock means the footer cannot be reached on /plant while configuring on a phone. The menu (header) still has every link, and the footer returns after paying. This is intentional for a checkout sheet.
- `arrivedWithHistory` uses `history.length > 1` at load. A reload of a mid-flow entry can overcount, but Back still leaves /plant, only by a different route. A skip-link hash entry (state without `pi`) can make Back from the done view stop one entry short.
- The certificate's own small print (6–7 px labels at 330 px wide) is still small on a phone. The summary line repeats the essentials, and the PDF is full size.
- The stage pieces for carpentry are new drawings, made by me. The fire place is the plainest of the five.
- Still simulated, not on real devices: iOS Safari with `overflow: hidden` on `<html>` plus the on-screen keyboard (`--vvh`).
