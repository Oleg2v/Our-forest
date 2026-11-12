# treeScene — the /tree/0427 living-tree scene ("living botanical engraving")

Owner files: `src/tree/scene/**` (all scene code), and one append-only line in `src/tree/scene-api.ts`
(`siblingSpot?: boolean`, optional). The contract is unchanged otherwise: `createTreeScene(initial)` → `TreeScene`.

## Architecture
One driver, two renderers that draw the **same model through the same projection**. Because of that, a renderer swap
in the middle of a sequence (SVG → WebGL crossfade, or WebGL → SVG when motion is switched off) cannot be seen.
- `index.ts` is the driver and implements the contract. It owns:
  - state, the generated model, and every animation value (the `Anim` object, tweened by GSAP)
  - the sequences: birth, visit intro, watering, shake, focus, rotate
  - gestures, hotspots and picking, falling leaves, snapshot
  - the shared camera, plus the layers that do not depend on the renderer: paper/light background, warm memorial glow, overlay, fx canvas, haze, fog
- `model.ts` generates everything from `seed` and `species`:
  - Space colonization inside a species crown envelope. Envelopes differ per species: multi-stem pomegranate, a twisted twin-stem olive, a low spreading fig, a round carob, an upright almond, a wide mulberry.
  - Each node gets a birth time from its importance (subtree size) and its path distance. A young tree is therefore the adult's main structure at a smaller scale, not a bare pole.
  - Leaves follow the *current* visible tips by path distance, which stays continuous while the timeline scrubs.
  - Fruits and blossoms attach to the nearest visible branch.
  - Roots grow outward from the seed in the cut face.
  - The island is a floating earth body cut by the plane `z = ZC`: cap, three strata, pebbles, grass tufts and fallen leaves.
  - `grow()` is cheap and runs each frame while growth changes.
- `camera.ts` contains the projection math: off-axis perspective (phone: island in the top 60 %; desktop: centred), island yaw/tilt about a pivot, the float, and matrices for three.js. The hotspots, the SVG and the overlay all use it.
- `look.ts` maps Israel time, weather and mode to paper colour, light glow, sun/moon direction, ink colour and shadow length.
  - Dawn is pink with birds, day is warm, and sunset gives long shadows.
  - Night is moss paper, where the engraving turns into a moonlit scratchboard (light lines), with a moon and fireflies.
  - Rain is overcast with darker soil. Hamsin is a warm haze with dust. Memorial is muted.
- `svg/renderer.ts` is the vector engraving. It is the LCP view and the complete fallback.
  - It has three stacked SVG layers: the island (static), the tree, and falling leaves.
  - The float, wind sway, shake and breathing are **compositor-only CSS transforms** of whole layers. Attributes are written only when they change.
  - With this, the animated SVG fallback went from about 1.9 s to **16.7 ms median per frame** (phone, headless software raster).
  - Ids and CSS are scoped per instance, so two scenes on one page do not collide.
- `gl/*` is three.js and lazy-loaded (a separate 49 KB chunk plus three).
  - Custom shaders give screen-space hatching driven by light. The hatching is anchored to the island and anti-aliased, with 1–3 line layers, and it turns into light lines at night.
  - Inverted-hull `--bark` contours have a constant pixel width.
  - The cut face is procedural: stippled humus, clay with wavy lines, and stones as outlined pebbles. Wetness, seep and the seed chamber are drawn in the same face shader.
  - Leaves are instanced, alpha-tested drawings from the same SVG paths, in an atlas. Narrow leaves are stretched to fill their cell so mipmaps keep them.
  - Roots glow from tip to trunk. The plaque is an extruded leaf-shaped plank textured with the plant agent's live engraver canvas.
  - The brass token carries a real QR code (`qrcode-generator`) to `/tree/<id>`.

## Contract behaviour (what the UI can rely on)
- `kind` is `'webgl'` when WebGL will be used (motion allowed, quality > 0, WebGL available) and `'svg'` otherwise. It switches live:
  - `motion:change` → off: WebGL is disposed and the SVG takes over.
  - motion → on again: WebGL reloads.
  - WebGL context lost: falls back to SVG.
- `mount()` resolves after the SVG's first frame (fast LCP). WebGL then crossfades in over 0.8 s when it is ready.
  - Shaders compile with `compileAsync` when `KHR_parallel_shader_compile` exists.
