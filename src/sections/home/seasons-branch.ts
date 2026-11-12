/* ==========================================================================
   Seasons — the thin fig & pomegranate branch along the top of the strip.
   Generated, seeded line art in the shared style (stroke 1.5, round caps, no hard fills).
   Everything that changes with the season is pure CSS driven by ONE inherited custom
   property on the section, --sp (season position 0 → 3 = spring → winter):
     · leaves: young & small (spring) → full olive (summer) → turning amber (autumn) → falling (winter)
     · fruit:  pomegranate blossoms → green buds → ripe --fruit, in a wave along the branch
               (the end you start from ripens first, so the ripening travels with you)
   Per-element constants are written as inline custom properties (--t position along the branch
   0 = start/right, --o random offset, --rot / --dx fall spin and drift).
   seasons.css holds the formulas (.seasons__lf / .seasons__fr …).
   ========================================================================== */

export interface Pt { x: number; y: number }

/** mulberry32 — tiny seeded RNG so the branch is the same on every visit */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Catmull-Rom through points → cubic Bézier path data */
export function smooth(pts: Pt[], closed = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return closed ? `${d}Z` : d;
}

/** dense polyline of the same Catmull-Rom curve (for placing things along it) */
function sample(pts: Pt[], per = 24): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const get = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    for (let k = 0; k < per; k++) {
      const t = k / per, u = 1 - t;
      out.push({
        x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
        y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
      });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** point + tangent angle at arc-length fraction u of a polyline */
function along(poly: Pt[], lens: number[], u: number): { p: Pt; a: number } {
  const total = lens[lens.length - 1];
  const target = Math.max(0, Math.min(1, u)) * total;
  let i = 1;
  while (i < lens.length - 1 && lens[i] < target) i++;
  const a = poly[i - 1], b = poly[i];
  const k = (target - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
  return { p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

/* ---------------------------------------------------------------- shapes (local, hanging along +y) */

/** palmate fig leaf, petiole at (0,0), blade hanging along +y; size = overall length */
function figLeaf(size: number, r: () => number): string {
  const C = { x: 0, y: 0.47 * size };
  // [angle from +y in degrees, radius as a fraction of size]
  const spec: [number, number][] = [
    [180, 0.36], [148, 0.41], [116, 0.43], [88, 0.27], [56, 0.52], [27, 0.29],
    [0, 0.56], [-27, 0.29], [-56, 0.52], [-88, 0.27], [-116, 0.43], [-148, 0.41],
  ];
  const pts = spec.map(([deg, rad]) => {
    const a = (deg * Math.PI) / 180;
    const rr = rad * size * (1 + (r() - 0.5) * 0.12);
    return { x: C.x + Math.sin(a) * rr, y: C.y + Math.cos(a) * rr };
  });
  const blade = smooth(pts, true);
  // veins: from the base to the lobe tips
  const base = { x: 0, y: 0.13 * size };
  const vein = (i: number, k: number) => {
    const tip = pts[i];
    const e = { x: base.x + (tip.x - base.x) * k, y: base.y + (tip.y - base.y) * k };
    const m = { x: (base.x + e.x) / 2 + (e.y - base.y) * 0.05, y: (base.y + e.y) / 2 - (e.x - base.x) * 0.05 };
    return `M${f(base.x)} ${f(base.y)}Q${f(m.x)} ${f(m.y)} ${f(e.x)} ${f(e.y)}`;
  };
  const veins = `M0 0L0 ${f(base.y)}${vein(6, 0.82)}${vein(4, 0.72)}${vein(8, 0.72)}${vein(2, 0.62)}${vein(10, 0.62)}`;
  return `<path class="seasons__blade" d="${blade}"/><path class="seasons__vein" d="${veins}"/>`;
}

/** narrow pomegranate leaf */
function pomLeaf(size: number): string {
  const s = size;
  const blade = `M0 0C${f(0.11 * s)} ${f(0.2 * s)} ${f(0.17 * s)} ${f(0.56 * s)} 0 ${f(s)}C${f(-0.17 * s)} ${f(0.56 * s)} ${f(-0.11 * s)} ${f(0.2 * s)} 0 0Z`;
  return `<path class="seasons__blade" d="${blade}"/><path class="seasons__vein" d="M0 ${f(0.08 * s)}L0 ${f(0.84 * s)}"/>`;
}

const FIG = {
  body: 'M0 0C2.4 .6 3.4 3.8 5.2 7.6C7.8 12.6 8.4 19 4.6 22.4C2.6 24.2-2.6 24.2-4.6 22.4C-8.4 19-7.8 12.6-5.2 7.6C-3.4 3.8-2.4.6 0 0Z',
  detail: 'M3.2 9.6C4.6 12.8 4.8 16.4 3.6 19.2M-1.1 22.6Q0 23.8 1.1 22.6',
};
const POM = {
  body: 'M0 1.2C6.4 1.2 10.6 5.6 10.6 11.6C10.6 17.8 6 22 0 22C-6 22-10.6 17.8-10.6 11.6C-10.6 5.6-6.4 1.2 0 1.2Z',
  detail: 'M-3.6 20.8L-4.2 25.4L-1.8 23.4L0 26.4L1.8 23.4L4.2 25.4L3.6 20.8M-6.4 7.6C-7.8 9.6-8.2 12.4-7.4 15.2',
  bloom: 'M-2.4 0C-2.6 3-3.2 6-4.6 8.6L-2.2 7.8L-1.2 11L0 8.2L1.2 11L2.2 7.8L4.6 8.6C3.2 6 2.6 3 2.4 0Z'
    + 'M-4.6 8.6C-8 9.2-9.6 12.4-7.6 15C-5 15.4-2.4 13.4-1.2 11M4.6 8.6C8 9.2 9.6 12.4 7.6 15C5 15.4 2.4 13.4 1.2 11'
    + 'M-1.2 11C-1.6 14-.8 16.6 0 17.4C.8 16.6 1.6 14 1.2 11',
};

/* ---------------------------------------------------------------- the branch */

export interface BranchOptions {
  /** viewBox size */
  w: number; h: number;
  /** stem start (beyond the start edge) and end (the tip) */
  from: Pt; to: Pt;
  fruits: number;
  /** scale of leaves & fruit relative to the desktop drawing */
  scale: number;
  seed: number;
  /** extra stem leaves between twigs */
  stemLeaves: number;
}

export const WIDE: BranchOptions = { w: 1600, h: 210, from: { x: 1650, y: 30 }, to: { x: 64, y: 74 }, fruits: 8, scale: 1, seed: 427, stemLeaves: 9 };
export const COMPACT: BranchOptions = { w: 400, h: 128, from: { x: 430, y: 18 }, to: { x: 18, y: 44 }, fruits: 4, scale: 0.78, seed: 612, stemLeaves: 3 };

/** returns the inner markup of an <svg viewBox="0 0 w h"> */
export function buildBranch(o: BranchOptions): string {
  const r = rng(o.seed);
  const { w } = o;
  const spanX = o.from.x - o.to.x;
  // stem: gentle sag + one soft wave, thinning to a tip that lifts a little
  const ctrl: Pt[] = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const sag = Math.sin(k * Math.PI * 0.92) * (o.h * 0.13) + Math.sin(k * Math.PI * 2.1 + 0.6) * (o.h * 0.035);
    ctrl.push({ x: o.from.x - spanX * k, y: o.from.y + (o.to.y - o.from.y) * k + sag * (i === 0 || i === N - 1 ? 0.3 : 1) });
  }
  const poly = sample(ctrl, 30);
  const lens = [0];
  for (let i = 1; i < poly.length; i++) lens.push(lens[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
  // the visible part starts at the start edge (x = w)
  const visibleFrom = (() => {
    for (let i = 0; i < poly.length; i++) if (poly[i].x <= w) return lens[i] / lens[lens.length - 1];
    return 0;
  })();

  const tOf = (x: number) => Math.max(0, Math.min(1, (w - x) / (w - o.to.x)));
  let twigs = '', leaves = '', fruits = '', stalks = '';
  const S = o.scale;

  const leafAt = (p: Pt, rot: number, kind: 'fig' | 'pom', size: number) => {
    const t = tOf(p.x);
    const oo = r();
    const spin = (r() < 0.5 ? -1 : 1) * (70 + r() * 140);
    const dx = (r() - 0.5) * 70 - 18;
    const shape = kind === 'fig' ? figLeaf(size, r) : pomLeaf(size);
    leaves += `<g class="seasons__lf seasons__lf--${kind}" transform="translate(${f(p.x)} ${f(p.y)})" style="--t:${t.toFixed(3)};--o:${oo.toFixed(3)};--rot:${spin.toFixed(0)};--dx:${dx.toFixed(0)}">`
      + `<g class="seasons__lf-fall"><g transform="rotate(${f(rot)})"><g class="seasons__lf-grow">${shape}</g></g></g></g>`;
  };

  // fruit twigs
  for (let i = 0; i < o.fruits; i++) {
    const kind: 'fig' | 'pom' = i % 2 === 0 ? 'fig' : 'pom';
    const u = visibleFrom + (1 - visibleFrom) * (0.07 + (0.86 * (i + 0.15 + r() * 0.5)) / o.fruits);
    const { p, a } = along(poly, lens, u);
    // hang down, leaning a little towards the tip
    const dir = Math.PI / 2 + (r() - 0.35) * 0.55;
    const len = (22 + r() * 30) * S;
    const end = { x: p.x + Math.cos(dir) * len, y: p.y + Math.sin(dir) * len };
    const mid = { x: (p.x + end.x) / 2 + Math.cos(a) * 6 * S, y: (p.y + end.y) / 2 + Math.sin(a) * 2 * S };
    twigs += `M${f(p.x)} ${f(p.y)}Q${f(mid.x)} ${f(mid.y)} ${f(end.x)} ${f(end.y)}`;
    const stalk = (kind === 'fig' ? 4 : 6 + r() * 4) * S;
    stalks += `M${f(end.x)} ${f(end.y)}L${f(end.x)} ${f(end.y + stalk)}`;
    const t = tOf(end.x);
    const shape = kind === 'fig' ? FIG : POM;
    const bloom = kind === 'pom' ? `<g class="seasons__bloom"><path d="${POM.bloom}"/></g>` : '';
    fruits += `<g class="seasons__fr seasons__fr--${kind}" transform="translate(${f(end.x)} ${f(end.y + stalk)}) scale(${S})" style="--t:${t.toFixed(3)}">`
      + `${bloom}<g class="seasons__fr-grow"><path class="seasons__fr-body" d="${shape.body}"/><path class="seasons__fr-detail" d="${shape.detail}"/></g></g>`;
    // leaves on the twig: one broad fig leaf, or a little fan of narrow pomegranate leaves
    if (kind === 'fig') {
      const q = { x: p.x + (end.x - p.x) * 0.38, y: p.y + (end.y - p.y) * 0.38 };
      const side = r() < 0.5 ? -1 : 1;
      leafAt(q, side * (34 + r() * 30), 'fig', (40 + r() * 10) * S);
    } else {
      const q = { x: p.x + (end.x - p.x) * 0.55, y: p.y + (end.y - p.y) * 0.55 };
      const n = 2 + Math.round(r());
      for (let k = 0; k < n; k++) leafAt(q, -70 + (140 * (k + 0.5)) / n + (r() - 0.5) * 18, 'pom', (22 + r() * 8) * S);
    }
  }

  // leaves straight on the stem, alternating up and down
  for (let i = 0; i < o.stemLeaves; i++) {
    const u = visibleFrom + (1 - visibleFrom) * (0.04 + (0.9 * (i + 0.5 + (r() - 0.5) * 0.6)) / o.stemLeaves);
    const { p } = along(poly, lens, u);
    const up = i % 2 === 0;
    const kind: 'fig' | 'pom' = r() < 0.45 ? 'fig' : 'pom';
    const rot = up ? 180 + (r() - 0.5) * 90 : (r() - 0.5) * 100;
    leafAt(p, rot, kind, kind === 'fig' ? (32 + r() * 10) * S : (20 + r() * 8) * S);
  }

  // the tip: two small new leaves
  const tip = along(poly, lens, 1).p;
  const tipLeaves = `M${f(tip.x)} ${f(tip.y)}c${f(-4 * S)} ${f(-5 * S)} ${f(-10 * S)} ${f(-6 * S)} ${f(-14 * S)} ${f(-4 * S)}c${f(4 * S)} ${f(4 * S)} ${f(10 * S)} ${f(6 * S)} ${f(14 * S)} ${f(4 * S)}Z`
    + `M${f(tip.x)} ${f(tip.y)}c${f(-3 * S)} ${f(4 * S)} ${f(-8 * S)} ${f(7 * S)} ${f(-12 * S)} ${f(6 * S)}c${f(2 * S)} ${f(-4 * S)} ${f(7 * S)} ${f(-7 * S)} ${f(12 * S)} ${f(-6 * S)}Z`;

  return `<g class="seasons__wood"><path class="seasons__stem" d="${smooth(ctrl)}"/><path class="seasons__twig" d="${twigs}"/><path class="seasons__twig seasons__tip" d="${tipLeaves}"/><path class="seasons__stalk" d="${stalks}"/></g>`
    + `<g class="seasons__leaves">${leaves}</g><g class="seasons__fruits">${fruits}</g>`;
}

/* ---------------------------------------------------------------- almond twig (Tu BiShvat plaque art) */

/** five-lobed blossom outline around (cx, cy) */
function blossom(cx: number, cy: number, R: number, rot: number): string {
  // per petal: sinus, shoulder, tip, shoulder → round petals with clear notches between them
  const pts: Pt[] = [];
  const step = (Math.PI * 2) / 5;
  const at = (a: number, rr: number) => pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  for (let i = 0; i < 5; i++) {
    const a = rot + i * step;
    at(a - step / 2, R * 0.34);
    at(a - step * 0.3, R * 0.86);
    at(a, R);
    at(a + step * 0.3, R * 0.86);
  }
  const c = R * 0.2;
  return `${smooth(pts, true)}M${f(cx + c)} ${f(cy)}A${f(c)} ${f(c)} 0 1 1 ${f(cx - c)} ${f(cy)}A${f(c)} ${f(c)} 0 1 1 ${f(cx + c)} ${f(cy)}Z`;
}

/** an almond twig in bloom — "הראשון לפרוח בט״ו בשבט" — viewBox 0 0 240 300 */
export function almondArt(): string {
  const r = rng(23);
  const stem: Pt[] = [{ x: 206, y: 292 }, { x: 170, y: 228 }, { x: 132, y: 168 }, { x: 104, y: 100 }, { x: 92, y: 30 }];
  const poly = sample(stem, 20);
  const lens = [0];
  for (let i = 1; i < poly.length; i++) lens.push(lens[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
  let wood = smooth(stem);
  let flowers = '';
  let buds = '';
  const spots = [0.2, 0.34, 0.47, 0.6, 0.72, 0.84, 0.95];
  spots.forEach((u, i) => {
    const { p, a } = along(poly, lens, u);
    const side = i % 2 === 0 ? 1 : -1;
    const n = a + side * (Math.PI / 2.4);
    const L = 10 + r() * 10;
    const e = { x: p.x + Math.cos(n) * L, y: p.y + Math.sin(n) * L };
    wood += `M${f(p.x)} ${f(p.y)}L${f(e.x)} ${f(e.y)}`;
    if (i === spots.length - 1 || i === 1) {
      // a closed bud
      buds += `M${f(e.x)} ${f(e.y)}c${f(-3)} ${f(-4)} ${f(-3)} ${f(-9)} 0 ${f(-12)}c${f(3)} ${f(3)} ${f(3)} ${f(8)} 0 ${f(12)}Z`;
    } else {
      flowers += `<path class="seasons__almond-flower" style="--k:${i}" d="${blossom(e.x, e.y, 13 + r() * 5, r() * Math.PI)}"/>`;
    }
  });
  return `<path class="seasons__almond-wood" d="${wood}"/><path class="seasons__almond-bud" d="${buds}"/>${flowers}`;
}

/** 24px line icon: almond blossom */
export function almondIcon(): string {
  return `<path d="${blossom(12, 12, 8.6, -Math.PI / 2)}"/>`;
}
