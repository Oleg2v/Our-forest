# roots: home section 3 "מתחת לפני השטח" + the line-art dog

## Files
- `partials/home/roots.html`: markup (`section#story.roots[data-bg=soil]`, `#directions` block, 5 nodes with inline line icons, placeholder sapling art)
- `src/sections/home/roots.ts` (+ `roots.css`): section controller
- `src/sections/home/roots-geometry.ts`: seeded RNG, Catmull-Rom paths, path sampling, soil surface/grass, pebbles, rootlets
- `src/components/dog.ts` (+ `dog.css`): the dog (contract kept and extended)

## How it works
The motion idea is that the root grows with your scroll. All lines are generated from the measured HTML layout,
so they always meet the nodes. The section rebuilds on resize, on crossing the 768px breakpoint, on `motion:change`,
and once after webfonts load if the layout changed.

- **Desktop + motion (`roots--pinned`)**: the stage is pinned for 2.5 viewport heights (the section is about 350vh).
  The "world" inside it is a cross-section: a cream band, a wavy soil surface with line grass, then soil with a
  topsoil tint, grain, pebbles and strata. The photo leaf sits across the surface. One scrubbed timeline runs these phases:
  1. The story paragraph reads in, word by word from pale to full. The sapling's first roots grow from the bottom of the photo.
  2. The camera dives (`power2.inOut`) and the tap root leads.
  3. Lateral roots branch to nodes 1–4 in turn; the tap root ends in node 5 (עבודת אדמה). Each node lights up:
     its ring and icon draw themselves (DrawSVG), a halo appears, and the title and caption rise. Rootlets and root tips draw as the roots pass them.
  4. Finale: light flows from every node back along its branch into the tap root and rises up and out of view.
     This is the brief's "roots converge into one line that leads upward".
  - Title lines rise from a mask and the photo reveals through a leaf clip (scale 1.2→1, 1.4s `power4.out`) on enter.
    Both are time-based, not scrubbed.
  - Rare fireflies (9) breathe and drift. They pause when the section is off screen.
  - `sound.play('pop', {volume:.25})` plays when a node lights while scrolling forward.
- **Phone, ≤768px (`roots--mobile`)**: no pin. There is one vertical root line in the inline-start column through
  the whole section. It runs from the photo bottom in a soft S-curve and is drawn to 66% of the viewport height as you scroll.
  Nodes sit on the line and light up in turn as the tip reaches them, and go back to dim when you scroll back up.
  The eyebrow sits right under the surface, next to the photo.
- **Reduced motion (`roots--static` / `roots--mobile-static`)**: no pin. Roots are fully drawn (the final, lit state),
  all nodes are lit and everything is visible. Blocks use simple 0.6s opacity fades only. No fireflies, no dog.
- **`#directions`**: in pinned mode the net never sits at its document position. The id is therefore also set on a 1px
  marker (`.roots__anchor`) that comes earlier in the DOM and is placed at the scroll offset where all five nodes are lit.
  `getElementById` finds the marker, so header and menu links and deep links land correctly (verified, including the
  `/#directions` deep link). The net keeps its own id, so the header's "you are here" observer still works (also verified).
  Focus sent to the marker moves to the "מה מחכה לכם ביער?" heading. Duplicate ids exist only at runtime in pinned mode,
  and nothing references them through ARIA.
- **Story button "הסיפור שלנו": left out on purpose.** This section *is* the story, and the header and menu item
  "הסיפור שלנו" already links to `#story`. A dialog would only repeat the same paragraph, and the brief has no more story copy.
- Copy: the HTML holds the verbatim text. At init, `[data-he]` elements are re-synced from `src/content/he.ts`.

## Dog (`src/components/dog.ts`)
`mountDog(host, opts)` returns `DogHandle { destroy, runAcross, show, hide, sit }`. The original two members are unchanged.
`DogOptions = { mode: 'follow'|'runAcross', home?, hidden?, autoplay?, ground? }`.
- The dog is a Canaan-type line dog (72×58, 1.5 stroke, currentColor). It has two drawings of the same 11 parts.
  Stand ↔ sit is a MorphSVG morph. The run cycle uses procedural leg, head and tail rotations plus a body bob,
  scaled by speed. The tail wags: harder after a click or while sitting.
- **follow** (used here): the dog draws itself sitting next to the dogs node and looking at it. On the first pointer move
  over the section it trots down to the bottom of the section, then runs after the cursor's x with eased velocity and
  turns to face where it runs. A click anywhere in the host (except links and buttons) makes it sit and wag for 2.6s.
  Its frame loop runs only while it is visible and the host is in view.
- **runAcross** (for the footer agent): `mountDog(footerEl, { mode: 'runAcross' })` runs once automatically when about
  35% of the host is visible. `autoplay:false` plus `await handle.runAcross()` lets the footer trigger it instead.
  In RTL the dog runs right → left along the bottom, sits and wags about halfway, then runs off. It adds an
  `overflow:hidden` layer inside the host and sets the host to `position:relative` if it was static.
  It takes its colour from the host (currentColor).
- On touch devices, phones or reduced motion, `mountDog` returns a no-op handle. It also destroys itself on `motion:change` → off.

## Verified
- `tsc --noEmit`: no errors in my files.
- Screenshots (Playwright, own section-relative script) at desktop 1440×900 across the whole pinned range
  (−0.5…2.6 vh), 1024×768, mobile 390×844 through the section, and reduced motion on desktop and mobile.
  Checked with the real chrome as well as with a stubbed chrome; the stub was needed while `src/chrome` failed to compile mid-edit.
- Dog: follow, the trot down from the node, following the cursor and sit-on-click all checked in screenshots.
  `runAcross` was checked on a mock footer host; its promise resolves.
- `#directions` from a header click and as a deep link. No console errors. No horizontal overflow.

## Known gaps / notes
- `rootsHands` is still `pending` in images.json, so the frame shows a bark colour with a line-art sapling placeholder.
  The placeholder hides itself automatically once the real photo exists. The root starts at the bottom centre of the photo.
- Headless Chrome drew a 0-length DrawSVG dash on the 1.33px node rings as a full ring. The fix: rings are paths, and their
  `<svg>` is hidden until the node lights. I could not test the scrub feel (smoothness, 60fps) on a real mid-range Android.
  The phone mode uses no pin and only updates one dashoffset per scroll event.
- The hero section was empty while I worked, so the hero's wavy earth line into my cream band is untested.
  My section paints its own cream band and soil, so it should not depend on the page-bg timing.
- Pinned on touch tablets wider than 768px (native scroll) is untested on hardware.

## Requests to other owners
- **footer agent**: call `mountDog(document.querySelector('.site-footer')!, { mode: 'runAcross' })` from `initFooter()`.
  It is a no-op on phones and with reduced motion.
- **lead / images**: please supply `rootsHands` (hands holding a sapling with soil, portrait 4:5). The roots grow from the bottom centre of the frame.
- **chrome agent (optional)**: `markCurrent()` resolves ids once at init. Roots keeps `id="directions"` on the net for it,
  but re-resolving ids would be more robust.
