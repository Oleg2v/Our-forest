/* Choice steps: species · carpentry item · workshop · date · seats · occasion · location · extras */
import { he } from '../content/he';
import { priceHtml, ilDate } from '../core/format';
import { track } from '../core/analytics';
import { sound } from '../core/sound';
import { gsap, EASE } from '../core/gsap';
import { scrollTo } from '../core/scroll';
import type { ForestMapHandle, SpeciesId } from '../components/forest-map';
import { pictureHtml } from '../content/images';
import { radioGroup, escapeHtml } from './a11y';
import { icon, treeSvg, type IconName } from './art';
import {
  BENCH_ITEMS, WORKSHOPS, CORNER_PARTS, EXTRAS, MAX_SEATS, extrasFor, extraTitle, extraText, workshopDates,
  speciesName, type ExtraId, type BenchItemId, type WorkshopId, type OccasionId,
} from './catalog';
import { clampSeats } from './store';
import { spotFits, spotKinds } from './spots';
import type { Ctx, StepView } from './types';

const tick = () => { sound.play('click'); sound.haptic(8); };

/* ---------------- 1. species ---------------- */
export function speciesStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  const corner = ctx.store.get().product === 'corner';
  body.innerHTML = `
    <div class="pcs-grid pcs-grid--species" aria-labelledby="${titleId}">
      ${he.plant.species.map((s) => `
        <div class="pcs-card pcs-card--species" role="radio" data-value="${s.id}" aria-checked="false" tabindex="-1">
          <span class="pcs-card__art">${treeSvg(s.id as SpeciesId, { details: 7, className: 'pcs-card__svg' })}</span>
          <span class="pcs-card__name">${s.name}</span>
          <span class="pcs-card__text">${s.text}</span>
          <span class="pcs-card__mark">${icon('check')}</span>
        </div>`).join('')}
    </div>
    ${corner ? `
    <div class="pcs-parts">
      <p class="pcs-parts__label">${he.participate.cards[3].text}</p>
      <ul class="pcs-parts__list">
        ${CORNER_PARTS.map((p, i) => `<li>${icon((['tree', 'herbs', 'seat', 'lantern', 'plaque'] as IconName[])[i])}<span>${p}</span></li>`).join('')}
      </ul>
    </div>` : ''}`;
  const group = body.querySelector<HTMLElement>('.pcs-grid')!;
  const rg = radioGroup(group, (v) => {
    if (v === ctx.store.get().species) return;
    tick();
    ctx.store.set({ species: v as SpeciesId });
    track('select_item', { item_list_id: 'species', item_id: v, item_name: speciesName(v as SpeciesId) });
  });
  rg.set(ctx.store.get().species);
  return {
    id: 'species', el,
    update(s, p) { if (s.species !== p.species) rg.set(s.species); },
  };
}

/* ---------------- 1b. carpentry item ---------------- */
export function itemStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  body.innerHTML = `
    <p class="pcs-lead">${he.participate.cards[1].text}</p>
    <div class="pcs-grid pcs-grid--items" aria-labelledby="${titleId}">
      ${BENCH_ITEMS.map((b) => `
        <div class="pcs-card pcs-card--item" role="radio" data-value="${b.id}" aria-checked="false" tabindex="-1">
          <span class="pcs-card__icon">${icon(b.id as IconName, 'icon pcs-card__ico')}</span>
          <span class="pcs-card__name">${b.label}</span>
          <span class="pcs-card__price">${priceHtml(b.price, { from: true })}</span>
          <span class="pcs-card__mark">${icon('check')}</span>
        </div>`).join('')}
    </div>`;
  const rg = radioGroup(body.querySelector<HTMLElement>('.pcs-grid')!, (v) => {
    tick();
    const s = ctx.store.get();
    // a place picked for another item (a table spot for a bench…) has to be picked again
    ctx.store.set({ item: v as BenchItemId, ...(s.spot && !spotFits(s.spot, s.product, v as BenchItemId) ? { spot: '' } : {}) });
    track('select_item', { item_list_id: 'carpentry', item_id: v });
  });
  rg.set(ctx.store.get().item);
  return { id: 'item', el, update(s, p) { if (s.item !== p.item) rg.set(s.item); } };
}

