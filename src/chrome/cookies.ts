/* Cookie consent — calm, never blocking, remembered (of:consent). Links to /legal/privacy/.
   The choice is announced on bus 'consent:change' {analytics:boolean} and pushed to dataLayer.
   · Keyboard: when it appears, the card moves right after the skip link in the DOM, so Tab
     reaches it first (it stays a non-modal region; the page is fully usable without answering).
   · Where it rests. Slots: 'start' (bottom, reading-start corner), 'end' (the other bottom corner,
     desktop) and 'top' (under the header). Phones get a compact one-row card above the phone bar.
     - It never rests on a primary action or on content that must stay in view (AVOID).
     - A primary that hugs the bottom edge (a page's own bar: the /plant summary, the tree's skip / dock)
       is a floor: the card sits just above it instead of jumping to the top.
     - On desktop a corner over ordinary links and buttons costs a little, so a free corner wins.
     - The first show waits, invisible, until a slot is free and the page has settled (the same answer
       twice, 0.7 s apart) — on the home hero that is the first scroll; 20 s at most.
     - Once shown it moves only off a primary (or, in its first seconds, off plain links to a free
       corner), and never back to a slot it has left (no flip-flop).
     Re-checked when scrolling settles, on resize, when the phone bar / data-hide-sticky changes,
     and every 1.5 s while the page is still (bars and docks that appear later). */
import { bus } from '../core/bus';
import { storage } from '../core/storage';
import { sound } from '../core/sound';
import { env } from '../core/env';
import { qs } from './util';
import type { PageName } from './index';

type Choice = 'all' | 'necessary';
type Pos = 'start' | 'end' | 'top';

/** primary actions and content that must stay in view (pages opt in with data-cookie-avoid; the classes
 *  are the home live counter, the /plant price bar and the tree's dock / skip button) */
const AVOID = '.btn--fruit, .btn--lg, .pc-bar, .tdock-card, .hero__count, .tbirth-skip, [data-cookie-avoid]';
/** anything else one may press — on desktop a corner over these costs a little */
const PRESS = 'a[href], button, input, select, textarea, summary, [role="button"]';
const CHROME = '.site-header, .menu, .mbar, .a11y, [data-cookie], [hidden], [inert]';
const PRIMARY = 100;
const GIVE_UP = 20000;

