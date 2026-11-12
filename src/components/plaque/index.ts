/* ==========================================================================
   Wood plaque engraving — PUBLIC API (owned by the plant agent; reused by the
   /tree scene for the plaque in front of the trunk — same wood, same font).

   renderPlaque(canvas, text, { burnProgress, memorial })
       one static frame. burnProgress 0..1 = share of the characters already
       burned (1 = finished plaque). Resizes the canvas backing store to its
       CSS size × DPR unless width/height are given (offscreen canvases).

   createPlaqueEngraver(canvas, opts) → PlaqueEngraver
       the live "laser" controller: setText() burns new letters in real time
       (glowing dot, sparks, light smoke, cooling ember trail, charred letters),
       memorial mode = no sparks, softer and 1.5× slower. The RAF loop runs only
       while something moves. Reduced motion → final state, no animation.

   createPlaqueTexture(text, { width, memorial }) → HTMLCanvasElement
       finished plaque on an offscreen canvas (for THREE.CanvasTexture).

   Everything is drawn with Frank Ruhl Libre 500 — call plaqueFontReady()
   (or just let the engraver re-render when the font arrives).
   ========================================================================== */
import { createWoodTexture, charTile, plaqueShapePath, PLAQUE_ASPECT, type WoodTone } from './wood';

export { PLAQUE_ASPECT, createWoodTexture, plaqueShapePath };
export const PLAQUE_FONT_FAMILY = "'Frank Ruhl Libre', 'David Libre', 'Times New Roman', serif";
export const PLAQUE_MAX_CHARS = 40;

let fontPromise: Promise<void> | null = null;
/** Resolves when Frank Ruhl Libre 500 (Hebrew subset) is usable on canvas (≤ 2.5 s). */
export function plaqueFontReady(): Promise<void> {
  if (fontPromise) return fontPromise;
  const load = (document as any).fonts?.load?.(`500 48px 'Frank Ruhl Libre'`, 'אבגדהו 0123') as Promise<unknown> | undefined;
  fontPromise = Promise.race([
    (load ?? Promise.resolve()).then(() => undefined, () => undefined),
    new Promise<void>((r) => setTimeout(r, 2500)),
  ]);
  return fontPromise;
}

export interface PlaqueRenderOptions {
  /** 0..1 share of characters burned (default 1) */
  burnProgress?: number;
  /** memorial: muted wood, softer dot, no sparks */
  memorial?: boolean;
  /** ghost "pencil" text shown when text is empty */
  placeholder?: string;
  /** wood seed (same seed → same plank) */
  seed?: number;
  /** backing-store size in px; default = CSS size × DPR (DPR ≤ 2) */
  width?: number;
  height?: number;
  /** extra backing resolution multiplier (e.g. 1.25 if the canvas is scaled up with a transform) */
  resolution?: number;
  /** draw the glowing laser dot at the burn front (default: when 0 < burnProgress < 1) */
  laser?: boolean;
}

/* ---------------- text layout ---------------- */
interface Line { text: string; start: number; right: number; width: number; y: number; prefix: number[] }
interface Layout { lines: Line[]; font: string; size: number; total: number; w: number; h: number; key: string }

function fontStr(size: number) { return `500 ${size}px ${PLAQUE_FONT_FAMILY}`; }

