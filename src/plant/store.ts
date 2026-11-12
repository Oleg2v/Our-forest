/* Tiny configurator store + URL params (the whole selection lives in the URL, so an
   assembled tree can be shared). Selection changes → history.replaceState (debounced);
   step changes → pushState (the phone's back gesture goes one step back).
   Contact/payment details are never written to the URL. */
import type { SpeciesId } from '../components/forest-map';
import { prices } from '../content/prices';
import {
  SPECIES, OCCASIONS, STEPS, EXTRAS, BENCH_ITEMS, WORKSHOPS, MAX_SEATS, extrasFor, workshopDates,
  type Product, type StepId, type OccasionId, type ExtraId, type BenchItemId, type WorkshopId,
} from './catalog';

export type GiftWhen = 'now' | 'tubishvat' | 'date';
export type GiftVia = 'wa' | 'mail';
export interface PlantState {
  product: Product;
  step: StepId;
  species: SpeciesId;
  occasion: OccasionId | '';
  text: string;
  spot: string;          // chosen map spot id ('' = "תבחרו בשבילנו")
  spotMode: 'auto' | 'map';
  extras: ExtraId[];
  item: BenchItemId;
  ws: WorkshopId;
  date: string;          // workshop date ISO
  seats: number;
  gift: boolean;
  giftTo: string;
  giftWhen: GiftWhen;
  giftDate: string;
  giftMsg: string;
  giftVia: GiftVia;
}

const PRODUCTS: Product[] = ['tree', 'bench', 'workshop', 'corner'];
const pick = <T extends string>(v: string | null, list: readonly T[], d: T): T => (v && (list as readonly string[]).includes(v) ? (v as T) : d);

export function defaults(product: Product = 'tree'): PlantState {
  const ws: WorkshopId = 'carpentry';
  return {
    product, step: STEPS[product][0], species: 'olive', occasion: '', text: '', spot: '', spotMode: 'auto', extras: [],
    item: 'bench', ws, date: workshopDates(ws)[0], seats: 2,
    gift: false, giftTo: '', giftWhen: 'now', giftDate: '', giftMsg: '', giftVia: 'wa',
  };
}

export function fromUrl(search = location.search): PlantState {
  const q = new URLSearchParams(search);
  const product = pick(q.get('product'), PRODUCTS, 'tree');
  const s = defaults(product);
  s.species = pick(q.get('species'), SPECIES, s.species);
  s.occasion = pick(q.get('occasion'), OCCASIONS, '' as OccasionId) || '';
  s.text = (q.get('text') ?? '').slice(0, 40);
  const spot = (q.get('spot') ?? '').replace(/[^\w-]/g, '').slice(0, 12);
  if (spot) { s.spot = spot; s.spotMode = 'map'; }
  const allowed = extrasFor(product);
  s.extras = (q.get('x') ?? '').split(',').filter((x): x is ExtraId => (allowed as string[]).includes(x));
  s.item = pick(q.get('item'), BENCH_ITEMS.map((b) => b.id), s.item);
  s.ws = pick(q.get('ws'), WORKSHOPS.map((w) => w.id), s.ws);
  const dates = workshopDates(s.ws);
  s.date = pick(q.get('date'), dates, dates[0]);
  const seats = parseInt(q.get('seats') ?? '', 10);
  if (seats >= 1 && seats <= MAX_SEATS) s.seats = seats;
  s.gift = q.get('gift') === '1';
  s.giftTo = (q.get('to') ?? '').slice(0, 40);
  s.giftWhen = pick(q.get('when'), ['now', 'tubishvat', 'date'] as const, 'now');
  s.giftDate = /^\d{4}-\d{2}-\d{2}$/.test(q.get('gdate') ?? '') ? q.get('gdate')! : '';
  s.giftMsg = (q.get('msg') ?? '').slice(0, 280);
  s.giftVia = pick(q.get('via'), ['wa', 'mail'] as const, 'wa');
  // ?ws= alone means the workshop mode (links from the home "workshops" list)
  if (!q.get('product') && q.get('ws')) { s.product = 'workshop'; s.step = STEPS.workshop[0]; }
  const step = q.get('step') as StepId | null;
  if (step && STEPS[s.product].includes(step)) s.step = step;
  return s;
}

