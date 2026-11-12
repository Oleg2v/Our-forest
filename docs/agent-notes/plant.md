# plant — /plant configurator, plaque engraving, mock checkout and certificate

## What is built
- **/plant** (`plant/index.html` → `src/pages/plant.ts` → `src/plant/index.ts`): one screen. On desktop the steps sit on the start side, with a sticky "stage" on the end side that acts as the visual summary. On phones (≤768px) the stage sits on top, each step gets its own screen in a bottom sheet (drag or tap the handle to give the sheet the whole screen), and a sticky bar shows the rolling price, back, and next/pay.
- **Modes** via `?product=`: `tree` (default, 8 steps), `corner` (8 steps, base price 18,000 ₪, shows the corner parts), `bench` (carpentry item → occasion → plaque → location → extras → gift → summary → payment), `workshop` (workshop → date → seats → gift → summary → payment). A `?ws=` link on its own opens workshop mode. A segmented switch at the top changes the mode.
- **URL = state** (`src/plant/store.ts`): `species, occasion, text, spot, x` (the extras list), `item, ws, date, seats, gift=1, to, when, gdate, msg, via, step`. Selection changes use `replaceState` (debounced). Step changes use `pushState`, so the phone back gesture goes back one step and keeps the current selection; a different `product` in history restores that URL. Name, phone and e-mail are never written to the URL.
- **Stage** (`stage.ts`). The chosen species grows from a sapling: MorphSVG on the trunk and crown outlines, DrawSVG on the roots, then the fruit, leaves and blossoms pop in. A small bird lands (a playful detail). The live plaque stands at the tree's foot. Extras appear in the scene (family, watering can, framed certificate, box), a paper tag hangs from a branch when the order is a gift, and the spot chip shows the chosen place. Below that: compact lines (click one to jump to that step), the rolling total, "ממשיכים לתשלום" and the guarantee.
- **Memorial mode** (`לזכר אדם אהוב`; only in modes that have the occasion step): the stage turns quieter and cooler, colours are muted, `--fruit` is muted locally, every animation runs 1.5× slower, `[data-playful]` details (the bird) are hidden, the plaque has no sparks and gets a warm glow behind it, and the certificate stamp settles without a shake.
- **Steps**:
  - species: line-art cards. They form a radiogroup.
  - occasion: chips. Tapping the selected chip again clears it.
  - plaque: up to 40 characters, burned in live.
  - location: "תבחרו בשבילנו" (the default, always works) or the map.
  - extras: real checkboxes. Prices: family +540, guardians 36/month, certificate +90, box +144.
  - gift: a switch, then to whom, when (now / Tu BiShvat 23.1.2027 / another date), the greeting, and WhatsApp or e-mail. A postcard preview comes out of an opening envelope.
  - summary: "מה מקבלים" (he.plant.includes) plus the rolling total.
  - payment mock: name, phone, e-mail; Bit, Apple Pay, Google Pay or card (neutral text and line icons, no brand logos). There is light validation and an honest "this is a demo" line.
- **After "payment"** (`certificate.ts`): the copy plus the certificate (a ticket for workshops). The paper slides out of a slot in three feeds, then the stamp falls with a light shake and a chime. The buttons are "צפו בעמוד העץ" (`navigate()` → `/tree/0427?birth=1&species=…&text=…[&mode=memorial]`), "שתפו בוואטסאפ" and print. The certificate holds a QR code to the tree page (qrcode-generator), the burned plaque as a PNG, and the facts. **Print**: `src/plant/print-certificate.css` puts it on exactly one A4 page; verified with `page.pdf`.
- **Analytics**:
  - `view_item` on load.
  - `select_item` for species, carpentry items and workshops.
  - `add_to_cart` when an extra is added and when the summary step is reached.
  - `begin_checkout`, `purchase` (transaction id, value, items, payment_type).
  - `gift_started`, and `share_tree` from the done view.
- **A11y**:
  - Radiogroups use roving tabindex with RTL-aware arrow keys.
  - Each step is a `section` labelled by its h2. The rail is a `nav` with `aria-current="step"`.
  - Step changes are announced politely ("שלב 2 מתוך 8: …"), and focus moves to the step title on rail or summary jumps.
  - Prices have sr-only text (the digits are `aria-hidden`).
  - The plaque canvas has `role=img` with the dedication as its label. The next button has a full accessible name.
- **Reduced motion** (`env.motionAllowed()` plus `bus 'motion:change'`): no morph or burn. The tree, plaque, envelope, price digits and certificate all show their final states.

