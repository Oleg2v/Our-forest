# chrome — global layers (header, menu, phone bar, reveals, bg, cursor, transitions, sound, a11y, focus, cookies, details)

Owner files: `partials/header.html`, `partials/chrome-overlays.html`, `partials/head-common.html`,
`src/chrome/**` (`index.ts` orchestrator + one module per system + `chrome.css`), `src/core/sound.ts`,
`public/favicons/{spring,summer,autumn,winter}.svg`.
Contract kept: `initChrome({page})`, `refreshChrome(root)`, `navigate(href, origin)`; `sound.*` API unchanged.

## How to use it (for section/page owners) — markup only
| attribute | effect |
|---|---|
| `data-reveal="lines"` | SplitText lines rise from a mask, step .08 s, expo.out 1.2 s |
| `data-reveal="letters"` | letters rise from the line mask with a slight turn, step .04 s (cap .9 s total) |
| `data-reveal="words"` | long paragraph is "read" on scroll: words pale (.2) → full, scrubbed |
| `data-reveal="fade"` | rise 28px + fade, 1.2 s; siblings entering together cascade by .08 s |
| `data-reveal="leaf"` | clip-path opens from a small leaf to the element's own border-radius, inner img/video/canvas scale 1.2 → 1, 1.4 s power4.out |
| `data-reveal-delay="0.2"`, `data-reveal-start="top 70%"` | per-element tuning |
| `data-bg="cream|sand|soil|moss|season"` on sections | page bg + `--ink/--ink-soft/--line` tween (0.9 s) when the section crosses 55% of the viewport. **Leave these sections' own background transparent.** `season` = you paint your own colours; page bg left as is. Sections without `data-bg` count as cream. |
| `data-header="light|dark"` on a section | force the header tone over it (light = cream text). Otherwise the tone is detected from what is painted under the header (media → light). |
| `data-magnetic` | ~30px magnetic pull (desktop, motion on) |
| `data-cursor="שתלו|גלו|גררו|none"`, `data-cursor-fill="fruit"`, `data-cursor-icon="<svg…>"` | cursor ring label / fruit fill / icon. Defaults: `.btn--fruit` → "שתלו" on fruit; img inside a link → "גלו"; links/buttons → ring swells. Pressing on a "גררו" element squeezes the ring and emits `cursor:drag`. |
| `data-no-transition` on a link | opt out of the leaf page transition |
| `data-sound-hover="off"` | mute the hover click (links/buttons have it by default, only while sound is on) |
| `data-wa="text"` on `a[href*=wa.me]` | prefilled WhatsApp text via `waLink()`; every wa.me click → `track('whatsapp_click', {page, placement})` |
| `html[data-hide-sticky]` | hides the phone bottom bar (a page with its own sticky bar, e.g. /plant) |

After injecting DOM dynamically call `refreshChrome(container)`.
Don't put `data-reveal` on an element you animate yourself (I own its opacity/transform/clip-path until it finishes;
then `data-reveal` is swapped for `data-reveal-done` and all inline styles are removed).

Bus: emits `theme:section {bg,dark}`, `menu:open|close`, `modal:open|close` (a11y panel), `page:leave {href}`,
`page:restore` (bfcache back), `consent:change {analytics}`, `a11y:change`, `cursor:drag {on}`, `sound:change {on}`.
Listens: `preloader:done` (holds first-screen reveals + cookie banner; 2.8 s cap), `modal:open|close` (hides the phone bar —
**sheet/dialog owners please emit these**), `header:force {visible:true|false}` (ref-counted keep-visible), `cursor:set {label,fill,icon}|null`.

## How it works
* **Head (pre-paint)**: adds `reveals-on` (only with motion) + 3 s failsafe that drops it if `src/chrome` never starts
  (`window.__ofChrome`). Seasonal favicon swap. Incoming page transition: sessionStorage `of:pt` → `html.pt-in` paints a
  moss cover (inline `html.pt-in::after`, own 3 s CSS failsafe). `@view-transition{navigation:auto}` +
  `pagereveal` handler: with a cross-document View Transition the new page opens through a leaf `clip-path: path()` on
  `::view-transition-new(root)` (1 s, power3.inOut); otherwise `transition.ts` opens it with an evenodd clip-path hole.
  Also `<link rel=expect href=#main blocking=render>` and speculation-rules **prefetch** (moderate) for same-origin links.
* **Leaving**: click anywhere on a same-origin link → leaf (border-radius 50% 0 50% 0) grows from the click point
  (keyboard: from the link's centre), moss + small leaf mark, then navigation. Not for same-page anchors (smooth
  `scrollTo` + focus target + replaceState), new tabs, downloads, modifier clicks. bfcache back clears the cover.
  Reduced motion → plain navigation. Deep links (`/#map`) re-land after load + `ScrollTrigger.refresh()`.
* **Header**: grid (nav start · logo centre · actions end). DOM order = RTL visual order:
  nav → logo → sound → a11y → "צרו קשר" → "נוטעים עץ משלכם" (far left, fruit, magnetic, cursor "שתלו").
  Inline nav ≥ 1240px (later with larger a11y text), menu button below; contact hidden ≤ 960, CTA hidden ≤ 768
  (the phone bar has it). Hides on scroll down after 160px, returns on scroll up with a blurred translucent bg,
  wordmark blurs up into a leaf mark that draws itself. Tone probe = `elementsFromPoint` at 3 points (throttled on
  scroll + a few times after load). Nav: `aria-current` on /business; on home a scrollspy underlines #story/#directions/#contact.
