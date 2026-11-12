/* What this visitor did with this tree — kept in the browser (demo).
   In the live version these go to the server; here localStorage (never throws). */
import { storage } from '../../core/storage';
import { israelDateKey, keyDiff, addDays, type Greeting, type LocalFacts } from '../model';
import type { Season } from '../../core/format';

export interface HerbLeaf { key: string; season: Season | 'special'; date: string; special?: 'firstFruit' | 'firstVisit'; laid?: boolean }

interface Local {
  firstVisit: string | null;
  lastVisit: string | null;
  visits: number;
  waterings: string[];          // Israel date keys
  greetings: Greeting[];        // sent from this browser (the greet mini-page)
  herb: HerbLeaf[];
  candles: string[];            // memorial: days a candle was lit
  queue: string[];              // offline waterings waiting to be sent
  guardiansSeen: boolean;       // the calm "שומרי העץ" card was shown once
  birthSeen: boolean;
}

const blank = (): Local => ({
  firstVisit: null, lastVisit: null, visits: 0, waterings: [], greetings: [], herb: [], candles: [], queue: [], guardiansSeen: false, birthSeen: false,
});

export class TreeStore {
  private key: string;
  data: Local;
  /** the last visit before this one (for "יש חדש" and "התגעגענו") */
  readonly previousVisit: string | null;
  constructor(readonly id: string) {
    this.key = `tree:${id}`;
    this.data = { ...blank(), ...storage.get<Partial<Local>>(this.key, {}) };
    this.previousVisit = this.data.lastVisit;
  }
  save() { storage.set(this.key, this.data); }

  /** count this visit (once per page load) */
  visit(today = israelDateKey()) {
    const d = this.data;
    if (!d.firstVisit) d.firstVisit = today;
    if (d.lastVisit !== today) d.visits += 1;
    d.lastVisit = today;
    this.save();
  }
  get isFirstVisit() { return this.previousVisit == null; }
  daysAway(today = israelDateKey()) { return this.previousVisit ? keyDiff(this.previousVisit, today) : 0; }

  wateredToday(today = israelDateKey()) { return this.data.waterings.includes(today); }
  water(today = israelDateKey()) {
    if (!this.data.waterings.includes(today)) this.data.waterings.push(today);
    this.data.waterings = this.data.waterings.slice(-120);
    this.save();
  }
  /** consecutive days ending today (or yesterday — today is still open) */
  streak(today = israelDateKey()): number {
    const set = new Set(this.data.waterings);
    let day = set.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (set.has(day)) { n++; day = addDays(day, -1); }
    return n;
  }
  /** demo: pretend the last n days were watered (presenter) */
  seedStreak(n: number, today = israelDateKey()) {
    const keep = this.data.waterings.filter((d) => d === today);
    const days: string[] = [];
    for (let i = n; i >= 1; i--) days.push(addDays(today, -i));
    this.data.waterings = [...days, ...keep];
    this.save();
  }
  clearToday(today = israelDateKey()) {
    this.data.waterings = this.data.waterings.filter((d) => d !== today);
    this.save();
  }

  addGreeting(g: Greeting) { this.data.greetings.push(g); this.save(); }

  /** lay in this season's leaf (once per season & year); returns it when new */
  collect(season: Season, today = israelDateKey()): HerbLeaf | null {
    const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    const year = season === 'winter' && m === 12 ? y + 1 : y; // winter spans Dec–Feb
    const key = `${year}-${season}`;
    if (this.data.herb.some((l) => l.key === key)) return null;
    const leaf: HerbLeaf = { key, season, date: today };
    this.data.herb.push(leaf);
    this.save();
    return leaf;
  }
  collectSpecial(kind: 'firstFruit' | 'firstVisit', today = israelDateKey()): HerbLeaf | null {
    if (this.data.herb.some((l) => l.special === kind)) return null;
    const leaf: HerbLeaf = { key: kind, season: 'special', special: kind, date: today };
    this.data.herb.push(leaf);
    this.save();
    return leaf;
  }
  markLaid(keys: string[]) {
    for (const l of this.data.herb) if (keys.includes(l.key)) l.laid = true;
    this.save();
  }

  candleToday(today = israelDateKey()) { return this.data.candles.includes(today); }
  lightCandle(today = israelDateKey()) { if (!this.candleToday(today)) { this.data.candles.push(today); this.save(); } }

  enqueue(today = israelDateKey()) { if (!this.data.queue.includes(today)) { this.data.queue.push(today); this.save(); } }
  flush(): string[] { const q = this.data.queue; this.data.queue = []; this.save(); return q; }

  reset() { this.data = blank(); this.save(); }

  facts(today = israelDateKey()): LocalFacts {
    return { wateredToday: this.wateredToday(today), myGreetings: this.data.greetings, lastVisit: this.previousVisit };
  }
}