export function toQuery(s: PlantState): string {
  const d = defaults(s.product);
  const q = new URLSearchParams();
  if (s.product !== 'tree') q.set('product', s.product);
  const steps = STEPS[s.product];
  if (s.product === 'workshop') {
    q.set('ws', s.ws);
    if (s.date !== workshopDates(s.ws)[0]) q.set('date', s.date);
    if (s.seats !== d.seats) q.set('seats', String(s.seats));
  } else {
    if (steps.includes('species')) q.set('species', s.species);
    if (steps.includes('item')) q.set('item', s.item);
    if (s.occasion) q.set('occasion', s.occasion);
    if (s.text.trim()) q.set('text', s.text);
    if (s.spotMode === 'map' && s.spot) q.set('spot', s.spot);
    if (s.extras.length) q.set('x', s.extras.join(','));
  }
  if (s.gift) {
    q.set('gift', '1');
    if (s.giftTo) q.set('to', s.giftTo);
    if (s.giftWhen !== 'now') q.set('when', s.giftWhen);
    if (s.giftWhen === 'date' && s.giftDate) q.set('gdate', s.giftDate);
    if (s.giftMsg) q.set('msg', s.giftMsg);
    if (s.giftVia !== 'wa') q.set('via', s.giftVia);
  }
  if (s.step !== steps[0]) q.set('step', s.step);
  const str = q.toString();
  return str ? `?${str}` : '';
}

/* ---------------- pricing ---------------- */
export interface PriceLine { id: string; label: string; amount: number; monthly?: boolean }
export interface Pricing { base: number; lines: PriceLine[]; total: number; monthly: number }

export function pricing(s: PlantState, labels: { main: string; extra: (id: ExtraId) => string }): Pricing {
  const lines: PriceLine[] = [];
  let base = 0;
  if (s.product === 'tree') base = prices.tree;
  else if (s.product === 'corner') base = prices.corner;
  else if (s.product === 'bench') base = BENCH_ITEMS.find((b) => b.id === s.item)!.price;
  else base = WORKSHOPS.find((w) => w.id === s.ws)!.price * s.seats;
  lines.push({ id: 'main', label: labels.main, amount: base });
  let monthly = 0;
  if (s.product !== 'workshop') {
    for (const id of s.extras) {
      const e = EXTRAS.find((x) => x.id === id);
      if (!e) continue;
      lines.push({ id, label: labels.extra(id), amount: e.price, monthly: e.monthly });
      if (e.monthly) monthly += e.price;
    }
  }
  const total = lines.filter((l) => !l.monthly).reduce((a, l) => a + l.amount, 0);
  return { base, lines, total, monthly };
}

/* ---------------- store ---------------- */
type Listener = (s: PlantState, prev: PlantState) => void;
export interface Store {
  get(): PlantState;
  set(patch: Partial<PlantState>, opts?: { history?: 'push' | 'replace' | 'none' }): void;
  subscribe(fn: Listener): () => void;
}

export function createStore(initial: PlantState): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  let timer = 0;
  const write = (mode: 'push' | 'replace') => {
    const url = `${location.pathname}${toQuery(state)}${location.hash}`;
    if (url === `${location.pathname}${location.search}${location.hash}`) return;
    try {
      if (mode === 'push') history.pushState({ plant: true }, '', url);
      else history.replaceState({ ...(history.state ?? {}), plant: true }, '', url);
    } catch { /* sandboxed */ }
  };
  return {
    get: () => state,
    set(patch, opts = {}) {
      const prev = state;
      state = { ...state, ...patch };
      const mode = opts.history ?? (patch.step && patch.step !== prev.step ? 'push' : 'replace');
      if (mode === 'push') { clearTimeout(timer); write('push'); }
      else if (mode === 'replace') { clearTimeout(timer); timer = window.setTimeout(() => write('replace'), 160); }
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export const clampSeats = (n: number) => Math.max(1, Math.min(MAX_SEATS, n));
