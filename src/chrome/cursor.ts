/* ==========================================================================
   Desktop cursor (fine pointer + motion on): a seed-dot and a lagging ring.
     data-cursor="שתלו|גלו|גררו"  → ring grows with a label
     data-cursor-fill="fruit"      → ring fills with --fruit
     data-cursor-icon="<svg…>"     → ring shows the icon (map trees)
     data-cursor="none"            → custom cursor hides over this area
   Defaults: .btn--fruit → "שתלו" on fruit; photos inside links → "גלו"; links/buttons → ring swells.
   While pressing on a "גררו" element the ring squeezes ("dragging").
   Magnetic buttons: [data-magnetic] pull toward the pointer within ~30px.
   ========================================================================== */
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { he } from '../content/he';
import { isDarkAt, qs, qsa, clamp } from './util';

const fine = matchMedia('(hover: hover) and (pointer: fine)');
const root = document.documentElement;
let enabled = false;
let el: HTMLElement | null = null;
let ring: HTMLElement | null = null;
let label: HTMLElement | null = null;
let icon: HTMLElement | null = null;
let ringX: gsap.QuickToFunc | null = null;
let ringY: gsap.QuickToFunc | null = null;
let dotX: gsap.QuickToFunc | null = null;
let dotY: gsap.QuickToFunc | null = null;
let px = -100, py = -100;
let shown = false;
let lastTone = 0;
let toneTimer = 0;
let target: Element | null = null;
let iconMarkup = '';
const cleanup: (() => void)[] = [];

const want = () => fine.matches && !env.isTouch && env.motionAllowed();

export function initCursor() {
  el = qs('[data-cursor-root]');
  ring = el?.querySelector<HTMLElement>('.cursor__ring') ?? null;
  label = el?.querySelector<HTMLElement>('.cursor__label') ?? null;
  icon = el?.querySelector<HTMLElement>('.cursor__icon') ?? null;
  if (!el || !ring) return;
  const sync = () => (want() ? enable() : disable());
  sync();
  bus.on('motion:change', sync);
  fine.addEventListener?.('change', sync);
}

function on<K extends keyof DocumentEventMap>(t: Document | Window, type: K, fn: (e: DocumentEventMap[K]) => void, opts: AddEventListenerOptions = { passive: true }) {
  t.addEventListener(type, fn as EventListener, opts);
  cleanup.push(() => t.removeEventListener(type, fn as EventListener, opts));
}

function enable() {
  if (enabled || !el) return;
  enabled = true;
  root.classList.add('has-cursor');
  const ringPos = el.querySelector('.cursor__ring-pos')!;
  const dotPos = el.querySelector('.cursor__dot-pos')!;
  ringX = gsap.quickTo(ringPos, 'x', { duration: 0.55, ease: 'power3.out' });
  ringY = gsap.quickTo(ringPos, 'y', { duration: 0.55, ease: 'power3.out' });
  dotX = gsap.quickTo(dotPos, 'x', { duration: 0.1, ease: 'power2.out' });
  dotY = gsap.quickTo(dotPos, 'y', { duration: 0.1, ease: 'power2.out' });

  on(window, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (!shown) { show(true); gsap.set([ringPos, dotPos], { x: px, y: py }); }
    ringX!(px); ringY!(py); dotX!(px); dotY!(py);
    magnetMove();
    const now = performance.now();
    if (now - lastTone > 220) { lastTone = now; tone(); }
    clearTimeout(toneTimer);
    toneTimer = window.setTimeout(() => { lastTone = performance.now(); tone(); }, 140);
  });
  on(document, 'pointerover', (e) => resolve(e.target as Element));
  on(document, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    el!.classList.add('is-down');
    const drag = (e.target as Element)?.closest?.('[data-cursor="גררו"], [data-cursor-drag]');
    if (drag) { el!.classList.add('is-drag'); bus.emit('cursor:drag', { on: true }); }
  });
  on(window, 'pointerup', () => {
    el!.classList.remove('is-down');
    if (el!.classList.contains('is-drag')) { el!.classList.remove('is-drag'); bus.emit('cursor:drag', { on: false }); }
  });
  on(document, 'pointerleave', () => show(false));
  on(window, 'blur', () => show(false));
  on(document, 'scroll', () => { if (target) resolve(document.elementFromPoint(px, py)); magnetMove(); }, { passive: true, capture: true });
  // programmatic: bus.emit('cursor:set', { label, fill, icon }) / bus.emit('cursor:set', null)
  cleanup.push(bus.on<{ label?: string; fill?: string; icon?: string } | null>('cursor:set', (s) => apply(s ?? {}, !!s)));
  magnetsOn();
}

