# assets — demo photography

## What was built
* **All 21 keys of `src/content/images.json` are filled** (no `pending` left): `w/h`, `color` (dominant colour),
  `lqip` (24px blurred WebP data URI, ~200–320 B), Hebrew `alt`, `credit {title, author, license, licenseUrl, source}`,
  `sources {avif, webp, jpg}`. Every key's `purpose` is kept.
* **216 files in `public/img/`** (`<key>-<w>.{avif,webp,jpg}`, widths 480/800/1200 and also 1600/2400 for the 2400-wide keys),
  plus `0427-planted.jpg`, `0427-leaves.jpg`, `0427-summer.jpg` (1200×1200, used by `src/data/tree.json`). Total **≈ 22.9 MB**.
* **`scripts/build-images.mjs`** — the whole pipeline in one file, with the art direction per key:
  crop to the key's ratio around a hand-picked focus point (or sharp `attention`), optional clone-stamp retouch,
  light denoise before downscale, warm grade, then AVIF q50 / WebP q72 / progressive mozjpeg q74 (the 1600/2400 steps
  are 4 points lighter), LQIP and dominant colour, and it rewrites the key in `images.json`.
  Run: `node scripts/build-images.mjs --src <sources dir> [--only hero,wsDogs] [--download]`.
  The sources are not in the repo. The ones I used are in my scratch folder
  (`…/scratchpad/agents/assets/src/`). `--download` fetches the same Commons thumbnails again (Node 22: run it with
  `NODE_USE_ENV_PROXY=1` behind a proxy; Commons rate-limits hard, see gaps).
* **Grade** (`gradeBuffer`): a soft matte S-curve (blacks at ~6, whites at ~251, mids +10 %), global saturation ~0.88,
  greens muted further and turned slightly toward olive (hue-selective, 65°–170°), sky blues muted, and a warm split-tone
  (cream highlights, soil-brown shadows). The amount is set per photo so sunsets and pomegranates do not go orange.
  The hero has its mids lifted a little (gamma 0.88). `bizGallery1` gets a grey-world white balance to remove a lime-yellow cast.
* **Retouch**: in the hero I cloned out a blue-white tarp between the trunks and some clothes hanging on a branch at the right edge.

