# review — global (chrome, /business, legal, 404, credits, SEO/PWA basics)

Reviewer pass over the chrome + business agents' work. The brief's areas this covers are: §5.1 header, §8 /business, §9 global interactions and winner details, §11 mobile, §12 tech, §13 a11y and §15 readiness.
I checked everything below in the running site, using Playwright on desktop 1440 and phone 390×844, plus reduced motion and production builds with Lighthouse 12. Reading the code alone was not counted as a check.

## Fixed
- **Cookie card covered the main buy button.** On the phone home hero it sat on «נוטעים עץ משלכם», and on phone /plant it sat on the plant's own price bar. `cookies.ts` now avoids collisions.
  It starts in the bottom corner on the reading-start side, above the phone bar. If a primary button is under it, it moves to the other bottom corner (desktop) or under the header (phone).
  Primary buttons are `.btn--fruit`, `.btn--lg`, `.pc-bar`, `.tdock-card` and `[data-cookie-avoid]`. On phones, `html[data-hide-sticky]` (a page with its own bottom bar) also counts as one.
  The check runs again when scrolling settles, on resize, and when the phone bar or `data-hide-sticky` changes.
- **Cookie keyboard order.** When the card appears, it moves in the DOM to right after the skip link. Tab order is now: skip link, privacy link, «מאשרים», «רק הכרחיות», header.
  Hover styles apply only on hover-capable devices, so they don't stick on phones.
- **Phone sticky bar flashed before JS.** The bar painted, hid, then slid in. CSS now keeps it down until `data-ready`. The head failsafe adds `html.chrome-off` if the chrome never starts, so no-JS visitors still get the bar.
- **Header readability.**
  1. Section hints (`data-header`) on transparent `[data-bg]` sections now count only while the page actually shows that section's colour. Before, the bottom of /business «איך זה עובד» forced cream text over the cream gallery.
  2. When the header is light over a photo at the top of a page, a soft moss shade sits behind it (`.site-header::before`, .6 → 0).
     On the home hero, the worst sample (next to the sun) went from 2.1:1 to 4.3:1. On the tree intro's cream band it went from 1.1:1 to 3.4:1, and that one still needs the tree-ui fix below.
  3. The compact header background is denser: moss .58 → .68, cream .74 → .80.
  Audit: header text contrast was sampled under the header at every 450–600 px of every page, on phone and desktop.
  /business, legal, credits, 404, /plant and home on phone pass ≥ 4.5:1 at every step. Home on desktop fails only at y = 0 next to the sun (4.27). The tree intro on phone is at 3.4.
- **Header intro hid the header CTA on slow networks (every page).** It now applies only on the home page, after the preloader. On other pages the header and «נוטעים עץ משלכם» paint with the first frame.
- **Late JS failsafe.** If the head failsafe has already shown the content (JS later than 3 s), `reveal.ts` no longer hides it again.
- **"Words" reveal versus contrast.** Paragraphs that are "read" on scroll turn pale only once they enter the viewport. Before, every unread paragraph further down was 0.2-opacity text, which Lighthouse and axe flagged as 1.3:1 contrast on home. The visible effect is unchanged.
- **Performance (critical JS).**
  - The sound engine is now a lazy chunk (`src/chrome/sound-engine.ts`, 5 kB gz). `src/core/sound.ts` is a small facade with the same API. It creates and resumes the AudioContext synchronously inside the gesture (iOS), and loads the engine when sound is turned on, or at idle if it was on in an earlier visit.
  - The a11y panel loads at idle, or on its first click (it then opens immediately). The keyboard focus ring loads at idle or on the first Tab, and picks up the element that is already focused. The cursor and magnetic buttons load only for fine pointers (also when a convertible switches). Details (tab title, WhatsApp, hover sound, console) load at idle. Lazy-image sharpening stays critical (`images.ts`).
  - Critical shared JS went from 108 kB gz (one app chunk) to about 95 kB gz (gsap 68 + app 27).
  - The /business «איך זה עובד» geometry now samples the path once instead of about 730 `getPointAtLength` calls. It is built when the section comes within 1.2 screens, or at idle, not during start-up.
    It took 190 ms with a 4× slower CPU; it now takes about 60 ms, and that work is no longer at start-up.
  - The header's first tone probe runs in the first frame, not inside the module's start-up task.
- **CLS.**
  - /legal/terms desktop: 0.17 → 0.02. The lead used a `ch` measure and rewrapped when Heebo swapped in; it now uses `em`.
  - 404: 0.06 → 0. The title and text measures are now in `em` instead of `ch`.
  - /credits: 0.04 → 0.008. The JS-filled photo list holds a screen of space while empty.
