# desktop — pages (/business, /tree/0427, legal, /credits, 404)

## Desktop polish

I audited the pages at 1366×768, 1440×900, 1536×864, 1680×1050, 1768×900, 1920×1080, 1920×940, 2560×1440,
1024×768 and 1180×820. For each size I scrolled the whole page, including the hand-overs between sections, and
opened the hover, FAQ, form-error, demo-panel and dock-card states.

All the fixes sit in `@media (min-width: 769px) and (min-height: 561px)` or in wider queries, so phones (portrait and
landscape) are untouched. The one exception is a bug fix, the legal WhatsApp button; see below. No token changes.

Screenshots are in `scratchpad/agents/desk-pages/`. `ba/*-before-*` and `ba/*-after-*` use the same viewport and
the same scroll position.

### What was wrong → what changed
- **/business hero on screens that are wide but not tall (1536×864, 1768×900, 1920×940).**
  - Problem: the three-line title, the question, the text and the buttons ran about 50 px past the first screen.
    - The CTA buttons sat below the reveal line, so they stayed invisible until the first scroll. That is the
      owner's screen.
    - The "down" arrow was cut by the screen edge.
  - Fix: between 821 and 1024 px of height, the title follows the height (`min(7.4vw, 11.5vh)`) and the space above
    it is `clamp(16px, 3vh, 40px)`. The hero is now exactly one screen, with the buttons and the arrow visible.
  - Screenshots: `ba/biz-hero-1768-{before,after}-00-0.png`, `ba/biz-hero-1536-*`.
- **/tree/0427 stage UI on wide screens.**
  - Problem: the title and panel, the "now in the forest" readout, the demo button, the timeline, the dock cards and
    the birth caption hugged the screen edges at 56 px. The header sits on the 1440 column, so the two were 108 px
    apart at 1768 and 504 px apart at 2560.
  - Fix: `--gutter` is redefined on the stage as `max(gutter, (100cqw − maxw)/2)`. The stage is an inline-size
    container, so its edges meet the header's to the pixel. Up to 1552 px wide nothing changes.
  - Screenshots: `ba/tree-1768-*-00-0.png`, `ba/tree-2560-*`, `ba/tree-i1920-*` (news card, demo panel),
    `ba/tree-birth-1768-after-00-0.png`.
- **/tree/0427 stage on tall wide screens (2560×1440, 1920×1200).**
  - Problem: the stage was capped at 1180 px, so a band of empty paper from the next section showed on the first
    screen.
  - Fix: landscape desktops let it fill the screen, up to 1600 px. Screenshot: `ba/tree-2560-*`.
- **"עוד דברים טובים לעץ" cards.**
  - Problem: a one-line description lifted its link above the others.
  - Fix: the links now stand on one baseline at the bottom of the card. Screenshot: `ba/tree-1768-*-02-treemore100.png`.
  - At 769–1060 px the four cards made a row of three plus one alone; they are now 2 × 2.
    Screenshot: `ba/tree-1024-*-00-treemore-40.png`.
- **Herbarium.**
  - Problem: the upper tape floated above the pressed leaf, on empty paper.
  - Fix: it now holds the leaf. Screenshot: `ba/tree-1768-*-01-treeherbbook200.png`.
- **/business form, error state.**
  - Problem: when the phone error wrapped to two lines, the email field beside it stretched; its label and input
    slid down 7 px and the input grew taller.
  - Fix: the rows align to the top. Screenshot: `ba/biz-form-1768-*-00-form-err.png`.
- **/business form → footer hand-over.**
  - Problem: when the page turns cream, the cream WhatsApp pill lost its edge and read as a loose word.
  - Fix: a fine outline while the page is light. Screenshot: `ba/biz-form-1768-*-01-form-handover.png`.
- **Legal pages (terms, privacy, accessibility), bug on every viewport.**
  - Problem: the contact card's WhatsApp `.btn` was an empty green pill. `.doc__article a` painted its label olive on
    the olive button.
  - Fix: the button keeps its own ink. **This is the one deliberate phone change:** the label is now visible there too.
  - Screenshots: `ba/terms-1768-*-00-doccontact-300.png`, `phone/terms-7300-crop.png`.
