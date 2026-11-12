/* ==========================================================================
   Full-screen menu in --moss (phones + tablets). The panel unrolls from the top
   with one rounded leaf corner, big items rise one by one, a line branch draws
   itself. Modal: focus trap, Esc, inert background, lockScroll.
   ========================================================================== */
import { gsap, T, EASE } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { lockScroll, unlockScroll } from '../core/scroll';
import { makeModal, qs, qsa } from './util';

let menu: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let isOpen = false;
let release: (() => void) | null = null;
let tl: gsap.core.Timeline | null = null;

export const isMenuOpen = () => isOpen;

export function initMenu() {
  menu = qs('[data-menu]');
  panel = menu?.querySelector<HTMLElement>('.menu__panel') ?? null;
  if (!menu || !panel) return;
  qsa('[data-menu-open]').forEach((b) => b.addEventListener('click', () => { opener = b; openMenu(); }));
  menu.querySelectorAll<HTMLElement>('[data-menu-close]').forEach((b) => b.addEventListener('click', () => closeMenu()));
  // leaving the tablet layout while open (rotation / resize to desktop)
  matchMedia('(min-width: 1200px)').addEventListener?.('change', (e) => { if (e.matches && isOpen) closeMenu({ instant: true }); });
  bus.on('page:restore', () => { if (isOpen) closeMenu({ instant: true, restoreFocus: false }); });
}

export function openMenu() {
  if (!menu || !panel || isOpen) return;
  isOpen = true;
  menu.hidden = false;
  qsa('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  document.documentElement.classList.add('menu-open');
  lockScroll();
  release = makeModal(menu, {
    onEscape: () => closeMenu(),
    keep: qsa('.cursor, .focus-ring, .pt, .a11y'),
  });
  bus.emit('menu:open');
  sound.play('rustle');
  const closeBtn = menu.querySelector<HTMLElement>('[data-menu-close]');
  tl?.kill();
  if (!env.motionAllowed()) {
    gsap.set(panel, { clearProps: 'all' });
    closeBtn?.focus();
    return;
  }
  const r = Math.min(window.innerWidth * 0.62, 520);
  const links = menu.querySelectorAll('.menu__link');
  const branch = menu.querySelectorAll('.menu__branch path');
  tl = gsap.timeline({ defaults: { overwrite: 'auto' } })
    .fromTo(panel, { '--clip-b': '100%', '--clip-r': `${r}px` }, { '--clip-b': '0%', '--clip-r': '0px', duration: 0.85, ease: EASE.page }, 0)
    .fromTo(menu.querySelectorAll('.menu__bar > *'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: T.ui, stagger: 0.05, ease: EASE.appear }, 0.35)
    .fromTo(links, { yPercent: 115 }, { yPercent: 0, duration: T.appear, stagger: T.lineStep, ease: EASE.appear }, 0.32)
    .fromTo(menu.querySelectorAll('.menu__num'), { opacity: 0 }, { opacity: 1, duration: T.ui, stagger: T.lineStep }, 0.6)
    .fromTo(menu.querySelectorAll('.menu__foot > *'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: T.appear, stagger: 0.08, ease: EASE.appear }, 0.6)
    .fromTo(branch, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.6, stagger: 0.12, ease: 'power2.inOut' }, 0.45);
  // focus after the panel has started to cover (screen readers get the dialog immediately)
  requestAnimationFrame(() => closeBtn?.focus({ preventScroll: true }));
}

export function closeMenu(opts: { instant?: boolean; restoreFocus?: boolean } = {}) {
  if (!menu || !panel || !isOpen) return;
  isOpen = false;
  qsa('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  release?.(); release = null;
  const done = () => {
    if (!menu || isOpen) return;
    menu.hidden = true;
    document.documentElement.classList.remove('menu-open');
    gsap.set(menu.querySelectorAll('.menu__link, .menu__num, .menu__foot > *, .menu__bar > *'), { clearProps: 'all' });
    unlockScroll();
    bus.emit('menu:close');
  };
  if (opts.restoreFocus !== false) (opener ?? qs('[data-menu-open]'))?.focus({ preventScroll: true });
  tl?.kill();
  if (opts.instant || !env.motionAllowed()) { done(); return; }
  tl = gsap.timeline({ onComplete: done })
    .to(menu.querySelectorAll('.menu__link, .menu__foot > *, .menu__bar > *'), { opacity: 0, duration: 0.25, ease: 'power1.out' }, 0)
    .to(panel, { '--clip-b': '100%', '--clip-r': '0px', duration: 0.6, ease: EASE.page }, 0.1);
}
