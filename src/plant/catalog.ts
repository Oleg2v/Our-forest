/* Configurator catalog: product modes, their step sequences, items and demo prices.
   All visible copy comes from he.ts; short functional labels that the brief does
   not give are marked "micro-copy". Prices from prices.ts (sub-item prices that
   prices.ts does not list are demo placeholders, multiples of 18 where possible). */
import { he } from '../content/he';
import { prices } from '../content/prices';
import type { SpeciesId } from '../components/forest-map';

export type Product = 'tree' | 'bench' | 'workshop' | 'corner';
export type StepId =
  | 'species' | 'item' | 'workshop' | 'date' | 'seats'
  | 'occasion' | 'plaque' | 'location' | 'extras' | 'gift' | 'summary' | 'checkout';
export type OccasionId = (typeof he.plant.occasions)[number]['id'];
export type ExtraId = 'family' | 'guardians' | 'certificate' | 'box';
export type BenchItemId = 'bench' | 'table' | 'fire' | 'kitchen' | 'class';
export type WorkshopId = 'carpentry' | 'dogs' | 'garden';

export const SPECIES = he.plant.species.map((s) => s.id) as SpeciesId[];
export const OCCASIONS = he.plant.occasions.map((o) => o.id) as OccasionId[];

/** step sequences per product (8 for tree/corner/bench, 6 for workshops) */
export const STEPS: Record<Product, StepId[]> = {
  tree: ['species', 'occasion', 'plaque', 'location', 'extras', 'gift', 'summary', 'checkout'],
  corner: ['species', 'occasion', 'plaque', 'location', 'extras', 'gift', 'summary', 'checkout'],
  bench: ['item', 'occasion', 'plaque', 'location', 'extras', 'gift', 'summary', 'checkout'],
  workshop: ['workshop', 'date', 'seats', 'gift', 'summary', 'checkout'],
};

/** step titles: the brief's five + the gift switch + "מה מקבלים" + payment (micro-copy) */
export function stepTitle(step: StepId, product: Product): string {
  const s = he.plant.steps;
  switch (step) {
    case 'species': return product === 'corner' ? 'בוחרים עץ לפינה' : s[0]; // corner: micro-copy
    case 'item': return 'מה בונים ליער?';            // micro-copy
    case 'workshop': return 'באיזו סדנה?';            // micro-copy
    case 'date': return 'מתי באים?';                  // micro-copy
    case 'seats': return 'כמה מגיעים?';               // micro-copy
    case 'occasion': return s[1];
    case 'plaque': return s[2];
    case 'location': return product === 'bench' ? 'איפה הוא יעמוד?' : s[3]; // bench: micro-copy
    case 'extras': return s[4];
    case 'gift': return he.plant.gift.toggle;
    case 'summary': return he.plant.summary.title;
    case 'checkout': return 'תשלום';                  // micro-copy
  }
}
/** short label in the step rail */
export function stepShort(step: StepId, product: Product): string {
  switch (step) {
    case 'species': return 'עץ';
    case 'item': return 'מה בונים';
    case 'workshop': return 'סדנה';
    case 'date': return 'תאריך';
    case 'seats': return 'משתתפים';
    case 'occasion': return 'לכבוד';
    case 'plaque': return 'שלט';
    case 'location': return 'מקום';
    case 'extras': return 'תוספות';
    case 'gift': return 'מתנה';
    case 'summary': return 'סיכום';
    case 'checkout': return 'תשלום';
  }
  return stepTitle(step, product);
}

export const PRODUCT_TITLE: Record<Product, string> = {
  tree: he.plant.title,
  bench: he.participate.cards[1].title,
  workshop: he.participate.cards[2].title,
  corner: he.participate.cards[3].title,
};
export const PRODUCT_TEXT: Record<Product, string> = {
  tree: he.participate.cards[0].text,
  bench: he.participate.cards[1].text,
  workshop: he.participate.cards[2].text,
  corner: he.participate.cards[3].text,
};
/** segmented switch labels (micro-copy, from the card titles' nouns) */
export const PRODUCT_TAB: Record<Product, string> = { tree: 'עץ', bench: 'נגרות', workshop: 'סדנה', corner: 'פינה' };

/* ---------- carpentry with a dedication ---------- */
export const BENCH_ITEMS: { id: BenchItemId; label: string; price: number }[] = [
  { id: 'bench', label: 'ספסל', price: prices.bench },
  { id: 'table', label: 'שולחן', price: 5400 },     // demo placeholder
  { id: 'fire', label: 'פינת מדורה', price: 6300 }, // demo placeholder
  { id: 'kitchen', label: 'מטבח', price: 12600 },   // demo placeholder
  { id: 'class', label: 'כיתת חוץ', price: 16200 }, // demo placeholder
];

/* ---------- corner: what it is made of (words from the brief's card text) ---------- */
export const CORNER_PARTS = ['עץ', 'תבלינים', 'ישיבה', 'תאורה', 'שלט'] as const;

/* ---------- workshops ---------- */
export const WORKSHOPS: { id: WorkshopId; title: string; price: number; seats: number[] }[] = [
  { id: 'carpentry', title: he.workshops.items[0].title, price: prices.workshopMax, seats: [6, 3, 11] },
  { id: 'dogs', title: he.workshops.items[1].title, price: 216, seats: [4, 9, 12] },        // demo placeholder in range
  { id: 'garden', title: he.workshops.items[2].title, price: prices.workshopMin, seats: [8, 2, 14] },
];
export const MAX_SEATS = 8;

/** next three Fridays (Israel), shifted per workshop so the lists differ — ISO yyyy-mm-dd */
export function workshopDates(ws: WorkshopId, now = new Date()): string[] {
  const idx = WORKSHOPS.findIndex((w) => w.id === ws);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const toFri = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + toFri + (idx % 2) * 7);
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i * 14 + (idx === 2 ? 1 : 0)); // garden on Saturdays
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/* ---------- extras ---------- */
export const EXTRAS: { id: ExtraId; price: number; monthly?: boolean }[] = [
  { id: 'family', price: prices.familyPlanting - prices.tree },
  { id: 'guardians', price: prices.guardiansMonthly, monthly: true },
  { id: 'certificate', price: prices.certificateFramed },
  { id: 'box', price: prices.forestBox },
];
export function extrasFor(product: Product): ExtraId[] {
  return product === 'bench' ? ['certificate', 'box'] : ['family', 'guardians', 'certificate', 'box'];
}
export const extraTitle = (id: ExtraId) => he.plant.extras.find((e) => e.id === id)!.title;
export const extraText = (id: ExtraId) => he.plant.extras.find((e) => e.id === id)!.text;

export const speciesName = (id: SpeciesId) => he.plant.species.find((s) => s.id === id)?.name ?? '';
export const speciesText = (id: SpeciesId) => he.plant.species.find((s) => s.id === id)?.text ?? '';
export const occasionLabel = (id: string) => he.plant.occasions.find((o) => o.id === id)?.label ?? '';

/** Tu BiShvat 2027 (brief p.6) — used for "send on Tu BiShvat" */
export const TU_BISHVAT = '2027-01-23';
