/* Species: crown envelope + growth parameters for the generator, leaf / fruit / blossom drawings
   (one SVG path language shared by the SVG fallback and the WebGL leaf atlas), colours, phenology. */
import type { SpeciesId } from '../../components/forest-map';
import type { Season } from '../../core/format';
import { P, TINT, mixC, type RGB } from './util';

export type LeafShape = 'fig' | 'olive' | 'pomegranate' | 'carob' | 'almond' | 'mulberry';
export type FruitShape = 'fig' | 'round' | 'olive' | 'pod' | 'almond' | 'berry';

export interface SpeciesDef {
  id: SpeciesId;
  nameHe: string;
  evergreen: boolean;
  /** crown envelope (model units, tree base at the origin; adult tree ≈ 2.6–3 tall) */
  crown: { cy: number; rx: number; ry: number; rz: number; lobes: number; lobeR: number; floor: number; attractors: number };
  trunk: { stems: number; spread: number; twist: number; gnarl: number; lean: number; thick: number; up: number };
  growth: { step: number; influence: number; kill: number; tropism: number; maxIter: number; droop: number };
  leaf: { shape: LeafShape; len: number; width: number; reach: number; budget: number; spread: number };
  colors: { light: RGB; mid: RGB; dark: RGB; under: RGB; trunk: RGB; autumn: RGB[] };
  fruit: { shape: FruitShape; size: number; count: number; seasons: Season[]; color: RGB };
  bloom: { seasons: Season[]; count: number; size: number; color: RGB; bell: boolean } | null;
  roots: { spread: number; depth: number; laterals: number };
  /** Hebrew season phrases for the screen-reader description */
  seasonHe: Record<Season, string>;
}

