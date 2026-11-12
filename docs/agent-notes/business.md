# business — /business, 404, legal pages, credits, SEO

## Files
- `business/index.html` (head title/meta + `<main>`), `src/pages/business.ts`, `src/business/{index,art,steps,gallery,faq,form}.ts`, `src/business/business.css`
- `404.html` (`<main>`), `src/pages/notfound.ts`, `src/static/notfound.{ts,css}`
- `legal/{terms,privacy,accessibility}/index.html` (`<main>`, and see "head change" below), `src/pages/legal.ts`, `src/static/legal.ts`, `src/static/doc.css`
- `credits/index.html` (`<main>`), `src/pages/credits.ts`, `src/static/credits.{ts,css}`
- shared: `src/static/util.ts` (`syncCopy`, `whenMotion`, `smoothPath`, `rng`, `onResize`), `src/static/todo.css` (`.of-todo` placeholder marks)
- SEO: `partials/seo/{home,plant,business,tree,credits,notfound,legal,legal-terms,legal-privacy,legal-accessibility}.html`, `public/og/{home,plant,business,default}.jpg`, `public/robots.txt`, `public/sitemap.xml`
- generators: `src/static/tools/gen_seo.py` (rewrites partials/seo), `src/static/tools/og.mjs` (OG images; run with the dev server: `node src/static/tools/og.mjs http://localhost:<port> [name]`). Not part of the build. Lead: feel free to move them to `scripts/`.

## /business
The copy is in the HTML, verbatim, for SEO and no-JS. `syncCopy()` re-syncs `[data-he]` / `[data-ils]` from `he.ts` before the chrome splits headings.
Prices use `he.companies.packages[].price`, and the ₪ sign is drawn at 0.6em. Sections and backgrounds: hero (cream), packages (sand), how it works (soil), gallery (cream), FAQ (sand), form (moss).
- **Theme-aware text.** The chrome tweens the page background across section borders, so all my text uses `--ink` / `--ink-soft` / `--biz-h` (bark ↔ cream on `html[data-theme]`).
  Light cards and panels pin their own light tokens. Before this fix, hard-coded cream/soil text disappeared during the colour switch.
- **Hero**: leaf photo (`bizHero`) with chrome `data-reveal="leaf"`, slow inner parallax (desktop + motion), headline lines, CTA to `#partner` and WhatsApp.
  Phone: title → photo → text → stacked full-width buttons.
- **Packages**: three cards. Each has a line-art illustration generated in `art.ts` and drawn on view: 18 trees + the company sign; a team around a sapling; saplings with name tags.
  Prices are «החל מ־ … ₪ למשתתף/לעובד». The holiday card shows «ט״ו בשבט · 23.1.2027» until that date.
  "מבקשים הצעה" pre-selects the interest chip in the form (`track('select_item')`), and the chrome scrolls to `#partner`.
- **How it works = the page's motion idea.** Words stand above, four nodes sit on one line, and a single root grows through them (scroll scrub) while rootlets hang into the soil.
  Each node lights when the tip reaches it (halo, ring, icon draws itself with DrawSVG, a soft `pop`). The path is built from the measured layout (`smoothPath`) and rebuilt on resize and when fonts load.
  Phone: one vertical root down the node column, with rootlets only toward the screen edge. Reduced motion: drawn and lit.
  Step titles and texts are micro-copy derived from the brief's 4 steps and existing copy.
- **Gallery** (`bizGallery1–6`, real photos from the assets agent, alt from the manifest): on desktop a calm scroll-linked drift. RTL: the camera travels right → left. Photos drift a little inside their leaves.
  Phone: native swipe with snap and a progress line. Reduced motion on desktop: calm wrapped rows.
- **FAQ**: native `<details>`, with a height/word animation when motion is on. 8 practical questions with modest answers.
  Every unknown is a visible `.of-todo` mark "לאישור היער: …", including the **section 46** question. That one is an open question to the forest and claims no tax status.
- **Form**: name, company, phone (Israeli validation, `dir=ltr`), e-mail, employees (chips), interest (chips), message, consent (link to /legal/privacy).
  Errors are in Hebrew (`aria-invalid` + `aria-describedby`, focus moves to the first problem). It is a demo: nothing is sent.
  On success: `track('generate_lead', {form:'business', interest, employees})`, chime, and a sapling that draws itself. The page notes that the form is a demo. WhatsApp buttons in the hero, the FAQ, the form and after sending (`data-wa` prefilled).

## 404
A lonely leaf with a small falling-leaf model. It swings like a pendulum (falls fastest at the bottom of each swing), tumbles in 3D, and a soft wind carries it right → left.
The cursor pushes the air around it (repulsion + gust from pointer velocity). A click or tap is a puff. It lands on the ground line, rocks, and a gust lifts it again; if it leaves the screen it returns from the top.
Its colour follows the Israeli season. A hint "נסו לנשוב עליו" shows on hover devices. The rAF loop pauses when the tab is hidden or the stage is off screen.
Reduced motion: the leaf rests on the ground, and it re-rests on `motion:change`. The ground sits above the phone sticky bar. Copy: `he.pages.notFound` + «לעמוד הבית», plus /plant, /#map, /business, WhatsApp.

