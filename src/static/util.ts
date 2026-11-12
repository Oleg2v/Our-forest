/* Small shared helpers for the business / legal / credits / 404 pages (owned by the business agent). */
import { he, NBSP } from '../content/he';
import { ils } from '../core/format';
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';

export const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/** he.ts lookup by dotted path: "companies.packages.0.title" */
export function heGet(path: string): unknown {
  return path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), he);
}

/**
 * The HTML carries the verbatim copy (SEO, no-JS); this keeps it in sync with src/content/he.ts.
 * [data-he="path"] → textContent, [data-ils="path"] → "9,000 ₪" (NBSP) from a number.
 * Run before the chrome splits text for reveals.
 */
export function syncCopy(root: ParentNode = document) {
  qsa<HTMLElement>('[data-he]', root).forEach((el) => {
    const v = heGet(el.dataset.he!);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });
  qsa<HTMLElement>('[data-ils]', root).forEach((el) => {
    const v = heGet(el.dataset.ils!);
    if (typeof v !== 'number') return;
    // the shekel sign is drawn smaller than the Frank Ruhl numerals (NBSP stays inside the number)
    const [num, cur] = ils(v).split(NBSP);
    el.innerHTML = `${num}<span class="of-cur">${NBSP}${cur}</span>`;
  });
}

/**
 * Motion-only effects: built inside a gsap.context while motion is allowed, reverted when the
 * system / a11y panel turns motion off, rebuilt when it comes back. `build` may return a cleanup.
 */
export function whenMotion(build: () => void | (() => void)): () => void {
  let ctx: gsap.Context | null = null;
  let cleanup: void | (() => void);
  const up = () => {
    if (ctx) return;
    ctx = gsap.context(() => { cleanup = build(); });
  };
  const down = () => {
    if (!ctx) return;
    try { cleanup?.(); } catch { /* ignore */ }
    cleanup = undefined;
    ctx.revert();
    ctx = null;
  };
  if (env.motionAllowed()) up();
  const off = bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => (allowed ? up() : down()));
  return () => { off(); down(); };
}

/** rAF-debounced resize (width changes only on touch, so the URL bar does not rebuild layouts). */
export function onResize(fn: () => void): () => void {
  let raf = 0;
  let w = window.innerWidth;
  const h = () => {
    if (env.isTouch && window.innerWidth === w) return;
    w = window.innerWidth;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fn);
  };
  window.addEventListener('resize', h, { passive: true });
  return () => window.removeEventListener('resize', h);
}

/** Catmull-Rom spline through points → cubic Bézier path data. */
export function smoothPath(pts: { x: number; y: number }[], tension = 0.5): string {
  if (pts.length < 2) return '';
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const k = tension / 3;
    const c1x = p1.x + (p2.x - p0.x) * k, c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k, c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** Seeded RNG (mulberry32) — the same organic shapes on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
