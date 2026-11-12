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
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = vals[perm[perm[X] + Y]], b = vals[perm[perm[X + 1] + Y]];
    const c = vals[perm[perm[X] + Y + 1]], d = vals[perm[perm[X + 1] + Y + 1]];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number, oct = 4) => {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * noise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  };
  return { noise, fbm, rnd };
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
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const { noise, fbm, rnd } = makeNoise(seed);
  const pal = PALETTE[tone];
  const phase = rnd() * 6.28;
  // one knot, kept away from the text area (near a short edge)
  const kx = (rnd() < 0.5 ? 0.16 : 0.84) * (w / h), ky = 0.25 + rnd() * 0.5;
  const ringFreq = 5.5 + rnd() * 2.5;
  const edgeW = h * 0.07;
  const bevel = Math.max(1.5, h * 0.018);
  const TAU = Math.PI * 2;

  for (let y = 0; y < h; y++) {
    const sy = y / h;
    for (let x = 0; x < w; x++) {
      const d = sdf(x + 0.5, y + 0.5, w, h);
      const i = (y * w + x) * 4;
      if (d > 1) { data[i + 3] = 0; continue; }
      const sx = x / h;
      // growth rings run along the plank, warped by low-frequency noise
      const warp = fbm(sx * 0.9 + 3.1, sy * 2.4, 4);
      let r = sy * ringFreq + warp * 2.6 + 0.22 * Math.sin(sx * 1.7 + phase);
      // knot: rings bend into tight ellipses around it
      const dx = (sx - kx) * 1.15, dy = (sy - ky) * 2.4;
      const kd = Math.sqrt(dx * dx + dy * dy);
      const kf = Math.exp(-kd * kd * 26);
      r = r * (1 - kf) + (kd * 9 + 0.3) * kf;
      const ring = Math.pow(0.5 + 0.5 * Math.sin(r * TAU), 5);
      const fiber = noise(sx * 34, sy * 210);
      const pores = noise(sx * 140, sy * 900);
      const toneVar = fbm(sx * 0.5 + 9.2, sy * 0.9 + 1.3, 3) - 0.5;
      let k = ring * 0.62 + fiber * 0.16 + (pores > 0.8 ? (pores - 0.8) * 1.1 : 0) + kf * 0.35;
      k = Math.min(1, Math.max(0, k));
      let R0 = pal.base[0] + (pal.dark[0] - pal.base[0]) * k;
      let G0 = pal.base[1] + (pal.dark[1] - pal.base[1]) * k;
      let B0 = pal.base[2] + (pal.dark[2] - pal.base[2]) * k;
      // fine darker fibres
      const f2 = Math.max(0, noise(sx * 8, sy * 120) - 0.62) * 0.9;
      R0 += (pal.fiber[0] - R0) * f2; G0 += (pal.fiber[1] - G0) * f2; B0 += (pal.fiber[2] - B0) * f2;
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
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  cache.set(key, c);
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