function layoutText(ctx: CanvasRenderingContext2D, text: string, w: number, h: number): Layout {
  const maxW = w - h * 0.62; // keep clear of the screws
  const clean = text.replace(/\s+/g, ' ').trim();
  const measure = (s: string, size: number) => { ctx.font = fontStr(size); return ctx.measureText(s).width; };
  const fit = (lines: string[], cap: number) => {
    let size = cap;
    for (const l of lines) { const mw = measure(l, 100); if (mw > 0) size = Math.min(size, (maxW / mw) * 100); }
    return size;
  };
  let lines = [clean];
  let size = fit(lines, h * 0.34);
  if (size < h * 0.235 && clean.includes(' ')) {
    // two lines, split at the space closest to the middle
    const mid = clean.length / 2;
    let best = -1;
    for (let i = 0; i < clean.length; i++) if (clean[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    const two = [clean.slice(0, best), clean.slice(best + 1)];
    const s2 = fit(two, h * 0.25);
    if (s2 > size) { lines = two; size = s2; }
  }
  size = Math.max(8, size);
  ctx.font = fontStr(size);
  const lh = size * 1.18;
  const top = h / 2 - (lh * lines.length) / 2 + lh / 2 + size * 0.06;
  let start = 0;
  const out: Line[] = lines.map((t, i) => {
    const width = ctx.measureText(t).width;
    const prefix: number[] = [0];
    for (let k = 1; k <= t.length; k++) prefix.push(ctx.measureText(t.slice(0, k)).width);
    const line: Line = { text: t, start, right: w / 2 + width / 2, width, y: top + i * lh, prefix };
    start += t.length + (i < lines.length - 1 ? 1 : 0);
    return line;
  });
  return { lines: out, font: fontStr(size), size, total: Math.max(1, clean.length), w, h, key: `${clean}|${w}|${h}` };
}

/** x of the burn front for a given number of burned chars (fractional) — RTL: the front travels leftwards. */
function frontAt(L: Layout, burned: number): { line: number; x: number } | null {
  for (let i = 0; i < L.lines.length; i++) {
    const ln = L.lines[i];
    const local = burned - ln.start;
    if (local < ln.text.length + (i < L.lines.length - 1 ? 1 : 0)) {
      const k = Math.max(0, Math.min(ln.text.length, local));
      const ki = Math.floor(k), f = k - ki;
      const a = ln.prefix[ki], b = ln.prefix[Math.min(ki + 1, ln.text.length)];
      return { line: i, x: ln.right - (a + (b - a) * f) };
    }
  }
  return null;
}

/* ink extents per column (so the laser dot sits on the letters) */
function inkColumns(L: Layout): Array<Int16Array> {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(L.w)); c.height = Math.max(1, Math.round(L.h));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = L.font;
  ctx.fillStyle = '#000';
  const cols: Array<Int16Array> = [];
  for (const ln of L.lines) {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillText(ln.text, ln.right, ln.y);
    const y0 = Math.max(0, Math.floor(ln.y - L.size)), y1 = Math.min(c.height, Math.ceil(ln.y + L.size));
    const data = ctx.getImageData(0, y0, c.width, Math.max(1, y1 - y0)).data;
    const arr = new Int16Array(c.width * 2).fill(-1);
    const rows = y1 - y0;
    for (let x = 0; x < c.width; x++) {
      let mn = -1, mx = -1;
      for (let y = 0; y < rows; y++) if (data[(y * c.width + x) * 4 + 3] > 90) { if (mn < 0) mn = y; mx = y; }
      if (mn >= 0) { arr[x * 2] = mn + y0; arr[x * 2 + 1] = mx + y0; }
    }
    cols.push(arr);
  }
  return cols;
}

/* ---------------- drawing ---------------- */
interface Frame {
  burned: number;          // chars burned (fractional)
  heat: number;            // 0..1 global ember heat (cooling after the laser stops)
  laser: { x: number; y: number; on: boolean; flicker: number } | null;
  memorial: boolean;
  placeholder: string;
}

function drawPlaque(ctx: CanvasRenderingContext2D, L: Layout, wood: HTMLCanvasElement, f: Frame) {
  const { w, h } = L;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(wood, 0, 0, w, h);
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = L.font;

  const empty = L.lines.length === 1 && L.lines[0].text === '';
  if (empty) {
    if (f.placeholder) {
      const pl = layoutText(ctx, f.placeholder, w, h);
      ctx.save();
      ctx.font = pl.font; ctx.direction = 'rtl'; ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(70,44,24,0.22)';
      for (const ln of pl.lines) ctx.fillText(ln.text, ln.right, ln.y);
      ctx.restore();
    }
    return;
  }

  const front = frontAt(L, f.burned);
  const S = L.size;
  // clip = burned region
  ctx.save();
  ctx.beginPath();
  L.lines.forEach((ln, i) => {
    const top = ln.y - S, hgt = S * 2;
    if (!front || i < front.line) ctx.rect(0, top, w, hgt);
    else if (i === front.line) ctx.rect(front.x, top, w - front.x, hgt);
  });
  ctx.clip();
  // scorch halo
  ctx.save();
  ctx.shadowColor = f.memorial ? 'rgba(60,36,18,0.45)' : 'rgba(74,36,10,0.6)';
  ctx.shadowBlur = S * 0.16;
  ctx.fillStyle = 'rgba(92,52,24,0.55)';
  for (const ln of L.lines) ctx.fillText(ln.text, ln.right, ln.y);
  ctx.restore();
  // lower lip catching light → depth
  ctx.fillStyle = 'rgba(255,236,204,0.28)';
  for (const ln of L.lines) ctx.fillText(ln.text, ln.right, ln.y + Math.max(1, S * 0.03));
  // charred letters
  ctx.fillStyle = ctx.createPattern(charTile(), 'repeat') ?? '#2a170c';
  for (const ln of L.lines) ctx.fillText(ln.text, ln.right, ln.y);
  ctx.restore();

  // ember trail behind the front (cooling)
  if (f.heat > 0.01 && front !== null) {
    const ln = L.lines[front.line];
    const trail = S * 1.6;
    ctx.save();
    ctx.beginPath(); ctx.rect(front.x, ln.y - S, trail, S * 2); ctx.clip();
    const g = ctx.createLinearGradient(front.x, 0, front.x + trail, 0);
    const a = f.heat * (f.memorial ? 0.65 : 1);
    g.addColorStop(0, `rgba(255,214,140,${0.95 * a})`);
    g.addColorStop(0.18, `rgba(246,138,52,${0.8 * a})`);
    g.addColorStop(0.55, `rgba(178,62,22,${0.35 * a})`);
    g.addColorStop(1, 'rgba(120,30,10,0)');
    ctx.shadowColor = `rgba(255,120,40,${0.7 * a})`;
    ctx.shadowBlur = S * 0.18;
    ctx.fillStyle = g;
    ctx.fillText(ln.text, ln.right, ln.y);
    ctx.restore();
  } else if (f.heat > 0.01) {
    // finished: the last letters cool down
    const ln = L.lines[L.lines.length - 1];
    const x = ln.right - ln.width;
    const trail = S * 1.6 * f.heat;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 2, ln.y - S, trail + 2, S * 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + trail, 0);
    g.addColorStop(0, `rgba(246,138,52,${0.75 * f.heat})`);
    g.addColorStop(1, 'rgba(120,30,10,0)');
    ctx.fillStyle = g;
    ctx.fillText(ln.text, ln.right, ln.y);
    ctx.restore();
  }

  // laser dot
  if (f.laser?.on) {
    const { x, y, flicker } = f.laser;
    const r = S * (f.memorial ? 0.36 : 0.5) * (0.9 + flicker * 0.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,248,226,0.95)');
    g.addColorStop(0.12, 'rgba(255,214,140,0.85)');
    g.addColorStop(0.38, 'rgba(255,132,48,0.32)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,250,0.95)';
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, S * 0.035), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* ---------------- canvas sizing ---------------- */
function sizeCanvas(canvas: HTMLCanvasElement, o: { width?: number; height?: number; resolution?: number }) {
  if (o.width && o.height) {
    if (canvas.width !== o.width) canvas.width = o.width;
    if (canvas.height !== o.height) canvas.height = o.height;
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1) * (o.resolution ?? 1);
  const cw = canvas.clientWidth || 480;
  const ch = canvas.clientHeight || cw / PLAQUE_ASPECT;
  const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
}

/** wood at a quantised size (cheap resizes), scaled into the canvas */
function woodFor(w: number, h: number, seed: number, memorial: boolean) {
  const qw = Math.min(1600, Math.ceil(w / 160) * 160);
  return createWoodTexture(qw, Math.round(qw * (h / w)), { seed, tone: memorial ? 'memorial' : 'warm' });
}

/** One static frame of the plaque. */
export function renderPlaque(canvas: HTMLCanvasElement, text: string, opts: PlaqueRenderOptions = {}): void {
  sizeCanvas(canvas, opts);
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const L = layoutText(ctx, text, w, h);
  const p = Math.max(0, Math.min(1, opts.burnProgress ?? 1));
  const burned = p * L.total;
  const front = p < 1 ? frontAt(L, burned) : null;
  let laser: Frame['laser'] = null;
  if ((opts.laser ?? (p > 0 && p < 1)) && front) laser = { x: front.x, y: L.lines[front.line].y, on: true, flicker: 0.5 };
  drawPlaque(ctx, L, woodFor(w, h, opts.seed ?? 427, !!opts.memorial), {
    burned, heat: p < 1 && p > 0 ? 1 : 0, laser, memorial: !!opts.memorial, placeholder: opts.placeholder ?? '',
  });
}

/** Finished plaque on an offscreen canvas (e.g. for THREE.CanvasTexture). */
export function createPlaqueTexture(text: string, opts: { width?: number; memorial?: boolean; seed?: number } = {}): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const W = opts.width ?? 1024;
  renderPlaque(c, text, { width: W, height: Math.round(W / PLAQUE_ASPECT), memorial: opts.memorial, seed: opts.seed, burnProgress: 1 });
  return c;
}

/* ---------------- live engraver ---------------- */
export interface PlaqueEngraverOptions {
  memorial?: boolean;
  /** false → no animation, always the final state */
  motion?: boolean;
  placeholder?: string;
  seed?: number;
  /** fixed backing size (offscreen use, e.g. a 3D texture). Otherwise CSS size × DPR, tracked with ResizeObserver */
  width?: number;
  height?: number;
  resolution?: number;
  /** burn speed (chars per second) — memorial is 1.5× slower */
  charsPerSecond?: number;
  /** called after every drawn frame (set texture.needsUpdate = true here) */
  onRender?: () => void;
  /** called with each burned character (sound / haptics) */
  onBurnChar?: () => void;
}
export interface PlaqueEngraver {
  readonly canvas: HTMLCanvasElement;
  /** set the dedication; new characters burn in, deleted ones vanish */
  setText(text: string, opts?: { instant?: boolean }): void;
  getText(): string;
  setMemorial(on: boolean): void;
  setMotion(allowed: boolean): void;
  setPlaceholder(s: string): void;
  /** burn the whole text from `from` (0..1) to the end; resolves when done (immediately without motion) */
  burnAll(opts?: { from?: number; duration?: number }): Promise<void>;
  /** 0..1 */
  getProgress(): number;
  isBurning(): boolean;
  /** re-measure (call after a layout change if ResizeObserver is unavailable) */
  resize(): void;
  /** PNG data URL of the finished plaque (for print / share) */
  toDataURL(): string;
  destroy(): void;
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; age: number }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number }