- **a11y.** In the a11y panel, the selected text-size label was 4.44:1 and is now full cream. Credits licence/source links are now ≥ 24 px tall (target-size).
- **Legal and credits polish.** The document column now uses the header's grid (it sat 44 px inside the header edge). Section numbers read 01, 02… in Frank Ruhl, matching the table of contents. Credits show full photo titles instead of clamped titles with no ellipsis.
- **Event JSON-LD.** The dates now match what the home workshop list shows on the demo date (12.11.2026): carpentry 13.11, garden 14.11 and dogs 20.11.2026, each with an `&date=` offer URL. The events moved to their own `<script id="ld-events">` so they can be rewritten at runtime. The generator `src/static/tools/gen_seo.py` was updated to match.
- **`src/core/bus.ts`.** The known-events comment now lists every chrome event, with emitters and listeners.

## Verified (how)
- Winner details, in a Playwright script:
  - seasonal favicon (`/favicons/autumn.svg` in November);
  - tab-away title «העץ מחכה לכם» and back (visibility simulated);
  - selection olive (`rgb(143,142,69)`), caret `--fruit` (base.css);
  - leaf focus ring that travels between elements (Tab sequence);
  - console ASCII tree + credits;
  - leaf page transition from the click point to moss, then arrival;
  - back/forward cache: the cover is cleared;
  - sound toggle persisted across a reload and switched off again;
  - a11y panel: text size, contrast and stop animations all persist across a reload, reset works, and Esc returns focus.
- Stop animations toggled at runtime, off and back on, on 404 (desktop) and /business (phone). There were no errors, no hidden reveals while off, the page ran at 60 fps afterwards and had no long tasks.
- axe-core (wcag2a/aa, 21a/aa) after scrolling through each page, phone + desktop. /business, terms, privacy, accessibility, credits and 404 had **0 violations**. The /business menu open and the a11y panel open also had 0 after the fix.
- Phone menu (moss, items one by one), a11y bottom sheet, /business scrolled on phone and desktop, credits and 404 were all reviewed in screenshots. No horizontal overflow, and no console errors on any page.
- Lighthouse 12 on a production build (`vite preview`):

| page | mobile perf | desktop perf | a11y | LCP m / d | CLS m / d |
|---|---|---|---|---|---|
| /business | 84–90 (last run 87) | 99–100 | 100 | 3.0–3.2 s / 0.7 s | 0.02 / 0.007 |
| /legal/terms | 96 | 100 | 100 | 2.3 s / 0.6 s | 0.003 / 0.024 |
| /legal/privacy | 95 | 100 | 100 | 2.5 s / 0.6 s | 0.003 / 0.001 |
| /credits | 95 | 100 | 100 | 2.1 s / 0.7 s | 0 / 0 |
| 404 | 98 | 100 | 100 | 1.9 s / 0.5 s | 0.005 / 0 |

The 404 page scores SEO 63 because it is `noindex` by design.
The /business mobile LCP of 3.0–3.2 s is Lighthouse's *simulated* value. Measured with real throttling (4× CPU, 150 ms RTT, 1.6 Mbps), LCP is 0.83 s and CLS 0.02.

## Remaining (honest)
- **Not mine; measured on the base build:**
  - home: mobile 51 (TBT 1.0 s, LCP 4.5 s), desktop 41 (CLS 0.36, attributed to web fonts that are not preloaded: FRL 400/500 and the Latin subsets);
  - /plant: mobile 68 (TBT 0.77 s, LCP 3.5 s);
  - /tree: mobile 35. Its desktop run hung under software WebGL.
  - The very large TBT values on home and tree come mostly from SwiftShader (software WebGL) in headless Chrome, but home mobile is still below 80. With real throttling, home desktop CLS measured 0.0004.
- **Font-swap CLS in general.** It needs metric-matched fallback faces (lead, `fonts.css`). I fixed the instances on my pages with font-independent measures only.
- **/business mobile Lighthouse** stays in the high 80s. The rest of the critical JS is GSAP plugins that are registered but unused (lead) and the footer's dog (footer owner). See the requests.
- **Sound levels** are still unheard by a human (headless).
- **Cookie card on phones** may sit over plain text links (e.g. the 404 «מפת היער» row). It never sits over a primary button or a page bar. It is dismissable and reachable by keyboard first.
- **Event JSON-LD** is static. The home list is relative to "today", so after 13.11.2026 the dates drift until the seasons script (or a CMS) rewrites `#ld-events`.

## Requests to other owners
- **Lead, `src/core/gsap.ts`.** Stop registering `Flip`, `Observer` and `CustomEase`. Nothing in `src/` uses them; I grepped for usages.
  Register `MorphSVGPlugin` only where it is used, `src/components/dog.ts` and `src/plant/stage.ts`.
  Measured on the GSAP set with rolldown: 68 kB gz (all plugins) → 58 kB (drop three) → 49 kB (MorphSVG moved too). That comes off every page's critical path.
