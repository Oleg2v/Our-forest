# lower: home 6 companies, 7 wall, 8 contact + the site footer (all pages)

## Files
- `partials/home/companies.html`, `src/sections/home/companies.ts` (+ `.css`)
- `partials/home/wall.html`, `src/sections/home/wall.ts` (+ `.css`)
- `partials/home/contact.html`, `src/sections/home/contact.ts` (+ `.css`)
- `partials/footer.html`, `src/components/footer.ts` (+ `footer.css`). The `initFooter()` contract is unchanged. `bootPage` calls it on every page.

All copy is in the HTML verbatim (for no-JS and SEO). At init, each module re-syncs `[data-he]` from `he.ts`, and companies also syncs `[data-ils]` prices from `he.companies.packages[].price`.
Micro-copy I added (the brief gives none), kept minimal:
- "שותפים", "הלוגו שלכם כאן?"
- "כל הקדשה היא עץ על מפת היער", "עצירת/הפעלת התנועה"
- the slot label "כאן יופיע סיפור אמיתי מהיער"
- "בחרו נושא", "שדות חובה", the form errors and status lines, the thank-you texts, "שולחים פנייה נוספת"
- "גררו את הזרע אל האדמה", "מפת היער", "קרדיטים: צילומים, גופנים וקוד פתוח"

## 6 · Companies (`#companies`, data-bg=sand)
- **Motion idea: the banner photo opens on scroll from a small leaf to the full screen.**
  - **Desktop:** the banner is 260vh with a CSS-sticky 100vh stage, so there is no GSAP pin and no pin-spacer. A scrubbed `clip-path: inset(... round r 0 r 0)` opens a leaf (about 25% × 44%) into a full-bleed rectangle. The leaf radius flattens to 0, the photo scales 1.32 → 1 and a moss scrim deepens.
  - The title has a cream twin inside the clipped photo layer (`aria-hidden`, h2 converted to a div), so the title changes colour exactly at the leaf's edge. The title lines rise from masks on enter.
- **Phones:** no pin. The same opening is scrubbed while the 86svh stage crosses the screen.
- **Reduced motion:** a static title, then the photo in a leaf, all visible.
- Below the banner:
  - subtitle and text
  - three packages: grove 9,000 ₪, team day 220 ₪ למשתתף, holiday 180 ₪ לעובד. Each links to `/business#packages`. Line icons draw themselves.
  - a strip of 5 abstract line marks plus a dashed "הלוגו שלכם כאן?" slot that links to /business. The marks are `aria-hidden`, with one visually-hidden sentence for screen readers.
  - the buttons "בואו להיות שותפים" (→ /business) and WhatsApp (`data-wa` prefilled; the chrome tracks `whatsapp_click`).

## 7 · Wall (`#wall`, data-bg=moss, data-header=light)
- Dedications come from `src/data/trees.json`, filtered to `status==='planted' && public===true`, unique dedications only. The placeholder signature "שם החברה" is dropped. The species or kind name comes from `he.plant.species`.
  The order is a stable hash, and 0427 "לכבוד הולדת נועה" opens the big row. Rows: 14 short dedications in display size, 22 in the small row.
- **Motion idea: two quiet rivers of names.** The big row travels right → left and the small one left → right. A small `gsap.ticker` drives both with speed easing.
  - A scroll "gust" (ScrollTrigger velocity) speeds them up a little.
  - Hover on desktop eases both rows to a stop and dims the other items. On touch, a finger on the band holds them for 2.6 s.
  - The ticker runs only while the band is in view.
- **A11y:** a visible pause button (`aria-pressed`, WCAG 2.2.2). The first copy of each list is a real `<ul>`; the loop clones are `aria-hidden`.
- **Reduced motion / "stop animations":** no ticker. The items sit in calm, centred, wrapped rows (desktop 6 + 10, phone 4 + 6).
  This switches live on `motion:change`, and the rows re-measure when fonts load and on resize.
- **Testimonials are NOT written.** There are 3 empty slots (2 on phones): a dashed leaf portrait frame with a line sprout, quote "lines", and a quiet label "כאן יופיע סיפור אמיתי מהיער".
  They are `aria-hidden`, with one visually-hidden sentence.
- Buttons: "דברו איתנו" → `#contact`. It is theme-aware: `--ink` on `--page-bg`, so it is readable at every point of the background tween. "נוטעים עץ משלכם" (fruit) → /plant.

## 8 · Contact (`#contact`, data-bg=cream)
- Layout: a huge title, the subtitle and text, then WhatsApp and the address "מושב פדיה" (a maps link). The sand leaf panel holds the form.
- **Form:** underline fields:
  - name *, phone * (`dir=ltr`, Israeli mobile/landline, +972 accepted, formatted `050-1234567` on blur)
  - email (optional, but checked if filled)
  - select "מה מעניין אתכם?" with `he.contact.interest.options`
  - message
  - consent * with a link to /legal/privacy
  - submit "שלח"
- **Validation:** `aria-invalid` + `aria-describedby`, Hebrew messages, focus on the first problem, and a polite `role=status` live line ("יש 3 שדות לתיקון" …).
  JS sets `novalidate`. Without JS the native `required` checks run, and `method=post` keeps personal data out of the URL.
- **Send (demo, no network):** `track('generate_lead', {form:'contact', interest})`. The form fades, the panel eases to its new height, and focus moves to the thank-you block ("תודה, <first name>").
  The panel says it is a demo, and offers WhatsApp and "שולחים פנייה נוספת" (which resets the form and focuses the name field).
