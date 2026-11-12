/* Forest map data: spots from src/data/trees.json, labels from he.ts, and the card
   content used by the hover card (desktop), the bottom sheet (phone) and the text list. */
import raw from '../../data/trees.json';
import { he } from '../../content/he';
import { prices } from '../../content/prices';
import { ilDate, ils } from '../../core/format';
import type { Spot, SpeciesId, SpotKind } from '../forest-map';
import { icon, speciesIcon } from './icons';

export const SPOTS = raw as unknown as Spot[];

export const SPECIES_IDS = he.plant.species.map((s) => s.id) as SpeciesId[];
export const speciesName = (s?: SpeciesId) => he.plant.species.find((x) => x.id === s)?.name ?? '';
/** "עץ תאנה" (the brief's card example) */
export const speciesTitle = (s?: SpeciesId) => (s ? `עץ ${speciesName(s)}` : '');
export const occasionLabel = (o?: string) => he.plant.occasions.find((x) => x.id === o)?.label ?? '';

/** furniture names — the words of the brief's card "ספסל, שולחן, פינת מדורה" (micro-copy) */
export const KIND_LABEL: Record<SpotKind, string> = {
  tree: 'עץ', bench: 'ספסל', table: 'שולחן', fire: 'פינת מדורה', corner: 'פינה',
};
export const isFurniture = (k: SpotKind) => k === 'bench' || k === 'table' || k === 'fire';

/* micro-copy (not in the brief) — kept minimal, in the brief's voice */
export const MC = {
  private: 'הקדשה פרטית',
  spot: (id: string) => `מקום מס׳ ${id}`,
  trees: (n: number) => `${n} עצים`,
  waiting: (n: number) => `${n} ${he.map.legend.free}`,
  hintClick: 'לוחצים על המפה כדי לטייל בה',
  hintTap: 'נוגעים במפה כדי לטייל בה',
  hintActive: 'גוררים, מקרבים ומרחיקים · Esc לסיום',
  hintActiveTouch: 'גוררים בשתי אצבעות כדי לקרב',
  done: 'סיום',
  zoomIn: 'קירוב',
  zoomOut: 'הרחקה',
  fit: 'כל היער',
  list: 'רשימה',
  map: 'מפה',
  all: 'הכל',
  bySpecies: 'סינון לפי עץ',
  byOccasion: he.plant.steps[1], // "לכבוד מה?"
  allOccasions: 'כל האירועים',
  listTitle: 'רשימת העצים במפה',
  mapLabel: 'מפת היער: תוכנית החלקה מלמעלה',
  freeGroup: 'מקומות פנויים במפה',
  close: he.nav.close,
  built: 'נבנה',
  plantedGroup: he.map.legend.planted,
  reservedGroup: he.map.legend.reserved,
  freeGroupLabel: he.map.legend.free,
  selected: 'נבחר',
  cluster: (n: number, free: number) => `${n} עצים${free ? `, ${free} ${he.map.legend.free}` : ''}`,
  results: (n: number) => `${n} עצים מתאימים`,
} as const;

export function daysUntil(iso: string, now = new Date()): number {
  const t = new Date(`${iso}T12:00:00`).getTime();
  return Math.max(0, Math.ceil((t - now.getTime()) / 86400000));
}

/** where a free spot leads (the configurator mode for that object) */
export function spotHref(s: Spot, species?: SpeciesId | ''): string {
  const q = new URLSearchParams();
  if (s.kind === 'corner') q.set('product', 'corner');
  else if (isFurniture(s.kind)) { q.set('product', 'bench'); q.set('item', s.kind); }
  else if (species) q.set('species', species);
  q.set('spot', s.id);
  return `/plant?${q.toString()}`;
}