export function createPlaqueEngraver(canvas: HTMLCanvasElement, opts: PlaqueEngraverOptions = {}): PlaqueEngraver {
  let memorial = !!opts.memorial;
  let motion = opts.motion ?? true;
  let placeholder = opts.placeholder ?? '';
  const seed = opts.seed ?? 427;
  const cps = opts.charsPerSecond ?? 13;
  const ctx = canvas.getContext('2d')!;
  let text = '';
  let L: Layout | null = null;
  let cols: Array<Int16Array> | null = null;
  let burned = 0;          // chars (fractional)
  let target = 0;
  let heat = 0;
  let raf = 0;
  let last = 0;
  let t = 0;
  let destroyed = false;
  let sparks: Spark[] = [];
  let puffs: Puff[] = [];
  let puffClock = 0;
  let lastChar = 0;
  let resolveAll: (() => void) | null = null;
  let fixedDuration = 0;

  const relayout = () => {
    sizeCanvas(canvas, opts);
    L = layoutText(ctx, text, canvas.width, canvas.height);
    cols = null; // lazily computed while burning
  };
  const speed = () => (memorial ? 1 / 1.5 : 1);

  const draw = (laser: Frame['laser']) => {
    if (!L) relayout();
    const wood = woodFor(canvas.width, canvas.height, seed, memorial);
    drawPlaque(ctx, L!, wood, { burned, heat, laser, memorial, placeholder });
    // smoke + sparks on top
    if (puffs.length) {
      ctx.save();
      for (const p of puffs) {
        const k = p.age / p.life;
        const a = (memorial ? 0.1 : 0.16) * Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - k);
        if (a <= 0) continue;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(118,106,96,${a})`);
        g.addColorStop(1, 'rgba(118,106,96,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (sparks.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const lw = Math.max(1, L!.size * 0.022);
      for (const s of sparks) {
        const k = s.age / s.life;
        ctx.strokeStyle = `rgba(255,${Math.round(230 - 120 * k)},${Math.round(150 - 120 * k)},${1 - k})`;
        ctx.lineWidth = lw * (1 - k * 0.6);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.022, s.y - s.vy * 0.022); ctx.stroke();
      }
      ctx.restore();
    }
    opts.onRender?.();
  };

  const laserPos = (): Frame['laser'] => {
    if (!L || burned >= target - 0.001) return null;
    const front = frontAt(L, burned);
    if (!front) return null;
    if (!cols) cols = inkColumns(L);
    const ln = L.lines[front.line];
    const col = cols[front.line];
    const xi = Math.max(0, Math.min(Math.round(front.x), col.length / 2 - 1));
    let y = ln.y;
    // look a few px around the front for ink and raster up/down across it (like a real engraver head)
    for (let dx = 0; dx < 6; dx++) {
      for (const xx of [xi + dx, xi - dx]) {
        const mn = col[xx * 2], mx = col[xx * 2 + 1];
        if (mn >= 0) { const tri = Math.abs(((t * 9) % 2) - 1); y = mn + (mx - mn) * tri; dx = 99; break; }
      }
    }
    return { x: front.x, y, on: true, flicker: Math.random() };
  };

  const tick = (now: number) => {
    raf = 0;
    if (destroyed) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    t += dt;
    if (!L) relayout();
    const S = L!.size;
    const sp = speed();
    // advance the burn front (catch up when typing fast)
    if (burned < target) {
      const lag = target - burned;
      const v = fixedDuration > 0 ? (L!.total / fixedDuration) : Math.max(cps, lag * 3.2);
      const before = burned;
      burned = Math.min(target, burned + v * dt * sp);
      heat = Math.min(1, heat + dt * 6);
      if (Math.floor(burned) !== Math.floor(before) && now - lastChar > 70) { lastChar = now; opts.onBurnChar?.(); }
    } else {
      heat = Math.max(0, heat - dt * 1.3 * sp);
      if (resolveAll) { const r = resolveAll; resolveAll = null; fixedDuration = 0; r(); }
    }
    const laser = laserPos();
    if (laser) {
      if (!memorial && Math.random() < 0.85) {
        const n = 1 + Math.floor(Math.random() * 2.4);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
          const v = S * (2 + Math.random() * 5.5);
          sparks.push({ x: laser.x, y: laser.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.22 + Math.random() * 0.45, age: 0 });
        }
      }
      puffClock += dt;
      if (puffClock > (memorial ? 0.11 : 0.07)) {
        puffClock = 0;
        puffs.push({ x: laser.x + (Math.random() - 0.5) * S * 0.2, y: laser.y - S * 0.1, vx: (Math.random() - 0.3) * S * 0.35, vy: -S * (0.5 + Math.random() * 0.5) * sp, r: S * 0.15, life: 1.2 + Math.random() * 0.8, age: 0 });
      }
    }
    const g = S * 7;
    sparks = sparks.filter((s) => { s.age += dt; s.vy += g * dt; s.x += s.vx * dt; s.y += s.vy * dt; return s.age < s.life; });
    puffs = puffs.filter((p) => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += S * 0.55 * dt; p.vx *= 0.99; return p.age < p.life; });
    draw(laser);
    if (burned < target || heat > 0.01 || sparks.length || puffs.length) raf = requestAnimationFrame(tick);
    else { last = 0; heat = 0; draw(null); }
  };
  const kick = () => { if (!raf && !destroyed) { last = 0; raf = requestAnimationFrame(tick); } };

  const finish = () => {
    burned = target; heat = 0; sparks = []; puffs = [];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    draw(null);
    if (resolveAll) { const r = resolveAll; resolveAll = null; fixedDuration = 0; r(); }
  };

  const ro = typeof ResizeObserver !== 'undefined' && !(opts.width && opts.height)
    ? new ResizeObserver(() => { const pw = canvas.width, ph = canvas.height; sizeCanvas(canvas, opts); if (canvas.width !== pw || canvas.height !== ph) { relayout(); if (!raf) draw(null); } })
    : null;
  ro?.observe(canvas);

  const onVis = () => { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } else if (!document.hidden && (burned < target || heat > 0)) kick(); };
  document.addEventListener('visibilitychange', onVis);

  // first paint + re-render once the font is there
  relayout(); draw(null);
  plaqueFontReady().then(() => { if (destroyed) return; relayout(); if (!raf) draw(null); });

  const api: PlaqueEngraver = {
    canvas,
    setText(next, o = {}) {
      next = next.slice(0, PLAQUE_MAX_CHARS * 2);
      const prev = text;
      if (next === prev) return;
      let common = 0;
      const a = prev.replace(/\s+/g, ' ').trim(), b = next.replace(/\s+/g, ' ').trim();
      while (common < a.length && common < b.length && a[common] === b[common]) common++;
      text = next;
      relayout();
      target = b.length;
      burned = Math.min(burned, common);
      if (o.instant || !motion || document.hidden) { finish(); return; }
      if (burned >= target) { draw(null); return; }
      kick();
    },
    getText: () => text,
    setMemorial(on) { if (memorial === on) return; memorial = on; if (on) sparks = []; if (!raf) draw(null); },
    setMotion(allowed) { motion = allowed; if (!allowed) finish(); },
    setPlaceholder(s) { placeholder = s; if (!raf) draw(null); },
    burnAll(o = {}) {
      if (!L) relayout();
      target = L!.total;
      if (!text.trim() || !motion) { finish(); return Promise.resolve(); }
      burned = Math.max(0, Math.min(1, o.from ?? 0)) * target;
      fixedDuration = o.duration ?? 0;
      return new Promise<void>((res) => { resolveAll = res; kick(); });
    },
    getProgress: () => (L && L.total ? Math.min(1, burned / L.total) : 1),
    isBurning: () => burned < target,
    resize() { relayout(); if (!raf) draw(null); },
    toDataURL() {
      const c = document.createElement('canvas');
      const W = Math.max(960, canvas.width);
      renderPlaque(c, text, { width: W, height: Math.round(W / PLAQUE_ASPECT), memorial, seed, placeholder });
      return c.toDataURL('image/png');
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
  return api;
}

export type { WoodTone };
