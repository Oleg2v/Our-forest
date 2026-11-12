/* ==========================================================================
   Header: hides on scroll down, returns on scroll up with a blurred translucent
   background; the wordmark shrinks to a small leaf mark; text colour adapts to
   the section underneath (dark sections → light chrome). Also wires every
   [data-sound-toggle] and the nav "you are here" states.
   ========================================================================== */
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { isDarkAt, qsa } from './util';
import type { PageName } from './index';

const SKIP = '.site-header, .menu, .mbar, .cookie, .cursor, .focus-ring, .pt, .a11y, .skip-link';
const skip = (el: Element) => !!el.closest(SKIP);

let header: HTMLElement | null = null;
let menuOpen = false;
let forcedVisible = 0;

export function initHeader(page: PageName) {
  header = document.querySelector<HTMLElement>('[data-header]');
  wireSoundToggles();
  if (!header) return;
  const h = header;
  let lastY = Math.max(0, window.scrollY);
  let ticking = false;
  let lastTone = 0;
  let toneTimer = 0;

  const setAttr = (name: string, on: boolean) => { if (on) h.setAttribute(name, ''); else h.removeAttribute(name); };

  const tone = () => {
    lastTone = performance.now();
    const y = (parseFloat(getComputedStyle(h).height) || 64) / 2 + 2;
    const w = window.innerWidth;
    let dark = 0;
    for (const x of [w * 0.2, w * 0.5, w * 0.8]) if (isDarkAt(x, y, skip)) dark++;
    const t = dark >= 2 ? 'light' : 'dark';
    if (h.dataset.tone !== t) h.dataset.tone = t;
  };

  const update = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    const dy = y - lastY;
    setAttr('data-compact', y > 80);
    const focusInside = h.contains(document.activeElement);
    if (y < 40 || menuOpen || forcedVisible > 0 || focusInside) setAttr('data-hidden', false);
    else if (dy > 4 && y > 160) setAttr('data-hidden', true);
    else if (dy < -4) setAttr('data-hidden', false);
    lastY = y;
    if (performance.now() - lastTone > 140) tone();
    clearTimeout(toneTimer);
    toneTimer = window.setTimeout(tone, 160);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  bus.on('theme:section', () => setTimeout(tone, 30));
  h.addEventListener('focusin', () => setAttr('data-hidden', false));
  bus.on('menu:open', () => { menuOpen = true; setAttr('data-hidden', false); });
  bus.on('menu:close', () => { menuOpen = false; });
  bus.on<{ visible: boolean }>('header:force', ({ visible }) => { forcedVisible = Math.max(0, forcedVisible + (visible ? 1 : -1)); onScroll(); });
  // first probe in the first frame, not inside the module's start-up task (it forces the first layout)
  onScroll();
  // re-probe while intro animations, media and webfonts settle (no polling loop)
  window.addEventListener('load', () => setTimeout(tone, 60), { once: true });
  [400, 1200, 2400, 4000].forEach((ms) => setTimeout(tone, ms));
  bus.on('preloader:done', () => setTimeout(tone, 300));

  markCurrent(page);
}

/* ---------------------------------------------------------------- nav "you are here" */
function markCurrent(page: PageName) {
  const links = qsa<HTMLAnchorElement>('[data-nav]');
  if (page === 'business') links.filter((a) => a.dataset.nav === 'business').forEach((a) => a.setAttribute('aria-current', 'page'));
  if (page !== 'home') return;
  // home: the section in the reading zone lights its nav item
  const ids = ['story', 'directions', 'contact'];
  const targets = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  if (!targets.length) return;
  const visible = new Set<string>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id); }
    const cur = ids.slice().reverse().find((id) => visible.has(id)) ?? '';
    links.forEach((a) => a.classList.toggle('is-current', !!cur && a.dataset.nav === cur));
  }, { rootMargin: '-45% 0px -50% 0px' });
  targets.forEach((t) => io.observe(t));
}

/* ---------------------------------------------------------------- sound toggles */
function wireSoundToggles() {
  const sync = () => {
    const on = sound.isOn();
    qsa('[data-sound-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      b.dataset.state = on ? 'on' : 'off';
      if (b.dataset.tip) b.dataset.tip = on ? 'צלילי היער · פועלים' : 'צלילי היער · כבויים';
    });
  };
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element | null)?.closest?.('[data-sound-toggle]');
    if (!btn) return;
    const on = sound.toggle();
    if (on) setTimeout(() => sound.play('rustle', { volume: 0.7 }), 260);
  });
  bus.on('sound:change', sync);
  sync();
}
