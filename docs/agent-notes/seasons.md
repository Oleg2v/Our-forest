# seasons — home section 4: "קונים חוויה, יוצרים השפעה" strip + "הסדנאות הקרובות"

## Files
- `partials/home/seasons.html`: `section#seasons.seasons[data-bg=season]` holding:
  - the heading and the Tu BiShvat plaque;
  - three experience cards;
  - the ruler and dots slots;
  - the workshops block `.seasons__ws[data-bg=sand]`, with static fallback rows.

  Copy is verbatim and is re-synced from `he.ts` at init via `data-he`. Prices are re-synced from `prices.ts` via `data-price`.
- `src/sections/home/seasons.ts` (+ `seasons.css`): the section controller (modes, pin, carousel, entrances). The contract `initSeasons()` is kept.
- `src/sections/home/seasons-branch.ts`: the seeded line-art fig and pomegranate branch (tapered limbs, forks, leaves, fruit), the almond twig and the almond icon.
- `src/sections/home/seasons-workshops.ts`: the workshop rows and the floating photo.

## The motion idea: travelling through a year
**One variable.** One inherited, registered CSS number, `--sp`, set on the section: 0 → 3 = spring → summer → autumn → winter. Everything seasonal is a CSS formula of it (nested `color-mix(... clamp(...))` plus `calc` transforms). JS writes only that one property per frame.
- **Background.** The section paints its own colour. The four season tones are mixed from the palette tokens: pale sage spring, straw summer, pale terracotta autumn, rain-grey-green winter.
- **Leaves.** They start young and small (light olive), grow full (`--olive-deep`), turn amber in autumn (bark+fruit), then fall in winter: they drift, spin and fade. Each leaf has its own offset.
- **Fruit.** Pomegranate blossoms (fruit-coloured) give way to green buds, which ripen to `--fruit`. Figs go from bud to green to ripe. The ripening is a wave along the branch: the start (right) ripens first, so it travels with you. Winter shows ripe fruit on a bare branch.
- **The real season.**
  - The ruler marks "עכשיו" on the season it is now in Israel (`seasonOf()`; autumn today).
  - Reduced motion shows the real season as a static palette.
  - Dev only: `?season=winter` forces it.

## Modes (rebuilt on `motion:change` and when crossing 768px)
### Pinned (desktop with motion)
- The heading and plaque become the strip's first panel. The stage is pinned (`100svh`) and the track travels right → left (it translates +x) with `scrub: .6`.
- The pin lasts `max(travel × 1.75, 1.6 × vh)`, with short holds at the start and the end.
- **Branch.** It sits along the top. It draws itself on entry (DrawSVG on the double-contour stem and twigs, then the leaves and fruit pop in staggered by position).
- **Cards.**
  - Photos sit in a leaf `.leaf--hover` wrapper (`data-cursor="גלו"`). The `<img>` has `data-gl="ripple"` for the hero's WebGL ripple; I checked that the canvas lands exactly over the photo.
  - Each card reveals through a leaf clip-path (scale 1.2 → 1, 1.4 s power4.out) when it enters the stage horizontally.
  - The photo has a slight inner parallax (`xPercent` on the img, which the ripple copies).
  - Card offsets are cached on refresh, so there are no layout reads per frame.
- **Ruler.** The year ruler at the bottom is also the strip's progress. Its ticks are buttons that scroll to that season.
- **Keyboard.** Focusing a card's button scrolls the page so the strip brings that card to the middle. The viewport uses `overflow: clip`, so focus never scrolls the stage itself.

