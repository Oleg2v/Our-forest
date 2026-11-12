# perf — pages (/business, /tree/0427 UI, legal, /credits, 404)

Scope: phone scroll smoothness in `src/business/**`, `src/tree/ui/**` (not the scene), `src/static/**`.
Scripts, traces and screenshots: `scratchpad/agents/desk-pages/` (ab.sh, jank.mjs, style.mjs, layers2.mjs, anims.mjs,
cmp.mjs; results in ab-final1.txt, ab-final2.txt, iso1.txt).

## Mobile scroll performance

How it was measured: headless Chromium with iPhone 13 emulation, 4× CPU throttle, DPR 3, a programmatic scroll at
900 px/s. The "before" tree is the same working tree with my files put back to `fa9748d`. Each A/B ran 3 times,
alternating before and after; the numbers below are medians. The machine was shared with other agents and loaded, so
absolute fps is low in both arms. Style time, element counts and layer counts are steadier than fps; I lean on them.
"By reasoning" marks WebKit-specific claims that headless Chromium cannot show.

### What was slow
- **/business: body's colour fade restyled the whole page on every frame.** At each light ↔ dark turn of the page
  (pk → steps, steps → gallery, faq → form, form → footer), body tweens `color` for 0.9 s (base.css). Every element
  under body inherits that colour, so every frame restyled the whole page. Measured on "איך זה עובד" (2200–4600):
  with `body{transition:none}` fps went 31.5 → 45.7 and style time 1.18 → 0.50 s. This was the largest single cost
  on the page.
- **/tree/0427: a `:has()` on the stage.** `.tree-stage:has(.tree-pager)` and `:has(.tree-offline)` (phone rules)
  made every DOM change inside the stage re-check the whole stage subtree. The scene's labels and the clock change
  text there several times a second. The trace shows "Affected by :has() → invalidates subtree" 11 times in 0.9 s.
- **/tree/0427: `.tree-stage[data-away] *`.** It paused the stage's loops off screen, but the universal selector
  restyled the whole stage each time it crossed the viewport edge.
- **/business: permanent layers on phones.** `translateZ(0)` stayed on the hero leaf and on all six gallery frames,
  although nothing moves inside them on phones (no parallax, and the strip is a native swipe there). That left
  7 layers, about 4–5 MB at DPR 3.
- **Herbarium:** when the leaves are laid in, the code read layout (`getBoundingClientRect` + `getBBox`) between
  tween writes, which forced one layout per leaf.
- Already fixed by the interrupted pass and kept after review. I checked each change, and the screenshots match:
  - The steps root writes its dash or tip only when it changes, and no longer calls `getPointAtLength` in a scroll frame.
  - DrawSVG now initialises at build time.
  - The gallery and parallax `will-change` apply only on desktop with motion.
  - The legal TOC spy runs only while the TOC is visible and writes only on change.
  - The tree leader ring animates only while it is shown.
  - The idle veil and dock lead are `visibility:hidden`.
  - The watering canvas holds a bitmap only while water is in the air, and iOS address-bar resizes no longer
    reallocate it.
  - The herbarium leaf falls on the outer `<svg>`, a composited box, instead of the `<g>`. Moving the `<g>` would
    repaint the feTurbulence paper filter every frame (by reasoning, WebKit).

### What changed (this pass)
- `src/business/business.css`: `.biz { color: var(--ink) }`. The page now has its own ink, so body's 0.9 s fade
  stops at `<main>`. The text already takes its colours from `--ink` / `--biz-h`, which switch at once, so nothing
  looks different. I checked phone frames 150, 400 and 1200 ms after each turn: they are identical to the eye, and
  the whole-page phone screenshots differ by 0.00 %.
- `src/business/business.css` + `index.ts`: the hero leaf and photo get layers only while the desktop parallax runs
  (`.biz-hero.is-parallax`). The gallery frames get `translateZ(0)` only in drift mode.
- `src/tree/ui/index.ts` + `tree.css`: the `:has()` is replaced by `data-pager` / `data-offline` flags on the stage,
  set where the pager and the offline note are created and removed.
- `src/tree/ui/cards.css`: the off-screen pause names its four looping elements instead of `*`.
- `src/tree/ui/herbarium.ts`: all pivots are measured first, then the tweens are written.
- Checked: the scene pauses its own render loop off screen (scene `IntersectionObserver` → `paused.offscreen`). With
  the stage scrolled away, `document.getAnimations()` shows no stage loops running.
- No phone simplifications were needed. Nothing on phones looks different.

### Numbers (medians of 3, before → after)
| range | fps | style s | layout s | long-task ms |
|---|---|---|---|---|
| /business "איך זה עובד" 2200–4600 | 22.7 → 39.2 | 1.03 → 0.70 | — | 1287 → 434 |
| /business whole page 0–7800 | 39.4 → 44.6 | 2.66 → 1.66 | 0.15 → 0.05 | 1682 → 1117 |
| /tree/0427 top 0–1500 | 19.5 → 28.5 | 0.14 → 0.06 | — | 1676 → 1187 |
| /tree/0427 sections 900–6400 | 49.5 → 53.9 | 0.24 → 0.12 | 0.16 → 0.03 | — |
| /legal/terms 0–8400 | 51.4 → 44.4 (noise: 46–56 in both arms; 60/60 in a quiet run earlier) | 0.10 → 0.11 | 0.02 → 0.01 | — |

- Elements restyled while scrolling the top of /tree/0427 (0–900, two runs each): about 2 500–3 400 before, about
  500–650 after.
- Composited layers on the /business phone (drawing layers / total area): 26–27 / 24.0 viewports before,
  12–13 / 17.8 after.
- Not attributable to me: the scene's Three.js and WebGL start-up in the first 1500 px of /tree is the long-task
  floor there.

### Left for others (see the report's requests)
- base.css: body's `color` transition does the same to every page section that inherits it. The home sections that
  set their own ink already avoid it (homelow did the same for companies).
- Chrome only, by reasoning not an iOS cost: on the /tree phone, everything after the stage's panel is squashed into
  one 390×7353 layer. The cause is the scene's `will-change` layers (`.ts-fog`, `.ts-svgwrap`) under the stage UI.
- `.cookie` animates `bottom` (a layout property) on every page.
