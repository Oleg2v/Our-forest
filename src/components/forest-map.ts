/* ==========================================================================
   Forest map — owned by the home "map" agent.
   Illustrated plan of the plot (inline SVG): paths, fire place, kitchen, dog yard, tree rows.
   Data: src/data/trees.json. Three states: planted (olive crown), reserved (outline),
   free (--fruit ring, soft pulse). Clusters when zoomed out. Zoom/pan only after a click
   on the map (never hijack page scroll). Text list of trees for screen readers.
   mode 'home'   — full map with filters, hover cards, click free spot → /plant?spot=ID
                   (phones: tap → the map goes full screen, tap a tree → bottom sheet)
   mode 'picker' — used inside the configurator step "איפה הוא יגדל?": only free spots
                   are selectable; onSelect(spot) is called; no navigation.
   Self-contained: imports its own CSS. Helpers live in ./forest-map/*.
   ========================================================================== */
import './forest-map.css';
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { lockScroll, unlockScroll } from '../core/scroll';
import { sound } from '../core/sound';
import { track } from '../core/analytics';
import { ilDate } from '../core/format';
import { he } from '../content/he';
import { navigate } from '../chrome';
import {
  SPOTS, SPECIES_IDS, speciesName, speciesTitle, MC, cardHtml, spotHref, spotLabel, zonesOf, priceFor, occasionLabel, KIND_LABEL, type Zone,
} from './forest-map/data';
import { envArt, plotArt, labelArt, ROAD_TOP } from './forest-map/art';
import { spotInner, type SpotGeom } from './forest-map/spots';
import { Camera, type CamState, type Rect } from './forest-map/camera';
import { PLAN, PLAN_LABELS, type Pt } from './forest-map/plan';
import { icon, speciesIcon } from './forest-map/icons';
import { hull, inflate, resample, wobble, smooth, rng } from './forest-map/sketch';
import { ils } from '../core/format';

export type SpotStatus = 'planted' | 'reserved' | 'free';
export type SpotKind = 'tree' | 'bench' | 'corner' | 'fire' | 'table';
export type SpeciesId = 'olive' | 'fig' | 'pomegranate' | 'carob' | 'almond' | 'mulberry';
export interface Spot {
  id: string;            // "0427"
  kind: SpotKind;
  status: SpotStatus;
  x: number; y: number;  // map coordinates (plan units, see forest-map/plan.ts)
  species?: SpeciesId;
  occasion?: string;     // occasion id (see he.plant.occasions)
  dedication?: string;
  plantedBy?: string;
  date?: string;         // ISO yyyy-mm-dd (reserved: planned planting day)
  public?: boolean;      // is the dedication public
  zone?: string;         // grove (cluster) id
  row?: string;          // contour row id
  rot?: number;          // furniture rotation (deg)
}
export interface ForestMapHandle {
  destroy(): void;
  select(id: string): void;
  getSelected(): Spot | null;
}
export interface ForestMapOptions {
  mode: 'home' | 'picker';
  onSelect?: (spot: Spot) => void;
  initialSpotId?: string;
  /** picker: which free objects can be chosen (default: from ?product= — bench → bench/table/fire, corner → corner, else tree) */
  kinds?: SpotKind[];
  /** draw-in animation the first time the map is seen (default: home) */
  intro?: boolean;
  /** phones: activating the map expands it to full screen (default: home on touch devices) */
  fullscreen?: boolean;
}

/** read-only access to the demo data (e.g. for a list elsewhere) */
export const forestSpots: readonly Spot[] = SPOTS;

const PLAN_RECT: Rect = { x0: -8, y0: 0, x1: PLAN.w + 8, y1: PLAN.h + 24 };
let seq = 0;

function kindsFromUrl(): SpotKind[] {
  const p = new URLSearchParams(location.search).get('product');
  if (p === 'bench') return ['bench', 'table', 'fire'];
  if (p === 'corner') return ['corner'];
  return ['tree'];
}

