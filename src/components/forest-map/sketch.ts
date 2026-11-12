/* Hand-drawn geometry helpers for the forest map: seeded RNG, Catmull-Rom curves,
   wobbly lines (a pen, not a ruler), scalloped tree crowns, hulls. All output is
   SVG path data in plan units. */
import type { Pt } from './plan';

export type Rand = () => number;

/** mulberry32 */
export function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();
export const pt = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

/** Catmull-Rom → cubic bezier path through points */
export function smooth(pts: readonly Pt[], closed = false, tension = 1): string {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2 && !closed) return `M${pt(pts[0])}L${pt(pts[1])}`;
  const get = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** subdivide a polyline every `step` units and push points sideways a little (pen wobble) */
export function wobble(pts: readonly Pt[], r: Rand, amp = 1.6, step = 34, closed = false): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.max(1, Math.round(len / step));
    const nx = -dy / len, ny = dx / len;
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const o = (r() - 0.5) * 2 * amp;
      out.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
    }
  }
  if (!closed) out.push([...pts[n - 1]] as Pt);
  return out;
}

/** a hand-drawn closed loop through polygon corners */
export function sketchLoop(poly: readonly Pt[], r: Rand, amp = 1.6, step = 40): string {
  return smooth(wobble(poly, r, amp, step, true), true, 0.9);
}
/** a hand-drawn open line */
export function sketchLine(pts: readonly Pt[], r: Rand, amp = 1.4, step = 36): string {
  return smooth(wobble(pts, r, amp, step, false), false, 0.9);
}

/** wobbly circle */
export function sketchCircle(cx: number, cy: number, rad: number, r: Rand, amp = 0.05, n = 0): string {
  const k = n || Math.max(8, Math.round(rad / 4));
  const a0 = r() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const a = a0 + (i / k) * Math.PI * 2;
    const rr = rad * (1 + (r() - 0.5) * 2 * amp);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smooth(pts, true);
}

/** rectangle corners (rotated, degrees) */
export function rectPts(cx: number, cy: number, w: number, h: number, rot = 0): Pt[] {
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
export function rectPath(cx: number, cy: number, w: number, h: number, rot: number, r: Rand, amp = 0.8): string {
  const p = rectPts(cx, cy, w, h, rot);
  // straight-ish sides: wobble each side lightly, keep the corners crisp
  let d = '';
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4];
    const m: Pt = [(a[0] + b[0]) / 2 + (r() - 0.5) * amp * 2, (a[1] + b[1]) / 2 + (r() - 0.5) * amp * 2];
    d += `${i === 0 ? 'M' : 'L'}${pt(a)}Q${pt(m)} ${pt(b)}`;
  }
  return `${d}Z`;
}

/** scalloped crown (top view of a tree), centred at 0,0 */
export function crown(rad: number, lobes: number, r: Rand, bulge = 1.2, irregular = 0.08): string {
  const a0 = r() * Math.PI * 2;
  const pts: { x: number; y: number; a: number }[] = [];
  for (let i = 0; i < lobes; i++) {
    const a = a0 + (i / lobes) * Math.PI * 2 + (r() - 0.5) * (Math.PI / lobes) * 0.5;
    const rr = rad * (1 + (r() - 0.5) * 2 * irregular);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, a });
  }
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < lobes; i++) {
    const p = pts[i], q = pts[(i + 1) % lobes];
    let a1 = q.a;
    if (a1 < p.a) a1 += Math.PI * 2;
    const am = (p.a + a1) / 2;
    const cr = rad * (bulge + (r() - 0.5) * 0.1);
    d += `Q${f(Math.cos(am) * cr)} ${f(Math.sin(am) * cr)} ${f(q.x)} ${f(q.y)}`;
  }
  return `${d}Z`;
}

/** short branch strokes from the trunk (plan symbol of a tree) */
export function branches(rad: number, r: Rand, n = 3): string {
  let d = '';
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
    const l = rad * (0.42 + r() * 0.16);
    const bend = (r() - 0.5) * 0.5;
    d += `M${f(Math.cos(a) * rad * 0.12)} ${f(Math.sin(a) * rad * 0.12)}Q${f(Math.cos(a + bend) * l * 0.6)} ${f(Math.sin(a + bend) * l * 0.6)} ${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}`;
  }
  return d;
}

/** convex hull (monotone chain) */
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
/** grow a convex polygon outward by d (approximation: along the bisectors) */
export function inflate(poly: Pt[], d: number): Pt[] {
  const n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
    const n1 = norm([p[1] - a[1], -(p[0] - a[0])]);
    const n2 = norm([b[1] - p[1], -(b[0] - p[0])]);
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    return [p[0] - m[0] * d, p[1] - m[1] * d] as Pt;
  });
}
function norm(v: Pt): Pt { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }

/** resample a closed polygon into evenly spaced points (for soft blobs) */
export function resample(poly: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return out;
}
