/* ==========================================================================
   Home section 4 — "Seasons": קונים חוויה, יוצרים השפעה + הסדנאות הקרובות.
   Markup: partials/home/seasons.html · styles: seasons.css · art: seasons-branch.ts
   · list: seasons-workshops.ts

   The one motion idea: travelling through a year. The whole season lives in ONE inherited
   CSS custom property on the section, --sp (0 → 3 = spring → summer → autumn → winter):
   the section's own background, the branch's leaves (young → full → amber → falling) and the
   figs & pomegranates (blossom → green bud → ripe --fruit) are all CSS formulas of it.

   Modes
   · 'pinned'   desktop + motion — the strip is pinned and travels right → left (RTL) while you
                scroll; --sp follows the strip. A ruler of the year marks where you are (click = go there)
                and the season it really is now in Israel.
   · 'carousel' phone (≤ 768px), a phone sideways, a touch tablet held upright — swipe carousel with
                scroll-snap and progress dots; the season follows the swipe (continuous while dragging,
                one season per slide). With reduced motion the palette is the real season and stays put.
   · 'grid'     desktop with reduced motion — no pin; static cards in a grid; the real season.
   The global bg system treats the section as data-bg="season" (we paint our own colours);
   the workshops block carries data-bg="sand" so the page is already sand when the map arrives.
   ========================================================================== */
import './seasons.css';
import { gsap, ScrollTrigger, T, EASE } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { he } from '../../content/he';
import { prices } from '../../content/prices';
import { ils, ilDate, seasonOf, daysBetween, type Season } from '../../core/format';
import { sound } from '../../core/sound';
import { track } from '../../core/analytics';
import { scrollTo, getLenis } from '../../core/scroll';
import { buildBranch, almondArt, WIDE, COMPACT } from './seasons-branch';
import { initWorkshops } from './seasons-workshops';
import { refreshChrome } from '../../chrome';

type Mode = 'pinned' | 'carousel' | 'grid';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
/** season names (functional micro-copy for the ruler / dots) */
const NAME: Record<Season, string> = { spring: 'אביב', summer: 'קיץ', autumn: 'סתיו', winter: 'חורף' };
const NOW_LABEL = 'עכשיו';
/** carousel micro-copy for assistive technology: "קרוסלה", "שקופית", "2 מתוך 4" */
const CAROUSEL = 'קרוסלה';
const SLIDE = 'שקופית';
const OF = 'מתוך';
/** below this viewport height the pinned stage does not fit (seasons.css uses the same 600px) */
const SHORT = 600;
/** Tu BiShvat 2027 (brief: 23 January 2027) */
const TU_BISHVAT = '2027-01-23';

const qs = <T extends Element = HTMLElement>(s: string, r: ParentNode) => r.querySelector<T>(s)!;
const qsa = <T extends Element = HTMLElement>(s: string, r: ParentNode) => Array.from(r.querySelectorAll<T>(s));

/** Run fn once, the first time the trigger is active — entering from above OR from below
    (a deep link such as /#map lands under the section; scrolling back up must still reveal it). */
function whenSeen(trigger: Element, start: string, fn: () => void) {
  ScrollTrigger.create({
    trigger, start, end: 'bottom top',
    onToggle: (self) => { if (self.isActive) { self.kill(); fn(); } },
  });
}

/** Keep the static markup in sync with the single source of copy (src/content/he.ts). */
function syncCopy(root: HTMLElement) {
  qsa<HTMLElement>('[data-he]', root).forEach((el) => {
    const v = el.dataset.he!.split('.').reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), he);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });
  qsa<HTMLElement>('[data-price]', root).forEach((el) => {
    const v = (prices as Record<string, unknown>)[el.dataset.price!];
    if (typeof v === 'number') el.textContent = ils(v);
  });
}

/** aria-current must be "true" (an empty value means false to assistive technology) */
function setCurrent(el: Element, on: boolean) {
  if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
}

/** the season it really is in Israel (dev: ?season=winter) */
function realSeason(): number {
  let s: Season = seasonOf();
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search).get('season') as Season | null;
    if (q && SEASONS.includes(q)) s = q;
  }
  return SEASONS.indexOf(s);
}

