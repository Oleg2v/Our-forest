/* ==========================================================================
   Home section 7 — the wall of people. Markup: partials/home/wall.html
   ONE motion idea: two quiet rivers of names — the public dedications from the forest map
   (SPOTS of src/components/forest-map/data: status 'planted' && public) drift in opposite directions (RTL: the big row travels right → left).
   · speed follows the scroll a little (a gust when you scroll fast), then settles
   · hover (desktop) / touch (phones) eases both rows to a stop so a dedication can be read
   · a visible pause button (WCAG 2.2.2), state in aria-pressed
   · reduced motion / "stop animations": static, wrapped rows; no ticker at all
   · the ticker runs only while the band is on screen
   ========================================================================== */
import './wall.css';
import { gsap, ScrollTrigger } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { he, NBSP } from '../../content/he';
import { SPOTS, KIND_LABEL, speciesTitle } from '../../components/forest-map/data';
interface Item { id: string; ded: string; by: string }

const heGet = (path: string): unknown => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), he);
/** demo data uses this as a stand-in for a company's name — never show it as a signature */
const PLACEHOLDER_BY = 'שם החברה';

/** cheap deterministic hash → stable, varied order (no Math.random: same wall on every visit) */
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function dedications(): { a: Item[]; b: Item[] } {
  const seen = new Set<string>();
  const list: Item[] = [];
  for (const s of SPOTS) {
    if (s.status !== 'planted' || s.public !== true) continue;
    const ded = s.dedication?.trim();
    if (!ded || seen.has(ded)) continue;
    seen.add(ded);
    // the same names the map's cards use. Always "עץ רימון", never a bare "רימון" / "שקד": right after a
    // dedication a bare species reads as part of it ("…של בית הספר רימון", "…באהבה שקד" — שקד is also a name)
    const what = s.kind && s.kind !== 'tree' ? KIND_LABEL[s.kind] : speciesTitle(s.species);
    let who = s.plantedBy && s.plantedBy !== PLACEHOLDER_BY ? s.plantedBy.trim() : '';
    if (who && ded.includes(who)) who = ''; // already signed inside the dedication ("…, מהחבר׳ה מהמושב")
    list.push({ id: s.id, ded, by: [who, what].filter(Boolean).join(' · ') });
  }
  list.sort((x, y) => hash(x.id) - hash(y.id));
  // the demo tree (0427, "לכבוד הולדת נועה") opens the big row
  const i0427 = list.findIndex((x) => x.id === '0427');
  if (i0427 > 0) list.unshift(...list.splice(i0427, 1));
  // big row: the shorter dedications read best at display size
  const a: Item[] = [];
  const b: Item[] = [];
  for (const it of list) {
    if (a.length < 14 && (it.ded.length <= 22 || a.length === 0)) a.push(it);
    else if (b.length < 22) b.push(it);
  }
  return { a, b };
}

function listEl(items: Item[], hidden: boolean): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = 'wall__list';
  if (hidden) ul.setAttribute('aria-hidden', 'true'); else ul.setAttribute('role', 'list');
  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'wall__item';
    const d = document.createElement('span');
    d.className = 'wall__ded';
    d.textContent = it.ded;
    li.append(d);
    if (it.by) {
      // screen readers: a pause between the dedication and its signature (the gap is visual only)
      const sep = document.createElement('span');
      sep.className = 'visually-hidden';
      sep.textContent = ', ';
      const b = document.createElement('span');
      b.className = 'wall__by';
      b.textContent = it.by;
      li.append(sep, b);
    }
    ul.append(li);
  }
  return ul;
}

