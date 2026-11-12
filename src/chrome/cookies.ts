/* Cookie consent — calm, never blocking, remembered (of:consent). Links to /legal/privacy/.
   The choice is announced on bus 'consent:change' {analytics:boolean} and pushed to dataLayer.
   · Keyboard: when it appears, the card moves right after the skip link in the DOM, so Tab
     reaches it first (it stays a non-modal region; the page is fully usable without answering).
   · Where it rests. Slots: 'start' (bottom, reading-start corner), 'end' (the other bottom corner,
     desktop) and 'top' (under the header). Phones get a compact one-row card above the phone bar.
     Wide screens (≥ 769 × 561) also have 'top-end' (under the header, far side) and, for the bottom
     corners, the content column's edge (preferred) or the screen corner (when the column spot is busy:
     the /plant next button, the /business scroll arrow); a neighbour within 16px counts as touched and
     the card never half-covers a photo.
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
type Pos = 'start' | 'end' | 'top' | 'top-end';
/** where the card rests: a side ('top-end' = under the header on the far side; wide screens only) and, on wide
 *  screens, how a bottom card sits when its first choice is busy: plain 'start' / 'end' = on the content column's
 *  edge, clamp(24px, 2vw, 36px) up; ':low' = the same edge, 20px up (clear of a caption just above it);
 *  ':corner' = out in the screen corner, 20px up (the pre-polish geometry: clear of a control at the column edge) */
type Slot = Pos | 'start:low' | 'end:low' | 'start:corner' | 'end:corner';

/** primary actions and content that must stay in view (pages opt in with data-cookie-avoid; the classes
 *  are the home live counter, the /plant price bar and the tree's dock / skip button) */
const AVOID = '.btn--fruit, .btn--lg, .pc-bar, .tdock-card, .hero__count, .tbirth-skip, [data-cookie-avoid]';
/** anything else one may press — on desktop a corner over these costs a little */
const PRESS = 'a[href], button, input, select, textarea, summary, [role="button"]';
const CHROME = '.site-header, .menu, .mbar, .a11y, [data-cookie], [hidden], [inert]';
/** running text (wide screens). The home hero's paragraph ends where the bottom-corner card starts: at
 *  1366×768 the card covered its last line, at 1768×900 it sat 2px under it. Text is only a tie-breaker —
 *  0.1 for a block next to the card, plus up to 2 for the share of the block the card would hide — so a
 *  corner over a link still costs more than one beside a paragraph (the pages where the card was fine keep
 *  their slot), and a completely free top slot (under the header, at the reading start) beats both */
const TEXT = 'p, h1, h2, h3, h4, li, dt, dd, blockquote, figcaption';
/** photos / video / canvas (wide screens): the card may sit fully on one (the home hero) or fully off it, never
 *  half over its edge (the /business photo's top edge) */
const MEDIA = 'img, video, canvas';
const straddles = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top &&
  !(a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1);
