/* Small shared helpers for the tree scene: seeded RNG, value noise, vector & colour math.
   No three.js here — this module is part of the light SVG path (LCP). */

export type V3 = [number, number, number];
export type RGB = [number, number, number]; // 0..1 sRGB

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** frame-rate independent exponential approach */
export const damp = (cur: number, target: number, lambda: number, dt: number) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private r: () => number;
  constructor(seed: number) { this.r = mulberry32(seed); }
  next() { return this.r(); }
  range(a: number, b: number) { return a + (b - a) * this.r(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  sign() { return this.r() < 0.5 ? -1 : 1; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.r() * arr.length)]; }
  /** approx. normal distribution */
  gauss() { return (this.r() + this.r() + this.r() + this.r() - 2) * 0.866; }
  /** random unit vector */
  dir(): V3 {
    const z = this.range(-1, 1), a = this.range(0, TAU), s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), z, s * Math.sin(a)];
  }
}

/** stable hash → 0..1 */
export function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
/** 1D smooth value noise, roughly -1..1 */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 17.13), b = hash1(i + 1 + seed * 17.13);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}
/** 2D smooth value noise, roughly -1..1 */
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
/** periodic noise on a circle (angle in radians) */
export function noiseAngle(a: number, freq: number, seed: number): number {
  return noise2(Math.cos(a) * freq + seed * 3.1, Math.sin(a) * freq + seed * 1.7);
}

/* ---------------- vectors (tuples, allocation-light) ---------------- */
export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mixV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ---------------- colour ---------------- */
export function hex(c: string): RGB {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const mixC = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const mulC = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s];
export function css(c: RGB, a = 1): string {
  const r = Math.round(clamp(c[0]) * 255), g = Math.round(clamp(c[1]) * 255), b = Math.round(clamp(c[2]) * 255);
  return a >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Math.round(clamp(a) * 1000) / 1000})`;
}
export function hexOf(c: RGB): string {
  return '#' + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
}

/** brand tokens (mirror of src/styles/tokens.css) + a few illustration tints mixed from them */
export const P = {
  cream: hex('#FBF1E6'),
  sand: hex('#EDE5D4'),
  olive: hex('#8F8E45'),
  oliveDeep: hex('#626630'),
  bark: hex('#6B4A2E'),
  soil: hex('#2A2118'),
  moss: hex('#232E1C'),
  sage: hex('#C9CFA0'),
  fruit: hex('#B4492E'),
};
export const TINT = {
  /** autumn ochre / amber (sand + fruit + olive) */
  ochre: mixC(mixC(P.sand, P.olive, 0.5), [0.86, 0.66, 0.22], 0.42),
  amber: mixC(mixC(P.sand, [0.8, 0.52, 0.2], 0.62), P.bark, 0.08),
  rust: mixC(P.fruit, P.bark, 0.45),
  barkLight: mixC(P.bark, P.sand, 0.58),
  barkGrey: mixC(mixC(P.bark, P.sand, 0.55), P.sage, 0.25),
  humus: mixC(P.soil, P.bark, 0.42),
  clay: mixC(mixC(P.bark, P.sand, 0.42), P.fruit, 0.16),
  stones: mixC(P.sand, P.bark, 0.16),
  grass: mixC(P.sage, P.sand, 0.4),
  brass: mixC(mixC(P.sand, P.olive, 0.35), P.fruit, 0.12),
  blossom: mixC(P.cream, P.fruit, 0.1),
  glow: mixC(P.cream, hex('#F2D9A0'), 0.6),
};

export const isFiniteNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