class Row {
  track: HTMLDivElement;
  x = 0;
  v = 0;
  span = 1;
  constructor(public el: HTMLElement, public items: Item[], public base: number, public dir: 1 | -1) {
    this.track = document.createElement('div');
    this.track.className = 'wall__track';
    this.track.append(listEl(items, false));
    el.append(this.track);
  }
  /** one copy's width = loop distance; enough copies so the row never shows a gap */
  layout(live: boolean) {
    const lists = Array.from(this.track.querySelectorAll('.wall__list'));
    lists.slice(1).forEach((l) => l.remove());
    this.track.style.transform = '';
    if (!live) return;
    this.span = Math.max(1, lists[0].getBoundingClientRect().width);
    const need = Math.max(1, Math.ceil(this.el.clientWidth / this.span));
    for (let i = 0; i < need; i++) this.track.append(listEl(this.items, true));
    this.x = this.dir > 0 ? -this.span * 0.5 : -this.span * 0.15;
    this.paint();
  }
  step(dt: number, target: number) {
    // critically-damped-ish approach to the target speed → stops and starts feel eased, never abrupt
    this.v += (target * this.base - this.v) * (1 - Math.exp(-dt * 3.4));
    // settled at a stop: really stop (no endless sub-pixel repaints while someone reads)
    if (target === 0 && Math.abs(this.v) < 0.25) { if (this.v !== 0) { this.v = 0; } return; }
    this.x += this.dir * this.v * dt;
    if (this.x <= -this.span) this.x += this.span;
    else if (this.x > 0) this.x -= this.span;
    this.paint();
  }
  paint() { this.track.style.transform = `translate3d(${this.x.toFixed(2)}px,0,0)`; }
}

export function initWall(): void {
  const root = document.getElementById('wall');
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-he]').forEach((el) => {
    let v = heGet(el.dataset.he!);
    // typography only: a dash never opens a line (glue it to the word before it)
    if (typeof v === 'string') v = v.replace(/ ([–—]) /g, `${NBSP}$1 `);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });

  const band = root.querySelector<HTMLElement>('[data-wall-band]');
  const rowA = root.querySelector<HTMLElement>('[data-wall-row="a"]');
  const rowB = root.querySelector<HTMLElement>('[data-wall-row="b"]');
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-wall-pause]');
  const pauseLabel = root.querySelector<HTMLElement>('[data-wall-pause-label]');
  if (!band || !rowA || !rowB) return;

  const { a, b } = dedications();
  // RTL: the big row travels right → left, the small one answers left → right
  const rows = [new Row(rowA, a, 34, -1), new Row(rowB, b, 22, 1)];

  let live = false;
  let inView = false;
  let ticking = false;
  let hover = false;
  let touchHold = false;
  let userPaused = false;
  let gust = 0;
  let st: ScrollTrigger | null = null;
  let touchTimer = 0;

  const tick = (_t: number, deltaMs: number) => {
    const dt = Math.min(0.05, deltaMs / 1000);
    gust *= Math.exp(-dt * 2.2);
    const stopped = userPaused || hover || touchHold;
    const target = stopped ? 0 : 1 + gust;
    rows.forEach((r) => r.step(dt, target));
  };
  const syncTicker = () => {
    const want = live && inView;
    if (want && !ticking) { gsap.ticker.add(tick); ticking = true; }
    else if (!want && ticking) { gsap.ticker.remove(tick); ticking = false; }
  };

  function setPaused(p: boolean) {
    userPaused = p;
    if (!pauseBtn) return;
    pauseBtn.setAttribute('aria-pressed', String(p));
    if (pauseLabel) pauseLabel.textContent = p ? 'הפעלת התנועה' : 'עצירת התנועה';
  }
  pauseBtn?.addEventListener('click', () => setPaused(!userPaused));

  // desktop hover / phones: a finger on the band holds it still for a moment
  band.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
  band.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover = false; });
  band.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    touchHold = true;
    clearTimeout(touchTimer);
    touchTimer = window.setTimeout(() => { touchHold = false; }, 2600);
  }, { passive: true });

  function mode() {
    const next = env.motionAllowed();
    if (next === live && st) return;
    live = next;
    root!.classList.toggle('wall--live', live);
    root!.classList.toggle('wall--static', !live);
    if (pauseBtn) pauseBtn.hidden = !live;
    rows.forEach((r) => r.layout(live));
    if (!st) {
      st = ScrollTrigger.create({
        trigger: band,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => { inView = self.isActive; syncTicker(); },
        onUpdate: (self) => { if (live) gust = Math.min(2.6, Math.max(gust, Math.abs(self.getVelocity()) / 700)); },
      });
      inView = st.isActive;
    }
    syncTicker();
  }

  mode();
  bus.on('motion:change', () => mode());
  // fonts change every width → re-measure the loop distance
  document.fonts?.ready.then(() => { if (live) rows.forEach((r) => r.layout(true)); });
  let rw = window.innerWidth;
  let raf = 0;
  window.addEventListener('resize', () => {
    if (window.innerWidth === rw) return;
    rw = window.innerWidth;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => rows.forEach((r) => r.layout(live)));
  }, { passive: true });
}
