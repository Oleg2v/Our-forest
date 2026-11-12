/* ==========================================================================
   /tree/0427 — the honest model.
   Derives the scene state (TreeSceneState, see scene-api.ts) from:
     · src/data/tree.json (the team's records: planting, waterings, pruning, greetings)
     · the real time in Israel (time of day, season, age)
     · the demo switches (URL ?state= ?mode= … and the presenter panel)
     · what this visitor did, stored locally (watering today, greetings they sent)
   Nothing here punishes: a missed day only resets the streak quietly.
   ========================================================================== */
import treeJson from '../data/tree.json';
import treesJson from '../data/trees.json';
import type { TreeSceneState, Weather, GreetingLeaf } from './scene-api';
import type { SpeciesId } from '../components/forest-map';
import { israelNow, seasonOf, daysBetween, dayPeriod, type Season } from '../core/format';
import { he } from '../content/he';

/* ------------------------------------------------------------------ types */
export type PageState = 'before' | 'birth' | 'visit' | 'absent' | 'gift' | 'multi' | 'offline';
export type TreeMode = 'celebration' | 'memorial';
export const PAGE_STATES: PageState[] = ['before', 'birth', 'visit', 'absent', 'gift', 'multi', 'offline'];

export interface TreeEvent { date: string; type: string; photo?: string; imageKey?: string }
export interface Greeting { id: string; from: string; initials: string; text: string; date: string; amount?: number; mine?: boolean }
export interface TreeRecord {
  id: string; seed: number; species: SpeciesId; mode: TreeMode; plantedAt: string;
  dedication: string; plantedBy: string; owner: string; stage: string;
  heightCm: number; rootDepthCm: number; lastTeamWatering: string; lastPrune: string | null;
  harvest: string | null; events: TreeEvent[]; greetings: Greeting[];
  community: { wateringsToday: number; sponsor: string; goal: number };
}

/** demo switches — URL params and the presenter panel */
export interface Demo {
  state: PageState;
  mode: TreeMode;
  /** null = live Israel time */
  hours: number | null;
  weather: Weather;
  wind: number;
  /** null = the real season */
  season: Season | null;
  harvest: boolean;
}

/* ------------------------------------------------------------------ species */
export interface SpeciesInfo { he: string; latin: string; evergreen: boolean; /** grammatical gender of the name (תאנה is feminine) */ fem?: boolean; harvest: string; seasonNote: Record<Season, string> }
/** short honest notes per species & season (the fig/autumn one is the brief's own line) */
export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  fig: {
    he: 'תאנה', latin: 'Ficus carica', evergreen: false, fem: true, harvest: 'אוגוסט–ספטמבר',
    seasonNote: { autumn: he.tree.seasonNote.fig_autumn, winter: 'התאנה נחה, בלי עלים', spring: 'התאנה מוציאה עלים חדשים', summer: 'התאנה ירוקה ועבותה' },
  },
  olive: {
    he: 'זית', latin: 'Olea europaea', evergreen: true, harvest: 'אוקטובר–נובמבר',
    seasonNote: { autumn: 'הזית ירוק גם בסתיו', winter: 'הזית ירוק כל החורף', spring: 'הזית פורח בפרחים קטנים', summer: 'הזית מחזיק מעמד בחום' },
  },
  pomegranate: {
    he: 'רימון', latin: 'Punica granatum', evergreen: false, harvest: 'ספטמבר–אוקטובר',
    seasonNote: { autumn: 'הרימון מצהיב ומשיר עלים', winter: 'הרימון נח, בלי עלים', spring: 'הרימון מוציא עלים ופרחים', summer: 'הפירות של הרימון גדלים' },
  },
  carob: {
    he: 'חרוב', latin: 'Ceratonia siliqua', evergreen: true, harvest: 'אוגוסט–ספטמבר',
    seasonNote: { autumn: 'החרוב פורח בסתיו', winter: 'החרוב ירוק כל החורף', spring: 'התרמילים של החרוב גדלים', summer: 'החרוב נותן צל' },
  },
  almond: {
    he: 'שקד', latin: 'Prunus dulcis', evergreen: false, harvest: 'יולי–אוגוסט',
    seasonNote: { autumn: 'השקד משיר עלים', winter: 'השקד מתכונן לפריחה', spring: 'השקד מוציא עלים', summer: 'השקדים מבשילים' },
  },
  mulberry: {
    he: 'תות', latin: 'Morus', evergreen: false, harvest: 'מאי–יוני',
    seasonNote: { autumn: 'התות מצהיב ומשיר עלים', winter: 'התות נח, בלי עלים', spring: 'התות מוציא עלים ופירות', summer: 'התות ירוק ורחב' },
  },
};

/** the a11y phrase per season ("מתכונן לחורף" in the brief's example) */
const SEASON_A11Y: Record<Season, string> = { autumn: 'מתכונן לחורף', winter: 'נח בחורף', spring: 'מתעורר באביב', summer: 'ירוק בקיץ' };
export const SEASON_HE: Record<Season, string> = { spring: 'אביב', summer: 'קיץ', autumn: 'סתיו', winter: 'חורף' };
export const WEATHER_HE: Record<Weather, string> = { clear: 'בהיר', wind: 'רוח', rain: 'גשם', hamsin: 'חמסין' };