/* ---------------- workshop: which ---------------- */
const WS_IMG = { carpentry: 'wsCarpentry', dogs: 'wsDogs', garden: 'wsGarden' } as const;
const WS_ICON: Record<WorkshopId, IconName> = { carpentry: 'bench', dogs: 'dog', garden: 'sprout' };
export function workshopStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  body.innerHTML = `
    <div class="pcs-list" aria-labelledby="${titleId}">
      ${WORKSHOPS.map((w) => `
        <div class="pcs-row pcs-row--ws" role="radio" data-value="${w.id}" aria-checked="false" tabindex="-1">
          <span class="pcs-row__thumb leaf-sm">${pictureHtml(WS_IMG[w.id], { sizes: '120px', className: 'cover' })}<span class="pcs-row__thumb-ico">${icon(WS_ICON[w.id])}</span></span>
          <span class="pcs-row__main"><span class="pcs-row__title">${w.title}</span>
          <span class="pcs-row__meta">${priceHtml(w.price)} ${he.pricing.perParticipant}</span></span>
          <span class="pcs-card__mark">${icon('check')}</span>
        </div>`).join('')}
    </div>`;
  const rg = radioGroup(body.querySelector<HTMLElement>('.pcs-list')!, (v) => {
    tick();
    const ws = v as WorkshopId;
    ctx.store.set({ ws, date: workshopDates(ws)[0] });
    track('select_item', { item_list_id: 'workshops', item_id: ws });
  });
  rg.set(ctx.store.get().ws);
  return { id: 'workshop', el, update(s, p) { if (s.ws !== p.ws) rg.set(s.ws); } };
}

const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long' });
export function seatsLeftFor(ws: WorkshopId, date: string) {
  const w = WORKSHOPS.find((x) => x.id === ws)!;
  const i = Math.max(0, workshopDates(ws).indexOf(date));
  return w.seats[i] ?? 6;
}
export function dateStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  let rg: ReturnType<typeof radioGroup> | null = null;
  const render = () => {
    const s = ctx.store.get();
    const w = WORKSHOPS.find((x) => x.id === s.ws)!;
    body.innerHTML = `
      <p class="pcs-lead">${w.title}</p>
      <div class="pcs-list" aria-labelledby="${titleId}">
        ${workshopDates(s.ws).map((d) => {
          const left = seatsLeftFor(s.ws, d);
          const dt = new Date(`${d}T12:00:00`);
          return `<div class="pcs-row pcs-row--date" role="radio" data-value="${d}" aria-checked="false" tabindex="-1">
            <span class="pcs-row__ico">${icon('calendar')}</span>
            <span class="pcs-row__main"><span class="pcs-row__title">${weekday.format(dt)}, <bdi>${ilDate(dt)}</bdi></span>
            <span class="pcs-row__meta"><bdi>09:00–13:00</bdi></span></span>
            <span class="pcs-row__seats${left <= 3 ? ' is-low' : ''}">${he.workshops.seatsLeft(left)}</span>
            <span class="pcs-card__mark">${icon('check')}</span>
          </div>`;
        }).join('')}
      </div>`;
    rg?.destroy();
    rg = radioGroup(body.querySelector<HTMLElement>('.pcs-list')!, (v) => {
      tick();
      const left = seatsLeftFor(ctx.store.get().ws, v);
      ctx.store.set({ date: v, seats: Math.min(ctx.store.get().seats, left) });
    });
    rg.set(s.date);
  };
  render();
  return { id: 'date', el, update(s, p) { if (s.ws !== p.ws) render(); else if (s.date !== p.date) rg?.set(s.date); } };
}

export function seatsStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  body.innerHTML = `
    <div class="pcs-seats">
      <button type="button" class="pcs-seats__btn" data-d="-1" aria-label="פחות משתתפים">${icon('minus')}</button>
      <output class="pcs-seats__n num" aria-live="polite"></output>
      <button type="button" class="pcs-seats__btn" data-d="1" aria-label="עוד משתתף">${icon('plus')}</button>
    </div>
    <p class="pcs-seats__calc"></p>`;
  const out = body.querySelector('output')!;
  const calc = body.querySelector('.pcs-seats__calc')!;
  const [minus, plus] = Array.from(body.querySelectorAll<HTMLButtonElement>('.pcs-seats__btn'));
  const max = () => Math.min(MAX_SEATS, seatsLeftFor(ctx.store.get().ws, ctx.store.get().date));
  const paint = () => {
    const s = ctx.store.get();
    const w = WORKSHOPS.find((x) => x.id === s.ws)!;
    out.textContent = String(s.seats);
    out.setAttribute('aria-label', `${s.seats} משתתפים`);
    // one isolate in a fixed order ("2 × 280 ₪"), as in the summary row
    calc.innerHTML = `<bdi>${s.seats} × ${priceHtml(w.price)}</bdi> · ${he.workshops.seatsLeft(seatsLeftFor(s.ws, s.date))}`;
    minus.disabled = s.seats <= 1;
    plus.disabled = s.seats >= max();
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.pcs-seats__btn');
    if (!b || b.disabled) return;
    tick();
    const n = Math.min(max(), clampSeats(ctx.store.get().seats + Number(b.dataset.d)));
    ctx.store.set({ seats: n });
    if (ctx.motion()) gsap.fromTo(out, { yPercent: Number(b.dataset.d) > 0 ? 30 : -30, opacity: 0.3 }, { yPercent: 0, opacity: 1, duration: 0.4 * ctx.speed(), ease: EASE.appear });
  });
  paint();
  return { id: 'seats', el, update: paint };
}

