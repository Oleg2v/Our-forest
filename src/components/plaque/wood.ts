/* ==========================================================================
   Procedural wood for the engraved plaque — warm cedar/oak plank in the
   brand "leaf" shape (two opposite rounded corners), sanded darker edges,
   a soft bevel, one knot, two brass screws. Generated once per size into an
   offscreen canvas and cached (the /tree 3D scene reuses the same canvas as
   a texture, so the plank looks identical everywhere).
   ========================================================================== */

export type WoodTone = 'warm' | 'memorial';
export interface WoodOptions {
  seed?: number;
  tone?: WoodTone;
  /** draw the two brass screws (default true) */
  screws?: boolean;
}

/** Width / height of every plaque (the canvas should use the same aspect). */
export const PLAQUE_ASPECT = 2.4;

const PALETTE: Record<WoodTone, { base: number[]; dark: number[]; fiber: number[] }> = {
  warm: { base: [214, 170, 118], dark: [158, 104, 58], fiber: [126, 80, 44] },
  memorial: { base: [196, 164, 128], dark: [140, 108, 78], fiber: [112, 86, 62] },
};

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small seeded 2D value noise (smoothstep interpolation) + fbm. */
function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const perm = new Uint16Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  // the hash folded into one 256 × 256 lattice: lat[X·256 + Y] = vals[perm[perm[X] + Y]], and both axes wrap at
  // 256 exactly as the doubled perm table did, so every sample is the same number as before from 4 direct reads
  // instead of 12 chained ones
  const lat = new Float32Array(65536);
  for (let X = 0; X < 256; X++) { const px = perm[X]; for (let Y = 0; Y < 256; Y++) lat[(X << 8) | Y] = vals[perm[px + Y]]; }
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X0 = (xi & 255) << 8, X1 = ((xi + 1) & 255) << 8, Y0 = yi & 255, Y1 = (yi + 1) & 255;
    const a = lat[X0 | Y0], b = lat[X1 | Y0];
    const c = lat[X0 | Y1], d = lat[X1 | Y1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number, oct = 4) => {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * noise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  };
  return { noise, fbm, rnd, lat };
}

/** Signed distance to the leaf-shaped plank (negative inside). Radii: big on top-left & bottom-right. */
export function plaqueShapePath(ctx: CanvasRenderingContext2D | Path2D, w: number, h: number, inset = 0) {
  const R = h * 0.3, r = h * 0.06;
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const p = ctx as CanvasRenderingContext2D;
  p.moveTo(x0 + R, y0);
  p.lineTo(x1 - r, y0); p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - R); p.quadraticCurveTo(x1, y1, x1 - R, y1);
  p.lineTo(x0 + r, y1); p.quadraticCurveTo(x0, y1, x0, y1 - r);
  p.lineTo(x0, y0 + R); p.quadraticCurveTo(x0, y0, x0 + R, y0);
  p.closePath();
}

function sdf(x: number, y: number, w: number, h: number): number {
  const R = h * 0.3, r = h * 0.06;
  const cx = w / 2, cy = h / 2;
  const left = x < cx, top = y < cy;
  // big radius on top-left and bottom-right corners (the leaf)
  const rad = (left && top) || (!left && !top) ? R : r;
  const px = Math.abs(x - cx) - (w / 2 - rad);
  const py = Math.abs(y - cy) - (h / 2 - rad);
  const ox = Math.max(px, 0), oy = Math.max(py, 0);
  return Math.min(Math.max(px, py), 0) + Math.sqrt(ox * ox + oy * oy) - rad;
}

const cache = new Map<string, HTMLCanvasElement>();

/** (½ + ½·sin 2πt)⁵ over one period, read with linear interpolation (off by < 2e-6) — a sine per pixel was the
    biggest single cost of the plank */
const RING_N = 4096;
const RING = new Float64Array(RING_N + 1);
for (let i = 0; i <= RING_N; i++) { const s = 0.5 + 0.5 * Math.sin((i / RING_N) * Math.PI * 2); RING[i] = s * s * s * s * s; }
/** the knot's weight exp(-26·kd²) for kd² in [0, KNOT_R2] (linear interpolation, off by < 4e-6) */
const KNOT_R2 = 0.42, KNOT_N = 2048, KNOT_S = KNOT_N / KNOT_R2;
const KNOT = new Float64Array(KNOT_N + 2);
for (let i = 0; i <= KNOT_N + 1; i++) KNOT[i] = Math.exp(-26 * (i / KNOT_S));

/**
 * Wood plank texture (w × h backing pixels; keep w/h ≈ PLAQUE_ASPECT).
 * Transparent outside the leaf shape. Cached by size + seed + tone.
 */
