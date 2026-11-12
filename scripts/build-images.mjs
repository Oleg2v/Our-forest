#!/usr/bin/env node
/* ------------------------------------------------------------------------------------------------
 * Demo photography pipeline for "היער שלנו".
 *
 *   node scripts/build-images.mjs --src <dir-with-sources> [--only hero,wsDogs] [--download]
 *
 * For every key in PHOTOS (one per key of src/content/images.json):
 *   1. crop the source to the key's w:h ratio around a hand-picked focus point (or sharp "attention"),
 *   2. warm grade: gentle matte S-curve, global saturation ~0.88, greens muted harder (hue-selective),
 *      warm split-tone (warm highlights, soil-brown shadows) dosed per photo so nothing turns orange,
 *   3. write public/img/<key>-<w>.{avif,webp,jpg} for widths [480,800,1200,1600,2400] capped at the
 *      key's w and the crop's native size (AVIF q50, WebP q72, progressive mozjpeg q74),
 *   4. fill the key in src/content/images.json: w/h, color (dominant), lqip (24px blurred WebP data URI),
 *      alt (Hebrew), credit, sources — keeping its "purpose".
 * Also writes public/img/0427-{planted,leaves,summer}.jpg (1200px) for src/data/tree.json.
 *
 * Sources are Wikimedia Commons files (CC0 / Public domain / CC BY / CC BY-SA only). The pipeline was run on
 * Commons' standard thumbnails (3840px, or 1920px for smaller originals) — `--download` fetches them into
 * --src (Node 22+: behind an HTTPS proxy run with NODE_USE_ENV_PROXY=1).
 * ------------------------------------------------------------------------------------------------ */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/img');
const MANIFEST = join(root, 'src/content/images.json');
const WIDTHS = [480, 800, 1200, 1600, 2400];
const Q = { avif: 50, webp: 72, jpg: 74 };

