/* ==========================================================================
   Global chrome — owned by the chrome agent.
   initChrome() wires every site-wide system from data-attributes, so pages
   and sections only declare markup:
     data-reveal="lines" | "letters" | "words" (read: pale→full on scroll) | "fade" | "leaf" (image clip reveal 1.2→1)
       + data-reveal-delay="0.2", data-reveal-start="top 70%"
     data-bg="cream|sand|soil|moss|season"   section background for the page bg system
     data-header="light|dark"                (optional, on a section) force the header tone over it (a solid-coloured box inside wins)
     data-magnetic                           magnetic pull (≈30px) on desktop
     data-cursor="שתלו|גלו|גררו|none"        custom cursor label; data-cursor-fill="fruit" fills the ring
     data-cursor-icon="<svg …>"              (optional) icon inside the ring (map trees)
     data-no-transition                      opt a same-origin link out of the leaf page transition
     data-sound-hover                        soft wooden click on hover (links/buttons get it by default; ="off" to mute)
     data-wa="text"                          on a[href*=wa.me]: prefilled WhatsApp text (all wa.me clicks are tracked)
     html[data-hide-sticky]                  hides the phone sticky bottom bar (a page with its own bar)
     data-cookie-avoid                       the cookie card never rests on it; at the bottom edge it is a floor (the card sits above)
     font-size: calc(17px * var(--a11y-k, 1)) body-scale text that follows the a11y panel's text size (chrome.css)
   Bus events (full list with payloads in src/core/bus.ts) — emitted: 'theme:section', 'menu:open|close',
   'modal:open|close' (a11y panel), 'page:leave', 'page:restore', 'consent:change', 'a11y:change', 'cursor:drag',
   'sound:change'. Listened: 'preloader:done' (holds first-screen reveals + cookie card), 'modal:open|close'
   (hides the sticky bar), 'header:force' {visible}, 'cursor:set' {label, fill, icon} | null, 'motion:change'.
   ========================================================================== */
import './chrome.css';
import { bus } from '../core/bus';
import { env } from '../core/env';
import { initBg, scanBg } from './bg';
import { initHeader } from './header';
import { initMenu } from './menu';
import { initSticky } from './sticky';
import { initTransitions, navigate as leafNavigate } from './transition';
import { initReveal, scanReveal } from './reveal';
import { initCookies } from './cookies';
import { scanImages } from './images';

/* Non-critical layers load after the first paint (idle), so the first screen only waits for
   what it shows: the a11y panel (or on its first click), the keyboard focus ring (or on the
   first Tab), the desktop cursor + magnetic buttons (fine pointers only), and the details
   (tab title, WhatsApp tracking/prefill, hover sounds, console tree). The sound engine is
   lazy too (src/core/sound.ts). */
type A11yMod = typeof import('./a11y');
type CursorMod = typeof import('./cursor');
type DetailsMod = typeof import('./details');
let a11yMod: A11yMod | null = null;
let cursorMod: CursorMod | null = null;
let detailsMod: DetailsMod | null = null;
let a11yLoading: Promise<A11yMod> | null = null;
let focusLoading: Promise<unknown> | null = null;
let cursorLoading: Promise<unknown> | null = null;
// a failed chunk request (flaky network) is retried on the next attempt
const loadA11y = () => (a11yLoading ??= import('./a11y').then((m) => { m.initA11y(); a11yMod = m; return m; }, (e) => { a11yLoading = null; throw e; }));
const loadFocus = () => (focusLoading ??= import('./focus').then((m) => m.initFocus(), (e) => { focusLoading = null; throw e; }));
const loadCursor = () => (cursorLoading ??= import('./cursor').then((m) => { m.initCursor(); m.scanMagnetic(document); cursorMod = m; }, (e) => { cursorLoading = null; throw e; }));
function afterFirstPaint(fn: () => void) {
  const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
  const run = () => (idle ? idle(fn, { timeout: 1500 }) : setTimeout(fn, 400));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

export type PageName = 'home' | 'plant' | 'tree' | 'business' | 'legal' | 'notfound' | 'credits';

let started = false;

/** First-screen hold: on the home page the preloader plays first (≤ 2.2 s in the brief). */
function introHold(page: PageName): Promise<void> {
  const pre = document.querySelector<HTMLElement>('[data-preloader], .preloader');
  if (page !== 'home' || !pre || !env.motionAllowed()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearInterval(poll); off(); resolve(); };
    const off = bus.on('preloader:done', finish);
    const gone = () => {
      if (!pre.isConnected || pre.hidden) return true;
      const cs = getComputedStyle(pre);
      return cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05;
    };
    const poll = window.setInterval(() => { if (gone()) finish(); }, 120);
    setTimeout(finish, 2800);
  });
}

export function initChrome(opts: { page: PageName }): void {
  if (started) return;
  started = true;
  (window as any).__ofChrome = true; // cancels the head failsafe that would drop the reveal hidden-states
  // (if the failsafe already fired, reveal.ts reads .chrome-off and keeps everything visible)
  const page = opts.page;
  const hold = introHold(page);
  const safe = (name: string, fn: () => void) => { try { fn(); } catch (e) { console.error(`[chrome:${name}]`, e); } };
  safe('bg', initBg);
  safe('header', () => initHeader(page));
  safe('menu', initMenu);
  safe('sticky', () => initSticky(page));
  safe('transition', initTransitions);
  safe('reveal', () => initReveal(hold));
  safe('cookies', () => initCookies(page, hold));
  safe('images', () => scanImages(document));
  safe('lazy', () => {
    const fail = (name: string) => (e: unknown) => console.error(`[chrome:${name}]`, e);
    // a click on an a11y button before the panel module is there loads it and opens
    document.addEventListener('click', (e) => {
      if (a11yMod) return;
      const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-a11y-open]');
      if (b) loadA11y().then((m) => m.openA11y(b)).catch(fail('a11y'));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab') loadFocus().catch(fail('focus')); }, { capture: true, once: true });
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) fine.addEventListener?.('change', (e) => { if (e.matches) loadCursor().catch(fail('cursor')); });
    afterFirstPaint(() => {
      loadFocus().catch(fail('focus'));
      loadA11y().catch(fail('a11y'));
      if (fine.matches) loadCursor().catch(fail('cursor'));
      import('./details').then((m) => { m.initDetails(page); detailsMod = m; }).catch(fail('details'));
    });
  });
  hold.then(() => requestAnimationFrame(() => document.documentElement.classList.add('chrome-ready')));
  if (import.meta.env.DEV) (window as any).__ofChromeDev = { refreshChrome, navigate };
}

/** Re-scan a subtree for data-reveal / data-magnetic / data-cursor after dynamic DOM changes. */
export function refreshChrome(root: ParentNode = document): void {
  try {
    scanReveal(root);
    scanBg(root);
    scanImages(root);
    cursorMod?.scanMagnetic(root);   // not loaded yet → it scans the whole document when it loads
    detailsMod?.scanWhatsApp(root);  // same
  } catch (e) { console.error('[chrome:refresh]', e); }
}

/** Navigate with the leaf transition (used by JS-driven navigation, e.g. after "payment"). */
export function navigate(href: string, origin?: { x: number; y: number }): void {
  leafNavigate(href, origin);
}