function disable() {
  if (!enabled || !el) return;
  enabled = false;
  cleanup.splice(0).forEach((f) => f());
  root.classList.remove('has-cursor');
  el.className = 'cursor';
  show(false);
  magnetsOff();
}

function show(v: boolean) {
  shown = v;
  el?.classList.toggle('is-visible', v);
}

function tone() {
  if (!el) return;
  const dark = isDarkAt(px, py, (n) => !!n.closest('.cursor, .focus-ring'));
  el.classList.toggle('is-light', dark);
}

function resolve(t: Element | null) {
  if (!el) return;
  target = t;
  if (!t || !(t instanceof Element)) { apply({}, false); return; }
  if (t.closest('input:not([type="range"]):not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable="true"], iframe, [data-cursor="none"]')) {
    el.classList.add('is-native'); return;
  }
  el.classList.remove('is-native');
  const c = t.closest<HTMLElement>('[data-cursor], [data-cursor-icon]');
  if (c) { apply({ label: c.dataset.cursor, fill: c.dataset.cursorFill, icon: c.dataset.cursorIcon }, true); return; }
  if (t.closest('.btn--fruit')) { apply({ label: he.cursor.plant, fill: 'fruit' }, true); return; }
  if (t.closest('a img, a picture, a video, button img, a canvas')) { apply({ label: he.cursor.look }, true); return; }
  if (t.closest('a[href], button:not([disabled]), [role="button"], [role="switch"], label, summary, [data-magnetic]')) { apply({}, true, true); return; }
  apply({}, false);
}

function apply(s: { label?: string; fill?: string; icon?: string }, active: boolean, hoverOnly = false) {
  if (!el || !label || !icon) return;
  const hasLabel = !!s.label && s.label !== 'none';
  const hasIcon = !!s.icon;
  el.classList.toggle('is-hover', active && hoverOnly);
  el.classList.toggle('is-label', active && hasLabel && !hasIcon);
  el.classList.toggle('is-icon', active && hasIcon);
  el.classList.toggle('is-fruit', active && s.fill === 'fruit');
  if (hasLabel) label.textContent = s.label!;
  if (hasIcon && s.icon !== iconMarkup) { iconMarkup = s.icon!; icon.innerHTML = iconMarkup; }
}

/* ---------------------------------------------------------------- magnetic */
const magnets = new Set<HTMLElement>();
const visible = new Set<HTMLElement>();
const pulled = new Set<HTMLElement>();
let mio: IntersectionObserver | null = null;
let magnetFrame = 0;

export function scanMagnetic(scope: ParentNode = document) {
  qsa<HTMLElement>('[data-magnetic]', scope).forEach((m) => {
    if (magnets.has(m)) return;
    magnets.add(m);
    mio?.observe(m);
  });
}
function magnetsOn() {
  mio = new IntersectionObserver((entries) => entries.forEach((e) => {
    const t = e.target as HTMLElement;
    if (e.isIntersecting) visible.add(t); else { visible.delete(t); release(t); }
  }));
  magnets.forEach((m) => mio!.observe(m));
  scanMagnetic();
}
function magnetsOff() {
  mio?.disconnect(); mio = null; visible.clear();
  pulled.forEach((m) => gsap.set(m, { clearProps: 'x,y' }));
  pulled.clear();
}
function release(m: HTMLElement) {
  if (!pulled.has(m)) return;
  pulled.delete(m);
  gsap.to(m, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
}
function magnetMove() {
  if (magnetFrame || !visible.size) return;
  magnetFrame = requestAnimationFrame(() => {
    magnetFrame = 0;
    visible.forEach((m) => {
      if (m.closest('[inert]')) { release(m); return; }
      const r = m.getBoundingClientRect();
      const ox = Number(gsap.getProperty(m, 'x')) || 0, oy = Number(gsap.getProperty(m, 'y')) || 0;
      const left = r.left - ox, top = r.top - oy, w = r.width, h = r.height;
      const dx = Math.max(left - px, 0, px - (left + w));
      const dy = Math.max(top - py, 0, py - (top + h));
      const dist = Math.hypot(dx, dy);
      if (dist > 30) { release(m); return; }
      const k = 1 - dist / 30 * 0.6;
      const cx = left + w / 2, cy = top + h / 2;
      const mx = clamp((px - cx) * 0.32 * k, -Math.min(16, w * 0.2), Math.min(16, w * 0.2));
      const my = clamp((py - cy) * 0.38 * k, -10, 10);
      pulled.add(m);
      gsap.to(m, { x: mx, y: my, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    });
  });
}