## Key → photo (all from Wikimedia Commons; licence allows commercial use and modification)
| key | photo | author | licence | why |
|---|---|---|---|---|
| hero | Sunset at olive grove (Moneglia, IT) | Jan Remund | CC BY 2.0 | Golden hour backlight through old olive trees. The canopy fills the upper half (good for the wind mask), with a calm grass path and long shadows. Mediterranean. **No people or bench** (see gaps). |
| heroPortrait | same photo, 2:3 crop on the sun and the big trunk | Jan Remund | CC BY 2.0 | Same mood on mobile; the sun sits upper-left, the trunk runs diagonally. |
| rootsHands | Life (~crystalina~) | ~crystalina~ | CC BY 2.0 | Cupped hands, sandy soil, a sprout. Warm, earthy, looks like Israeli soil. |
| expTeams | Volunteers enjoy planting trees | Steve Hillebrand, USFWS | Public domain | Two people planting together in dry ground, real and unposed. |
| expGift | Cútar, olive harvest | Dguendel | CC BY 4.0 | An olive harvest with nets under the trees, as an "experience day" activity. Andalusia. |
| expEvents | Outdoor wine dinner (Unsplash import) | Serge Esteve | CC0 | Wooden table outdoors with warm string lights behind: evening at the forest. |
| wsCarpentry | Craftsman shaping wood at a workshop… | Shixart1985 | CC BY 2.0 | Hands, a wood block, the workbench. |
| wsDogs | Cabrero, Chile (Unsplash import) | erik cid | CC0 | Happy dog backlit by a golden sunset. |
| wsGarden | Indigenous Garden Volunteering | Jvlara | CC BY-SA 4.0 | People working a wild, tree-shaded garden: closest to a "food forest for beginners". |
| companies | DUSAFO planting trees | Christian Anold Mosha | CC BY-SA 4.0 | A team planting seedlings together, with real smiles. |
| bizHero | AufBuchen planting, Schlachtensee Berlin, 1 Dec 2024 | RobbieIanMorrison | CC BY-SA 4.0 | Colleagues planting among tall trees, low sun haze. |
| bizGallery1 | Woodworking hand tools on timber planks 01 | A S M Jobaer | CC BY-SA 4.0 | Hand plane, saw, square and tape on raw timber (a carpentry still life). |
| bizGallery2 | The Corps' Pine Flat Lake, volunteers plant 28 trees | Todd Hatch, USACE | Public domain | Planting day on a dry-grass slope (Israel-like summer palette). |
| bizGallery3 | Visitor walking dog | Joshua Tree NP (NPS) | Public domain | Woman and dog on a dirt road at sunset, desert scrub (Negev-like). |
| bizGallery4 | Loving Hands cup a sequoia | USDA Forest Service, Region 5 | Public domain | Weathered hands cupping a sapling. |
| bizGallery5 | Tbilisi, Georgia (Unsplash import) | Adrian Scoffham | CC0 | A crate of ripe pomegranates, some split open (harvest). |
| bizGallery6 | Meet you by the olive tree, rustic bench in the sun | Winniepix | CC BY 2.0 | A wooden bench under an old olive tree by a sunlit stone wall. Exactly "a bench under a tree". |
| treePlanted | Seedling planting | USDA Forest Service, Region 5 | Public domain | Hands pressing soil around a just-planted sapling. |
| treeLeaves | Young leaves of Ficus carica L., Taurinya (F) | Meria Geoian | CC BY-SA 4.0 | A real fig shoot opening its first leaves. |
| treeSummer | 'Ficus carica' Brown Turkey, fig at Shipley | Acabashi | CC BY-SA 4.0 | A lush fig in summer against the sky, with small figs visible. |
| forestPlace | Olive grove | Nick Savchenko | CC BY-SA 2.0 | Rows of young olive trees in red soil: "a young orchard in rows". |

## Known gaps (honest)
* **Source**: Openverse was nearly unusable today. It returned 504s and empty results with licence filters, and its Flickr
  results top out at 1024 px, too small for 1200–2400 keys. I searched Wikimedia Commons directly instead (same
  licences, full-resolution files, Commons pages as `credit.source`). Commons then rate-limited downloads (HTTP 429 on
  originals), so the pipeline uses Commons' **standard thumbnails** (3840 px, or 1920 px for smaller files).
* **hero has no people or bench.** I could not find a golden-hour orchard with people and a bench under a usable licence
  at this resolution. The bench mood is in `bizGallery6`. If the client's own hero photo becomes available, add it to
  `PHOTOS.hero` and re-run.
* `rootsHands` tops out at **1152×1440** (same 4:5 ratio): only the 1920 px thumbnail was reachable.
* Not every photo is Israeli. Most are Mediterranean or dry-climate (Liguria, Andalusia, California, Georgia) and graded to one
  look. `companies` and `bizHero` were shot in Tanzania and Berlin respectively. For the live site the brief asks for
  real photos of the place.
* The dominant colour of `forestPlace` (sky, `#AED3D7`) and `wsCarpentry` (near-white) is light. This only matters
  before the LQIP paints, which is inline and immediate.
* WebP files come out slightly larger than the JPEGs on foliage-heavy shots. Modern browsers take the AVIF anyway.
* `--download` is implemented but untested end to end; Commons was returning 429 at the time.

## Requests to other owners
* **credits page owner**: list every `images.json` entry's `credit` (title, author, licence link, source link) and add one
  line saying the photos were "cropped, resized and colour-graded". CC BY and CC BY-SA require noting the changes.
  The CC BY-SA adaptations are shared under the same licence.
* **hero (WebGL) owner**: the foliage is the upper ~55 % of `hero` (y < 0.55). The people-free foreground is grass and
  path, and the sun flare is at the upper-left (x ≈ 0.02, y ≈ 0.2). For mobile, use `heroPortrait`; preload its 800w AVIF.