export function priceFor(s: Spot): { from: boolean; n: number } {
  if (s.kind === 'corner') return { from: true, n: prices.corner };
  if (isFurniture(s.kind)) return { from: true, n: prices.bench };
  return { from: false, n: prices.tree };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** short accessible name for a spot */
export function spotLabel(s: Spot): string {
  if (s.status === 'free') {
    const what = s.kind === 'tree' ? he.map.free : s.kind === 'corner' ? he.participate.cards[3].title : `${KIND_LABEL[s.kind]} · ${he.participate.cards[1].title}`;
    return `${what}, ${MC.spot(s.id)}`;
  }
  if (s.kind !== 'tree') return `${KIND_LABEL[s.kind]}${s.public && s.dedication ? `: ${s.dedication}` : ''}`;
  const parts = [speciesTitle(s.species), s.status === 'reserved' ? he.map.legend.reserved : s.date ? he.map.plantedOn(ilDate(s.date)) : ''];
  if (s.status === 'planted') parts.push(s.public && s.dedication ? s.dedication : MC.private);
  if (s.status === 'planted' && s.public && s.plantedBy) parts.push(s.plantedBy);
  return parts.filter(Boolean).join(', ');
}

/** card body (hover card / bottom sheet). `cta` = render the action button (home mode). */
export function cardHtml(s: Spot, opts: { cta?: boolean; species?: SpeciesId | '' } = {}): string {
  const num = `<bdi class="fmc__num">${esc(s.status === 'free' || s.kind !== 'tree' ? MC.spot(s.id) : he.tree.number(s.id))}</bdi>`;
  if (s.status === 'free') {
    const p = priceFor(s);
    const priceLine = `<p class="fmc__price">${p.from ? 'החל מ־' : ''}<bdi class="price">${ils(p.n)}</bdi></p>`;
    const btn = opts.cta
      ? `<a class="btn btn--fruit btn--sm fmc__cta" href="${spotHref(s, opts.species)}" data-cursor="${he.cursor.plant}" data-cursor-fill="fruit">${he.map.choose}${icon('arrow', 'icon arrow-fwd')}</a>`
      : '';
    if (s.kind === 'tree') {
      return `<div class="fmc fmc--free">
        <p class="fmc__eyebrow"><span class="fmc__dot" aria-hidden="true"></span>${he.map.legend.free}${num}</p>
        <p class="fmc__title">${he.map.free}</p>${priceLine}${btn}</div>`;
    }
    if (s.kind === 'corner') {
      return `<div class="fmc fmc--free">
        <p class="fmc__eyebrow">${icon('corner', 'icon fmc__ico')}${he.participate.cards[3].title}${num}</p>
        <p class="fmc__title">${he.participate.cards[3].text}</p>${priceLine}${btn}</div>`;
    }
    return `<div class="fmc fmc--free">
      <p class="fmc__eyebrow">${icon(s.kind === 'fire' ? 'fire' : s.kind === 'table' ? 'table' : 'bench', 'icon fmc__ico')}${he.participate.cards[1].title}${num}</p>
      <p class="fmc__title">${KIND_LABEL[s.kind]}</p>${priceLine}${btn}</div>`;
  }
  if (s.kind !== 'tree') {
    return `<div class="fmc">
      <p class="fmc__eyebrow">${icon('bench', 'icon fmc__ico')}${KIND_LABEL[s.kind]}${num}</p>
      ${s.public && s.dedication ? `<p class="fmc__ded">${esc(s.dedication)}</p>` : `<p class="fmc__private">${icon('lock', 'icon')}${MC.private}</p>`}
      ${s.public && s.plantedBy ? `<p class="fmc__by">${esc(s.plantedBy)}</p>` : ''}
      ${s.date ? `<p class="fmc__meta"><bdi>${ilDate(s.date)}</bdi></p>` : ''}</div>`;
  }
  const head = `<p class="fmc__eyebrow">${s.species ? speciesIcon(s.species, 'icon fmc__ico') : ''}<span>${speciesTitle(s.species)}</span>${num}</p>`;
  if (s.status === 'reserved') {
    return `<div class="fmc fmc--reserved">${head}
      <p class="fmc__title">${he.map.legend.reserved}</p>
      ${s.date ? `<p class="fmc__meta">${he.tree.states.plantingIn(daysUntil(s.date))}</p>` : ''}</div>`;
  }
  const ded = s.public && s.dedication
    ? `<p class="fmc__ded">${esc(s.dedication)}</p>${s.plantedBy ? `<p class="fmc__by">${esc(s.plantedBy)}</p>` : ''}`
    : `<p class="fmc__private">${icon('lock', 'icon')}${MC.private}</p>`;
  const link = s.id === '0427' && opts.cta !== false
    ? `<a class="fmc__link" href="/tree/0427">${he.plant.after.view}${icon('arrow', 'icon arrow-fwd')}</a>` : '';
  return `<div class="fmc fmc--planted">${head}${ded}
    ${s.date ? `<p class="fmc__meta">${he.map.plantedOn(`<bdi>${ilDate(s.date)}</bdi>`)}${s.occasion ? ` · ${occasionLabel(s.occasion)}` : ''}</p>` : ''}${link}</div>`;
}

/* ---------- zones (clusters when zoomed out) ---------- */
export interface Zone { id: string; spots: Spot[]; cx: number; cy: number }
export function zonesOf(spots: Spot[]): Zone[] {
  const map = new Map<string, Spot[]>();
  spots.forEach((s) => { if (s.zone) (map.get(s.zone) ?? map.set(s.zone, []).get(s.zone)!).push(s); });
  return [...map.entries()].map(([id, list]) => ({
    id, spots: list,
    cx: list.reduce((a, s) => a + s.x, 0) / list.length,
    cy: list.reduce((a, s) => a + s.y, 0) / list.length,
  }));
}
