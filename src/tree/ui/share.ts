/* ==========================================================================
   "שתפו את העץ" (7.10): a 9:16 picture for WhatsApp status / stories and a 1:1 square,
   made on a canvas from the current view of the tree (scene.snapshot), the dedication and
   the date — Frank Ruhl on cream paper. Web Share with files where possible, else download.
   The same renderer makes the page's OG image (1200×630).
   ========================================================================== */
import qrcode from 'qrcode-generator';
import { he } from '../../content/he';
import { ilDate } from '../../core/format';
import { track } from '../../core/analytics';
import { sound } from '../../core/sound';
import { SPECIES } from '../model';
import { icon } from './icons';
import { openSheet } from './sheet';
import type { Ctx } from './ctx';

export type ShareFormat = 'story' | 'square' | 'og';
const SIZES: Record<ShareFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080], og: [1200, 630] };

const C = { cream: '#FBF1E6', sand: '#EDE5D4', soil: '#2A2118', bark: '#6B4A2E', olive: '#8F8E45', oliveDeep: '#626630', sage: '#C9CFA0', moss: '#232E1C' };
const FR = "'Frank Ruhl Libre', 'David Libre', serif";
const HB = "'Heebo', 'Assistant', system-ui, sans-serif";

/** the public site (local dev / previews print the real address on images & QR codes) */
const SITE_HOST = 'ourforest.kikkey.com';
const isLocal = () => /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) || location.hostname.endsWith('.local');
export function treeUrl(id: string) { return isLocal() ? `https://${SITE_HOST}/tree/${id}` : `${location.origin}/tree/${id}`; }
const prettyUrl = (id: string) => `${isLocal() ? SITE_HOST : location.host}/tree/${id}`;