### Carousel (≤768px)
- Order: heading → branch → native `scroll-snap` carousel → progress dots plus the current season's name.
- Slides: the Tu BiShvat plaque comes first, drawn as an almond twig in bloom with a fruit "נוטעים עץ" button. Then teams, gift and events.
- The season follows the swipe continuously. It is mapped piecewise between the real snap points, so every slide lands exactly on one season: plaque = spring (Tu BiShvat, the trees' new year), teams = summer, gift = autumn, events = winter.
- Dots are labelled with the slide titles and jump straight to any slide. Android gives a light haptic on each slide change, and a quiet `rustle` plays on season change (only while sound is on).

### Grid (desktop with reduced motion)
- No pin. The heading and plaque sit side by side, the branch hangs over a three-column card grid, and the static palette is the real season.

### Reduced motion on phones
- The carousel stays (it is user-driven), with the real-season palette fixed. There are no entrances.

### No JS
- Desktop shows the grid layout. Phones get the scroll-snap carousel without dots. Prices and links still work.

## Workshops: "הסדנאות הקרובות"
- **Rows.** The rows are the next 4 sessions from the configurator's own catalog (`WORKSHOPS` and `workshopDates()` from `src/plant/catalog.ts`). Each row shows:
  - the weekday (via `Intl`) and the date (`ilDate`);
  - the title;
  - "נשארו N מקומות" (3 or fewer is emphasised);
  - the price in fruit plus "למשתתף";
  - "שומרים מקום", linking to `/plant?product=workshop&ws=<id>&date=<iso>`.

  The whole row is the link: a stretched `::after`, one tab stop. Clicks fire `track('select_item')`.
- **Hover photo (desktop, fine pointer, motion on).** The workshop photo (wsCarpentry, wsDogs or wsGarden) appears as a leaf-shaped card that trails the cursor (`quickTo` .75 s), leans with the cursor's speed, opens with a clip, and cross-fades between rows. It is `position: fixed`, so it can never cause overflow, and it follows the row under a still cursor during wheel scroll.
- **Thumbnails instead.** Touch devices and reduced motion get a 64px leaf thumbnail in every row.

## Verified
- `tsc --noEmit` is clean for my files, and `vite build` into scratch passes with the CSS intact (`@property`, nested `color-mix`).
- I looked at screenshots on dev server :5184:
  - desktop 1440×900 at 7+ positions through the pin (spring, summer, autumn, winter, unpin, workshops);
  - laptop 1280×720;
  - mobile 390×844: the entrance, every slide, the workshops;
  - `--reduced` on desktop (grid, autumn) and on mobile;
  - the hover photo on two rows.
- Scripted checks:
  - keyboard focus on an off-screen card brings it to the centre;
  - a ruler click goes to that season;
  - dot taps land on the right slide and season (0 / 1 / 2 / 3);
  - the a11y "stop animations" switch on → grid, and off → pinned again;
  - resizing 1440 → 700 → 1440;
  - deep link `/#map`, then scrolling back up: the cards are revealed;
  - the ripple canvas box equals the photo box.
- No console errors and no horizontal overflow on mobile or desktop, reduced motion included. The dev server is stopped.

## Known gaps / honest notes
- **Workshop dates.** They come from the plant agent's `workshopDates()`, so they are the next Fridays and Saturdays from today (currently mid-November to December), not fixed Dec 2026–Feb 2027 dates. I chose this on purpose so the `&date=` deep link always matches a date the configurator accepts. If `/plant` changes that function or the `WORKSHOPS` shape, my list follows it. That is an import dependency on `src/plant/catalog.ts`.
- **Plaque window.** The Tu BiShvat plaque shows only in the 150 days before 23.1.2027 and removes itself after that. Its link goes to `/plant` (tree). On desktop it sits in the strip's first panel; on phones it is the first carousel slide, by design: the season is spring, because Tu BiShvat is the trees' new year.
- **Short micro-copy that is mine**, since the brief gives none: the season names אביב / קיץ / סתיו / חורף, "עכשיו", and the ruler's aria-label "עונות השנה".
- **Not tested by eye.** The scrub feel, the leaf-fall timing and 60 fps were tuned from stills in headless Chrome, not on a real laptop or a mid-range Android. On phones every scroll frame restyles the section subtree (about 70 SVG groups) because of the inherited `--sp`. It is cheap in tests, but it is not profiled on a device.
- **Branch near the cards.** At some strip positions on desktop, the branch's lowest fruit and the down-fork's leaves overlap the top few px of a card photo. That is intended as depth, but worth a look.
- **Touch tablets wider than 768px** get the pinned strip with native scroll. This is untested on hardware.

## Requests to other owners
- **hero / gl (FYI):** `base.css` sets `canvas { max-width: 100% }`. That clamps the ripple canvas whenever the `<img>` is wider than its parent (my parallax photos are 110%). I fixed it locally (`.seasons__img canvas { max-width: none }`). `ripple.ts` could set `max-width:none` in its `cssText` for everyone.
- **chrome (FYI):** for `data-bg="season"` sections, bg.ts leaves `--ink` from the previous section (cream after the soil section). I override `--ink`, `--ink-soft` and `--line` on `.seasons`, so it is fine here. Other "season" users would hit the same thing.
- **plant:** please keep `WORKSHOPS` (id, title, price, seats[]) and `workshopDates(ws, now)` exported. The home workshop list depends on them.