/* ------------------------------------------------------------------ data */
export const TREE: TreeRecord = treeJson as unknown as TreeRecord;

interface MapTree { id: string; status: string; species?: SpeciesId; occasion?: string; dedication?: string; plantedBy?: string; date?: string }
const MAP: MapTree[] = treesJson as unknown as MapTree[];

/** the demo family's other trees (state "multi") — real points from the forest map */
export function familyTrees(): TreeRecord[] {
  const pick = (id: string): TreeRecord | null => {
    const t = MAP.find((x) => x.id === id && x.status === 'planted');
    if (!t || !t.species || !t.date) return null;
    return {
      ...TREE, id: t.id, seed: Number(t.id), species: t.species, mode: t.occasion === 'memorial' ? 'memorial' : 'celebration',
      plantedAt: t.date, dedication: t.dedication ?? '', plantedBy: t.plantedBy ?? TREE.plantedBy,
      heightCm: 90, rootDepthCm: 30, events: [{ date: t.date, type: 'planted' }], greetings: [], harvest: null,
    };
  };
  return [TREE, pick('0122'), pick('0114')].filter((t): t is TreeRecord => !!t);
}

/** the fields of a tree the team planted today (a sapling with a fresh history): the /plant hand-off,
 *  and the "before planting" demo once the planting notice arrives */
export function plantedTodayFields(today: string): Partial<TreeRecord> {
  return {
    plantedAt: today, lastTeamWatering: today, lastPrune: null, harvest: null, heightCm: 60, rootDepthCm: 25, stage: 'sapling',
    events: [{ date: today, type: 'planted' }], greetings: [],
  };
}

/** a demo memorial dedication (a real memorial point on the forest map) */
export const MEMORIAL_DEMO = { dedication: 'לזכר סבא אברהם', name: 'סבא אברהם' };