const greenL = mixC(P.sage, P.olive, 0.3);
const AUTUMN = [TINT.ochre, TINT.amber, mixC(TINT.ochre, P.olive, 0.3), mixC(TINT.ochre, P.sand, 0.25)];

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  fig: {
    id: 'fig', nameHe: 'תאנה', evergreen: false,
    crown: { cy: 1.45, rx: 1.72, ry: 0.86, rz: 1.3, lobes: 10, lobeR: 0.58, floor: 0.62, attractors: 640 },
    trunk: { stems: 1, spread: 0, twist: 0.15, gnarl: 0.1, lean: 0.06, thick: 1.25, up: 0.42 },
    growth: { step: 0.06, influence: 0.6, kill: 0.13, tropism: 0.05, maxIter: 90, droop: 0.05 },
    leaf: { shape: 'fig', len: 0.25, width: 1, reach: 2, budget: 0.28, spread: 0.09 },
    colors: { light: greenL, mid: P.olive, dark: P.oliveDeep, under: mixC(P.sage, P.sand, 0.3), trunk: TINT.barkGrey, autumn: AUTUMN },
    fruit: { shape: 'fig', size: 0.05, count: 34, seasons: ['summer'], color: mixC(P.fruit, P.moss, 0.22) },
    bloom: null,
    roots: { spread: 1.15, depth: 0.85, laterals: 7 },
    seasonHe: { spring: 'מוציא עלים חדשים', summer: 'בשיא הקיץ', autumn: 'מתכונן לחורף', winter: 'נח בחורף' },
  },
  olive: {
    id: 'olive', nameHe: 'זית', evergreen: true,
    crown: { cy: 1.68, rx: 1.18, ry: 0.98, rz: 1.02, lobes: 13, lobeR: 0.42, floor: 0.95, attractors: 760 },
    trunk: { stems: 2, spread: 0.07, twist: 1.0, gnarl: 0.32, lean: 0.14, thick: 1.6, up: 0.36 },
    growth: { step: 0.055, influence: 0.52, kill: 0.11, tropism: 0.02, maxIter: 100, droop: 0.12 },
    leaf: { shape: 'olive', len: 0.135, width: 1, reach: 5, budget: 1.1, spread: 0.07 },
    colors: {
      light: mixC(P.sage, P.cream, 0.12), mid: mixC(P.sage, P.olive, 0.55), dark: mixC(P.olive, P.oliveDeep, 0.55),
      under: mixC(P.sage, P.cream, 0.4), trunk: mixC(TINT.barkGrey, P.bark, 0.15), autumn: AUTUMN,
    },
    fruit: { shape: 'olive', size: 0.022, count: 150, seasons: ['autumn', 'winter'], color: mixC(P.fruit, P.moss, 0.45) },
    bloom: { seasons: ['spring'], count: 140, size: 0.022, color: mixC(P.cream, P.sage, 0.25), bell: false },
    roots: { spread: 0.9, depth: 1.1, laterals: 6 },
    seasonHe: { spring: 'פורח בפריחה זעירה', summer: 'ירוק כסוף בקיץ', autumn: 'בעונת המסיק', winter: 'ירוק גם בחורף' },
  },
  pomegranate: {
    id: 'pomegranate', nameHe: 'רימון', evergreen: false,
    crown: { cy: 1.2, rx: 1.22, ry: 1.02, rz: 1.06, lobes: 13, lobeR: 0.44, floor: 0.2, attractors: 780 },
    trunk: { stems: 4, spread: 0.15, twist: 0.25, gnarl: 0.12, lean: 0.34, thick: 0.9, up: 0.05 },
    growth: { step: 0.055, influence: 0.5, kill: 0.11, tropism: 0.06, maxIter: 100, droop: 0.06 },
    leaf: { shape: 'pomegranate', len: 0.105, width: 1, reach: 6, budget: 1.1, spread: 0.07 },
    colors: { light: mixC(P.sage, P.olive, 0.45), mid: mixC(P.olive, P.oliveDeep, 0.2), dark: P.oliveDeep, under: greenL, trunk: TINT.barkLight, autumn: [mixC(TINT.ochre, P.sand, 0.15), TINT.ochre, TINT.amber] },
    fruit: { shape: 'round', size: 0.07, count: 18, seasons: ['autumn'], color: P.fruit },
    bloom: { seasons: ['spring', 'summer'], count: 60, size: 0.06, color: P.fruit, bell: true },
    roots: { spread: 1.0, depth: 0.75, laterals: 7 },
    seasonHe: { spring: 'פורח באדום', summer: 'מגדל רימונים', autumn: 'מתכונן לחורף', winter: 'נח בחורף' },
  },
  carob: {
    id: 'carob', nameHe: 'חרוב', evergreen: true,
    crown: { cy: 1.72, rx: 1.28, ry: 1.0, rz: 1.15, lobes: 10, lobeR: 0.52, floor: 1.0, attractors: 760 },
    trunk: { stems: 1, spread: 0, twist: 0.3, gnarl: 0.18, lean: 0.05, thick: 1.45, up: 0.48 },
    growth: { step: 0.058, influence: 0.55, kill: 0.12, tropism: 0.03, maxIter: 100, droop: 0.04 },
    leaf: { shape: 'carob', len: 0.15, width: 1, reach: 3, budget: 0.5, spread: 0.07 },
    colors: { light: mixC(P.olive, P.sage, 0.25), mid: P.oliveDeep, dark: mixC(P.oliveDeep, P.moss, 0.55), under: P.olive, trunk: mixC(P.bark, P.sand, 0.45), autumn: AUTUMN },
    fruit: { shape: 'pod', size: 0.13, count: 40, seasons: ['summer', 'autumn'], color: mixC(P.fruit, P.bark, 0.5) },
    bloom: null,
    roots: { spread: 1.05, depth: 1.05, laterals: 7 },
    seasonHe: { spring: 'ירוק כהה ועגול', summer: 'מבשיל תרמילים', autumn: 'ירוק כל השנה', winter: 'ירוק גם בחורף' },
  },
  almond: {
    id: 'almond', nameHe: 'שקד', evergreen: false,
    crown: { cy: 1.92, rx: 0.98, ry: 1.12, rz: 0.88, lobes: 9, lobeR: 0.42, floor: 1.0, attractors: 560 },
    trunk: { stems: 1, spread: 0, twist: 0.2, gnarl: 0.12, lean: 0.08, thick: 1.05, up: 0.7 },
    growth: { step: 0.06, influence: 0.55, kill: 0.13, tropism: 0.14, maxIter: 95, droop: 0.0 },
    leaf: { shape: 'almond', len: 0.13, width: 1, reach: 3, budget: 0.7, spread: 0.065 },
    colors: { light: mixC(P.sage, P.cream, 0.15), mid: mixC(P.sage, P.olive, 0.4), dark: P.olive, under: P.sage, trunk: mixC(mixC(P.bark, P.soil, 0.1), P.sand, 0.25), autumn: AUTUMN },
    fruit: { shape: 'almond', size: 0.04, count: 50, seasons: ['summer'], color: mixC(P.fruit, P.sage, 0.35) },
    bloom: { seasons: ['winter'], count: 520, size: 0.068, color: mixC(P.cream, TINT.blossom, 0.4), bell: false },
    roots: { spread: 0.95, depth: 1.0, laterals: 6 },
    seasonHe: { spring: 'מוציא עלים', summer: 'מבשיל שקדים', autumn: 'מתכונן לחורף', winter: 'פורח בלבן' },
  },
  mulberry: {
    id: 'mulberry', nameHe: 'תות', evergreen: false,
    crown: { cy: 1.74, rx: 1.66, ry: 0.8, rz: 1.32, lobes: 10, lobeR: 0.52, floor: 0.95, attractors: 660 },
    trunk: { stems: 1, spread: 0, twist: 0.15, gnarl: 0.1, lean: 0.05, thick: 1.3, up: 0.6 },
    growth: { step: 0.06, influence: 0.6, kill: 0.13, tropism: -0.02, maxIter: 90, droop: 0.16 },
    leaf: { shape: 'mulberry', len: 0.16, width: 1, reach: 3, budget: 0.55, spread: 0.07 },
    colors: { light: greenL, mid: P.olive, dark: P.oliveDeep, under: mixC(P.sage, P.olive, 0.2), trunk: TINT.barkLight, autumn: [TINT.ochre, mixC(TINT.ochre, P.sand, 0.25), TINT.amber] },
    fruit: { shape: 'berry', size: 0.032, count: 110, seasons: ['spring'], color: mixC(P.fruit, P.soil, 0.38) },
    bloom: null,
    roots: { spread: 1.1, depth: 0.85, laterals: 7 },
    seasonHe: { spring: 'מבשיל תותים', summer: 'צל רחב בקיץ', autumn: 'מתכונן לחורף', winter: 'נח בחורף' },
  },
};