- **404.**
  - Problem: the "נסו לנשוב עליו" hint crossed the first tuft of grass.
  - Fix: it sits lower in the soil, on the content column. Screenshot: `ba/nf-1768-*`.
- **Small print at ≥ 1440 px wide.** Text that was 12–13 px now reads at 13–15 px:
  - /tree: the readout, the timeline labels, the demo button, the panel notes (the panel note also gets
    `text-wrap: pretty`, so no orphan "שהעץ צריך"), the eyebrows of the "more" cards and the poster card, and the
    herbarium labels;
  - /business: the form's demo note;
  - legal: the TOC numerals;
  - /credits: the "where on the site" line.

### Checked and left as is
- The /business gallery drift finishes as the strip leaves the screen, so the last photo is seen only in passing.
  Finishing it with the strip fully on screen would need about 2× faster drift or a pin, which is a redesign.
- Legal pages keep the article at a 68ch measure next to the TOC, which leaves empty space on the left at
  1768–2560. That is the right measure for reading.
- The reduced-motion gallery rows at 1920 are centred two by two. That is calm and complete.

### Verification
- No horizontal overflow and no console errors on any page at 1024, 1366, 1440, 1768, 1920, 2560 or 1920 with
  reduced motion.
- `npx tsc --noEmit` is clean.
- Phones compared with `e9cdfc7`:
  - structural comparison (every element's box and key computed styles) at 390×844, at 750×342 landscape and at
    932×430 landscape;
  - pixel diffs of 390×844 screenshots (`phone/*`).
- The only differences are animation timing and the legal button label above.

## Verification

Independent check of the desktop polish and the phone scroll-perf work in this area. I compared three production
builds side by side: now, `e9cdfc7` (before the polish) and `fa9748d` (live). Same viewport, same scroll position,
gradual scroll. I looked at every pair. Scripts and shots: `scratchpad/agents/verify-pages/` (`pshot.mjs`, `ab.sh`,
`pair.py`, `capprobe.mjs`, `galprobe.mjs`, `ovf.mjs`, `tab.mjs`, `perfab.sh`; pairs in `d/pairs/`, fixes in `fx/`, `cap/`).

### The polish agent's fixes: confirmed
- /business hero at 1440×900, 1536×864, 1768×900 and 1920×940: the whole hero fits one screen, with the buttons
  and the arrow visible. 1366×768, 1680×1050, 1920×1080, 2560×1440, 1024×768 and 1180×820 are unchanged.
- /tree stage UI on the 1440 column: it lines up with the header's edges at 1768, 1920 and 2560, and nothing changes
  up to 1552. The stage fills 2560×1440.
- 2 × 2 "more" cards at 1024, links on one line, the herbarium tape on the fig leaf, the form error row, the legal
  WhatsApp label (now readable on phones too; an intended fix), the 404 hint below the grass, and the small print
  at ≥ 1440. All checked.
- `container-type: inline-size` on `.tree-stage`: the stage has no `position: fixed` descendants (sheets mount on
  `<body>`), so containment changes nothing. 100cqw resolves correctly in the children that use `--gutter`.

### Found and fixed here (desktop rules only)
- **/tree caption glued to the island.** The island's rim reaches about 2 % of the stage height below its nominal
  box. A fixed 22 px left the caption 2–8 px under the rim at 900–1200 tall. On the taller stage that the polish
  allows (2560×1440 / 1600), the rim cut through the caption's words (−7 / −10 px). The gap now grows with the
  island: 11 / 17 / 20 / 27 / 29 px at 768 / 900 / 1080 / 1440 / 1600 tall. (`tree.css`, desktop block)
- **/tree panel note orphan was not fixed.** `text-wrap: pretty` left "…לפי מה / שהעץ צריך" (Chrome only lifts a
  single-word last line). It is now `balance` at ≥ 769: two even lines at 1366–1920. (`panel.css`)
- **/tree memorial page at 769–1060.** The 2 × 2 rule also hit the memorial page, which has three cards: 2 + 1 alone
  (a regression of the polish). The rule now applies only when there are exactly four cards; three stand in one row.
  (`sections.css`)
- **/business package prices not on one line (missed).** Until Tu BiShvat the holiday card shows a date chip under
  its price. That lifted its price and button about 50 px above the other two cards at 1180–2560. The chip now sits
  under the description, and the three prices and buttons share one line at ≥ 769. At 1024 the cards are 1 + 2, and
  the bottom two align. (`business.css`, desktop block)

### Phones
- Now vs `e9cdfc7`, 390×844 at 16 positions on /business and 15 on /tree: 0.00 % everywhere. The only exceptions are
  the footer letters' timing (0.1–0.3 %) and the WebGL scene at the top of /tree. 750×342 landscape: the same.
  Every desktop rule above, including mine, stays off phones.
- Now vs `fa9748d` (live), 390×844: /tree is identical. On /business the only differences are timing: the package
  art mid-draw at 1062 and the gallery swipe strip's scroll position at 3717/4248 (3 %, same photos, a few px
  apart). No visible regression.