/* ------------------------------------------------------------------ dates (Israel) */
const pad = (n: number) => String(n).padStart(2, '0');
/** "2026-11-12" — today's date in Israel */
export function israelDateKey(now = new Date()): string {
  const t = israelNow(now);
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function keyDiff(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
}
/** ms until the next midnight in Israel (the next watering) */
export function msUntilIsraelMidnight(now = new Date()): number {
  const t = israelNow(now);
  const secs = (24 - t.hours) * 3600;
  return Math.max(60_000, Math.round(secs * 1000));
}
/** "9 ש׳ ו־12 ד׳" */
export function durationHe(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  if (h === 0) return `${mm} דקות`;
  if (mm === 0) return h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return `${h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`} ו־${mm} דקות`;
}
export function monthOf(key: string): number { return Number(key.slice(5, 7)); }

/* ------------------------------------------------------------------ words */
/** "בן 9 חודשים" (Hebrew counting; the tree is masculine: עץ) */
export function ageHe(days: number): string {
  const d = Math.max(0, Math.round(days));
  const months = Math.round(d / 30.44);
  if (d < 30) return d <= 1 ? 'בן יום' : d === 2 ? 'בן יומיים' : `בן ${d} ימים`;
  if (months < 12) return months === 1 ? 'בן חודש' : months === 2 ? 'בן חודשיים' : `בן ${months} חודשים`;
  const y = Math.floor(months / 12);
  return y === 1 ? 'בן שנה' : y === 2 ? 'בן שנתיים' : `בן ${y} שנים`;
}
/** initials with gershayim: "דנה לוי" → "ד״ל", "רותי" → "ר" */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '·';
  if (words.length === 1) return words[0][0];
  return `${words[0][0]}״${words[words.length - 1][0]}`;
}
/** the person a memorial tree remembers: "לזכר סבא אברהם" → "סבא אברהם" */
export function memorialName(dedication: string): string {
  const m = dedication.match(/^לזכר(?:ו|ה)?\s+(?:של\s+)?(.+)$/);
  return (m ? m[1] : dedication).replace(/[,،].*$/, '').trim() || dedication;
}

/* ------------------------------------------------------------------ demo switches */
export function readDemo(search = location.search): { demo: Partial<Demo>; flags: { birth: boolean; greet: boolean; qr: boolean; gift: boolean; species?: SpeciesId; text?: string; from?: string; msg?: string } } {
  const q = new URLSearchParams(search);
  const demo: Partial<Demo> = {};
  const st = q.get('state') as PageState | null;
  if (st && PAGE_STATES.includes(st)) demo.state = st;
  if (q.get('mode') === 'memorial') demo.mode = 'memorial';
  const h = Number(q.get('hours') ?? q.get('time'));
  if (q.has('hours') || q.has('time')) { if (Number.isFinite(h)) demo.hours = Math.max(0, Math.min(23.99, h)); }
  const w = q.get('weather') as Weather | null;
  if (w && ['clear', 'wind', 'rain', 'hamsin'].includes(w)) demo.weather = w;
  const s = q.get('season') as Season | null;
  if (s && ['spring', 'summer', 'autumn', 'winter'].includes(s)) demo.season = s;
  if (q.get('harvest') === '1') demo.harvest = true;
  const sp = q.get('species') as SpeciesId | null;
  const text = (q.get('text') ?? '').trim().slice(0, 40);
  return {
    demo,
    flags: {
      birth: q.get('birth') === '1', greet: q.get('greet') === '1', qr: q.get('qr') === '1', gift: q.get('gift') === '1',
      species: sp && sp in SPECIES ? sp : undefined, text: text || undefined,
      from: (q.get('from') ?? '').slice(0, 40) || undefined, msg: (q.get('msg') ?? '').slice(0, 280) || undefined,
    },
  };
}

/* ------------------------------------------------------------------ derive */
export interface LocalFacts {
  /** the visitor watered today (Israel date) */
  wateredToday: boolean;
  /** greetings this visitor sent (stored in the browser) */
  myGreetings: Greeting[];
  /** greetings already seen (for "יש חדש") */
  lastVisit: string | null;
}

export function allGreetings(tree: TreeRecord, local: LocalFacts): Greeting[] {
  return [...tree.greetings, ...local.myGreetings].sort((a, b) => a.date.localeCompare(b.date));
}

/** a greeting leaf glows for 7 days, then keeps a small dot */
export function greetingLeaves(list: Greeting[], today = israelDateKey()): GreetingLeaf[] {
  return list.map((g) => ({ id: g.id, initials: g.initials, glowing: keyDiff(g.date, today) < 7 }));
}

export function soilMoistureOf(tree: TreeRecord, local: LocalFacts, today = israelDateKey()): number {
  if (local.wateredToday) return 0.85;
  const d = keyDiff(tree.lastTeamWatering, today);
  return d <= 0 ? 0.75 : d === 1 ? 0.6 : d === 2 ? 0.42 : d <= 4 ? 0.28 : 0.15;
}

export function deriveScene(tree: TreeRecord, demo: Demo, local: LocalFacts, quality: 0 | 1 | 2 | 3, now = new Date()): TreeSceneState {
  const today = israelDateKey(now);
  const t = israelNow(now);
  const before = demo.state === 'before';
  const ageDays = before ? -9 : daysBetween(tree.plantedAt, `${today}`);
  const lastPrune = tree.lastPrune ? keyDiff(tree.lastPrune, today) : 999;
  const greets = allGreetings(tree, local);
  const newsSince = local.lastVisit ?? addDays(today, -3);
  const hasNews = demo.state !== 'before' && (
    greets.some((g) => g.date > newsSince && !g.mine) || tree.events.some((e) => e.date > newsSince)
  );
  return {
    id: tree.id,
    seed: tree.seed,
    species: tree.species,
    mode: demo.mode,
    dedication: tree.dedication,
    hours: demo.hours ?? t.hours,
    season: demo.season ?? seasonOf(t.month),
    weather: demo.weather,
    windStrength: demo.wind,
    ageDays,
    futureGhost: false,
    soilMoisture: before ? 0.2 : soilMoistureOf(tree, local, today),
    freshPrune: lastPrune >= 0 && lastPrune <= 21,
    harvestReady: !before && (demo.harvest || !!tree.harvest),
    planted: !before,
    greetings: demo.mode === 'memorial' ? [] : greetingLeaves(greets, today),
    hasNews: demo.mode !== 'memorial' && hasNews,
    quality,
  };
}

/** screen-reader description from the real state — "עץ תאנה, בן 9 חודשים, מתכונן לחורף, הושקה היום" */
export function describeTree(tree: TreeRecord, s: TreeSceneState, local: LocalFacts): string {
  const sp = SPECIES[s.species] ?? SPECIES.fig;
  if (!s.planted) return `עץ ${sp.he}, ${he.tree.states.plantingIn(9)}`;
  const parts = [`עץ ${sp.he}`, ageHe(s.ageDays), SEASON_A11Y[s.season]];
  const today = israelDateKey();
  const team = keyDiff(tree.lastTeamWatering, today);
  if (s.mode !== 'memorial' && local.wateredToday) parts.push('הושקה היום');
  else if (team <= 0) parts.push('הושקה היום');
  else if (team === 1) parts.push('הושקה אתמול');
  else if (team === 2) parts.push('הושקה שלשום');
  if (s.harvestReady) parts.push('יש פירות בשלים');
  if (s.greetings.length) parts.push(`${s.greetings.length} עלי ברכה על הענפים`);
  return parts.join(', ');
}

/** the honest line under the title */
export function seasonNote(s: TreeSceneState): string {
  return (SPECIES[s.species] ?? SPECIES.fig).seasonNote[s.season];
}

/** "בוקר טוב" etc. for the given hour */
export function greetingFor(hours: number): string { return he.hero.greetings[dayPeriod(hours)]; }