- **Lead, `src/styles/fonts.css` + `tokens.css`.** Add metric-matched fallback faces (`size-adjust` / `ascent-override` over Arial and Times) and put them second in `--font-body` / `--font-display`.
  The swap from Heebo/Frank Ruhl causes most of the remaining CLS. Home desktop Lighthouse CLS was 0.36, attributed to "web font loaded" for FRL 400/500 and the Latin subsets.
- **Footer owner, `src/components/footer.ts`.**
  1. Import `./dog` lazily, only on desktop with motion on. It is 10.6 kB minified on every page, phones included.
  2. The footer has no background of its own. While the reading line is still in a moss or soil section above it (the /business form, the home wall), the «היער שלנו» heading is olive on moss, which is low contrast. Give the footer `data-bg="cream"` (and `var(--ink)` text), or paint its own cream background.
- **Tree-ui / tree-scene, phone intro.** The stage sets `data-header="light"`, but the top ~55 px under the header is the cream "surface" band, so the header's cream text sits on cream.
  Either set `data-header="dark"` while that band is under the header, or start the band below `var(--header-h)`. My shade raises it to 3.4:1, which is not enough.
- **Seasons owner, `src/sections/home/seasons-workshops.ts`.** After computing `sessions()`, rewrite `<script id="ld-events">` with the same sessions (name, startDate, price, offer URL with `&date=`), so the Event structured data always matches the list.
- **Home owners (Lighthouse a11y on home, other files).**
  - `p.roots__text` has `aria-label` on a `<p>` (aria-prohibited-attr).
  - `button.hero__tilt`: the visible text «הטיה» is not in its accessible name (label-content-name-mismatch).
  - /plant `.pcs__of` contrast is 3.1:1.
  - /tree: `.tree-feed__lead .price` is 4.26:1 (fruit on sand), and the herbarium `.hb-label__wait` / `__date` are about 3.1:1.

---

# Pass 2 — critic findings (12.11.2026)

All ten findings were checked in the running site (Playwright, phone 390×844 / 375×667, desktop 1440×900 / 1280×720, reduced motion). Nine are fixed. One (the legal «לאישור» chips) is kept on purpose; the reason is below.

## Fixed
- **Text size (a11y panel) barely changed the page.** `chrome.css` now defines `--a11y-k` (1 / 1.125 / 1.25), next to `data-a11y-font`. It also scales the `--fs-small` and `--fs-eyebrow` tokens at those levels, so `.eyebrow`, field labels and every `var(--fs-small)` grow on all pages.
  In business.css, doc.css, credits.css and notfound.css, every body-scale size up to 40px is now written as `calc(Npx * var(--a11y-k, 1))`. Display titles stay as they are.
  Characters inside `<main>` that grow at «גדול מאוד»:

  | page | before | after |
  |---|---|---|
  | /business | 1% | 94% (body text 97%) |
  | terms, privacy, accessibility | 0% | 99–100% |
  | /credits | 0% | 100% |
  | 404 | 0% | 69% (body text 80%) |

  The rest of the 404 is the two `.btn` labels (base.css, lead). `steps.ts` rebuilds the root on `a11y:change`, and the root still meets the nodes (0–1 px).
- **The package line art never finished drawing.** Chrome ignores `pathLength` under `non-scaling-stroke`, so the art stopped part-way. Removed `vector-effect`. Stroke width is now in viewBox units (`--biz-sw`, set by a ResizeObserver in `art.ts` to stay 1.5 screen px). The dash gap is now `1 1.01`, so no round-cap dot shows at the end of a hidden stroke. The art draws completely on phone, desktop and tablet, and the hidden state is clean.
- **The success panel ended up off-screen after a valid submit.** `form.ts` `reveal()` scrolls the panel top under the header (`core/scroll` `scrollTo`, immediate under reduced motion), after the height timeline is set so the page doesn't jump. On phones the panel used to end at y = −78 and is now at 106–530. On desktop it was −30 and is now 150–559.
  Also fixed: `.btn--outline:hover` inside the light panel painted moss text on soil. Cards and the panel now set `--page-bg: var(--cream)`.