### Phone scroll performance (measured)
iPhone-13 emulation, 4× CPU, DPR 3, 900 px/s. fa9748d vs now, interleaved, 3 runs each, medians. The machine was
loaded (load average 18–28 on 4 CPUs), so fps is noisy; style time and long tasks are the steady signal.

| range | fps | p90 ms | long-task ms | style s | layout s |
|---|---|---|---|---|---|
| /business 2200–4600 | 29.3 → 44.0 | 66.6 → 33.4 | 1006 → 363 | 1.24 → 0.71 | 0.06 → 0.03 |
| /business 0–7800 | 34.7 → 44.3 | 50 → 33.4 | 2738 → 916 | 3.28 → 1.57 | 0.17 → 0.06 |
| /tree 0–1500 | 18.3 → 31.4 | 133 → 67 | 1141 → 776 | 0.25 → 0.06 | 0.03 → 0.01 |
| /tree 900–6400 | 43.4 → 51.7 | 33.4 → 16.8 | 1071 → 427 | 0.42 → 0.13 | 0.21 → 0.03 |
| /legal/terms 0–8400 | 55.1 → 54.9 | 16.7 → 16.7 | 113 → 195 | 0.25 → 0.11 | 0.02 → 0.01 |

- The claimed gains hold. Style time is about halved on /business and down 3–4× on /tree.
- /tree 0–1500 has one outlier run at 10.9 fps, from the scene's WebGL start-up under load. The median still
  improves.
- Legal pages: no fps change (already near 60).
- No new costs from the polish: its rules are desktop media queries, and my additions are static layout.
- Layers (Chrome, by inspection): /business on the phone is down to 12–16 drawing layers. The large ones left are
  chrome's: a 390×2808 `rv-line-mask` during a reveal, `.mbar`, footer letters. /tree on the phone, live and now
  alike: a page-long (390×7728) squashed layer under the stage. Its owner moved from `.tree-stage__veil` to
  `.tree-stage__ui`, and the cause is the scene's own layers (`.ts-fog` will-change, the overlay SVG). This is a
  Chrome-only cost; by reasoning, WebKit does not squash this way. Request to the scene owner.

### Behaviour
- No horizontal overflow at 769, 1024, 1180, 1366, 1768, 1920 and 2560 on /business, /tree, the three legal pages,
  /credits and 404. No console errors. `npx tsc --noEmit` is clean.
- Animations still run: the hero parallax, the steps root scrub, the gallery drift (frames travel 1.66 px per
  scroll px), the package art draw, the herbarium fall and the 404 leaf.
- Reduced motion: the gallery rows, the steps drawn and lit, and the tree with a still scene. Nothing hidden.
- Keyboard order is logical and every stop has a visible ring. The tree hotspots show the ring through `.focus-ring`
  (the element itself reports no outline, but the ring is drawn).

### Still open (not changed, for the lead)
- **/business gallery at 1768×900.** The drift reaches its end when the frames are already above the screen, so
  photo 06 is never seen whole (at most a 125 px sliver) and 05 only in its upper half. The owner may read this as
  "cut off". A fix needs a pin, or an end tied to the frames with a faster drift (about 2.5×). That is a motion
  design decision, so I left it.

