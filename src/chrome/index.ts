/* ==========================================================================
   Global chrome — owned by the chrome agent.
   initChrome() wires every site-wide system from data-attributes, so pages
   and sections only declare markup:
     data-reveal="lines" | "letters" | "words" (read: pale→full on scroll) | "fade" | "leaf" (image clip reveal 1.2→1)
       + data-reveal-delay="0.2", data-reveal-start="top 70%"
     data-bg="cream|sand|soil|moss|season"   section background for the page bg system
     data-header="light|dark"                (optional, on a section) force the header tone over it
     data-magnetic                           magnetic pull (≈30px) on desktop
     data-cursor="שתלו|גלו|גררו|none"        custom cursor label; data-cursor-fill="fruit" fills the ring
     data-cursor-icon="<svg …>"              (optional) icon inside the ring (map trees)
     data-no-transition                      opt a same-origin link out of the leaf page transition
     data-sound-hover                        soft wooden click on hover (links/buttons get it by default; ="off" to mute)
     data-wa="text"                          on a[href*=wa.me]: prefilled WhatsApp text (all wa.me clicks are tracked)
     html[data-hide-sticky]                  hides the phone sticky bottom bar (a page with its own bar)
   Bus events emitted: 'theme:section', 'menu:open|close', 'modal:open|close' (a11y panel),
   'page:leave', 'page:restore', 'consent:change', 'a11y:change', 'cursor:drag'.
   Bus events listened: 'preloader:done' (holds first-screen reveals), 'modal:open|close' (hides the
   sticky bar), 'header:force' {visible}, 'cursor:set' {label, fill, icon} | null.
   ========================================================================== */
import './chrome.css';
import { bus } from '../core/bus';
import { env } from '../core/env';
import { initBg, scanBg } from './bg';
import { initHeader } from './header';
import { initMenu } from './menu';
import { initSticky } from './sticky';
import { initTransitions, navigate as leafNavigate } from './transition';
import { initA11y } from './a11y';
import { initFocus } from './focus';
import { initCursor, scanMagnetic } from './cursor';
import { initReveal, scanReveal } from './reveal';
import { initCookies } from './cookies';
import { initDetails, scanImages, scanWhatsApp } from './details';

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
  const page = opts.page;
  const hold = introHold(page);
  const safe = (name: string, fn: () => void) => { try { fn(); } catch (e) { console.error(`[chrome:${name}]`, e); } };
  safe('bg', initBg);
  safe('header', () => initHeader(page));
  safe('menu', initMenu);
  safe('sticky', () => initSticky(page));
  safe('transition', initTransitions);
  safe('a11y', initA11y);
  safe('focus', initFocus);
  safe('cursor', initCursor);
  safe('reveal', () => initReveal(hold));
  safe('cookies', () => initCookies(page, hold));
  safe('details', () => initDetails(page));
  safe('images', () => scanImages(document));
  safe('magnetic', () => scanMagnetic(document));
  hold.then(() => requestAnimationFrame(() => document.documentElement.classList.add('chrome-ready')));
  if (import.meta.env.DEV) (window as any).__ofChromeDev = { refreshChrome, navigate };
}

/** Re-scan a subtree for data-reveal / data-magnetic / data-cursor after dynamic DOM changes. */
export function refreshChrome(root: ParentNode = document): void {
  try {
    scanReveal(root);
    scanBg(root);
    scanMagnetic(root);
    scanImages(root);
    scanWhatsApp(root);
  } catch (e) { console.error('[chrome:refresh]', e); }
}

/** Navigate with the leaf transition (used by JS-driven navigation, e.g. after "payment"). */
export function navigate(href: string, origin?: { x: number; y: number }): void {
  leafNavigate(href, origin);
}