* **Menu**: `role=dialog aria-modal`, inert background, focus trap, Esc, `lockScroll`; panel unrolls from the top with
  one rounded leaf corner (`--clip-b/--clip-r` CSS vars), big Frank Ruhl items rise one by one, sage line branch draws.
  Contains CTA, WhatsApp, sound + a11y toggles. Modals are a stack: the a11y panel can open over the menu; Esc closes only the top one.
* **Phone bar** (≤768): floating pill dock, "נוטעים עץ" (fruit) + "וואטסאפ" (olive-deep), safe-area aware; hidden on the home
  hero (until 55% of the first screen), over the footer, with menu/modals/keyboard open, and with `html[data-hide-sticky]`.
  Sets `html.mbar-on` + `--mbar-space` (cookie card sits above it).
* **Cursor**: `quickTo` follow (ring .55 s, seed .1 s), states by delegated `pointerover`; colour follows the background.
  Only `(hover:hover) and (pointer:fine)` + motion on; toggles live on `motion:change`.
* **Focus**: one `.focus-ring` element travels (GSAP, .5 s expo.out) to the `:focus-visible` element; pill → pill,
  leaf radius → leaf, else small leaf (r ≤ 26px). Colour = fruit on light / cream on dark (majority of 4 probes around
  the ring). rAF follow loop runs only while visible. Fallback = base.css outline. `forced-colors` → system outline.
* **A11y panel**: real dialog; text size 0/1/2 (radio), high contrast (switch), stop animations (switch →
  `setUserMotionOff`), reset, link to /legal/accessibility. Writes `of:a11y:font` (1|2), `of:a11y:contrast` ("high"),
  `of:a11y:motionOff`. Chrome typography is in rem so it scales; grain is hidden in high contrast.
* **Sound** (`src/core/sound.ts`): procedural WebAudio only (no files). Off by default, `of:sound:on`. Context created
  and resumed on the first gesture after "on"; suspended when the tab is hidden or sound is off. iOS `audioSession = 'ambient'`
  (respects the silent switch). Compressor + small procedural convolution reverb. Ambient by Israel time (`dayPeriod`):
  morning birds · day wind + cicada phrases · evening crickets · night near-silence + rare owl; also `rain`, `memorial`,
  `forest`, `null`. `setAmbient()` overrides the automatic choice. All named one-shots implemented; `loop('water'|'wind')`
  with setVolume/stop; `haptic()` = `navigator.vibrate` on Android with motion allowed.
* **Cookies**: non-modal region card at the reading-start corner (never over the buy buttons), after 1.4 s (home: after
  the preloader + 2.6 s). `of:consent {v,t}`; pushes `consent_update` to dataLayer.
* **Details**: seasonal favicon (pre-paint + runtime, Israel season), tab hidden → "העץ מחכה לכם", lazy `img[data-img-key]`
  not yet loaded sharpen in from blur(16px) over their own LQIP, console: ASCII tree with roots + credits.

## Verified
`tsc` clean for my files. Dev server :5191, screenshots (mobile 390 + desktop 1440 + `--reduced`) of /, /plant, /business,
/legal/privacy, /nope — no console errors, no horizontal overflow. A fixture of all reveal kinds + every `data-bg` (injected
via the dev-only `window.__ofChromeDev.refreshChrome`) on desktop/mobile/reduced. Scripted Tab sequence (order + ring
colour/shape), menu (trap, inert, Esc, focus return), a11y panel (persistence across reload, reset, nested over menu),
cursor states + magnetic, transition leave (screencast) + arrival on both paths (VT and forced fallback), bfcache back,
anchors/deep links, phone bar rules, WhatsApp tracking, sound API (every effect/loop/ambient, persistence) without errors.

## Known gaps / honest notes
* Sound levels were set by reasoning, not by ear (headless) — someone should listen once and trim gains in `sound.ts`.
* The header tone uses hit-testing; an overlay with `pointer-events:none` on top of a section is invisible to it — such
  sections should set `data-header="light|dark"`. Hero owner: if the hero top is a dark photo it is detected
  automatically (media → light), but `data-header="light"` on the hero is the safe choice.
* Lazy-image sharpen verified with a simulated slow image only (no real photos in the manifest yet).
* Hover → tap/long-press equivalents are a component concern; the chrome itself has no hover-only functionality.
* View-transition reveal always opens from the screen centre (the click point is used for the cover on the old page).

## Requests to other owners
* Section owners with `data-bg`: keep the section background transparent (the page bg animates); use `var(--ink)` /
  `var(--ink-soft)` for text that must flip on dark sections.
* Preloader owner: please `bus.emit('preloader:done')` when the hero is revealed (reveals + cookie banner wait for it;
  fallback is polling the element's visibility, capped at 2.8 s). Mark the root with `data-preloader` or `.preloader`.
* Roots/home owners: nav anchors expect ids `#story`, `#directions`, `#contact` (and `#map` for deep links) — roots has
  the first two already.
* /plant owner: set `html[data-hide-sticky]` while your own price bar is shown. Sheets/dialogs: emit `modal:open|close`.
* Lead: `public/favicon.svg` stays as the no-JS fallback; the seasonal icons live in `public/favicons/`.
