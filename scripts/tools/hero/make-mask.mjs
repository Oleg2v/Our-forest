// Foliage mask for the hero wind shader ("painted mask": automatic foliage detection + hand-placed trunk strokes).
// usage: node make-mask.mjs <project-root> <config.json> <key> [debugPrefix]
// Pipeline: luminance → local detail energy (high-pass, blurred) → × (1 − painted trunks/wall) × (1 − wide smooth
// dark regions) × vertical fade (ground never moves) → dilate a little → blur → normalise → 8-bit grey PNG.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const [root, cfgPath, key, debug] = process.argv.slice(2);
const require = createRequire(root + '/package.json');
const sharp = require('sharp');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))[key];

const W = 640;
const { data, info } = await sharp(`${root}/${cfg.src}`).resize({ width: W }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const H = info.height, N = W * H;
const L = new Float32Array(N), G = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255;
  L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  G[i] = g - Math.max(r * 0.92, b);
}
function blur(src, sigma) {
  const r = Math.ceil(sigma * 3), k = []; let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(N), dst = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -r; i <= r; i++) a += src[y * W + Math.min(W - 1, Math.max(0, x + i))] * k[i + r]; tmp[y * W + x] = a; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -r; i <= r; i++) a += tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x] * k[i + r]; dst[y * W + x] = a; }
  return dst;
}
function morph(src, rad, op) {
  const tmp = new Float32Array(N), dst = new Float32Array(N), f = op === 'min' ? Math.min : Math.max, init = op === 'min' ? 1e9 : -1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = init; for (let i = -rad; i <= rad; i++) a = f(a, src[y * W + Math.min(W - 1, Math.max(0, x + i))]); tmp[y * W + x] = a; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = init; for (let i = -rad; i <= rad; i++) a = f(a, tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x]); dst[y * W + x] = a; }
  return dst;
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pct = (arr, p) => Float32Array.from(arr).sort()[Math.floor(arr.length * p)] || 1;

// 1) detail energy (leaves against light = lots of fine detail)
const Lb = blur(L, 1.4);
const hp = new Float32Array(N); for (let i = 0; i < N; i++) hp[i] = Math.abs(L[i] - Lb[i]);
const fine = blur(hp, 1.5);
const energy = blur(hp, 3);
const p92 = pct(energy, 0.92), pf = pct(fine, 0.9);

// 2) automatic "still": wide, smooth, not-bright regions (trunk interiors, shadows)
const smooth = new Float32Array(N);
for (let i = 0; i < N; i++) smooth[i] = (1 - ss(0.12, 0.45, fine[i] / pf)) * (1 - ss(0.35, 0.6, L[i]));
const wideSmooth = blur(morph(morph(smooth, 3, 'min'), 4, 'max'), 2.5);

// 3) painted "still" strokes (trunks, thick limbs, stone wall)
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/>`;
for (const s of cfg.still) svg += `<polyline points="${s.p.map(([x, y]) => `${(x * W).toFixed(1)},${(y * H).toFixed(1)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="${(s.w * W).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
for (const [x0, y0, x1, y1] of cfg.rects) svg += `<rect x="${x0 * W}" y="${y0 * H}" width="${(x1 - x0) * W}" height="${(y1 - y0) * H}" fill="#fff"/>`;
svg += '</svg>';
const paintedRaw = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
const painted0 = new Float32Array(N); for (let i = 0; i < N; i++) painted0[i] = paintedRaw[i] / 255;
const painted = blur(painted0, 3);

// 4) combine
const mask = new Float32Array(N);
for (let y = 0; y < H; y++) {
  const v = 1 - ss(cfg.gTop, cfg.gBot, y / H);
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const e = ss(0.15, 0.8, energy[i] / p92);
    const leafy = 0.8 + 0.2 * ss(-0.02, 0.06, G[i]);
    const flatSky = ss(0.82, 0.96, L[i]) * (1 - e);
    mask[i] = e * leafy * (1 - 0.7 * flatSky) * (1 - painted[i]) * (1 - 0.85 * wideSmooth[i]) * v;
  }
}
const m = blur(morph(mask, 2, 'max'), 4);
const p97 = pct(m, 0.975);
const outBuf = Buffer.alloc(N);
for (let i = 0; i < N; i++) outBuf[i] = Math.round(255 * Math.pow(Math.min(1, m[i] / p97), 0.75));

await sharp(outBuf, { raw: { width: W, height: H, channels: 1 } }).resize({ width: cfg.outW }).png({ compressionLevel: 9, palette: true, colours: 32, dither: 0 }).toFile(`${root}/${cfg.out}`);
console.log('mask', cfg.out, cfg.outW, Math.round(cfg.outW * H / W));

if (debug) {
  const rgb = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    const a = outBuf[i] / 255;
    rgb[i * 3] = Math.min(255, Math.round(data[i * 3] * (1 - 0.55 * a) + a * 230));
    rgb[i * 3 + 1] = Math.min(255, Math.round(data[i * 3 + 1] * (1 - 0.55 * a) + a * 60));
    rgb[i * 3 + 2] = Math.min(255, Math.round(data[i * 3 + 2] * (1 - 0.55 * a) + a * 40));
  }
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${debug}-overlay.png`);
  await sharp(outBuf, { raw: { width: W, height: H, channels: 1 } }).png().toFile(`${debug}-mask.png`);
}