export function createForestMap(el: HTMLElement, opts: ForestMapOptions = { mode: 'home' }): ForestMapHandle {
  const picker = opts.mode === 'picker';
  const touch = env.isTouch;
  const motion = () => env.motionAllowed();
  const kinds: SpotKind[] = opts.kinds ?? (picker ? kindsFromUrl() : ['tree', 'bench', 'table', 'fire', 'corner']);
  const fullscreen = opts.fullscreen ?? (!picker && touch);
  const uid = `fm${++seq}`;
  const spots = SPOTS;
  const byId = new Map(spots.map((s) => [s.id, s]));
  const selectable = (s: Spot) => s.status === 'free' && kinds.includes(s.kind);
  /** keyboard-reachable spots: free places (home) / selectable places (picker) */
  const navigable = spots.filter(selectable);
  const geom = new Map<string, SpotGeom>();
  const zones: Zone[] = zonesOf(spots.filter((s) => s.kind === 'tree'));
  const zoneOf = new Map<string, Zone>();
  zones.forEach((z) => z.spots.forEach((s) => zoneOf.set(s.id, z)));
  /** trees gather into groves when zoomed out — pointless in a picker where only benches or corners can be chosen */
  const clusters = !picker || kinds.includes('tree');
  /** cluster below this zoom (screen px per plan unit): finger targets need more room */
  const thr = !clusters ? 0 : touch ? 0.6 : picker ? 0.3 : 0.42;
  /** a comfortable zoom to look at one place (independent of clustering) */
  const zk = touch ? 0.6 : picker ? 0.3 : 0.42;

  /* one set of numbers everywhere (legend, list groups, screen-reader summary):
     planted = trees in the ground, the built benches are their own group in the list;
     reserved / free = every reserved / free place on the plan */
  const counts = {
    planted: spots.filter((s) => s.kind === 'tree' && s.status === 'planted').length,
    reserved: spots.filter((s) => s.status === 'reserved').length,
    free: spots.filter((s) => s.status === 'free').length,
  };

  /* ------------------------------------------------------------------ markup */
  const spotsHtml = spots.map((s) => {
    const g = spotInner(s, touch);
    geom.set(s.id, g.geom);
    const sel = selectable(s);
    const cls = ['fmap__spot', `is-${s.status}`, `k-${s.kind}`, s.species ? `sp-${s.species}` : '', picker && !sel ? 'is-muted' : ''].filter(Boolean).join(' ');
    let attrs = `data-id="${s.id}" transform="translate(${s.x} ${s.y})"`;
    if (sel) {
      attrs += ` role="${picker ? 'radio' : 'button'}" tabindex="-1" aria-label="${spotLabel(s)}"`;
      if (picker) attrs += ' aria-checked="false"';
      attrs += ` data-cursor="${he.cursor.plant}"${picker ? '' : ' data-cursor-fill="fruit"'}`;
    } else attrs += ' aria-hidden="true"';
    return `<g class="${cls}" ${attrs}><g class="fmap__m"><g class="fmap__a">${g.html}</g></g></g>`;
  }).join('');

  /* the soft pulse lives in a composited HTML layer under the SVG (no SVG repaints per frame) */
  const glowSpots = spots.filter((s) => (picker ? selectable(s) : s.status === 'free'));
  const glowHtml = glowSpots.map((s, i) => {
    const r = geom.get(s.id)!.r;
    return `<i class="fmap__g${s.kind === 'corner' ? ' fmap__g--wide' : ''}${s.kind === 'tree' ? '' : ' fmap__g--obj'}" data-id="${s.id}" style="--r:${r};--d:${((i * 0.618) % 1 * 3.4).toFixed(2)}"></i>`;
  }).join('');

  const canopyHtml = zones.map((z) => {
    const r = rng(z.id.charCodeAt(1) * 97);
    const h = inflate(hull(z.spots.map((s) => [s.x, s.y] as Pt)), 34);
    const d = smooth(wobble(resample(h, 30), r, 4, 30, true), true, 0.9);
    return `<path class="fmap__canopy" data-zone="${z.id}" d="${d}"/>`;
  }).join('');
  const clusterHtml = zones.map((z) => `<g class="fmap__cluster" data-zone="${z.id}" transform="translate(${z.cx.toFixed(1)} ${z.cy.toFixed(1)})">
      <g class="fmap__cs"><circle class="fmap__cl-hit" r="34"/><circle class="fmap__cl-bg" r="25"/>
      <text class="fmap__cl-n" text-anchor="middle" dominant-baseline="central"></text>
      <g class="fmap__cl-free" transform="translate(-21 -19)"><circle r="11"/><text text-anchor="middle" dominant-baseline="central"></text></g></g></g>`).join('');

  const keySvg = (k: 'planted' | 'reserved' | 'free') => `<svg class="fmap__key fmap__key--${k}" viewBox="-14 -14 28 28" aria-hidden="true">${
    k === 'free' ? '<circle class="fmap__ring" r="9"/><circle class="fmap__seed" r="2.6"/>'
      : k === 'reserved' ? '<circle class="fmap__crown fmap__crown--reserved" r="9.5"/><path class="fmap__stake" d="M-3 -3l6 6M3 -3l-6 6"/>'
        : '<path class="fmap__crown" d="M-9 0Q-11 -8 -3 -10Q4 -13 8 -6Q13 1 7 7Q1 12 -5 8Q-12 6 -9 0Z"/><circle class="fmap__trunk" r="1.8"/>'}</svg>`;

  const barHtml = picker ? '' : `
    <div class="fmap__bar">
      <div class="fmap__chips" role="group" aria-label="${MC.bySpecies}">
        <button type="button" class="fmap__chip" data-species="" aria-pressed="true">${MC.all}</button>
        ${SPECIES_IDS.map((id) => `<button type="button" class="fmap__chip" data-species="${id}" aria-pressed="false">${speciesIcon(id, 'icon fmap__chip-ico')}<span>${speciesName(id)}</span></button>`).join('')}
      </div>
      <div class="fmap__bar-end">
        <label class="fmap__select"><span class="visually-hidden">${MC.byOccasion}</span>
          <select data-occasion><option value="">${MC.byOccasion}</option>${he.plant.occasions.map((o) => `<option value="${o.id}">${o.label}</option>`).join('')}</select>
          <svg class="icon fmap__select-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>
        </label>
        <button type="button" class="fmap__toggle" aria-pressed="false" aria-controls="${uid}-list">${icon('list')}<span>${MC.list}</span></button>
      </div>
    </div>`;

  /* the text list: 170 places, about half of the map's elements. Its box is in the markup at once; its
     content comes in an idle moment after the map (see fillList), so the build stays half as heavy */
  const listHtml = picker ? '' : `<div class="fmap__list" id="${uid}-list" data-lenis-prevent aria-label="${MC.listTitle}" role="region"></div>`;
  const listInner = () => {
    const free = spots.filter((s) => s.status === 'free');
    const byDate = (a: Spot, b: Spot) => (b.date ?? '').localeCompare(a.date ?? '');
    const planted = spots.filter((s) => s.status === 'planted' && s.kind === 'tree').sort(byDate);
    const built = spots.filter((s) => s.status === 'planted' && s.kind !== 'tree').sort(byDate);
    const reserved = spots.filter((s) => s.status === 'reserved');
    const li = (s: Spot) => {
      if (s.status === 'free') {
        const p = priceFor(s);
        const what = s.kind === 'tree' ? '' : `${s.kind === 'corner' ? he.participate.cards[3].title : KIND_LABEL[s.kind]} · `;
        return `<li data-id="${s.id}"><a class="fmap__li fmap__li--free" href="${spotHref(s)}"><span class="fmap__li-dot" aria-hidden="true"></span><span class="fmap__li-main">${s.kind === 'tree' ? `<span class="visually-hidden">${he.map.free}, </span>` : ''}${what}<bdi>${MC.spot(s.id)}</bdi></span><span class="fmap__li-price">${p.from ? 'החל מ־' : ''}<bdi class="price">${ils(p.n)}</bdi></span></a></li>`;
      }
      const ded = s.public && s.dedication ? s.dedication : MC.private;
      const meta = s.status === 'reserved'
        ? `${he.map.legend.reserved}${s.date ? ` · ${he.tree.states.plantingIn(Math.max(0, Math.ceil((new Date(`${s.date}T12:00:00`).getTime() - Date.now()) / 86400000)))}` : ''}`
        : s.kind !== 'tree'
          // a built bench: its date (the card shows the same), never "ניטע"
          ? (s.date ? `<bdi>${ilDate(s.date)}</bdi>` : '')
          : [s.date ? he.map.plantedOn(`<bdi>${ilDate(s.date)}</bdi>`) : '', s.occasion ? occasionLabel(s.occasion) : ''].filter(Boolean).join(' · ');
      return `<li data-id="${s.id}"><div class="fmap__li">${s.species ? speciesIcon(s.species, 'icon fmap__li-ico') : icon('bench', 'icon fmap__li-ico')}<span class="fmap__li-main"><b>${s.kind === 'tree' ? speciesTitle(s.species) : KIND_LABEL[s.kind]}</b> <bdi class="fmap__li-num">${s.kind === 'tree' ? he.tree.number(s.id) : MC.spot(s.id)}</bdi>${s.status === 'planted' ? `<span class="fmap__li-ded">${ded}${s.public && s.plantedBy ? ` · ${s.plantedBy}` : ''}</span>` : ''}</span><span class="fmap__li-meta">${meta}</span></div></li>`;
    };
    const group = (title: string, list: Spot[], key: string, lead = '') => `<section class="fmap__lg" data-group="${key}"><h3 class="fmap__lg-t">${title} <span class="fmap__lg-n">${list.length}</span></h3>${lead}<ul class="fmap__lu fmap__lu--${key}" role="list">${list.map(li).join('')}</ul></section>`;
    return `${group(he.map.legend.planted, planted, 'planted')}${built.length ? group(he.participate.cards[1].title, built, 'built') : ''}${group(he.map.legend.reserved, reserved, 'reserved')}${group(he.map.legend.free, free, 'free', `<p class="fmap__lg-lead">${he.map.subtitle}</p>`)}`;
  };

  const sheetHtml = !fullscreen ? '' : `
    <div class="fmap__sheet" role="dialog" aria-modal="false" aria-labelledby="${uid}-sheet-t" hidden>
      <div class="fmap__sheet-grip" aria-hidden="true"><span></span></div>
      <button type="button" class="fmap__sheet-x" aria-label="${MC.close}">${icon('close')}</button>
      <div class="fmap__sheet-body" id="${uid}-sheet-t"></div>
    </div>`;

  el.classList.add('fmap', `fmap--${opts.mode}`);
  if (touch) el.classList.add('fmap--touch');
  el.innerHTML = `${barHtml}
    <div class="fmap__slot">
      <div class="fmap__frame" tabindex="-1">
        <div class="fmap__view" data-cursor="${he.cursor.look}">
          <div class="fmap__glow" aria-hidden="true">${glowHtml}</div>
          <svg class="fmap__svg fmap__svg--art" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <g class="fmap__cam"><g class="fmap__world">${envArt()}${plotArt(spots)}</g></g>
          </svg>
          <svg class="fmap__svg fmap__svg--top" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${MC.mapLabel}" aria-describedby="${uid}-sum">
            <g class="fmap__cam"><g class="fmap__world">
              <g class="fmap__canopies" aria-hidden="true">${canopyHtml}</g>
              <g class="fmap__spots" role="${picker ? 'radiogroup' : 'group'}" aria-label="${MC.freeGroup}">${spotsHtml}</g>
              <g class="fmap__clusters" aria-hidden="true">${clusterHtml}</g>
              ${labelArt()}
            </g></g>
          </svg>
        </div>
        <div class="fmap__card" id="${uid}-card" hidden></div>
        <div class="fmap__ui">
          <div class="fmap__zoom">
            <button type="button" class="fmap__zb" data-zoom="in" aria-label="${MC.zoomIn}">${icon('plus')}</button>
            <button type="button" class="fmap__zb" data-zoom="out" aria-label="${MC.zoomOut}">${icon('minus')}</button>
            <button type="button" class="fmap__zb" data-zoom="fit" aria-label="${MC.fit}">${icon('fit')}</button>
          </div>
          <ul class="fmap__legend" role="list">
            <li>${keySvg('planted')}<span>${he.map.legend.planted}</span><b class="num">${counts.planted}</b></li>
            <li>${keySvg('reserved')}<span>${he.map.legend.reserved}</span><b class="num">${counts.reserved}</b></li>
            <li>${keySvg('free')}<span>${he.map.legend.free}</span><b class="num">${counts.free}</b></li>
          </ul>
          <p class="fmap__hint" aria-hidden="true"><span class="fmap__hint-ico">${icon('move')}</span><span class="fmap__hint-t">${touch ? MC.hintTap : MC.hintClick}</span></p>
          <button type="button" class="fmap__done">${icon('close')}<span>${MC.done}</span></button>
        </div>
        ${listHtml}
        ${sheetHtml}
      </div>
    </div>
    <p class="visually-hidden" id="${uid}-sum">${he.map.subtitle} ${counts.planted} ${he.map.legend.planted}, ${counts.reserved} ${he.map.legend.reserved}, ${counts.free} ${he.map.legend.free}.</p>
    <p class="visually-hidden" aria-live="polite" data-fm-live></p>`;

  const $ = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const frame = $('.fmap__frame');
  const slot = $('.fmap__slot');
  const view = $('.fmap__view');
  /* two layers of the same plan: the paper art below (.fmap__svg--art), the places, groves, clusters and
     labels above (the top one, which also carries the zoom-dependent CSS variables). Each fades in as one
     composited layer in the zoomed-out intro (see playIntro) */
  const svg = $<SVGSVGElement>('.fmap__svg--top');
  const camGs = [...el.querySelectorAll<SVGGElement>('.fmap__cam')];
  const worldGs = [...el.querySelectorAll<SVGGElement>('.fmap__world')];
  const spotsG = $<SVGGElement>('.fmap__spots');
  const card = $('.fmap__card');
  const hint = $('.fmap__hint');
  const hintT = $('.fmap__hint-t');
  const live = $('[data-fm-live]');
  const listEl = el.querySelector<HTMLElement>('.fmap__list');
  const sheet = el.querySelector<HTMLElement>('.fmap__sheet');
  const glowLayer = $('.fmap__glow');
  const glows = [...glowLayer.querySelectorAll<HTMLElement>('.fmap__g')].map((g) => ({ el: g, s: byId.get(g.dataset.id!)! }));
  const spotEl = new Map<string, SVGGElement>();
  el.querySelectorAll<SVGGElement>('.fmap__spot').forEach((g) => spotEl.set(g.dataset.id!, g));
  const animEls = new Map<string, SVGGElement>();
  spotEl.forEach((g, id) => animEls.set(id, g.querySelector<SVGGElement>('.fmap__a')!));
  /** the markers' animated groups, in the order of `spots` */
  const animList = spots.map((s) => animEls.get(s.id)!);
  /* The home map's slot has content-visibility: auto (forest-map.css): the browser skips it while it is far
     from the screen. A style read inside a skipped subtree wakes it for that one read, and GSAP reads one
     per marker: bulk work runs with the slot held awake instead (one style pass for all of it). The build
     itself runs awake until the first frame is drawn. */
  let skipped = false;
  slot.addEventListener('contentvisibilityautostatechange', (e) => { skipped = !!(e as Event & { skipped?: boolean }).skipped; });
  const awake = (fn: () => void) => {
    if (!skipped || slot.classList.contains('is-awake')) { fn(); return; }
    slot.classList.add('is-awake');
    try { fn(); } finally { slot.classList.remove('is-awake'); }
  };
  slot.classList.add('is-awake');
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!destroyed) slot.classList.remove('is-awake'); }));
  gsap.set(animList, { svgOrigin: '0 0' });

  /* ------------------------------------------------------------------ state */
  let active = false, full = false, clustered = false, destroyed = false;
  let atFit = true;
  let selectedId: string | null = null;
  /** a spot to centre on once the map has a size (select() before the first layout) */
  let pendingId: string | null = null;
  let cardId: string | null = null, pinned = false;
  /** pinned by the page (deep link), not by a click: hovering another place replaces it */
  let softPin = false;
  let sheetId: string | null = null;
  let focusId: string | null = null;
  let quietFocus = false;
  let introTl: gsap.core.Timeline | null = null, introDone = false;
  const filter: { species: SpeciesId | ''; occasion: string } = { species: '', occasion: '' };
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: any) => void, o?: AddEventListenerOptions | boolean) => {
    t.addEventListener(type, fn, o);
    cleanups.push(() => t.removeEventListener(type, fn, o));
  };

  /* ------------------------------------------------------------------ camera + render */
  let raf = 0, lastK = -1, msTree = 1, msObj = 1;
  const cam = new Camera(() => { if (!raf) raf = requestAnimationFrame(render); }, motion);
  function render() {
    raf = 0;
    const { k, x, y } = cam;
    const m = `matrix(${k.toFixed(5)} 0 0 ${k.toFixed(5)} ${x.toFixed(2)} ${y.toFixed(2)})`;
    for (const g of camGs) g.setAttribute('transform', m);
    for (const g of glows) {
      const [sx, sy] = cam.toScreen([g.s.x, g.s.y]);
      g.el.style.translate = `${sx.toFixed(1)}px ${sy.toFixed(1)}px`;
    }
    if (Math.abs(k - lastK) > 1e-4) {
      lastK = k;
      // markers grow a little when zoomed out (√ of the zoom) so they stay readable; benches, tables,
      // fire nooks and corners never fold into a grove, so they may grow more and stay findable
      const ms = Math.min(1.5, Math.max(0.55, k ** -0.5));
      const ms2 = Math.min(2.2, Math.max(0.55, k ** -0.5));
      msTree = ms; msObj = ms2;
      svg.style.setProperty('--fm-ms', ms.toFixed(4));
      svg.style.setProperty('--fm-ms2', ms2.toFixed(4));
      svg.style.setProperty('--fm-cs', (1 / k).toFixed(4));
      svg.style.setProperty('--fm-kms', (k * ms).toFixed(4));
      svg.style.setProperty('--fm-kms2', (k * ms2).toFixed(4));
      glowLayer.style.setProperty('--fm-px', (k * ms).toFixed(4));
      glowLayer.style.setProperty('--fm-px2', (k * ms2).toFixed(4));
      const want = clustered ? k < thr * 1.06 : k < thr * 0.94;
      if (want !== clustered) setClustered(want, introDone);
      el.classList.toggle('is-far', k <= cam.kMin * 1.02);
      el.classList.toggle('is-near', k >= cam.kMax * 0.98);
    }
    if (cardId) positionCard();
  }
  const markMoved = () => { atFit = false; };
  /** is this place folded into a grove cluster right now? */
  const grouped = (s: Spot) => clustered && zoneOf.has(s.id);

  function measure(force = false, animateFit = false, keep = false) {
    const r = frame.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return;
    const rot: 0 | 90 = r.height > r.width * 1.12 ? 90 : 0;
    if (!force && r.width === cam.w && r.height === cam.h && rot === cam.rot) return;
    const first = cam.w <= 1;
    const centre = cam.toWorld(cam.w / 2, cam.h / 2);
    const rel = cam.k / cam.kFit;
    const rotChanged = rot !== cam.rot;
    cam.w = r.width; cam.h = r.height; cam.rot = rot;
    for (const g of worldGs) g.setAttribute('transform', rot ? 'rotate(90)' : '');
    svg.style.setProperty('--fm-lrot', rot ? '-90deg' : '0deg');
    el.classList.toggle('is-portrait', !!rot);
    const fit = fitPlan();
    cam.kFit = fit.k;
    cam.kMin = picker || touch ? fit.k * 0.92 : Math.min(fit.k * 0.92, thr * 0.82);
    cam.kMax = Math.max(2.6, fit.k * 3.6);
    cam.limit = { x0: -30, y0: -10, x1: PLAN.w + 30, y1: PLAN.h + 30 };
    if (first) { cam.stop(); cam.set(initialState(fit), false); }
    else if (atFit || rotChanged) { if (animateFit && motion()) cam.to(fit, 0.65); else cam.set(fit, false); }
    else if (keep) cam.set(cam.state);
    else cam.set(cam.centerState(centre, cam.kFit * rel));
  }
  function fitPad() { return picker ? 10 : touch ? 14 : 20; }
  /** the whole plan in view; where the legend (over the bottom of the frame) or the phone's standing
      hint (over its top) would cover the plot's edge, the plan sits between them */
  function fitPlan(): CamState {
    const pad = fitPad();
    const fit = cam.fitState(PLAN_RECT, pad);
    if (picker) return pickerFit(fit, pad);
    const legend = el.querySelector<HTMLElement>('.fmap__legend');
    if (!legend || el.classList.contains('is-list')) return fit;
    const fr = frame.getBoundingClientRect(), lr = legend.getBoundingClientRect();
    if (!lr.height) return fit;
    const l = cam.layoutRect(PLAN_RECT);
    const bottom = fit.y + fit.k * l.y1, top = fit.y + fit.k * l.y0;
    let padB = Math.max(pad, fr.bottom - lr.top + 6);
    // on touch the hint stays up while the map is not active (phones: at the top)
    const hr = touch && !full ? hint.getBoundingClientRect() : null;
    const padT = hr && hr.height && hr.top - fr.top < fr.height / 2 ? Math.max(pad, hr.bottom - fr.top + 6) : pad;
    if (bottom <= cam.h - padB && top >= padT) return fit;
    let res = cam.fitState(PLAN_RECT, pad, Infinity, padB, padT);
    // desktop: the room made for the legend shrinks the plan, and the moshav road drawn under the plot crept in
    // as a stray wavy band along the frame's bottom edge. Give back just enough of that room to keep the road
    // out; the legend sits over the empty field at the plot's bottom-left, ~70 plan units above this rect's
    // bottom, so it still clears the fence. (Phones, the picker and full screen fit as before.)
    if (!touch && !full && cam.rot === 0) {
      for (let i = 0; i < 4; i++) {
        const peek = cam.h + 2 - (res.y + res.k * ROAD_TOP);
        if (peek <= 0 || padB <= pad) break;
        padB = Math.max(pad, padB - peek);
        res = cam.fitState(PLAN_RECT, pad, Infinity, padB, padT);
      }
    }
    return res;
  }
  /** the picker on a desktop-sized screen: its legend sits over the frame's bottom-left corner, which is where the
      outdoor classroom's label 'כיתת חוץ' falls (the frame is wide and short there, so the plan fills its height).
      The plan moves up into any room the fit left above it, then shrinks around its top just enough for the label
      to clear the legend (1–5 % at 1024–1920; forest-map.css makes that legend a little slimmer and lower). Two
      limits win over the label: the moshav road drawn under the plot stays below the frame's bottom edge (a few
      px of it read as a stray wavy band, as on the home map), and the plan never loses more than 15 %. The title
      keeps its place at the top; the hover hint takes the title's place there (forest-map.css). Phones, landscape
      phones, full screen and a portrait (rotated) frame fit as before. */
  const deskMq = window.matchMedia('(min-width: 769px) and (min-height: 561px)');
  const CLASS_LABEL = PLAN_LABELS.find((q) => q.id === 'class')!;
  function pickerFit(fit: CamState, pad: number): CamState {
    if (!deskMq.matches || full || cam.rot !== 0) return fit;
    const legend = el.querySelector<HTMLElement>('.fmap__legend');
    const text = el.querySelector<SVGTextElement>('.fmap__label--class .fmap__label-t');
    if (!legend || !text) return fit;
    const fr = frame.getBoundingClientRect(), lr = legend.getBoundingClientRect();
    if (!lr.height) return fit;
    let bb: DOMRect;
    try { bb = text.getBBox(); } catch { return fit; }
    if (!bb.height) return fit;
    // the label keeps its on-screen size at every zoom (scale 1/k), so its box is in screen px; the cream halo
    // (a 4 px stroke) adds 2 px around the glyphs, and the box already has a little air above and below them
    const gap = 3, halo = 2;
    const legTop = lr.top - fr.top - gap, legL = lr.left - fr.left - gap, legR = lr.right - fr.left + gap;
    const lblBottom = bb.y + bb.height + halo;
    const over = (st: CamState) => {
      const x = st.x + st.k * CLASS_LABEL.x;
      return x + bb.x + bb.width + halo > legL && x + bb.x - halo < legR;
    };
    let need = fit.y + fit.k * CLASS_LABEL.y + lblBottom - legTop;
    if (need <= 0 || !over(fit)) return fit;
    const l = cam.layoutRect(PLAN_RECT);
    /** how far the plan may move up before the road's edge comes into the frame */
    const roadRoom = (y: number, k: number) => y + k * ROAD_TOP - (cam.h + 2);
    const top = fit.y + fit.k * l.y0;
    const up = Math.max(0, Math.min(need, top - pad, roadRoom(fit.y, fit.k)));
    const res = { ...fit, y: fit.y - up };
    need -= up;
    if (need <= 0) return res;
    const top2 = top - up;
    let k = (legTop - top2 - lblBottom) / (CLASS_LABEL.y - l.y0);
    k = Math.max(k, fit.k * 0.85, (cam.h + 2 - top2) / (ROAD_TOP - l.y0));
    // a plan that showed its trees one by one keeps doing so (the groves gather below thr × 0.94, see render())
    if (fit.k >= thr * 0.94) k = Math.max(k, thr * 0.94 + 0.0005);
    if (!(k < fit.k)) return res;
    return { k, x: cam.w / 2 - k * (l.x0 + (l.x1 - l.x0) / 2), y: top2 - k * l.y0 };
  }
  function initialState(fit: CamState): CamState {
    const want = pendingId ?? selectedId ?? opts.initialSpotId;
    pendingId = null;
    const s = want ? byId.get(want) : undefined;
    if (s) {
      atFit = false;
      if (selectable(s)) setSelected(s.id);
      return cam.clamp(cam.centerState([s.x, s.y], Math.max(fit.k, zk * 1.7)));
    }
    return fit;
  }

  /* ------------------------------------------------------------------ clusters */
  function treeTarget(s: Spot, clusterOn: boolean) {
    if (!clusterOn) return { x: 0, y: 0, scale: 1, opacity: 1 };
    const z = zoneOf.get(s.id);
    if (!z) return { x: 0, y: 0, scale: 1, opacity: 1 }; // benches, tables, fire nooks, corners stay themselves
    const f = 0.28;
    return { x: (z.cx - s.x) * f, y: (z.cy - s.y) * f, scale: s.status === 'free' ? 0.62 : 0.34, opacity: s.status === 'free' ? 1 : 0.55 };
  }
  /** every marker to its place for this cluster state, in ONE tween: GSAP then reads all the start values
      before it writes any. 170 separate sets read, write, read, write… and force a style recalc each
      (~190 ms on a throttled phone, at build time and at the start and end of the intro). */
  function placeAll(clusterOn: boolean, dur = 0, overwrite: 'auto' | false = false) {
    const t = spots.map((s) => treeTarget(s, clusterOn));
    const vars = {
      x: (i: number) => t[i].x, y: (i: number) => t[i].y, scale: (i: number) => t[i].scale, opacity: (i: number) => t[i].opacity,
      overwrite,
    };
    awake(() => {
      if (dur > 0) gsap.to(animList, { ...vars, duration: dur, ease: 'power3.inOut' });
      else gsap.set(animList, vars);
    });
  }
  function setClustered(onOff: boolean, animate: boolean) {
    clustered = onOff;
    el.classList.toggle('is-clustered', onOff);
    if (onOff) hideCard(true);
    placeAll(onOff, animate && motion() ? 0.7 : 0, 'auto');
  }
  function updateClusterCounts() {
    el.querySelectorAll<SVGGElement>('.fmap__cluster').forEach((g) => {
      const z = zones.find((x) => x.id === g.dataset.zone)!;
      const trees = z.spots.filter((s) => s.status !== 'free' && matches(s)).length;
      const free = z.spots.filter((s) => s.status === 'free').length;
      g.querySelector('.fmap__cl-n')!.textContent = String(trees);
      const fg = g.querySelector<SVGGElement>('.fmap__cl-free')!;
      fg.querySelector('text')!.textContent = String(free);
      fg.style.display = free ? '' : 'none';
      g.setAttribute('aria-label', MC.cluster(trees, free));
    });
  }
  function zoomToZone(id: string) {
    const z = zones.find((x) => x.id === id);
    if (!z) return;
    const xs = z.spots.map((s) => s.x), ys = z.spots.map((s) => s.y);
    const r: Rect = { x0: Math.min(...xs) - 40, y0: Math.min(...ys) - 40, x1: Math.max(...xs) + 40, y1: Math.max(...ys) + 40 };
    const s = cam.fitState(r, 24);
    s.k = Math.max(s.k, zk * 1.25);
    markMoved();
    cam.to(cam.centerState([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], s.k), 1.0);
  }

  /* ------------------------------------------------------------------ filters */
  function matches(s: Spot): boolean {
    if (s.status === 'free') return true;
    if (!filter.species && !filter.occasion) return true;
    if (s.kind !== 'tree') return false;
    if (filter.species && s.species !== filter.species) return false;
    if (filter.occasion && s.occasion !== filter.occasion) return false;
    return true;
  }
  function applyFilter() {
    let n = 0;
    spots.forEach((s) => {
      const m = matches(s);
      spotEl.get(s.id)!.classList.toggle('is-dim', !m);
      if (m && s.status !== 'free' && s.kind === 'tree') n++;
    });
    listEl?.querySelectorAll<HTMLElement>('li[data-id]').forEach((li) => { li.hidden = !matches(byId.get(li.dataset.id!)!); });
    listEl?.querySelectorAll<HTMLElement>('.fmap__lg').forEach((g) => {
      const vis = g.querySelectorAll('li[data-id]:not([hidden])').length;
      g.querySelector('.fmap__lg-n')!.textContent = String(vis);
      g.hidden = vis === 0;
    });
    // free spots carry the chosen species into the configurator
    listEl?.querySelectorAll<HTMLAnchorElement>('.fmap__li--free').forEach((a) => {
      const s = byId.get(a.closest('li')!.dataset.id!)!; a.href = spotHref(s, filter.species);
    });
    el.querySelectorAll<HTMLButtonElement>('.fmap__chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.species === filter.species)));
    el.querySelector<HTMLElement>('.fmap__select')?.classList.toggle('is-set', !!filter.occasion);
    el.classList.toggle('is-filtered', !!(filter.species || filter.occasion));
    updateClusterCounts();
    if (cardId) showCard(byId.get(cardId)!, pinned);
    announce(MC.results(n));
  }
  let liveT = 0;
  function announce(t: string) {
    clearTimeout(liveT);
    liveT = window.setTimeout(() => { live.textContent = t; }, 250);
  }

  /* ------------------------------------------------------------------ card (desktop hover) */
  let showT = 0, hideT = 0;
  function showCard(s: Spot, pin = false, soft = false) {
    if (touch && !picker) return;
    clearTimeout(hideT);
    const same = cardId === s.id && !card.hidden;
    cardId = s.id; pinned = pin; softPin = pin && soft;
    card.dataset.id = s.id;
    card.dataset.status = s.status;
    if (!same || card.dataset.sp !== filter.species) card.innerHTML = cardHtml(s, { cta: !picker, species: filter.species });
    card.dataset.sp = filter.species;
    card.hidden = false;
    card.classList.toggle('is-pinned', pin);
    positionCard();
    requestAnimationFrame(() => card.classList.add('is-on'));
    const g = spotEl.get(s.id);
    if (g?.hasAttribute('tabindex')) g.setAttribute('aria-describedby', card.id);
    el.querySelectorAll('.fmap__spot.is-hot').forEach((x) => x.classList.remove('is-hot'));
    g?.classList.add('is-hot');
  }
  function hideCard(now = false) {
    clearTimeout(showT);
    const done = () => {
      if (!cardId) return;
      spotEl.get(cardId)?.removeAttribute('aria-describedby');
      spotEl.get(cardId)?.classList.remove('is-hot');
      cardId = null; pinned = false; softPin = false;
      card.classList.remove('is-on', 'is-pinned');
      card.hidden = true;
    };
    if (now) { clearTimeout(hideT); done(); return; }
    clearTimeout(hideT);
    card.classList.remove('is-on');
    hideT = window.setTimeout(done, 200);
  }
  function scheduleHide() {
    if (pinned) return;
    clearTimeout(hideT);
    hideT = window.setTimeout(() => hideCard(), 220);
  }
  function positionCard() {
    const s = cardId ? byId.get(cardId) : null;
    if (!s) return;
    const [sx, sy] = cam.toScreen([s.x, s.y]);
    const ms = s.kind === 'tree' ? msTree : msObj;
    const rs = (geom.get(s.id)?.r ?? 12) * cam.k * ms;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    if (sx < -10 || sx > cam.w + 10 || sy < -10 || sy > cam.h + 10) { if (!pinned) hideCard(true); return; }
    let top = sy - rs - 14 - ch;
    let place = 'above';
    if (top < 10) {
      top = sy + rs + 14; place = 'below';
      // small frames (the configurator's picker): keep the card inside, on the roomier side
      if (top + ch > cam.h - 10) {
        const roomAbove = sy - rs, roomBelow = cam.h - sy - rs;
        place = roomAbove > roomBelow ? 'above' : 'below';
        top = Math.max(10, Math.min(cam.h - ch - 10, place === 'above' ? sy - rs - 14 - ch : sy + rs + 14));
      }
    }
    const left = Math.min(cam.w - cw - 10, Math.max(10, sx - cw / 2));
    card.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
    card.dataset.place = place;
    card.style.setProperty('--fm-tip', `${Math.min(cw - 18, Math.max(18, sx - left)).toFixed(1)}px`);
  }

  /* ------------------------------------------------------------------ sheet (phones) */
  let sheetLocked = false;
  function openSheet(s: Spot) {
    if (!sheet) return;
    sheetId = s.id;
    sheet.querySelector('.fmap__sheet-body')!.innerHTML = cardHtml(s, { cta: true, species: filter.species });
    const wasOpen = !sheet.hidden;
    sheet.hidden = false;
    el.querySelectorAll('.fmap__spot.is-hot').forEach((x) => x.classList.remove('is-hot'));
    spotEl.get(s.id)?.classList.add('is-hot');
    if (!sheetLocked) { sheetLocked = true; lockScroll(); bus.emit('modal:open'); }
    if (!wasOpen) {
      if (motion()) gsap.fromTo(sheet, { yPercent: 100 }, { yPercent: 0, duration: 0.55, ease: 'expo.out' });
      else gsap.set(sheet, { yPercent: 0 });
    }
    sound.play('rustle');
    track('view_item', { item_id: s.id, item_category: s.kind, status: s.status, placement: 'map_sheet' });
    // keep the tree visible above the sheet
    requestAnimationFrame(() => {
      const sh = sheet.offsetHeight;
      const [sx, sy] = cam.toScreen([s.x, s.y]);
      const room = cam.h - sh;
      if (grouped(s) || sy > room - 40 || sy < 60 || sx < 30 || sx > cam.w - 30) {
        markMoved();
        cam.to(cam.centerState([s.x, s.y], Math.max(cam.k, zk * 1.3), cam.w / 2, Math.max(90, room * 0.45)), 0.7);
      }
    });
    (sheet.querySelector<HTMLElement>('.fmc__cta, .fmc__link') ?? sheet.querySelector<HTMLElement>('.fmap__sheet-x'))?.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    const id = sheetId;
    sheetId = null;
    if (id) spotEl.get(id)?.classList.remove('is-hot');
    // focus inside the closing sheet (or already lost) stays in the full-screen dialog: on "סיום"
    const a = document.activeElement;
    const refocus = full && (!a || a === document.body || sheet.contains(a));
    const end = () => { sheet.hidden = true; gsap.set(sheet, { clearProps: 'transform' }); };
    if (motion()) gsap.to(sheet, { yPercent: 100, duration: 0.4, ease: 'power3.in', onComplete: end }); else end();
    if (refocus) el.querySelector<HTMLElement>('.fmap__done')?.focus({ preventScroll: true });
    if (sheetLocked) { sheetLocked = false; unlockScroll(); bus.emit('modal:close'); }
  }

  /* ------------------------------------------------------------------ activation */
  let hintT2 = 0;
  function flashHint(text: string, ms = 2200) {
    hintT.textContent = text;
    hint.classList.add('is-flash');
    clearTimeout(hintT2);
    hintT2 = window.setTimeout(() => { hint.classList.remove('is-flash'); hintT.textContent = active ? (touch ? '' : MC.hintActive) : touch ? MC.hintTap : MC.hintClick; }, ms);
  }
  function activate() {
    if (active) return;
    finishIntro();
    if (fullscreen && !full) { enterFull(); return; }
    active = true;
    el.classList.add('is-active');
    view.dataset.cursor = he.cursor.drag;
    sound.play('paper');
    if (!touch) flashHint(MC.hintActive, 2600);
  }
  function deactivate() {
    if (!active) return;
    if (full) { exitFull(); return; }
    active = false;
    el.classList.remove('is-active');
    view.dataset.cursor = he.cursor.look;
    hintT.textContent = touch ? MC.hintTap : MC.hintClick;
    hint.classList.remove('is-flash');
    if (pinned) hideCard(true);
  }

  /** the frame's in-section corner radii (px), for the clip-path that opens/closes full screen */
  let slotRadius = '0px 0px 0px 0px';
  function enterFull() {
    if (full) return;
    const r0 = frame.getBoundingClientRect();
    const cs = getComputedStyle(frame);
    slotRadius = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => `${parseFloat(v) || 0}px`).join(' ');
    full = true; active = true;
    const st = cam.state;
    el.classList.add('is-full', 'is-active');
    frame.setAttribute('role', 'dialog');
    frame.setAttribute('aria-modal', 'true');
    frame.setAttribute('aria-label', MC.mapLabel);
    lockScroll();
    bus.emit('modal:open');
    const r1 = frame.getBoundingClientRect();
    cam.w = r1.width; cam.h = r1.height;
    cam.set({ k: st.k, x: st.x + r0.left - r1.left, y: st.y + r0.top - r1.top });
    sound.play('paper');
    if (motion()) {
      const clipFrom = `inset(${Math.max(0, r0.top)}px ${Math.max(0, r1.width - r0.right)}px ${Math.max(0, r1.height - r0.bottom)}px ${Math.max(0, r0.left)}px round ${slotRadius})`;
      gsap.fromTo(frame, { clipPath: clipFrom }, { clipPath: 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)', duration: 0.65, ease: 'power3.inOut', clearProps: 'clipPath' });
    }
    measure(true, true, true);
    // focus "סיום" — unless a sheet opened in the same gesture (a tapped tree, a deep link): it keeps focus
    requestAnimationFrame(() => { if (!sheet || sheet.hidden) el.querySelector<HTMLElement>('.fmap__done')?.focus({ preventScroll: true }); });
  }
  let exiting = false;
  function exitFull() {
    if (!full || exiting) return;
    exiting = true;
    closeSheet();
    const finish = () => {
      exiting = false;
      const st = cam.state;
      const r0 = frame.getBoundingClientRect();
      el.classList.remove('is-full', 'is-active');
      frame.removeAttribute('role'); frame.removeAttribute('aria-modal'); frame.removeAttribute('aria-label');
      full = false; active = false;
      unlockScroll();
      bus.emit('modal:close');
      const r1 = frame.getBoundingClientRect();
      cam.w = r1.width; cam.h = r1.height;
      cam.set({ k: st.k, x: st.x + r0.left - r1.left, y: st.y + r0.top - r1.top });
      measure(true, true, true);
      frame.focus({ preventScroll: true });
    };
    const target = slot.getBoundingClientRect();
    let safety = 0, ended = false;
    const done = () => { if (ended) return; ended = true; clearTimeout(safety); finish(); gsap.set(frame, { clearProps: 'clipPath' }); };
    if (motion()) {
      const W = window.innerWidth, H = frame.getBoundingClientRect().height;
      gsap.to(frame, {
        clipPath: `inset(${Math.max(0, target.top)}px ${Math.max(0, W - target.right)}px ${Math.max(0, H - target.bottom)}px ${Math.max(0, target.left)}px round ${slotRadius})`,
        duration: 0.5, ease: 'power3.inOut',
        onComplete: done,
      });
      safety = window.setTimeout(done, 1200);
    } else finish();
  }

  /* ------------------------------------------------------------------ selection (picker) */
  function setSelected(id: string | null) {
    if (selectedId) {
      const g = spotEl.get(selectedId);
      g?.classList.remove('is-selected');
      glowLayer.querySelector(`[data-id="${selectedId}"]`)?.classList.remove('is-selected');
      if (picker) g?.setAttribute('aria-checked', 'false');
    }
    selectedId = id;
    if (id) {
      const g = spotEl.get(id);
      g?.classList.add('is-selected');
      glowLayer.querySelector(`[data-id="${id}"]`)?.classList.add('is-selected');
      if (picker) g?.setAttribute('aria-checked', 'true');
      setRoving(id);
    }
  }
  function choose(s: Spot, origin?: { x: number; y: number }) {
    if (picker) {
      setSelected(s.id);
      sound.play('click');
      sound.haptic(10);
      track('select_item', { item_id: s.id, item_category: s.kind, placement: 'plant_picker' });
      announce(`${MC.selected}: ${MC.spot(s.id)}`);
      opts.onSelect?.(s);
      return;
    }
    track('select_item', { item_id: s.id, item_category: s.kind, placement: 'home_map' });
    navigate(spotHref(s, filter.species), origin);
  }

  /* ------------------------------------------------------------------ keyboard (roving focus) */
  function setRoving(id: string) {
    if (!spotEl.get(id)?.hasAttribute('tabindex')) return;
    spotsG.querySelectorAll('[tabindex="0"]').forEach((x) => x.setAttribute('tabindex', '-1'));
    spotEl.get(id)!.setAttribute('tabindex', '0');
    focusId = id;
  }
  function nearestNavigable(): Spot | undefined {
    const c = cam.toWorld(cam.w / 2, cam.h / 2);
    return [...navigable].filter(matches).sort((a, b) => Math.hypot(a.x - c[0], a.y - c[1]) - Math.hypot(b.x - c[0], b.y - c[1]))[0];
  }
  function ensureVisible(s: Spot) {
    const [sx, sy] = cam.toScreen([s.x, s.y]);
    const m = 70;
    if (grouped(s)) { markMoved(); cam.to(cam.centerState([s.x, s.y], zk * 1.5), 0.8); return; }
    if (sx < m || sx > cam.w - m || sy < m || sy > cam.h - m) { markMoved(); cam.to(cam.centerState([s.x, s.y], cam.k), 0.6); }
  }
  function moveFocus(key: string) {
    const cur = focusId ? byId.get(focusId) : undefined;
    if (!cur) return;
    const [cx, cy] = cam.toScreen([cur.x, cur.y]);
    let best: Spot | undefined, score = Infinity;
    for (const s of navigable) {
      if (s === cur || !matches(s)) continue;
      const [x, y] = cam.toScreen([s.x, s.y]);
      const dx = x - cx, dy = y - cy;
      const [along, across] = key === 'ArrowRight' ? [dx, dy] : key === 'ArrowLeft' ? [-dx, dy] : key === 'ArrowDown' ? [dy, dx] : [-dy, dx];
      if (along <= 4) continue;
      const sc = along + Math.abs(across) * 2.2;
      if (sc < score) { score = sc; best = s; }
    }
    if (best) focusSpot(best);
  }
  function focusSpot(s: Spot) {
    setRoving(s.id);
    spotEl.get(s.id)!.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ intro (draw the plan, plant the trees) */
  function prepareIntro() {
    if (!motion()) { introDone = true; el.classList.add('is-live'); return; }
    // .is-pre hides the paper's ink, the places, the groves and the labels (CSS) until the map is seen
    el.classList.add('is-pre');
    gsap.set(el.querySelectorAll('.fmap__draw'), { drawSVG: '0%' });
  }
  /** what the intro animates as whole layers (cleared when it ends) */
  const introLayers = () => el.querySelectorAll('.fmap__plot, .fmap__env, .fmap__label-t, .fmap__spots, .fmap__canopies, .fmap__cluster');
  function playIntro() {
    if (introDone || introTl) return;
    if (!motion()) { finishIntro(); return; }
    const tl = gsap.timeline({ onComplete: () => finishIntro() });
    introTl = tl;
    // phones (and any view that starts zoomed out) see groves, not single trees: a shorter, lighter
    // intro — the plan appears, then the groves settle in — instead of ~170 trees planted one by one
    const lite = clustered;
    if (lite) {
      // The two <svg> layers fade in on the compositor: first the plan, then the groves and places (CSS
      // animations, .is-intro-lite in forest-map.css). There is no ink drawing and no opacity on groups
      // inside the SVG here. Those repaint the whole plan on every frame of the intro, and WebKit draws
      // each such group into an offscreen buffer first: the phones' intro ran at a few frames a second
      // while the page was scrolled. The clusters and the labels still settle in one by one (small areas).
      gsap.set(el.querySelectorAll('.fmap__draw'), { clearProps: 'strokeDasharray,strokeDashoffset,stroke-dasharray,stroke-dashoffset' });
      placeAll(clustered);
      tl.fromTo(el.querySelectorAll('.fmap__cluster'), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.07 }, 0.75);
      tl.fromTo(el.querySelectorAll('.fmap__label-t'), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.03 }, 0.74);
      el.classList.remove('is-pre');
      el.classList.add('is-intro', 'is-intro-lite');
      return;
    }
    // the from-states render at once (immediateRender), in the same frame .is-pre goes away: no flash
    tl.fromTo(el.querySelectorAll('.fmap__plot, .fmap__env'), { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 0);
    tl.fromTo(el.querySelectorAll('.fmap__walk, .fmap__walk-edge'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.3, ease: 'power2.inOut', stagger: 0.08 }, 0.1);
    tl.to(el.querySelectorAll('.fmap__draw'), { drawSVG: '100%', duration: 1.2, ease: 'power2.inOut', stagger: { each: 0.025, from: 'random' } }, 0.2);
    gsap.set([spotsG, el.querySelector('.fmap__canopies')], { opacity: 1 });
    // trees are planted in a wave that starts at the gate
    const g = PLAN.gate;
    const order = spots.map((s) => ({ s, d: Math.hypot(s.x - g.x, s.y - g.y) }));
    const dmax = Math.max(...order.map((o) => o.d));
    order.forEach(({ s, d }) => {
      const t = treeTarget(s, clustered);
      const a = animEls.get(s.id)!;
      const at = 0.75 + (d / dmax) * 1.25 + (s.status === 'free' ? 0.35 : 0);
      tl.fromTo(a, { scale: 0, x: t.x, y: t.y, opacity: t.opacity }, { scale: t.scale, duration: s.status === 'free' ? 1.1 : 0.9, ease: s.status === 'free' ? 'elastic.out(1, 0.6)' : 'expo.out' }, at);
    });
    tl.fromTo(el.querySelectorAll('.fmap__label-t'), { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.05 }, 1.2);
    el.classList.remove('is-pre');
    el.classList.add('is-intro');
  }
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    awake(() => {
      if (introTl) { introTl.progress(1); introTl.kill(); introTl = null; }
      el.classList.remove('is-pre', 'is-intro', 'is-intro-lite');
      gsap.set(el.querySelectorAll('.fmap__draw, .fmap__walk, .fmap__walk-edge'), { clearProps: 'strokeDasharray,strokeDashoffset,stroke-dasharray,stroke-dashoffset' });
      gsap.set(introLayers(), { clearProps: 'opacity' });
      placeAll(clustered);
    });
    el.classList.add('is-live');
  }

  /* ------------------------------------------------------------------ pointer: hover, click, drag, pinch, wheel */
  const spotFrom = (t: EventTarget | null) => (t as Element | null)?.closest?.('.fmap__spot') as SVGGElement | null;
  const clusterFrom = (t: EventTarget | null) => (t as Element | null)?.closest?.('.fmap__cluster') as SVGGElement | null;
  const local = (e: { clientX: number; clientY: number }) => { const r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as Pt; };

  on(spotsG, 'pointerover', (e: PointerEvent) => {
    const g = spotFrom(e.target);
    if (!g || e.pointerType !== 'mouse') return;
    const s = byId.get(g.dataset.id!)!;
    if (grouped(s) || g.classList.contains('is-dim') || (picker && !selectable(s))) return;
    if (s.species && !g.dataset.cursorIcon && s.status !== 'free') g.dataset.cursorIcon = speciesIcon(s.species);
    if (pinned && !softPin && cardId !== s.id) return;
    clearTimeout(hideT); clearTimeout(showT);
    showT = window.setTimeout(() => showCard(s, pinned && cardId === s.id, softPin), cardId ? 0 : 60);
  });
  on(spotsG, 'pointerout', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const g = spotFrom(e.target);
    if (!g || g.contains(e.relatedTarget as Node)) return;
    clearTimeout(showT);
    scheduleHide();
  });
  on(card, 'pointerenter', () => clearTimeout(hideT));
  on(card, 'pointerleave', () => scheduleHide());

  /** when a finger last touched the map (a tap focuses the place: no floating card for that) */
  let lastTouch = 0;
  const pointers = new Map<number, Pt>();
  let dragging = false, dragged = false, downAt: Pt = [0, 0];
  let pinchD = 0, pinchM: Pt = [0, 0];
  let samples: { x: number; y: number; t: number }[] = [];
  let inertia: gsap.core.Tween | null = null;
  on(view, 'pointerdown', (e: PointerEvent) => {
    lastTouch = e.pointerType === 'mouse' ? 0 : performance.now();
    // a mouse press or a gesture on the active map ends the intro at once; a thumb that only scrolls
    // the page over the map lets it play on (a tap ends it in the click handler)
    if (e.pointerType === 'mouse' || active) finishIntro();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragged = false;
    downAt = [e.clientX, e.clientY];
    if (!active) return;
    cam.stop(); inertia?.kill(); inertia = null;
    pointers.set(e.pointerId, local(e));
    samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pinchM = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      dragging = true;
      try { view.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  });
  on(view, 'pointermove', (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      if (!dragging && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > (e.pointerType === 'mouse' ? 4 : 8)) {
        dragging = true; dragged = true;
        el.classList.add('is-dragging');
        try { view.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        if (!pinned) hideCard(true);
      }
      if (dragging) {
        markMoved();
        cam.panBy(p[0] - prev[0], p[1] - prev[1]);
        samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (samples.length > 6) samples.shift();
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pinchD > 0) { markMoved(); cam.zoomAt(d / pinchD, m[0], m[1]); cam.panBy(m[0] - pinchM[0], m[1] - pinchM[1]); }
      pinchD = d; pinchM = m; dragged = true;
    }
  });
  const up = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 1) {
      // continue panning with the remaining finger
      samples = [];
      pinchD = 0;
      return;
    }
    if (pointers.size > 0) return;
    el.classList.remove('is-dragging');
    if (dragging && samples.length > 1 && motion()) {
      const a = samples[0], b = samples[samples.length - 1];
      const dt = Math.max(16, b.t - a.t);
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
      if (Math.hypot(vx, vy) > 0.25 && performance.now() - b.t < 80) {
        const p = { t: 0 }; let last = 0;
        const dist = 260;
        inertia = gsap.to(p, { t: 1, duration: 0.8, ease: 'power3.out', onUpdate: () => { const d = p.t - last; last = p.t; cam.panBy(vx * dist * d, vy * dist * d); } });
      }
    }
    dragging = false;
  };
  on(view, 'pointerup', up);
  on(view, 'pointercancel', up);
  on(view, 'lostpointercapture', (e: PointerEvent) => { if (pointers.has(e.pointerId) && e.pointerType === 'mouse') up(e); });

  on(view, 'click', (e: MouseEvent) => {
    finishIntro();
    if (dragged) { dragged = false; return; }
    const cl = clusterFrom(e.target);
    if (cl && clustered) {
      if (!touch || picker) activate(); else if (!full) enterFull();
      zoomToZone(cl.dataset.zone!);
      return;
    }
    const g = spotFrom(e.target);
    const s = g ? byId.get(g.dataset.id!) : undefined;
    if (s && !grouped(s) && !g!.classList.contains('is-dim')) {
      if (picker) { if (selectable(s)) choose(s); return; }
      if (touch) {
        if (!full) enterFull();
        openSheet(s);
        return;
      }
      if (s.status === 'free') { choose(s, { x: e.clientX, y: e.clientY }); return; }
      activate();
      if (pinned && cardId === s.id) hideCard(true); else showCard(s, true);
      return;
    }
    // empty paper
    if (sheet && !sheet.hidden) { closeSheet(); return; }
    if (!active) { activate(); return; }
    if (pinned) hideCard(true);
  });
  on(view, 'dblclick', (e: MouseEvent) => {
    if (!active || spotFrom(e.target)) return;
    const [x, y] = local(e);
    markMoved();
    cam.zoomSmooth(1.9, x, y, 0.55);
  });
  on(view, 'wheel', (e: WheelEvent) => {
    if (!active) {
      if (!touch && Math.abs(e.deltaY) > 2) flashHint(MC.hintClick, 1600);
      return; // the page keeps scrolling
    }
    e.preventDefault();
    e.stopPropagation();
    finishIntro();
    const [x, y] = local(e);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = e.deltaY * unit;
    markMoved();
    if (e.ctrlKey) cam.zoomAt(Math.exp(-dy * 0.012), x, y); // trackpad pinch
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2) cam.panBy(-e.deltaX * unit, 0);
    else cam.zoomSmooth(Math.exp(-Math.max(-160, Math.min(160, dy)) * 0.0022), x, y, 0.35);
  }, { passive: false });
  on(frame, 'pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') el.classList.add('is-hover'); });
  on(frame, 'pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse') el.classList.remove('is-hover'); });

  on(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !pinned || !cardId || el.contains(document.activeElement)) return;
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement) return; // someone else's dialog or field
    hideCard(true);
  });
  // click/tap outside releases the map (desktop + in-place picker)
  on(document, 'pointerdown', (e: PointerEvent) => {
    if (!active || full) return;
    if (!el.contains(e.target as Node)) deactivate();
  }, true);

  /* zoom buttons */
  el.querySelectorAll<HTMLButtonElement>('.fmap__zb').forEach((b) => on(b, 'click', () => {
    finishIntro();
    if (!touch) activate();
    markMoved();
    const z = b.dataset.zoom;
    if (z === 'fit') { atFit = true; cam.to(fitPlan(), 0.9); return; }
    cam.zoomSmooth(z === 'in' ? 1.6 : 1 / 1.6, cam.w / 2, cam.h / 2, 0.5);
  }));
  on($('.fmap__done'), 'click', () => deactivate());
  if (sheet) {
    on(sheet.querySelector('.fmap__sheet-x')!, 'click', () => closeSheet());
    // swipe the sheet down to close
    const grip = sheet.querySelector<HTMLElement>('.fmap__sheet-grip')!;
    let y0 = -1;
    on(grip, 'pointerdown', (e: PointerEvent) => { y0 = e.clientY; grip.setPointerCapture(e.pointerId); });
    on(grip, 'pointermove', (e: PointerEvent) => { if (y0 < 0) return; gsap.set(sheet, { y: Math.max(0, e.clientY - y0) }); });
    const gripUp = (e: PointerEvent) => {
      if (y0 < 0) return;
      const dy = e.clientY - y0; y0 = -1;
      if (dy > 70) { gsap.set(sheet, { y: 0 }); closeSheet(); } else gsap.to(sheet, { y: 0, duration: 0.3 });
    };
    on(grip, 'pointerup', gripUp);
    on(grip, 'pointercancel', gripUp);
  }

  /* keyboard — listeners on the HTML wrapper: in Chromium an SVG element with focus
     listeners becomes a tab stop itself */
  on(view, 'focusin', (e: FocusEvent) => {
    finishIntro();
    const g = spotFrom(e.target);
    if (!g) return;
    const s = byId.get(g.dataset.id!)!;
    setRoving(s.id);
    if (quietFocus) { quietFocus = false; return; }
    ensureVisible(s);
    // the floating card follows the mouse and the keyboard; a finger in the picker gets the check mark
    // and the configurator's own line instead (the card would cover half of a small map)
    if ((!touch || picker) && performance.now() - lastTouch > 800) showCard(s, false);
  });
  on(view, 'focusout', (e: FocusEvent) => {
    if (card.contains(e.relatedTarget as Node)) return;
    if (!pinned) scheduleHide();
  });
  on(card, 'focusout', (e: FocusEvent) => { if (!card.contains(e.relatedTarget as Node) && !spotFrom(e.relatedTarget)) scheduleHide(); });
  on(view, 'keydown', (e: KeyboardEvent) => {
    const g = spotFrom(e.target);
    if (!g) return;
    const s = byId.get(g.dataset.id!)!;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); moveFocus(e.key); return; }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const list = navigable.filter(matches);
      const t = e.key === 'Home' ? list[0] : list[list.length - 1];
      if (t) focusSpot(t);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (touch && !picker) { if (!full) enterFull(); openSheet(s); return; }
      const r = g.getBoundingClientRect();
      choose(s, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
  });
  // first Tab into the map lands on the free spot nearest to the centre of the view
  on(el, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (sheet && !sheet.hidden) { closeSheet(); e.stopPropagation(); return; }
      if (full) { exitFull(); e.stopPropagation(); return; }
      if (cardId) {
        const id = cardId;
        const inCard = card.contains(document.activeElement);
        hideCard(true);
        if (inCard && spotEl.get(id)?.hasAttribute('tabindex')) { quietFocus = true; spotEl.get(id)!.focus({ preventScroll: true }); }
        e.stopPropagation();
        return;
      }
      if (active) { deactivate(); e.stopPropagation(); }
      return;
    }
    const inMap = frame.contains(e.target as Node) && !(e.target as Element).closest('.fmap__list, .fmap__sheet, .fmap__card');
    if (inMap && (e.key === '+' || e.key === '=')) { e.preventDefault(); markMoved(); cam.zoomSmooth(1.5, cam.w / 2, cam.h / 2); }
    else if (inMap && (e.key === '-' || e.key === '_')) { e.preventDefault(); markMoved(); cam.zoomSmooth(1 / 1.5, cam.w / 2, cam.h / 2); }
    else if (inMap && e.key === '0') { e.preventDefault(); atFit = true; cam.to(fitPlan(), 0.8); }
    if (full && e.key === 'Tab') trapTab(e);
  });
  function trapTab(e: KeyboardEvent) {
    const f = [...frame.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"], select')]
      .filter((x) => !x.closest('[hidden]') && !x.closest('.fmap__list') && x.getClientRects().length > 0);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!frame.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  // full screen is a modal dialog: if focus ever falls out of it (to <body>), Tab and Esc still belong to it
  on(document, 'keydown', (e: KeyboardEvent) => {
    if (!full || el.contains(document.activeElement)) return;
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement) return; // someone else's dialog or field
    if (e.key === 'Tab') trapTab(e);
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (sheet && !sheet.hidden) closeSheet(); else exitFull();
    }
  });
  /** where focus belongs while the sheet is open: its main action, else its close button */
  function sheetFocus() {
    const t = sheet && !sheet.hidden
      ? sheet.querySelector<HTMLElement>('.fmc__cta, .fmc__link') ?? sheet.querySelector<HTMLElement>('.fmap__sheet-x')
      : el.querySelector<HTMLElement>('.fmap__done');
    t?.focus({ preventScroll: true });
  }
  /** A deep link opens the sheet while the page is still loading. A moment later the browser's own
      fragment scroll (#map) clears focus, and the chrome lands the page: put focus back into the
      dialog, as long as it is open and nobody has moved focus on purpose. */
  function holdSheetFocus() {
    const fix = () => {
      if (destroyed || !full) return;
      const a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement) return;
      sheetFocus();
    };
    const onOut = (e: FocusEvent) => { if (!e.relatedTarget) requestAnimationFrame(fix); };
    frame.addEventListener('focusout', onOut);
    const settle = () => {
      [100, 260, 520].forEach((ms) => window.setTimeout(fix, ms));
      window.setTimeout(() => frame.removeEventListener('focusout', onOut), 1600);
    };
    if (document.readyState === 'complete') settle(); else window.addEventListener('load', settle, { once: true });
  }

  /* filters + list toggle */
  el.querySelectorAll<HTMLButtonElement>('.fmap__chip').forEach((b) => on(b, 'click', () => {
    filter.species = (b.dataset.species ?? '') as SpeciesId | '';
    sound.play('click');
    applyFilter();
  }));
  const occSel = el.querySelector<HTMLSelectElement>('[data-occasion]');
  if (occSel) on(occSel, 'change', () => { filter.occasion = occSel.value; applyFilter(); });
  const toggle = el.querySelector<HTMLButtonElement>('.fmap__toggle');
  let listFilled = false;
  function fillList() {
    if (listFilled || !listEl || destroyed) return;
    listFilled = true;
    // filled with the slot held awake and laid out right here, in the idle moment: put into the skipped
    // slot, its ~1600 elements (the list is visually hidden, not display: none) were styled and laid out
    // only when the map came near — one 40–50 ms layout (4× CPU) in a frame of the scroll towards it
    awake(() => {
      listEl.innerHTML = listInner();
      if (!el.classList.contains('is-list')) listEl.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => { a.tabIndex = -1; });
      if (filter.species || filter.occasion) applyFilter();
      void listEl.offsetHeight;
    });
  }
  function setListView(onOff: boolean) {
    if (!listEl || !toggle) return;
    if (onOff) fillList();
    el.classList.toggle('is-list', onOff);
    toggle.setAttribute('aria-pressed', String(onOff));
    toggle.querySelector('span')!.textContent = onOff ? MC.map : MC.list;
    toggle.querySelector('svg')!.outerHTML = icon(onOff ? 'map' : 'list');
    listEl.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => { if (onOff) a.removeAttribute('tabindex'); else a.tabIndex = -1; });
    if (onOff) { hideCard(true); deactivate(); listEl.scrollTop = 0; }
  }
  if (toggle) on(toggle, 'click', () => { finishIntro(); setListView(!el.classList.contains('is-list')); });
  setListView(false);
  if (listEl) {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(fillList, { timeout: 2000 }); else window.setTimeout(fillList, 400);
  }

  /* ------------------------------------------------------------------ lifecycle */
  measure();
  updateClusterCounts();
  const first = (opts.initialSpotId && byId.get(opts.initialSpotId) && selectable(byId.get(opts.initialSpotId)!))
    ? byId.get(opts.initialSpotId)! : nearestNavigable();
  if (first) setRoving(first.id);
  // the host may drop the element without calling destroy() (e.g. the configurator rebuilds its steps
  // when the product changes): an observed element that leaves the document reports a 0×0 size
  const ro = new ResizeObserver(() => { if (!el.isConnected) { destroy(); return; } measure(); });
  ro.observe(frame);
  cleanups.push(() => ro.disconnect());
  // phones: the sticky bar lifts the legend (html.mbar-on), and the plan's fit keeps clear of it.
  // The bar comes and goes while the page scrolls far from the map: the fit is then redone only when the
  // map comes near (reading its boxes would make the browser style and lay out all of it mid-scroll)
  if (!picker) {
    const root = document.documentElement;
    let mbar = root.classList.contains('mbar-on');
    let near = false, refit = false;
    // animated only while it is on screen: a fit animation off screen restyles and lays out every place
    // on each of its frames for nobody
    const doRefit = () => { refit = false; if (!full && !destroyed) awake(() => measure(true, el.classList.contains('is-inview'))); };
    const mo = new MutationObserver(() => {
      const now = root.classList.contains('mbar-on');
      if (now === mbar) return;
      mbar = now;
      if (near) doRefit(); else refit = true;
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    const nearIo = new IntersectionObserver((entries) => {
      near = entries[entries.length - 1].isIntersecting;
      if (near && refit) doRefit();
    }, { rootMargin: '50% 0px' });
    nearIo.observe(slot);
    cleanups.push(() => { mo.disconnect(); nearIo.disconnect(); });
  }

  const wantIntro = opts.intro ?? !picker;
  if (wantIntro && !introDone) {
    prepareIntro();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting && x.intersectionRatio >= 0.3)) { io.disconnect(); playIntro(); }
    }, { threshold: [0, 0.3] });
    io.observe(frame);
    cleanups.push(() => io.disconnect());
  } else { introDone = true; el.classList.add('is-live'); }

  // pulse only while visible; release the map when it scrolls away
  const vis = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    el.classList.toggle('is-inview', e.isIntersecting);
    if (!e.isIntersecting || e.intersectionRatio < 0.2) { if (active && !full) deactivate(); }
  }, { threshold: [0, 0.2] });
  vis.observe(frame);
  cleanups.push(() => vis.disconnect());

  cleanups.push(bus.on('motion:change', ({ allowed }: { allowed: boolean }) => { if (!allowed) { finishIntro(); cam.stop(); inertia?.kill(); } }));
  cleanups.push(bus.on('page:restore', () => { if (full) exitFull(); closeSheet(); }));

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (sheetLocked) { sheetLocked = false; unlockScroll(); bus.emit('modal:close'); }
    if (full) { full = false; unlockScroll(); bus.emit('modal:close'); }
    introTl?.kill(); inertia?.kill(); cam.stop();
    cancelAnimationFrame(raf);
    clearTimeout(showT); clearTimeout(hideT); clearTimeout(hintT2); clearTimeout(liveT);
    gsap.killTweensOf([...animEls.values()]);
    cleanups.splice(0).forEach((f) => f());
    el.classList.remove('fmap', `fmap--${opts.mode}`, 'fmap--touch', 'is-active', 'is-full', 'is-clustered', 'is-live', 'is-inview', 'is-pre', 'is-intro', 'is-intro-lite', 'is-list', 'is-portrait', 'is-filtered', 'is-far', 'is-near', 'is-hover', 'is-dragging');
    el.innerHTML = '';
  }

  return {
    destroy,
    select(id: string) {
      const s = byId.get(id);
      if (!s) return;
      if (cam.w <= 1) { if (picker && selectable(s)) setSelected(id); pendingId = id; return; }
      if (picker) {
        if (!selectable(s) || selectedId === id) return;
        setSelected(id);
        const [sx, sy] = cam.toScreen([s.x, s.y]);
        if (grouped(s) || sx < 30 || sx > cam.w - 30 || sy < 30 || sy > cam.h - 30) {
          markMoved();
          cam.to(cam.centerState([s.x, s.y], Math.max(cam.k, zk * 1.5)), 0.8);
        }
        return;
      }
      finishIntro();
      if (fullscreen) {
        // phones: a link to a tree opens it the way a tap does — the map full screen, the tree's sheet
        if (!full) enterFull();
        openSheet(s);
        holdSheetFocus();
        return;
      }
      markMoved();
      cam.to(cam.centerState([s.x, s.y], Math.max(cam.k, zk * 1.6)), 0.9).then(() => { if (!touch && !destroyed) showCard(s, true, true); });
    },
    getSelected() {
      const id = picker ? selectedId : (sheetId ?? (pinned ? cardId : null));
      return id ? byId.get(id) ?? null : null;
    },
  };
}
