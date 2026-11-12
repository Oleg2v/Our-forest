/* Canvas-drawn assets shared by both renderers: the brass QR token, paper grain for share images. */
import qrcode from 'qrcode-generator';
import { P, TINT, css, mixC } from './util';

/** small brass token with an engraved QR code to the tree page */
export function makeToken(url: string, size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const r = size / 2;
  // brass disc: flat metal, a darker rim and a soft brushed texture (no gloss)
  ctx.beginPath(); ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = css(TINT.brass); ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 90; i++) {
    const y = (i / 90) * size;
    ctx.strokeStyle = `rgba(${i % 3 ? '255,248,226' : '120,92,40'}, ${0.05 + (i % 5) * 0.012})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + Math.sin(i) * 2); ctx.lineTo(size, y - Math.cos(i * 1.3) * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = css(mixC(TINT.brass, P.bark, 0.55));
  ctx.beginPath(); ctx.arc(r, r, r - ctx.lineWidth / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = size * 0.01;
  ctx.strokeStyle = css(mixC(TINT.brass, P.bark, 0.35));
  ctx.beginPath(); ctx.arc(r, r, r * 0.86, 0, Math.PI * 2); ctx.stroke();
  // QR
  try {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const box = size * 0.56;
    const cell = box / n;
    const ox = r - box / 2, oy = r - box / 2;
    ctx.fillStyle = css(mixC(P.soil, P.bark, 0.25));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (qr.isDark(y, x)) ctx.fillRect(ox + x * cell, oy + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  } catch { /* no QR — token stays plain */ }
  // screw hole
  ctx.fillStyle = css(mixC(TINT.brass, P.soil, 0.6));
  ctx.beginPath(); ctx.arc(r, size * 0.1, size * 0.022, 0, Math.PI * 2); ctx.fill();
  return c;
}

let grainCache: HTMLCanvasElement | null = null;
/** tileable paper grain (multiply) */
export function paperGrain(): HTMLCanvasElement {
  if (grainCache) return grainCache;
  const c = document.createElement('canvas');
  c.width = c.height = 220;
  const ctx = c.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(220, 220);
    let s = 427;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 255 - Math.floor(rnd() * rnd() * 90);
      img.data[i] = v; img.data[i + 1] = v - 4; img.data[i + 2] = v - 10; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  grainCache = c;
  return c;
}