export function speciesDef(id: SpeciesId | string): SpeciesDef {
  return SPECIES[(id as SpeciesId)] ?? SPECIES.fig;
}

/* ===================================================================================
   Drawings (viewBox 0 0 100 100). Leaves: petiole at the bottom centre (50,100), tip at (50,0).
   Outlines are given as the RIGHT half (x ≥ 50) from base to tip and mirrored, then smoothed
   with Catmull-Rom → one closed path. Veins are separate open paths.
   =================================================================================== */
type Pt = [number, number];
function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}
function mirrored(right: Pt[]): string {
  // right half from base to tip; left half = mirror, reversed (tip → base), skipping shared ends
  const left = right.slice(1, -1).reverse().map(([x, y]) => [100 - x, y] as Pt);
  return smoothClosed([...right, ...left]);
}
function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
  const pts: Pt[] = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return smoothClosed(pts);
}

export interface LeafArt { outline: string; veins: string; /** width / length of the drawing */ aspect: number }
/** palmately lobed leaf (fig): polar outline around the blade's centre (0° = up), petiole drawn as a vein to (50, 100) */
function palmate(o: { cy: number; R: number; lobes: [number, number, number][]; base: number; notch: number }): LeafArt {
  const rAt = (t: number) => {
    const th = Math.abs(t);
    let lob = 0;
    for (const [c, l, w] of o.lobes) lob = Math.max(lob, l * Math.exp(-(((th - c) / w) ** 2)));
    // heart-shaped base: a soft notch where the petiole joins
    const notch = 1 - o.notch * Math.exp(-(((th - 180) / 16) ** 2));
    return o.R * (o.base + (1 - o.base) * lob) * notch * (1 + 0.012 * Math.sin(th * 0.42));
  };
  const at = (th: number, k = 1): Pt => {
    const a = (th * Math.PI) / 180, r = rAt(th) * k;
    return [50 + Math.sin(a) * r, o.cy - Math.cos(a) * r];
  };
  const right: Pt[] = [];
  for (let th = 180; th >= 0; th -= 4.5) right.push(at(th));
  right[0] = [50, right[0][1]];
  right[right.length - 1] = [50, right[right.length - 1][1]];
  const f = (v: number) => Math.round(v * 10) / 10;
  const base = right[0];
  let veins = `M50 100 L50 ${f(base[1])} L50 ${f(o.cy)}`;
  for (const [c] of o.lobes) {
    for (const side of c === 0 ? [1] : [1, -1]) {
      const tip = at(c * side, 0.9);
      const mid = at(c * side * 0.92, 0.45);
      veins += ` M50 ${f(o.cy)} Q${f(mid[0])} ${f(mid[1])} ${f(tip[0])} ${f(tip[1])}`;
    }
  }
  return { outline: mirrored(right), veins, aspect: 0.95 };
}
export const LEAF_ART: Record<LeafShape, LeafArt> = {
  // a fig leaf is palmate: three to five broad lobes with deep rounded sinuses and a heart-shaped base
  // (the same outline family as the pressed fig leaf in the herbarium) — not the many shallow lobes of an oak
  fig: palmate({ cy: 68, R: 64, lobes: [[0, 1, 25], [54, 0.84, 22], [112, 0.6, 19]], base: 0.27, notch: 0.45 }),
  mulberry: {
    outline: mirrored([[50, 86], [55, 94], [66, 97], [80, 91], [90, 76], [93, 58], [88, 38], [76, 21], [62, 9], [50, 1]]),
    veins: 'M50 88 L50 8 M50 76 C60 70 72 64 84 62 M50 76 C40 70 28 64 16 62 M50 54 C58 48 68 42 78 38 M50 54 C42 48 32 42 22 38 M50 34 C56 30 62 26 68 22 M50 34 C44 30 38 26 32 22',
    aspect: 0.9,
  },
  olive: {
    outline: mirrored([[50, 100], [54, 91], [58, 72], [60, 50], [59, 30], [55.5, 13], [50, 0]]),
    veins: 'M50 98 L50 6',
    aspect: 0.2,
  },
  almond: {
    outline: mirrored([[50, 100], [55, 92], [61.5, 74], [64, 53], [61.5, 31], [56, 12], [50, 0]]),
    veins: 'M50 98 L50 6 M50 70 L60 60 M50 70 L40 60 M50 48 L59 39 M50 48 L41 39',
    aspect: 0.3,
  },
  pomegranate: {
    outline: mirrored([[50, 100], [56, 90], [62.5, 70], [64.5, 48], [62, 26], [57, 9], [50, 2]]),
    veins: 'M50 98 L50 8',
    aspect: 0.3,
  },
  carob: {
    outline: [
      ellipsePath(31, 71, 17, 12.5, -0.25), ellipsePath(69, 71, 17, 12.5, 0.25),
      ellipsePath(33, 36, 15.5, 11.5, -0.35), ellipsePath(67, 36, 15.5, 11.5, 0.35),
    ].join(' '),
    veins: 'M50 100 L50 22 M50 74 L18 68 M50 74 L82 68 M50 40 L21 32 M50 40 L79 32',
    aspect: 0.85,
  },
};
/** first leaves of a seedling (two cotyledons) */
export const COTYLEDON: LeafArt = {
  outline: mirrored([[50, 100], [57, 86], [66, 62], [68, 40], [63, 18], [56, 5], [50, 2]]),
  veins: 'M50 98 L50 18',
  aspect: 0.36,
};
/** five-petal blossom (almond / olive) centred at 50,50 */
export const BLOSSOM = (() => {
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    d += ellipsePath(50 + Math.cos(a) * 21, 50 + Math.sin(a) * 21, 19, 15, a) + ' ';
  }
  return { outline: d.trim(), veins: 'M50 50 L50 42 M50 50 L57 47 M50 50 L43 47 M50 50 L54 57 M50 50 L46 57' };
})();
/** pomegranate bell flower, opening upward, base at 50,96 */
export const BELL = {
  outline: 'M50 96 C40 94 34 84 34 70 C34 60 30 48 26 34 L36 42 L40 24 L48 40 L50 18 L52 40 L60 24 L64 42 L74 34 C70 48 66 60 66 70 C66 84 60 94 50 96Z',
  veins: 'M42 76 C44 66 44 56 42 46 M58 76 C56 66 56 56 58 46',
};
/** grass tuft (strokes only), base at the bottom */
export const GRASS = 'M50 100 C48 80 42 66 30 54 M50 100 C51 78 55 60 62 44 M50 100 C47 84 46 70 48 52 M50 100 C54 86 62 76 74 70 M50 100 C46 90 38 84 26 80';

