# treeUI — /tree/0427 "העץ שלכם" (the page around the living scene)

Owner files: `tree/0427/index.html` (main + head meta, `<link rel="manifest">`), `src/pages/tree.ts`, `src/tree/model.ts`,
`src/tree/ui/**` (`index.ts` orchestrator + one module per idea + 4 CSS files), `public/manifest.webmanifest`, `public/sw.js`,
`public/icons/*` (96/192/512/maskable-512 + `apple-touch-icon.png` used by head-common), `public/og/tree-0427.jpg` (1200×630, made by the page's own share renderer).
The scene is used **only** through `src/tree/scene-api.ts` + `createTreeScene()`; composition is steered with the documented CSS vars
`--tree-scene-cx/cy/fill` on the stage.

## Layout
Desktop: island centred (cx .455), head + action panel on the reading-start side (right), "עכשיו ביער" honest readout bottom-left,
calm cards on the left with an engraved leader line to the point they talk about, timeline across the bottom, caption under the island
("התאנה נכנסת למנוחת חורף · בן 9 חודשים" — the brief's "caption under the tree"). Phone (390×844, designed separately): island in the top
~60 %, panel under the thumb ([מזמינים] (drop 72px) [משתפים]), timeline at the very bottom, cards rise above the panel; the site's sticky
bar steps aside (`html[data-hide-sticky]`) while the stage is on screen. Night (Israel time ≥ ~19:00) → the stage UI goes cream-on-moss and
the header is re-probed (I emit `bus 'theme:section' {bg:'moss'|'cream', dark}` on tone change).

## What works (all verified in headless Chromium, see Verified)
* **States 7.3** via `?state=before|birth|visit|absent|gift|multi|offline`, `?mode=memorial`, `?birth=1` (+ `species=`, `text=` from the
  configurator), `?greet=1`, `?qr=1`, `?gift=1&from=&msg=`, `?hours=`, `?weather=`, `?season=`, `?harvest=1`. Default: first visit → birth,
  later → visit, ≥14 days away → absent (localStorage `of:tree:<id>`), real `navigator.onLine === false` → offline.
  * before: seed in the cut + "הנטיעה בעוד 9 ימים" drums, then a push-like notice "העץ שלכם ניטע" → birth.
  * gift: envelope (line art, wax-seal leaf) → letter → "פוגשים את העץ" → birth.
  * absent: "התגעגענו" card with a short summary (team waterings, pruning, new greetings, height).
  * multi: 0427 + two real family points from `trees.json` (0122 olive, 0114 pomegranate); arrows/dots/swipe on the text & panel
    (the scene itself keeps horizontal drag for rotation); the island slides out/in.
  * offline: banner with the time of the saved copy; a watering is queued and sent (counter +1, toast) when `online` fires.
* **Presenter** ("דמו" button or the **d** key): state, celebration/memorial, hour slider / live Israel time, weather stub
  (clear/wind/rain/hamsin), season (by calendar or forced — a forced season also "visits" and lays that leaf in the herbarium), ripe fruit,
  "רצף של 6 ימים", "5 עלים חדשים", reset demo data. The URL remembers the switches.
* **Birth 7.4**: `scene.playBirth` with a quiet eyebrow, a light header over the dark soil close-up, skippable (tap / Esc / "דלגו"), at the
  `done` phase the caption "העץ שלכם נולד" + date + "משקים בפעם הראשונה" (focuses & hints the drop) / "משתפים". Replay from the timeline's
  "יום הנטיעה" mark. Reduced motion: the scene's quiet version, same caption.
* **Watering 7.5**: hold the drop; ring fills (tick at 0.6 s, counts from 0.6 s, full at 1.5 s → completes on its own); the line-art can
  slides in from the corner and tilts; 2D canvas water arc (≈140→520 drops/s, gravity, splashes; ink-coloured, engraving style);
  `scene.waterStart/Progress/End`; `sound.loop('water')` louder with the ring, rustle after, haptic at start (+ a tick at 0.6 s) and soft at
  the end; community counter rolls +1 (each digit its own drum) with "השקיות הקהילה היום בחסות שם החברה" and a hairline to the sponsor's next
  tree (every 1,000). Once a day per browser (Israel date): the drop drains and "sleeps", "העץ שתה היום. נתראה מחר" + "ההשקיה הבאה בעוד …".
  Streak = a thin vine around the button, one leaf a day (14 max), a missed day silently restarts it. Honest line under the button.
  Keyboard: Enter/Space on the drop (a short press still pours fully), Enter on the focused scene, a visible "משקים בלחיצה אחת" button,
  AT clicks (detail 0) pour automatically. Escape cancels.
* **Gestures & cards 7.6**: scene `hotspot` events + focusable DOM proxies from `getHotspots()` (Tab: plaque, QR, fruits, greeting leaves,
  trunk, ground; arrows rotate). Fruit → "מתי קוטפים?" + harvest invitation / "מארז מהיער"; greeting leaf → the greeting; plaque → the scene's
  focus + the dedication large on a paper card + "חוזרים לעץ"; QR → note; ground long-press → "השורשים כבר בעומק 40 ס״מ"; trunk → scene shake.
* **Greeting leaves 7.7**: tree.json greetings (+ the visitor's) → `GreetingLeaf` (glow 7 days); journal shows all; invite → `wa.me/?text=`
  with `?greet=1`; the friends' mini-page (sheet): name, greeting, 18/36/54/own (min 18), Bit/card mock, live leaf preview with initials →
  back to the tree, the new leaf lights up with a card. Owner message "נועה, יש לך N עלים חדשים" (new since the last visit / presenter).
* **Timeline 7.8**: range input (RTL, right → left), 72 % past / dashed 28 % future; scrubbing sets `ageDays` + that date's season;
  team photos pop up as polaroids (`pictureHtml`) on their dates; future → `futureGhost` + "ככה הוא ייראה בעוד 5 שנים" + guardians link;
  "חוזרים להיום". While away from today the water panel steps aside.
* **Herbarium 7.9**: book spread (sand pages, fold), 4 season sheets + "הפרי הראשון" + "ביקור ראשון ביער" (`?qr=1`); pressed leaf drawn per
  species (procedural fig lobes, mulberry heart, almond/olive/pomegranate/carob sprigs, deciduous winter = bare twig with a bud), paper
  texture filter, tape, embossed date, Latin name; laid in with a paper sound when the book scrolls into view; ink seal "שנה שלמה עם העץ"
  (dashed until earned); poster pre-order (WhatsApp). Hidden in memorial mode.
* **Share 7.10**: 9:16 (1080×1920) + 1:1 canvas — `scene.snapshot` in a leaf frame, dedication in Frank Ruhl, date, brand, QR + URL;
  Web Share with files where `canShare`, else download; WhatsApp text, copy link; `track('share_tree')`. Same renderer → OG image.
* **Money without pressure 7.11**: after the first watering a calm "מצטרפים לשומרי העץ 36 ₪ לחודש" card; ripe fruit → harvest card;
  "עץ אח" → `siblingSpot: true` (the scene draws the dashed spot) + card; additions row (sibling, framed certificate 90 ₪, poster, box 144 ₪).
* **Memorial 7.12**: no counter/streak/badges/herbarium/upsell cards; "מדליקים נר" (free) → a candle with a soft flame stands on the soil
  beside the plaque (scene's warm plaque glow), "מילים לזכר [שם]" instead of greetings (free words form). Demo dedication: "לזכר סבא אברהם"
  (a real memorial point on the map) unless `text=` is given.
* **Sound 7.13**: `sound.setAmbient` by time of day / rain / memorial (off until the header toggle).
* **A11y 7.15**: hidden description from the real state (`describeTree`: "עץ תאנה, בן 9 חודשים, מתכונן לחורף, הושקה היום…"), the scene
  element is focusable with the same label + "Enter משקה, החיצים מסובבים", polite/assertive live regions, every gesture has a button,
  sheets are real dialogs (trap, Esc, inert background, `modal:open/close`).
* **Bottom 7.17**: tree card (number, species + Latin, date, dedication, planted by, place) with a real QR (`?qr=1`), "מה שלום העץ?"
  (age, season, height, roots, team watering, pruning, now in the forest), the journal, buttons "באים לבקר" · "מצטרפים לשומרי העץ" ·
  "משתפים" · "נוטעים עץ נוסף" · "מוסיפים למסך הבית" (`beforeinstallprompt`; iOS / other browsers get short instructions).
* **PWA**: manifest (scope `/tree/`, standalone, RTL, theme moss, bg cream, maskable icon, a shortcut), `sw.js` (network-first page with
  cached fallback, stale-while-revalidate for assets/fonts/images), registered **only** in production builds.
* **Analytics**: `tree_watered`, `share_tree`, `gift_started` (greet form open / invite link), `purchase` (mock greeting payment).

## Verified
* `npx tsc --noEmit` → 0 errors (whole project at the time of the run).
* Dev server :5194 with my own Playwright runner (`/tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/treeUI/shot.mjs`; it mocks the Vite HMR websocket, otherwise other
  agents' edits reload the page mid-test). Mobile 390×844 + desktop 1440×900 for: visit, birth (5 frames), hold-to-water (scripted
  pointer down/up + Playwright fake clock for mid-hold frames), the once-a-day lock (second hold → no count), before, gift (closed/open),
  absent, multi (switch), offline, memorial + candle, timeline past/planting/future with polaroids, plaque, greeting, roots, presenter,
  harvest + fruit card, night, greet flow (errors → filled → leaf reveal), share sheet (9:16 / 1:1), install sheet, full-page sections,
  `--reduced` (SVG scene, keyboard Tab order, Enter on the scene waters). Extra sizes 1280×720, 1024×768, 375×667, 430×932.
  No console errors, no horizontal overflow (fixed one: the herbarium grid's min-content pushed 375px phones to 399px).
* Share PNGs and the OG JPG were generated with the real renderer and looked at.
* Production build into scratch (`vite build --outDir <scratch>`) + `vite preview`: the SW registers with scope `/tree/`, an offline reload
  serves the cached page (styled), the offline banner shows, a watering is queued, and going online flushes it (counter 1,285, toast).

## Known gaps / honest notes
* Push notifications ("ניטע", "פרח", "הפירות בשלו") are not implemented (live version only, as the brief says). Payments are mocks.
* Web Share with files, `beforeinstallprompt`, Android vibration and the iOS "add to home screen" instructions were not tested on devices.
* The SW precaches only the shell list; hashed assets are cached at runtime, so offline works after one online visit.
* Sound levels were not listened to (headless).
* Weather is a stub (presenter); the live version needs a weather API for the moshav. `hasNews` = anything newer than the last visit.
* The DOM proxies open the same cards as taps, but cannot make a fruit swing / a greeting leaf pulse visually (no such API in the contract).
* Micro-copy the brief doesn't give is mine, short and in the brief's voice: per-species season notes (the fig/autumn one is the brief's),
  journal event lines, card bodies, form labels/errors, "משקים בלחיצה אחת", "ההשקיה הבאה בעוד…", offline texts, herbarium waiting labels,
  poster/addition card texts, presenter labels. Demo greetings for "5 עלים חדשים" are demo data (names + short wishes), not testimonials.
* The demo's "before" countdown is fixed at 9 days (the brief's example).

## Requests to other owners
* **tree-scene**: (1) optional API to poke a hotspot visually from the DOM (`poke(id)`: fruit swing / greeting pulse) so keyboard users get
  the same motion; (2) the young olive (multi → 0122, 8 months, autumn) renders almost leafless — evergreen olive should keep its leaves;
  (3) at mount the static frame briefly shows the grown tree before `playBirth` starts — I hide the scene element (opacity 0) until the
  flow starts, which works, but a `mount({ birth: true })` hint would be cleaner.
* **chrome**: I emit `bus 'theme:section' {bg, dark}` when the tree page switches day/night so the header re-reads its tone; tell me if
  that payload is wrong for other listeners.
* **Lead**: `public/og/tree-0427.jpg` now exists (the SEO partial expects it); `public/icons/apple-touch-icon.png` exists for head-common.
  Regenerate the OG with `node /tmp/claude-0/-home-user-Our-forest/ca77a1a7-7290-5365-ba24-a8eae1a066ec/scratchpad/agents/treeUI/og.mjs "<dev-url>/tree/0427?state=visit&hours=10" <dir>` if the scene's look changes.
