# היער שלנו — build conventions (read first)

Demo site for "היער שלנו" (Our Forest), an edible food forest in Moshav Pedaya, Israel.
Two jobs, both mandatory: **wow in the first 3 seconds and hold attention to the footer**, and **sell**
(personal trees with a plaque, benches & corners, workshops, company days, gifts, subscription).
A tree can be bought in **under a minute from the first screen**. Awwwards SOTD + Developer Award level.

The full brief (Russian, 29 pages) is at
`/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/spec/brief.pdf`
(read pages with the Read tool `pages` param) and as plain text in `.../spec/brief-raw.txt` in the same folder.
Hebrew in the raw text has broken punctuation at line wraps — **all Hebrew copy is already transcribed
correctly in `src/content/he.ts`. Use it; never invent replacement copy, never lorem ipsum.**
Small functional micro-copy that the brief does not give (aria-labels, "next/back", form errors) may be
written in natural Hebrew, kept minimal, in the brief's voice (present tense, "we do": נוטעים, משקים, באים).
Never write testimonials (leave empty, clearly-marked slots), never use real brand logos (neutral placeholders).

## Stack
Vite 8 + TypeScript (no UI framework), multi-page. GSAP 3.15 with all plugins registered in
`src/core/gsap.ts` (ScrollTrigger, SplitText, DrawSVG, MorphSVG, Flip, Observer, CustomEase) — import from there.
Lenis smooth scroll (desktop only) in `src/core/scroll.ts`. Three.js 0.187 for WebGL (hero + tree page only).
`detect-gpu` for device tier (`gpuTier()` in `src/core/env.ts`). `qrcode-generator` for QR codes.
**Do not run `npm install`** — everything needed is installed. If something is truly missing, write it yourself
or note it in your agent notes.

## Routes / pages
| route | html | entry |
|---|---|---|
| `/` | `index.html` (composed from `partials/home/*.html`) | `src/pages/home.ts` |
| `/plant` | `plant/index.html` | `src/pages/plant.ts` |
| `/tree/0427` | `tree/0427/index.html` | `src/pages/tree.ts` |
| `/business` | `business/index.html` | `src/pages/business.ts` |
| 404 | `404.html` | `src/pages/notfound.ts` |
| `/legal/terms` `/legal/privacy` `/legal/accessibility` | `legal/*/index.html` | `src/pages/legal.ts` |
| `/credits` | `credits/index.html` | `src/pages/credits.ts` |

Links use clean URLs: `/plant`, `/plant?species=fig&spot=0612`, `/tree/0427`, `/business`, `/#map`.
Dev server rewrites clean URLs; unknown routes → 404.html.

## HTML composition
* `<!--#include partials/x.html -->` inlines a partial (path from project root, nests).
* `<img data-img="hero" sizes="(max-width: 768px) 100vw, 50vw" class="cover" data-eager>` expands at build/dev
  time to a `<picture>` with AVIF/WebP/JPEG srcsets, width/height (no CLS) and a blurred LQIP background,
  from `src/content/images.json` (keys + purposes listed there). Pending keys render a sized coloured
  placeholder. In JS use `pictureHtml(key)` / `imageUrl(key, width)` from `src/content/images.ts`.
* Every page: `<html lang="he" dir="rtl">`, `partials/head-common.html`, header, `<main id="main">`, footer,
  `partials/chrome-overlays.html`, one module script.

## Design system (src/styles/tokens.css, base.css — read them)
Palette tokens only: `--cream --sand --olive --olive-deep --bark --soil --moss --sage --fruit`.
`--fruit` ONLY for prices, free map spots and the main buy button. Buttons with white text use `--olive-deep`
(never `--olive` — contrast). `--olive` text only for headings ≥ 32px and icons.
Fonts: Frank Ruhl Libre 300–500 (headings, numbers; hero `clamp(72px,14vw,220px)`, line-height .95),
Heebo 300/400/500 (UI, 18px / 1.6). Hebrew typography: gershayim ״, geresh ׳, maqaf ־, prices `180 ₪` with NBSP
(`ils()`, `priceHtml()` in `src/core/format.ts`), wrap numbers/latin inside Hebrew in `<bdi>` where order could flip.
Dates Israeli `14.2.2026` (`ilDate()`), phones are WhatsApp buttons (`waLink()`).
**The leaf**: `border-radius: 120px 0 120px 0` (56px on phones) = `var(--leaf)`; on hover the rounded corners swap
smoothly (`.leaf--hover`). Used on photos, reveal masks and page transitions. Buttons stay pills (`.btn`).
Grain over the whole site is already in base.css. No shadows, no glossy gradients, no neon, no harsh flashes.
Icons: our own line icons, inline SVG, `viewBox 0 0 24 24`, `stroke: currentColor`, `stroke-width 1.5`,
round caps/joins, no fill (class `.icon`). They draw themselves with a line when they appear (DrawSVG).
The same line style for the map, roots, configurator trees and the dog.
RTL: logical CSS only (`margin-inline-start`, `inset-inline-end`, `padding-inline` …). "Forward" arrows point LEFT.
Horizontal strips in RTL travel right → left.

