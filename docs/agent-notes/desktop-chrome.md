# Site chrome: desktop polish and phone performance notes

## Integration round

These are the requests the verifiers left for chrome. A previous agent started them and was cut off by a restart. Its edits were checked here, item by item, against 6401b06. A is a worktree of 6401b06 and B is the current tree, both on dev servers. No code changes were needed in this pass.

1. **`header.ts`: element scrolls are ignored.** `onScroll` returns early when `e.target` is neither `document` nor `window`.
   - Test: on the /plant phone page, four sweeps of the `.pc__scroll` sheet.
   - A: 15 tone hit tests and 12 cookie rect reads. B: 0 of each.
2. **`header.ts`: the position comes from `ScrollTrigger.getScrollFunc(window)`.** It is read in the rAF `update`. The value cannot go stale, for these reasons:
   - ScrollTrigger's `scroll` listener on `document` increments `_scrollers.cache` on every page scroll, before the header's rAF runs.
   - The same counter is also bumped on `wheel`, on `resize` and by `ScrollTrigger.update`, which is how Lenis reports its scroll.
   - On a page with no triggers, the first read after an event is simply fresh.
   - Tested on all 7 pages, at desktop 1768 (Lenis, wheel) and on a phone (rAF scroll): down, up, down, up, then a resize (to 1366×768 or 414×800), then back to the top.
   - Hide, show, compact and tone were the same in A and B everywhere. Compact always matched `scrollY > 80`.
   - `sticky.ts` uses the same cached value, and its height is kept from the last resize. The home phone bar turns on and off at the same scroll positions in A and B, also after a resize.
3. **`cookies.ts`.** The scroll listener uses the capture phase.
   - Element scrolls pause the loop but do not trigger a re-check.
   - `stop()` ends the loop and removes the listeners and the MutationObserver.
   - A `storage` listener handles an answer given in another tab.
   - Test: when another tab accepts, A keeps the card up and reads 24 rects every 5 s. B hides the card and reads nothing.
4. **`chrome.css`: the `.cookie` lift is now `translate`, not `bottom`.** The card rests at `bottom: --ck-a + safe`. It is lifted by `max(bar, floor + --ck-b − --ck-a − safe)`, which equals the old `max()`. Top slots use `--ck-lift: 0`.
   - The card's rects are the same in A and B on the / phone page, the /plant phone and 1768 pages, and the /business 1366 page.
   - Only `translate` and `transform` transitions run; `bottom` no longer animates.
   - The rule is unchanged in the built CSS.
5. **`base.css`: on touch screens `<body>` fades only `background-color`.** Test: a light-to-soil turn on /business.
   - Phone, B: only `background-color` runs. Phone, A: `color` runs too.
   - Desktop: A and B are the same (both properties, 0.9 s).
6. **`reveal.ts`.** On touch screens the reveal uses `force3D: false`. On complete it calls `clearProps: transform,transformOrigin,opacity`.
   - /business phone: during a reveal, A had a 358×1457 overlap layer (and a 390×2808 one from the photo blur). B has neither.
   - After a reveal, the lines in B have no transform, no opacity and no `will-change`.
   - Line tops just before and just after the end are the same on desktop and phone, so nothing jumps.
7. **`tokens.css`: the eyebrow size.** It is now `--fs-eyebrow-base`, which is 14px, and `clamp(14px, 0.8vw, 16px)` at 769px and wider. `--fs-eyebrow` reads it, and the a11y levels in `chrome.css` scale the base.
   - Sizes: 14 / 14.14 / 15.36 / 16 px at 1366 / 1768 / 1920 / 2560.
   - Every eyebrow on all pages fits on one line, with no overflow.
   - Phones stay at 14px.
   - Text-size level 1 at 1366 gives 15.75px. Level 2 at 1920 gives 19.2px (A: 17.5px).

**Also checked**
- All 7 pages at 1768×900 and 390×844, A vs B, at the top and after a scroll:
  - no console errors and no horizontal overflow;
  - the header band is identical;
  - phones are identical apart from animation phase (the home video, the tree's intro, the 404 leaf).
- A full purchase with `buy.mjs`, desktop 1768 and phone: done view, certificate, focus on `#pdone-t`, no errors.
- `tsc` reports no errors in `src/chrome`, `src/core` or `src/styles`.

**Not changed, but worth knowing**
- `images.ts`: photos that finish loading out of view are shown sharp at once, without the blur transition. This came from the previous agent and is part of why the 390×2808 layer is gone.
- On /business desktop, `section.biz-steps` is now a 1768×3834 overlap layer. It is not one in 6401b06. It is not a reveal or line-mask layer; it most likely comes from the /business owner's new section. That owner should look at it.
- Desktop reveals still use `force3D: 'auto'`, so the lines are layers while they rise.
- `[data-reveal='letters'] .rv-char` keeps `will-change` while letters rise, on phones too.
- Nothing here was tested on a real iPhone.