async function fontsReady() {
  const f = (document as any).fonts;
  if (!f?.load) return;
  await Promise.race([
    Promise.all([`300 64px ${FR}`, `400 64px ${FR}`, `500 64px ${FR}`, `300 30px ${HB}`, `400 30px ${HB}`, `500 30px ${HB}`].map((s) => f.load(s, 'אבג 0123').catch(() => null))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

/** the brand leaf: two opposite rounded corners (top-left & bottom-right) */
function leaf(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x, y + h);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function grain(c: CanvasRenderingContext2D, w: number, h: number, a = 0.07) {
  const n = document.createElement('canvas');
  n.width = n.height = 160;
  const g = n.getContext('2d')!;
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 100;
    img.data[i] = v * 0.9; img.data[i + 1] = v * 0.8; img.data[i + 2] = v * 0.6; img.data[i + 3] = Math.random() * 255;
  }
  g.putImageData(img, 0, 0);
  const pat = c.createPattern(n, 'repeat');
  if (!pat) return;
  c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'multiply'; c.fillStyle = pat; c.fillRect(0, 0, w, h); c.restore();
}

function mark(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  // the logo leaf (24px icon scaled)
  c.save();
  c.translate(cx - s / 2, cy - s / 2);
  c.scale(s / 24, s / 24);
  c.strokeStyle = color; c.lineWidth = 1.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.stroke(new Path2D('M4 20A16 16 0 0 1 20 4A16 16 0 0 1 4 20Z'));
  c.stroke(new Path2D('M3 21L15.5 8.5'));
  c.restore();
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (c.measureText(text).width <= maxW || !text.includes(' ')) return [text];
  const words = text.split(' ');
  const mid = text.length / 2;
  let best = 1, bd = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - mid);
    if (d < bd) { bd = d; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function fitFont(c: CanvasRenderingContext2D, text: string, weight: number, family: string, max: number, min: number, maxW: number) {
  let size = max;
  c.font = `${weight} ${size}px ${family}`;
  const lines = () => wrap(c, text, maxW);
  while (size > min && (lines().length > 2 || lines().some((l) => c.measureText(l).width > maxW))) {
    size -= 2;
    c.font = `${weight} ${size}px ${family}`;
  }
  return { size, lines: lines() };
}

function qr(c: CanvasRenderingContext2D, url: string, x: number, y: number, size: number, color: string) {
  try {
    const q = qrcode(0, 'M');
    q.addData(url); q.make();
    const n = q.getModuleCount();
    const cell = size / n;
    c.fillStyle = color;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(x + k * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
  } catch { /* ignore */ }
}

export async function renderShare(ctx: Ctx, format: ShareFormat): Promise<HTMLCanvasElement> {
  await fontsReady();
  const [W, H] = SIZES[format];
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const t = ctx.tree;
  const sp = SPECIES[t.species] ?? SPECIES.fig;
  const memorial = ctx.demo.mode === 'memorial';
  c.fillStyle = memorial ? C.sand : C.cream;
  c.fillRect(0, 0, W, H);
  (c as any).direction = 'rtl';
  c.textBaseline = 'alphabetic';

  // frame for the tree view
  let fx: number, fy: number, fw: number, fh: number, fr: number;
  if (format === 'story') { fx = 84; fy = 300; fw = W - 168; fh = 1090; fr = 230; }
  else if (format === 'square') { fx = 64; fy = 64; fw = W - 128; fh = 690; fr = 170; }
  else { fx = 40; fy = 40; fw = 560; fh = H - 80; fr = 150; }
  let snap: HTMLCanvasElement | null = null;
  try { snap = await ctx.scene.snapshot(fw, fh); } catch { snap = null; }
  c.save();
  leaf(c, fx, fy, fw, fh, fr);
  c.clip();
  c.fillStyle = C.sand; c.fillRect(fx, fy, fw, fh);
  if (snap) c.drawImage(snap, fx, fy, fw, fh);
  c.restore();
  c.save();
  leaf(c, fx + 0.5, fy + 0.5, fw - 1, fh - 1, fr);
  c.strokeStyle = 'rgba(42,33,24,.16)'; c.lineWidth = 1.5; c.stroke();
  c.restore();

  const date = `ניטע ב־${ilDate(t.plantedAt)}`;
  const num = `${he.tree.number(t.id)} · ${sp.he}`;
  c.textAlign = 'center';
  if (format === 'story') {
    mark(c, W / 2, 132, 44, C.olive);
    c.fillStyle = C.soil; c.font = `500 34px ${HB}`; (c as any).letterSpacing = '3px';
    c.fillText(he.brand, W / 2, 206);
    (c as any).letterSpacing = '0px';
    c.fillStyle = C.oliveDeep; c.font = `400 28px ${HB}`;
    c.fillText(num, W / 2, 250);
    const ded = fitFont(c, t.dedication, 400, FR, 96, 56, W - 180);
    c.fillStyle = C.bark;
    ded.lines.forEach((l, i) => c.fillText(l, W / 2, 1520 + i * ded.size * 1.08));
    const y2 = 1520 + (ded.lines.length - 1) * ded.size * 1.08 + 76;
    c.fillStyle = 'rgba(42,33,24,.72)'; c.font = `300 32px ${HB}`;
    c.fillText(`${date} · ${he.brand}, ${he.place}`, W / 2, y2);
    // bottom: link + QR
    qr(c, treeUrl(t.id), W / 2 - 60, 1700, 120, C.soil);
    c.fillStyle = C.oliveDeep; c.font = `400 26px ${HB}`;
    (c as any).direction = 'ltr';
    c.fillText(prettyUrl(t.id), W / 2, 1864);
  } else if (format === 'square') {
    const ded = fitFont(c, t.dedication, 400, FR, 76, 44, W - 160);
    c.fillStyle = C.bark;
    ded.lines.forEach((l, i) => c.fillText(l, W / 2, 850 + i * ded.size * 1.06));
    const y2 = 850 + (ded.lines.length - 1) * ded.size * 1.06 + 62;
    c.fillStyle = 'rgba(42,33,24,.72)'; c.font = `300 28px ${HB}`;
    c.fillText(`${num} · ${date}`, W / 2, y2);
    c.fillStyle = C.oliveDeep; c.font = `500 24px ${HB}`; (c as any).letterSpacing = '2px';
    c.fillText(he.brand, W / 2 + 160, 1028);
    (c as any).letterSpacing = '0px';
    mark(c, W / 2 + 52, 1020, 28, C.olive);
    (c as any).direction = 'ltr'; c.font = `400 22px ${HB}`;
    c.fillText(prettyUrl(t.id), W / 2 - 150, 1028);
  } else {
    // OG: text column on the reading-start side (right)
    const x = W - 64;
    c.textAlign = 'right';
    c.fillStyle = C.oliveDeep; c.font = `400 26px ${HB}`;
    c.fillText(num, x, 150);
    const ded = fitFont(c, t.dedication, 400, FR, 76, 44, W - fw - 150);
    c.fillStyle = C.bark;
    ded.lines.forEach((l, i) => c.fillText(l, x, 250 + i * ded.size * 1.06));
    const y2 = 250 + (ded.lines.length - 1) * ded.size * 1.06 + 64;
    c.fillStyle = 'rgba(42,33,24,.72)'; c.font = `300 28px ${HB}`;
    c.fillText(`${date} · ${t.plantedBy}`, x, y2);
    c.fillStyle = C.soil; c.font = `400 26px ${HB}`;
    c.fillText(he.tree.how, x, y2 + 52);
    mark(c, x - 16, 545, 32, C.olive);
    c.fillStyle = C.soil; c.font = `500 26px ${HB}`; (c as any).letterSpacing = '2px';
    c.fillText(`${he.brand} · ${he.place}`, x - 46, 555);
    (c as any).letterSpacing = '0px';
  }
  grain(c, W, H, 0.06);
  return cv;
}

const toBlob = (cv: HTMLCanvasElement, type = 'image/png', q?: number) => new Promise<Blob | null>((r) => cv.toBlob(r, type, q));

/* ------------------------------------------------------------------ the sheet */
export function openShareSheet(ctx: Ctx) {
  const t = ctx.tree;
  const url = treeUrl(t.id);
  const memorial = ctx.demo.mode === 'memorial';
  const text = memorial ? `${t.dedication}. העץ שלנו ביער שלנו במושב פדיה:` : `${t.dedication}. העץ שלנו גדל ביער שלנו במושב פדיה. בואו לראות מה שלומו:`;
  const sh = openSheet({
    title: he.tree.shareTitle, eyebrow: he.tree.number(t.id), cls: 'tsheet--share',
    html: `
      <div class="tshare">
        <div class="tshare__seg" role="radiogroup" aria-label="גודל התמונה">
          <button class="chip" type="button" role="radio" aria-checked="true" data-f="story">סטטוס וסטורי <bdi>9:16</bdi></button>
          <button class="chip" type="button" role="radio" aria-checked="false" data-f="square">ריבוע <bdi>1:1</bdi></button>
        </div>
        <figure class="tshare__preview" data-preview data-f="story" aria-busy="true">
          <span class="tshare__wait">מכינים את התמונה…</span>
        </figure>
        <div class="tshare__actions">
          <button class="btn btn--lg" type="button" data-native hidden>${icon('share')}<span>${he.tree.buttons.share}</span></button>
          <button class="btn btn--lg" type="button" data-download>${icon('download')}<span>שומרים את התמונה</span></button>
          <a class="btn btn--outline" href="https://wa.me/" target="_blank" rel="noopener" data-share-wa>${icon('chat')}<span>${he.cta.whatsapp}</span></a>
          <button class="btn btn--outline" type="button" data-copy>${icon('link')}<span>מעתיקים קישור</span></button>
        </div>
      </div>`,
  });
  // wa.me with no phone → choose a contact
  const wa = sh.body.querySelector<HTMLAnchorElement>('[data-share-wa]')!;
  wa.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  wa.addEventListener('click', () => track('share_tree', { tree_id: t.id, method: 'whatsapp' }));
  let format: ShareFormat = 'story';
  let current: { blob: Blob; url: string } | null = null;
  let token = 0;
  const fig = sh.body.querySelector<HTMLElement>('[data-preview]')!;
  const nativeBtn = sh.body.querySelector<HTMLButtonElement>('[data-native]')!;
  const dlBtn = sh.body.querySelector<HTMLButtonElement>('[data-download]')!;
  const build = async () => {
    const my = ++token;
    fig.setAttribute('aria-busy', 'true');
    fig.dataset.f = format;
    const cv = await renderShare(ctx, format);
    const blob = await toBlob(cv, 'image/png');
    if (my !== token || !blob) return;
    if (current) URL.revokeObjectURL(current.url);
    current = { blob, url: URL.createObjectURL(blob) };
    fig.innerHTML = `<img src="${current.url}" alt="${t.dedication}, ${he.tree.number(t.id)}" width="${cv.width}" height="${cv.height}">`;
    fig.setAttribute('aria-busy', 'false');
    const file = new File([blob], `tree-${t.id}-${format}.png`, { type: 'image/png' });
    const canFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    nativeBtn.hidden = !canFiles;
    dlBtn.classList.toggle('btn--outline', canFiles);
  };
  sh.body.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) => {
    if (b.tagName !== 'BUTTON') return;
    b.addEventListener('click', () => {
      format = b.dataset.f as ShareFormat;
      sh.body.querySelectorAll('.tshare__seg [data-f]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      void build();
    });
  });
  nativeBtn.addEventListener('click', async () => {
    if (!current) return;
    const file = new File([current.blob], `tree-${t.id}-${format}.png`, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: he.tree.number(t.id), text: `${text} ${url}` });
      track('share_tree', { tree_id: t.id, method: 'native', format });
    } catch { /* cancelled */ }
  });
  dlBtn.addEventListener('click', () => {
    if (!current) return;
    const a = document.createElement('a');
    a.href = current.url; a.download = `tree-${t.id}-${format}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    sound.play('paper', { volume: 0.5 });
    track('share_tree', { tree_id: t.id, method: 'download', format });
    ctx.announce('התמונה נשמרה');
  });
  sh.body.querySelector('[data-copy]')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLElement;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    b.querySelector('span')!.textContent = 'הקישור הועתק';
    track('share_tree', { tree_id: t.id, method: 'link' });
    ctx.announce('הקישור הועתק');
  });
  sh.onClose(() => { if (current) URL.revokeObjectURL(current.url); });
  void build();
}
