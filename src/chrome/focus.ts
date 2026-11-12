/* ==========================================================================
   Keyboard focus: one leaf-shaped contour that travels to the focused element
   (pills stay pills, leaf photos keep their leaf, everything else gets a small leaf).
   Only for :focus-visible (keyboard), never for mouse clicks. Colour follows the
   background: --fruit on light, --cream on dark (≥ 3:1 both ways).
   Fallback without JS: base.css outline (fruit, leaf corners).
   ========================================================================== */
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { isDarkAt, qs } from './util';

const root = document.documentElement;
let ring: HTMLElement | null = null;
let target: Element | null = null;
let visible = false;
let loop = 0;
let last = '';

export function initFocus() {
  ring = qs('[data-focus-ring]');
  if (!ring) return;
  root.classList.add('focus-ring-on');
  document.addEventListener('focusin', (e) => {
    const t = e.target as Element | null;
    if (!t || t === document.body || t === document.documentElement) { hide(); return; }
    let fv = false;
    try { fv = t.matches(':focus-visible'); } catch { fv = true; }
    if (!fv || t.closest('[data-focus-ring="none"]')) { hide(); return; }
    const fresh = !visible;
    target = t;
    place(!fresh);
    show();
  });
  document.addEventListener('focusout', () => requestAnimationFrame(() => {
    const a = document.activeElement;
    if (!a || a === document.body || !a.matches?.(':focus-visible')) hide();
  }));
  document.addEventListener('pointerdown', () => hide(), true);
  window.addEventListener('resize', () => visible && place(false), { passive: true });
  // the page colour changed under the ring (focus scrolled into a dark/light section)
  bus.on('theme:section', () => { if (visible) setTimeout(() => visible && place(false), 40); });
  // loaded lazily: the element focused before this module arrived gets the ring now
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement) {
    let fv = false;
    try { fv = a.matches(':focus-visible'); } catch { /* old engines */ }
    if (fv && !a.closest('[data-focus-ring="none"]')) { target = a; place(false); show(); }
  }
}

function show() {
  if (!ring) return;
  visible = true;
  ring.classList.add('is-visible');
  if (!loop) loop = requestAnimationFrame(follow);
}
function hide() {
  visible = false;
  target = null;
  ring?.classList.remove('is-visible');
  cancelAnimationFrame(loop); loop = 0; last = '';
}

/* while visible, follow the element (scroll, sticky headers, small animations) — stops when hidden */
function follow() {
  loop = 0;
  if (!visible || !target) return;
  if (!target.isConnected) { hide(); return; }
  place(false, true);
  loop = requestAnimationFrame(follow);
}

function shapeFor(t: Element, w: number, h: number, pad: number): string {
  const cs = getComputedStyle(t);
  const px = (v: string, base: number) => { const n = parseFloat(v) || 0; return v.trim().endsWith('%') ? (n / 100) * base : n; };
  const tl = px(cs.borderTopLeftRadius, w), tr = px(cs.borderTopRightRadius, w), br = px(cs.borderBottomRightRadius, w), bl = px(cs.borderBottomLeftRadius, w);
  const max = Math.max(tl, tr, br, bl);
  const inner = Math.min(w, h) - pad * 2;
  if (max >= inner / 2 - 1 && tl > 0 && tr > 0 && br > 0 && bl > 0) return `${h / 2}px`; // pill / circle
  if (max > 0 && (tl === 0 || tr === 0)) { // already a leaf → follow its corners
    const g = (r: number) => (r > 0 ? `${r + pad}px` : '2px');
    return `${g(tl)} ${g(tr)} ${g(br)} ${g(bl)}`;
  }
  const r = Math.max(10, Math.min(26, Math.min(w, h) * 0.32));
  return `${r}px 2px ${r}px 2px`; // a small leaf
}

function place(animate: boolean, quiet = false) {
  if (!ring || !target) return;
  const r = target.getBoundingClientRect();
  if (!r.width && !r.height) { if (!quiet) hide(); return; }
  const pad = target.matches('input, textarea, select') ? 3 : 5;
  const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
  const key = `${x | 0},${y | 0},${w | 0},${h | 0}`;
  if (quiet && key === last) return;
  last = key;
  const radius = quiet ? (ring.style.borderRadius || shapeFor(target, w, h, pad)) : shapeFor(target, w, h, pad);
  if (!quiet) {
    // probe just outside the ring (above, below, both sides) — majority wins
    const W = window.innerWidth, H = window.innerHeight;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const pts: [number, number][] = [[cx, r.top - pad - 2], [cx, r.bottom + pad + 2], [r.left - pad - 2, cy], [r.right + pad + 2, cy]];
    const skipRing = (n: Element) => !!n.closest('.focus-ring, .cursor') || n === target || target!.contains(n);
    let dark = 0, n = 0;
    for (const [px, py] of pts) {
      if (px < 1 || py < 1 || px > W - 1 || py > H - 1) continue;
      n++; if (isDarkAt(px, py, skipRing)) dark++;
    }
    ring.dataset.tone = (n ? dark / n > 0.5 : document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
  }
  if (animate && env.motionAllowed()) {
    gsap.to(ring, { x, y, width: w, height: h, borderRadius: radius, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
  } else if (quiet) {
    gsap.killTweensOf(ring, 'x,y,width,height');
    gsap.set(ring, { x, y, width: w, height: h });
  } else {
    gsap.killTweensOf(ring);
    gsap.set(ring, { x, y, width: w, height: h, borderRadius: radius });
  }
}