## The plaque renderer — `src/components/plaque/` (for the /tree scene)
```ts
import { renderPlaque, createPlaqueEngraver, createPlaqueTexture, createWoodTexture, plaqueFontReady, PLAQUE_ASPECT } from '../components/plaque';
renderPlaque(canvas, 'לכבוד הולדת נועה', { burnProgress: 1, memorial: false });     // one static frame (0..1 = share of letters burned)
const tex = createPlaqueTexture(text, { width: 1024, memorial });                     // finished plaque on an offscreen canvas → THREE.CanvasTexture
const eng = createPlaqueEngraver(canvas, { width: 1024, height: 427, memorial, onRender: () => (texture.needsUpdate = true) });
eng.setText(text, { instant: true });          // or setText(text) to burn new letters live
await eng.burnAll({ from: 0.7, duration: 1.2 }); // "the engraving finishes burning on the last letter" (birth 4.0–6.0 s)
eng.setMemorial(true); eng.setMotion(false); eng.toDataURL(); eng.destroy();
```
- Canvas aspect `PLAQUE_ASPECT = 2.4`. Without `width`/`height` the engraver tracks the CSS size × DPR (≤2) with a ResizeObserver. With fixed `width`/`height` it works offscreen (for a 3D texture).
- The wood is procedural (value-noise rings, one knot, fibres and pores, sanded darker edges, a bevel, two brass screws) in the brand leaf shape (big radius top-left and bottom-right), and it is seeded: the same `seed` (default 427) gives the same plank. `memorial` uses a muted wood tone.
- The text is Frank Ruhl Libre 500, RTL, and wraps to two lines when needed. The letters are charred (pattern fill, scorch halo, a light lower lip for depth). While burning there is a glowing laser dot that rasters up and down over the actual ink of each column, sparks (none in memorial), light smoke, and a cooling ember trail. The RAF loop runs only while something moves and pauses when the tab is hidden.

## Verified
- `npx tsc --noEmit` shows zero errors in my files.
- Full Playwright purchase flows (`scratchpad/agents/plant/flow.mjs`) on 390×844 and 1440×900: species → occasion → typed plaque → map spot → 2 extras → (gift) → summary → pay → certificate. That is 17–20 interactions. Scripted runs took 4–32 s; the long ones are mostly the 1.7 s screenshot waits. A human with default choices needs 7 taps + name + phone, which is well under 60 s one-handed. No console errors and no horizontal overflow on mobile or desktop, `--reduced` included. Also checked 820, 1024 and 1180 widths.
- Round trips: deep links restore the step, mood and gift; reload keeps everything; back/forward keeps the selection; switching mode works.
- Memorial and gift flows look right on screen. The print PDF is one A4 page. A simulated keyboard (viewport 390×400) keeps the plaque fully visible above the input.

## Known gaps / honest notes
- **The forest map is still a stub.** The location step calls `createForestMap(el, {mode:'picker', onSelect, initialSpotId})`. Until that element gets children, my own mini plan of free, reserved and planted spots is shown and works; when the real map renders (sync or async), a MutationObserver switches to it. I could not test the real map. "תבחרו בשבילנו" always works.
- Sub-prices that `prices.ts` does not list are demo placeholders in `src/plant/catalog.ts`: table 5,400, fire place 6,300, kitchen 12,600, outdoor class 16,200, the dogs workshop 216 per person, and workshop dates (the next Fridays/Saturdays) with seat counts.
- Micro-copy that the brief does not give is mine and kept short: step titles for the bench, workshop and payment steps, "איך שולחים?", "עכשיו / בתאריך אחר", "תעודת נטיעה / תעודת הקדשה / כרטיס לסדנה", the form errors, the demo-payment note, "חורטים שוב", "מדפיסים את התעודה" and the done-view lead.
- The iOS/Android keyboard behaviour was simulated, not tested on a device. Phones use `visualViewport` (`--vvh`, `.is-typing`), and on the plaque step focusing the input folds the stage away and scrolls the plaque directly above the field.
- The certificate number is the chosen spot id, or 0427 when the spot is auto. "צפו בעמוד העץ" always opens the demo tree 0427.
- Headless Chromium with `--use-angle=swiftshader` (the flags `scripts/shot.mjs` uses) can time out on screenshots *during* animations, because of the software raster of the full-page grain. `shot.mjs` with a wait is fine; my flow script launches without those flags.

## Requests to other owners
- **tree-ui / tree-scene**: the "view tree" link passes `?birth=1&species=<id>&text=<dedication>[&mode=memorial]`. Please read these if you can, so the newborn tree matches the order, and use `src/components/plaque` for the plaque texture so the plank and font are identical.
- **map**: picker mode should call `onSelect(spot)` with `spot.id` and highlight `initialSpotId`. My step sets `.pcs-map` to `clamp(300px, 40vh, 380px)` tall and it is `data-lenis-prevent`.
- **chrome**: I set `html[data-hide-sticky]` on /plant and call `refreshChrome(root)` after rendering. The print CSS hides `body > :not(main)` only after a purchase (`html.pc-has-cert`).