export function initCookies(page: PageName, hold: Promise<unknown>) {
  const el = qs('[data-cookie]');
  if (!el) return;
  const saved = storage.get<{ v: Choice; t: number } | null>('consent', null);
  if (saved?.v) { announce(saved.v); return; }
  const card = el;
  let state: 'idle' | 'wait' | 'open' | 'gone' = 'idle';
  let since = 0;
  let settle = 0;
  let tick = 0;
  let lastScroll = 0;
  let shownAt = 0;
  let seen = '';
  const left = new Set<Pos>();

  const slots = (): Pos[] => (env.isMobile() ? ['start', 'top'] : ['start', 'end', 'top']);
  const shown = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  const rectsOf = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))
    .filter((b) => !b.closest(CHROME))
    .map((b) => b.getBoundingClientRect())
    .filter(shown);
  const near = (a: DOMRect, b: DOMRect) => b.left < a.right + 8 && b.right > a.left - 8 && b.top < a.bottom + 8 && b.bottom > a.top - 8;
  const setFloor = (px: number) => card.style.setProperty('--ck-floor', `${Math.round(px)}px`);

  /** what the card would cover in every slot, and the floor for the bottom slots */
  function survey() {
    const H = innerHeight;
    const phone = env.isMobile();
    const avoid = rectsOf(AVOID);
    const press = phone ? [] : rectsOf(PRESS);
    const floors = avoid.filter((r) => r.bottom >= H - 40 && r.top >= H - 160);
    const floor = floors.length ? Math.max(0, H - Math.min(...floors.map((r) => r.top))) : 0;
    const rest = avoid.filter((r) => !floors.includes(r));
    const pos = card.dataset.pos || 'start';
    const prevFloor = card.style.getPropertyValue('--ck-floor');
    // measured in place with transitions off, then put back exactly as it was
    card.classList.add('cookie--measure');
    setFloor(floor);
    const cost = new Map<Pos, number>();
    for (const p of slots()) {
      card.dataset.pos = p;
      const r = card.getBoundingClientRect();
      let c = 0;
      for (const b of rest) if (near(r, b)) c += PRIMARY;
      for (const b of press) if (near(r, b)) c += 1;
      if (p === 'top' && !phone) c += 1.5; // desktop: a free bottom corner beats the top
      cost.set(p, c);
    }
    card.dataset.pos = pos;
    if (prevFloor) card.style.setProperty('--ck-floor', prevFloor); else card.style.removeProperty('--ck-floor');
    void card.offsetWidth;
    card.classList.remove('cookie--measure');
    return { cost, floor };
  }

  /** the cheapest slot among `allowed` (their order breaks ties) */
  function cheapest(cost: Map<Pos, number>, allowed: Pos[]) {
    let pick: Pos | null = null;
    let c = Infinity;
    for (const p of allowed) { const v = cost.get(p) ?? Infinity; if (v < c - 0.01) { pick = p; c = v; } }
    return { pick, c };
  }

  function reveal(p: Pos, floor: number) {
    state = 'open';
    shownAt = Date.now();
    left.clear();
    // keyboard order: right after the skip link (Tab reaches the choice before the page)
    const skip = document.querySelector('.skip-link');
    if (skip?.parentElement === document.body) skip.after(card);
    else document.body.prepend(card);
    card.classList.add('cookie--measure');
    card.dataset.pos = p;
    setFloor(floor);
    void card.offsetWidth;
    card.classList.remove('cookie--measure');
    card.removeAttribute('data-wait');
    requestAnimationFrame(() => requestAnimationFrame(() => { if (state === 'open') card.setAttribute('data-shown', ''); }));
  }

  function move(p: Pos, floor: number) {
    left.add(card.dataset.pos as Pos);
    const jump = () => {
      card.classList.add('cookie--measure');
      card.dataset.pos = p;
      setFloor(floor);
      void card.offsetWidth;
      card.classList.remove('cookie--measure');
    };
    if (!env.motionAllowed()) { jump(); return; }
    card.removeAttribute('data-shown');
    setTimeout(() => {
      if (state !== 'open') return;
      jump();
      card.setAttribute('data-shown', '');
    }, 320);
  }

  const place = () => {
    if (state !== 'wait' && state !== 'open') return;
    const all = slots();
    if (!all.includes(card.dataset.pos as Pos)) card.dataset.pos = 'start'; // desktop → phone width
    const { cost, floor } = survey();
    if (state === 'wait') {
      const { pick, c } = cheapest(cost, all);
      // the same answer twice in a row: the page's entrance animations have settled
      const sig = `${pick}:${[...cost.values()].join(',')}:${Math.round(floor)}`;
      const same = sig === seen;
      seen = sig;
      if (pick && ((c < PRIMARY && same) || Date.now() - since > GIVE_UP)) reveal(pick, floor);
      return;
    }
    const cur = card.dataset.pos as Pos;
    const now = cost.get(cur) ?? 0;
    // off a primary: any slot without one; in the first seconds also off plain links, to a free slot
    const settling = Date.now() - shownAt < 6000;
    if (now >= PRIMARY || (settling && now >= 1)) {
      const { pick, c } = cheapest(cost, all.filter((p) => p !== cur && !left.has(p)));
      if (pick && c < (now >= PRIMARY ? PRIMARY : 1)) { move(pick, floor); return; }
    }
    setFloor(floor); // a bar under the card came or went: it slides (CSS transition)
  };
  const later = () => { clearTimeout(settle); settle = window.setTimeout(place, 260); };
  const onScroll = () => { lastScroll = Date.now(); later(); };

  const show = () => {
    if (state !== 'idle') return;
    state = 'wait';
    since = Date.now();
    card.dataset.pos = 'start';
    card.setAttribute('data-wait', '');
    card.hidden = false;
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', later, { passive: true });
    const loop = () => {
      if (!document.hidden && Date.now() - lastScroll > 500) place();
      if (state === 'wait' || state === 'open') tick = window.setTimeout(loop, state === 'wait' ? 700 : 1500);
    };
    tick = window.setTimeout(loop, 700);
  };
  const decide = (v: Choice) => {
    storage.set('consent', { v, t: Date.now() });
    announce(v);
    sound.play('click');
    state = 'gone';
    mo.disconnect();
    clearTimeout(settle);
    clearTimeout(tick);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', later);
    const hadFocus = card.contains(document.activeElement);
    card.removeAttribute('data-shown');
    setTimeout(() => { card.hidden = true; }, env.motionAllowed() ? 600 : 0);
    if (hadFocus) document.getElementById('main')?.focus({ preventScroll: true });
  };
  card.querySelector('[data-cookie-accept]')?.addEventListener('click', () => decide('all'));
  card.querySelector('[data-cookie-decline]')?.addEventListener('click', () => decide('necessary'));
  // the phone bar appearing/disappearing changes what is under the card
  const mo = new MutationObserver(() => { if (state === 'wait' || state === 'open') later(); });
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
