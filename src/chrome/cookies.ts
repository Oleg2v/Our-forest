/* Cookie consent — calm, never blocking, remembered (of:consent). Links to /legal/privacy.
   The choice is announced on bus 'consent:change' {analytics:boolean} and pushed to dataLayer.
   · Keyboard: when it appears, the card moves right after the skip link in the DOM, so Tab
     reaches it first (it stays a non-modal region; the page is fully usable without answering).
   · Never over the main buy buttons: it sits at the reading-start bottom corner, above the phone
     bar; if a primary button (.btn--fruit, .btn--lg, a page's own bottom bar, [data-cookie-avoid])
     would be under it, it moves to the other bottom corner, or under the header. Re-checked when
     scrolling settles and on resize. */
import { bus } from '../core/bus';
import { storage } from '../core/storage';
import { sound } from '../core/sound';
import { env } from '../core/env';
import { qs } from './util';
import type { PageName } from './index';

type Choice = 'all' | 'necessary';
type Pos = 'start' | 'end' | 'top';

const AVOID = '.btn--fruit, .btn--lg, .pc-bar, .tdock-card, [data-cookie-avoid]';

export function initCookies(page: PageName, hold: Promise<unknown>) {
  const el = qs('[data-cookie]');
  if (!el) return;
  const saved = storage.get<{ v: Choice; t: number } | null>('consent', null);
  if (saved?.v) { announce(saved.v); return; }
  let open = false;
  let settle = 0;

  const place = () => {
    if (!open) return;
    const cur = (el.dataset.pos as Pos) || 'start';
    const phone = matchMedia('(max-width: 768px)').matches;
    const order: Pos[] = phone ? ['start', 'top'] : ['start', 'end', 'top'];
    const blockers = Array.from(document.querySelectorAll<HTMLElement>(AVOID))
      .filter((b) => !el.contains(b) && !b.closest('.site-header, .menu, .mbar, .a11y, [hidden], [inert]'))
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
    // a page with its own phone bar (html[data-hide-sticky]: /plant, the tree's dock) keeps the bottom
    const pageBar = phone && document.documentElement.hasAttribute('data-hide-sticky');
    const hits = (p: Pos) => {
      if (pageBar && p === 'start') return true;
      el.dataset.pos = p;
      const r = el.getBoundingClientRect();
      return blockers.some((b) => b.left < r.right + 8 && b.right > r.left - 8 && b.top < r.bottom + 8 && b.bottom > r.top - 8);
    };
    // the transition on the card's position is switched off while measuring
    el.classList.add('cookie--measure');
    let next: Pos = cur;
    if (hits(cur)) next = order.find((p) => p !== cur && !hits(p)) ?? cur;
    el.dataset.pos = cur;
    void el.offsetWidth;
    el.classList.remove('cookie--measure');
    if (next === cur) return;
    if (!env.motionAllowed()) { el.dataset.pos = next; return; }
    el.removeAttribute('data-shown');
    setTimeout(() => {
      if (!open) return;
      el.classList.add('cookie--measure');
      el.dataset.pos = next;
      void el.offsetWidth;
      el.classList.remove('cookie--measure');
      el.setAttribute('data-shown', '');
    }, 320);
  };
  const later = () => { clearTimeout(settle); settle = window.setTimeout(place, 260); };

  const show = () => {
    if (open) return;
    open = true;
    // keyboard order: right after the skip link (Tab reaches the choice before the page)
    const skip = document.querySelector('.skip-link');
    if (skip?.parentElement === document.body) skip.after(el);
    else document.body.prepend(el);
    el.dataset.pos = 'start';
    el.hidden = false;
    place();
    requestAnimationFrame(() => requestAnimationFrame(() => el.setAttribute('data-shown', '')));
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later, { passive: true });
  };
  const decide = (v: Choice) => {
    storage.set('consent', { v, t: Date.now() });
    announce(v);
    sound.play('click');
    open = false;
    mo.disconnect();
    clearTimeout(settle);
    window.removeEventListener('scroll', later);
    window.removeEventListener('resize', later);
    const hadFocus = el.contains(document.activeElement);
    el.removeAttribute('data-shown');
    setTimeout(() => { el.hidden = true; }, env.motionAllowed() ? 600 : 0);
    if (hadFocus) document.getElementById('main')?.focus({ preventScroll: true });
  };
  el.querySelector('[data-cookie-accept]')?.addEventListener('click', () => decide('all'));
  el.querySelector('[data-cookie-decline]')?.addEventListener('click', () => decide('necessary'));
  // the phone bar appearing/disappearing changes what is under the card
  const mo = new MutationObserver(() => { if (open) later(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-hide-sticky'] });
  // after the first impression (the home preloader + hero letters), never on top of it
  hold.then(() => setTimeout(show, page === 'home' ? 2600 : 1400));
}

function announce(v: Choice) {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: 'consent_update', analytics_storage: v === 'all' ? 'granted' : 'denied', ad_storage: v === 'all' ? 'granted' : 'denied' });
  bus.emit('consent:change', { analytics: v === 'all' });
}