/* ---------- licences ---------- */
const L = {
  cc0: { license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  pd: { license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/' },
  by2: { license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  by4: { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  bysa2: { license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/' },
  bysa4: { license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
};
const commons = (file) => `https://commons.wikimedia.org/wiki/File:${file}`;

/* ---------- per-key art direction ----------
 * size: the key's target w×h (contract from images.json) · file: source file in --src · commons: Commons file name · thumb: Commons thumbnail width used
 * focus: [x, y] crop centre (0..1 of the source) or 'attention' · zoom: crop size vs. max crop (≤ 1)
 * grade: overrides { wb, warm, sat, green, blue, contrast, gamma } — wb = grey-world balance strength (0..1),
 *        warm = split-tone dose (0 none … 1 full),
 *        green / blue = extra saturation factor for greens / sky blues, gamma < 1 lifts the mids.
 * clone: retouch ops (see applyClones) · soften: pre-downscale denoise sigma (default 0.6 when the crop is ≥ 1.25× the output, else none). */
const PHOTOS = {
  hero: {
    size: [2400, 1500], file: 'wm-hero1-3.jpg', commons: 'Sunset_at_olive_grove_(Moneglia,_IT)_(15274111609).jpg', thumb: 3840,
    focus: [0.5, 0.44], grade: { warm: 0.55, sat: 0.9, gamma: 0.88 },
    clone: [
      { rect: [0.758, 0.43, 0.078, 0.128], from: [-0.09, 0] },    // blue-white tarp between the trunks
      { rect: [0.949, 0.316, 0.02, 0.052], from: [0.026, -0.006], feather: 0.005 }, // clothes on a branch
    ],
    alt: 'חורשת זיתים בשעת השקיעה: אור זהוב מסתנן בין הענפים ונופל על שביל עשב בין הגזעים',
    credit: { title: 'Sunset at olive grove (Moneglia, IT)', author: 'Jan Remund', ...L.by2 },
  },
  heroPortrait: {
    size: [1200, 1800], file: 'wm-hero1-3.jpg', commons: 'Sunset_at_olive_grove_(Moneglia,_IT)_(15274111609).jpg', thumb: 3840,
    focus: [0.27, 0.5], grade: { warm: 0.55, sat: 0.9, gamma: 0.88 },
    alt: 'חורשת זיתים בשקיעה: השמש מבצבצת מבעד לענפים מעל גזע עבה ושביל עשב',
    credit: { title: 'Sunset at olive grove (Moneglia, IT)', author: 'Jan Remund', ...L.by2 },
  },
  rootsHands: {
    size: [1200, 1500], file: 'wm-hands-19.jpg', commons: 'Life_-_Flickr_-_~crystalina~.jpg', thumb: 1920,
    focus: [0.4, 0.5], grade: { warm: 0.2, sat: 0.9 },
    alt: 'שתי ידיים מחזיקות חופן אדמה חולית, ומתוכה מציץ נבט צעיר',
    credit: { title: 'Life', author: '~crystalina~', ...L.by2 },
  },
  expTeams: {
    size: [1200, 1500], file: 'wm-teams-2.jpg', commons: 'Volunteers_enjoy_planting_trees.jpg', thumb: 1920,
    focus: [0.5, 0.465], grade: { warm: 0.7 },
    alt: 'מתנדב חופר באת ומתנדבת כורעת לידו ושותלת עץ צעיר באדמה יבשה',
    credit: { title: 'Volunteers enjoy planting trees', author: 'Steve Hillebrand, U.S. Fish and Wildlife Service', ...L.pd },
  },
  expGift: {
    size: [1200, 1500], file: 'wm-oliveharv-4.jpg', commons: 'Cútar,_olive_harvest.jpg', thumb: 3840,
    focus: [0.53, 0.5], grade: { warm: 0.8 },
    alt: 'מסיק זיתים במדרון: שני אנשים פורשים רשת מתחת לעצי הזית',
    credit: { title: 'Cútar, olive harvest', author: 'Dguendel', ...L.by4 },
  },
  expEvents: {
    size: [1200, 1500], file: 'wm-u-table-4.jpg', commons: 'Outdoor_wine_dinner_(Unsplash).jpg', thumb: 1920,
    focus: [0.47, 0.5], grade: { warm: 0.5 },
    alt: 'כוס יין אדום על שולחן עץ בחוץ, ומאחוריה שורת נורות קטנות דולקות בערב',
    credit: { title: 'Outdoor wine dinner', author: 'Serge Esteve', ...L.cc0 },
  },
  wsCarpentry: {
    size: [1200, 900], file: 'wm-carpentry-3.jpg', commons: 'Craftsman_shaping_wood_at_a_workshop_with_precision_and_skill_during_the_daytime.jpg', thumb: 3840,
    focus: [0.5, 0.6], grade: { warm: 0.4, sat: 0.8 },
    alt: 'ידיו של נגר מחליקות בלוק עץ לאורך שולחן העבודה בנגרייה',
    credit: { title: 'Craftsman shaping wood at a workshop with precision and skill during the daytime', author: 'Shixart1985', ...L.by2 },
  },
  wsDogs: {
    size: [1200, 900], file: 'wm-u-dog-23.jpg', commons: 'Cabrero,_Chile_(Unsplash_Zlb0EsmgcMM).jpg', thumb: 3840,
    focus: [0.45, 0.5], grade: { warm: 0.1, sat: 0.86 },
    alt: 'כלב פרוותי ושמח עומד בדשא מול אור שקיעה זהוב, הלשון בחוץ',
    credit: { title: 'Cabrero, Chile', author: 'erik cid', ...L.cc0 },
  },
  wsGarden: {
    size: [1200, 900], file: 'wm-commgarden-15.jpg', commons: 'Indigenous_Garden_Volunteering.jpg', thumb: 3840,
    focus: [0.5, 0.5], grade: { warm: 0.85, green: 0.74 },
    alt: 'מתנדבים עובדים בגינה פראית בין עצים: עוקרים, שותלים ומסדרים ערוגות לאורך שביל שבבים',
    credit: { title: 'Indigenous Garden Volunteering', author: 'Jvlara', ...L.bysa4 },
  },
  companies: {
    size: [2400, 1350], file: 'wm-teams-0.jpg', commons: 'DUSAFO_planting_trees.jpg', thumb: 3840,
    focus: [0.5, 0.52], grade: { warm: 0.8, green: 0.74 },
    alt: 'אנשים כורעים בשדה ירוק ושותלים יחד שתילים צעירים, מחייכים תוך כדי עבודה',
    credit: { title: 'DUSAFO planting trees', author: 'Christian Anold Mosha', ...L.bysa4 },
  },
  bizHero: {
    size: [2400, 1350], file: 'wm-teams-18.jpg', commons: 'AufBuchen_planting_Schlachtensee_Berlin_01_Dec_2024_two_volunteers_planting.jpg', thumb: 3840,
    focus: [0.5, 0.5], grade: { warm: 0.6 },
    alt: 'אנשים שותלים עצים צעירים ביער, ואור שמש נמוך חודר בין הגזעים הגבוהים',
    credit: { title: 'AufBuchen planting, Schlachtensee, Berlin, 1 Dec 2024: two volunteers planting', author: 'RobbieIanMorrison', ...L.bysa4 },
  },
  bizGallery1: {
    size: [1200, 1500], file: 'wm-carpentry-2.jpg', commons: 'Woodworking_hand_tools_on_timber_planks_01.jpg', thumb: 3840,
    focus: [0.42, 0.55], grade: { wb: 0.85, warm: 0.3, sat: 0.8, gamma: 0.95, blue: 0.55 },
    alt: 'כלי נגרות ישנים, זווית וסרט מדידה מונחים על קורות עץ בהירות',
    credit: { title: 'Woodworking hand tools on timber planks 01', author: 'A S M Jobaer', ...L.bysa4 },
  },
  bizGallery2: {
    size: [1200, 900], file: 'wm-teams-22.jpg', commons: "US_Army_51694_The_Corps'_Pine_Flat_Lake,_volunteers_plant_28_trees_to_celebrate_National_Public_Lands_Day.jpg", thumb: 1920,
    focus: [0.5, 0.5], grade: { warm: 0.6 },
    alt: 'יום נטיעה: מתנדבים חופרים סביב עץ צעיר שזה עתה נשתל על מדרון של עשב יבש',
    credit: { title: "The Corps' Pine Flat Lake, volunteers plant 28 trees to celebrate National Public Lands Day", author: 'Todd Hatch, U.S. Army Corps of Engineers', ...L.pd },
  },
  bizGallery3: {
    size: [1200, 900], file: 'wm-dogwalk-0.jpg', commons: 'Visitor_walking_dog_(51634653400).jpg', thumb: 3840,
    focus: [0.5, 0.5], grade: { warm: 0.25 },
    alt: 'אישה מטיילת עם כלב מתולתל בשביל עפר בשעת שקיעה',
    credit: { title: 'Visitor walking dog', author: 'Joshua Tree National Park (NPS)', ...L.pd },
  },
  bizGallery4: {
    size: [1200, 1500], file: 'wm-hands-15.jpg', commons: 'Loving_Hands_cup_a_sequoia_SQF_A1_-1416_(52321354557).jpg', thumb: 3840,
    focus: [0.47, 0.5], grade: { warm: 0.9, green: 0.72 },
    alt: 'ידיים חופנות בעדינות שתיל צעיר של עץ',
    credit: { title: 'Loving Hands cup a sequoia', author: 'USDA Forest Service, Region 5', ...L.pd },
  },
  bizGallery5: {
    size: [1200, 900], file: 'wm-u-pomeg-2.jpg', commons: 'Tbilisi,_Georgia_(Unsplash_IO7q_2E2Vk).jpg', thumb: 1920,
    focus: [0.5, 0.5], grade: { warm: 0.15, sat: 0.84 },
    alt: 'ארגז מלא רימונים בשלים, וכמה רימונים פתוחים שגרגיריהם האדומים נראים',
    credit: { title: 'Tbilisi, Georgia', author: 'Adrian Scoffham', ...L.cc0 },
  },
  bizGallery6: {
    size: [1200, 900], file: 'wm-hero2-0.jpg', commons: 'Meet_you_by_the_olive_tree_rustic_bench_in_the_sun_(27013750948).jpg', thumb: 1920,
    focus: [0.5, 0.7], grade: { warm: 0.15, sat: 0.8 },
    alt: 'ספסל עץ כפרי בצל עץ זית עתיק, מול קיר אבן מואר בשמש',
    credit: { title: 'Meet you by the olive tree: rustic bench in the sun', author: 'Winniepix', ...L.by2 },
  },
  treePlanted: {
    size: [1200, 1200], file: 'wm-hands-2.jpg', commons: 'Seedling_planting.jpg', thumb: 1920,
    focus: [0.52, 0.5], grade: { warm: 0.5 },
    alt: 'ידיים מהדקות את האדמה סביב שתיל צעיר שזה עתה נשתל',
    credit: { title: 'Seedling planting', author: 'USDA Forest Service, Region 5', ...L.pd },
    also: '0427-planted.jpg',
  },
  treeLeaves: {
    size: [1200, 1200], file: 'wm-figleaf-1.jpg', commons: 'Young_leaves_of_Ficus_carica_L.,_Taurinya_(F).jpg', thumb: 3840,
    focus: [0.46, 0.5], grade: { warm: 0.8, green: 0.8 },
    alt: 'העלים הראשונים של תאנה נפתחים בקצה ענף',
    credit: { title: 'Young leaves of Ficus carica L., Taurinya (F)', author: 'Meria Geoian', ...L.bysa4 },
    also: '0427-leaves.jpg',
  },
  treeSummer: {
    size: [1200, 1200], file: 'wm-figtree2-2.jpg', commons: "'Ficus_carica'_Brown_Turkey_-_fig_at_Shipley,_West_Sussex,_England.JPG", thumb: 3840,
    focus: [0.5, 0.5], grade: { warm: 0.9, green: 0.74, sat: 0.86, blue: 0.7 },
    alt: 'עץ תאנה ירוק ועבות בקיץ, ענפיו נמתחים אל שמיים כחולים',
    credit: { title: "'Ficus carica' Brown Turkey — fig at Shipley, West Sussex, England", author: 'Acabashi', ...L.bysa4 },
    also: '0427-summer.jpg',
  },
  forestPlace: {
    size: [2400, 1500], file: 'wm-hero1-0.jpg', commons: 'Olive_grove_(28920833015).jpg', thumb: 3840,
    focus: [0.5, 0.6], grade: { warm: 1, sat: 0.82, green: 0.72, blue: 0.62 },
    alt: 'שורות של עצי זית צעירים באדמה אדמדמה, וגבעות מיוערות באופק',
    credit: { title: 'Olive grove', author: 'Nick Savchenko', ...L.bysa2 },
  },
};

/* ---------- CLI ---------- */
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const SRC = resolve(arg('src') ?? process.env.OUR_FOREST_IMG_SRC ?? join(root, '.img-src'));
const only = arg('only')?.split(',');

/* ---------- grading ---------- */
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
function gradeBuffer(buf, o) {
  const warm = o.warm ?? 0.6, sat = o.sat ?? 0.88, green = o.green ?? 0.78, blue = o.blue ?? 0.84;
  const contrast = o.contrast ?? 0.1, gamma = o.gamma ?? 1;
  // exposure (gamma) + matte S-curve: mids +10% contrast, blacks lifted to ~6, whites rolled off to ~251
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = Math.pow(i / 255, gamma);
    const y = x - (contrast * Math.sin(2 * Math.PI * x)) / (2 * Math.PI);
    lut[i] = 6 + y * 245;
  }
  // optional grey-world white balance toward a warm neutral (r:g:b ≈ 1.05:1:0.9), blended by o.wb (0..1)
  let gr = 1, gg = 1, gb = 1;
  if (o.wb) {
    let sr = 0, sg = 0, sb = 0;
    for (let p = 0; p < buf.length; p += 3) { sr += buf[p]; sg += buf[p + 1]; sb += buf[p + 2]; }
    const m = (sr + sg + sb) / 3;
    gr = 1 + o.wb * ((m * 1.05) / sr - 1);
    gg = 1 + o.wb * (m / sg - 1);
    gb = 1 + o.wb * ((m * 0.9) / sb - 1);
  }
  for (let p = 0; p < buf.length; p += 3) {
    let r = lut[clamp8(Math.round(buf[p] * gr))], g = lut[clamp8(Math.round(buf[p + 1] * gg))], b = lut[clamp8(Math.round(buf[p + 2] * gb))];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    // hue-selective weights: yellow-greens .. greens .. teal (≈ 65°–170°) and sky blues (≈ 190°–250°)
    let gw = 0, bw = 0;
    if (d > 2) {
      let h;
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
      gw = h < 65 ? Math.max(0, (h - 45) / 20) : h > 170 ? Math.max(0, (195 - h) / 25) : 1;
      bw = h < 190 ? Math.max(0, (h - 170) / 20) : h > 250 ? Math.max(0, (270 - h) / 20) : 1;
    }
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const s = sat * (1 - (1 - green) * gw) * (1 - (1 - blue) * bw);
    r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
    // greens lean a touch toward olive (not lime)
    if (gw > 0) { const k = gw * Math.min(1, d / 90); r += 5 * k; b -= 2 * k; }
    // warm split-tone: highlights cream-warm, shadows soil-brown; dosed per photo
    const t = l / 255;
    r += warm * (2 + 8 * t); g += warm * (0.8 + 3 * t); b -= warm * (2.5 + 8 * t);
    buf[p] = clamp8(r + 0.5); buf[p + 1] = clamp8(g + 0.5); buf[p + 2] = clamp8(b + 0.5);
  }
  return buf;
}

/* ---------- helpers ---------- */
/** Dominant colour: most populated 8×8×8 RGB bin of a small version, averaged inside that bin. */
async function dominantColor(img) {
  const { data } = await img.resize(48).raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const k = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0] += data[i]; b[1] += data[i + 1]; b[2] += data[i + 2]; b[3]++;
    bins.set(k, b);
  }
  const [r, g, b, n] = [...bins.values()].sort((a, c) => c[3] - a[3])[0];
  return { r: r / n, g: g / n, b: b / n };
}
const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Commons stores files under md5(name)[0]/md5(name)[0..1]/name; we fetch its standard thumbnail. */
function commonsThumb(name, width) {
  const n = name.replace(/ /g, '_');
  const md5 = createHash('md5').update(n, 'utf8').digest('hex');
  const enc = encodeURIComponent(n);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${width}px-${enc}`;
}
async function download(p) {
  const url = commonsThumb(p.commons, p.thumb);
  const res = await fetch(url, { headers: { 'User-Agent': 'OurForestDemoImagePipeline/0.1' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(join(SRC, p.file), Buffer.from(await res.arrayBuffer()));
}

/** Retouch: feathered clone-stamp in source-normalised coords — rect [x, y, w, h] is replaced by the
 *  pixels at rect + [dx, dy] (used to remove small distractions such as a tarp or hanging clothes). */
function applyClones(buf, W, H, ops) {
  const ch = 3;
  for (const { rect: [rx, ry, rw, rh], from: [dx, dy], feather = 0.006 } of ops) {
    const x0 = Math.round(rx * W), y0 = Math.round(ry * H), x1 = Math.round((rx + rw) * W), y1 = Math.round((ry + rh) * H);
    const ox = Math.round(dx * W), oy = Math.round(dy * H), f = Math.max(1, Math.round(feather * W));
    const copy = Buffer.from(buf);
    for (let y = Math.max(0, y0 - f); y < Math.min(H, y1 + f); y++) {
      for (let x = Math.max(0, x0 - f); x < Math.min(W, x1 + f); x++) {
        const ex = Math.max(x0 - x, x - x1 + 1, 0), ey = Math.max(y0 - y, y - y1 + 1, 0);
        const e = Math.hypot(ex, ey);
        if (e >= f) continue;
        const a = 1 - (e / f) ** 2 * (3 - 2 * (e / f)); // smoothstep falloff
        const sx = Math.min(W - 1, Math.max(0, x + ox)), sy = Math.min(H - 1, Math.max(0, y + oy));
        const di = (y * W + x) * ch, si = (sy * W + sx) * ch;
        for (let c = 0; c < ch; c++) buf[di + c] = Math.round(buf[di + c] * (1 - a) + copy[si + c] * a);
      }
    }
  }
}

function cropBox(W, H, ratio, focus, zoom = 1) {
  let cw, ch;
  if (W / H > ratio) { ch = H * zoom; cw = ch * ratio; } else { cw = W * zoom; ch = cw / ratio; }
  cw = Math.floor(cw); ch = Math.floor(ch);
  const [fx, fy] = focus;
  const left = Math.round(Math.min(Math.max(fx * W - cw / 2, 0), W - cw));
  const top = Math.round(Math.min(Math.max(fy * H - ch / 2, 0), H - ch));
  return { left, top, width: cw, height: ch };
}

async function build(key, p, entry) {
  const src = join(SRC, p.file);
  if (!existsSync(src)) {
    if (!args.includes('--download')) throw new Error(`missing source ${src} (run with --download)`);
    mkdirSync(SRC, { recursive: true });
    await download(p);
  }
  const ratio = entry.ratio;
  let base = sharp(src, { failOn: 'none' }).rotate();
  const meta = await sharp(src).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const W = swap ? meta.height : meta.width, H = swap ? meta.width : meta.height;
  if (p.clone?.length) {
    const { data: raw } = await base.clone().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    applyClones(raw, W, H, p.clone);
    base = sharp(raw, { raw: { width: W, height: H, channels: 3 } });
  }

  let box;
  if (p.focus === 'attention') {
    // let sharp's saliency pick the window at native scale
    const tmp = cropBox(W, H, ratio, [0.5, 0.5], p.zoom ?? 1);
    const { info } = await base.clone().resize(tmp.width, tmp.height, { fit: 'cover', position: sharp.strategy.attention })
      .raw().toBuffer({ resolveWithObject: true });
    box = { ...tmp, left: Math.abs(info.cropOffsetLeft ?? 0), top: Math.abs(info.cropOffsetTop ?? 0) };
  } else {
    box = cropBox(W, H, ratio, p.focus ?? [0.5, 0.5], p.zoom ?? 1);
  }

  const outW = Math.min(entry.maxW, box.width);
  const outH = Math.round(outW / ratio);
  // light denoise at source scale when downscaling a lot (keeps foliage noise from eating the byte budget)
  let pipe = base.clone().extract(box);
  const soften = p.soften ?? (box.width / outW >= 1.25 ? 0.6 : 0);
  if (soften >= 0.3) pipe = pipe.blur(soften);
  const { data } = await pipe.resize(outW, outH, { kernel: 'lanczos3' })
    .removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  gradeBuffer(data, p.grade ?? {});
  const graded = () => sharp(data, { raw: { width: outW, height: outH, channels: 3 } });

  // widths: the standard steps up to outW, plus outW itself when it falls between steps
  const widths = WIDTHS.filter((w) => w <= outW);
  if (!widths.includes(outW) && outW > (widths.at(-1) ?? 0) + 40) widths.push(outW);

  for (const f of readdirSync(OUT)) if (new RegExp(`^${key}-\\d+\\.(avif|webp|jpg)$`).test(f)) unlinkSync(join(OUT, f));
  const sources = { avif: [], webp: [], jpg: [] };
  for (const w of widths) {
    const h = Math.round(w / ratio);
    const img = () => graded().resize(w, h, { kernel: 'lanczos3' });
    const dq = w > 1200 ? 4 : 0; // the 1600/2400 steps only ever show on large/HiDPI screens: a little lighter
    await img().avif({ quality: Q.avif - dq, effort: 5, chromaSubsampling: '4:2:0' }).toFile(join(OUT, `${key}-${w}.avif`));
    await img().webp({ quality: Q.webp - dq, effort: 5, smartSubsample: true, preset: 'photo' }).toFile(join(OUT, `${key}-${w}.webp`));
    await img().jpeg({ quality: Q.jpg - dq, mozjpeg: true, progressive: true }).toFile(join(OUT, `${key}-${w}.jpg`));
    for (const ext of ['avif', 'webp', 'jpg']) sources[ext].push([w, `/img/${key}-${w}.${ext}`]);
  }
  if (p.also) {
    const w = Math.min(1200, outW);
    await graded().resize(w, Math.round(w / ratio), { kernel: 'lanczos3' })
      .jpeg({ quality: Q.jpg, mozjpeg: true, progressive: true }).toFile(join(OUT, p.also));
  }

  const lqipBuf = await graded().resize(24, Math.max(1, Math.round(24 / ratio))).blur(0.6).webp({ quality: 45 }).toBuffer();
  const dominant = await dominantColor(graded());

  return {
    w: outW, h: outH, color: hex(dominant), alt: p.alt, purpose: entry.purpose,
    credit: { title: p.credit.title, author: p.credit.author, license: p.credit.license, licenseUrl: p.credit.licenseUrl, source: commons(p.commons) },
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
    sources,
    box, src: `${W}x${H}`,
  };
}

/* ---------- main ---------- */
mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
sharp.concurrency(4);
const keys = Object.keys(PHOTOS).filter((k) => !only || only.includes(k));
for (const key of Object.keys(manifest)) if (!PHOTOS[key]) console.warn(`! no photo configured for "${key}"`);
for (const key of keys) {
  const cur = manifest[key];
  if (!cur) { console.warn(`! "${key}" is not in images.json — skipped`); continue; }
  const p = PHOTOS[key];
  const [tw, th] = p.size;
  const t0 = Date.now();
  const res = await build(key, p, { ratio: tw / th, maxW: tw, purpose: cur.purpose });
  const { box, src, ...entry } = res;
  manifest[key] = entry;
  console.log(`✓ ${key.padEnd(13)} ${String(entry.w).padStart(4)}×${entry.h}  from ${src} crop ${box.width}×${box.height}@${box.left},${box.top}  ${entry.color}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

let total = 0;
for (const f of readdirSync(OUT)) total += statSync(join(OUT, f)).size;
console.log(`public/img: ${(total / 1024 / 1024).toFixed(2)} MB`);