- `playBirth()` uses the 7.4 timings exactly. It runs 1.5× slower in memorial mode.
  - Phases: `soil` 0, `crack` 1.2 (three cracks + `sound 'crack'`), `sprout` 2.4 (the radicle goes down, the stem goes up, two seedling leaves spring open), `reveal` 4.0, `done` 6.0. The promise resolves at 6.0.
  - During `reveal`, the camera pulls back from the soil close-up. The tree grows to its real age (a time-lapse), the plaque rises out of the ground, and the engraving burns its last letters (engraver `burnAll` from 0.7).
  - Each phase is reported once. `skipBirth()` and `signal.abort()` jump to the end.
  - Reduced motion: quiet fades, and the same phases are still reported.
- `playVisitIntro()`: light fog for 0.9 s, then the tree breathes 1 → 1.02 → 1.
- `waterStart` / `waterProgress(p)`: a dark spot spreads on the cap and in the cut.
- `waterEnd(true)`:
  - seep through the strata (1.2 s), then roots light up from tip to trunk (0.8 s)
  - leaves lift about 4°, and droplets glint for about 4 s
  - about 1 in 3 waterings, a line-art bird lands on a branch for 2 s (never in memorial)
  - `sound 'absorb'`
  - The promise resolves at about 2.2 s. `waterEnd(false)` just fades the spot.
- `shake()`: 3–6 leaves fall (7–11 in autumn on deciduous trees, petals when in bloom), with `rustle`. It is debounced to 350 ms, so a UI call plus the scene's own tap reaction does not double it.
- `focus('plaque'|'crown'|'reset')`: 0.9 s, power3.inOut. It is idempotent.
- `rotateBy(deg)`: clamped to ±25°, springs back after 3 s idle. Dragging has a rubber band, inertia and a spring home.
- Hotspots and picking:
  - Taps on the scene emit `'hotspot'`, and the scene reacts itself: trunk → shake, plaque/QR → focus plaque, fruit → swing, greeting leaf → pulse, crown → rustle.
  - Long press on the soil or the cut → `'ground'`, with a soft root glow.
  - Pinch zooms toward the crown up to 2×. Double tap resets. Tapping empty space while focused also resets.
- `getHotspots()` returns them in Tab order: plaque, qr, fruits (≤ 8, front-most), greeting leaves, leaf, trunk, ground. Labels are in Hebrew.
  - Positions exclude the ±3 px float on purpose, so proxies do not jitter.
  - `'hotspots-change'` is throttled to about 8 Hz, and fires immediately when membership changes.
- `snapshot(w, h)`: the current state re-framed for the share format (island centred), on the scene's paper with grain, plus greeting halos and initials and the ghost. Tested at 1080×1920 and 1080×1080 in both renderers.
- `setPaused()`, `visibilitychange` and off-screen (IntersectionObserver) all stop the RAF loop. In reduced motion the loop runs only while something changes.
- a11y: the scene root has `role="img"` and an `aria-label` built from state, e.g. «עץ תאנה, בן 9 חודשים, מתכונן לחורף, הושקה היום». "הושקה היום" appears when `soilMoisture ≥ 0.5`.

### Extras the UI can use (non-breaking)
- On the container, the scene sets `--tree-scene-bg` (its paper colour) and `data-scene-tone="light|dark"`. At night the scene paints moss, so use `dark` to switch the UI text to cream.
- Optional CSS vars on the container change the composition: `--tree-scene-cx` (0..1), `--tree-scene-cy` (0..1) and `--tree-scene-fill` (fraction of the height for the island and tree).
  - Defaults: phone cy .335 / fill .5; desktop cy .515 / fill .76.
- `state.siblingSpot = true` draws the dashed `--fruit` spot (with a tiny sprout) on the island for the «עץ אח» card.