export function createWoodTexture(w: number, h: number, opts: WoodOptions = {}): HTMLCanvasElement {
  const seed = opts.seed ?? 427;
  const tone = opts.tone ?? 'warm';
  const screws = opts.screws ?? true;
  w = Math.max(32, Math.round(w)); h = Math.max(16, Math.round(h));
  const key = `${w}x${h}:${seed}:${tone}:${screws}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; } // most recently used last

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const { fbm, rnd, lat } = makeNoise(seed);
  const pal = PALETTE[tone];
  const phase = rnd() * 6.28;
  // one knot, kept away from the text area (near a short edge)
  const kx = (rnd() < 0.5 ? 0.16 : 0.84) * (w / h), ky = 0.25 + rnd() * 0.5;
  const ringFreq = 5.5 + rnd() * 2.5;
  const edgeW = h * 0.07;
  const bevel = Math.max(1.5, h * 0.018);
  const TAU = Math.PI * 2;

  /* The two slow fields — the warp that bends the growth rings (4 octaves) and the large tonal variation
     (3 octaves) — were 7 of the 10 noise samples per pixel. Their finest detail is ~1/20 of the plank's
     height, so they are sampled on a grid of G px (≥ 7 nodes per finest cell) and interpolated: a big phone
     plank (1440 × 600) costs about a third of what it did, and the colours move by about one level of 255.
     Small planks (h < 300) keep the exact per-pixel samples (G = 1). */
  const G = Math.max(1, Math.floor(h / 100));
  const gw = Math.floor((w - 1) / G) + 2, gh = Math.floor((h - 1) / G) + 2;
  const warpG = new Float64Array(gw * gh), toneG = new Float64Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const sy = (gy * G) / h;
    for (let gx = 0; gx < gw; gx++) {
      const sx = (gx * G) / h;
      warpG[gy * gw + gx] = fbm(sx * 0.9 + 3.1, sy * 2.4, 4);
      toneG[gy * gw + gx] = fbm(sx * 0.5 + 9.2, sy * 0.9 + 1.3, 3) - 0.5;
    }
  }
  // per column: grid cell, weight and the slow sine sway of the rings
  const colI = new Int32Array(w), colF = new Float64Array(w), sway = new Float64Array(w);
  for (let x = 0; x < w; x++) { colI[x] = Math.floor(x / G); colF[x] = (x - colI[x] * G) / G; sway[x] = 0.22 * Math.sin((x / h) * 1.7 + phase); }
  const warpRow = new Float64Array(gw), toneRow = new Float64Array(gw);
  /* the three fine fields (fibres, pores, darker fibres) are single noise samples at (x·fx/h, y·fy/h): along a row
     their lattice row and its weight never change, so each row first blends the two lattice rows once (257
     values per field), and a pixel is one lerp between two of them (the same sum, regrouped) */
  const fine = [[34, 210], [140, 900], [8, 120]].map(([fx, fy]) => {
    const xi = new Uint8Array(w), u = new Float64Array(w);
    for (let x = 0; x < w; x++) { const xv = (x / h) * fx, f = Math.floor(xv), t = xv - f; xi[x] = f & 255; u[x] = t * t * (3 - 2 * t); }
    return { fy, xi, u, row: new Float64Array(257) };
  });
  const blendRow = (F: (typeof fine)[number], sy: number) => {
    const yv = sy * F.fy, yi = Math.floor(yv), t = yv - yi, v = t * t * (3 - 2 * t);
    const Y0 = yi & 255, Y1 = (yi + 1) & 255, row = F.row;
    for (let X = 0; X < 256; X++) { const a = lat[(X << 8) | Y0]; row[X] = a + (lat[(X << 8) | Y1] - a) * v; }
    row[256] = row[0];
  };
  const [FIB, POR, FIB2] = fine;
  const [bR, bG, bB] = pal.base, [fR, fG, fB] = pal.fiber;
  const dR = pal.dark[0] - bR, dG = pal.dark[1] - bG, dB = pal.dark[2] - bB;

  for (let y = 0; y < h; y++) {
    const sy = y / h;
    const gy = Math.floor(y / G), fy = (y - gy * G) / G, o0 = gy * gw, o1 = o0 + gw;
    for (let gx = 0; gx < gw; gx++) {
      warpRow[gx] = warpG[o0 + gx] + (warpG[o1 + gx] - warpG[o0 + gx]) * fy;
      toneRow[gx] = toneG[o0 + gx] + (toneG[o1 + gx] - toneG[o0 + gx]) * fy;
    }
    blendRow(FIB, sy); blendRow(POR, sy); blendRow(FIB2, sy);
    const dy = (sy - ky) * 2.4, dy2 = dy * dy;
    const rowBase = sy * ringFreq;
    for (let x = 0; x < w; x++) {
      const d = sdf(x + 0.5, y + 0.5, w, h);
      const i = (y * w + x) * 4;
      if (d > 1) continue; // transparent (ImageData starts at 0)
      const sx = x / h;
      const ci = colI[x], cf = colF[x];
      // growth rings run along the plank, warped by low-frequency noise
      const warp = warpRow[ci] + (warpRow[ci + 1] - warpRow[ci]) * cf;
      let r = rowBase + warp * 2.6 + sway[x];
      // knot: rings bend into tight ellipses around it. Its weight exp(-26·kd²) comes from a table; past
      // kd² = KNOT_R2 it is below 2e-5 and moves the colour by less than 1/20 of a level, so it is left out there
      const dx = (sx - kx) * 1.15;
      const kd2 = dx * dx + dy2;
      let kf = 0;
      if (kd2 < KNOT_R2) {
        const kt = kd2 * KNOT_S, ki = kt | 0;
        kf = KNOT[ki] + (KNOT[ki + 1] - KNOT[ki]) * (kt - ki);
        r = r * (1 - kf) + (Math.sqrt(kd2) * 9 + 0.3) * kf;
      }
      // ring = (½ + ½·sin 2πr)⁵, from a table over one period
      const rt = (r - Math.floor(r)) * RING_N, ri = rt | 0;
      const ring = RING[ri] + (RING[ri + 1] - RING[ri]) * (rt - ri);
      let xi = FIB.xi[x], e = FIB.row[xi];
      const fiber = e + (FIB.row[xi + 1] - e) * FIB.u[x];
      xi = POR.xi[x]; e = POR.row[xi];
      const pores = e + (POR.row[xi + 1] - e) * POR.u[x];
      const toneVar = toneRow[ci] + (toneRow[ci + 1] - toneRow[ci]) * cf;
      let k = ring * 0.62 + fiber * 0.16 + (pores > 0.8 ? (pores - 0.8) * 1.1 : 0) + kf * 0.35;
      k = Math.min(1, Math.max(0, k));
      let R0 = bR + dR * k;
      let G0 = bG + dG * k;
      let B0 = bB + dB * k;
      // fine darker fibres
      xi = FIB2.xi[x]; e = FIB2.row[xi];
      const f2 = Math.max(0, e + (FIB2.row[xi + 1] - e) * FIB2.u[x] - 0.62) * 0.9;
      R0 += (fR - R0) * f2; G0 += (fG - G0) * f2; B0 += (fB - B0) * f2;
      // large tonal variation (±7%)
      const tv = 1 + toneVar * 0.14;
      // sanded, slightly scorched edges
      const inside = -d;
      const edge = 0.8 + 0.2 * Math.min(1, inside / edgeW);
      // bevel: light from above
      let bev = 0;
      if (inside < bevel) {
        const ny = sdf(x + 0.5, y + 1.5, w, h) - sdf(x + 0.5, y - 0.5, w, h); // +: edge below
        bev = (1 - inside / bevel) * (ny > 0 ? -0.16 : 0.12);
      }
      const m = tv * edge * (1 + bev);
      data[i] = Math.min(255, R0 * m);
      data[i + 1] = Math.min(255, G0 * m);
      data[i + 2] = Math.min(255, B0 * m);
      data[i + 3] = d > 0 ? Math.round(255 * (1 - d)) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  if (screws) {
    const sr = h * 0.042;
    for (const sx of [h * 0.2, w - h * 0.2]) {
      const sy = sx < w / 2 ? h * 0.78 : h * 0.22; // diagonal, inside the small-radius corners
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, sr * 1.35, 0, TAU);
      ctx.fillStyle = 'rgba(70,42,20,0.28)'; ctx.fill();
      const g = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.35, sr * 0.1, sx, sy, sr);
      g.addColorStop(0, tone === 'memorial' ? '#C9B48A' : '#D8B978');
      g.addColorStop(1, tone === 'memorial' ? '#7E6A48' : '#8A6A32');
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fillStyle = g; ctx.fill();
      const a = rnd() * Math.PI;
      ctx.strokeStyle = 'rgba(52,34,14,0.75)'; ctx.lineWidth = Math.max(1, sr * 0.24); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(a) * sr * 0.62, sy - Math.sin(a) * sr * 0.62);
      ctx.lineTo(sx + Math.cos(a) * sr * 0.62, sy + Math.sin(a) * sr * 0.62);
      ctx.stroke();
      ctx.restore();
    }
  }
  cache.set(key, c);
  // least recently used planks go first, beyond 12 of them or 6 Mpx (24 MB) in all; a plank in use is touched on
  // every draw, so it stays (/plant's plank made ahead for the phone plaque step survives a fold of the stage)
  let px = 0;
  for (const v of cache.values()) px += v.width * v.height;
  for (const [k, v] of cache) {
    if (cache.size <= 12 && px <= 6e6) break;
    if (v === c) continue;
    cache.delete(k); px -= v.width * v.height;
  }
  return c;
}

/** Charred-ink pattern tile (dark, slightly uneven) used to fill burned letters. */
let inkTile: HTMLCanvasElement | null = null;
export function charTile(): HTMLCanvasElement {
  if (inkTile) return inkTile;
  const s = 96;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  const { noise } = makeNoise(91);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = noise(x * 0.18, y * 0.9) * 0.6 + noise(x * 0.6, y * 0.6) * 0.4;
    const i = (y * s + x) * 4;
    img.data[i] = 34 + n * 30; img.data[i + 1] = 20 + n * 18; img.data[i + 2] = 11 + n * 10; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  inkTile = c;
  return c;
}