/** fruit drawings for the SVG renderer (viewBox 0 0 100 100, centred, hanging point at the top) */
export const FRUIT_ART: Record<FruitShape, string> = {
  fig: 'M50 8 C42 10 40 22 34 34 C24 52 26 82 50 90 C74 82 76 52 66 34 C60 22 58 10 50 8Z M50 8 L52 1',
  round: 'M50 14 C26 14 12 34 12 56 C12 78 30 94 50 94 C70 94 88 78 88 56 C88 34 74 14 50 14Z M40 15 L42 4 L47 11 L50 2 L53 11 L58 4 L60 15',
  olive: 'M50 10 C34 10 26 32 26 52 C26 74 36 92 50 92 C64 92 74 74 74 52 C74 32 66 10 50 10Z',
  pod: 'M46 4 C56 22 62 50 58 74 C56 86 50 96 42 98 C46 84 48 70 46 52 C44 34 40 18 46 4Z',
  almond: 'M50 8 C34 14 26 36 28 58 C30 78 40 92 50 94 C62 90 72 74 72 54 C72 32 64 14 50 8Z M50 12 C46 34 46 62 50 90',
  berry: 'M50 8 C38 10 32 26 32 46 C32 70 40 92 50 92 C60 92 68 70 68 46 C68 26 62 10 50 8Z M42 34 l.1 0 M56 30 l.1 0 M46 52 l.1 0 M58 56 l.1 0 M44 72 l.1 0 M54 78 l.1 0',
};