- **Motion idea (after sending):** a seed falls with gravity, hops once, and the soil specks jump. It sinks under the surface (clip-path), a mound closes over it, and a sprout draws itself (DrawSVG, leaves with a light elastic).
  Sounds: crack, pop, chime. Reduced motion: the sprout is simply there.

## 9 · Footer (every page, `#footer`, data-bg=cream)
- **Content:**
  - brand + tagline
  - nav (he.nav → `/#story`, `/#directions`, `/business`, `/#contact`) and a second column: /plant, /plant?gift=1, /business, /#map
  - WhatsApp, address
  - **"בואו לנטוע"** across the full width
  - the soil band with legal links (תקנון /legal/terms, מדיניות פרטיות /legal/privacy, הצהרת נגישות /legal/accessibility), «© year היער שלנו. כל הזכויות שמורות» and the credit line → /credits
- **Letters as grass:** the letters are fitted to the field width in JS and stand on the soil line; the descender is measured, so each letter turns around its baseline. Each letter is a damped spring (`rotate` only).
  - A slow gust travels through them right → left.
  - The mouse brushes them: horizontal speed × proximity × how high you touch.
  - On touch, a finger moving over the words pushes them. Scrolling is a soft breeze (stronger on phones).
  - On first view the letters rise out of the soil and their roots draw in the soil (seeded, the same every visit). The ticker runs only while the field is visible.
- **Seed → ground:** a seed with a dashed ring and the hint "גררו את הזרע אל האדמה" sits above the gap between the words. You drag it (pointer events, capture).
  - A hole opens in the soil when the seed is near or over it. If you drop it there, it sinks behind the soil.
  - A sprout grows at that spot, the letters lean away from it, and the fruit button **"נוטעים עץ משלכם"** appears where the seed was.
  - Dropping it elsewhere springs it back.
  - **The keyboard/tap alternative:** the seed is a `<button aria-label="זורעים את הזרע באדמה">`. Enter, Space or a tap tosses it into the gap, and focus moves to the CTA.
  - While the seed waits, the CTA is hidden (`tabindex=-1`, `aria-hidden`). Without JS, the CTA is simply visible.
  - The planted state persists for the session (`sessionStorage of:footer:sprout`), so other pages show the sprout and the button.
- **Dog:** on desktop with motion, the first time the field is ≥30% visible, `mountDog(field, {mode:'runAcross', autoplay:false, ground:6}).runAcross()` runs, and the dog is destroyed afterwards.
  It runs along the soil line. A cream halo filter (`#sf-halo`, applied via `.site-footer .dog__svg`) keeps the bark dog readable where it crosses the olive letters.
- **Mobile:** smaller fitted letters, two-column links (44px targets), stacked legal links, and `padding-bottom: 80px + safe-area` for the chrome's bar. That bar also hides itself over the footer.

## Verified
- `npx tsc --noEmit`: 0 errors in my files (and 0 overall at the end).
- Dev server :5186. I used `scripts/shot.mjs` plus my own Playwright scripts in the scratch folder: `sec.mjs` for section-relative shots, `footer-play.mjs`, `form-play.mjs`, `overflow.mjs`. I looked at the PNGs.
  - Desktop 1440 / tablet 1024 / mobile 390, and `--reduced`, for all four blocks.
  - Footer on `/`, `/business` and `/plant`.
- Footer: a mouse brush (the letters lean), a mouse drag into the soil (hole → sprout → CTA), keyboard Enter (the CTA gets focus, the live status reads), mobile tap, and reduced motion.
  Also: after a reload the sprout persists, and the dog runs on desktop.
- Form: an empty submit gives 3 errors with focus on the name field; a bad email gives its message; the phone formats; a valid submit gives `generate_lead` in dataLayer, focus on the thank-you block, the live status, and a working reset.
- No console errors from my code, and no horizontal overflow from my blocks on mobile or desktop.

## Known gaps / honest notes
- **Timing on real devices was not checked.** The machine was loaded and headless uses software GL. The scrub smoothness of the companies leaf (clip-path inset repaints a full-screen photo), the marquee and the grass physics are untested on a mid-range Android or iPhone.
  If the clip-path is heavy on weak phones, the fallback is to scrub only `transform` on a pre-rounded mask.
- The companies cream twin title is a DOM clone made at init. If `he.ts` copy changes at runtime it would not follow, but nothing does that.
- `/business#packages` relies on the business page id `packages` (it exists today).
- The footer letters are fitted on fonts-ready, on load and on resize. Before Frank Ruhl loads they are sized with the fallback serif, so they can shift slightly once.
- The headless deep link `/#contact` landed on the hero in one run. This is the chrome/Lenis re-land after load, not my markup; the `id="contact"` is on the section.
- **Other sections, not mine, seen while testing:**
  - `.seasons__float` overflows the page on desktop (scrollWidth 1535 > 1440).
  - `seasons.ts` warns "GSAP target not found" on mobile.
  - `seasons.css` was missing for a while (a vite overlay). I stubbed seasons in some of my test runs for that reason.
- The address is plain "מושב פדיה" with a Google Maps search link; there is no real street address in the brief.
- The WhatsApp number is the placeholder from `format.ts`.

## Requests to other owners
- **Seasons owner:** `.seasons__float` causes horizontal overflow on desktop (left −95px), so please clip it. `seasons.ts` `headIn`/`onEnter` target missing elements on mobile.
- **Chrome:** nothing is required. The footer uses `data-bg="cream"`, and the bar's footer observer works with `#footer`. Optional: the cookie card covers the footer's legal row on desktop until it is answered, which is acceptable.
- **Lead:** set the real WhatsApp number and, if there is one, a precise address / Waze link in the contact aside and the footer.