## Quality by tier
- **Leaves**: 4800 desktop / 2000 phone at tier 3; 3600 / 1800 at tier 2; 1500 / 1000 at tier 1. Each is scaled by species (fig ×0.28 because its leaves are big; olive and pomegranate ×1.1). That stays within the brief's 3–5k / 1–2k.
- **Hatching**: tier ≥ 2. Tier 1 uses posterised tones instead.
- **Tier 3 only**: hatched crown shadow on the cap, MSAA on desktop, more radial segments.
- **DPR**: ≤ 2 (phone tier 2: 1.6, tier 1: 1.25). Adaptive DPR drops by 0.25 when 90 frames average more than 24 ms.
- **Live tier changes** (the UI upgrades after `gpuTier()`): hatching and DPR follow, and the leaf budget regenerates (same seed, same skeleton).

## Verified
Screenshots I actually looked at are in `scratchpad/agents/treeScene/shots/`. The harness is `harness.mjs` with scenario files. It imports the scene into /tree/0427 with Playwright, stubs `/@vite/client` so other agents' edits cannot reload the page, and seeks GSAP's global timeline for exact birth and watering phases.
- **Both renderers, mobile 390×844 + desktop 1440×900:**
  - November day, night, rain, hamsin, dawn, sunset, memorial
  - ageDays 0 / 271 / 1200 / 1825, the future ghost, planted=false (seed)
  - all six species: adult, young and in season (almond blooming in winter, pomegranate flowering in spring, olives ripe in autumn)
  - harvest fruits, news dot, sibling spot
- **Sequences**: birth phases at 0.7 / 2.2 / 3.7 / 4.9 / 6.3 s, and watering at 0.05 / 0.7 / 1.35 / 2.4 s.
- **Interactions** (real mouse events): taps on the trunk, fruit, plaque and ground (long press) all emit the right hotspots. Drag rotation, focus plaque and crown, visit-intro fog, snapshots, and the a11y "stop animations" switch (WebGL → SVG at runtime).
- **Reduced motion** (SVG, final states, birth and watering still resolve with phases).
- **Integration**: the tree-ui page via `scripts/shot.mjs`, mobile + desktop + `--reduced`. No console errors and no horizontal overflow anywhere.
- **Typecheck**: `npx tsc --noEmit` shows zero errors in `src/tree/`.
- **Build**: a scratch build confirms `gl/renderer` and three.js are separate lazy chunks.
- **Frame cost (headless SwiftShader, indicative only)**:
  - WebGL: JS per frame median 0.7 ms / p90 4.6 ms (phone emulation). Raster is software, so fps there means little.
  - SVG fallback, animated: 16.7 ms median (phone) / 50 ms (desktop).

## Known gaps / honest notes
- **Not measured on real devices.** "60 fps on a mid Android" is designed for (instancing, one draw per material, adaptive DPR, paused loop) but not proven.
  - Shader compilation on SwiftShader takes 5–20 s. Real GPUs should be well under a second. The SVG covers that time.
- **Shadows** are a hatched crown-shadow decal on the cap (tier 3), not shadow maps. There is no self-shadowing, and the crown's lit and shaded sides come from a crown-volume light term.
- **SVG fallback motion**: the whole tree sways as one layer (no per-limb sway), with no leaf lift. The plaque burn there updates about 9×/s (data URLs).
- **Overlay effects are not occluded by leaves**: fireflies, glints, rain, birds and greeting halos are drawn above the scene.
- **Greeting leaves** are chosen among the currently visible front leaves. When the timeline scrubs, they may hop to other leaves.
- **The future ghost** is a smoothed radial hull of the projected adult leaves plus two trunk lines. When `ageDays` is already adult, it coincides with the tree.
- **Device tilt** is listened to, but iOS permission is never requested (as the brief asks, it is off by default). Pinch was implemented but tested only by code path, not with real multi-touch.
- **Changing species, seed or quality** regenerates the model (about 30–120 ms) and snaps the camera framing.
- **Scene code size**: the SVG path is in the page bundle (the model generator and SVG renderer). Only WebGL/three is lazy.

## Requests to other owners
- **tree-ui**:
  - Use `data-scene-tone` / `--tree-scene-bg` for text colour over the scene at night.
  - Set `siblingSpot: true` while the «עץ אח» upsell is shown.
  - The scene already reacts to its own taps: shake, focus plaque, fruit swing. Calling the same methods from proxies is safe (idempotent or debounced).
  - If the side panel should never overlap the island on desktop, set `--tree-scene-cx` (for example `.42`) on the container rather than resizing it.
- **lead**: `scene-api.ts` got one optional field (`siblingSpot`).
