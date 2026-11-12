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
import { isDarkAt, parseRGB, qs } from './util';

const root = document.documentElement;
let ring: HTMLElement | null = null;
let target: Element | null = null;
let visible = false;
let loop = 0;
let last = '';
/* wide screens (not phones, not landscape phones): a text link with no box of its own (nav links, the legal
   table of contents, links in running text) gets a little more air left and right — with the plain 5px the
   ring hugged the first and last letters while it stood ~20px clear above and below (44px tap height) */
const wideMQ = matchMedia('(min-width: 769px) and (min-height: 561px)');
let padFor: Element | null = null;
let padX = 0;
function sidePad(v: Element, pad: number): number {
  if (!wideMQ.matches || !v.matches('a, button, summary, [role="button"], [role="tab"]')) return pad;
  if (!v.textContent?.trim()) return pad; // icon buttons: the ring keeps their circle
  const cs = getComputedStyle(v);
  // (not the corner radius: base.css gives every :focus-visible element leaf corners for the outline fallback)
  const boxed = (parseFloat(cs.borderLeftWidth) || 0) > 0 || (parseRGB(cs.backgroundColor)?.[3] ?? 0) > 0;
  const inner = Math.min(parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0);
  return !boxed && inner < 4 ? pad + 6 - inner : pad;
}

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

/* what the ring goes around: a visually-hidden control (chip radios, custom checkboxes, /plant options)
   is a 1px box — the ring wraps its label / chip instead */
function visualOf(t: Element): Element {
  const r = t.getBoundingClientRect();
  if (r.width >= 4 && r.height >= 4 && !t.matches('.visually-hidden, .sr-only')) return t;
  const input = t as HTMLInputElement;
  const lab = input.labels?.[0] ?? t.closest('label') ?? (t.id ? document.querySelector(`label[for="${CSS.escape(t.id)}"]`) : null);
  if (lab) { const lr = lab.getBoundingClientRect(); if (lr.width >= 4 && lr.height >= 4) return lab; }
  let p = t.parentElement;
  for (let i = 0; p && i < 3; i++, p = p.parentElement) {
    const pr = p.getBoundingClientRect();
    if (pr.width >= 4 && pr.height >= 4) return p;
  }
  return t;
}

function place(animate: boolean, quiet = false) {
  if (!ring || !target) return;
  const v = visualOf(target);
  const r = v.getBoundingClientRect();
  if (!r.width && !r.height) { if (!quiet) hide(); return; }
  const pad = v.matches('input, textarea, select') ? 3 : 5;
  if (v !== padFor) { padFor = v; padX = sidePad(v, pad); } // once per element (the follow loop runs every frame)
  const x = r.left - padX, y = r.top - pad, w = r.width + padX * 2, h = r.height + pad * 2;
  const key = `${x | 0},${y | 0},${w | 0},${h | 0}`;
  if (quiet && key === last) return;
  last = key;
  const radius = quiet ? (ring.style.borderRadius || shapeFor(v, w, h, pad)) : shapeFor(v, w, h, pad);
  if (!quiet) {
    // probe just outside the ring (above, below, both sides) — majority wins
    const W = window.innerWidth, H = window.innerHeight;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const pts: [number, number][] = [[cx, r.top - pad - 2], [cx, r.bottom + pad + 2], [r.left - pad - 2, cy], [r.right + pad + 2, cy]];
    const skipRing = (n: Element) => !!n.closest('.focus-ring, .cursor') || n === v || v.contains(n);
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