/* ---------------- 2. occasion ---------------- */
export function occasionStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  body.innerHTML = `
    <div class="pcs-chips" aria-labelledby="${titleId}">
      ${he.plant.occasions.map((o) => `<div class="chip pcs-chip" role="radio" data-value="${o.id}" aria-checked="false" tabindex="-1">${o.label}</div>`).join('')}
    </div>`;
  const group = body.querySelector<HTMLElement>('.pcs-chips')!;
  const rg = radioGroup(group, (v) => {
    tick();
    const cur = ctx.store.get().occasion;
    // a second tap on the chosen chip clears it (the step is optional)
    if (cur === v) { ctx.store.set({ occasion: '' }); rg.set(''); return; }
    ctx.store.set({ occasion: v as OccasionId });
    if (v !== 'memorial' && ctx.motion()) {
      const chip = group.querySelector<HTMLElement>(`[data-value="${v}"]`);
      if (chip) gsap.fromTo(chip, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: EASE.game });
    }
  });
  rg.set(ctx.store.get().occasion);
  return { id: 'occasion', el, update(s, p) { if (s.occasion !== p.occasion) rg.set(s.occasion); } };
}

/* ---------------- 4. location ---------------- */
export function locationStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  body.innerHTML = `
    <div class="pcs-loc" aria-labelledby="${titleId}">
      <div class="pcs-opt" role="radio" data-value="auto" aria-checked="false" tabindex="-1">
        <span class="pcs-opt__ico">${icon('leaf')}</span><span class="pcs-opt__title">${he.plant.location.forUs}</span>
        <span class="pcs-card__mark">${icon('check')}</span>
      </div>
      <div class="pcs-opt" role="radio" data-value="map" aria-checked="false" tabindex="-1">
        <span class="pcs-opt__ico">${icon('map')}</span><span class="pcs-opt__title">${he.plant.location.map}</span>
        <span class="pcs-card__mark">${icon('check')}</span>
      </div>
    </div>
    <p class="pcs-lost" hidden>${icon('pin')}<span></span></p>
    <div class="pcs-mapwrap" data-open="false">
      <div class="pcs-mapwrap__inner">
        <div class="pcs-map" data-lenis-prevent hidden></div>
        <div class="pcs-map pcs-map--mini" hidden></div>
        <p class="pcs-spot" aria-live="polite"></p>
      </div>
    </div>`;
  const wrap = body.querySelector<HTMLElement>('.pcs-mapwrap')!;
  const mapEl = body.querySelector<HTMLElement>('.pcs-map:not(.pcs-map--mini)')!;
  const miniEl = body.querySelector<HTMLElement>('.pcs-map--mini')!;
  const spotOut = body.querySelector<HTMLElement>('.pcs-spot')!;
  const lostEl = body.querySelector<HTMLElement>('.pcs-lost')!;
  let map: ForestMapHandle | null = null;
  let fallback: ReturnType<typeof radioGroup> | null = null;
  /** a ?spot= from the link that is taken / unknown: said once, until something is chosen */
  let lost = ctx.lostSpot;
  // micro-copy
  if (lost) lostEl.querySelector('span')!.innerHTML = `המקום <bdi>${escapeHtml(lost)}</bdi> כבר לא פנוי. נבחר לכם מקום טוב, או שתבחרו אחר במפה.`;

  const kinds = () => { const s = ctx.store.get(); return spotKinds(s.product, s.item); };
  let kindsKey = '';
  const onSpot = (id: string) => {
    tick();
    lost = '';
    ctx.store.set({ spot: id, spotMode: 'map' });
  };
  // the map component (and its CSS) loads the first time someone opens it — not on the page's critical path;
  // if it cannot load or render, our own mini plan of free spots does the job
  let loading = false;
  const ensureMap = () => {
    if (map || fallback || loading) return;
    loading = true;
    mapEl.hidden = false;
    mapEl.setAttribute('aria-busy', 'true');
    import('../components/forest-map').then(({ createForestMap }) => {
      loading = false;
      mapEl.removeAttribute('aria-busy');
      if (!el.isConnected) return; // the steps were rebuilt meanwhile (another product)
      const s = ctx.store.get();
      kindsKey = kinds().join();
      map = createForestMap(mapEl, { mode: 'picker', kinds: kinds(), initialSpotId: s.spot || undefined, onSelect: (spot) => onSpot(spot.id) });
      if (s.spot) map.select(s.spot);
      if (mapEl.childElementCount === 0) { map.destroy(); map = null; mapEl.hidden = true; buildFallback(); }
    }).catch((e) => {
      loading = false;
      console.warn('[plant] forest map failed, using the mini plan', e);
      mapEl.removeAttribute('aria-busy');
      mapEl.hidden = true;
      if (el.isConnected) buildFallback();
    });
  };
  /** carpentry: another item can be placed on other kinds of free places → a fresh picker */
  const refreshKinds = () => {
    if (!map || kindsKey === kinds().join()) return;
    map.destroy(); map = null;
    mapEl.innerHTML = '';
    if (ctx.store.get().spotMode === 'map') ensureMap();
  };
  const buildFallback = () => {
    miniEl.hidden = false;
    const mapEl = miniEl;
    const rows = 5, cols = 9;
    const status = (r: number, c: number) => {
      const h = (r * 31 + c * 17 + r * c * 7) % 11;
      return h < 2 ? 'free' : h < 4 ? 'reserved' : 'planted';
    };
    let dots = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const st = status(r, c);
      const id = `0${6 + r}${String(10 + c).padStart(2, '0')}`;
      const x = 40 + c * 40 + (r % 2) * 20, y = 34 + r * 38;
      if (st === 'free') {
        dots += `<g class="pmini__spot" role="radio" data-value="${id}" aria-checked="false" tabindex="-1" aria-label="${he.map.legend.free} · ${id}" transform="translate(${x} ${y})">
          <circle class="pmini__hit" r="19"/><circle class="pmini__pulse" r="9"/><circle class="pmini__ring" r="7"/></g>`;
      } else if (st === 'reserved') dots += `<circle class="pmini__res" cx="${x}" cy="${y}" r="6"/>`;
      else dots += `<circle class="pmini__tree" cx="${x}" cy="${y}" r="7"/>`;
    }
    mapEl.innerHTML = `
      <svg class="pmini" viewBox="0 0 420 220" aria-labelledby="pmini-t">
        <title id="pmini-t">${he.map.title}</title>
        <path class="pmini__path" d="M0 205 C90 190 160 214 240 200 S380 190 420 204" />
        <path class="pmini__path" d="M18 0 C30 60 8 140 24 220" />
        <g class="pmini__dots">${dots}</g>
      </svg>
      <ul class="pmini__legend"><li><i class="is-planted"></i>${he.map.legend.planted}</li><li><i class="is-reserved"></i>${he.map.legend.reserved}</li><li><i class="is-free"></i>${he.map.legend.free}</li></ul>`;
    const g = mapEl.querySelector<SVGGElement>('.pmini__dots')!;
    fallback = radioGroup(g as unknown as HTMLElement, (v) => onSpot(v));
    g.setAttribute('aria-label', he.map.legend.free);
    fallback.set(ctx.store.get().spot || '');
  };

  /* phones: while the map is open on this step the stage folds away, so the map gets a thumb-sized frame */
  const roomy = () => {
    const on = ctx.mobile() && ctx.root.dataset.step === 'location' && ctx.store.get().spotMode === 'map';
    ctx.root.classList.toggle('is-map', on);
  };
  let revealT = 0;
  const revealMap = () => {
    clearTimeout(revealT);
    if (!ctx.mobile()) {
      // desktop: once the frame has opened, bring the options and the whole map into the window
      revealT = window.setTimeout(() => {
        if (ctx.root.dataset.step !== 'location' || ctx.store.get().spotMode !== 'map') return;
        if (mapEl.getBoundingClientRect().bottom > window.innerHeight - 16) {
          const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76;
          scrollTo(optGroup, { offset: -(headerH + 20) });
        }
      }, ctx.motion() ? 700 : 30);
      return;
    }
    const sc = ctx.root.querySelector<HTMLElement>('.pc__scroll');
    if (!sc) return;
    // after the stage has folded and the map has opened (both ~.6 s)
    revealT = window.setTimeout(() => {
      if (ctx.root.dataset.step !== 'location' || ctx.store.get().spotMode !== 'map') return;
      const top = sc.scrollTop + optGroup.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
      sc.scrollTo({ top, behavior: ctx.motion() ? 'smooth' : 'auto' });
    }, ctx.motion() ? 650 : 30);
  };

  const optGroup = body.querySelector<HTMLElement>('.pcs-loc')!;
  const rg = radioGroup(optGroup, (v) => {
    tick();
    lost = '';
    if (v === 'map') { ctx.store.set({ spotMode: 'map' }); ensureMap(); revealMap(); }
    else ctx.store.set({ spotMode: 'auto', spot: '' });
  });
  const paint = () => {
    const s = ctx.store.get();
    rg.set(s.spotMode);
    wrap.dataset.open = String(s.spotMode === 'map');
    lostEl.hidden = !lost || !!s.spot;
    if (s.spotMode === 'map' && ctx.root.dataset.step === 'location') ensureMap();
    if (s.spot) {
      map?.select(s.spot);
      fallback?.set(s.spot);
      spotOut.innerHTML = `${icon('pin')}<span>${he.map.free} · <bdi>${escapeHtml(s.spot)}</bdi></span>`;
    } else spotOut.textContent = s.spotMode === 'map' ? he.map.subtitle : '';
    roomy();
  };
  paint();
  return {
    id: 'location', el,
    enter() {
      roomy();
      if (ctx.store.get().spotMode === 'map') ensureMap();
      // warm the map up for a likely "on the map" tap (one module, cached; nothing is rendered)
      else window.setTimeout(() => { import('../components/forest-map').catch(() => {}); }, 900);
    },
    leave() { clearTimeout(revealT); ctx.root.classList.remove('is-map'); },
    update(s, p) {
      if (s.item !== p.item || s.product !== p.product) refreshKinds();
      if (s.spot !== p.spot || s.spotMode !== p.spotMode) paint();
    },
    validate() {
      const s = ctx.store.get();
      return s.spotMode === 'map' && !s.spot ? `${he.map.choose} — או ${he.plant.location.forUs}` : null;
    },
  };
}