## Integration round
A previous run made these edits and was cut off before it could check them. This run checked each one against
`6401b06` (a worktree on its own port) and changed no code. Scratch: `scratchpad/agents/fin-pages/`.

1. **/business gallery: done.** On wide screens (≥ 769 × 561, motion allowed) the section now pins while the strip
   drifts at 1 px per px of scroll, with short rests at both ends (`gallery.ts`, mode `pin`). Landscape phones keep
   the unpinned drift, phones keep the swipe strip, and reduced motion keeps its static rows. Where the drift ends:
   | viewport | strip on screen | photo 06 |
   |---|---|---|
   | 1366×768 | 68–623 | 100 % (191–508) |
   | 1440×900 | 223–806 | 100 % |
   | 1768×900 | 72–726 | 100 % (x 164–684, on the column edge) |
   | 1920×1080 | 283–937 | 100 % |
   | 2560×1440 | 464–1119 | 100 % |

   Every photo is seen whole at some point. No horizontal overflow and no console errors. FAQ, form and footer
   after the pin are measured and revealed correctly (`ScrollTrigger.sort()` before the refresh). The pinned view
   at 1768×900 leaves the section title just above the screen; the strip and its progress line are what you see.
2. **/business 1024–1180: done.** At 769–1319 px the scroll arrow moves to the copy column's start edge, under the
   buttons, so the cookie card takes the free corner under the photo. Overlap between card and arrow:
   - Before: 2304 px² at 1024×768, 1977 at 1180×820.
   - Now: 0 at 1024×768, 1100×800, 1180×820 and 1280×720.

   At 1320 px and wider the arrow stays centred as before. At 1280×720 the arrow sits 11 px under the main button.
3. **/tree/0427 first visit: done at 1440 px and wider.** During the birth intro the hidden timeline, readout,
   `דמו` button and hotspots are `inert` on wide screens, and `cookies.ts` skips `[inert]`. At 1768×900 and
   1920×1080 the card rests in the bottom corner on the far side, during the intro and after it. That is the same
   rect as on a return visit, and the moon and `דמו` stay clear. After the intro `inert` is removed and these parts
   count again. Phones are unchanged.
   - **Open (chrome's placement, not caused by the intro):** at 1366×768 the card ends at top-end, over the
     `דמו` button and the moon, on first and return visits alike. On a first visit it shows bottom-left first.
     About 6 s later the tree caption comes back in the birth's caption phase, and the card moves.
   - **Open:** at 1440–1920 the card's resting place (first and return visits) covers the left part of the
     timeline, including the "היום" knob.
4. **/tree phones, layers: done.** Two changes:
   - On phones and landscape phones `.tree-stage` is its own layer (`will-change: transform`, `tree.css`).
   - `.ts-fog` is promoted only while the fog is there (`data-live`, `scene/index.ts` + `scene.css`).

   `layers.mjs` at 390×844:

   | | page-long squashed layer | layer area |
   |---|---|---|
   | 6401b06 | 390×7728 (`tree-fx` / `tbirth` / `tree-stage__ui`) | 32.9 viewports |
   | now | none besides `#document` | 22.0 viewports |

   The fog change alone does not remove the squashed layer; the stage layer does. `jank.mjs` (4× CPU, DPR 3,
   0–1500, return visit) was run as A/B on one server: A = CSS undo of item 4, B = item 4. Over 7 pairs in both
   orders the medians are 35.5 vs 38.3 fps, within the noise (load average 9–15 on 4 CPUs, and the first run of
   each pair is favoured). So there is no measurable fps change in headless Chrome. The gain is structural: one
   page-long layer less, which matters for memory and raster on iOS. This is not checked on a real iPhone.

**Phones identical to 6401b06.** iPhone 13 emulation, consent preset:
- /business 390×844, 10 positions (gallery included): 0.00–0.03 %.
- /tree 390×844, 9 positions (return visit): 0.00 % except the live WebGL scene at y=0 (fireflies and glow, the
  same look side by side).
- /tree 844×390: the same.

`npx tsc --noEmit` is clean for these files.