class SeasonsSection {
  private readonly root: HTMLElement;
  private readonly pin: HTMLElement;
  private readonly head: HTMLElement;
  private readonly plaque: HTMLAnchorElement | null;
  private readonly branchHost: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly track: HTMLElement;
  private readonly cards: HTMLElement[];
  private readonly ruler: HTMLElement;
  private readonly dots: HTMLElement;
  private readonly headHome: Comment;
  private readonly plaqueHome: Comment;
  private readonly real: number;

  private mode: Mode | null = null;
  private variant: 'wide' | 'compact' | null = null;
  private ctx: gsap.Context | null = null;
  private offs: (() => void)[] = [];
  private sp = -1;
  private seasonIdx = -1;
  private lastSound = 0;
  /** entrances play once per page view — anything already seen stays visible across mode rebuilds */
  private revealed = new WeakSet<Element>();
  private headShown = false;
  private branchShown = false;
  private st: ScrollTrigger | null = null;
  private tlHold = { start: 0.05, end: 0.07 };
  private resizeTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.pin = qs('.seasons__pin', root);
    this.head = qs('.seasons__head', root);
    this.plaque = root.querySelector<HTMLAnchorElement>('[data-plaque]');
    this.branchHost = qs('.seasons__branch', root);
    this.viewport = qs('.seasons__viewport', root);
    this.track = qs('.seasons__track', root);
    this.cards = qsa('.seasons__card', root);
    this.ruler = qs('.seasons__ruler', root);
    this.dots = qs('.seasons__dots', root);
    this.real = realSeason();
    // anchors to put moved nodes back when the mode changes
    this.headHome = document.createComment('seasons:head');
    this.head.before(this.headHome);
    this.plaqueHome = document.createComment('seasons:plaque');
    this.plaque?.before(this.plaqueHome);

    syncCopy(root);
    this.splitTitle();
    this.setupPlaque();
    this.setupRuler();
    this.root.style.setProperty('--sp-real', String(this.real));
    qsa<HTMLAnchorElement>('[data-track]', root).forEach((a) => a.addEventListener('click', () => {
      track('select_item', { item_list_id: 'home_experiences', item_id: a.dataset.track });
    }));
    const ws = root.querySelector<HTMLElement>('.seasons__ws');
    if (ws) initWorkshops(root);

