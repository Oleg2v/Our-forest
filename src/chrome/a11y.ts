/* ==========================================================================
   Accessibility panel (button in the header + in the menu). Normal markup, a real
   modal dialog: text size (normal + 2 steps), high contrast, stop animations.
   Writes the same storage keys the pre-paint script reads:
   of:a11y:font (1|2), of:a11y:contrast ("high"), of:a11y:motionOff (true).
   ========================================================================== */
import { gsap, ScrollTrigger } from '../core/gsap';
import { env, setUserMotionOff } from '../core/env';
import { storage } from '../core/storage';
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { lockScroll, unlockScroll } from '../core/scroll';
import { makeModal, qs, qsa } from './util';

const root = document.documentElement;
let dlg: HTMLElement | null = null;
let card: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let release: (() => void) | null = null;
let isOpen = false;

export function initA11y() {
  dlg = qs('[data-a11y]');
  card = dlg?.querySelector<HTMLElement>('.a11y__card') ?? null;
  if (!dlg || !card) return;
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-a11y-open]');
    if (b) { opener = b; open(); }
  });
  dlg.querySelectorAll('[data-a11y-close]').forEach((b) => b.addEventListener('click', () => close()));
  dlg.querySelectorAll<HTMLInputElement>('input[name="a11y-font"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) setFont(Number(r.value)); }));
  qs('[data-a11y-contrast]', dlg)?.addEventListener('click', () => setContrast(root.dataset.a11yContrast !== 'high'));
  qs('[data-a11y-motion]', dlg)?.addEventListener('click', () => { setUserMotionOff(!env.userMotionOff()); sync(); bus.emit('a11y:change'); });
  qs('[data-a11y-reset]', dlg)?.addEventListener('click', () => {
    setFont(0); setContrast(false);
    if (env.userMotionOff()) setUserMotionOff(false);
    sync(); bus.emit('a11y:change');
  });
  bus.on('motion:change', sync);
  sync();
}

function sync() {
  if (!dlg) return;
  const font = Number(root.dataset.a11yFont || 0);
  dlg.querySelectorAll<HTMLInputElement>('input[name="a11y-font"]').forEach((r) => { r.checked = Number(r.value) === font; });
  qs('[data-a11y-contrast]', dlg)?.setAttribute('aria-checked', String(root.dataset.a11yContrast === 'high'));
  qs('[data-a11y-motion]', dlg)?.setAttribute('aria-checked', String(env.userMotionOff()));
  qsa('[data-a11y-open]').forEach((b) => b.classList.toggle('is-active', font > 0 || root.dataset.a11yContrast === 'high' || env.userMotionOff()));
}

let refreshT = 0;
function relayout() { clearTimeout(refreshT); refreshT = window.setTimeout(() => ScrollTrigger.refresh(), 250); }

function setFont(n: number) {
  n = Math.max(0, Math.min(2, Math.round(n) || 0));
  if (n) { root.setAttribute('data-a11y-font', String(n)); storage.set('a11y:font', n); }
  else { root.removeAttribute('data-a11y-font'); storage.remove('a11y:font'); }
  sound.play('click');
  sync(); relayout(); bus.emit('a11y:change');
}
function setContrast(on: boolean) {
  if (on) { root.setAttribute('data-a11y-contrast', 'high'); storage.set('a11y:contrast', 'high'); }
  else { root.removeAttribute('data-a11y-contrast'); storage.remove('a11y:contrast'); }
  sound.play('click');
  sync(); bus.emit('a11y:change');
}

function open() {
  if (!dlg || !card || isOpen) return;
  isOpen = true;
  sync();
  dlg.hidden = false;
  lockScroll();
  release = makeModal(dlg, { onEscape: close, keep: qsa('.cursor, .focus-ring') });
  qsa('[data-a11y-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  bus.emit('modal:open', { id: 'a11y' });
  if (env.motionAllowed()) {
    const sheet = matchMedia('(max-width: 768px)').matches;
    gsap.fromTo(card, sheet ? { yPercent: 100 } : { y: -14, opacity: 0 }, { yPercent: 0, y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform,opacity' });
    gsap.fromTo(dlg.querySelector('.a11y__scrim'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }
  // first control = the checked text size radio
  requestAnimationFrame(() => (dlg!.querySelector<HTMLElement>('input[name="a11y-font"]:checked') ?? dlg!.querySelector<HTMLElement>('.a11y__x'))?.focus({ preventScroll: true }));
}

function close() {
  if (!dlg || !card || !isOpen) return;
  isOpen = false;
  release?.(); release = null;
  qsa('[data-a11y-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  const done = () => { dlg!.hidden = true; unlockScroll(); bus.emit('modal:close', { id: 'a11y' }); };
  const back = opener && opener.isConnected && opener.getClientRects().length ? opener : qs('.site-header [data-a11y-open]');
  back?.focus({ preventScroll: true });
  if (!env.motionAllowed()) { done(); return; }
  const sheet = matchMedia('(max-width: 768px)').matches;
  gsap.to(card, { ...(sheet ? { yPercent: 100 } : { y: -10, opacity: 0 }), duration: 0.35, ease: 'power2.in', onComplete: () => { gsap.set(card, { clearProps: 'transform,opacity' }); done(); } });
  gsap.to(dlg.querySelector('.a11y__scrim'), { opacity: 0, duration: 0.35, clearProps: 'opacity' });
}
