/* ==========================================================================
   Phones (≤ 768px): sticky bottom bar on every page — "נוטעים עץ" + WhatsApp.
   Hidden: html[data-hide-sticky] (a page's own sticky bar, e.g. /plant), while the
   first screen of the home page is in view (the hero has its own CTAs), over the
   footer, while a sheet/dialog/menu is open, and while the on-screen keyboard is up.
   Respects safe-area-inset-bottom. Sets html.mbar-on + --mbar-space for neighbours (chrome.css lists the
   boxes that read --mbar-space: it is not a root variable, so the bar coming/going restyles only them).
   ========================================================================== */
import { bus } from '../core/bus';
import { ScrollTrigger } from '../core/gsap';
import { isDarkAt, qs } from './util';
import type { PageName } from './index';

export function initSticky(page: PageName) {
  const bar = qs('[data-mbar]');
  if (!bar) return;
  const root = document.documentElement;
  const mq = matchMedia('(max-width: 768px)');
  const reasons = new Set<string>();
  let modals = 0;

  let toneStale = false;
  const update = () => {
    const hidden = !mq.matches || reasons.size > 0 || root.hasAttribute('data-hide-sticky');
    // writes only on change: this runs on every scroll event on the home page
    if (hidden !== bar.hasAttribute('data-hidden')) {
      bar.toggleAttribute('data-hidden', hidden);
      if (!hidden && toneStale) tone(); // coming back: the right colour as it slides in
    }
    if (bar.inert !== hidden) bar.inert = hidden;
    if (root.classList.contains('mbar-on') === hidden) root.classList.toggle('mbar-on', !hidden);
  };
  const set = (r: string, on: boolean) => {
    if (reasons.has(r) === on) return;
    if (on) reasons.add(r); else reasons.delete(r);
    update();
  };

  // home: wait until the visitor leaves the hero. No reads of its own while scrolling: the position is the one
  // ScrollTrigger read (and cached) in its own scroll handler on the document — this bubble-phase listener on
  // window runs right after it — and the window height is kept from the last resize (scrollY and innerHeight
  // both flush the frame's pending style). Scrolls inside elements do not bubble here.
  if (page === 'home') {
    const scrollPos = ScrollTrigger.getScrollFunc(window) as unknown as () => number; // no argument = getter
    let vh = window.innerHeight;
    const onScroll = () => set('intro', scrollPos() < vh * 0.55);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { vh = window.innerHeight; onScroll(); }, { passive: true });
    set('intro', window.scrollY < vh * 0.55);
  }
  // over the footer the bar steps aside (the footer has its own big CTA and links)
  const footer = document.getElementById('footer') || qs('footer');
  if (footer) {
    new IntersectionObserver(([e]) => set('footer', e.isIntersecting), { rootMargin: '0px 0px -14% 0px' }).observe(footer);
  }
  bus.on('menu:open', () => set('menu', true));
  bus.on('menu:close', () => set('menu', false));
  bus.on('modal:open', () => { modals++; set('modal', true); });
  bus.on('modal:close', () => { modals = Math.max(0, modals - 1); set('modal', modals > 0); });
  // the on-screen keyboard (form fields) — never cover what is being typed
  const vv = window.visualViewport;
  if (vv) vv.addEventListener('resize', () => set('keyboard', vv.height < window.innerHeight * 0.72));
  // pages can hide it declaratively: html[data-hide-sticky]
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-hide-sticky'] });
  mq.addEventListener?.('change', update);

  // tone: over dark sections the dock turns moss. A hit test of the whole stack — so only once a scroll settles,
  // and not at all while the bar is away (it looks again when it comes back)
  let t = 0;
  function tone() {
    if (!mq.matches) return;
    if (bar!.hasAttribute('data-hidden')) { toneStale = true; return; }
    toneStale = false;
    const y = window.innerHeight - 30;
    const dark = isDarkAt(window.innerWidth / 2, y, (el) => !!el.closest('.mbar, .cookie, .cursor, .focus-ring, .pt'));
    const v = dark ? 'light' : 'dark';
    if (bar!.dataset.tone !== v) bar!.dataset.tone = v;
  }
  window.addEventListener('scroll', () => { clearTimeout(t); t = window.setTimeout(tone, 120); }, { passive: true });
  bus.on('theme:section', () => setTimeout(tone, 40));
  setTimeout(tone, 300);

  // entrance a beat after first paint (CSS keeps it down until data-ready — no flash before JS)
  bar.toggleAttribute('data-hidden', true);
  bar.inert = true;
  requestAnimationFrame(() => bar.setAttribute('data-ready', ''));
  setTimeout(update, page === 'home' ? 0 : 450);
}