- **Cookie card placement** (`cookies.ts` rewritten, plus CSS):
  - Phones get a compact one-row card, about 68px tall.
  - A primary that hugs the bottom edge (the /plant price bar, the tree's «דלגו», a dock) becomes a floor (`--ck-floor`), and the card sits just above it instead of jumping to the top. /plant and the tree now keep the stage clear.
  - The first show waits, invisible, until a slot is free and the page has settled (the same answer twice, 0.7 s apart). The longest wait is 20 s. The card is measured without its entry transform.
  - On the phone home hero both slots are blocked (the CTAs, and `.hero__count` at the top), so the card appears after the first scroll and the counter is never covered.
  - After the card shows, it moves only off a primary, never back to a slot it has left. In its first 6 s it may also leave plain links for a free corner.
  - Desktop counts all links and buttons a little, so a free corner wins: on 404 at 1280×720 it now picks the other corner and the escape links are clear.
  - A full scroll of /business on a phone gives 0 flips (it was 5).
  - Keyboard order is unchanged: skip link → privacy → מאשרים → …
- **/business phone hero.** The order is now title → question → «בואו להיות שותפים» + וואטסאפ → leaf photo → text. The CTA sits at 379–439 at 390×844 (it was 967) and 373–433 at 375×667.
  Short laptops (≤ 820px tall): the title is height-capped and the spacing tightened, so at 1280×720 the CTA is at 592–652 (it was 694–754, cut by the fold).
- **Trailing-slash links.** Every internal link in my files now uses the canonical slash form, which avoids the production 307: header, menu, phone bar, cookie, legal ×3, credits, 404, /business, and the console credits.
  The dev server serves both forms. `legal.ts` and `transition.ts` already normalise slashes. Other owners' links are listed in the requests.
- **Focus ring on hidden radios.** `focus.ts` measures the label or chip, or the nearest sized parent, when the focused control is under 4px or `.visually-hidden`. This also covers /plant's options.
  The chip and tick CSS outlines now apply only without the ring (`html:not(.focus-ring-on)`).
  - **Bigger bug found while checking:** `isDarkAt` let a section's `data-header` hint win over a solid box inside it. The ring was therefore *cream on the cream form panel* (invisible) for every field of the /business form.
  - Now a solid-coloured box inside a hinted section is judged by its own colour. Media inside a hinted section (the tree's WebGL stage) and the section itself still take the hint. The ring is fruit in the form.
  - Header contrast audit after the change: /business, terms, /tree and /plant on phone, and /business and terms on desktop, have 0 low-contrast steps. On home desktop, y=0 is 4.06 next to the sun; this was already known and unchanged.
- **/business «איך זה עובד» on desktop.** The scrub runs from `top 62%` to `bottom 62%`. Node 01 lights when the row is at about 690px and node 04 when it reaches 440px (mid-screen); before, node 04 lit only as the section left.
  The stage bottom padding is now clamp(80px, 8vw, 112px) (it was up to 150px) and the section bottom padding is 0.42 × section-pad (it was 0.6).
- **The client-only note on the public page.**
  - /business: the FAQ's open questions and the legend carry `[data-todo]` and are hidden unless `html[data-notes]` is set. `?notes=1` turns them on for the session and `?notes=0` turns them off. The default is off in dev too, so the dev server shows what the public sees.
  - The section-46 note now reads «לבירור מול היער: …», without «לא לפרסם…». The public answer is unchanged and complete.
- **Theme colours.** `.biz-hero__sub` now uses `var(--ink)` instead of `--soil`. `.biz-gal__n` and the FAQ links use `var(--biz-accent)`.
  axe on /business: 0 violations in the states base, formerr (scrolled to the form), top and cookie, on phone and desktop. formerr had 4–5 color-contrast violations before.

## Kept, with reason
- **The «לאישור» chips on the legal pages stay visible.** Those pages open with an explicit draft notice («טיוטת הדגמה … פרטים שמסומנים לאישור עוד צריכים השלמה»). Many chips are the value itself: «דוא״ל: לאישור», «חניה: לאישור היער». Hiding them would leave blank fields in a legal text, which is less honest and reads as more broken.

## Verified
- tsc: 0 errors.
- The production build into scratch succeeds.
- No console errors or horizontal overflow on /business, credits, accessibility, terms and 404, on phone and desktop.

Scripts are in `scratchpad/agents/global/`: `cookiepos`, `homeck`, `art`, `art2`, `steps`, `chipring`, `notes`, `a11ysteps`, `cktab`, `tone`. The critic's scripts, retargeted, are in `crit/`: `scale`, `form`, `formR`, `hero`, `cookiescroll`, `kb`, `axe`.

## Remaining
- `.btn`, `.lead`, `.field`, `.chip` (base.css) and section CSS on home, /plant and tree don't follow `--a11y-k` yet (see the requests). The panel's promise is therefore met on my pages but not yet site-wide.
- Cookie AVOID names three other owners' classes (`.hero__count`, `.tbirth-skip`, plus the existing `.pc-bar` and `.tdock-card`). They can go once those owners add `data-cookie-avoid`.
- On home desktop at y=0 the header is 4.06:1 next to the sun. Unchanged from before.