/* ---------------- 5. extras ---------------- */
const EXTRA_ICON: Record<ExtraId, IconName> = { family: 'family', guardians: 'guardians', certificate: 'certificate', box: 'box' };
export function extrasStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const ids = extrasFor(ctx.store.get().product);
  body.innerHTML = `
    <fieldset class="pcs-extras">
      <legend class="sr-only">${el.querySelector('h2')!.textContent}</legend>
      ${ids.map((id) => {
        const e = EXTRAS.find((x) => x.id === id)!;
        const txt = extraText(id);
        return `<label class="pcs-extra">
          <input type="checkbox" class="sr-only" value="${id}">
          <span class="pcs-extra__ico">${icon(EXTRA_ICON[id])}</span>
          <span class="pcs-extra__main"><span class="pcs-extra__title">${extraTitle(id)}</span>${txt ? `<span class="pcs-extra__text">${txt}</span>` : ''}</span>
          <span class="pcs-extra__price">${e.monthly ? priceHtml(e.price, { suffix: he.pricing.perMonth }) : `<bdi>+</bdi>${priceHtml(e.price)}`}</span>
          <span class="pcs-extra__box" aria-hidden="true">${icon('check')}</span>
        </label>`;
      }).join('')}
    </fieldset>`;
  const inputs = Array.from(body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  body.addEventListener('change', (e) => {
    const inp = e.target as HTMLInputElement;
    if (!inp.matches('input[type="checkbox"]')) return;
    tick();
    const extras = inputs.filter((i) => i.checked).map((i) => i.value as ExtraId);
    ctx.store.set({ extras });
    if (inp.checked) {
      const ex = EXTRAS.find((x) => x.id === inp.value)!;
      track('add_to_cart', { currency: 'ILS', value: ex.price, items: [{ item_id: `extra-${inp.value}`, item_name: extraTitle(inp.value as ExtraId), price: ex.price }] });
      const ico = inp.closest('label')?.querySelector('.pcs-extra__ico');
      if (ico && ctx.motion()) gsap.fromTo(ico, { scale: 0.7, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.7 * ctx.speed(), ease: ctx.memorial() ? EASE.soft : EASE.game });
    }
  });
  const paint = () => { const s = ctx.store.get(); inputs.forEach((i) => { i.checked = s.extras.includes(i.value as ExtraId); }); };
  paint();
  return { id: 'extras', el, update(s, p) { if (s.extras !== p.extras) paint(); } };
}