const hiddenShare = (a: DOMRect, b: DOMRect) => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, b.width * b.height) : 0;
};
/** tablets / laptops / monitors — phones and landscape phones keep their placement exactly as before */
const wideMQ = matchMedia('(min-width: 769px) and (min-height: 561px)');
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
  const left = new Set<Slot>();

  const slots = (): Slot[] => (env.isMobile() ? ['start', 'top']
    : wideMQ.matches ? ['start', 'end', 'top', 'top-end', 'start:low', 'end:low', 'start:corner', 'end:corner'] : ['start', 'end', 'top']);
  const slotOf = (): Slot => {
    const p = card.dataset.pos || 'start';
    return (card.dataset.edge ? `${p}:${card.dataset.edge}` : p) as Slot;
  };
  const setSlot = (s: Slot) => {
    const [p, edge] = s.split(':');
    if (card.dataset.pos !== p) card.dataset.pos = p;
    if (edge) card.dataset.edge = edge; else if (card.dataset.edge) delete card.dataset.edge;
  };
  const shown = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  const rectsOf = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))
    .filter((b) => !b.closest(CHROME))
    .map((b) => b.getBoundingClientRect())
    .filter(shown);
  /** where the text itself is (a range over the block's contents), not its block box: a short right-aligned
   *  heading in a wide column must not block the other corner */
  const range = document.createRange();
  const textRects = () => Array.from(document.querySelectorAll<HTMLElement>(TEXT))
    .filter((b) => !b.closest(CHROME))
    .map((b) => { const box = b.getBoundingClientRect(); if (!shown(box)) return box; range.selectNodeContents(b); return range.getBoundingClientRect(); })
    .filter(shown);
  /** media actually seen there (not a photo of the next section still under the hero's bottom edge) */
  const mediaRects = () => Array.from(document.querySelectorAll<HTMLElement>(MEDIA))
    .filter((b) => !b.closest(CHROME))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => shown(r));
  const seenAt = (el: Element, a: DOMRect, b: DOMRect) => {
    const x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
    const y = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
    const top = document.elementsFromPoint(x, y).find((e) => !e.closest(CHROME));
    return !!top && (top === el || el.contains(top) || top.contains(el));
  };
  const near = (a: DOMRect, b: DOMRect, m = 8) => b.left < a.right + m && b.right > a.left - m && b.top < a.bottom + m && b.bottom > a.top - m;
  /** 1 touching / overlapping … 0 at m px apart (wide screens: the closer a text block, the more it costs) */
  const closeness = (a: DOMRect, b: DOMRect, m: number) =>
    Math.min(1, Math.max(0, 1 - Math.max(0, b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom) / m));
  const setFloor = (px: number) => card.style.setProperty('--ck-floor', `${Math.round(px)}px`);

  /** what the card would cover in every slot, and the floor for the bottom slots */
  function survey() {
    const H = innerHeight;
    const phone = env.isMobile();
    const avoid = rectsOf(AVOID);
    const press = phone ? [] : rectsOf(PRESS);
    const wide = !phone && wideMQ.matches;
    const text = wide ? textRects() : [];
    const media = wide ? mediaRects() : [];
    // wide screens: a neighbour closer than 16px reads as glued (the /business caption 3px above the card)
    const m = wide ? 16 : 8;
    const floors = avoid.filter((r) => r.bottom >= H - 40 && r.top >= H - 160);
    const floor = floors.length ? Math.max(0, H - Math.min(...floors.map((r) => r.top))) : 0;
    const rest = avoid.filter((r) => !floors.includes(r));
    const pos = slotOf();
    const prevFloor = card.style.getPropertyValue('--ck-floor');
    // measured in place with transitions off, then put back exactly as it was
    card.classList.add('cookie--measure');
    setFloor(floor);
    const cost = new Map<Slot, number>();
    for (const p of slots()) {
      setSlot(p);
      const r = card.getBoundingClientRect();
      let c = 0;
      for (const b of rest) if (near(r, b)) c += PRIMARY;
      for (const b of press) if (near(r, b, m)) c += 1;
      for (const b of text) if (near(r, b, m)) c += 0.1 + 0.2 * closeness(r, b, m) + 2 * Math.min(1, hiddenShare(r, b));
      for (const { el: e, r: b } of media) if (straddles(r, b) && seenAt(e, r, b)) c += 1;
      // desktop: a free bottom corner beats the top; on wide screens a top slot with nothing under it beats a
      // corner beside or over text (the reading-start side first), and the column edge beats the screen corner
      if ((p === 'top' || p === 'top-end') && !phone) c += wide && c === 0 ? (p === 'top' ? 0.05 : 0.07) : 1.5;
      if (p.endsWith(':low')) c += 0.04;
      else if (p.endsWith(':corner')) c += 0.1;
      cost.set(p, c);
    }
    setSlot(pos);
    if (prevFloor) card.style.setProperty('--ck-floor', prevFloor); else card.style.removeProperty('--ck-floor');
    void card.offsetWidth;
    card.classList.remove('cookie--measure');
    return { cost, floor };
  }

  /** the cheapest slot among `allowed` (their order breaks ties) */
  function cheapest(cost: Map<Slot, number>, allowed: Slot[]) {
    let pick: Slot | null = null;
    let c = Infinity;
    for (const p of allowed) { const v = cost.get(p) ?? Infinity; if (v < c - 0.01) { pick = p; c = v; } }
    return { pick, c };
  }

  function reveal(p: Slot, floor: number) {
    state = 'open';
    shownAt = Date.now();
    left.clear();
    // keyboard order: right after the skip link (Tab reaches the choice before the page)
    const skip = document.querySelector('.skip-link');
    if (skip?.parentElement === document.body) skip.after(card);
    else document.body.prepend(card);
    card.classList.add('cookie--measure');
    setSlot(p);
    setFloor(floor);
    void card.offsetWidth;
    card.classList.remove('cookie--measure');
    card.removeAttribute('data-wait');
    requestAnimationFrame(() => requestAnimationFrame(() => { if (state === 'open') card.setAttribute('data-shown', ''); }));
  }

  function move(p: Slot, floor: number) {
    left.add(slotOf());
    const jump = () => {
      card.classList.add('cookie--measure');
      setSlot(p);
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
    if (!all.includes(slotOf())) setSlot('start'); // desktop → phone width (or a wide-only slot → narrower)
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
    const cur = slotOf();
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
    setSlot('start');
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
