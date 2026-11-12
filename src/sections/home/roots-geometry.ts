/* Geometry helpers for the roots section: seeded randomness, smooth organic paths
   (Catmull-Rom → cubic Bézier), length/depth lookup along a path, the soil surface. */

export interface P { x: number; y: number }

/** Deterministic PRNG (mulberry32) — the roots look the same on every visit. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}
export type Rand = ReturnType<typeof seeded>;

const f = (n: number) => Math.round(n * 10) / 10;

/** Smooth open path through points (uniform Catmull-Rom, tension 1 = classic). */
export function smoothPath(pts: P[], tension = 1): string {
  if (pts.length < 2) return '';
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** Smooth closed loop through points (pebbles). */
export function closedPath(pts: P[]): string {
  const n = pts.length;
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d}Z`;
}

/** An irregular little stone outline. */
export function pebble(cx: number, cy: number, r: number, rand: Rand): string {
  const n = 6;
  const rot = rand.range(0, Math.PI);
  const squash = rand.range(0.55, 0.85);
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = r * rand.range(0.82, 1.12);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * squash });
  }
  return closedPath(pts);
}

export interface Sample { l: number; x: number; y: number }

/** Our paths are M + C only (smoothPath / rootlet): flatten them into a fine polyline (24 steps per cubic). */
function flatten(d: string): P[] | null {
  const out: P[] = [];
  let cx = 0, cy = 0;
  const re = /([MC])([^MC]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const v = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    if (m[1] === 'M') {
      if (v.length !== 2) return null;
      cx = v[0]; cy = v[1]; out.push({ x: cx, y: cy });
      continue;
    }
    if (!v.length || v.length % 6) return null;
    for (let k = 0; k < v.length; k += 6) {
      const [x1, y1, x2, y2, x3, y3] = v.slice(k, k + 6);
      for (let i = 1; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        out.push({ x: a * cx + b * x1 + c * x2 + e * x3, y: a * cy + b * y1 + c * y2 + e * y3 });
      }
      cx = x3; cy = y3;
    }
  }
  return out.length > 1 ? out : null;
}

/** A rectangle the roots keep out of (e.g. a heading: a root running along under its letters reads as a mistake). */
export interface Keep { x0: number; x1: number; y: number }

/** How far (px) the smooth path through `pts` reaches up into the zone above keep.y between keep.x0 and keep.x1. */
export function intrudes(pts: P[], keep: Keep): number {
  const poly = flatten(smoothPath(pts));
  let need = 0;
  if (poly) for (const q of poly) if (q.x > keep.x0 && q.x < keep.x1 && q.y < keep.y) need = Math.max(need, keep.y - q.y);
  return need;
}

/** Lower the inner points of a smooth path (not its two ends) until the curve stays below `keep.y` wherever it is
    between keep.x0 and keep.x1. Points near the zone go down to its floor; the curve between them is re-checked
    and nudged again if it still bulges up into it. No randomness: the seeded sequence is never touched. */
export function keepBelow(pts: P[], keep: Keep): P[] {
  const out = pts.map((p) => ({ ...p }));
  const lead = 80; // a point just before the zone shapes the curve inside it too
  for (let k = 0; k < 6; k++) {
    const need = intrudes(out, keep);
    if (need < 0.5) break;
    for (let i = 1; i < out.length - 1; i++) {
      if (out[i].x > keep.x0 - lead && out[i].x < keep.x1 + lead) out[i].y = Math.max(out[i].y + (k ? need : 0), keep.y + 2);
    }
  }
  return out;
}

/** Sample a path into (length, x, y) triples, every ~step px of length.
    The browser's getPointAtLength walks the path again on every call — a few hundred calls were ~100 ms of a
    throttled phone's init. Our paths are flattened in JS instead (the same curve) and the lengths scaled to the
    browser's getTotalLength, the unit DrawSVG draws in. Anything unexpected falls back to the browser. */
export function samplePath(path: SVGPathElement, step = 6): { total: number; samples: Sample[] } {
  const total = path.getTotalLength();
  const n = Math.max(2, Math.ceil(total / step));
  const samples: Sample[] = [];
  const poly = flatten(path.getAttribute('d') || '');
  if (!poly) {
    for (let i = 0; i <= n; i++) {
      const l = (total * i) / n;
      const p = path.getPointAtLength(l);
      samples.push({ l, x: p.x, y: p.y });
    }
    return { total, samples };
  }
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
  const k = cum[cum.length - 1] > 0 ? total / cum[cum.length - 1] : 0;
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const l = (total * i) / n;
    const target = k ? l / k : 0;
    while (j < poly.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1];
    const t = seg > 0 ? Math.min(1, Math.max(0, (target - cum[j - 1]) / seg)) : 0;
    samples.push({ l, x: poly[j - 1].x + (poly[j].x - poly[j - 1].x) * t, y: poly[j - 1].y + (poly[j].y - poly[j - 1].y) * t });
  }
  return { total, samples };
}

/** Length at which the path first reaches depth y (paths here mostly descend). */
export function lengthAtY(samples: Sample[], y: number): number {
  if (y <= samples[0].y) return 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (b.y >= y) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.l + (b.l - a.l) * Math.min(1, Math.max(0, t));
    }
  }
  return samples[samples.length - 1].l;
}

/** Point + unit tangent at a length (from samples). */
export function pointAt(samples: Sample[], l: number): { p: P; t: P } {
  let i = samples.findIndex((s) => s.l >= l);
  if (i <= 0) i = 1;
  const a = samples[i - 1], b = samples[i];
  const k = b.l === a.l ? 0 : (l - a.l) / (b.l - a.l);
  const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { p, t: { x: dx / len, y: dy / len } };
}

/** A short fine rootlet leaving a root at point p (tangent t), on `side` (±1), drooping downwards. */
export function rootlet(p: P, t: P, side: number, len: number, rand: Rand): string {
  const n = { x: -t.y * side, y: t.x * side };
  let dx = n.x * 0.85 + t.x * 0.25;
  let dy = n.y * 0.85 + t.y * 0.25 + 0.55; // gravitropism
  const m = Math.hypot(dx, dy) || 1;
  dx /= m; dy /= m;
  const end = { x: p.x + dx * len, y: p.y + dy * len };
  const bend = rand.range(2, 6) * side;
  const mid = { x: p.x + dx * len * 0.5 + n.x * bend, y: p.y + dy * len * 0.5 + n.y * bend };
  return `M${f(p.x)} ${f(p.y)}Q${f(mid.x)} ${f(mid.y)} ${f(end.x)} ${f(end.y)}`;
}

/** The soil surface: wavy soil edge + line-art grass tufts. Returns SVG markup (width × height px). */
export function surfaceMarkup(width: number, height: number, rand: Rand, opts: { amp?: number; tufts?: number } = {}): string {
  const amp = opts.amp ?? 7;
  const base = height - amp - 4;
  const ph1 = rand.range(0, 6), ph2 = rand.range(0, 6);
  const yAt = (x: number) => base + Math.sin(x / 190 + ph1) * amp * 0.65 + Math.sin(x / 73 + ph2) * amp * 0.35;
  const pts: P[] = [];
  const step = 28;
  for (let x = -step; x <= width + step; x += step) pts.push({ x, y: yAt(x) });
  const edge = smoothPath(pts);
  const fill = `${edge}L${width + step} ${height + 2}L${-step} ${height + 2}Z`;
  // grass: small tufts of 2–4 blades rooted on the edge
  let grass = '';
  const gap = opts.tufts ?? 120;
  for (let x = rand.range(10, gap * 0.6); x < width - 6; x += rand.range(gap * 0.55, gap * 1.35)) {
    const gy = yAt(x) + 1;
    const blades = 2 + Math.floor(rand.next() * 3);
    for (let b = 0; b < blades; b++) {
      const bx = x + (b - blades / 2) * 3.2;
      const h = rand.range(9, 22) * (b === 1 ? 1.15 : 1);
      const lean = rand.range(-7, 7);
      grass += `M${f(bx)} ${f(gy)}Q${f(bx + lean * 0.2)} ${f(gy - h * 0.55)} ${f(bx + lean)} ${f(gy - h)}`;
    }
  }
  return `<svg viewBox="0 0 ${Math.round(width)} ${height}" width="${Math.round(width)}" height="${height}" preserveAspectRatio="none" focusable="false">`
    + `<path class="roots__surface-fill" d="${fill}"/>`
    + `<path class="roots__surface-edge" d="${edge}"/>`
    + `<path class="roots__grass" d="${grass}"/>`
    + `</svg>`;
}
