# desktop-components (plaque, forest map)

## Integration round

The integration run was cut off by a container restart before it could check its edits. This round checked them.
All checks are A/B against 6401b06: worktree A at 6401b06, worktree B at 6401b06 plus only these files, so the
results show only these changes. No code changed in this round: the interrupted run's edits passed every check.

**1. Plaque (`plaque/index.ts`, `plaque/wood.ts`)**
* `woodFor()` takes the plank height from the quantised width ÷ `PLAQUE_ASPECT` when the canvas is within 3 % of
  that aspect. Any other shape is rounded to 0.05. So a 1 px aspect jitter no longer makes a new texture.
* Size changes wait until the size has been still for 140 ms (ResizeObserver), then the plaque is redrawn once.
  While a size change settles, the canvas keeps its bitmap. A canvas that folds below 16 px, is hidden or is
  detached also keeps its size and bitmap; it is no longer resized to the 480 px fallback. `resize()` still
  applies at once, because `/plant` uses it when it moves the canvas to another slot.
* The wood is cheaper to generate:
  * The 256×256 noise lattice is folded into one lookup.
  * The ring sine and the knot exponent are read from tables.
  * The two slow fields (warp, tone) are sampled on a grid of `h/100` px and interpolated.
  * The fine fields are blended once per row.
  * The cache drops the least recently used planks first, with limits of 12 planks and 6 Mpx.
* Look: in node, old and new `createWoodTexture` were compared pixel by pixel at widths 320–1600, warm and
  memorial. Max Δ ≤ 2/255, mean Δ ≈ 0.02. In the browser:
  * the desktop `/plant?step=plaque` render is identical at 1366;
  * at 1920 the plank is 1 px shorter (320×133 instead of 320×134), which you cannot see;
  * the phone plaque step looks the same.
* Speed: the median warm generation time in node:

  | plank size | before | after |
  |---|---|---|
  | 1440×600 (the phone plaque step) | 320 ms | 55–65 ms |
  | 800×334 | 80–115 ms | 20–30 ms |
  | 320×134 (small planks) | 13–19 ms | 17–25 ms (a little slower: the per-seed lattice is built first) |

* `/plant` phone fold (iPhone 13, DPR 3, 4× CPU, 2 runs each):

  | case | plaque redraws | new wood textures | dropped frames |
  |---|---|---|---|
  | stage full ×2, before | 25–32 | 12–14 | 63–86 |
  | stage full ×2, after | 0 | 0 | 23–34 |
  | map close, before | 8–11 | 0–2 | 31–41 |
  | map close, after | 0 | 0 | 14–36 |

  Opening the map: 2–3 plaque redraws before, 0 after. The frame drops while the map opens come from building the
  map, so A and B drop about the same. Screenshots after the fold are identical.
* Step occasion → plaque on the phone: A and B both draw the plaque once, and neither makes wood during the step,
  because `/plant` makes the plank ahead of time (`warmPlaqueStep`). Frame drops are noisy and the same in A and B.
  The plaque is not what makes this step slow; its texture made ahead is now about 5× cheaper.
* Dragging the desktop window from 1366 to 1920: before, the plaque was redrawn 11 times during the drag. Now it is
  not redrawn during the drag, and is redrawn once afterwards, at the right backing size (302×126).
* The /tree scene uses a fixed 1024×427 canvas: its plank is the same as before, and the canvas always draws.

**2. Forest map in the `/plant` picker, desktop (≥769 × ≥561 only)**
* The legend chip and the 'כיתת חוץ' label overlapped by 780, 530, 477 and 371 px² at 1366, 1536, 1768 and 1920.
  They now overlap by 0 px² at all four widths. `pickerFit` lifts the plan, then shrinks it by 1–5 %. The legend
  is 4 px slimmer and 6 px nearer the corner.
* The hint 'לוחצים על המפה כדי לטייל בה' still sits at the top centre. While the hint shows, the title fades out
  in its place; they cross-fade. The hint shows on hover, on a flash, or as the standing hint on a touch screen.
  With the mouse away from the map, the title shows (opacity 1) and the hint is hidden (opacity 0). On hover, the
  hint shows and the title is at opacity 0. Before, both showed on top of each other.
* Home map: the reduced-motion screenshot at 1920, 1366 and phone is pixel-identical to 6401b06.
* Phone picker: portrait and landscape (iPhone 13) are pixel-identical to 6401b06.

**3. `src/chrome/images.ts`** — the plaque/map run did not change it. The change came from the chrome integration
run (`int-chrome/sharpen.mjs` tests it). Its purpose: on a phone, a lazy photo that finishes loading out of sight is
shown sharp at once, instead of running the 1 s blur→sharp transition there. That transition lifted every
positioned box below the photo into one page-tall layer (390×2808 on /business). The plaque and the map load no
images through it. The chrome owner's files include it this round, so it is left to them; this round did not edit
it.

**Full purchase** (`buy.mjs`, main tree): desktop at 1920×940, desktop + map at 1920×940 (spot 0101), and phone all
reached the done view in 9.5–13 s with no console errors. The phone + map run fails in the same way on 6401b06,
so this round did not cause it. On a phone the map shows groves as clusters, and the script's synthetic click hits
a spot that is hidden inside a cluster.

**Known gaps:** On a desktop-wide touch screen (an iPad in landscape), the picker shows its standing hint the whole
time, so the title stays hidden until the map is activated. Before, the hint covered the title.