## Motion rules
Timings: micro .25s, interface .5s, appearances 1.2s, page transitions .9s (`T` in gsap.ts).
Eases: `expo.out` appearances, `power3.inOut` transitions, light elastic only for playful details (`EASE`).
One strong motion idea per section, not ten effects. Calm and expensive, like a walk in a forest.
Animate only `transform` and `opacity` (and clip-path / CSS vars where unavoidable); 60 fps on a mid Android.
Every animation is interruptible — scrolling on never waits for anything.
**Always** check `env.motionAllowed()` (system reduced motion OR the a11y panel's "stop animations"), and listen
to `bus.on('motion:change')`. Reduced motion: no pinned sections, no WebGL, no parallax — simple fades, all content
reachable. Phones: no custom cursor, no magnetic buttons, no dog; hover → tap / long-press.
Mobile is designed separately (390×844 first), not shrunk: `svh/dvh` heights, `env(safe-area-inset-*)`,
touch targets ≥ 44×44, sticky bottom bar «נוטעים עץ» + WhatsApp on all pages (chrome agent).

## Global data-attribute contracts (implemented by the chrome agent in src/chrome/**)
`data-reveal="lines|letters|words|fade|leaf"`, `data-bg="cream|sand|soil|moss|season"` on sections,
`data-magnetic`, `data-cursor="שתלו|גלו|גררו"`, `data-cursor-fill="fruit"`, `data-cursor-icon`,
same-origin links get the leaf page transition. See `src/chrome/index.ts`.
Sound: `sound.play('rustle')` etc. from `src/core/sound.ts` (contract; no-op while off).
Analytics: `track('add_to_cart', {...})` from `src/core/analytics.ts`.
Scroll: `scrollTo()`, `lockScroll()/unlockScroll()` from `src/core/scroll.ts` (use for sheets/menus/dialogs).
Cross-agent component contracts (stubs exist, keep the exported API):
`src/components/forest-map.ts` (map, also used as picker in /plant), `src/components/dog.ts`,
`src/components/footer.ts`, `src/tree/scene-api.ts` (+ `src/tree/scene/index.ts`).

## File ownership — CRITICAL
Several agents work **at the same time in the same working tree**. Only create/edit files you own (listed in your
task). Shared foundation files (`src/core/*` except your contract file, `src/styles/tokens.css`, `base.css`,
`fonts.css`, `src/content/he.ts`, `prices.ts`, `vite.config.ts`, `package.json`, `docs/BUILD.md`) are read-only.
If you need a change there, put the workaround in your own files and describe the wish in
`docs/agent-notes/<your-agent-name>.md`. Put section CSS next to its TS (`import './x.css'` from your module).
Prefix your CSS classes with your block name (BEM-ish: `.roots__node`) — no global element selectors.
**Do not run git** (no commit/stash/checkout/reset) — the lead commits.

## Verify your work (required before you finish)
1. `npx tsc --noEmit 2>&1 | grep -E '<your paths>'` — zero errors in your files (others may be mid-edit).
2. Run your own dev server on your assigned port: `npx vite --port <PORT> --strictPort` (background), then
   `node scripts/shot.mjs http://localhost:<PORT>/<route> <scratch>/<name> --mobile --desktop --scroll=0,900,...`
   and LOOK at the PNGs with the Read tool. Check: no console errors, no horizontal overflow, RTL correct,
   Hebrew renders, mobile 390×844 is as good as desktop. Also try `--reduced`. Kill your server when done.
   (Headless WebGL is software-rendered — slow fps is expected there; correctness is what you check.)
3. Never build into `dist/` (others may be building). Use `npx vite build --outDir <scratch>/build-<name> --emptyOutDir` if needed.
4. Write `docs/agent-notes/<your-agent-name>.md`: what you built, how it works, known gaps, any requests to
   other owners. Keep it short and honest — say what does NOT work.