    this.build();
    // the home page starts its sections after the chrome's first reveal scan: the workshop rows were
    // made just now (and got data-reveal) — hand them to the reveal system, after the pin exists
    const rows = root.querySelector('.seasons__rows');
    if (rows) refreshChrome(rows);
    bus.on('motion:change', () => this.build(true));
    const onResize = () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => { if (this.wantMode() !== this.mode) this.build(true); }, 180);
    };
    window.addEventListener('resize', onResize, { passive: true });
  }

  /* ------------------------------------------------------------ helpers */
  private wantMode(): Mode {
    // phones, also turned sideways (a 390px-high landscape screen cannot hold the pinned stage), and
    // touch tablets held upright (the stage is made for a landscape screen; seasons.css: same rules)
    if (env.isMobile() || (env.isTouch && (window.innerHeight < SHORT || window.innerHeight >= window.innerWidth))) return 'carousel';
    // a very short desktop window gets the calm grid instead of a cramped pin
    return env.motionAllowed() && window.innerHeight >= SHORT ? 'pinned' : 'grid';
  }

  /** the only per-frame write: one custom property */
  private setSp(v: number) {
    const sp = Math.round(Math.max(0, Math.min(3, v)) * 1000) / 1000;
    if (sp === this.sp) return;
    this.sp = sp;
    this.root.style.setProperty('--sp', String(sp));
    const idx = Math.round(sp);
    if (idx !== this.seasonIdx) {
      const first = this.seasonIdx < 0;
      this.seasonIdx = idx;
      this.root.dataset.season = SEASONS[idx];
      qsa('.seasons__tick', this.ruler).forEach((b, i) => setCurrent(b, i === idx));
      if (!first && this.mode !== 'grid') {
        const now = performance.now();
        if (now - this.lastSound > 700) { this.lastSound = now; sound.play('rustle', { volume: 0.22 }); }
      }
    }
  }

  /** "קונים חוויה, / יוצרים השפעה" — two lines by design (masks for the entrance) */
  private splitTitle() {
    const title = this.head.querySelector<HTMLElement>('.seasons__title');
    if (!title) return;
    const parts = he.experiences.title.split(/(?<=,)\s+/);
    title.innerHTML = parts.map((p) => `<span class="seasons__tl"><span>${p}</span></span>`).join(' ');
  }

  private headIn(trigger: Element, start: string) {
    if (this.headShown) return;
    const lines = qsa('.seasons__tl > span', this.head);
    const plaque = this.plaque && this.head.contains(this.plaque) ? this.plaque : null;
    if (lines.length) gsap.set(lines, { yPercent: 108 });
    if (plaque) gsap.set(plaque, { opacity: 0, y: 28 });
    whenSeen(trigger, start, () => {
      this.headShown = true;
      if (lines.length) gsap.to(lines, { yPercent: 0, duration: T.appear, ease: EASE.appear, stagger: T.lineStep });
      if (plaque) gsap.to(plaque, { opacity: 1, y: 0, duration: T.appear, ease: EASE.appear, delay: 0.35 });
    });
  }

  private setupPlaque() {
    if (!this.plaque) return;
    const days = -daysBetween(TU_BISHVAT);
    // the seasonal plaque lives only in the ~5 months before the holiday
    if (days < 0 || days > 150) { this.plaque.remove(); return; }
    const date = this.plaque.querySelector<HTMLElement>('[data-tubishvat]');
    if (date) date.textContent = ilDate(TU_BISHVAT);
    const art = this.plaque.querySelector('.seasons__plaque-art svg');
    if (art) art.innerHTML = almondArt();
    this.plaque.addEventListener('click', () => track('select_item', { item_list_id: 'home_seasonal', item_id: 'tubishvat' }));
  }

  private setupRuler() {
    const frag = document.createDocumentFragment();
    SEASONS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seasons__tick';
      b.style.setProperty('--i', String(i));
      b.dataset.i = String(i);
      b.innerHTML = `<span class="seasons__tick-dot" aria-hidden="true"></span><span class="seasons__tick-name">${NAME[s]}</span>`
        + (i === this.real ? `<span class="seasons__tick-now">${NOW_LABEL}</span>` : '');
      b.addEventListener('click', () => this.goToSeason(i));
      frag.appendChild(b);
    });
    this.ruler.appendChild(frag);
  }

  private renderBranch(variant: 'wide' | 'compact') {
    if (this.variant === variant) return;
    this.variant = variant;
    const o = variant === 'wide' ? WIDE : COMPACT;
    this.branchHost.innerHTML = `<svg class="seasons__branch-svg" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="xMaxYMin meet" focusable="false">${buildBranch(o)}</svg>`;
    this.syncUnits();
  }

  /** stroke widths of the drawn (non-scaled) wood stay 1.5 CSS px at any branch size */
  private syncUnits() {
    const svg = this.branchHost.firstElementChild as SVGSVGElement | null;
    if (!svg) return;
    const o = this.variant === 'wide' ? WIDE : COMPACT;
    const wpx = svg.getBoundingClientRect().width || window.innerWidth;
    const hpx = svg.getBoundingClientRect().height || wpx * (o.h / o.w);
    const scale = Math.min(wpx / o.w, hpx / o.h); // "meet"
    svg.style.setProperty('--u', (1 / Math.max(0.2, scale)).toFixed(4));
  }

  /* ------------------------------------------------------------ build / teardown */
  private teardown() {
    this.offs.forEach((fn) => fn());
    this.offs = [];
    this.ctx?.revert();
    this.ctx = null;
    this.st = null;
    // put moved nodes back
    if (this.head.parentElement !== this.headHome.parentElement) this.headHome.after(this.head);
    if (this.plaque && this.plaque.parentElement !== this.plaqueHome.parentElement) this.plaqueHome.after(this.plaque);
    this.root.classList.remove('seasons--pinned', 'seasons--carousel', 'seasons--grid', 'seasons--live');
    this.ruler.hidden = true;
    this.dots.hidden = true;
    this.dots.innerHTML = '';
  }

  private build(rebuild = false) {
    const mode = this.wantMode();
    // a reader inside this section stays here across the rebuild (the pin's spacer comes and goes, which
    // would otherwise drop them a screen or two away, e.g. after "stop animations" in the a11y panel)
    let keep = false;
    if (rebuild) {
      const r = this.root.getBoundingClientRect();
      keep = r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
      this.teardown();
    }
    this.mode = mode;
    const live = env.motionAllowed();
    this.root.classList.add(`seasons--${mode}`);
    this.root.classList.toggle('seasons--live', live && mode !== 'grid');
    this.renderBranch(mode === 'carousel' ? 'compact' : 'wide');
    this.sp = -1; this.seasonIdx = -1;
    this.ctx = gsap.context(() => {
      if (mode === 'pinned') this.buildPinned();
      else if (mode === 'carousel') this.buildCarousel(live);
      else this.setSp(this.real);
    }, this.root);
    this.syncUnits();
    if (!rebuild) return;
    // other pinned sections above rebuild on the same event and refresh in their own frames: re-anchor
    // after every refresh in the next moment, not just after ours
    const anchor = () => {
      const y = Math.round(this.root.getBoundingClientRect().top + window.scrollY);
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    };
    if (keep) {
      ScrollTrigger.addEventListener('refresh', anchor);
      window.setTimeout(() => ScrollTrigger.removeEventListener('refresh', anchor), 1200);
    }
    requestAnimationFrame(() => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
  }

  /* ------------------------------------------------------------ entrance (branch + cards) */
  private branchIn(trigger: Element, start: string) {
    const svg = this.branchHost.firstElementChild;
    if (!svg || this.branchShown) return;
    const stem = qsa<SVGPathElement>('.seasons__stem', svg);
    const fill = qsa('.seasons__stem-fill', svg);
    const twigs = qsa<SVGPathElement>('.seasons__twig, .seasons__stalk', svg);
    // leaves and fruit in order along the branch (--t is inline: no computed style needed)
    const parts = qsa<SVGGElement>('.seasons__lf, .seasons__fr', svg)
      .sort((a, b) => parseFloat(a.style.getPropertyValue('--t')) - parseFloat(b.style.getPropertyValue('--t')));
    gsap.set(stem, { drawSVG: '0%' });
    gsap.set(twigs, { drawSVG: '0%' });
    // each part pops in around its own stalk point (the origin of its translate). GSAP writes the part's
    // transform attribute: only that element restyles per frame. (A custom property here was inherited by
    // every leaf's subtree, so each frame restyled ~5 elements per part with their season formulas.)
    // (set, then to: a from() re-reads the origin through the zero-scale matrix and loses it. The matrix is
    // the product of the attribute's list: "translate() scale()" as written, or GSAP's "matrix()" after a revert)
    const mats = parts.map((el) => {
      const l = el.transform.baseVal;
      let m = l.getItem(0).matrix;
      for (let i = 1; i < l.numberOfItems; i++) m = m.multiply(l.getItem(i).matrix);
      return m;
    });
    gsap.set(parts, { scale: 0, svgOrigin: (i: number) => `${mats[i].e} ${mats[i].f}` });
    gsap.set(fill, { opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    tl.to(stem, { drawSVG: '100%', duration: 1.8, ease: 'power2.inOut' })
      .to(fill, { opacity: 1, duration: 1, ease: EASE.soft }, 1.1)
      .to(twigs, { drawSVG: '100%', duration: 0.7, ease: 'power2.out', stagger: 0.05 }, 0.5)
      .to(parts, { scale: (i: number) => mats[i].a, duration: 0.9, ease: 'back.out(1.6)', stagger: { each: 1.4 / Math.max(1, parts.length) } }, 0.7);
    whenSeen(trigger, start, () => { this.branchShown = true; tl.play(); });
  }

  private hideCard(card: HTMLElement) {
    if (this.revealed.has(card)) return;
    const media = card.querySelector('.seasons__media');
    const img = card.querySelector('.seasons__img');
    const body = qsa(':scope > .seasons__body > *', card);
    gsap.set(media, { clipPath: 'inset(24% 16% 24% 16% round 48px 0px 48px 0px)' });
    gsap.set(img, { scale: 1.2 });
    // opacity only (never visibility): buttons in cards that are not revealed yet stay focusable
    gsap.set(body, { opacity: 0, y: 24 });
  }

  private revealCard(card: HTMLElement, delay = 0) {
    if (this.revealed.has(card)) return;
    this.revealed.add(card);
    const media = card.querySelector<HTMLElement>('.seasons__media')!;
    const img = card.querySelector('.seasons__img');
    const body = qsa(':scope > .seasons__body > *', card);
    const r = parseFloat(getComputedStyle(media).borderTopRightRadius) || 0;
    const rl = parseFloat(getComputedStyle(media).borderTopLeftRadius) || 0;
    // RTL leaf: rounded top-left & bottom-right in --leaf (120px 0 120px 0) → clip mirrors the element's own radius
    const radius = `${rl}px ${r}px ${rl}px ${r}px`;
    const tl = gsap.timeline({ delay });
    tl.to(media, { clipPath: `inset(0% 0% 0% 0% round ${radius})`, duration: T.image, ease: EASE.image })
      .to(img, { scale: 1, duration: T.image, ease: EASE.image }, 0)
      .to(body, { opacity: 1, y: 0, duration: T.appear, ease: EASE.appear, stagger: T.lineStep }, 0.3)
      .add(() => gsap.set(media, { clearProps: 'clipPath' }));
  }

  /** the revealed state at once, no animation (a card off screen) */
  private settleCard(card: HTMLElement) {
    if (this.revealed.has(card)) return;
    this.revealed.add(card);
    gsap.set(card.querySelector('.seasons__media'), { clearProps: 'clipPath' });
    gsap.set(card.querySelector('.seasons__img'), { scale: 1 });
    gsap.set(qsa(':scope > .seasons__body > *', card), { opacity: 1, y: 0 });
  }

  /* ------------------------------------------------------------ desktop: pinned horizontal strip */
  private buildPinned() {
    // the heading becomes the strip's first panel
    const intro = document.createElement('div');
    intro.className = 'seasons__intro';
    intro.appendChild(this.head);
    this.track.prepend(intro);
    this.offs.push(() => { intro.remove(); });
    this.ruler.hidden = false;
    this.setSp(0);

    // the photos take the height the tallest card text leaves above the ruler (on a narrow screen a title
    // can take two lines): measured before every refresh, so the pin's distances include it
    const fitBody = () => {
      const tall = Math.max(...this.cards.map((c) => {
        const body = c.querySelector<HTMLElement>('.seasons__body');
        const shift = parseFloat(getComputedStyle(c).translate.split(' ')[1] ?? '0') || 0; // the stagger
        return (body?.offsetHeight ?? 0) + shift;
      }));
      if (tall > 0) {
        this.pin.style.setProperty('--body-h', `${Math.ceil(tall) + 8}px`);
        this.pin.style.setProperty('--stagger-h', '0px');
      }
    };
    fitBody();
    ScrollTrigger.addEventListener('refreshInit', fitBody);
    this.offs.push(() => {
      ScrollTrigger.removeEventListener('refreshInit', fitBody);
      this.pin.style.removeProperty('--body-h');
      this.pin.style.removeProperty('--stagger-h');
    });

    let entered = false;
    const travel = () => Math.max(0, this.track.scrollWidth - this.viewport.clientWidth);
    const dist = () => Math.max(travel() * 1.75, window.innerHeight * 1.6);
    const imgs = this.cards.map((c) => c.querySelector<HTMLElement>('.seasons__photo'));
    const setters = imgs.map((im) => (im ? gsap.quickSetter(im, 'xPercent') : null));
    // card positions with the strip at x = 0, measured on refresh → no layout reads per frame
    let base: { l: number; w: number }[] = [];
    let tr = 0, vw = window.innerWidth;
    const measure = () => {
      const x = Number(gsap.getProperty(this.track, 'x')) || 0;
      base = this.cards.map((c) => { const b = c.getBoundingClientRect(); return { l: b.left - x, w: b.width }; });
      tr = travel();
      vw = window.innerWidth;
    };
    const update = () => {
      const x = Number(gsap.getProperty(this.track, 'x')) || 0;
      this.setSp(tr > 0 ? (x / tr) * 3 : 0);
      this.cards.forEach((card, i) => {
        const b = base[i];
        if (!b) return;
        const left = b.l + x, right = left + b.w;
        if (right < -40 || left > vw + 40) return;
        const k = gsap.utils.clamp(-1, 1, ((left + b.w / 2) - vw / 2) / (vw * 0.7));
        setters[i]?.(k * -5);
        if (!this.revealed.has(card) && entered && left < vw * 0.92 && right > vw * 0.08) this.revealCard(card);
      });
    };
    measure();
    const H = this.tlHold;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: this.pin,
        pin: true,
        start: 'top top',
        end: () => `+=${dist()}`,
        scrub: 0.6,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onRefresh: () => { this.syncUnits(); measure(); update(); },
      },
    });
    tl.to({}, { duration: H.start })
      .to(this.track, { x: () => travel(), duration: 1 })
      .to({}, { duration: H.end });
    this.st = tl.scrollTrigger ?? null;

    // parallax inside each photo + reveals, all from the same update
    tl.eventCallback('onUpdate', update);

    // first reveals when the section scrolls into view (the strip is still at its start)
    this.cards.forEach((c) => this.hideCard(c));
    this.headIn(this.root, 'top 72%');
    whenSeen(this.root, 'top 62%', () => {
      entered = true;
      const vw = window.innerWidth;
      let n = 0;
      this.cards.forEach((card) => {
        const b = card.getBoundingClientRect();
        if (b.left < vw * 0.92 && b.right > vw * 0.08) this.revealCard(card, 0.25 + 0.12 * n++);
      });
    });
    this.branchIn(this.root, 'top 75%');
    update();

    // keyboard: bring the focused card into the middle of the strip
    const onFocus = (e: FocusEvent) => {
      const card = (e.target as Element).closest<HTMLElement>('.seasons__card, .seasons__intro');
      const st = this.st;
      if (!card || !st) return;
      if (card.classList.contains('seasons__card')) this.revealCard(card);
      const tr = travel();
      if (tr <= 0) return;
      const x = Number(gsap.getProperty(this.track, 'x')) || 0;
      const b = card.getBoundingClientRect();
      const cx0 = b.left + b.width / 2 - x; // centre with the strip at its start
      const want = gsap.utils.clamp(0, tr, window.innerWidth / 2 - cx0);
      const p = (H.start + want / tr) / (H.start + 1 + H.end);
      scrollTo(st.start + (st.end - st.start) * p, { offset: 0 });
    };
    this.track.addEventListener('focusin', onFocus);
    this.offs.push(() => this.track.removeEventListener('focusin', onFocus));
  }

  private goToSeason(i: number) {
    const st = this.st;
    if (!st) return;
    const H = this.tlHold;
    const p = (H.start + i / 3) / (H.start + 1 + H.end);
    scrollTo(st.start + (st.end - st.start) * p, { offset: 0 });
  }

  /* ------------------------------------------------------------ phone: swipe carousel */
  private buildCarousel(live: boolean) {
    // the seasonal plaque becomes the first slide (Tu BiShvat — the trees' new year)
    if (this.plaque) {
      this.plaque.classList.add('seasons__slide');
      this.track.prepend(this.plaque);
      this.offs.push(() => this.plaque?.classList.remove('seasons__slide'));
    }
    // browsers re-snap to the previously snapped card after the prepend — start from the first slide
    this.viewport.scrollLeft = 0;
    requestAnimationFrame(() => { if (Math.abs(this.viewport.scrollLeft) < 40) this.viewport.scrollLeft = 0; });
    const slides = qsa<HTMLElement>(':scope > .seasons__card, :scope > .seasons__plaque', this.track);
    const n = slides.length;
    // progress dots (one per slide) + the season's name
    this.dots.hidden = false;
    const label = (el: HTMLElement) => (el.querySelector('h3')?.textContent ?? he.seasonalBanner.split(':')[0]).trim().replace(/"/g, '&quot;');
    this.dots.innerHTML = `<span class="seasons__dots-row">${slides.map((sl, i) => `<button type="button" class="seasons__dot" data-i="${i}" aria-label="${label(sl)}, ${i + 1} ${OF} ${n}"><span></span></button>`).join('')}</span>`
      + `<span class="seasons__dots-season" aria-hidden="true"></span>`;
    // a carousel for assistive technology too: a named region of slides; the dots say "2 מתוך 4"
    const vpAttrs: [string, string][] = [['role', 'region'], ['aria-roledescription', CAROUSEL], ['aria-label', he.experiences.title]];
    vpAttrs.forEach(([k, v]) => this.viewport.setAttribute(k, v));
    // (the plaque slide is a link and stays announced as one)
    this.cards.forEach((c) => c.setAttribute('aria-roledescription', SLIDE));
    this.offs.push(() => {
      vpAttrs.forEach(([k]) => this.viewport.removeAttribute(k));
      this.cards.forEach((c) => c.removeAttribute('aria-roledescription'));
    });
    const dotEls = qsa<HTMLButtonElement>('.seasons__dot', this.dots);
    const seasonEl = qs('.seasons__dots-season', this.dots);
    let active = -1;
    const vp = this.viewport;

    // the scroll offset at which each slide snaps (RTL: its right edge on the snapport's right edge)
    let snaps: number[] = [];
    const measure = () => {
      const max = Math.max(0, vp.scrollWidth - vp.clientWidth);
      const vb = vp.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(vp).scrollPaddingInlineStart) || 0;
      const sx = Math.abs(vp.scrollLeft);
      snaps = slides.map((sl) => Math.min(max, Math.max(0, sx + (vb.right - pad) - sl.getBoundingClientRect().right)));
    };
    /** fractional slide index: exactly i when slide i is snapped, continuous while dragging */
    const position = () => {
      const sx = Math.abs(vp.scrollLeft);
      for (let i = 0; i < snaps.length - 1; i++) {
        if (sx <= snaps[i + 1] || i === snaps.length - 2) {
          const span = snaps[i + 1] - snaps[i];
          return i + (span > 0 ? Math.max(0, Math.min(1, (sx - snaps[i]) / span)) : 0);
        }
      }
      return 0;
    };
    const update = () => {
      const f = position();
      if (live) this.setSp(n > 1 ? (f / (n - 1)) * 3 : 0); else this.setSp(this.real);
      const i = Math.round(f);
      if (i !== active) {
        if (active >= 0 && live) sound.haptic(8);
        active = i;
        dotEls.forEach((d, k) => setCurrent(d, k === i));
      }
      const s = SEASONS[Math.round(live ? this.sp : this.real)];
      if (seasonEl.textContent !== NAME[s]) seasonEl.textContent = NAME[s];
    };
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
    vp.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => { measure(); update(); });
    ro.observe(vp);
    this.offs.push(() => { vp.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); ro.disconnect(); });
    measure();
    dotEls.forEach((d) => d.addEventListener('click', () => {
      const s = slides[Number(d.dataset.i)];
      const b = s.getBoundingClientRect(), vb = vp.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(vp).scrollPaddingInlineStart) || 0;
      // RTL: align the slide's right edge with the viewport's right edge (minus scroll padding)
      vp.scrollBy({ left: b.right - (vb.right - pad), behavior: env.motionAllowed() ? 'smooth' : 'auto' });
    }));
    update();

    if (live) {
      this.headIn(this.root, 'top 78%');
      this.cards.forEach((c) => this.hideCard(c));
      const plaque = this.plaque && this.track.contains(this.plaque) && !this.revealed.has(this.plaque) ? this.plaque : null;
      if (plaque) { gsap.set(plaque, { opacity: 0, y: 32 }); this.revealed.add(plaque); }
      whenSeen(vp, 'top 82%', () => {
        let k = 0;
        if (plaque) gsap.to(plaque, { opacity: 1, y: 0, duration: T.appear, ease: EASE.appear, delay: 0.1 + 0.12 * k++ });
        // only the slides on screen play their entrance; the ones further along the strip are simply there
        // when swiped to (an unseen clip-path reveal still repaints the strip on every frame)
        const vb = vp.getBoundingClientRect();
        this.cards.forEach((c) => {
          const b = c.getBoundingClientRect();
          if (b.right > vb.left + 1 && b.left < vb.right - 1) this.revealCard(c, 0.1 + 0.12 * k);
          else this.settleCard(c);
          k++;
        });
      });
      this.branchIn(this.branchHost, 'top 85%');
    }
  }
}

export function initSeasons(): void {
  const root = document.querySelector<HTMLElement>('section.seasons');
  if (!root) return;
  try {
    new SeasonsSection(root);
  } catch (e) {
    console.error('[seasons]', e);
  }
}