## Legal + credits
Long-form layout (`doc.css`): Frank Ruhl headings, ~68ch measure, numbered sections. The TOC is a "reading root": a line that fills as you read, with a leaf marking the current section (scroll-spy).
On desktop it is a sticky side column; on phones it is folded into a `<details>`. Print button with clean A4 styles. "More documents" cards.
Each page opens with a dashed **"טיוטת הדגמה"** notice (pending legal review), and unknowns are `.of-todo` marks.
- תקנון: services, orders, planting/plaques, and **cancellation per חוק הגנת הצרכן**: 14 days; services ≥ 2 non-rest days before; 4 months for 65+, people with disabilities and new immigrants in calls; fee 5% or 100 ₪, the lower; refund within 14 days.
  Also: engraved plaque / planted tree, workshops (the 7-day leisure exemption is marked for legal check), B2B by quote, gifts/vouchers, subscription cancellable any time within 3 business days, forest-side changes, visits/safety, IP, liability, law.
- מדיניות פרטיות: data table, purposes, cookies (GA4 / Meta Pixel only after "מאשרים", matching the chrome banner), sharing, abroad, public dedications, marketing (section 30א), security, retention, rights (sections 13/14/17ו), minors, contact.
- הצהרת נגישות: IS 5568 / WCAG 2.1 AA, regulation 35, what was done, the a11y panel, known limits, physical accessibility (all placeholders), accessibility coordinator (placeholders), date 12.11.2026.
- Credits: photo credits are rendered at runtime from `images.json` `credit` fields. Duplicates (hero + portrait) are merged; each entry shows a thumbnail, author, licence link, source and where the photo is used on the site. The summary counts pending or missing credits.
  Also fonts (OFL), libraries with licences, craft notes and a demo note.

## SEO
- **Production origin is hard-coded as `https://ourforest.kikkey.com`** (from `wrangler.jsonc`) in `partials/seo/*.html`, `public/robots.txt` and `public/sitemap.xml`.
  If the domain changes: edit `SITE` in `src/static/tools/gen_seo.py`, re-run it, and replace the origin in robots/sitemap.
- Canonicals and the sitemap use trailing slashes (`/plant/`), because CF `html_handling: auto-trailing-slash` redirects `/plant` → `/plant/`.
- og:image is absolute 1200×630 with alt. Twitter `summary_large_image` is in head-common.
- JSON-LD per page: home → LocalBusiness (Moshav Pedaya; **no telephone/contactPoint — the number is a placeholder**) + WebSite + WebPage + **3 Events** (demo dates 27.11 / 4.12 / 12.12.2026, prices 280 / 216 / 150 ₪ from the plant catalog, offers → `/plant/?product=workshop&ws=…`).
  plant → Product + Offer 540 ILS. business → Service + OfferCatalog (3 offers, unit prices). tree → WebPage (og → `/og/tree-0427.jpg`). legal / credits → WebPage + BreadcrumbList. 404 → `noindex, follow`, no canonical.
- **Head change outside `<main>`.** The three legal pages now include `partials/seo/legal-<page>.html` (per-page canonical + JSON-LD, which nests the shared `legal.html` OG) instead of `legal.html` directly.
  This is needed because one shared partial cannot carry three canonicals.

## Verified
- `tsc --noEmit`: 0 errors in my files. `vite build --outDir <scratch>`: OK. In the built HTML, every JSON-LD block parses (9 pages), og:image and canonical are correct per page, and 404 is noindex.
- Screenshots (`scripts/shot.mjs` + my own Playwright scripts) on desktop 1440, mobile 390 and `--reduced` for /business (whole page), 404 (motion + rest), terms, privacy (table on mobile) and credits.
  No console errors and no horizontal overflow anywhere.
- Interaction script on /business: package pick → chip checked + `select_item`; empty submit → 5 Hebrew errors, focus on the name field; valid submit → done panel focused + `generate_lead`; FAQ open/close.
- **axe-core** (wcag2a/aa, 2.1a/aa, best-practice) on `<main>` of all 6 pages, desktop and mobile: **0 violations**.

## Known gaps / honest notes
- Event dates in `partials/seo/home.html` are static demo dates. They must match the workshop dates the home page shows; I could not see that section, which another agent is building.
  In production they come from the CMS. They also go stale after December 2026.
- `/og/tree-0427.jpg` is referenced but made by the tree-ui agent. If it is missing, the tree page's preview has no image.
- The legal texts are careful drafts, not legal advice. Section numbers and rules I was not fully sure of carry a «לבדיקה משפטית» mark: the 7-day leisure exemption, the voucher term, and the wording of rights in the tree.
  The accessibility statement claims a text list for the map and button alternatives for gestures. Those belong to other agents and are brief requirements, but I did not verify them.
- The gallery drift and the root scrub were tuned only in headless Chromium, not on a real mid-range Android or iPhone.
- In headless tests a programmatic native scroll right before a click leaves Lenis with a stale position, so an anchor jump lands short. Real wheel or touch scrolling is unaffected. This is chrome/Lenis behaviour, not mine; noted only for whoever writes e2e tests.
- I ran one read-only `git status` by mistake (the no-git rule). Nothing was changed.

## Requests
- **Lead**: keep the head change on the legal pages (see above). Optionally move `src/static/tools/*` to `scripts/`.
  Set the real WhatsApp number / phone, the legal entity, e-mails and the accessibility coordinator. Then add `telephone` / `contactPoint` to the LocalBusiness in `gen_seo.py`.
- **Home seasons / workshops agent**: please show the same three workshop dates and prices as the Event JSON-LD, or tell the lead which ones you show.
- **Tree-ui agent**: `public/og/tree-0427.jpg` (1200×630) is expected by `partials/seo/tree.html`.
